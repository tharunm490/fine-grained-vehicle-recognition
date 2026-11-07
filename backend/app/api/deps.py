from fastapi import APIRouter, Request

from app.models.registry import ModelRegistry
from app.database.repository import SqliteHistoryRepository


def get_registry(request: Request) -> ModelRegistry:
    return request.app.state.registry


def get_repository(request: Request) -> SqliteHistoryRepository:
    return request.app.state.repository
