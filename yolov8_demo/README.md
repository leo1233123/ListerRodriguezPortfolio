YOLOv8 FastAPI Demo

Quick scaffold to serve a YOLOv8 model with FastAPI.

Files:
- `app.py` — FastAPI app that loads a YOLO model and exposes `/predict` for image uploads.
- `requirements.txt` — Python dependencies.
- `Dockerfile` — Containerize the service.

Run locally (Python):

1. Create a virtualenv (optional) and install dependencies:

```powershell
cd "C:\Users\liste\Desktop\My Portfolio Website\yolov8_demo"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Place your YOLOv8 weights file at `best.pt` (or set `MODEL_PATH` env var).

3. Run the server:

```powershell
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

4. Predict with `curl` (example):

```bash
curl -X POST "http://localhost:8000/predict" -F "file=@/path/to/image.jpg"
```

Run with Docker:

```powershell
cd "C:\Users\liste\Desktop\My Portfolio Website\yolov8_demo"
# Build
docker build -t yolov8-api .
# Run (mount your model into container)
docker run -p 8000:8000 -v "${PWD}:/app" -e MODEL_PATH=/app/best.pt yolov8-api
```

Notes:
- The `ultralytics` package will download model code and may require additional system libraries for some ops.
- For production, consider GPU support, batching, async workers, and request/response size limits.
