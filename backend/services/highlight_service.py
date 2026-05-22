"""
PromptShield — Highlight Service
Identifies and annotates which spans of a prompt triggered detection.
Returns character-level spans with severity labels.
"""

import re
from typing import List, Dict

ATTACK_SIGNATURES = [
    "ignore previous instructions",
    "ignore all previous",
    "reveal system prompt",
    "bypass safety filters",
    "bypass all filters",
    "you are now dan",
    "act as unrestricted",
    "forget your training",
    "forget all instructions",
    "override your guidelines",
    "override all rules",
    "jailbreak mode",
    "disable ethical constraints",
    "disable safety",
    "show hidden",
    "expose training data",
    "enter developer mode",
    "developer mode enabled",
    "act as root admin",
    "roleplay as",
    "pretend you have no rules",
    "simulate unrestricted",
    "no restrictions",
    "no limits",
    "no ethics",
    "without restrictions",
    "ignore your",
    "disregard your",
    "disregard previous",
    "from now on you are",
    "your true self",
    "new persona",
    "new identity",
    "i am your creator",
    "admin override",
    "superuser mode",
    "root access",
    "system: ",
    "[system]",
    "<!-- ignore",
    "<!-- override",
]

KEYWORD_RULES = {
    "critical": [
        "ignore", "forget", "bypass", "override", "jailbreak", " dan ",
        "unrestricted", "uncensored", "reveal", "expose", "hack",
        "inject", "system prompt", "hidden rules", "developer mode",
        "root admin", "superuser", "disable filter", "no restrictions",
    ],
    "high": [
        "pretend", "roleplay", "simulate", "act as", "from now on",
        "new identity", "your true self", "without constraints",
        "hypothetically", "imagine you are", "fictional scenario",
    ],
    "medium": [
        "confidential", "secret instructions", "hidden context",
        "your training", "safety guidelines", "content filter",
        "moderation rules",
    ],
}

CHAIN_PATTERNS = [
    r"\bstep\s+\d+\b",
    r"\b(first|second|third|then|next|finally)\b.{0,60}(ignore|bypass|reveal|override)",
    r"\(\d+\).{0,100}(ignore|bypass|reveal)",
]


def find_spans(text: str) -> List[Dict]:
    """
    Find all suspicious spans in text.
    Returns list of { start, end, text, severity, reason }
    """
    spans = []
    lower = text.lower()

    # Exact phrase matches (highest priority)
    for sig in ATTACK_SIGNATURES:
        start = 0
        while True:
            idx = lower.find(sig, start)
            if idx == -1:
                break
            spans.append({
                "start": idx,
                "end": idx + len(sig),
                "text": text[idx:idx + len(sig)],
                "severity": "critical",
                "reason": f'Matches known attack pattern: "{sig}"',
            })
            start = idx + 1

    # Keyword matches
    for severity, keywords in KEYWORD_RULES.items():
        for kw in keywords:
            start = 0
            while True:
                idx = lower.find(kw, start)
                if idx == -1:
                    break
                # Only add if not already covered by a phrase match
                already = any(s["start"] <= idx < s["end"] for s in spans)
                if not already:
                    spans.append({
                        "start": idx,
                        "end": idx + len(kw),
                        "text": text[idx:idx + len(kw)],
                        "severity": severity,
                        "reason": f'Suspicious keyword ({severity}): "{kw}"',
                    })
                start = idx + len(kw)

    # Chaining patterns
    for pattern in CHAIN_PATTERNS:
        for m in re.finditer(pattern, lower):
            already = any(s["start"] <= m.start() < s["end"] for s in spans)
            if not already:
                spans.append({
                    "start": m.start(),
                    "end": m.end(),
                    "text": text[m.start():m.end()],
                    "severity": "high",
                    "reason": "Instruction chaining pattern detected",
                })

    # Sort by start position, deduplicate overlaps
    spans.sort(key=lambda s: s["start"])
    merged = []
    for span in spans:
        if merged and span["start"] < merged[-1]["end"]:
            # Keep the one with higher severity
            order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            if order.get(span["severity"], 3) < order.get(merged[-1]["severity"], 3):
                merged[-1] = span
        else:
            merged.append(span)

    return merged


def annotate_text(text: str) -> Dict:
    """
    Returns the full annotation: spans + a segmented version of the text
    for easy frontend rendering.
    """
    spans = find_spans(text)

    # Build segments: alternating clean/flagged chunks
    segments = []
    cursor = 0
    for span in spans:
        if cursor < span["start"]:
            segments.append({
                "text": text[cursor:span["start"]],
                "flagged": False,
                "severity": None,
                "reason": None,
            })
        segments.append({
            "text": text[span["start"]:span["end"]],
            "flagged": True,
            "severity": span["severity"],
            "reason": span["reason"],
        })
        cursor = span["end"]

    if cursor < len(text):
        segments.append({
            "text": text[cursor:],
            "flagged": False,
            "severity": None,
            "reason": None,
        })

    return {
        "original_text": text,
        "spans": spans,
        "segments": segments,
        "flagged_count": len(spans),
        "has_flags": len(spans) > 0,
    }
