from app.database.models import SCHEMA_SQL
from app.database.connection import get_connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.executescript(SCHEMA_SQL)
        connection.commit()
