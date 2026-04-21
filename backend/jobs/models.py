"""
Django ORM models that map to the tables created by supabase/init.sql.

All models use managed=False so Django never tries to CREATE or DROP them --
the tables already exist (created by init.sql / Supabase migrations).

We use UUIDField PKs and JSONField to match the Postgres schema exactly.
django.contrib.postgres.search is used for the tsvector search_vector column.
"""

import uuid

from django.contrib.postgres.search import SearchVectorField
from django.db import models


class Company(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4)
    normalized_name = models.TextField(unique=True)
    homepage_url    = models.TextField(unique=True)
    name            = models.TextField()
    company_size    = models.TextField(null=True, blank=True)
    hq_city         = models.TextField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        managed  = False
        db_table = "companies"
        ordering = ["name"]

    def __str__(self):
        return self.name


class JobPosting(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4)
    company       = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="job_postings",
        db_column="company_id",
    )
    title         = models.TextField()
    description   = models.TextField(blank=True, default="")
    apply_url     = models.TextField()
    languages     = models.JSONField(default=dict)
    tech_stack    = models.JSONField(default=list)
    remote_type   = models.TextField(null=True, blank=True)
    is_in_berlin  = models.BooleanField(default=False)
    role_category = models.TextField(null=True, blank=True)
    search_vector = SearchVectorField(null=True, editable=False)
    is_active     = models.BooleanField(default=True)
    posted_at     = models.DateTimeField(auto_now_add=True)
    scraped_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        managed  = False
        db_table = "job_postings"
        ordering = ["-posted_at"]

    def __str__(self):
        return f"{self.title} @ {self.company_id}"


class SavedJob(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id    = models.UUIDField()          # Supabase auth.users.id
    job        = models.ForeignKey(
        JobPosting,
        on_delete=models.CASCADE,
        related_name="saved_by",
        db_column="job_id",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed   = False
        db_table  = "saved_jobs"
        unique_together = [("user_id", "job")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"user={self.user_id} job={self.job_id}"
