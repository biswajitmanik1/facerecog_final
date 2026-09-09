import time
import base64
import numpy as np
from PIL import Image
import io
import logging

from deepface import DeepFace
from mtcnn import MTCNN
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Student
from auth_utils import require_auth

student_registration_router = APIRouter()
detector = MTCNN()
logger = logging.getLogger(__name__)


def read_image_from_bytes(b):
    img = Image.open(io.BytesIO(b)).convert('RGB')
    return np.array(img)


def detect_faces_rgb(rgb_image):
    detections = detector.detect_faces(rgb_image)
    faces = []
    for d in detections:
        if d['confidence'] > 0.9:
            x, y, w, h = d['box']
            x, y = max(0, x), max(0, y)
            if w > 50 and h > 50:
                face_rgb = rgb_image[y:y+h, x:x+w]
                faces.append({'box': (x, y, w, h), 'face': face_rgb, 'confidence': d['confidence']})
    return faces


def extract_embedding(face_rgb):
    try:
        face_pil = Image.fromarray(face_rgb.astype('uint8')).resize((160, 160))
        face_array = np.array(face_pil)
        rep = DeepFace.represent(face_array, model_name='Facenet512', detector_backend='skip')
        return np.array(rep[0]['embedding'], dtype=float)
    except Exception as e:
        print(f"Embedding error: {e}")
        return None


@student_registration_router.post('/api/register-student')
async def register_student(
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"success": False, "error": "Invalid JSON data"})

    if not data:
        return JSONResponse(status_code=400, content={"success": False, "error": "Invalid JSON data"})

    if current_user["role"] == "student":
        data = {**data, "email": current_user["email"]}

    required_fields = ['studentName', 'studentId', 'department', 'year', 'division', 'semester', 'email', 'phoneNumber', 'images']
    for field in required_fields:
        if not data.get(field):
            return JSONResponse(status_code=400, content={"success": False, "error": f"{field} is required"})

    if db.query(Student).filter_by(student_id=data['studentId']).first():
        return JSONResponse(status_code=400, content={"success": False, "error": "Student ID already exists"})
    if db.query(Student).filter_by(email=data['email']).first():
        return JSONResponse(status_code=400, content={"success": False, "error": "Email already registered"})

    images = data.get('images')
    if not isinstance(images, list) or len(images) != 5:
        return JSONResponse(status_code=400, content={"success": False, "error": "Exactly 5 images are required"})

    embeddings = []
    for idx, img_b64 in enumerate(images):
        try:
            if img_b64.startswith("data:"):
                img_b64 = img_b64.split(",", 1)[1]
            rgb = read_image_from_bytes(base64.b64decode(img_b64))
        except Exception:
            return JSONResponse(status_code=400, content={"success": False, "error": f"Invalid image data at index {idx}"})

        faces = detect_faces_rgb(rgb)
        if len(faces) != 1:
            return JSONResponse(status_code=400, content={"success": False, "error": f"Ensure exactly one face in each image (failed at image {idx+1})"})

        emb = extract_embedding(faces[0]['face'])
        if emb is None:
            return JSONResponse(status_code=500, content={"success": False, "error": f"Failed to extract face features for image {idx+1}"})
        embeddings.append(emb.tolist())

    now = time.time()
    student = Student(
        student_id=data['studentId'],
        student_name=data['studentName'],
        department=data['department'],
        year=data['year'],
        division=data['division'],
        semester=data['semester'],
        email=data['email'],
        phone_number=data['phoneNumber'],
        status="active",
        embeddings=embeddings,
        face_registered=True,
        created_at=now,
        updated_at=now,
    )
    db.add(student)
    db.commit()

    return {"success": True, "studentId": data['studentId'], "record_id": str(student.id)}


@student_registration_router.get('/api/students/count')
async def get_student_count(db: Session = Depends(get_db)):
    return {"success": True, "count": db.query(Student).count()}


@student_registration_router.get('/api/students/departments')
async def get_departments(db: Session = Depends(get_db)):
    rows = db.query(Student.department).distinct().all()
    departments = [r[0] for r in rows if r[0]]
    return {"success": True, "departments": departments, "count": len(departments)}
