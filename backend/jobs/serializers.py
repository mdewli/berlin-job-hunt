from rest_framework import serializers

from .models import Company, JobPosting, SavedJob


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Company
        fields = ["id", "name", "homepage_url", "company_size", "hq_city"]


class JobPostingSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)

    class Meta:
        model = JobPosting
        fields = [
            "id",
            "company",
            "title",
            "apply_url",
            "languages",
            "tech_stack",
            "remote_type",
            "is_in_berlin",
            "role_category",
            "is_active",
            "posted_at",
        ]


class SavedJobSerializer(serializers.ModelSerializer):
    job = JobPostingSerializer(read_only=True)
    job_id = serializers.UUIDField(write_only=True)

    class Meta:
        model  = SavedJob
        fields = ["id", "job", "job_id", "created_at"]

    def create(self, validated_data):
        validated_data["user_id"] = self.context["user_id"]
        return super().create(validated_data)
