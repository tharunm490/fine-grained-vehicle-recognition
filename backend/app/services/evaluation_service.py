import logging
import time
from pathlib import Path

import cv2

from app.config import settings
from app.models.registry import MODEL_ORDER, ModelRegistry
from app.schemas.response import EvaluationModelResult, EvaluationResponse
from app.utils.errors import EvaluationUnavailable
from app.utils.checkpoint_utils import load_class_names

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def evaluation_available() -> bool:
    path = settings.eval_dataset_dir
    return bool(path and Path(path).is_dir())


def run_evaluation(
    registry: ModelRegistry,
    model_ids: list[str] | None = None,
    max_per_class: int = 5,
) -> EvaluationResponse:
    root = settings.eval_dataset_dir
    if not root or not Path(root).is_dir():
        raise EvaluationUnavailable(
            "No labelled evaluation dataset is configured. Set EVAL_DATASET_DIR to a directory "
            "containing one subdirectory per Stanford Cars class name."
        )

    class_names = load_class_names()
    index_by_name = {name: index for index, name in enumerate(class_names)}
    class_dirs = [
        (index_by_name[child.name], child)
        for child in sorted(Path(root).iterdir())
        if child.is_dir() and child.name in index_by_name
    ]
    if not class_dirs:
        raise EvaluationUnavailable(
            "The configured evaluation directory contains no class-name subdirectories. "
            "Expected EVAL_DATASET_DIR/<stanford_class_name>/*.jpg."
        )

    max_per_class = max(1, min(int(max_per_class), 10))
    samples: list[tuple[Path, int]] = []
    for class_id, directory in class_dirs:
        images = sorted(
            child for child in directory.iterdir() if child.is_file() and child.suffix.lower() in IMAGE_EXTENSIONS
        )[:max_per_class]
        samples.extend((image, class_id) for image in images)

    if not samples:
        raise EvaluationUnavailable("The evaluation dataset contains no readable images.")

    selected = [model_id for model_id in (model_ids or list(MODEL_ORDER)) if model_id in registry.models]
    selected = [model_id for model_id in MODEL_ORDER if model_id in selected and registry.models[model_id].available]
    if not selected:
        raise EvaluationUnavailable("None of the requested models are available for evaluation.")

    results: list[EvaluationModelResult] = []
    for model_id in selected:
        model = registry.models[model_id]
        top1 = 0
        top5 = 0
        evaluated = 0
        for image_path, class_id in samples:
            image = cv2.imread(str(image_path))
            if image is None:
                continue
            try:
                prediction = model.predict(image)
            except Exception:
                logger.exception("Evaluation inference failed for %s", model_id)
                continue
            evaluated += 1
            if int(prediction["predicted_class_id"]) == class_id:
                top1 += 1
            if any(int(item["class_id"]) == class_id for item in prediction["top_5"]):
                top5 += 1
        if evaluated:
            results.append(
                EvaluationModelResult(
                    model_id=model_id,
                    model_name=model.name,
                    samples=evaluated,
                    top1_accuracy=round(top1 / evaluated * 100, 2),
                    top5_accuracy=round(top5 / evaluated * 100, 2),
                )
            )

    if not results:
        raise EvaluationUnavailable("Evaluation produced no results. Check the dataset images and model availability.")

    return EvaluationResponse(
        success=True,
        dataset_size=len(samples),
        classes_found=len(class_dirs),
        results=results,
        measured_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        note=(
            "Metrics were computed live from the configured labelled evaluation dataset "
            "(EVAL_DATASET_DIR/<stanford_class_name>/*.jpg). No values are fabricated."
        ),
    )
