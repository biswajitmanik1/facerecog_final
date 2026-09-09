import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import bcrypt

from database import get_db
from models import AttendanceRecord, AuthTeacher
from auth_utils import require_auth

admin_router = APIRouter(prefix="/api/admin")

# ============================================================================
# TEACHER ACCOUNT MANAGEMENT (admin only)
# ============================================================================

@admin_router.get('/teachers')
async def list_teachers(
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    teachers = db.query(AuthTeacher).order_by(AuthTeacher.username.asc()).all()
    return {
        "success": True,
        "teachers": [t.to_dict() for t in teachers],
        "count": len(teachers),
    }


@admin_router.post('/teachers')
async def create_teacher(
    request: Request,
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    data = await request.json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    employee_id = data.get('employeeId')
    department = data.get('department')

    if not all([username, email, password, employee_id]):
        return JSONResponse(status_code=400, content={"success": False, "error": "username, email, password, and employeeId are required"})

    if db.query(AuthTeacher).filter_by(email=email).first():
        return JSONResponse(status_code=400, content={"success": False, "error": "Email already registered as teacher"})

    teacher = AuthTeacher(
        username=username,
        email=email,
        password=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        employee_id=employee_id,
        department=department,
        role="teacher",
        status="active",
        created_at=time.time(),
    )
    db.add(teacher)
    db.commit()

    return {"success": True, "message": "Teacher account created", "teacher": teacher.to_dict()}


@admin_router.put('/teachers/{teacher_id}')
async def update_teacher(
    teacher_id: int,
    request: Request,
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    data = await request.json()
    teacher = db.query(AuthTeacher).get(teacher_id)
    if not teacher:
        return JSONResponse(status_code=404, content={"success": False, "error": "Teacher not found"})

    if data.get('email') and data.get('email') != teacher.email:
        existing = db.query(AuthTeacher).filter(
            AuthTeacher.email == data.get('email'),
            AuthTeacher.id != teacher.id
        ).first()
        if existing:
            return JSONResponse(status_code=400, content={"success": False, "error": "Email already registered as teacher"})
        teacher.email = data['email']

    teacher.username = data.get('username', teacher.username)
    teacher.employee_id = data.get('employeeId', teacher.employee_id)
    teacher.department = data.get('department', teacher.department)
    if data.get('status') in ('active', 'inactive'):
        teacher.status = data['status']
    if data.get('password'):
        teacher.password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    db.commit()
    return {"success": True, "message": "Teacher account updated", "teacher": teacher.to_dict()}


@admin_router.delete('/teachers/{teacher_id}')
async def delete_teacher(
    teacher_id: int,
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    teacher = db.query(AuthTeacher).get(teacher_id)
    if not teacher:
        return JSONResponse(status_code=404, content={"success": False, "error": "Teacher not found"})

    name = teacher.username
    db.delete(teacher)
    db.commit()
    return {"success": True, "message": f"Teacher {name} deleted successfully"}


# ============================================================================
# INSTITUTION-WIDE REPORTING (teacher/admin)
# ============================================================================

@admin_router.get('/attendance/summary')
async def attendance_summary(
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Aggregate present/absent counts across every attendance session,
    grouped by department -- an institution-wide view rather than one
    class/session at a time."""
    records = db.query(AttendanceRecord).all()

    by_department = {}
    total_present = 0
    total_absent = 0

    for record in records:
        dept = record.department or "Unspecified"
        bucket = by_department.setdefault(dept, {"sessions": 0, "present": 0, "absent": 0})
        bucket["sessions"] += 1
        for entry in (record.students or []):
            if entry.get("present"):
                bucket["present"] += 1
                total_present += 1
            else:
                bucket["absent"] += 1
                total_absent += 1

    by_department_list = [
        {"department": dept, **stats} for dept, stats in sorted(by_department.items())
    ]

    return {
        "success": True,
        "summary": {
            "total_sessions": len(records),
            "total_present": total_present,
            "total_absent": total_absent,
            "by_department": by_department_list,
        }
    }
