# Multi-Stage Production Dockerfile for CiteCheck AI Backend

# Stage 1: Build Dependencies
FROM python:3.11-slim as builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# Stage 2: Minimal Runtime Environment
FROM python:3.11-slim as runtime

WORKDIR /app

# Create unprivileged user for security
RUN groupadd -r citecheck && useradd -r -g citecheck citecheck

COPY --from=builder /install /usr/local
COPY . /app

# Configure python path and runtime settings
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

USER citecheck

EXPOSE 8000

# Docker health check probing /healthz
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/healthz')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

