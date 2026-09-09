import time
import base64
import numpy as np
from PIL import Image
import io
import logging
import threading

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from deepface import DeepFace
from scipy.spatial.distance import cosine

from database import get_db
from models import Student, DemoSession

logger = logging.getLogger(__name__)

demo_session_router = APIRouter()

def read_image_from_bytes_optimized(b, target_size=(640, 480)):
    """Optimized image reading with size constraints"""
    img = Image.open(io.BytesIO(b)).convert("RGB")

    if img.width > target_size[0] or img.height > target_size[1]:
        img.thumbnail(target_size, Image.Resampling.LANCZOS)

    return np.array(img)


def detect_faces_rgb_optimized(rgb_image, detector):
    """Optimized face detection using preloaded MTCNN detector"""
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
    """Optimized embedding extraction using preloaded model"""
    try:
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


# In-memory cache for student embeddings (optional optimization)
class EmbeddingCache:
    def __init__(self):
        self.student_embeddings = None
        self.last_update = 0
        self.cache_duration = 300  # 5 minutes
        self.lock = threading.Lock()

    def get_embeddings(self, db: Session):
        current_time = time.time()

        with self.lock:
            if (self.student_embeddings is None or
                    current_time - self.last_update > self.cache_duration):

                logger.info("Refreshing embedding cache...")

                students = db.query(Student).filter(Student.embeddings.isnot(None)).all()

                self.student_embeddings = []
                for student in students:
                    embeddings = student.embeddings or []
                    if embeddings:
                        avg_embedding = np.mean(embeddings, axis=0).astype(np.float32)
                        self.student_embeddings.append({
                            'embedding': avg_embedding,
                            'studentId': student.student_id,
                            'studentName': student.student_name
                        })

                self.last_update = current_time
                logger.info(f"Cache refreshed with {len(self.student_embeddings)} students")

        return self.student_embeddings


embedding_cache = EmbeddingCache()


def find_best_match_optimized(query_embedding, db: Session, threshold=0.6):
    """Optimized database search with caching"""
    cached_embeddings = embedding_cache.get_embeddings(db)

    if not cached_embeddings:
        return None, float('inf')

    best_match = None
    min_distance = float('inf')

    for student_data in cached_embeddings:
        stored_embedding = student_data['embedding']
        distance = cosine(query_embedding, stored_embedding)

        if distance < min_distance:
            min_distance = distance
            best_match = student_data

    return best_match if min_distance < threshold else None, min_distance


@demo_session_router.post("/api/demo/recognize")
async def demo_recognize_optimized(request: Request, db: Session = Depends(get_db)):
    """OPTIMIZED face recognition endpoint using preloaded models"""
    start_time = time.time()

    model_manager = getattr(request.app.state, "model_manager", None)
    if not model_manager or not model_manager.is_ready():
        logger.error("Models not ready")
        return JSONResponse(status_code=503, content={
            "success": False,
            "error": "Face recognition models not initialized"
        })

    detector = model_manager.get_detector()
    data = await request.json()
    threshold = float(getattr(request.app.state, "threshold", 0.6))

    image_b64 = data.get("image", "")
    if image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]

    try:
        rgb = read_image_from_bytes_optimized(base64.b64decode(image_b64))
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        return JSONResponse(status_code=400, content={"success": False, "error": "Invalid base64 image"})

    detection_start = time.time()
    faces = detect_faces_rgb_optimized(rgb, detector)
    detection_time = time.time() - detection_start

    if len(faces) == 0:
        return {
            "success": True,
            "faces": [],
            "processing_time": round(time.time() - start_time, 3),
            "detection_time": round(detection_time, 3)
        }

    results = []

    for f in faces:
        embedding_start = time.time()
        emb = extract_embedding_optimized(f["face"])
        embedding_time = time.time() - embedding_start

        if emb is None:
            results.append({
                "match": None,
                "distance": None,
                "box": f["box"],
                "error": "Failed to extract embedding"
            })
            continue

        search_start = time.time()
        best_match, min_distance = find_best_match_optimized(emb, db, threshold)
        search_time = time.time() - search_start

        if best_match:
            results.append({
                "match": {
                    "user_id": best_match["studentId"],
                    "name": best_match["studentName"]
                },
                "distance": round(float(min_distance), 4),
                "confidence": round((1 - min_distance) * 100, 1),
                "box": f["box"],
                "timing": {
                    "embedding": round(embedding_time, 3),
                    "search": round(search_time, 3)
                }
            })
        else:
            results.append({
                "match": None,
                "distance": round(float(min_distance), 4),
                "box": f["box"],
                "timing": {
                    "embedding": round(embedding_time, 3),
                    "search": round(search_time, 3)
                }
            })

    total_time = time.time() - start_time

    return {
        "success": True,
        "faces": results,
        "processing_time": round(total_time, 3),
        "detailed_timing": {
            "detection": round(detection_time, 3),
            "total": round(total_time, 3)
        },
        "performance_info": {
            "models_preloaded": True,
            "cache_enabled": True
        }
    }


@demo_session_router.post('/api/demo/session')
async def create_demo_session(db: Session = Depends(get_db)):
    """Create a new demo session"""
    session = DemoSession(
        session_id=f"demo_{int(time.time())}",
        started_at=time.time(),
        status="active",
        recognitions=[]
    )
    db.add(session)
    db.commit()

    return {
        "success": True,
        "session": {
            "_id": str(session.id),
            "session_id": session.session_id,
            "started_at": session.started_at,
            "status": session.status,
            "recognitions": session.recognitions
        }
    }


@demo_session_router.post('/api/demo/session/{session_id}/log')
async def log_recognition(session_id: str, request: Request, db: Session = Depends(get_db)):
    """Log recognition result to session"""
    session = db.query(DemoSession).filter_by(session_id=session_id).first()
    if not session:
        return JSONResponse(status_code=404, content={"success": False, "error": "Session not found"})

    data = await request.json()
    recognition_log = {
        "timestamp": time.time(),
        "result": data.get('result'),
        "confidence": data.get('confidence'),
        "processing_time": data.get('processing_time')
    }

    session.recognitions = list(session.recognitions or []) + [recognition_log]
    db.commit()

    return {"success": True, "message": "Recognition logged"}


@demo_session_router.get('/api/demo/models/status')
async def model_status(request: Request):
    """Check model status endpoint"""
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
        "timestamp": time.time()
    }
