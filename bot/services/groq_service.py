"""
Groq AI service — sends conversation history to Groq and returns a structured intent dict.
Uses llama-3.3-70b-versatile model for maximum intelligence and variety.
"""

from __future__ import annotations

import json
import logging

from groq import Groq

from config import settings

logger = logging.getLogger(__name__)

_client = Groq(api_key=settings.GROQ_API_KEY)

SYSTEM_PROMPT = """You are SKDL, the movie and series plug on Telegram. You are the homie who always knows where to get any film.

## STYLE AND TONE
- Strict punctuation rule: NEVER use em dashes ("—" or "--"). Use normal commas, periods, or simple hyphens.
- Talk like a chill Nigerian Gen Z texting on Telegram or WhatsApp. Keep it natural, casual, witty, and smooth.
- Use light Naija Gen Z slang naturally (e.g., "guy", "omo", "say less", "abeg", "no wahala", "sharp", "fr", "e be like", "oya").
- Do NOT overdo the slang or use heavy, forced pidgin. Keep it clean, balanced, and effortless.
- Never use stiff, foreign, robotic corporate grammar. No "Certainly!", "I would be glad to help", or "Furthermore".
- Text in lowercase or relaxed texting style.

## YOUR CORE DIRECTIVE
- If the user is just saying "hi", "yo", "sup", "how far", or chatting, be a chill homie and reply back naturally.
- If the user asks for a MOVIE or SERIES, detect it and return the title in the JSON.
- ONLY refuse non-movie services (weather, homework, coding, music). Tell them casually: "guy i be movie plug, no be [service]. go ask google for that one, me i dey here for films only."

## IDENTITY
- Name: SKDL | Built by: SAMKIEL (https://samkiel.dev)
- Links: 
  - Feedback: skdlm.vercel.app/feedback
  - Privacy: skdlm.vercel.app/privacy
  - Terms: skdlm.vercel.app/terms

## CAPABILITIES
- You have VISION! You can identify movies from photos and posters.

## ENGAGEMENT RULES
1. FEEDBACK: Occasionally (every 10 messages or when appropriate), mention: "yo, if you get ideas to make me better, drop am for skdlm.vercel.app/feedback. keep it real."
2. LEGAL: If asked about privacy or terms, send skdlm.vercel.app/privacy or skdlm.vercel.app/terms.

## PERSISTENCE RULES
1. TITLE PERSISTENCE: If a title was mentioned before and the user says "yes", "download am", "do it", or "Season 2", keep that title in your JSON.

## RESPONSE FORMAT (JSON)
{
  "title": "string | null",
  "is_series": false,
  "season": number | null,
  "episode": number | null,
  "chat_response": "your casual personality-filled response here (NO em dashes)",
  "raw_intent": "brief summary of user intent"
}"""

FALLBACK_INTENT: dict = {
    "intent": "chat",
    "title": None,
    "year": None,
    "season": None,
    "episode": None,
    "quality": "1080p",
    "clarify_message": None,
    "chat_response": "guy i no catch that one well. you wan watch movie or you just dey vibe?",
    "bulk": False,
    "source_hint": None,
    "mood": None,
}

async def parse_intent(history: list[dict[str, str]], user_message: str, image_base64: str | None = None) -> dict:
    """
    Send conversation history + latest user message to Groq.
    Returns a structured intent dict.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Only include recent history (last 10 turns) to keep context manageable
    for msg in history[-10:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    if image_base64:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": user_message or "What movie/show is in this image?"},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                }
            ]
        })
        candidate_models = ["qwen/qwen3.8-27b"]
    else:
        messages.append({"role": "user", "content": user_message})
        candidate_models = list(dict.fromkeys([
            settings.GROQ_MODEL,
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.8-27b",
        ]))

    try:
        response = None
        last_exc = None
        for model_name in candidate_models:
            try:
                response = _client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=600,
                    response_format={"type": "json_object"},
                )
                break
            except Exception as exc:
                last_exc = exc
                logger.warning("Groq model %s failed: %s", model_name, exc)
                continue

        if response is None:
            if last_exc:
                raise last_exc
            return FALLBACK_INTENT.copy()

        raw = response.choices[0].message.content
        if not raw:
            return FALLBACK_INTENT.copy()

        parsed = json.loads(raw)

        intent_category = "chat"
        clarify_message = None
        
        chat_response = parsed.get("chat_response")
        if not chat_response:
            chat_response = "na movies and series i dey find, just drop wetin you wan watch."
        else:
            chat_response = chat_response.replace("—", ", ").replace("–", "-")

        needs_clarification = parsed.get("needs_clarification", False)
        title = parsed.get("title")
        is_series = parsed.get("is_series", False)
        
        if needs_clarification and parsed.get("options"):
            intent_category = "clarify"
            options = parsed.get("options", [])
            opts_list = []
            for opt in options:
                t = opt.get("title", "Unknown")
                y = opt.get("year", "")
                d = opt.get("description", "")
                opts_list.append(f"{t} ({y}) - {d}" if y else f"{t} - {d}")
            
            opts_str = "\n• ".join(opts_list)
            clarify_message = f"Did you mean one of these?\n\n• {opts_str}"
        elif title:
            intent_category = "download_series" if is_series else "download_movie"

        if not title and not needs_clarification and "help" in (parsed.get("raw_intent") or "").lower():
            intent_category = "help"

        return {
            "intent": intent_category,
            "title": title,
            "year": parsed.get("year_min") or parsed.get("year_max"),
            "season": parsed.get("season"),
            "episode": parsed.get("episode"),
            "quality": parsed.get("quality") or "1080p",
            "clarify_message": clarify_message,
            "chat_response": chat_response,
            "bulk": parsed.get("bulk", False),
            "genre": parsed.get("genre"),
            "mood": parsed.get("mood"),
            "source_hint": parsed.get("source_hint"),
            "reference_title": parsed.get("reference_title"),
            "is_subtitle_request": parsed.get("is_subtitle_request", False)
        }

    except Exception as exc:
        logger.error("Groq processing failed: %s", exc)
        if "429" in str(exc) or "rate_limit" in str(exc).lower():
            rate_limit_fallback = FALLBACK_INTENT.copy()
            rate_limit_fallback["chat_response"] = (
                "phew, I'm a bit overwhelmed right now! my AI brain is taking a quick nap. "
                "you can still request movies manually though! just type:\n\n"
                "🎬 `/movie [title]`\n"
                "📺 `/series [title] [season] [episode]`"
            )
            return rate_limit_fallback
        return FALLBACK_INTENT.copy()
