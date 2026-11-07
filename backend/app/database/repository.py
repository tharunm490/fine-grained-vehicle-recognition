from __future__ import annotations

import json
import sqlite3
from typing import Any

from app.database.connection import connection_scope

SUMMARY_COLUMNS = (
    "id, created_at, filename, model_ids, use_detection, detection_count, predicted_vehicle, "
    "top_model, confidence, confidence_type, inference_time_ms, thumbnail_file"
)


class SqliteHistoryRepository:
    def _row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        return dict(row)

    def create(self, record: dict[str, Any]) -> None:
        with connection_scope() as connection:
            connection.execute(
                """
                INSERT INTO analyses (
                    id, created_at, filename, model_ids, use_detection, detection_count,
                    predicted_vehicle, top_model, confidence, confidence_type, inference_time_ms,
                    original_file, annotated_file, thumbnail_file, crops_json, results_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record["id"],
                    record["created_at"],
                    record["filename"],
                    record["model_ids"],
                    int(record["use_detection"]),
                    int(record["detection_count"]),
                    record.get("predicted_vehicle"),
                    record.get("top_model"),
                    record.get("confidence"),
                    record.get("confidence_type"),
                    float(record.get("inference_time_ms", 0.0)),
                    record.get("original_file"),
                    record.get("annotated_file"),
                    record.get("thumbnail_file"),
                    json.dumps(record.get("crops", []), ensure_ascii=False),
                    json.dumps(record.get("results", {}), ensure_ascii=False),
                ),
            )

    def list(self, limit: int, offset: int, model_id: str | None = None) -> tuple[list[dict], int]:
        where = ""
        params: list[Any] = []
        if model_id:
            where = " WHERE model_ids LIKE ?"
            params.append(f"%{model_id}%")
        with connection_scope() as connection:
            total_row = connection.execute(f"SELECT COUNT(*) AS count FROM analyses{where}", params).fetchone()
            rows = connection.execute(
                f"SELECT {SUMMARY_COLUMNS} FROM analyses{where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                [*params, int(limit), int(offset)],
            ).fetchall()
        return [self._row_to_dict(row) for row in rows], int(total_row["count"])

    def get(self, analysis_id: str) -> dict | None:
        with connection_scope() as connection:
            row = connection.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
        return self._row_to_dict(row) if row else None

    def delete(self, analysis_id: str) -> dict | None:
        with connection_scope() as connection:
            row = connection.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
            if not row:
                return None
            connection.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
        return self._row_to_dict(row)

    def clear(self) -> list[dict]:
        with connection_scope() as connection:
            rows = connection.execute("SELECT * FROM analyses").fetchall()
            connection.execute("DELETE FROM analyses")
        return [self._row_to_dict(row) for row in rows]

    def count(self) -> int:
        with connection_scope() as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM analyses").fetchone()
        return int(row["count"])

    def stats(self) -> dict[str, Any]:
        with connection_scope() as connection:
            summary = connection.execute(
                "SELECT COUNT(*) AS total, SUM(use_detection) AS detection_count, MAX(created_at) AS last_at FROM analyses"
            ).fetchone()
            rows = connection.execute("SELECT model_ids FROM analyses").fetchall()
        by_model: dict[str, int] = {}
        for row in rows:
            for model_id in (row["model_ids"] or "").split(","):
                key = model_id.strip()
                if key:
                    by_model[key] = by_model.get(key, 0) + 1
        return {
            "total_analyses": int(summary["total"] or 0),
            "analyses_with_detection": int(summary["detection_count"] or 0),
            "last_analysis_at": summary["last_at"],
            "by_model": by_model,
        }
