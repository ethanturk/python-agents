FROM python:3.11-alpine

WORKDIR /app

# Install build dependencies if necessary (often needed for alpine)
RUN apk add --no-cache build-base

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "backend_app:app", "--host", "0.0.0.0", "--port", "8000"]
