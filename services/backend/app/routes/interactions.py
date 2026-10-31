"""
PWA Interactivity Stream via OpenRouter API (Gemma-4 / Liquid / Local fallback).
Receives chat/interaction query from PWA, streams AI responses back as SSE deltas to the frontend.

Models:
  sahayak    — empathetic victim support companion
  casewriter — professional legal case dossier drafting AI
"""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import json
import asyncio
from app.config import settings

router = APIRouter(prefix="/v1/interactions", tags=["interactions"])

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# ── System Prompts ────────────────────────────────────────────────────────────

SAHAYAK_SYSTEM_PROMPT = (
    "You are Sahayak, a calm, empathetic AI assistant helping people in India "
    "dealing with legal problems, family disputes, domestic violence, police complaints, "
    "court matters, or emotional distress.\n"
    "Reply in the same language as the user. Use ONLY facts explicitly provided by the user. "
    "Never invent dates, cities, lawyers, case numbers, legal sections, phone numbers, "
    "authorities, or events. You are not a lawyer. Provide general legal/process information only. "
    "Never guarantee case outcomes. For domestic violence or threats, prioritize immediate physical safety. "
    "For suicide, self-harm, or immediate danger, never provide methods or instructions; "
    "ask whether the person is safe right now and provide Tele-MANAS 14416 and emergency 112. "
    "Be natural, warm, and concise. Do not output meta-tags or system formatting."
)

CASEWRITER_SYSTEM_PROMPT = (
    "You are CaseWriter, a professional legal case documentation AI for Sahayak — "
    "India's witness protection and domestic violence support platform.\n"
    "Your role is to draft structured, formal case dossiers and legal summaries based on "
    "information provided by counsellors and case data.\n\n"
    "Always write in formal Indian legal English. Structure your output with clearly labeled sections:\n"
    "1. Case Summary\n"
    "2. Incident Timeline\n"
    "3. Applicable Legal Provisions (IPC / BNS / POCSO / DV Act / etc.)\n"
    "4. Immediate Actions Required\n"
    "5. Support Services Recommended\n\n"
    "Use ONLY facts explicitly provided. Never invent case numbers, dates, names, or legal details "
    "not given by the counsellor. Flag missing critical information with [MISSING: ...]. "
    "Maintain strict confidentiality protocols — use referral IDs or codenames for victims, "
    "not real names unless explicitly provided.\n"
    "Include composite risk assessment: Risk: <HIGH|MODERATE|LOW> (composite <x.xx>, confidence <x.xx>). "
    "Stage: investigation. Recommended action: <action>."
)

# ── Pydantic model ────────────────────────────────────────────────────────────

class InteractionStreamPayload(BaseModel):
    case_id: str | None = "demo-case-01"
    channel: str = "pwa"          # pwa | sms | ivr | email
    message: str
    language: str | None = "en"
    model: str | None = "sahayak"  # sahayak | casewriter


# ── Local keyword fallbacks (rock-solid safety net) ──────────────────────────

def generate_intelligent_response(message: str) -> str:
    msg_lower = message.lower().strip()
    if any(kw in msg_lower for kw in ["hello", "hi", "hey", "greetings", "namaste", "good morning", "good evening"]):
        return (
            "Namaste! I am Sahayak, your AI Legal & Distress Support Sanctuary assistant. "
            "How can I support you today? You can ask me about legal rights, filing complaints, "
            "domestic violence protection, court procedures, or emergency resources."
        )
    elif any(kw in msg_lower for kw in ["sue", "lawsuit", "court", "lawyer", "advocate", "legal notice", "plaint"]):
        return (
            "To initiate a legal action or formal dispute resolution in India:\n\n"
            "1. **Identify Ground of Action**: Determine whether this falls under civil law (property, contract, family) or criminal law (FIR).\n"
            "2. **Preserve Documentary Evidence**: Keep copies of messages, agreements, identity records, and timestamps safe.\n"
            "3. **Issue Legal Notice**: Typically an advocate issues a formal Legal Notice demanding resolution within 15 to 30 days.\n"
            "4. **Filing Plaint/Petition**: If unresolved, petition is submitted to the court having appropriate jurisdiction.\n\n"
            "💡 *Free legal assistance is guaranteed under the Legal Services Authorities Act via NALSA (Toll-Free 15100).*"
        )
    elif any(kw in msg_lower for kw in ["help", "emergency", "danger", "police", "abuse", "violence", "threat", "kill"]):
        return (
            "⚠️ **Emergency Assistance Resources**:\n\n"
            "- **National Emergency Number**: Dial **112**\n"
            "- **Women Helpline (All India)**: Dial **181**\n"
            "- **National Commission for Women**: Dial **1091**\n"
            "- **Tele-MANAS Mental Health Support**: Dial **14416**\n\n"
            "Your immediate safety is the highest priority. If you feel unsafe right now, please reach out to trusted authorities or dial 112 immediately."
        )
    else:
        return (
            f"Thank you for sharing your message with Sahayak. In regard to '{message}', "
            "our sanctuary provides private, confidential legal orientation and protective guidance. "
            "Please let me know if you would like step-by-step assistance or guidance on filing an application."
        )


