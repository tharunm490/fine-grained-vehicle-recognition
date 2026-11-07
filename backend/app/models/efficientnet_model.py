import threading
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torchvision.models import efficientnet_b2

from app.services.preprocessing import bgr_to_rgb_pil, efficientnet_transform


class EfficientNetB2Model:
    id = "efficientnet_b2"
    name = "EfficientNet-B2"
    short_name = "EfficientNet-B2"
    approach = "Approach 2 — Deep Learning"
    approach_key = "deep_learning"
    architecture = "EfficientNet-B2 convolutional network with a 196-class linear head"
    description = (
        "Compound-scaled CNN fine-tuned for Stanford Cars classification. "
        "Returns softmax probabilities over 196 fine-grained vehicle classes."
    )
    training_approach = "Transfer learning on Stanford Cars, then fine-tuning of the full network."
    feature_extraction = "Learned convolutional features from ImageNet-initialised EfficientNet-B2."
    input_size = "260 × 260"
    num_classes = 196
    framework = "PyTorch · Torchvision"
    parameters = "≈ 9.1M parameters"

    def __init__(self, path: Path, class_names: list[str], device: torch.device):
        self.path = path
        self.class_names = class_names
        self.device = device
        self.available = False
        self.error: str | None = None
        self.load_time_ms: float | None = None
        self._lock = threading.Lock()
        self.model: nn.Module | None = None
        self.transform = efficientnet_transform()

    def load(self) -> None:
        started = time.perf_counter()
        try:
            if not self.path.exists():
                raise FileNotFoundError(f"Checkpoint not found: {self.path.name}")
            model = efficientnet_b2(weights=None)
            in_features = model.classifier[1].in_features
            model.classifier[1] = nn.Linear(in_features, len(self.class_names))
            state = torch.load(self.path, map_location="cpu", weights_only=True)
            if isinstance(state, dict) and "state_dict" in state and isinstance(state["state_dict"], dict):
                state = state["state_dict"]
            missing, unexpected = model.load_state_dict(state, strict=False)
            if missing or unexpected:
                raise ValueError(
                    f"Checkpoint mismatch — missing keys: {len(missing)}, unexpected keys: {len(unexpected)}"
                )
            model.to(self.device)
            model.eval()
            self.model = model
            self.available = True
            self.error = None
        except Exception as exc:
            self.available = False
            self.error = str(exc)
        finally:
            self.load_time_ms = round((time.perf_counter() - started) * 1000, 2)

    def predict(self, image_bgr: np.ndarray) -> dict:
        if not self.available or self.model is None:
            raise RuntimeError(self.error or "EfficientNet-B2 is unavailable")
        with self._lock:
            started = time.perf_counter()
            image = bgr_to_rgb_pil(image_bgr)
            tensor = self.transform(image).unsqueeze(0).to(self.device)
            with torch.inference_mode():
                logits = self.model(tensor)
                probabilities = torch.softmax(logits, dim=1)[0]
            values, indices = torch.topk(probabilities, k=5)
            values = values.detach().cpu().numpy()
            indices = indices.detach().cpu().numpy()
            elapsed = round((time.perf_counter() - started) * 1000, 2)
            top_5 = [
                {
                    "rank": rank + 1,
                    "class_id": int(class_id),
                    "class_name": self.class_names[int(class_id)],
                    "score": float(value),
                    "confidence": float(value),
                    "relative_score": float(value),
                }
                for rank, (class_id, value) in enumerate(zip(indices, values))
            ]
            best = int(indices[0])
            return {
                "model_id": self.id,
                "model_name": self.name,
                "approach": self.approach,
                "predicted_class": self.class_names[best],
                "predicted_class_id": best,
                "confidence": float(values[0]),
                "confidence_type": "softmax",
                "top_5": top_5,
                "inference_time_ms": elapsed,
                "note": None,
            }
