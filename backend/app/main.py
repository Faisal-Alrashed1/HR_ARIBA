"""App setup: middleware, CORS, security headers, error handlers, routers, startup."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.errors import install_error_handlers
from app.core.security import SecurityHeadersMiddleware
from app.migrations import run_migrations
from app.services.seeds import bootstrap_admin
from app.routers import auth, dashboard, dependents, documents, employees, health, me, salary, settings

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    s = get_settings()
    if s.run_migrations_on_startup:
        run_migrations()
    bootstrap_admin()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    logging.basicConfig(level=logging.INFO)
    app = FastAPI(
        title="Ariba HR API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if s.is_dev else None,
        redoc_url=None,
        openapi_url="/openapi.json" if s.is_dev else None,
    )
    # Order matters: the last middleware added runs first. CORS must wrap everything so error
    # responses carry CORS headers too.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Accept-Language", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )
    install_error_handlers(app)

    app.include_router(health.router)
    for module in (auth, me, dashboard, employees, dependents, documents, salary, settings):
        app.include_router(module.router, prefix=API_PREFIX)
    return app


app = create_app()
