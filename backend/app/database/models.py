SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    filename TEXT NOT NULL,
    model_ids TEXT NOT NULL,
    use_detection INTEGER NOT NULL DEFAULT 0,
    detection_count INTEGER NOT NULL DEFAULT 0,
    predicted_vehicle TEXT,
    top_model TEXT,
    confidence REAL,
    confidence_type TEXT,
    inference_time_ms REAL NOT NULL DEFAULT 0,
    original_file TEXT,
    annotated_file TEXT,
    thumbnail_file TEXT,
    crops_json TEXT NOT NULL DEFAULT '[]',
    results_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses (created_at DESC);
"""
