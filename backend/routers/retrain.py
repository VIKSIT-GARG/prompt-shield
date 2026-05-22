"""PromptShield — Retrain Router"""
import os
import subprocess
from fastapi import APIRouter, BackgroundTasks, HTTPException
router = APIRouter()

_retraining = False

def _run_retrain():
    global _retraining
    _retraining = True
    try:
        root = os.path.join(os.path.dirname(__file__), "..", "..")
        subprocess.run(["python", os.path.join(root, "training", "train_model.py")], check=True)
    finally:
        _retraining = False

@router.post("/retrain")
async def trigger_retrain(background_tasks: BackgroundTasks):
    if _retraining:
        raise HTTPException(status_code=409, detail="Retraining already in progress")
    background_tasks.add_task(_run_retrain)
    return {"status": "retraining started", "message": "Model retraining has been queued."}

@router.get("/retrain/status")
async def retrain_status():
    return {"retraining_in_progress": _retraining}
