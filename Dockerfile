# ==========================================
# STAGE 1: Build React Frontend
# ==========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY services/frontend/web/package.json services/frontend/web/package-lock.json ./
RUN npm ci

# Copy the rest of the frontend source
COPY services/frontend/web/ ./

# Build the Vite React app for production
RUN npm run build


# ==========================================
# STAGE 2: Build FastAPI Backend
# ==========================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY services/backend/requirements.txt .

# Install python dependencies
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# Copy backend source code
COPY services/backend/app ./app

# Copy the built React app from Stage 1 into the backend's static folder
COPY --from=frontend-builder /app/frontend/dist ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
