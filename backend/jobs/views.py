"""
API views for Berlin Job Hub.

Endpoints
---------
GET  /api/v1/jobs/               JobListView        -- paginated feed with FTS + filters
GET  /api/v1/jobs/<uuid>/        JobDetailView      -- single job
GET  /api/v1/saved-jobs/         SavedJobsView      -- list saved jobs    (JWT required)
POST /api/v1/saved-jobs/         SavedJobsView      -- save a job         (JWT required)
DEL  /api/v1/saved-jobs/         SavedJobsView      -- unsave a job       (JWT required)
GET  /api/v1/companies/          CompanyListView    -- paginated company directory
POST /api/v1/companies/suggest/  CompanySuggestView -- suggest a company  (JWT required)

JobListView query params
------------------------
q            Full-text search string (uses websearch_to_tsquery)
berlin       true  -> filter is_in_berlin=True
english_only true  -> jobs with no German requirement, or DE <= A2
remote_type  Full-Remote | Hybrid | On-site
company_size Micro | Startup | Mid-size | Enterprise
role         role_category substring match (case-insensitive)
page         page number (default: 1, page_size: 20)

CompanyListView query params
----------------------------
q        Name search (case-insensitive contains)
size     Micro | Startup | Mid-size | Enterprise
has_jobs true -> only companies with ≥1 active job
page     page number (default: 1, page_size: 30)
"""

import logging
import re
from urllib.parse import urlparse

import jwt
from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Company, JobPosting, SavedJob
from .serializers import CompanyListSerializer, JobPostingSerializer, SavedJobSerializer

logger = logging.getLogger(__name__)

VALID_REMOTE_TYPES  = {"Full-Remote", "Hybrid", "On-site"}
VALID_COMPANY_SIZES = {"Micro", "Startup", "Mid-size", "Enterprise"}

_LEGAL_SUFFIXES_RE = re.compile(
    r"\b(gmbh|ag|se|kg|ltd|llc|inc|corp|co\.?|bv|nv|sa|sas|sarl|plc)\b\.?\s*$",
    re.IGNORECASE,
)


def _normalize_company_name(name: str) -> str:
    norm = _LEGAL_SUFFIXES_RE.sub("", name.lower()).strip(" .-")
    return re.sub(r"\s+", " ", norm)


def _clean_company_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    netloc = parsed.netloc.lstrip("www.")
    return f"{parsed.scheme}://{netloc}".rstrip("/")


# ---------------------------------------------------------------------------
# JWT helper
# ---------------------------------------------------------------------------

def _get_user_id(request) -> str | None:
    """
    Verify a Supabase JWT from the Authorization: Bearer <token> header.
    Returns the user UUID string (sub claim) on success, None otherwise.
    """
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Bearer "):
        return None

    token = auth[7:]
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        logger.error("SUPABASE_JWT_SECRET is not configured.")
        return None

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        logger.debug("JWT expired")
    except jwt.InvalidTokenError as exc:
        logger.debug("Invalid JWT: %s", exc)
    return None


# ---------------------------------------------------------------------------
# Job list (public)
# ---------------------------------------------------------------------------

class JobListView(ListAPIView):
    """
    Paginated, filterable list of active job postings.
    Uses Postgres full-text search when ?q= is provided.
    """
    serializer_class = JobPostingSerializer

    def get_queryset(self):
        qs = (
            JobPosting.objects
            .filter(is_active=True)
            .select_related("company")
        )

        # ── Full-text search ──────────────────────────────────────────────
        q = self.request.query_params.get("q", "").strip()
        if q:
            # websearch_to_tsquery supports AND/OR/"-" negation naturally
            search_query = SearchQuery(q, search_type="websearch", config="english")
            qs = (
                qs
                .annotate(rank=SearchRank("search_vector", search_query))
                .filter(search_vector=search_query)
                .order_by("-rank", "-posted_at")
            )
        else:
            qs = qs.order_by("-posted_at")

        # ── Berlin / remote filter ─────────────────────────────────────────
        if self.request.query_params.get("berlin", "").lower() == "true":
            qs = qs.filter(is_in_berlin=True)

        # ── English-only filter ───────────────────────────────────────────
        # Keeps jobs where German is not mentioned at all, or <= A2 level.
        if self.request.query_params.get("english_only", "").lower() == "true":
            qs = qs.extra(
                where=[
                    "NOT (languages ? 'german')"
                    " OR languages->>'german' IN ('A1', 'A2')"
                ]
            )

        # ── Remote type ───────────────────────────────────────────────────
        remote_type = self.request.query_params.get("remote_type", "")
        if remote_type in VALID_REMOTE_TYPES:
            qs = qs.filter(remote_type=remote_type)

        # ── Company size ──────────────────────────────────────────────────
        company_size = self.request.query_params.get("company_size", "")
        if company_size in VALID_COMPANY_SIZES:
            qs = qs.filter(company__company_size=company_size)

        # ── Role category ─────────────────────────────────────────────────
        role = self.request.query_params.get("role", "").strip()
        if role:
            qs = qs.filter(role_category__iexact=role)

        return qs


# ---------------------------------------------------------------------------
# Job detail (public)
# ---------------------------------------------------------------------------

