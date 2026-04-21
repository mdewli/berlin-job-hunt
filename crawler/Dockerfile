FROM python:3.12-slim

# System packages needed by Crawl4AI (Playwright browser deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc wget curl \
    # Playwright / Chromium dependencies
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Crawl4AI browser (Chromium via Playwright)
RUN crawl4ai-setup || python -m playwright install chromium --with-deps

COPY . .

# Default command: show help. Override with --url or --batch in docker compose.
ENTRYPOINT ["python", "main.py"]
CMD ["--help"]