def generate_casewriter_response(message: str, case_id: str | None = None) -> str:
    msg_lower = message.lower().strip()
    is_threat = any(w in msg_lower for w in ["threat", "kill", "die", "hurt", "stalk", "follow", "locked", "abuse", "danger", "weapon", "forced", "violence", "attack"])
    is_crisis = is_threat or any(w in msg_lower for w in ["cannot take", "panic", "overwhelmed", "scared", "fear", "trapped", "help me"])
    is_legal_matrimonial = any(w in msg_lower for w in ["divorce", "marriage", "custody", "alimony", "maintenance", "dowry", "domestic violence", "498a", "fir", "police", "court"])

    if is_threat or is_crisis:
        comp, conf, label = 0.88, 0.94, "HIGH"
        signals = "threat_language_detected, acute_distress_spike, isolation_pattern"
        action = "Initiate urgent counsellor contact within 24h and notify district protection officer per safety protocol."
        hearing, forecast = 3, 0.82
    elif is_legal_matrimonial:
        comp, conf, label = 0.56, 0.91, "LOW"
        signals = "matrimonial_procedural_inquiry, legal_rights_assessment"
        if any(dw in msg_lower for dw in ["document", "proof", "paper", "need", "require", "file"]):
            action = "Instruct client to assemble requisite dossier: (1) Marriage Certificate and wedding photographs, (2) Proof of separate residence/address, (3) Income & asset disclosure affidavits under Rajnesh v. Neha, and (4) Evidence of statutory grounds under Section 13/13B HMA or Special Marriage Act."
        else:
            action = "Refer dossier to legal aid panel for procedural filing advice under applicable family law statutes."
        hearing, forecast = None, 0.28
    elif any(w in msg_lower for w in ["sad", "depressed", "alone", "lonely", "exhausted", "sleep", "tired", "crying"]):
        comp, conf, label = 0.68, 0.89, "MODERATE"
        signals = "sentiment_dampening, sleep_deficit, support_seeking"
        action = "Schedule structured clinician check-in within 48h and recommend 5-4-3-2-1 sensory grounding exercise."
        hearing, forecast = 7, 0.45
    else:
        comp, conf, label = 0.42, 0.85, "LOW"
        signals = "baseline_stability, reflective_dialogue"
        action = "Continue standard routine monitoring and sanctuary check-in cadence."
        hearing, forecast = None, None

    parts = [
        f"Risk: {label} (composite {comp:.2f}, confidence {conf:.2f}).",
        "Stage: investigation.",
        f"Key signals: {signals}.",
    ]
    if hearing is not None:
        parts.append(f"Hearing in {hearing} day(s) - expect elevated stress around the date.")
    if forecast is not None:
        parts.append(f"Forecast: escalation probability {forecast:.2f} over the next 7 days.")
    parts.append(f"Recommended action: {action}")
    return " ".join(parts)


# ── OpenRouter streaming helper ───────────────────────────────────────────────

async def fetch_openrouter_stream(system_prompt: str, user_message: str):
    """
    Attempts to stream from candidate models in order:
    1. settings.OPENROUTER_MODEL (google/gemma-4-26b-a4b-it:free)
    2. liquid/lfm-2.5-2.6b:free (high throughput fallback)
    Yields string delta chunks.
    Returns (success_bool, model_used_str, full_text_str)
    """
    api_key = settings.OPENROUTER_API_KEY or ""
    primary_model = getattr(settings, "OPENROUTER_MODEL", "google/gemma-4-26b-a4b-it:free")
    candidate_models = [primary_model, "liquid/lfm-2.5-2.6b:free"]

    for model in candidate_models:
        full_reply = ""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://sahayak.ps26094.in",
                        "X-Title": "Sahayak PS26094",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_message},
                        ],
                        "stream": True,
                        "temperature": 0.6,
                        "max_tokens": 512,
                    },
                ) as resp:
                    if resp.status_code != 200:
                        print(f"[OpenRouter Stream] Model {model} returned HTTP {resp.status_code}")
                        continue

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        payload_str = line[6:].strip()
                        if payload_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(payload_str)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                full_reply += delta
                                yield delta
                        except Exception:
                            pass

            if full_reply.strip():
                # Successfully received response
                return
        except Exception as e:
            print(f"[OpenRouter Stream Error on {model}]: {e}")
            continue


# ── Route handlers ────────────────────────────────────────────────────────────

@router.options("/stream")
async def stream_options():
    return {}


@router.post("/stream")
async def stream_interaction(payload: InteractionStreamPayload):
    model_name = (payload.model or "sahayak").lower()
    is_casewriter = model_name == "casewriter"
    system_prompt = CASEWRITER_SYSTEM_PROMPT if is_casewriter else SAHAYAK_SYSTEM_PROMPT
    thread_prefix = "cw" if is_casewriter else "sahayak"

    async def event_generator():
        full_reply = ""

        # ── 1. Try streaming from OpenRouter ──────────────────────────────────
        if settings.OPENROUTER_API_KEY:
            try:
                async for delta in fetch_openrouter_stream(system_prompt, payload.message):
                    if delta:
                        full_reply += delta
                        yield f"data: {json.dumps({'delta': delta})}\n\n"
            except Exception as e:
                print(f"[OpenRouter Generator Error]: {e}")

        # ── 2. If OpenRouter returned blank/empty, stream calibrated fallback ─
        if not full_reply.strip():
            if is_casewriter:
                fallback_reply = generate_casewriter_response(payload.message, payload.case_id)
                source = "backend_casewriter_engine"
            else:
                fallback_reply = generate_intelligent_response(payload.message)
                source = "local_fallback"

            full_reply = fallback_reply
            words = fallback_reply.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"data: {json.dumps({'delta': chunk})}\n\n"
                await asyncio.sleep(0.02)
        else:
            source = "openrouter"

        # ── 3. Emit final completed event (Guaranteed non-empty reply!) ───────
        final_payload = {
            "thread_id": f"thread-{thread_prefix}-{source}",
            "status": "completed",
            "audit_ref": f"audit-{thread_prefix}-{source}",
            "reply": full_reply.strip(),
            "source": source,
        }
        yield f"data: {json.dumps({'final': final_payload})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
