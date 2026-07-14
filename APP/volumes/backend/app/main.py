import logging
import time
from uuid import uuid4

from fastapi import FastAPI, Request

from api.router import api_router
from api.routes.system import lifespan
from core.config import settings
from integrations.itop_cmdb_connector import get_itop_request_stats, reset_itop_request_stats


logger = logging.getLogger(__name__)


app = FastAPI(
    title=f"{settings.project_name} API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url="/v1/openapi.json" if settings.env_name != "prod" else None,
    servers=[{"url": "/api", "description": "API Gateway (nginx)"}],
    lifespan=lifespan,
)


@app.middleware("http")
async def log_request_performance(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid4().hex
    reset_itop_request_stats()
    started_at = time.perf_counter()
    status_code = 500
    response = None
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        itop_stats = get_itop_request_stats()
        log_payload = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": status_code,
            "duration_ms": round(elapsed_ms, 2),
            "itop_calls": itop_stats["count"],
            "itop_elapsed_ms": itop_stats["elapsed_ms"],
            "itop_slow_calls": itop_stats["slow"],
        }
        if response is not None:
            response.headers["X-Request-ID"] = request_id
        if elapsed_ms >= 1500 or itop_stats["slow"] > 0:
            logger.warning("Slow API request %s", log_payload)
        else:
            logger.info("API request %s", log_payload)


app.include_router(api_router)
