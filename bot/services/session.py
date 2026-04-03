"""
Session management — in-memory per-user conversation history.
Keyed by Telegram user_id. Cleared after successful download or /start.
"""

from __future__ import annotations

sessions: dict[int, list[dict[str, str]]] = {}
pending_requests: dict[int, dict] = {}
MAX_HISTORY = 10


def add_message(user_id: int, role: str, content: str) -> None:
    """Append a message to the user's session history."""
    if user_id not in sessions:
        sessions[user_id] = []

    sessions[user_id].append({"role": role, "content": content})

    # Trim to max history length
    if len(sessions[user_id]) > MAX_HISTORY:
        sessions[user_id] = sessions[user_id][-MAX_HISTORY:]


def get_history(user_id: int) -> list[dict[str, str]]:
    """Return the conversation history for a user."""
    return sessions.get(user_id, [])


def clear_session(user_id: int) -> None:
    """Clear session for a user (after download or /start)."""
    sessions.pop(user_id, None)
    pending_requests.pop(user_id, None)


def set_pending_request(user_id: int, intent: dict) -> None:
    """Store the parsed intent while waiting for inline quality selection."""
    pending_requests[user_id] = intent

def get_pending_request(user_id: int) -> dict | None:
    """Retrieve the pending intent for quality selection."""
    return pending_requests.get(user_id)

def clear_pending_request(user_id: int) -> None:
    pending_requests.pop(user_id, None)
