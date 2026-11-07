import threading
import time
import warnings
from pathlib import Path

import joblib
import numpy as np

from app.services.feature_extraction import extract_classical_features


class ClassicalSVMModel:
    id = "classical_svm"
    name = "Classical SVM (HOG + LBP + HSV)"
    short_name = "Classical SVM"
    approach = "Approach 1 — Classical Computer Vision"
    approach_key = "classical"
    architecture = "HOG + LBP + HSV feature fusion → StandardScaler → PCA (300) → RBF-kernel SVM → sigmoid (Platt) probability calibration"
    description = (
        "Handcrafted-feature pipeline combining Histogram of Oriented Gradients, Local Binary Patterns "
        "and a 3D HSV colour histogram, reduced with PCA, classified by a one-vs-rest RBF SVM and "
        "calibrated with sigmoid (Platt) scaling fitted by cross-validation on the training split."
    )
    training_approach = (
        "Supervised training on Stanford Cars handcrafted features, followed by PCA and SVM fitting, "
        "then 5-fold cross-validated sigmoid calibration on the training data."
    )
    feature_extraction = "HOG (9 orientations, 16×16 cells, 2×2 blocks) + LBP (P=16, R=2, uniform) + HSV 3D histogram (16×8×8), concatenated into 2,807 features."
    input_size = "128 × 128"
    num_classes = 196
    framework = "scikit-learn · scikit-image · OpenCV"
    parameters = "PCA: 300 components · SVC: RBF kernel · Calibration: sigmoid (Platt), 5-fold CV"

    def __init__(self, path: Path, class_names: list[str]):
        self.path = path
        self.class_names = class_names
        self.available = False
        self.error: str | None = None
        self.load_time_ms: float | None = None
        self._lock = threading.Lock()
        self.svm = None
        self.calibrated_model = None
        self.calibration_info: dict = {}
        self.scaler = None
        self.pca = None
        self.image_size = (128, 128)
        self.hog_orientations = 9
        self.lbp_radius = 2
        self.lbp_points = 16
        self.lbp_method = "uniform"
        self.hsv_bins = (16, 8, 8)

    def load(self) -> None:
        started = time.perf_counter()
        try:
            if not self.path.exists():
                raise FileNotFoundError(f"Checkpoint not found: {self.path.name}")
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                package = joblib.load(self.path)
            required = {
                "svm_model",
                "scaler",
                "pca",
                "class_names",
                "image_size",
                "hog_orientations",
                "lbp_radius",
                "lbp_points",
                "lbp_method",
                "hsv_bins",
            }
            missing = required.difference(package.keys())
            if missing:
                raise ValueError(f"Checkpoint is missing keys: {', '.join(sorted(missing))}")

            names = list(package["class_names"])
            if names != self.class_names:
                raise ValueError("Checkpoint class mapping does not match the canonical Stanford Cars mapping")

            calibrated = package.get("calibrated_model")
            if calibrated is None:
                raise ValueError(
                    "Checkpoint has no calibrated classifier. "
                    "Run backend/scripts/calibrate_classical_svm.py to create a calibrated model package."
                )
            if not hasattr(calibrated, "predict_proba"):
                raise ValueError("The calibrated classifier does not expose predict_proba")
            calibrated_classes = np.asarray(calibrated.classes_, dtype=np.int64)
            if not np.array_equal(calibrated_classes, np.arange(len(self.class_names))):
                raise ValueError("Calibrated class order does not match the canonical Stanford Cars mapping")

            self.svm = package["svm_model"]
            self.calibrated_model = calibrated
            self.calibration_info = dict(package.get("calibration") or {})
            self.scaler = package["scaler"]
            self.pca = package["pca"]
            self.image_size = tuple(package["image_size"])
            self.hog_orientations = int(package["hog_orientations"])
            self.lbp_radius = int(package["lbp_radius"])
            self.lbp_points = int(package["lbp_points"])
            self.lbp_method = str(package["lbp_method"])
            self.hsv_bins = tuple(package["hsv_bins"])

            if self.scaler.mean_.shape[0] != 2807:
                raise ValueError("Scaler feature dimension is not the expected 2,807")
            if self.pca.components_.shape != (300, 2807):
                raise ValueError("PCA configuration is not the expected 300 × 2,807")
            if self.svm.n_features_in_ != 300:
                raise ValueError("SVM input dimension is not the expected 300")
            if len(self.class_names) != 196:
                raise ValueError("Expected 196 Stanford Cars classes")

            self.available = True
            self.error = None
        except Exception as exc:
            self.available = False
            self.error = str(exc)
        finally:
            self.load_time_ms = round((time.perf_counter() - started) * 1000, 2)

    def predict(self, image_bgr: np.ndarray) -> dict:
        if not self.available or self.calibrated_model is None:
            raise RuntimeError(self.error or "Classical model is unavailable")
        with self._lock:
            started = time.perf_counter()
            features = extract_classical_features(
                image_bgr,
                image_size=self.image_size,
                hog_orientations=self.hog_orientations,
                lbp_radius=self.lbp_radius,
                lbp_points=self.lbp_points,
                lbp_method=self.lbp_method,
                hsv_bins=self.hsv_bins,
            )
            scaled = self.scaler.transform(features.reshape(1, -1))
            reduced = self.pca.transform(scaled)
            probabilities = np.asarray(self.calibrated_model.predict_proba(reduced)[0], dtype=np.float64)

            expected = len(self.class_names)
            if probabilities.shape != (expected,):
                raise RuntimeError(f"Expected {expected} class probabilities, received {probabilities.shape}")
            if not np.isfinite(probabilities).all():
                raise RuntimeError("Calibrated probabilities contain non-finite values")
            if probabilities.min() < 0.0 or probabilities.max() > 1.0:
                raise RuntimeError("Calibrated probabilities fall outside the [0, 1] range")
            total = float(probabilities.sum())
            if abs(total - 1.0) > 1e-6:
                raise RuntimeError(f"Calibrated probabilities sum to {total:.6f} instead of 1")

            order = np.argsort(probabilities)[::-1][:5]
            elapsed = round((time.perf_counter() - started) * 1000, 2)

            top_5 = [
                {
                    "rank": rank + 1,
                    "class_id": int(class_id),
                    "class_name": self.class_names[int(class_id)],
                    "score": float(probabilities[int(class_id)]),
                    "confidence": float(probabilities[int(class_id)]),
                    "relative_score": float(probabilities[int(class_id)]),
                }
                for rank, class_id in enumerate(order)
            ]
            best = int(order[0])
            return {
                "model_id": self.id,
                "model_name": self.name,
                "approach": self.approach,
                "predicted_class": self.class_names[best],
                "predicted_class_id": best,
                "confidence": float(probabilities[best]),
                "confidence_type": "calibrated",
                "top_5": top_5,
                "inference_time_ms": elapsed,
                "note": "Probabilities are calibrated estimates and do not guarantee prediction correctness.",
            }
