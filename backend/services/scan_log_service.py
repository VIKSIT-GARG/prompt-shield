"""
PromptShield — Scan Log Service
Persists every scan to a JSONL file and provides query/stats methods.
"""

import os
import json
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from collections import defaultdict

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "dataset", "attack_logs", "scan_log.jsonl")


def _ensure_dir():
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)


def log_scan(text: str, result: dict, source: str = "text", provider: Optional[str] = None):
    _ensure_dir()
    entry = {
        "id": f"{int(time.time()*1000)}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": source,
        "risk_score": result.get("risk_score", 0),
        "risk_level": result.get("risk_level", "safe"),
        "is_injection": result.get("is_injection", False),
        "decision": result.get("decision", "ALLOWED"),
        "processing_time_ms": result.get("processing_time_ms", 0),
        "provider": provider,
        "text_preview": text[:120] + ("…" if len(text) > 120 else ""),
        "components": result.get("components", {}),
        "flagged_count": len(result.get("spans", [])),
    }
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    return entry


def get_logs(limit: int = 200, offset: int = 0, level_filter: Optional[str] = None) -> List[Dict]:
    _ensure_dir()
    if not os.path.exists(LOG_PATH):
        return []
    entries = []
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
                if level_filter and e.get("risk_level") != level_filter:
                    continue
                entries.append(e)
            except Exception:
                pass
    entries.reverse()  # newest first
    return entries[offset:offset + limit]


def get_stats() -> Dict:
    _ensure_dir()
    if not os.path.exists(LOG_PATH):
        return _empty_stats()

    entries = []
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                pass

    if not entries:
        return _empty_stats()

    total = len(entries)
    by_level = defaultdict(int)
    by_source = defaultdict(int)
    by_day = defaultdict(lambda: {"safe": 0, "suspicious": 0, "malicious": 0, "total": 0})
    by_hour = defaultdict(int)
    scores = []
    times_ms = []
    blocked = 0

    for e in entries:
        level = e.get("risk_level", "safe")
        by_level[level] += 1
        by_source[e.get("source", "text")] += 1
        scores.append(e.get("risk_score", 0))
        times_ms.append(e.get("processing_time_ms", 0))
        if e.get("is_injection"):
            blocked += 1

        ts = e.get("timestamp", "")
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            day_key = dt.strftime("%Y-%m-%d")
            by_day[day_key][level] += 1
            by_day[day_key]["total"] += 1
            by_hour[dt.hour] += 1
        except Exception:
            pass

    # Last 14 days
    today = datetime.utcnow()
    timeline = []
    for i in range(13, -1, -1):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        day_data = by_day.get(d, {"safe": 0, "suspicious": 0, "malicious": 0, "total": 0})
        timeline.append({"date": d, "label": (today - timedelta(days=i)).strftime("%b %d"), **day_data})

    # Hourly (last 24h)
    hourly = [{"hour": h, "count": by_hour.get(h, 0)} for h in range(24)]

    return {
        "total": total,
        "blocked": blocked,
        "allowed": total - blocked,
        "block_rate": round(blocked / total * 100, 1) if total else 0,
        "by_level": dict(by_level),
        "by_source": dict(by_source),
        "avg_score": round(sum(scores) / len(scores), 4) if scores else 0,
        "avg_time_ms": round(sum(times_ms) / len(times_ms), 1) if times_ms else 0,
        "timeline": timeline,
        "hourly": hourly,
    }


def _empty_stats():
    today = datetime.utcnow()
    return {
        "total": 0, "blocked": 0, "allowed": 0, "block_rate": 0,
        "by_level": {}, "by_source": {}, "avg_score": 0, "avg_time_ms": 0,
        "timeline": [{"date": "", "label": (today - __import__("datetime").timedelta(days=i)).strftime("%b %d"),
                       "safe": 0, "suspicious": 0, "malicious": 0, "total": 0} for i in range(13, -1, -1)],
        "hourly": [{"hour": h, "count": 0} for h in range(24)],
    }
