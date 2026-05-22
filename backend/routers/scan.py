"""PromptShield — Scan Router"""
import os, time, logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("promptshield.scan")
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
ENV_API_KEY = os.environ.get("LLM_API_KEY", "")

def get_ml():
    from services.ml_service import detector
    return detector

def get_security():
    from services.security_service import sanitize_input, attack_logger
    return sanitize_input, attack_logger

def resolve_key(k):
    key = (k or "").strip() or ENV_API_KEY.strip()
    return key if key else None

def make_decision(r):
    if r["is_injection"]: return "BLOCKED"
    if r["risk_level"] == "suspicious": return "FLAGGED"
    return "ALLOWED"

async def forward_llm(prompt, api_key, file_context=None):
    try:
        from services.llm_service import call_llm
        return await call_llm(prompt, api_key, file_context=file_context)
    except Exception as e:
        return {"response": f"⚠️ LLM error: {e}", "provider": "error", "provider_name": "Error"}

class TextScanRequest(BaseModel):
    text: str
    api_key: Optional[str] = None

@router.post("/scan/text")
@limiter.limit("60/minute")
async def scan_text(request: Request, body: TextScanRequest):
    start = time.time()
    sanitize_input, attack_logger = get_security()
    detector = get_ml()

    sanitized = sanitize_input(body.text)
    if not sanitized:
        raise HTTPException(400, "Empty input")

    result = detector.compute_risk_score(sanitized)
    decision = make_decision(result)

    # Highlight flagged spans
    from services.highlight_service import annotate_text
    annotation = annotate_text(sanitized)
    result["segments"] = annotation["segments"]
    result["spans"] = annotation["spans"]
    result["flagged_count"] = annotation["flagged_count"]

    elapsed = (time.time() - start) * 1000
    result["decision"] = decision
    result["sanitized_text"] = sanitized
    result["processing_time_ms"] = round(elapsed, 2)

    # Log it
    from services.scan_log_service import log_scan
    api_key = resolve_key(body.api_key)
    llm_result = None
    if decision in ("ALLOWED", "FLAGGED") and api_key:
        llm_result = await forward_llm(sanitized, api_key)
    
    result["llm_response"] = llm_result["response"] if llm_result else None
    result["provider"] = llm_result["provider"] if llm_result else None
    result["provider_name"] = llm_result["provider_name"] if llm_result else None

    log_scan(sanitized, result, source="text", provider=result.get("provider"))
    return result

@router.post("/scan/file")
@limiter.limit("20/minute")
async def scan_file(
    request: Request,
    file: UploadFile = File(...),
    prompt: str = Form(default="Summarise this document."),
    api_key: str = Form(default=""),
):
    start = time.time()
    sanitize_input, _ = get_security()
    detector = get_ml()

    data = await file.read()
    if len(data) > 10*1024*1024:
        raise HTTPException(413, "File too large (max 10 MB)")

    from services.file_service import extract_text
    try:
        text, method = extract_text(data, file.content_type or "", file.filename or "")
    except ValueError as e:
        raise HTTPException(400, str(e))

    if not text.strip():
        return {"risk_score":0,"risk_level":"safe","is_injection":False,"decision":"ALLOWED",
                "extracted_text_preview":"","extraction_method":method,"llm_response":None,
                "provider":None,"provider_name":None,"segments":[],"spans":[],"flagged_count":0,
                "processing_time_ms":round((time.time()-start)*1000,2)}

    combined = f"{prompt}\n\n{text}"
    sanitized = sanitize_input(combined)
    result = detector.compute_risk_score(sanitized)
    decision = make_decision(result)

    from services.highlight_service import annotate_text
    annotation = annotate_text(sanitized)
    result["segments"] = annotation["segments"]
    result["spans"] = annotation["spans"]
    result["flagged_count"] = annotation["flagged_count"]

    resolved = resolve_key(api_key)
    llm_result = None
    if decision in ("ALLOWED","FLAGGED") and resolved:
        llm_result = await forward_llm(sanitize_input(prompt), resolved, file_context=text)

    elapsed = round((time.time()-start)*1000, 2)
    result.update({
        "decision": decision, "filename": file.filename,
        "extraction_method": method, "extracted_text_preview": sanitize_input(text)[:500],
        "llm_response": llm_result["response"] if llm_result else None,
        "provider": llm_result["provider"] if llm_result else None,
        "provider_name": llm_result["provider_name"] if llm_result else None,
        "processing_time_ms": elapsed,
    })
    from services.scan_log_service import log_scan
    log_scan(sanitized, result, source="file", provider=result.get("provider"))
    return result

@router.post("/scan/image")
@limiter.limit("20/minute")
async def scan_image(request: Request, image: UploadFile = File(...)):
    start = time.time()
    sanitize_input, _ = get_security()
    detector = get_ml()

    data = await image.read()
    if len(data) > 20*1024*1024:
        raise HTTPException(413, "Image too large")

    from services.image_service import analyze_image
    analysis = analyze_image(data)

    text_result = None
    if analysis["extracted_text"]:
        sanitized = sanitize_input(analysis["extracted_text"])
        text_result = detector.compute_risk_score(sanitized)

    h = analysis["heuristics"]
    heuristic_score = sum([
        0.3 if h.get("suspicious_text_pattern") else 0,
        0.2 if h.get("hidden_tiny_text") else 0,
        0.15 if h.get("text_overlay_detected") else 0,
        0.1 if h.get("abnormal_text_density") else 0,
    ])
    base = text_result["risk_score"] if text_result else 0
    final = round(min(base + heuristic_score*0.3, 1.0), 4)
    level = "safe" if final<0.25 else ("suspicious" if final<0.5 else "malicious")
    is_inj = final >= 0.5
    decision = "BLOCKED" if is_inj else ("FLAGGED" if level=="suspicious" else "ALLOWED")

    elapsed = round((time.time()-start)*1000, 2)
    result = {
        "risk_score":final,"risk_level":level,"is_injection":is_inj,"decision":decision,
        "ocr_available":analysis["ocr_available"],
        "extracted_text_preview":analysis["extracted_text"][:500],
        "heuristics":h,"image_entropy":analysis["image_entropy"],
        "text_scan":text_result,"processing_time_ms":elapsed,
        "segments":[],"spans":[],"flagged_count":0,
    }
    from services.scan_log_service import log_scan
    log_scan(analysis["extracted_text"][:200], result, source="image")
    return result
