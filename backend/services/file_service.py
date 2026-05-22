"""
PromptShield — File Parser Service
Extracts text from PDF, DOCX, and TXT files.
"""

import io
import os
from typing import Tuple

SUPPORTED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}


def extract_text(file_bytes: bytes, content_type: str, filename: str = "") -> Tuple[str, str]:
    """
    Returns (extracted_text, method_used).
    Raises ValueError for unsupported types.
    """
    ext = os.path.splitext(filename)[1].lower() if filename else ""

    # Detect by extension if content_type is generic
    if content_type == "application/octet-stream":
        if ext == ".pdf":
            content_type = "application/pdf"
        elif ext in (".docx",):
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif ext == ".txt":
            content_type = "text/plain"

    file_format = SUPPORTED_TYPES.get(content_type)
    if not file_format and ext in (".pdf", ".docx", ".txt"):
        file_format = ext.lstrip(".")
    if not file_format:
        raise ValueError(f"Unsupported file type: {content_type}")

    if file_format == "pdf":
        return _extract_pdf(file_bytes), "pdfplumber"
    elif file_format == "docx":
        return _extract_docx(file_bytes), "python-docx"
    elif file_format == "txt":
        return _extract_txt(file_bytes), "plain-text"

    raise ValueError(f"Unhandled format: {file_format}")


def _extract_pdf(data: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text() or ""
                pages.append(text)
            return "\n".join(pages)
    except ImportError:
        # Fallback: raw text extraction
        text = data.decode("utf-8", errors="ignore")
        return text
    except Exception as e:
        raise ValueError(f"PDF extraction failed: {e}")


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        paragraphs = [p.text for p in doc.paragraphs]
        return "\n".join(paragraphs)
    except ImportError:
        raise ValueError("python-docx not installed. Run: pip install python-docx")
    except Exception as e:
        raise ValueError(f"DOCX extraction failed: {e}")


def _extract_txt(data: bytes) -> str:
    for encoding in ("utf-8", "latin-1", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")
