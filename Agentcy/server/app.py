"""Render-friendly entrypoint for the feedback API.

Render start command:
  uvicorn server.app:app --host 0.0.0.0 --port $PORT

This re-exports the FastAPI app from examples.feedback_api.
"""

from examples.feedback_api import app  # noqa: F401
