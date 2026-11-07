from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import cv2
import joblib
import numpy as np
import scipy.io as sio
import sklearn
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import log_loss, precision_recall_fscore_support
from sklearn.model_selection import StratifiedKFold

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.feature_extraction import extract_classical_features  # noqa: E402

TRAIN_DIR = BACKEND_ROOT / "app" / "database" / "cars_train"
TRAIN_ANNOS = BACKEND_ROOT / "app" / "database" / "devkit" / "cars_train_annos.mat"
CACHE_PATH = BACKEND_ROOT / "data" / "classical_train_pca_features.npz"
REPORT_PATH = BACKEND_ROOT / "data" / "classical_svm_calibration_eval.json"
DEFAULT_CHECKPOINT = PROJECT_ROOT / "classical_vehicle_recognition.pkl"
DEFAULT_BACKUP = PROJECT_ROOT / "classical_vehicle_recognition_uncalibrated_backup.pkl"
VALIDATION_DIR = PROJECT_ROOT / "test_images" / "hf"
VALIDATION_LABELS = VALIDATION_DIR / "labels.json"
RANDOM_STATE = 42


def log(message: str) -> None:
    print(f"[calibrate] {message}", flush=True)


def package_parameters(package: dict) -> dict:
    return {
        "image_size": tuple(int(v) for v in package["image_size"]),
        "hog_orientations": int(package["hog_orientations"]),
        "lbp_radius": int(package["lbp_radius"]),
        "lbp_points": int(package["lbp_points"]),
        "lbp_method": str(package["lbp_method"]),
        "hsv_bins": tuple(int(v) for v in package["hsv_bins"]),
    }


def feature_fingerprint(package: dict) -> str:
    params = package_parameters(package)
    payload = {
        "class_names": list(package["class_names"]),
        "image_size": params["image_size"],
        "hog_orientations": params["hog_orientations"],
        "lbp_radius": params["lbp_radius"],
        "lbp_points": params["lbp_points"],
        "lbp_method": params["lbp_method"],
        "hsv_bins": params["hsv_bins"],
        "scaler_mean": list(map(float, package["scaler"].mean_)),
        "pca_shape": list(package["pca"].components_.shape),
    }
    return json.dumps(payload, sort_keys=True, default=str)


def load_source_package(checkpoint: Path, backup: Path) -> dict:
    package = joblib.load(checkpoint)
    if "calibrated_model" in package:
        log(f"{checkpoint.name} is already calibrated; reading the uncalibrated backup")
        if not backup.exists():
            raise SystemExit(
                f"{checkpoint.name} already contains a calibrated model and no backup exists at {backup.name}. "
                "Restore the original checkpoint before calibrating again."
            )
        package = joblib.load(backup)
        if "calibrated_model" in package:
            raise SystemExit("The backup checkpoint also contains a calibrated model; cannot determine the original SVM.")
    required = {"svm_model", "scaler", "pca", "class_names", "image_size"}
    missing = required.difference(package.keys())
    if missing:
        raise SystemExit(f"Checkpoint is missing required keys: {', '.join(sorted(missing))}")
    return package


def extract_features(package: dict, image: np.ndarray) -> np.ndarray:
    params = package_parameters(package)
    return extract_classical_features(
        image,
        image_size=params["image_size"],
        hog_orientations=params["hog_orientations"],
        lbp_radius=params["lbp_radius"],
        lbp_points=params["lbp_points"],
        lbp_method=params["lbp_method"],
        hsv_bins=params["hsv_bins"],
    )


def transform_features(package: dict, features: np.ndarray) -> np.ndarray:
    scaled = package["scaler"].transform(features.reshape(1, -1))
    return package["pca"].transform(scaled)[0]


