FROM python:3.14-slim

WORKDIR /app

COPY pyproject.toml .
COPY safe/ safe/

RUN pip install --no-cache-dir "." \
    && groupadd --gid 1000 appuser \
    && useradd --uid 1000 --gid appuser --no-create-home appuser \
    && mkdir /data && chown appuser:appuser /data

ENV SAFE_API_HOST=0.0.0.0
ENV SAFE_API_PORT=8000
ENV SAFE_DB_PATH=/data/db.json

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["python", "-m", "uvicorn", "safe.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
