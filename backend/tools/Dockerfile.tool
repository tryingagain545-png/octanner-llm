FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn[standard]==0.24.0 \
    pydantic==2.5.0 \
    httpx==0.25.2

# Copy tool servers
COPY *.py .

# Default command (override in docker-compose)
CMD ["python", "promptmap_server.py"]