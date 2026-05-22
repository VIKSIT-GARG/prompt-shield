"""Analytics + logs router"""
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()

@router.get("/analytics/stats")
async def get_stats():
    from services.scan_log_service import get_stats
    return get_stats()

@router.get("/analytics/logs")
async def get_logs(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
    level: Optional[str] = Query(default=None),
):
    from services.scan_log_service import get_logs
    logs = get_logs(limit=limit, offset=offset, level_filter=level)
    return {"logs": logs, "count": len(logs)}

@router.post("/analytics/highlight")
async def highlight_text(body: dict):
    text = body.get("text", "")
    if not text:
        return {"segments": [], "spans": [], "flagged_count": 0, "has_flags": False}
    from services.highlight_service import annotate_text
    return annotate_text(text)
