import logging
import os
import threading
import time
from pathlib import Path

import numpy as np

os.environ.setdefault("YOLO_AUTOINSTALL", "false")
os.environ.setdefault("YOLO_VERBOSE", "false")

from app.config import settings

logger = logging.getLogger(__name__)

VEHICLE_CLASS_IDS = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


class VehicleDetector:
    def __init__(self, model_path: Path, device: str):
        self.model_path = model_path
        self.device = device
        self.available = False
        self.error: str | None = None
        self.load_time_ms: float | None = None
        self.model = None
        self._lock = threading.Lock()
        self.source = "Ultralytics YOLO11n · COCO pretrained · classes: car, motorcycle, bus, truck"
        self.classes = sorted(VEHICLE_CLASS_IDS.values())

    def load(self) -> None:
        started = time.perf_counter()
        try:
            from ultralytics import YOLO

            if self.model_path.exists():
                self.model = YOLO(str(self.model_path))
            else:
                logger.info("YOLO checkpoint not found at %s; requesting Ultralytics asset yolo11n.pt", self.model_path)
                self.model = YOLO("yolo11n.pt")
            self.available = True
            self.error = None
        except Exception as exc:
            self.available = False
            self.error = str(exc)
            logger.warning("Vehicle detector unavailable: %s", exc)
        finally:
            self.load_time_ms = round((time.perf_counter() - started) * 1000, 2)

    def detect(self, image_bgr: np.ndarray, confidence: float, max_detections: int) -> list[dict]:
        if not self.available or self.model is None:
            raise RuntimeError(self.error or "Vehicle detector is unavailable")
        with self._lock:
            device = 0 if self.device.startswith("cuda") else "cpu"
            results = self.model.predict(
                source=image_bgr,
                conf=float(confidence),
                classes=list(VEHICLE_CLASS_IDS.keys()),
                device=device,
                verbose=False,
                imgsz=640,
            )
            if not results:
                return []
            boxes = results[0].boxes
            if boxes is None or len(boxes) == 0:
                return []
            xyxy = boxes.xyxy.detach().cpu().numpy()
            confidences = boxes.conf.detach().cpu().numpy()
            class_ids = boxes.cls.detach().cpu().numpy().astype(int)
            names = results[0].names

            detections = []
            for coords, score, class_id in zip(xyxy, confidences, class_ids):
                detections.append(
                    {
                        "detection_class": names.get(int(class_id), VEHICLE_CLASS_IDS.get(int(class_id), "vehicle")),
                        "detection_confidence": float(score),
                        "bounding_box": {
                            "x1": float(coords[0]),
                            "y1": float(coords[1]),
                            "x2": float(coords[2]),
                            "y2": float(coords[3]),
                        },
                    }
                )
            detections.sort(key=lambda item: item["detection_confidence"], reverse=True)
            return detections[: max(1, max_detections)]
