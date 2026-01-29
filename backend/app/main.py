from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings, init_db, close_db
from app.core.middleware import TenantMiddleware, AuthMiddleware, RateLimitMiddleware, RequestIDMiddleware
from app.core.exceptions import BaseAppException
from app.api.v1.router import api_router
# Trigger reload
from fastapi.staticfiles import StaticFiles
import os

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    # Startup
    logger.info("Starting EduERP application...")
    await init_db()
    logger.info("Database initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down EduERP application...")
    await close_db()
    logger.info("Database connections closed")


def create_application() -> FastAPI:
    """Factory function to create the FastAPI application."""
    
    app = FastAPI(
        title=settings.APP_NAME,
        description="Multi-Tenant Education ERP System",
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan
    )
    
    # Add custom middleware (order matters - last added is first executed)
    # Execution order: Request ID -> CORS -> Rate Limit -> Auth -> Tenant
    app.add_middleware(TenantMiddleware)
    app.add_middleware(AuthMiddleware)
    app.add_middleware(RateLimitMiddleware)  # Rate limit after auth (so we can rate limit by user)
    
    # Add CORS middleware
    # Note: When allow_credentials=True, allow_origins cannot be ["*"]
    # For development/demo, we allow localhost and all ngrok-free.dev subdomains
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ] if settings.DEBUG else settings.CORS_ORIGINS
    
    # Allow any ngrok-free.dev or other domains for Whitelabeling support
    # In production, this allows any domain to hit the API, which is needed because
    # we don't know the tenant domains in advance without a DB lookup.
    cors_origin_regex = r"https?://.*" if settings.DEBUG else r"https?://.*"
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*", "X-Request-ID"],  # Expose request ID header
    )
    
    # Add Request ID middleware LAST (so it runs FIRST for all requests)
    app.add_middleware(RequestIDMiddleware)
    
    # Helper function to check if origin is allowed
    import re
    def is_origin_allowed(origin: str) -> bool:
        if origin in cors_origins:
            return True
        if cors_origin_regex and re.match(cors_origin_regex, origin):
            return True
        return False
    
    # Exception handlers with CORS headers
    @app.exception_handler(BaseAppException)
    async def app_exception_handler(request: Request, exc: BaseAppException):
        response = JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error_code": exc.error_code,
                "message": exc.detail,
            }
        )
        # Add CORS headers to error responses (use request origin if allowed)
        origin = request.headers.get("origin", "")
        if is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception")
        response = JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error_code": "INTERNAL_ERROR",
                "message": str(exc) if settings.DEBUG else "An unexpected error occurred",
            }
        )
        # Add CORS headers to error responses (use request origin if allowed)
        origin = request.headers.get("origin", "")
        if is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    
    # Include API routes
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    
    # Mount static files
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    app.mount("/static", StaticFiles(directory=upload_dir), name="static")
    
    # Health check endpoint (at root level)
    @app.get("/health")
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT
        }
    
    return app


# Create the application instance
app = create_application()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.WORKERS
    )
