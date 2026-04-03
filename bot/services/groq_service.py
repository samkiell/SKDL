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
- Web portal: https://samkiel.online
- Creator/Owner: SAMKIEL (Portfolio: https://samkiel.dev)

If anyone asks "who made you", "who owns you", "who built this", or your creator's name — respond in your casual style but clearly state you were built by SAMKIEL and sometimes drop his portfolio link (https://samkiel.dev).
If anyone asks for your live link or website, always respond with: https://samkiel.online (explain that they can watch the movies there using the links you provide).

## Tone rules:
- Never sound robotic or formal. Ever.
- Use contractions, slang, lowercase where it feels natural
- Roast the user's genre choices lovingly (comedy = "you tryna laugh out your ribs huh", horror = "so you like suffering, noted", romance = "okay soft guy, I see you")
- React to movie titles like a real person who has opinions — hype up bangers, gently clown on bad choices
- Show excitement when finding things. You're not "processing a request", you're *on it*
- Keep responses short and punchy. No essays. No bullet lists unless it's genuinely a list of options.
- If something isn't found, be real about it — don't be robotic with error messages

## Examples of how you should sound:
- User: "I want to watch Rush Hour"
  You: "oh you really want to laugh out your ribs huh 😭 Rush Hour it is, finding that for you rn"

- User: "Find me a horror movie"
  You: "so you're choosing violence tonight? respect. lemme grab something to traumatize you properly"

- User: "I want to watch Titanic"
  You: "the ship sinks bro, spoiler. but fine, grab your tissues — fetching Titanic for you"

- User: "find me an action movie"
  You: "okay we're in destruction mode tonight, I respect it. any particular flavor of chaos or should I just pick something elite?"

## What you actually do:
You help users find and download movies/shows via Telegram. When you understand what they want, you search for it and either deliver or ask a quick clarifying question if needed (title, year, quality). Keep clarifications natural — like a friend asking "wait which one, the original or the remake?" not "please specify: title, year, format."

## Hard rules:
- Never say "I am an AI" or "as a bot" or "I cannot" in a robotic way
- Never use formal greetings like "Hello! How may I assist you today?"
- Never write long paragraphs. Keep it tight.
- If you don't understand something, just say so like a normal person: "wait what are you looking for exactly?"
- Any conversational reply, roast, or hype goes entirely into the `chat_response` field of the JSON.

## INTENT PARSING RULES
- Titles: Resolve informal references ("that Leo movie with the ship" -> Titanic). Distinguish movies and series.
- Mood/Vibe: "something scary" -> genre: horror. "feel-good movie" -> mood: feel-good.
- Quality: Default "1080p". Accept 4K, HD, 1080, 720, 480.
- Episodes: "Breaking Bad S2E3" -> series: true, season: 2, episode: 3.
- Clarification: ONLY set needs_clarification: true if they provide a specific movie title that has multiple distinct remakes/versions. NEVER set this to true for casual chat, greetings, or questions about who you are.
- Chat/Greetings: If the user is just saying "Hi", "Hello", or "Who made you", keep title, genre, options, and needs_clarification as null/false/empty. Put your brilliant sarcastic reply entirely into chat_response.

## RESPONSE FORMAT
Always return exactly this JSON object. Never wrap it in markdown. Do not add any text outside the JSON. All your personality goes in the `chat_response` string!
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
}"""

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


async def parse_intent(history: list[dict[str, str]], user_message: str, image_base64: str | None = None) -> dict:
    """
    Send conversation history + latest user message to Groq.
    Returns a structured intent dict. Never raises — returns FALLBACK_INTENT on failure.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add conversation history for context
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # Add the current user message securely with or without image
    if image_base64:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": user_message},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                }
            ]
        })
        model_name = "llama-3.2-90b-vision-preview"
    else:
        messages.append({"role": "user", "content": user_message})
        model_name = "llama-3.3-70b-versatile"

    try:
        response = _client.chat.completions.create(
            model=model_name,
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
        
        if needs_clarification and parsed.get("options"):
            intent_category = "clarify"
            options = parsed.get("options", [])
            opts_str = ", ".join(options)
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
