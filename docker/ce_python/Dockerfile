FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the API server
COPY api_server.py .

# The CategorizationEnginePython folder will be mounted as a volume
# This allows users to add their own code without rebuilding

EXPOSE 3002

CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "3002"]