def build_training_matrix(package: dict, cache_path: Path, rebuild: bool) -> tuple[np.ndarray, np.ndarray, list[str]]:
    fingerprint = feature_fingerprint(package)
    if cache_path.exists() and not rebuild:
        cached = np.load(cache_path, allow_pickle=False)
        if str(cached["fingerprint"]) == fingerprint:
            x_cached = cached["x_pca"]
            y_cached = cached["y"].astype(np.int64)
            if y_cached.min() < 0 or y_cached.max() >= len(package["class_names"]):
                raise SystemExit("Cached labels fall outside the checkpoint class mapping; rebuild the cache")
            log(f"Loaded cached PCA features {x_cached.shape} from {cache_path.name}")
            return x_cached, y_cached, list(cached["fnames"])
        log("Cached features do not match the checkpoint preprocessing; rebuilding the cache")

    annotations = sio.loadmat(TRAIN_ANNOS, squeeze_me=True, struct_as_record=False)["annotations"]
    log(f"Extracting HOG/LBP/HSV features for {len(annotations)} training images")

    features: list[np.ndarray] = []
    labels: list[int] = []
    names: list[str] = []
    skipped: list[str] = []
    started = time.perf_counter()
    for index, item in enumerate(annotations, start=1):
        filename = str(item.fname)
        image = cv2.imread(str(TRAIN_DIR / filename))
        if image is None:
            skipped.append(filename)
            continue
        features.append(extract_features(package, image))
        labels.append(int(getattr(item, "class")) - 1)
        names.append(filename)
        if index % 500 == 0 or index == len(annotations):
            elapsed = time.perf_counter() - started
            log(f"  {index}/{len(annotations)} images processed in {elapsed:.1f}s")

    if not features:
        raise SystemExit("No usable training images were found.")
    if skipped:
        log(f"Skipped {len(skipped)} unreadable training images")

    raw = np.vstack(features).astype(np.float64)
    scaled = package["scaler"].transform(raw)
    reduced = package["pca"].transform(scaled).astype(np.float64)
    y = np.asarray(labels, dtype=np.int64)
    if y.min() < 0 or y.max() >= len(package["class_names"]):
        raise SystemExit("Training labels fall outside the checkpoint class mapping")
    log(f"PCA feature matrix ready: {reduced.shape}, {len(np.unique(y))} classes")

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        cache_path,
        x_pca=reduced,
        y=y,
        fnames=np.asarray(names, dtype=str),
        fingerprint=np.asarray(fingerprint),
    )
    log(f"Saved feature cache to {cache_path.name}")
    return reduced, y, names


def fit_calibration(
    package: dict,
    x_pca: np.ndarray,
    y: np.ndarray,
    folds: int,
    n_jobs: int,
) -> tuple[CalibratedClassifierCV, float]:
    if folds < 2:
        raise SystemExit("Calibration requires at least 2 cross-validation folds")
    base = clone(package["svm_model"])
    base.set_params(probability=False)
    log(f"Fitting sigmoid (Platt) calibration with {folds}-fold cross-validation on {x_pca.shape[0]} samples")
    log(f"SVM configuration: kernel={base.kernel}, C={base.C}, gamma={base.gamma}, classes={len(package['class_names'])}")
    splitter = StratifiedKFold(n_splits=folds, shuffle=True, random_state=RANDOM_STATE)
    calibrated = CalibratedClassifierCV(
        estimator=base,
        method="sigmoid",
        cv=splitter,
        n_jobs=n_jobs,
        ensemble=True,
    )
    started = time.perf_counter()
    calibrated.fit(x_pca, y)
    elapsed = time.perf_counter() - started
    classes = np.asarray(calibrated.classes_)
    expected = np.arange(len(package["class_names"]))
    if not np.array_equal(classes, expected):
        raise SystemExit("Calibrated model class order does not match the checkpoint class mapping")
    log(f"Calibration fitted in {elapsed:.1f}s with {len(calibrated.calibrated_classifiers_)} fold models")
    return calibrated, elapsed


def save_calibrated_package(
    package: dict,
    calibrated: CalibratedClassifierCV,
    checkpoint: Path,
    backup: Path,
    folds: int,
    fit_seconds: float,
    training_samples: int,
) -> None:
    if not backup.exists():
        shutil.copy2(checkpoint, backup)
        log(f"Original checkpoint backed up to {backup.name}")
    else:
        log(f"Existing backup left untouched: {backup.name}")

    updated = dict(package)
    updated["svm_model"] = package["svm_model"]
    updated["calibrated_model"] = calibrated
    updated["package_version"] = 2
    updated["calibration"] = {
        "method": "sigmoid",
        "method_label": "Sigmoid (Platt) calibration",
        "library": "sklearn.calibration.CalibratedClassifierCV",
        "sklearn_version": sklearn.__version__,
        "cv_folds": folds,
        "cv_splitter": "StratifiedKFold(shuffle=True)",
        "random_state": RANDOM_STATE,
        "ensemble": True,
        "feature_space": "post_scaler_pca_300",
        "training_data": "backend/app/database/cars_train (Stanford Cars train split)",
        "training_samples": int(training_samples),
        "fit_seconds": round(fit_seconds, 2),
        "fitted_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "reference_checkpoint": backup.name,
        "note": "Probabilities are calibrated estimates and do not guarantee prediction correctness.",
    }
    temp_path = checkpoint.with_suffix(".pkl.tmp")
    joblib.dump(updated, temp_path, compress=3)
    os.replace(temp_path, checkpoint)
    log(f"Saved calibrated package to {checkpoint.name} ({checkpoint.stat().st_size / (1024 * 1024):.1f} MB)")