class JobDetailView(RetrieveAPIView):
    serializer_class = JobPostingSerializer
    queryset = JobPosting.objects.filter(is_active=True).select_related("company")


# ---------------------------------------------------------------------------
# Saved jobs (requires Supabase JWT)
# ---------------------------------------------------------------------------

class SavedJobsView(APIView):
    """
    Manage the current user's saved jobs.
    Every request must carry a valid Supabase JWT in the Authorization header.
    """

    def _require_user(self, request):
        user_id = _get_user_id(request)
        if not user_id:
            return None, Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return user_id, None

    def get(self, request):
        user_id, err = self._require_user(request)
        if err:
            return err

        saved = (
            SavedJob.objects
            .filter(user_id=user_id)
            .select_related("job__company")
            .order_by("-created_at")
        )
        serializer = SavedJobSerializer(saved, many=True)
        return Response(serializer.data)

    def post(self, request):
        user_id, err = self._require_user(request)
        if err:
            return err

        job_id = request.data.get("job_id")
        if not job_id:
            return Response(
                {"detail": "job_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            job = JobPosting.objects.get(id=job_id, is_active=True)
        except (JobPosting.DoesNotExist, Exception):
            return Response(
                {"detail": "Job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        saved, created = SavedJob.objects.get_or_create(
            user_id=user_id,
            job=job,
        )
        return Response(
            SavedJobSerializer(saved).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request):
        user_id, err = self._require_user(request)
        if err:
            return err

        job_id = request.data.get("job_id")
        if not job_id:
            return Response(
                {"detail": "job_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = SavedJob.objects.filter(
            user_id=user_id, job_id=job_id
        ).delete()

        if deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(
            {"detail": "Saved job not found."},
            status=status.HTTP_404_NOT_FOUND,
        )


# ---------------------------------------------------------------------------
# Company list (public)
# ---------------------------------------------------------------------------

class CompanyListView(ListAPIView):
    """
    Paginated directory of companies.
    Each company includes a live count of its active job postings.

    Query params:
      q        — name contains (case-insensitive)
      size     — Micro | Startup | Mid-size | Enterprise
      has_jobs — true → only companies with ≥1 active job
      page     — page number (page_size=30)
    """
    serializer_class = CompanyListSerializer

    def get_queryset(self):
        qs = Company.objects.annotate(
            job_count=Count(
                "job_postings",
                filter=Q(job_postings__is_active=True),
            )
        ).filter(is_active=True)

        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(name__icontains=q)

        size = self.request.query_params.get("size", "").strip()
        if size in VALID_COMPANY_SIZES:
            qs = qs.filter(company_size=size)

        if self.request.query_params.get("has_jobs", "").lower() == "true":
            qs = qs.filter(job_count__gt=0)

        return qs.order_by("-job_count", "name")


# ---------------------------------------------------------------------------
# Company suggest (JWT required)
# ---------------------------------------------------------------------------

class CompanySuggestView(APIView):
    """
    POST /api/v1/companies/suggest/
    Body: { name, homepage_url, job_board_url? }
    Returns the upserted company record.
    Creates if new, no-ops (200) if already known.
    The daily crawler will automatically pick up new companies.
    """

    def post(self, request):
        user_id = _get_user_id(request)
        if not user_id:
            return Response(
                {"detail": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        name          = (request.data.get("name") or "").strip()
        homepage_url  = (request.data.get("homepage_url") or "").strip()
        job_board_url = (request.data.get("job_board_url") or "").strip() or None

        errors = {}
        if not name:
            errors["name"] = "Company name is required."
        if not homepage_url:
            errors["homepage_url"] = "Homepage URL is required."
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        normalized    = _normalize_company_name(name)
        clean_home    = _clean_company_url(homepage_url)
        clean_board   = _clean_company_url(job_board_url) if job_board_url else None

        try:
            company, created = Company.objects.update_or_create(
                homepage_url=clean_home,
                defaults={
                    "name":           name,
                    "normalized_name": normalized,
                    "job_board_url":  clean_board,
                    "is_active":      True,
                },
            )
        except Exception as exc:
            # e.g. unique_violation on normalized_name from a parallel request
            logger.warning("CompanySuggest upsert error: %s", exc)
            # Try to find the existing record to return a useful response
            company = Company.objects.filter(
                Q(homepage_url=clean_home) | Q(normalized_name=normalized)
            ).first()
            if company:
                serializer = CompanyListSerializer(
                    company,
                    context={"job_count": 0},
                )
                # Annotate manually since we can't re-run the queryset here
                company_qs = Company.objects.annotate(
                    job_count=Count(
                        "job_postings",
                        filter=Q(job_postings__is_active=True),
                    )
                ).filter(id=company.id).first()
                return Response(
                    CompanyListSerializer(company_qs).data,
                    status=status.HTTP_200_OK,
                )
            return Response(
                {"detail": "Could not save company. It may already exist under a different URL."},
                status=status.HTTP_409_CONFLICT,
            )

        company_qs = Company.objects.annotate(
            job_count=Count(
                "job_postings",
                filter=Q(job_postings__is_active=True),
            )
        ).get(id=company.id)

        return Response(
            CompanyListSerializer(company_qs).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
