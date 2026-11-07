from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"

CLASS_NAMES_PATH = Path(__file__).resolve().parent / "data" / "stanford_cars_classes.json"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BACKEND_ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Intelligent Fine-Grained Vehicle Recognition and Analysis System"
    app_version: str = "1.0.0"
    api_prefix: str = "/api"
    log_level: str = "INFO"
    device: str = "auto"

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    classical_model_path: Path = PROJECT_ROOT / "classical_vehicle_recognition.pkl"
    efficientnet_model_path: Path = PROJECT_ROOT / "efficientnet_b2_transfer.pth"
    dinov2_model_path: Path = PROJECT_ROOT / "dinov2_stanford_cars_finetuned_best.pth"
    yolo_model_path: Path = BACKEND_ROOT / "yolo11n.pt"

    max_upload_mb: int = 12
    max_image_pixels: int = 40_000_000
    min_image_side: int = 64
    max_detections: int = 8
    detection_confidence_min: float = 0.05
    detection_confidence_max: float = 0.95
    default_detection_confidence: float = 0.35

    data_dir: Path = BACKEND_ROOT / "data"
    database_path: Path = BACKEND_ROOT / "data" / "vehicles.db"
    eval_dataset_dir: Path | None = None

    history_thumbnail_size: int = 480
    history_image_max_side: int = 1600
    result_image_max_side: int = 1400
    jpeg_quality: int = 85

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def history_dir(self) -> Path:
        return self.data_dir / "history"

    def ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.history_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