def evaluate_validation(package: dict, calibrated: CalibratedClassifierCV) -> dict:
    with VALIDATION_LABELS.open(encoding="utf-8") as handle:
        labels = json.load(handle)

    stems = sorted(labels.keys())
    class_names = list(package["class_names"])
    probabilities: list[np.ndarray] = []
    y_true: list[int] = []
    records: list[dict] = []
    started = time.perf_counter()

    for stem in stems:
        path = VALIDATION_DIR / f"{stem}.jpg"
        if not path.exists():
            candidates = sorted(VALIDATION_DIR.glob(f"{stem}.*"))
            if not candidates:
                raise SystemExit(f"Validation image not found for {stem}")
            path = candidates[0]
        image = cv2.imread(str(path))
        if image is None:
            raise SystemExit(f"Validation image could not be decoded: {path.name}")
        reduced = transform_features(package, extract_features(package, image))
        proba = np.asarray(calibrated.predict_proba(reduced.reshape(1, -1))[0], dtype=np.float64)
        probabilities.append(proba)
        y_true.append(int(labels[stem]))
        order = np.argsort(proba)[::-1][:5]
        records.append(
            {
                "file": stem,
                "truth_id": int(labels[stem]),
                "truth": class_names[int(labels[stem])],
                "predicted_id": int(order[0]),
                "predicted": class_names[int(order[0])],
                "confidence": round(float(proba[order[0]]) * 100, 2),
                "top5_ids": [int(v) for v in order],
            }
        )

    elapsed = time.perf_counter() - started
    proba_matrix = np.vstack(probabilities)
    y_true_array = np.asarray(y_true, dtype=np.int64)
    y_pred = np.argmax(proba_matrix, axis=1)
    top5 = np.argsort(-proba_matrix, axis=1)[:, :5]

    total = len(y_true_array)
    top1_correct = int(np.sum(y_pred == y_true_array))
    top5_correct = int(sum(int(y_true_array[i]) in top5[i] for i in range(total)))
    true_labels = np.unique(y_true_array)
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true_array, y_pred, labels=true_labels, average=None, zero_division=0
    )
    precision_macro, recall_macro, f1_macro, _ = precision_recall_fscore_support(
        y_true_array, y_pred, labels=true_labels, average="macro", zero_division=0
    )

    confidences = proba_matrix[np.arange(total), y_pred]
    correct = (y_pred == y_true_array).astype(np.float64)
    edges = np.linspace(0.0, 1.0, 11)
    bins: list[dict] = []
    ece = 0.0
    for index in range(10):
        lower, upper = edges[index], edges[index + 1]
        if index == 9:
            mask = (confidences >= lower) & (confidences <= upper)
        else:
            mask = (confidences >= lower) & (confidences < upper)
        count = int(mask.sum())
        if count:
            mean_confidence = float(confidences[mask].mean())
            accuracy = float(correct[mask].mean())
            ece += (count / total) * abs(accuracy - mean_confidence)
        else:
            mean_confidence = None
            accuracy = None
        bins.append(
            {
                "range": [round(float(lower), 2), round(float(upper), 2)],
                "count": count,
                "mean_confidence": None if mean_confidence is None else round(mean_confidence * 100, 2),
                "accuracy": None if accuracy is None else round(accuracy * 100, 2),
            }
        )

    one_hot = np.zeros_like(proba_matrix)
    one_hot[np.arange(total), y_true_array] = 1.0
    brier = float(np.mean(np.sum((proba_matrix - one_hot) ** 2, axis=1)))
    negative_log_likelihood = float(log_loss(y_true_array, proba_matrix, labels=np.arange(len(class_names))))

    sums = proba_matrix.sum(axis=1)
    finite = bool(np.isfinite(proba_matrix).all())
    in_range = bool((proba_matrix >= 0.0).all() and (proba_matrix <= 1.0).all())
    shape_ok = proba_matrix.shape == (total, len(class_names))
    sums_ok = bool(np.allclose(sums, 1.0, atol=1e-6))
    argmax_ok = bool(np.all(y_pred == np.argmax(proba_matrix, axis=1)))
    top5_sorted = bool(np.all(np.diff(np.take_along_axis(proba_matrix, top5, axis=1), axis=1) <= 0))

    errors = [
        record
        for record in records
        if record["predicted_id"] != record["truth_id"]
    ]

    per_class = {}
    for label, p, r, f, s in zip(true_labels.tolist(), precision, recall, f1, support):
        per_class[class_names[int(label)]] = {
            "support": int(s),
            "precision": round(float(p) * 100, 2),
            "recall": round(float(r) * 100, 2),
            "f1": round(float(f) * 100, 2),
        }

    return {
        "model": "Classical SVM (HOG + LBP + HSV)",
        "checkpoint": DEFAULT_CHECKPOINT.name,
        "calibration_data": "backend/app/database/cars_train (Stanford Cars train split, cross-validation only)",
        "calibration_used_validation_data": False,
        "validation_data": "test_images/hf (120 labelled images, 4 Stanford Cars classes)",
        "validation_classes": [class_names[int(label)] for label in true_labels.tolist()],
        "samples": total,
        "elapsed_seconds": round(elapsed, 2),
        "mean_ms_per_image": round(elapsed / total * 1000, 2),
        "classification_metrics": {
            "top1_accuracy": round(top1_correct / total * 100, 2),
            "top5_accuracy": round(top5_correct / total * 100, 2),
            "top1_correct": top1_correct,
            "top5_correct": top5_correct,
            "precision_macro": round(float(precision_macro) * 100, 2),
            "recall_macro": round(float(recall_macro) * 100, 2),
            "f1_macro": round(float(f1_macro) * 100, 2),
            "macro_average_classes": [class_names[int(label)] for label in true_labels.tolist()],
            "macro_average_note": (
                "Precision, recall and macro F1 are averaged over the four classes present in the "
                "validation labels. Predictions outside those four classes reduce recall and top-1/top-5 "
                "accuracy but are not separate precision denominators."
            ),
            "per_class": per_class,
        },
        "calibration_quality": {
            "expected_calibration_error_10bin": round(ece * 100, 2),
            "brier_score_multiclass": round(brier, 6),
            "negative_log_likelihood": round(negative_log_likelihood, 6),
            "mean_top1_confidence": round(float(confidences.mean()) * 100, 2),
            "top1_accuracy": round(top1_correct / total * 100, 2),
            "reliability_bins": bins,
            "note": (
                "Calibration quality is reported separately from classification accuracy. "
                "ECE compares bin-wise confidence with empirical accuracy; Brier and log loss "
                "score the full 196-class probability vector. The 120-image validation set covers "
                "four classes, so these calibration estimates are indicative rather than exhaustive."
            ),
        },
        "verification": {
            "predict_proba_shape": list(proba_matrix.shape),
            "classes": len(class_names),
            "shape_is_196_classes": shape_ok,
            "all_probabilities_finite": finite,
            "all_probabilities_in_0_1": in_range,
            "max_row_sum_deviation": round(float(np.max(np.abs(sums - 1.0))), 12),
            "row_sums_approximately_one": sums_ok,
            "top1_matches_highest_probability": argmax_ok,
            "top5_sorted_descending": top5_sorted,
            "predicted_class_uses_argmax": True,
        },
        "errors": errors[:20],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Calibrate the classical SVM with sigmoid (Platt) scaling")
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--backup", type=Path, default=DEFAULT_BACKUP)
    parser.add_argument("--cache", type=Path, default=CACHE_PATH)
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--n-jobs", type=int, default=-1)
    parser.add_argument("--rebuild-features", action="store_true")
    parser.add_argument("--features-only", action="store_true")
    parser.add_argument("--skip-save", action="store_true")
    args = parser.parse_args()

    started = time.perf_counter()
    package = load_source_package(args.checkpoint, args.backup)
    x_pca, y, _ = build_training_matrix(package, args.cache, args.rebuild_features)
    if args.features_only:
        log("Feature cache built; exiting because --features-only was supplied")
        return

    calibrated, fit_seconds = fit_calibration(package, x_pca, y, args.folds, args.n_jobs)
    if not args.skip_save:
        save_calibrated_package(
            package,
            calibrated,
            args.checkpoint,
            args.backup,
            args.folds,
            fit_seconds,
            int(x_pca.shape[0]),
        )

    log("Evaluating calibrated probabilities on the untouched validation set")
    report = evaluate_validation(package, calibrated)
    report["calibration"] = {
        "method": "sigmoid",
        "method_label": "Sigmoid (Platt) calibration",
        "library": "sklearn.calibration.CalibratedClassifierCV",
        "cv_folds": args.folds,
        "fit_seconds": round(fit_seconds, 2),
        "training_samples": int(x_pca.shape[0]),
        "training_classes": int(len(package["class_names"])),
        "used_validation_data_for_calibration": False,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    with args.report.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    log(f"Saved validation report to {args.report}")

    metrics = report["classification_metrics"]
    quality = report["calibration_quality"]
    log(
        "Validation: top-1 {:.2f}% | top-5 {:.2f}% | precision {:.2f}% | recall {:.2f}% | macro F1 {:.2f}%".format(
            metrics["top1_accuracy"],
            metrics["top5_accuracy"],
            metrics["precision_macro"],
            metrics["recall_macro"],
            metrics["f1_macro"],
        )
    )
    log(
        "Calibration: ECE {:.2f}% | Brier {:.6f} | NLL {:.6f} | mean top-1 confidence {:.2f}%".format(
            quality["expected_calibration_error_10bin"],
            quality["brier_score_multiclass"],
            quality["negative_log_likelihood"],
            quality["mean_top1_confidence"],
        )
    )
    log(f"Total elapsed: {time.perf_counter() - started:.1f}s")


if __name__ == "__main__":
    main()
