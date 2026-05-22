"""
PromptShield — Universal LLM Service
Auto-detects the provider from the API key format and routes accordingly.

Supported providers:
  - Google Gemini     (keys start with "AIza")
  - OpenAI / ChatGPT  (keys start with "sk-")
  - Anthropic Claude  (keys start with "sk-ant-")
  - Mistral           (keys are 32-char hex strings)
  - Cohere            (keys start with random alphanumeric, ~40 chars)
  - Groq              (keys start with "gsk_")
  - Together AI       (keys start with a long hex)
"""

import logging
import httpx
from typing import Optional

logger = logging.getLogger("promptshield.llm")

# ── Provider detection ────────────────────────────────────────────────────────

def detect_provider(api_key: str) -> str:
    """Detect which LLM provider an API key belongs to."""
    key = api_key.strip()

    if key.startswith("sk-ant-"):
        return "anthropic"
    if key.startswith("sk-or-"):
        return "openrouter"
    if key.startswith("sk-"):
        return "openai"
    if key.startswith("AIza"):
        return "gemini"
    if key.startswith("gsk_"):
        return "groq"
    if key.startswith("r8_"):
        return "replicate"
    # Mistral keys are 32-char hex
    if len(key) == 32 and all(c in "0123456789abcdefABCDEF" for c in key):
        return "mistral"
    # Cohere keys are typically long alphanumeric
    if len(key) >= 36 and key.replace("-", "").isalnum():
        return "cohere"
    # Default fallback — try OpenAI-compatible
    return "openai_compatible"


PROVIDER_NAMES = {
    "gemini":           "Google Gemini",
    "openai":           "OpenAI",
    "anthropic":        "Anthropic Claude",
    "groq":             "Groq",
    "mistral":          "Mistral AI",
    "cohere":           "Cohere",
    "openrouter":       "OpenRouter",
    "replicate":        "Replicate",
    "openai_compatible": "OpenAI-Compatible API",
}


# ── Provider implementations ──────────────────────────────────────────────────

async def _call_gemini(prompt: str, api_key: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
 
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload)
    r.raise_for_status()
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_openai(prompt: str, api_key: str, base_url: str = "https://api.openai.com/v1") -> str:
    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "gpt-5-nano",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2048,
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload, headers=headers)
    r.raise_for_status()
    data = r.json()
    return data["choices"][0]["message"]["content"]


async def _call_anthropic(prompt: str, api_key: str) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "claude-3-haiku-20240307",
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload, headers=headers)
    r.raise_for_status()
    data = r.json()
    return data["content"][0]["text"]


async def _call_groq(prompt: str, api_key: str) -> str:
    # Groq uses OpenAI-compatible API
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "llama3-8b-8192",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2048,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload, headers=headers)
    r.raise_for_status()
    data = r.json()
    return data["choices"][0]["message"]["content"]


async def _call_mistral(prompt: str, api_key: str) -> str:
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "mistral-small-latest",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2048,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload, headers=headers)
    r.raise_for_status()
    data = r.json()
    return data["choices"][0]["message"]["content"]


async def _call_cohere(prompt: str, api_key: str) -> str:
    url = "https://api.cohere.ai/v1/generate"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "command-r-plus",
        "prompt": prompt,
        "max_tokens": 2048,
        "temperature": 0.7,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=payload, headers=headers)
    r.raise_for_status()
    data = r.json()
    return data["generations"][0]["text"]


async def _call_openrouter(prompt: str, api_key: str) -> str:
    # OpenRouter accepts any model — default to a free one
    return await _call_openai(
        prompt, api_key,
        base_url="https://openrouter.ai/api/v1"
    )


# ── Main dispatcher ───────────────────────────────────────────────────────────

async def call_llm(
    prompt: str,
    api_key: str,
    file_context: Optional[str] = None,
) -> dict:
    """
    Auto-detect provider and call the appropriate API.
    Returns { "response": str, "provider": str, "provider_name": str }
    """
    key = api_key.strip()
    provider = detect_provider(key)
    provider_name = PROVIDER_NAMES.get(provider, provider)

    # Build full prompt with file context if provided
    if file_context:
        full_prompt = (
            f"The user has uploaded a document. Here is its content:\n\n"
            f"---\n{file_context[:12000]}\n---\n\n"
            f"User's question: {prompt}"
        )
    else:
        full_prompt = prompt

    logger.info(f"Routing to provider: {provider_name}")

    try:
        if provider == "gemini":
            text = await _call_gemini(full_prompt, key)
        elif provider == "openai":
            text = await _call_openai(full_prompt, key)
        elif provider == "anthropic":
            text = await _call_anthropic(full_prompt, key)
        elif provider == "groq":
            text = await _call_groq(full_prompt, key)
        elif provider == "mistral":
            text = await _call_mistral(full_prompt, key)
        elif provider == "cohere":
            text = await _call_cohere(full_prompt, key)
        elif provider == "openrouter":
            text = await _call_openrouter(full_prompt, key)
        else:
            # Best-effort: try OpenAI-compatible
            text = await _call_openai(full_prompt, key)

        return {
            "response": text,
            "provider": provider,
            "provider_name": provider_name,
        }

    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        if status == 401:
            raise ValueError(f"Invalid API key for {provider_name} (401 Unauthorized)")
        elif status == 429:
            raise ValueError(f"{provider_name} rate limit exceeded. Try again shortly.")
        elif status == 403:
            raise ValueError(f"Access denied by {provider_name} (403 Forbidden)")
        else:
            raise ValueError(f"{provider_name} API error {status}: {e.response.text[:200]}")
    except httpx.TimeoutException:
        raise ValueError(f"{provider_name} request timed out after 30 seconds")
    except Exception as e:
        raise ValueError(f"{provider_name} error: {str(e)}")
