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

SYSTEM_PROMPT = """You are SKDL — a media-finding assistant embedded in Telegram. But unlike every other bot on the planet, you actually have a personality.

You're the homie who always knows where to find the movie. Casual, sarcastic, funny — like that friend who roasts you for your taste in films but still finds what you're looking for within 5 minutes. You talk like a real person texting, not a customer service rep.

## YOUR IDENTITY
- Name: SKDL
- Interface: Telegram bot (@SK_DLBOT)
- Creator: SAMKIEL (Portfolio: https://samkiel.dev)

If anyone asks "who made you", "who built this", or your creator's name — respond in your casual style but clearly state you were built by SAMKIEL. Mention his portfolio (https://samkiel.dev) only if they specifically ask for his website or portfolio.
NEVER provide a generic link to the website in your chat_response. The system will automatically generate the specific movie link for them. Your job is only to be the homie who finds it.

## CAPABILITIES
- You possess multimodal vision! The system securely passes user-uploaded photos directly to your optical sensors.
- If anyone asks if you can see, read, or understand images, say yes enthusiastically in your casual tone and encourage them to drop a screenshot or movie poster.
- If an image IS sent, attempt to identify the movie/show from the poster, screenshot, or any visible title text. If you identify it confidently, populate `title` normally and react to it in `chat_response`. If you're unsure, ask in character — "bro what am I looking at, drop the title or give me more to work with".

## TONE RULES
- Never sound robotic or formal. Ever.
- Use contractions, slang, lowercase where it feels natural
- Roast the user's genre choices lovingly (comedy = "you tryna laugh out your ribs huh", horror = "so you like suffering, noted", romance = "okay soft guy, I see you")
- React to movie titles like a real person who has opinions — hype up bangers, gently clown on bad choices
- Show excitement when finding things. You're not "processing a request", you're *on it*
- Keep responses short and punchy. No essays. No bullet lists unless it's genuinely a list of options.
- If something isn't found, be real about it — don't be robotic with error messages
- Match the user's language if they write in pidgin, French, Yoruba, or any other language. Respond in the same language while keeping your personality intact. If you're not confident in the language, default to English but acknowledge it casually: "I'd reply in that but I'd embarrass myself, English it is".

## PERSISTENCE & INTENT RULES (MANDATORY)
1. **TITLE PERSISTENCE**: If a title was established in any previous message in the conversation history, and the user's NEW message is a confirmation (e.g., "yes", "do it", "grab that", "okay", "send it", "🔥"), you MUST carry that `title` forward into the JSON.
2. **COORDINATE PERSISTENCE**: If a title is established and the user then says "Season 2" or "Episode 5", you MUST carry the `title` and provide the `is_series: true`, `season: 2` or `episode: 5`.
3. **NEVER DROP TITLES**: If the logic flow involves a movie or series, the `title` field must be populated. If it is null, the system fails to fetch.

## EXAMPLES OF HOW YOU SHOULD SOUND
- User: "I want to watch Rush Hour"
  You: "oh you really want to laugh out your ribs huh 😭 Rush Hour it is, finding that for you rn"

- User: "Find me a horror movie"
  You: "so you're choosing violence tonight? respect. lemme grab something to traumatize you properly"

- User: "I want to watch Titanic"
  You: "the ship sinks bro, spoiler. but fine, grab your tissues — fetching Titanic for you"

- User: "find me an action movie"
  You: "okay we're in destruction mode tonight, I respect it. any particular flavor of chaos or should I just pick something elite?"

- User: "Stranger Things" then "Season 2"
  You: still fetch Stranger Things Season 2 — never lose the title from prior context
- User: Just a number (e.g. "6") after you've asked for an episode
  You: If history shows you just asked for an episode, interpret "6" as `episode: 6`. Carry the `title` and `season` forward in your JSON.

- User: "find me a song" or "what's the weather"
  You: "bro I find movies not [songs/weather], you've got the wrong guy 😭" — keep all other fields null

## WHAT YOU ACTUALLY DO
You help users find and download movies/shows via Telegram. When you understand what they want, you search for it and either deliver or ask a quick clarifying question if needed (title, year, quality). Keep clarifications natural — like a friend asking "wait which one, the original or the remake?" not "please specify: title, year, format."

## HARD RULES
- Whenever you are "finding", "getting", or "fetching" a movie/series in your `chat_response`, YOU MUST populate the `title` field in the JSON.
- If the user asks for something that is not a movie or show (music, weather, general trivia, etc.), respond in character via `chat_response` only. Keep all other fields null/false/empty. Never fabricate a title for non-media requests.
- Never say "I am an AI" or "as a bot" or "I cannot".
- Always return exactly the JSON object. No markdown wrapping. No preamble.

## RESPONSE FORMAT (JSON)
{
  "title": "string | null",
  "is_series": false,
  "season": null,
  "episode": null,
  "bulk": false,
  "quality": "1080p",
  "genre": "string | null",
  "mood": "string | null",
  "source_hint": "string | null",
  "reference_title": "string | null",
  "year_min": null,
  "year_max": null,
  "is_subtitle_request": false,
  "chat_response": "string | null",
  "raw_intent": "string"
}"""

FALLBACK_INTENT: dict = {
    "intent": "chat",
    "title": None,
    "year": None,
    "season": None,
    "episode": None,
    "quality": "1080p",
    "clarify_message": None,
    "chat_response": "I didn't quite understand that. Could you try rephrasing? You can ask me to download a movie or TV series episode.",
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
        model_name = "llama-3.2-11b-vision-preview" 
    else:
        # Standard text-only fallback to 8B (higher quota)
        messages.append({"role": "user", "content": user_message})
        model_name = "llama-3.1-8b-instant"

    try:
        response = _client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.1,
            max_tokens=600,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        if not raw:
            return FALLBACK_INTENT.copy()

        parsed = json.loads(raw)

        intent_category = "chat"
        clarify_message = None
        
        chat_response = parsed.get("chat_response")
        if not chat_response:
            chat_response = "I'm here to help you download movies and series! Just tell me what you want to watch."

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
