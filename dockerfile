FROM python:3.11-slim

WORKDIR /app
COPY backend ./backend
COPY src ./src
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8000
CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"]