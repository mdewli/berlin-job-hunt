from django.urls import path

from . import views

urlpatterns = [
    path("jobs/",         views.JobListView.as_view(),   name="job-list"),
    path("jobs/<uuid:pk>/", views.JobDetailView.as_view(), name="job-detail"),
    path("saved-jobs/",   views.SavedJobsView.as_view(), name="saved-jobs"),
]
