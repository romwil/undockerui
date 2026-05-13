FROM python:3.11-slim

WORKDIR /app

# Install system dependencies in a single layer
# Node.js: yt-dlp needs a JS runtime for YouTube (EJS). See https://github.com/yt-dlp/yt-dlp/wiki/EJS
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Copy requirements first for better layer caching
# Dependencies change less frequently than application code
COPY requirements.txt .

# Install Python dependencies (this layer will be cached if requirements.txt doesn't change)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code (this layer will rebuild when code changes)
COPY app.py .
COPY templates/ templates/
COPY lore_vault.json .

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]