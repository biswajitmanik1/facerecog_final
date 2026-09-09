"""Shared PostgreSQL access for the legacy desktop app.

Reuses the exact same SQLAlchemy models as the web backend (backend/models.py)
and points at the same database, so a student registered from either app is
visible -- and, since both sides use DeepFace embeddings, recognizable -- from
the other.
"""
import os
import sys

_ROOT = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.join(_ROOT, "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from dotenv import load_dotenv

load_dotenv(os.path.join(_BACKEND, ".env"))

# Import everything from the new FastAPI backend structure
from database import engine, Base, SessionLocal
from models import AttendanceRecord, AuthAdmin, AuthTeacher, AuthUser, DemoSession, FaceUser, Student

# Ensure tables exist
Base.metadata.create_all(engine)

__all__ = [
    "SessionLocal",
    "Student",
    "AttendanceRecord",
    "AuthUser",
    "AuthTeacher",
    "AuthAdmin",
    "DemoSession",
    "FaceUser",
]
