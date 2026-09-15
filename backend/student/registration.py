import time
import re
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
from scipy.spatial.distance import cosine

student_registration_router = APIRouter()
detector = MTCNN()
logger = logging.getLogger(__name__)


def read_image_from_bytes(b, max_dim=640):
    img = Image.open(io.BytesIO(b)).convert('RGB')
    if max(img.size) > max_dim:
        scale = max_dim / float(max(img.size))
        new_size = (int(img.width * scale), int(img.height * scale))
        img = img.resize(new_size, Image.Resampling.BILINEAR)
    return np.array(img)


def detect_faces_rgb(rgb_image, det=None):
    active_det = det or detector
    detections = active_det.detect_faces(rgb_image)
    faces = []
    for d in detections:
        if d['confidence'] > 0.85:
            x, y, w, h = d['box']
            x, y = max(0, x), max(0, y)
            if w > 40 and h > 40:
                face_rgb = rgb_image[y:y+h, x:x+w]
                faces.append({'box': (x, y, w, h), 'face': face_rgb, 'confidence': d['confidence']})
    return faces


def extract_embedding(face_rgb):
    try:
        face_pil = Image.fromarray(face_rgb.astype('uint8')).resize((160, 160))
        face_array = np.array(face_pil)
        rep = DeepFace.represent(
            face_array,
            model_name='Facenet512',
            detector_backend='skip',
            enforce_detection=False
        )
        return np.array(rep[0]['embedding'], dtype=np.float32)
    except Exception as e:
        logger.error(f"Embedding error: {e}")
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

    if current_user["role"] == "teacher":
        teacher_dept = current_user.get("department")
        if not teacher_dept:
            from models import AuthTeacher
            t = db.query(AuthTeacher).filter_by(email=current_user["email"]).first()
            if t:
                teacher_dept = t.department
        if teacher_dept and data.get("department") and data.get("department").strip().lower() != teacher_dept.strip().lower():
            return JSONResponse(status_code=403, content={
                "success": False,
                "error": f"Unauthorized: As a {teacher_dept} teacher, you can only register students for {teacher_dept}."
            })

    required_fields = ['studentName', 'studentId', 'department', 'year', 'division', 'semester', 'email', 'phoneNumber', 'images']
    for field in required_fields:
        if not data.get(field):
            return JSONResponse(status_code=400, content={"success": False, "error": f"{field} is required"})

    clean_p = re.sub(r'\D', '', str(data.get('phoneNumber') or ''))
    if len(clean_p) == 12 and clean_p.startswith('91'):
        clean_p = clean_p[2:]
    elif len(clean_p) == 11 and clean_p.startswith('0'):
        clean_p = clean_p[1:]
    elif len(clean_p) > 10:
        clean_p = clean_p[-10:]

    if len(clean_p) != 10:
        return JSONResponse(status_code=400, content={"success": False, "error": "A valid 10-digit phone number is required"})
    data['phoneNumber'] = clean_p

    if db.query(Student).filter_by(student_id=data['studentId']).first():
        return JSONResponse(status_code=400, content={"success": False, "error": "Student ID already exists"})
    if db.query(Student).filter_by(email=data['email']).first():
        return JSONResponse(status_code=400, content={"success": False, "error": "Email already registered"})

    images = data.get('images')
    if not isinstance(images, list) or len(images) != 5:
        return JSONResponse(status_code=400, content={"success": False, "error": "Exactly 5 images are required"})

    # Use singleton model manager if available
    model_manager = getattr(request.app.state, "model_manager", None)
    active_det = model_manager.get_detector() if (model_manager and model_manager.is_ready()) else detector

    embeddings = []
    for idx, img_b64 in enumerate(images):
        try:
            if img_b64.startswith("data:"):
                img_b64 = img_b64.split(",", 1)[1]
            rgb = read_image_from_bytes(base64.b64decode(img_b64))
        except Exception:
            return JSONResponse(status_code=400, content={"success": False, "error": f"Invalid image data at index {idx}"})

        faces = detect_faces_rgb(rgb, det=active_det)
        if len(faces) != 1:
            return JSONResponse(status_code=400, content={"success": False, "error": f"Ensure exactly one face in each image (failed at image {idx+1})"})

        emb = extract_embedding(faces[0]['face'])
        if emb is None:
            return JSONResponse(status_code=500, content={"success": False, "error": f"Failed to extract face features for image {idx+1}"})
        embeddings.append(emb.tolist())

    # Biometric duplicate face verification
    new_avg_emb = np.mean(embeddings, axis=0)
    existing_students = db.query(Student).filter(Student.embeddings.isnot(None)).all()
    for existing in existing_students:
        stored = existing.embeddings
        if not stored:
            continue
        if isinstance(stored, list) and len(stored) > 0:
            ex_avg = np.mean(stored, axis=0)
        else:
            ex_avg = np.array(stored)

        dist = cosine(new_avg_emb, ex_avg)
        if dist < 0.40:
            confidence = round((1 - dist) * 100, 1)
            logger.warning(f"Duplicate face detected! Matches student {existing.student_id} ({existing.student_name}) with {confidence}% confidence")
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "error": f"This face is already registered to '{existing.student_name}' (ID: {existing.student_id}, Match: {confidence}%). The same face cannot be registered under multiple student IDs."
                }
            )

    now = time.time()
    from models import AuthUser, MasterStudentRoster
    auth_user = db.query(AuthUser).filter(
        (AuthUser.email == data['email']) | (AuthUser.username == data['studentId'])
    ).first()

    # If the user account was already approved by admin or if admin is creating, stay active
    if auth_user and auth_user.status == "active":
        initial_status = "active"
    elif current_user.get("role") == "admin":
        initial_status = "active"
    else:
        initial_status = "pending_approval"

    student = Student(
        student_id=data['studentId'],
        student_name=data['studentName'],
        department=data['department'],
        year=data['year'],
        division=data['division'],
        semester=data['semester'],
        email=data['email'],
        phone_number=data['phoneNumber'],
        status=initial_status,
        embeddings=embeddings,
        face_registered=True,
        created_at=now,
        updated_at=now,
    )
    db.add(student)

    # Sync AuthUser status
    if auth_user:
        if auth_user.status != "active":
            auth_user.status = initial_status
        if not auth_user.phone_number and data.get('phoneNumber'):
            auth_user.phone_number = data['phoneNumber']

    db.commit()

    msg = "Student registration completed and active!" if initial_status == "active" else "Student registration submitted! Your profile and face enrollment are pending administrator approval."
    return {
        "success": True,
        "studentId": data['studentId'],
        "record_id": str(student.id),
        "status": initial_status,
        "message": msg
    }


