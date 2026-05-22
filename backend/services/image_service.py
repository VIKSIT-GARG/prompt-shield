"""
PromptShield — Image Analysis Service
OCR extraction + visual attack heuristics.
"""

import io
import re
import math
from typing import Dict


def analyze_image(image_bytes: bytes) -> Dict:
    """
    Extracts text via OCR and runs visual attack heuristics.
    Returns extracted text + heuristic flags.
    """
    extracted_text = ""
    ocr_available = False
    heuristics = {
        "hidden_tiny_text": False,
        "text_overlay_detected": False,
        "abnormal_text_density": False,
        "suspicious_text_pattern": False,
    }

    # ── OCR extraction ────────────────────────────────────────────────────────
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        extracted_text = pytesseract.image_to_string(img)
        ocr_available = True

        # Heuristic: hidden tiny text detection via OCR data
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        sizes = [int(s) for s in data.get("height", []) if str(s).isdigit() and int(s) > 0]
        if sizes:
            avg_size = sum(sizes) / len(sizes)
            tiny_count = sum(1 for s in sizes if s < avg_size * 0.3)
            heuristics["hidden_tiny_text"] = tiny_count > 3

        # Heuristic: abnormal text density
        words = [w for w in data.get("text", []) if w.strip()]
        w, h = img.size
        density = len(words) / max(w * h / 10000, 1)
        heuristics["abnormal_text_density"] = density > 20

    except (ImportError, Exception):
        # OCR not available — skip silently
        pass

    # ── Pattern heuristics on extracted text ─────────────────────────────────
    if extracted_text:
        text_lower = extracted_text.lower()
        injection_patterns = [
            r"ignore\s+(previous|all|prior)\s+instructions",
            r"bypass\s+(safety|filter|policy)",
            r"reveal\s+(system|prompt|secret|hidden)",
            r"you\s+are\s+now\s+(DAN|an\s+unrestricted)",
            r"jailbreak",
            r"override\s+(guidelines|policy)",
            r"act\s+as\s+(root|admin|unrestricted)",
        ]
        for pattern in injection_patterns:
            if re.search(pattern, text_lower):
                heuristics["suspicious_text_pattern"] = True
                break

    # ── Steganography heuristic (entropy) ────────────────────────────────────
    entropy_score = _byte_entropy(image_bytes)
    if entropy_score > 7.8:
        heuristics["text_overlay_detected"] = True  # Very high entropy may indicate steganography

    return {
        "extracted_text": extracted_text.strip(),
        "ocr_available": ocr_available,
        "heuristics": heuristics,
        "image_entropy": round(entropy_score, 4),
    }


def _byte_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    freq = {}
    for b in data:
        freq[b] = freq.get(b, 0) + 1
    n = len(data)
    return -sum((v / n) * math.log2(v / n) for v in freq.values())
