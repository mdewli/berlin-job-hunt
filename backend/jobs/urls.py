from django.urls import path

from . import views

urlpatterns = [
    path("jobs/",                views.JobListView.as_view(),    name="job-list"),
    path("jobs/<uuid:pk>/",      views.JobDetailView.as_view(),  name="job-detail"),
    path("saved-jobs/",          views.SavedJobsView.as_view(),  name="saved-jobs"),
    path("companies/",           views.CompanyListView.as_view(), name="company-list"),
    path("companies/suggest/",   views.CompanySuggestView.as_view(), name="company-suggest"),
]
