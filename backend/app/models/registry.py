import logging
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
import torch

from app.config import settings
from app.models.classical_model import ClassicalSVMModel
from app.models.detector import VehicleDetector
from app.models.dinov2_model import DINOv2Model
from app.models.efficientnet_model import EfficientNetB2Model
from app.schemas.response import BenchmarkItem, BenchmarkResponse, MetricInfo, ModelInfo
from app.utils.checkpoint_utils import file_size, load_class_names

logger = logging.getLogger(__name__)

MODEL_ORDER = ("classical_svm", "efficientnet_b2", "dinov2")


def resolve_device(requested: str) -> torch.device:
    if requested == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if requested.startswith("cuda") and not torch.cuda.is_available():
        logger.warning("CUDA requested but unavailable; falling back to CPU")
        return torch.device("cpu")
    return torch.device(requested)


class ModelRegistry:
    def __init__(self):
        self.class_names = load_class_names()
        self.device = resolve_device(settings.device)
        self.created_at = time.time()
        self._benchmark_cache: tuple[float, BenchmarkResponse] | None = None

        self.classical = ClassicalSVMModel(settings.classical_model_path, self.class_names)
        self.efficientnet = EfficientNetB2Model(settings.efficientnet_model_path, self.class_names, self.device)
        self.dinov2 = DINOv2Model(settings.dinov2_model_path, self.class_names, self.device)
        self.detector = VehicleDetector(settings.yolo_model_path, str(self.device))
        self.models = {
            "classical_svm": self.classical,
            "efficientnet_b2": self.efficientnet,
            "dinov2": self.dinov2,
        }

    def load_all(self) -> None:
        logger.info("Loading classifiers on device: %s", self.device)
        for model_id in MODEL_ORDER:
            model = self.models[model_id]
            model.load()
            if model.available:
                logger.info("%s loaded in %.1f ms", model.name, model.load_time_ms or 0.0)
            else:
                logger.error("%s failed to load: %s", model.name, model.error)
        self.detector.load()
        if self.detector.available:
            logger.info("Vehicle detector loaded in %.1f ms", self.detector.load_time_ms or 0.0)
        else:
            logger.warning("Detection unavailable; classification-only mode will be used")

    def get(self, model_id: str):
        return self.models.get(model_id)

    @property
    def available_model_ids(self) -> list[str]:
        return [model_id for model_id in MODEL_ORDER if self.models[model_id].available]

    @property
    def uptime_seconds(self) -> float:
        return round(time.time() - self.created_at, 2)

    @property
    def evaluation_available(self) -> bool:
        path = settings.eval_dataset_dir
        return bool(path and Path(path).is_dir())

    def _metrics(self, model_id: str) -> dict[str, MetricInfo]:
        if model_id == "classical_svm":
            source = "Recorded experimental validation (team-provided)"
            note = "Validation results recorded during the original classical-model experiment."
            return {
                "top1_accuracy": MetricInfo(value=5.71, source=source, status="recorded", note=note),
                "top5_accuracy": MetricInfo(value=17.00, source=source, status="recorded", note=note),
                "precision_macro": MetricInfo(value=6.48, source=source, status="recorded", note=note),
                "recall_macro": MetricInfo(value=5.52, source=source, status="recorded", note=note),
                "f1_macro": MetricInfo(value=5.01, source=source, status="recorded", note=note),
            }
        if model_id == "efficientnet_b2":
            source = "Reported fine-tuned run (team-provided, not independently verified)"
            note = (
                "Figures belong to a reported fine-tuned EfficientNet-B2 run. "
                "The supplied file is named efficientnet_b2_transfer.pth and its equivalence to that run is unverified."
            )
            return {
                "top1_accuracy": MetricInfo(value=60.04, source=source, status="reported", note=note),
                "top5_accuracy": MetricInfo(value=83.18, source=source, status="reported", note=note),
            }
        if model_id == "dinov2":
            metadata = self.dinov2.checkpoint_metadata or {}
            loss = metadata.get("best_val_loss")
            note = (
                "Independently measured on 120 labelled images covering 4 Stanford Cars classes "
                "(test_images/hf). This is not a full 196-class test-set score; the official test "
                "annotations do not include labels. The checkpoint metadata reports 94.35% on its "
                "original validation split, which was not supplied."
            )
            return {
                "top1_accuracy": MetricInfo(
                    value=93.33,
                    source="Independent local evaluation · 120 labelled images (4 classes)",
                    status="measured",
                    note=note,
                ),
                "top5_accuracy": MetricInfo(
                    value=98.33,
                    source="Independent local evaluation · 120 labelled images (4 classes)",
                    status="measured",
                    note=note,
                ),
                "val_loss": MetricInfo(
                    value=float(loss) if loss is not None else None,
                    unit="",
                    source="Checkpoint metadata (best_val_loss)",
                    status="checkpoint_metadata",
                    note="Stored inside the supplied checkpoint.",
                ),
            }
        return {}

    def model_info(self, model_id: str) -> ModelInfo:
        model = self.models[model_id]
        notes: list[str] = []
        if model_id == "classical_svm":
            notes = [
                "Probabilities are produced by sigmoid (Platt) calibration fitted with 5-fold cross-validation "
                "on the Stanford Cars training split; raw SVM decision scores are no longer displayed.",
                "Calibration is reported separately from classification accuracy in "
                "backend/data/classical_svm_calibration_eval.json.",
                "Independent local validation on 120 labelled images across 4 classes: "
                "top-1 20.00%, top-5 32.50%, macro F1 19.25%; calibration quality: "
                "ECE 16.77%, Brier 0.9748, NLL 4.4400.",
                "Recorded validation metrics are experimental and do not guarantee per-image accuracy.",
            ]
        elif model_id == "efficientnet_b2":
            notes = [
                "Softmax probabilities are produced by the trained 196-class head.",
                "Reported metrics are displayed as unverified for the supplied checkpoint.",
            ]
        elif model_id == "dinov2":
            notes = [
                "Independent local evaluation: 93.33% top-1 and 98.33% top-5 on 120 labelled images across 4 classes.",
                "Checkpoint metadata reports 94.35% top-1 on its original validation split; that split was not supplied.",
                "Architecture reconstructed from checkpoint keys: ViT-B/14, 12 blocks, 768 embedding width, 518×518 input.",
            ]
        return ModelInfo(
            id=model.id,
            name=model.name,
            short_name=model.short_name,
            approach=model.approach,
            approach_key=model.approach_key,
            architecture=model.architecture,
            description=model.description,
            training_approach=model.training_approach,
            feature_extraction=model.feature_extraction,
            input_size=model.input_size,
            num_classes=model.num_classes,
            framework=model.framework,
            parameters=model.parameters,
            available=model.available,
            error=model.error,
            device=str(self.device) if model_id != "classical_svm" else "cpu",
            checkpoint_filename=model.path.name,
            checkpoint_size_bytes=file_size(model.path),
            load_time_ms=model.load_time_ms,
            metrics=self._metrics(model_id),
            notes=notes,
        )

    def models_info(self) -> list[ModelInfo]:
        return [self.model_info(model_id) for model_id in MODEL_ORDER]

    def health(self) -> dict:
        return {
            "models": [
                {"id": model_id, "available": self.models[model_id].available, "error": self.models[model_id].error}
                for model_id in MODEL_ORDER
            ],
            "device": str(self.device),
            "detector": {
                "available": self.detector.available,
                "model": "YOLO11n",
                "source": self.detector.source,
                "classes": self.detector.classes,
                "error": self.detector.error,
            },
        }

    def _benchmark_image(self) -> np.ndarray:
        height, width = 480, 640
        image = np.zeros((height, width, 3), dtype=np.uint8)
        for y in range(height):
            ratio = y / max(1, height - 1)
            image[y, :] = (
                int(30 + 45 * ratio),
                int(18 + 28 * ratio),
                int(12 + 18 * ratio),
            )
        cv2.rectangle(image, (150, 220), (490, 370), (165, 110, 45), -1)
        cv2.rectangle(image, (200, 175), (420, 250), (140, 95, 40), -1)
        cv2.circle(image, (215, 375), 34, (18, 18, 18), -1)
        cv2.circle(image, (435, 375), 34, (18, 18, 18), -1)
        cv2.putText(image, "BENCHMARK", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (120, 90, 40), 2, cv2.LINE_AA)
        return image

    def benchmark(self, iterations: int = 2, force: bool = False) -> BenchmarkResponse:
        now = time.time()
        if not force and self._benchmark_cache and now - self._benchmark_cache[0] < 600:
            return self._benchmark_cache[1]

        image = self._benchmark_image()
        results: list[BenchmarkItem] = []
        for model_id in MODEL_ORDER:
            model = self.models[model_id]
            if not model.available:
                results.append(BenchmarkItem(model_id=model_id, available=False, error=model.error))
                continue
            try:
                timings = []
                for _ in range(max(1, min(iterations, 5))):
                    prediction = model.predict(image)
                    timings.append(float(prediction["inference_time_ms"]))
                timings.sort()
                median = timings[len(timings) // 2]
                results.append(BenchmarkItem(model_id=model_id, available=True, latency_ms=round(median, 2)))
            except Exception as exc:
                results.append(BenchmarkItem(model_id=model_id, available=False, error=str(exc)))

        response = BenchmarkResponse(
            success=True,
            device=str(self.device),
            iterations=max(1, min(iterations, 5)),
            measured_at=datetime.now(timezone.utc).isoformat(),
            results=results,
        )
        self._benchmark_cache = (now, response)
        return response
