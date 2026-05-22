"""PromptShield — Health Router"""
import os
from fastapi import APIRouter
router = APIRouter()

@router.get("/health")
async def health():
    model_exists = os.path.exists(
        os.path.join(os.path.dirname(__file__), "..", "..", "models", "injection_detector.pkl")
    )
    return {
        "status": "healthy",
        "model_loaded": model_exists,
        "version": "1.0.0",
    }