@student_registration_router.get('/api/student/registration-prefill')
async def get_registration_prefill(
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    from models import AuthUser, MasterStudentRoster
    email = current_user.get("email", "")

    auth_user = db.query(AuthUser).filter_by(email=email).first() if email else None
    student_record = db.query(Student).filter(
        (Student.email.ilike(email)) |
        ((Student.student_id.ilike(auth_user.username)) if auth_user and auth_user.username else False)
    ).first() if email else None

    # Try matching master roster by student roll number or email
    master_match = None
    if auth_user and auth_user.username:
        master_match = db.query(MasterStudentRoster).filter(
            MasterStudentRoster.roll_number.ilike(auth_user.username)
        ).first()
    if not master_match and email:
        master_match = db.query(MasterStudentRoster).filter(
            MasterStudentRoster.email.ilike(email)
        ).first()

    phone = ""
    if auth_user and auth_user.phone_number:
        phone = auth_user.phone_number
    elif master_match and master_match.phone_number:
        phone = master_match.phone_number
    elif student_record and student_record.phone_number:
        phone = student_record.phone_number

    student_id = ""
    if student_record and student_record.student_id:
        student_id = student_record.student_id
    elif auth_user and auth_user.username:
        student_id = auth_user.username
    elif master_match and master_match.roll_number:
        student_id = master_match.roll_number

    name = ""
    if master_match and master_match.full_name:
        name = master_match.full_name
    elif student_record and student_record.student_name:
        name = student_record.student_name
    elif auth_user and auth_user.username and not any(c in auth_user.username for c in ['-', '/']):
        name = auth_user.username

    dept = ""
    if master_match and master_match.department:
        dept = master_match.department
    elif student_record and student_record.department:
        dept = student_record.department

    year = ""
    if master_match and master_match.year:
        year = master_match.year
    elif student_record and student_record.year:
        year = student_record.year

    division = ""
    if master_match and master_match.division:
        division = master_match.division
    elif student_record and student_record.division:
        division = student_record.division

    return {
        "success": True,
        "prefill": {
            "studentId": student_id,
            "studentName": name,
            "email": email,
            "phoneNumber": phone,
            "department": dept,
            "year": year,
            "division": division,
            "hasStudentRecord": bool(student_record),
            "matchedRoster": bool(master_match),
        }
    }


@student_registration_router.get('/api/students/count')
async def get_student_count(db: Session = Depends(get_db)):
    return {"success": True, "count": db.query(Student).count()}


@student_registration_router.get('/api/students/departments')
async def get_departments(db: Session = Depends(get_db)):
    rows = db.query(Student.department).distinct().all()
    departments = [r[0] for r in rows if r[0]]
    return {"success": True, "departments": departments, "count": len(departments)}
