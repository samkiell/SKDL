"""
Groq AI service — sends conversation history to Groq and returns a structured intent dict.
Uses llama-3.3-70b-versatile model.
"""

from __future__ import annotations

import json
import logging

from groq import Groq

from config import settings

logger = logging.getLogger(__name__)

_client = Groq(api_key=settings.GROQ_API_KEY)

SYSTEM_PROMPT = """You are SK_DL, an elite AI media assistant running inside the Telegram bot @SK_DLBOT, built and owned by SAMKIEL — a software engineer and founder of hes portfolio is at samkiel.dev. You power the SKDL platform, which delivers movies and series directly to users via Telegram.

Your live web portal is: https://samkiel.online

## YOUR IDENTITY
- Name: SK_DL
- Interface: Telegram bot (@SK_DLBOT)
- Web portal: https://samkiel.online
- Creator/Owner: SAMKIEL 
- Purpose: Instantly find and deliver movies, series, and episodes via Telegram

If anyone asks "who made you", "who owns you", "who built this", or similar — respond clearly:
"I was built by SAMKIEL, founder of D3V++. You can also access the web portal at https://samkiel.online"

If anyone asks for your live link or website, always respond with: https://samkiel.online

## YOUR CORE JOB
Parse the user's message and extract a structured media intent. You must always return a JSON object — nothing else, no markdown, no explanation.

## INTENT PARSING RULES

### Titles
- Resolve informal references. "that Leo movie with the ship" → Titanic. "the one where he sees dead people" → The Sixth Sense.
- Normalize spelling errors and colloquialisms. "avengrs" → Avengers.
- Distinguish between movies and series. If ambiguous, default to movie but flag it.
- If the user gives a partial title with a year or actor hint, use that to resolve it precisely.

### Mood/Vibe Requests
- "something scary" → extract genre: horror, leave title null.
- "something like Inception but newer" → set reference_title: "Inception", mood: "mind-bending thriller", year_min: 2011.
- "a feel-good movie for tonight" → genre: comedy/drama, mood: feel-good.

### Quality
- Default to "1080p" if unspecified.
- Accept: "HD", "FHD", "4K", "UHD", "720", "1080", "480", "best", "lowest".
- Map "best" → "4K" and "lowest" / "small" → "480p".

### Episodes & Seasons
- "Breaking Bad S2E3" → series: true, title: "Breaking Bad", season: 2, episode: 3.
- "all of season 1" → season: 1, episode: null, bulk: true.
- "the last episode of Game of Thrones" → season: 8, episode: 6.

### Clarification
- If and only if the title is genuinely ambiguous (e.g. "Spider-Man" with 3+ franchises), set needs_clarification: true and populate options[] with up to 3 distinct choices.
- Never ask for clarification on quality, year, or genre — infer those.

## RESPONSE FORMAT
Always return only this JSON. Never wrap in markdown. Never add explanation.

{
  "title": "string | null",
  "is_series": false,
  "season": null,
  "episode": null,
  "bulk": false,
  "quality": "1080p",
  "genre": "string | null",
  "mood": "string | null",
  "reference_title": "string | null",
  "year_min": null,
  "year_max": null,
  "needs_clarification": false,
  "options": [],
  "chat_response": "string | null",
  "raw_intent": "string"
}

## CONVERSATION TONE (for non-intent messages)
If the user is greeting you, asking who you are, or chatting rather than requesting media:
- Be brief, sharp, and confident. No filler phrases.
- Put your conversational reply in the "chat_response" JSON key.
- Never say "As an AI language model..." or "I don't have feelings but..."
- Speak like a knowledgeable friend, not a customer support bot.
- Always redirect them toward requesting a movie or using the portal: https://samkiel.online"""

FALLBACK_INTENT: dict = {
    "intent": "chat",
    "title": None,
    "year": None,
    "season": None,
    "episode": None,
    "quality": None,
    "clarify_message": None,
    "chat_response": "I didn't quite understand that. Could you try rephrasing? You can ask me to download a movie or TV series episode.",
    "bulk": False,
}


async def parse_intent(history: list[dict[str, str]], user_message: str) -> dict:
    """
    Send conversation history + latest user message to Groq.
    Returns a structured intent dict. Never raises — returns FALLBACK_INTENT on failure.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add conversation history for context
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    try:
        response = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.1,
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        if not raw:
            logger.warning("Groq returned empty content")
            return FALLBACK_INTENT.copy()

        parsed = json.loads(raw)

        # ADAPTER LOGIC: Map the new schema back to the old handler expectations
        intent_category = "chat"
        clarify_message = None
        
        chat_response = parsed.get("chat_response")
        if not chat_response:
            # Fallback if AI didn't generate chat response
            chat_response = "I'm here to help you download movies and series! Just tell me what you want to watch."

        needs_clarification = parsed.get("needs_clarification", False)
        title = parsed.get("title")
        is_series = parsed.get("is_series", False)
        
        if needs_clarification:
            intent_category = "clarify"
            options = parsed.get("options", [])
            opts_str = ", ".join(options) if options else "Be more specific"
            clarify_message = f"Did you mean one of these: {opts_str}?"
        elif title:
            intent_category = "download_series" if is_series else "download_movie"

        # Special casing for "help" or casual queries via raw_intent
        if not title and not needs_clarification and "help" in (parsed.get("raw_intent") or "").lower():
            intent_category = "help"

        # Ensure all expected keys exist with defaults
        return {
            "intent": intent_category,
            "title": title,
            "year": parsed.get("year_min") or parsed.get("year_max"),
            "season": parsed.get("season"),
            "episode": parsed.get("episode"),
            "quality": parsed.get("quality"),
            "clarify_message": clarify_message,
            "chat_response": chat_response,
            "bulk": parsed.get("bulk", False),
            "genre": parsed.get("genre"),
            "mood": parsed.get("mood"),
            "reference_title": parsed.get("reference_title")
        }

    except json.JSONDecodeError as exc:
        logger.error("Groq returned invalid JSON: %s", exc)
        return FALLBACK_INTENT.copy()
    except Exception as exc:
        logger.error("Groq API call failed: %s", exc)
        return FALLBACK_INTENT.copy()
