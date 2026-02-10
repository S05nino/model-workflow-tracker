FROM python:3.10-slim

WORKDIR /app

# Install Streamlit and dependencies used by dashboard.py
RUN pip install --no-cache-dir streamlit pandas openpyxl

# Copy the dashboard script
COPY dashboard.py .

EXPOSE 8501

CMD ["streamlit", "run", "dashboard.py", "--server.port=8501", "--server.address=0.0.0.0", "--server.headless=true"]
