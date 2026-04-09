import os
from contextlib import contextmanager

import pymysql
from pymysql.cursors import DictCursor


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@contextmanager
def get_db_connection():
    connection = pymysql.connect(
        host=os.getenv("APP_DB_HOST", "mariadb"),
        port=_read_int("APP_DB_PORT", 3306),
        user=os.getenv("APP_DB_USER", ""),
        password=os.getenv("APP_DB_PASSWORD", ""),
        database=os.getenv("APP_DB_NAME", ""),
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True,
    )
    try:
        yield connection
    finally:
        connection.close()
