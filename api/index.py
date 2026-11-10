"""Punto de entrada de Vercel: expone la app de FastAPI (api/main.py) como función serverless."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from api.main import app  # noqa: E402,F401
