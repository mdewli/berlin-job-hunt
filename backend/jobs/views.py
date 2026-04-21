"""
API views for Berlin Job Hub.

Endpoints
---------
GET  /api/v1/jobs/          JobListView   -- paginated feed with FTS + filters
GET  /api/v1/jobs/<uuid>/   JobDetailView -- single job
GET  /api/v1/saved-jobs/    SavedJobsView -- list saved jobs    (JWT required)
POST /api/v1/saved-jobs/    SavedJobsView -- save a job         (JWT required)
DEL  /api/v1/saved-jobs/    SavedJobsView -- unsave a job       (JWT required)

JobListView query params
------------------------
q            Full-text search string (uses websearch_to_tsquery)
berlin       true  -> filter is_in_berlin=True
english_only true  -> jobs with no German requirement, or DE <= A2
remote_type  Full-Remote | Hybrid | On-site
company_size Micro | Startup | Mid-size | Enterprise
role         role_category substring match (case-insensitive)
page         page number (default: 1, page_size: 20)
"""

import logging

import jwt
from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import Q
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import JobPosting, SavedJob
from .serializers import JobPostingSerializer, SavedJobSerializer

logger = logging.getLogger(__name__)

VALID_REMOTE_TYPES = {"Full-Remote", "Hybrid", "On-site"}
VALID_COMPANY_SIZES = {"Micro", "Startup", "Mid-size", "Enterprise"}


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
