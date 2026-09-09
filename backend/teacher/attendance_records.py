import io
import base64
import numpy as np
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from PIL import Image
from scipy.spatial.distance import cosine
from deepface import DeepFace
import logging
import time

from database import get_db
from models import AttendanceRecord, Student
from auth_utils import require_auth

logger = logging.getLogger(__name__)

attendance_session_router = APIRouter(prefix="/api/attendance")

# ----------------- OPTIMIZED Helper Functions ----------------- #

def read_image_from_base64_optimized(image_b64: str, target_size=(640, 480)):
    """Convert base64 image to RGB numpy array with optimization"""
    if image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]

    image_bytes = base64.b64decode(image_b64)
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    if img.width > target_size[0] or img.height > target_size[1]:
        img.thumbnail(target_size, Image.Resampling.LANCZOS)

    return np.array(img)


def detect_faces_optimized(rgb_image, detector):
    """Detect faces using preloaded MTCNN detector"""
    if rgb_image.shape[0] < 50 or rgb_image.shape[1] < 50:
        return []

    detections = detector.detect_faces(rgb_image)
    faces = []

    for d in detections:
        if d["confidence"] > 0.85:
            x, y, w, h = d["box"]
            x, y = max(0, x), max(0, y)
            if w > 40 and h > 40:
                face_rgb = rgb_image[y:y+h, x:x+w]
                faces.append({
                    "box": (x, y, w, h),
                    "face": face_rgb,
                    "confidence": d["confidence"]
                })

    return faces


def extract_embedding_optimized(face_rgb):
    """Extract embedding using preloaded DeepFace model"""
    try:
        if face_rgb.shape[0] < 40 or face_rgb.shape[1] < 40:
            return None

        face_pil = Image.fromarray(face_rgb.astype("uint8")).resize((160, 160))
        face_array = np.array(face_pil)

        rep = DeepFace.represent(
            face_array,
            model_name="Facenet512",
            detector_backend="skip",
            enforce_detection=False
        )
        return np.array(rep[0]["embedding"], dtype=np.float32)

    except Exception as e:
        logger.error(f"Embedding extraction error: {e}")
        return None


# Enhanced embedding cache for attendance sessions
class AttendanceEmbeddingCache:
    def __init__(self):
        self.cached_embeddings = {}
        self.last_update = {}
        self.cache_duration = 600  # 10 minutes for attendance sessions

    def get_session_embeddings(self, session_filter, db: Session):
        """Get cached embeddings for specific session filters"""
        cache_key = str(sorted(session_filter.items()))
        current_time = time.time()

        if (cache_key not in self.cached_embeddings or
                current_time - self.last_update.get(cache_key, 0) > self.cache_duration):

            logger.info(f"Refreshing attendance embedding cache for {session_filter}")

            query = db.query(Student)
            if session_filter.get("department"):
                query = query.filter(Student.department == session_filter["department"])
            if session_filter.get("year"):
                query = query.filter(Student.year == session_filter["year"])
            if session_filter.get("division"):
                query = query.filter(Student.division == session_filter["division"])
            students = query.filter(Student.embeddings.isnot(None)).all()

            session_embeddings = []
            for student in students:
                embeddings = student.embeddings
                if embeddings:
                    if isinstance(embeddings, list) and len(embeddings) > 0:
                        if isinstance(embeddings[0], list):
                            avg_embedding = np.mean(embeddings, axis=0).astype(np.float32)
                        else:
                            avg_embedding = np.array(embeddings, dtype=np.float32)
                    else:
                        avg_embedding = np.array(embeddings, dtype=np.float32)

                    session_embeddings.append({
                        'embedding': avg_embedding,
                        'studentId': student.student_id,
                        'studentName': student.student_name,
                        'department': student.department,
                        'year': student.year,
                        'division': student.division
                    })

            self.cached_embeddings[cache_key] = session_embeddings
            self.last_update[cache_key] = current_time
            logger.info(f"Cached {len(session_embeddings)} student embeddings for session")

        return self.cached_embeddings[cache_key]


attendance_cache = AttendanceEmbeddingCache()

# ----------------- OPTIMIZED Routes ----------------- #

