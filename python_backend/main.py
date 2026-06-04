import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.routers import api_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    if os.environ.get("TEST_MODE", "").lower() in ("1", "true", "yes"):
        logger.warning(
            "System env TEST_MODE is set; email uses HVTS_TEST_MODE=%s from .env instead",
            settings.hvts_test_mode,
        )
    logger.info(
        "Hospital Visitor Tracking System — Python API started on http://%s:%s (hvts_test_mode=%s)",
        settings.host if settings.host != "0.0.0.0" else "localhost",
        settings.port,
        settings.hvts_test_mode,
    )
    yield


app = FastAPI(
    title="Hospital Visitor Tracking System API",
    description="Python (FastAPI) port of the NestJS backend — 80 endpoints under /api",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=True,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "x-demo-user-id",
    ],
    expose_headers=["Content-Disposition"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": "Welcome to the Hospital Visitor Tracking System API.",
        "api": "/api/",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    message = detail if isinstance(detail, str) else str(detail)
    body = {"statusCode": exc.status_code, "message": message}
    if isinstance(detail, str) and detail.isupper() and "_" in detail:
        body["error"] = detail
        body["message"] = "Error"
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"statusCode": 422, "message": str(exc.errors()), "error": "Validation Error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
