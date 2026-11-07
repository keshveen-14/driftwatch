# --- build the React app ---
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- API + static frontend in one image ---
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt
COPY backend/ backend/
COPY research/results research/results
COPY --from=web /web/dist frontend/dist
ENV DRIFTWATCH_DB_PATH=/data/driftwatch.db
RUN mkdir -p /data && useradd -m app && chown -R app /data
USER app
ENV PORT=8000
EXPOSE 8000
WORKDIR /app/backend
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import os, urllib.request as u; u.urlopen('http://localhost:%s/api/health' % os.environ.get('PORT', '8000'))"
# Hosts such as Render assign the port through $PORT; locally it stays 8000.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
