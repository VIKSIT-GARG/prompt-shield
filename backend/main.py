"""PromptShield Backend — FastAPI Application"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn, logging

from routers import scan, health, retrain, analytics

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("promptshield")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="PromptShield API", version="1.0.0", docs_url="/docs")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(scan.router,      prefix="/api/v1", tags=["scan"])
app.include_router(health.router,    prefix="/api/v1", tags=["health"])
app.include_router(retrain.router,   prefix="/api/v1", tags=["retrain"])
app.include_router(analytics.router, prefix="/api/v1", tags=["analytics"])

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled: {exc}")
    return JSONResponse(status_code=500, content={"detail": str(exc)})

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
