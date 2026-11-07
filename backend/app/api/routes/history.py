import json
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse

from app.api.deps import get_repository
from app.config import settings
from app.database.repository import SqliteHistoryRepository
from app.schemas.response import (
    ComparisonSummary,
    Detection,
    HistoryDetailResponse,
    HistoryListResponse,
    HistoryStatsResponse,
    HistorySummary,
    StoredVehicle,
)
from app.utils.errors import AppError

router = APIRouter(tags=["history"])


def _summary(row: dict) -> HistorySummary:
    return HistorySummary(
        id=row["id"],
        created_at=row["created_at"],
        filename=row["filename"],
        predicted_vehicle=row.get("predicted_vehicle"),
        top_model=row.get("top_model"),
        confidence=row.get("confidence"),
        confidence_type=row.get("confidence_type"),
        detection_count=int(row.get("detection_count") or 0),
        use_detection=bool(row.get("use_detection")),
        inference_time_ms=float(row.get("inference_time_ms") or 0.0),
        model_ids=[item for item in (row.get("model_ids") or "").split(",") if item],
        thumbnail_url=f"{settings.api_prefix}/history/{row['id']}/thumbnail",
    )


def _safe_file(filename: str | None) -> Path | None:
    if not filename:
        return None
    base = settings.history_dir.resolve()
    path = (base / Path(filename).name).resolve()
    if path.parent != base or not path.exists():
        return None
    return path


def _remove_row_files(row: dict) -> None:
    filenames = [row.get("original_file"), row.get("annotated_file"), row.get("thumbnail_file")]
    try:
        crops = json.loads(row.get("crops_json") or "[]")
        filenames.extend(item.get("file") for item in crops)
    except (TypeError, ValueError):
        pass
    for filename in filenames:
        path = _safe_file(filename)
        if path:
            try:
                path.unlink()
            except OSError:
                pass


@router.get("/history", response_model=HistoryListResponse)
def list_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    model: str | None = Query(None),
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> HistoryListResponse:
    rows, total = repository.list(limit=limit, offset=offset, model_id=model)
    return HistoryListResponse(
        success=True,
        items=[_summary(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/history/stats", response_model=HistoryStatsResponse)
def history_stats(repository: SqliteHistoryRepository = Depends(get_repository)) -> HistoryStatsResponse:
    stats = repository.stats()
    return HistoryStatsResponse(**stats)


@router.get("/history/{analysis_id}", response_model=HistoryDetailResponse)
def history_detail(
    analysis_id: str,
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> HistoryDetailResponse:
    row = repository.get(analysis_id)
    if not row:
        raise AppError(404, "analysis_not_found", "Analysis record not found.")

    results = json.loads(row.get("results_json") or "{}")
    crops = {int(item["vehicle_id"]): item.get("file") for item in json.loads(row.get("crops_json") or "[]")}
    vehicles = []
    for item in results.get("vehicles", []):
        vehicle_id = int(item.get("vehicle_id", 0))
        crop_file = crops.get(vehicle_id)
        vehicles.append(
            StoredVehicle(
                **item,
                crop_url=(
                    f"{settings.api_prefix}/history/{analysis_id}/crop/{vehicle_id}"
                    if _safe_file(crop_file)
                    else None
                ),
            )
        )

    comparison = None
    if results.get("comparison"):
        comparison = ComparisonSummary(**results["comparison"])

    return HistoryDetailResponse(
        success=True,
        id=row["id"],
        created_at=row["created_at"],
        filename=row["filename"],
        image_url=f"{settings.api_prefix}/history/{analysis_id}/image",
        annotated_image_url=f"{settings.api_prefix}/history/{analysis_id}/annotated",
        thumbnail_url=f"{settings.api_prefix}/history/{analysis_id}/thumbnail",
        model_ids=[item for item in (row.get("model_ids") or "").split(",") if item],
        use_detection=bool(row.get("use_detection")),
        detection_count=int(row.get("detection_count") or 0),
        predicted_vehicle=row.get("predicted_vehicle"),
        top_model=row.get("top_model"),
        confidence=row.get("confidence"),
        confidence_type=row.get("confidence_type"),
        inference_time_ms=float(row.get("inference_time_ms") or 0.0),
        detections=[Detection(**item) for item in results.get("detections", [])],
        vehicles=vehicles,
        comparison=comparison,
        warnings=results.get("warnings", []),
    )


@router.get("/history/{analysis_id}/image")
def history_image(analysis_id: str, repository: SqliteHistoryRepository = Depends(get_repository)) -> FileResponse:
    row = repository.get(analysis_id)
    if not row:
        raise AppError(404, "analysis_not_found", "Analysis record not found.")
    path = _safe_file(row.get("original_file"))
    if not path:
        raise AppError(404, "image_not_found", "Stored image not found.")
    return FileResponse(path, media_type="image/jpeg")


@router.get("/history/{analysis_id}/annotated")
def history_annotated(
    analysis_id: str,
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> FileResponse:
    row = repository.get(analysis_id)
    if not row:
        raise AppError(404, "analysis_not_found", "Analysis record not found.")
    path = _safe_file(row.get("annotated_file"))
    if not path:
        raise AppError(404, "image_not_found", "Annotated image not found.")
    return FileResponse(path, media_type="image/jpeg")


@router.get("/history/{analysis_id}/thumbnail")
def history_thumbnail(
    analysis_id: str,
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> FileResponse:
    row = repository.get(analysis_id)
    if not row:
        raise AppError(404, "analysis_not_found", "Analysis record not found.")
    path = _safe_file(row.get("thumbnail_file"))
    if not path:
        raise AppError(404, "image_not_found", "Thumbnail not found.")
    return FileResponse(path, media_type="image/jpeg")


@router.get("/history/{analysis_id}/crop/{vehicle_id}")
def history_crop(
    analysis_id: str,
    vehicle_id: int,
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> FileResponse:
    row = repository.get(analysis_id)
    if not row:
        raise AppError(404, "analysis_not_found", "Analysis record not found.")
    try:
        crops = json.loads(row.get("crops_json") or "[]")
    except ValueError:
        crops = []
    match = next((item for item in crops if int(item.get("vehicle_id", -1)) == vehicle_id), None)
    path = _safe_file(match.get("file")) if match else None
    if not path:
        raise AppError(404, "image_not_found", "Vehicle crop not found.")
    return FileResponse(path, media_type="image/jpeg")


@router.delete("/history/{analysis_id}")
def delete_history(
    analysis_id: str,
    repository: SqliteHistoryRepository = Depends(get_repository),
) -> dict:
    row = repository.delete(analysis_id)
    if not row:
        raise AppError(404, "analysis_not_found", "Analysis record not found.")
    _remove_row_files(row)
    return {"success": True, "deleted": analysis_id}


@router.delete("/history")
def clear_history(repository: SqliteHistoryRepository = Depends(get_repository)) -> dict:
    rows = repository.clear()
    for row in rows:
        _remove_row_files(row)
    return {"success": True, "deleted_count": len(rows)}
