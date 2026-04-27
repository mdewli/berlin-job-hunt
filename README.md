Overview
Berlin Job Hunt is a full-stack application that aggregates and filters job postings specifically for the Berlin market. The system automates data collection, AI-driven classification, and user-specific job tracking.

Core Tech Stack
Backend: Django & Django REST Framework (DRF)

Frontend: React (Vite) & Tailwind CSS

Database: PostgreSQL (via Supabase)

Auth: Supabase Auth (JWT)

AI/Scraping: Crawl4AI & DeepSeek API

System Components
Crawler Service: Scrapes job boards using Crawl4AI.

Sends raw data to DeepSeek API to extract structured fields: Role, Salary, Remote status, and CEFR Language Levels (A1-C2).

Normalizes company names to prevent duplicate entries.

Database Layer: Hosted on Supabase.

Uses PostgreSQL tsvector for full-text search.

Stores relational data for Companies, Jobs, and User-Saved listings.

API Layer: Django handles business logic and serves endpoints to the frontend.

Validates Supabase JWTs to ensure secure access to user "Save" features.

Data Flow
Ingestion: Scraper → DeepSeek (Classification) → PostgreSQL.

Consumption: React Frontend → Django API → PostgreSQL.

Planned Improvements
Semantic Search: Implementing vector embeddings (pgvector) to allow searching by "intent" rather than just keywords.

Automated Email Alerts: Triggering notifications when new jobs matching a user's language level are found.

Advanced Language Filtering: Using LLMs to verify language requirements directly from the job description text.
