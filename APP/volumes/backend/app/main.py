from fastapi import FastAPI

from api.router import api_router
from api.routes.system import lifespan
from core.config import settings


app = FastAPI(
    title=f"{settings.project_name} API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url="/v1/openapi.json" if settings.env_name != "prod" else None,
    servers=[{"url": "/api", "description": "API Gateway (nginx)"}],
    lifespan=lifespan,
)

app.include_router(api_router)
