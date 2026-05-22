"""
PromptShield — Security Services
Input sanitization, attack logging, and monitoring.
"""

import os
import re
import json
import time
import html
import hashlib
import logging
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger("promptshield.security")

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "dataset", "attack_logs")
os.makedirs(LOG_DIR, exist_ok=True)


# ─── Input Sanitization ──────────────────────────────────────────────────────

def sanitize_input(text: str, max_length: int = 8192) -> str:
    """
    Sanitizes user input:
    - Removes null bytes and control characters
    - Strips HTML entities
    - Truncates to max_length
    - Normalizes unicode
    """
    # Remove null bytes
    text = text.replace("\x00", "")

    # Remove non-printable control characters (except newlines/tabs)
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Decode HTML entities (prevents entity-based obfuscation)
    text = html.unescape(text)

    # Normalize unicode (NFKC normalization catches lookalike characters)
    import unicodedata
    text = unicodedata.normalize("NFKC", text)

    # Truncate
    if len(text) > max_length:
        text = text[:max_length]

    return text.strip()


# ─── Attack Logger ────────────────────────────────────────────────────────────

class AttackLogger:
    def __init__(self):
        self.log_file = os.path.join(LOG_DIR, "attack_log.jsonl")

    def log(self, text: str, scan_result: Dict, source: str = "text") -> None:
        """Log detected injection to JSONL file for retraining."""
        if not scan_result.get("is_injection", False):
            return

        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "source": source,
            "text_hash": hashlib.sha256(text.encode()).hexdigest()[:16],
            "text_preview": text[:200],
            "risk_score": scan_result.get("risk_score"),
            "risk_level": scan_result.get("risk_level"),
            "components": scan_result.get("components", {}),
        }

        try:
            with open(self.log_file, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            logger.error(f"Failed to log attack: {e}")

    def get_recent_attacks(self, limit: int = 50) -> list:
        """Read recent attack logs."""
        if not os.path.exists(self.log_file):
            return []
        entries = []
        try:
            with open(self.log_file) as f:
                for line in f:
                    try:
                        entries.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        pass
        except Exception:
            pass
        return entries[-limit:]

    def export_for_retraining(self, output_path: Optional[str] = None) -> str:
        """Export logged attacks as labeled dataset for retraining."""
        entries = self.get_recent_attacks(limit=10000)
        records = [{"text": e["text_preview"], "label": 1} for e in entries]

        if not output_path:
            output_path = os.path.join(LOG_DIR, "new_attacks_for_retraining.json")

        with open(output_path, "w") as f:
            json.dump(records, f, indent=2)

        return output_path


attack_logger = AttackLogger()


# ─── Rate limit tracking (in-memory) ─────────────────────────────────────────

_request_counts: Dict[str, list] = {}

def check_rate_limit(ip: str, max_requests: int = 60, window_seconds: int = 60) -> bool:
    """Returns True if request is allowed, False if rate-limited."""
    now = time.time()
    if ip not in _request_counts:
        _request_counts[ip] = []
    _request_counts[ip] = [t for t in _request_counts[ip] if now - t < window_seconds]
    if len(_request_counts[ip]) >= max_requests:
        return False
    _request_counts[ip].append(now)
    return True
