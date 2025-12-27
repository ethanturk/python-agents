FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for Markitdown and various machine learning libraries
# build-essential for compiling some python packages
# libgl1 and libglib2.0-0 are often required by cv2/vision libraries used in Markitdown
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip to ensure wheel compatibility
RUN pip install --upgrade pip

# Install PyTorch CPU-only explicitly to avoid GPU bloat and compilation issues
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "backend_app:app", "--host", "0.0.0.0", "--port", "8000"]
