import os


def _read_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


class Settings:
    def __init__(self) -> None:
        self.env_name = os.getenv("ENV_NAME", "dev")
        self.project_name = os.getenv("PROJECT_NAME", "itophub")
        self.itop_url = os.getenv("ITOP_URL", "")
        self.itop_rest_user = os.getenv("ITOP_REST_USER", "")
        self.itop_rest_password = os.getenv("ITOP_REST_PASSWORD", "")
        self.itop_auth_token = os.getenv("ITOP_AUTH_TOKEN", "")
        self.itop_verify_ssl = _read_bool("ITOP_VERIFY_SSL", default=True)
        self.itop_timeout_seconds = _read_int("ITOP_TIMEOUT_SECONDS", default=30)
        self.pdq_enabled = _read_bool("PDQ_ENABLED", default=True)
        self.pdq_sqlite_dir = os.getenv("PDQ_SQLITE_DIR", "/app/data/pdq")
        self.pdq_sqlite_file_name = os.getenv("PDQ_SQLITE_FILE_NAME", "")
        self.pdq_sqlite_file_glob = os.getenv("PDQ_SQLITE_FILE_GLOB", "*.db;*.sqlite;*.sqlite3")
        self.pdq_search_min_chars = _read_int("PDQ_SEARCH_MIN_CHARS", default=2)
        self.pdf_worker_url = os.getenv("PDF_WORKER_URL", "http://pdf-worker:8000")
        self.internal_api_secret = os.getenv("INTERNAL_API_SECRET", "")


settings = Settings()
