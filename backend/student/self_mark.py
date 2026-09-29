"""
Student Self-Mark Attendance
Each student marks their own attendance using:
  1. 4-digit session code (shown on projector, rotates every 60 seconds)
  2. GPS location (must be within radius of teacher's captured location)
  3. Face selfie (must match their stored biometric embedding)
"""

import hashlib
import time
import base64
import math
import numpy as np
from PIL import Image
import io
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.orm.attributes import flag_modified
from scipy.spatial.distance import cosine

from database import get_db
from models import AttendanceRecord, Student
from auth_utils import require_auth

logger = logging.getLogger(__name__)
self_mark_router = APIRouter()


# ─── Session Code (rotates every 60 seconds) ──────────────────────

def generate_session_code(session_id: int) -> str:
    """Deterministic 4-digit code per session per minute."""
    current_minute = int(time.time() // 60)
    raw = f"ams-session-{session_id}-{current_minute}"
    hash_val = int(hashlib.sha256(raw.encode()).hexdigest(), 16)
    return str(hash_val % 10000).zfill(4)


def validate_session_code(session_id: int, submitted_code: str) -> bool:
    """Accept current minute and previous minute (grace period for slow typers)."""
    current_minute = int(time.time() // 60)
    for offset in [0, -1]:
        raw = f"ams-session-{session_id}-{current_minute + offset}"
        hash_val = int(hashlib.sha256(raw.encode()).hexdigest(), 16)
        if str(hash_val % 10000).zfill(4) == submitted_code:
            return True
    return False


def seconds_until_refresh() -> int:
    return 60 - (int(time.time()) % 60)


# ─── GPS Haversine Distance ────────────────────────────────────────

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns distance between two GPS coordinates in meters."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Teacher: Get Current Session Code ────────────────────────────

@self_mark_router.get('/api/attendance/session-code/{session_id}')
async def get_session_code(
    session_id: int,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: DBSession = Depends(get_db)
):
    """
    Teacher polls this every second to display the rotating code on screen.
    Returns the current 4-digit code + seconds until it changes.
    """
    session = db.get(AttendanceRecord, session_id)
    if not session:
        return JSONResponse(status_code=404, content={"success": False, "error": "Session not found"})
    if session.finalized:
        return JSONResponse(status_code=400, content={"success": False, "error": "Session already finalized"})

    return {
        "success": True,
        "code": generate_session_code(session_id),
        "seconds_remaining": seconds_until_refresh(),
        "session_id": session_id,
        "gps_enabled": session.teacher_lat is not None,
        "gps_radius": session.gps_radius,
    }


# ─── Student: Self-Mark Attendance ────────────────────────────────

@self_mark_router.post('/api/attendance/student-self-mark')
async def student_self_mark(
    request: Request,
    current_user: dict = Depends(require_auth("student")),
    db: DBSession = Depends(get_db)
):
    """
    Student marks own attendance. Requires:
    - session_id: which session
    - code: 4-digit code from projector
    - image: base64 selfie
    - lat/lng: GPS coordinates (if session has GPS enabled)
    """
    data = await request.json()
    session_id = data.get("session_id")
    submitted_code = str(data.get("code", "")).strip().zfill(4)
    image_b64 = data.get("image")
    student_lat = data.get("lat")
    student_lng = data.get("lng")

    if not all([session_id, submitted_code, image_b64]):
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": "session_id, code, and image are required"
        })

    # ── 1. Validate session code ───────────────────────────────────
    if not validate_session_code(int(session_id), submitted_code):
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": "Invalid or expired code. Check the 4-digit code shown on the projector."
        })

    # ── 2. Get session ─────────────────────────────────────────────
    session = db.get(AttendanceRecord, int(session_id))
    if not session:
        return JSONResponse(status_code=404, content={"success": False, "error": "Session not found"})
    if session.finalized:
        return JSONResponse(status_code=400, content={"success": False, "error": "This session has already ended."})

    # ── 3. GPS check (only if session has GPS enabled) ─────────────
    if session.teacher_lat is not None and session.teacher_lng is not None:
        if student_lat is None or student_lng is None:
            return JSONResponse(status_code=400, content={
                "success": False,
                "error": "Location access is required. Please allow location permission and try again."
            })
        distance = haversine_distance(
            float(student_lat), float(student_lng),
            session.teacher_lat, session.teacher_lng
        )
        radius = session.gps_radius or 200
        if distance > radius:
            return JSONResponse(status_code=403, content={
                "success": False,
                "error": f"You are {int(distance)}m away from the classroom. Must be within {int(radius)}m."
            })

    # ── 4. Get student record ──────────────────────────────────────
    student_email = current_user.get("email")
    student = db.query(Student).filter_by(email=student_email).first()
    if not student:
        return JSONResponse(status_code=404, content={
            "success": False,
            "error": "Student profile not found. Please complete your registration first."
        })
    if not student.face_registered or not student.embeddings:
        return JSONResponse(status_code=400, content={
            "success": False,
            "error": "Face not enrolled. Please register your face biometrics first."
        })

    # ── 5. Department check ────────────────────────────────────────
    if (session.department and student.department and
            session.department.strip().lower() != student.department.strip().lower()):
        return JSONResponse(status_code=403, content={
            "success": False,
            "error": f"You are not enrolled in this {session.department} class."
        })

    # ── 6. Already marked? ─────────────────────────────────────────
    students_list = list(session.students or [])
    for entry in students_list:
        if entry.get("student_id") == student.student_id and entry.get("present"):
            return JSONResponse(status_code=400, content={
                "success": False,
                "error": "You are already marked present in this session."
            })

    # ── 7. Face verification ───────────────────────────────────────
    try:
        if image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        if max(img.size) > 640:
            img.thumbnail((640, 640), Image.Resampling.LANCZOS)
        img_array = np.array(img)

        model_manager = getattr(request.app.state, "model_manager", None)
        from mtcnn import MTCNN
        detector = model_manager.get_detector() if (model_manager and model_manager.is_ready()) else MTCNN()

        detections = detector.detect_faces(img_array)
        valid_faces = [d for d in detections if d["confidence"] > 0.85]

        if not valid_faces:
            return JSONResponse(status_code=400, content={
                "success": False,
                "error": "No face detected. Ensure your face is clearly visible in good lighting."
            })
        if len(valid_faces) > 1:
            return JSONResponse(status_code=400, content={
                "success": False,
                "error": "Multiple faces detected. Ensure only your face is in the frame."
            })

        x, y, w, h = valid_faces[0]["box"]
        x, y = max(0, x), max(0, y)
        face_crop = img_array[y:y + h, x:x + w]
        face_pil = Image.fromarray(face_crop.astype("uint8")).resize((160, 160))
        face_array = np.array(face_pil)

        from deepface import DeepFace
        rep = DeepFace.represent(
            face_array,
            model_name="Facenet512",
            detector_backend="skip",
            enforce_detection=False
        )
        query_embedding = np.array(rep[0]["embedding"], dtype=np.float32)

    except Exception as e:
        logger.error(f"Self-mark face error: {e}")
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": "Face processing failed. Please try again."
        })

    # ── 8. Cosine similarity match ─────────────────────────────────
    stored = student.embeddings
    if isinstance(stored[0], list):
        avg_embedding = np.mean(stored, axis=0).astype(np.float32)
    else:
        avg_embedding = np.array(stored, dtype=np.float32)

    threshold = float(getattr(request.app.state, "threshold", 0.6))
    distance = cosine(query_embedding, avg_embedding)
    confidence = round((1 - distance) * 100, 1)

    if distance >= threshold:
        return JSONResponse(status_code=401, content={
            "success": False,
            "error": f"Face verification failed ({confidence}% match). Try again in better lighting."
        })

    # ── 9. Mark present ────────────────────────────────────────────
    now_str = datetime.now().isoformat()
    found = False
    for entry in students_list:
        if entry.get("student_id") == student.student_id:
            entry["present"] = True
            entry["marked_at"] = now_str
            found = True
            break

    if not found:
        students_list.append({
            "student_id": student.student_id,
            "student_name": student.student_name,
            "present": True,
            "marked_at": now_str
        })

    session.students = students_list
    flag_modified(session, "students")
    db.commit()

    logger.info(
        f"Self-mark: {student.student_name} ({student.student_id}) "
        f"→ session {session_id} — {confidence}% confidence"
    )

    return {
        "success": True,
        "message": f"Attendance marked successfully! ({confidence}% confidence)",
        "student_name": student.student_name,
        "student_id": student.student_id,
        "confidence": confidence,
        "subject": session.subject,
        "date": session.date,
    }