@attendance_session_router.post("/create_session")
async def create_session(
    request: Request,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Create a new attendance session"""
    data = await request.json()

    students_list = []

    student_filter = {}
    if data.get("department"):
        student_filter["department"] = data.get("department")
    if data.get("year"):
        student_filter["year"] = data.get("year")
    if data.get("division"):
        student_filter["division"] = data.get("division")

    try:
        query = db.query(Student)
        if student_filter:
            if student_filter.get("department"):
                query = query.filter(Student.department == student_filter["department"])
            if student_filter.get("year"):
                query = query.filter(Student.year == student_filter["year"])
            if student_filter.get("division"):
                query = query.filter(Student.division == student_filter["division"])
            students = query.all()
        else:
            students = []

        for s in students:
            students_list.append({
                "student_id": s.student_id,
                "student_name": s.student_name,
                "present": False,
                "marked_at": None
            })

        logger.info(f"Created session with {len(students)} students preloaded")

    except Exception as e:
        logger.error(f"Error preloading students: {e}")

    session = AttendanceRecord(
        date=data.get("date"),
        subject=data.get("subject"),
        department=data.get("department"),
        year=data.get("year"),
        division=data.get("division"),
        created_at=datetime.now(),
        finalized=False,
        ended_at=None,
        students=students_list
    )
    db.add(session)
    db.commit()

    return {"session_id": str(session.id), "students_count": len(students_list)}


@attendance_session_router.post("/end_session")
async def end_session(
    request: Request,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Finalize an attendance session with enhanced logging"""
    data = await request.json()
    session_id = data.get("session_id")
    if not session_id:
        return JSONResponse(status_code=400, content={"error": "Missing session_id"})

    try:
        session = db.query(AttendanceRecord).get(int(session_id))
        if not session:
            return JSONResponse(status_code=404, content={"error": "Session not found"})

        present_students = set(
            s.get("student_id") for s in (session.students or [])
            if s.get("present")
        )

        query = db.query(Student)
        if session.department:
            query = query.filter(Student.department == session.department)
        if session.year:
            query = query.filter(Student.year == session.year)
        if session.division:
            query = query.filter(Student.division == session.division)
        all_students = query.all() if (session.department or session.year or session.division) else []

        students_by_id = {s.get("student_id"): dict(s) for s in (session.students or [])}
        absent_count = 0
        for s in all_students:
            sid = s.student_id
            sname = s.student_name

            if sid not in present_students:
                students_by_id[sid] = {
                    "student_id": sid,
                    "student_name": sname,
                    "present": False,
                    "marked_at": None
                }
                absent_count += 1

        session.students = list(students_by_id.values())
        session.finalized = True
        session.ended_at = datetime.now()
        db.commit()

        logger.info(f"Session finalized: {len(present_students)} present, {absent_count} absent")

        return {
            "success": True,
            "statistics": {
                "present_count": len(present_students),
                "absent_count": absent_count,
                "total_students": len(all_students)
            }
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error ending session: {e}")
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@attendance_session_router.post("/real-mark")
async def mark_attendance_with_duplicate_prevention(
    request: Request,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Attendance marking with enhanced duplicate prevention"""
    start_time = time.time()

    model_manager = getattr(request.app.state, "model_manager", None)
    if not model_manager or not model_manager.is_ready():
        return JSONResponse(status_code=503, content={"error": "Face recognition models not initialized"})

    detector = model_manager.get_detector()

    data = await request.json()
    session_id = data.get("session_id")
    image_b64 = data.get("image")

    if not session_id or not image_b64:
        return JSONResponse(status_code=400, content={"error": "Missing session_id or image"})

    try:
        rgb = read_image_from_base64_optimized(image_b64)
        faces = detect_faces_optimized(rgb, detector)

        if len(faces) == 0:
            return {"message": "No faces detected", "faces": []}

        session = db.query(AttendanceRecord).get(int(session_id))
        if not session:
            return JSONResponse(status_code=404, content={"error": "Session not found"})
        if session.finalized:
            return JSONResponse(status_code=400, content={"error": "Session already finalized"})

        students_list = list(session.students or [])
        already_present_students = set()
        for student_entry in students_list:
            if student_entry.get("present") is True:
                already_present_students.add(student_entry.get("student_id"))

        logger.info(f"Session {session_id} already has {len(already_present_students)} students marked present")

        threshold = float(getattr(request.app.state, "threshold", 0.6))

        students = db.query(Student).filter(Student.embeddings.isnot(None)).all()
        results = []

        for f in faces:
            emb = extract_embedding_optimized(f["face"])
            if emb is None:
                results.append({
                    "match": None,
                    "distance": None,
                    "box": f["box"],
                    "error": "Failed to extract embedding"
                })
                continue

            best, min_d = None, float("inf")
            for student in students:
                stored_embeddings = student.embeddings
                if not stored_embeddings:
                    continue

                if isinstance(stored_embeddings, list) and len(stored_embeddings) > 0:
                    avg_embedding = np.mean(stored_embeddings, axis=0)
                else:
                    avg_embedding = np.array(stored_embeddings)

                d = cosine(emb, avg_embedding)
                if d < min_d:
                    min_d = d
                    best = student

            if min_d < threshold and best:
                student_id = best.student_id
                student_name = best.student_name

                if student_id in already_present_students:
                    results.append({
                        "match": {"user_id": student_id, "name": student_name},
                        "distance": round(float(min_d), 4),
                        "confidence": round((1 - min_d) * 100, 1),
                        "box": f["box"],
                        "already_marked": True,
                        "status": "duplicate",
                        "message": f"{student_name} is already marked present in this session"
                    })
                    logger.info(f"Duplicate detection: {student_name} ({student_id}) already present")
                    continue

                found_existing = False
                for entry in students_list:
                    if entry.get("student_id") == student_id:
                        entry["present"] = True
                        entry["marked_at"] = datetime.now().isoformat()
                        found_existing = True
                        break

                if not found_existing:
                    students_list.append({
                        "student_id": student_id,
                        "student_name": student_name,
                        "present": True,
                        "marked_at": datetime.now().isoformat()
                    })
                    already_present_students.add(student_id)
                    results.append({
                        "match": {"user_id": student_id, "name": student_name},
                        "distance": round(float(min_d), 4),
                        "confidence": round((1 - min_d) * 100, 1),
                        "box": f["box"],
                        "already_marked": False,
                        "status": "marked_present_new",
                        "message": f"{student_name} added to session and marked present"
                    })
                    logger.info(f"Added {student_name} ({student_id}) to session as present")
                else:
                    already_present_students.add(student_id)
                    results.append({
                        "match": {"user_id": student_id, "name": student_name},
                        "distance": round(float(min_d), 4),
                        "confidence": round((1 - min_d) * 100, 1),
                        "box": f["box"],
                        "already_marked": False,
                        "status": "marked_present",
                        "message": f"{student_name} marked present successfully"
                    })
                    logger.info(f"Marked {student_name} ({student_id}) as present")

            else:
                results.append({
                    "match": None,
                    "distance": round(float(min_d), 4) if min_d != float('inf') else None,
                    "confidence": round((1 - min_d) * 100, 1) if min_d != float('inf') else None,
                    "box": f["box"],
                    "status": "no_match",
                    "message": "Face not recognized"
                })

        session.students = students_list
        db.commit()

        processing_time = time.time() - start_time

        return {
            "message": "Recognition processed",
            "faces": results,
            "processing_time": round(processing_time, 3),
            "session_info": {
                "session_id": session_id,
                "total_present_now": len(already_present_students),
                "faces_detected": len(faces),
                "duplicates_prevented": sum(1 for r in results if r.get("status") == "duplicate")
            }
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Attendance error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# Health check for attendance models
@attendance_session_router.get("/models/status")
async def attendance_model_status(request: Request):
    """Check model status for attendance system"""
    model_manager = getattr(request.app.state, "model_manager", None)

    if not model_manager:
        return JSONResponse(status_code=500, content={
            "success": False,
            "error": "Model manager not available"
        })

    return {
        "success": True,
        "models_ready": model_manager.is_ready(),
        "health_check": model_manager.health_check(),
        "cache_info": {
            "embedding_cache_active": True,
            "cache_duration": "10 minutes"
        },
        "timestamp": time.time()
    }
