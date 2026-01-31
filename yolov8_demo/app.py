from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from ultralytics import YOLO
from PIL import Image
import io
import os

MODEL_PATH = os.environ.get("MODEL_PATH", "best.pt")

app = FastAPI(title="YOLOv8 Inference API")


@app.on_event("startup")
async def load_model():
    # Loads YOLO model once at startup. Set MODEL_PATH env var to point to your .pt file.
    app.state.model = YOLO(MODEL_PATH)


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    content = await file.read()
    img = Image.open(io.BytesIO(content)).convert("RGB")

    # Run prediction (returns a Results object list)
    results = app.state.model.predict(source=img, imgsz=640, conf=0.25, verbose=False)
    res = results[0]

    detections = []
    if hasattr(res, 'boxes') and len(res.boxes) > 0:
        for i in range(len(res.boxes)):
            xyxy = res.boxes.xyxy[i].tolist()
            conf = float(res.boxes.conf[i])
            cls = int(res.boxes.cls[i])
            label = app.state.model.names.get(cls, str(cls)) if hasattr(app.state.model, 'names') else str(cls)
            detections.append({
                "box": [float(x) for x in xyxy],
                "confidence": conf,
                "class": cls,
                "label": label
            })

    return JSONResponse({"detections": detections})
