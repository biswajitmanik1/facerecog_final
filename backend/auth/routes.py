import time
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import bcrypt

from database import get_db
from models import AuthAdmin, AuthTeacher, AuthUser, Student
from auth_utils import issue_token, require_auth, AuthException

auth_router = APIRouter()

@auth_router.post('/api/signup')
async def api_signup(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('userType', 'student')

    if not all([username, email, password]):
        return JSONResponse(status_code=400, content={"success": False, "error": "All fields required"})

    if user_type == 'admin':
        return JSONResponse(status_code=403, content={"success": False, "error": "Admin accounts cannot be self-registered"})

    if user_type == 'teacher':
        model = AuthTeacher
        employee_id = data.get('employeeId')
        department = data.get('department')
        if not employee_id:
            return JSONResponse(status_code=400, content={"success": False, "error": "Employee ID required for teachers"})
    else:
        model = AuthUser

    if db.query(model).filter_by(email=email).first():
        return JSONResponse(status_code=400, content={"success": False, "error": f"Email already registered as {user_type}"})

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    if user_type == 'teacher':
        user = AuthTeacher(
            username=username,
            email=email,
            password=hashed_pw,
            employee_id=employee_id,
            department=department,
            role="teacher",
            status="active",
            created_at=time.time(),
        )
    else:
        user = AuthUser(
            username=username,
            email=email,
            password=hashed_pw,
            status="active",
            created_at=time.time(),
        )

    db.add(user)
    db.commit()

    return {"success": True, "message": f"{user_type.capitalize()} registered successfully"}


@auth_router.post('/api/signin')
async def api_signin(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('userType', 'student')

    if not all([email, password]):
        return JSONResponse(status_code=400, content={"success": False, "error": "Email and password required"})

    if user_type == 'admin':
        model = AuthAdmin
        user_role = "admin"
    elif user_type == 'teacher':
        model = AuthTeacher
        user_role = "teacher"
    else:
        model = AuthUser
        user_role = "student"

    user = db.query(model).filter_by(email=email).first()

    if not user:
        return JSONResponse(status_code=401, content={"success": False, "error": f"No {user_type} account found with this email"})

    if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        return JSONResponse(status_code=401, content={"success": False, "error": "Invalid password"})

    if user.status == 'inactive':
        return JSONResponse(status_code=401, content={"success": False, "error": "Account is deactivated. Contact administrator."})

    user_info = {
        "_id": str(user.id),
        "username": user.username,
        "email": user.email,
        "userType": user_type,
        "role": user_role
    }

    if user_type == 'teacher':
        user_info.update({
            "employeeId": user.employee_id,
            "department": user.department,
            "name": user.username
        })
        student_record = db.query(Student).filter_by(email=email).first()
        if student_record:
            user_info['hasStudentRecord'] = True
            user_info['studentId'] = student_record.student_id
    elif user_type == 'student':
        student_record = db.query(Student).filter_by(email=email).first()
        if student_record:
            user_info.update({
                "studentId": student_record.student_id,
                "studentName": student_record.student_name,
                "department": student_record.department,
                "hasStudentRecord": True
            })

    token = issue_token(user.id, user.email, user_role)

    return {
        "success": True,
        "message": f"Signed in successfully as {user_type}",
        "user": user_info,
        "userType": user_type,
        "token": token
    }


@auth_router.post('/api/logout')
async def api_logout():
    return {"success": True, "message": "Logged out successfully"}


@auth_router.get('/api/user/profile')
async def get_user_profile(
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    role = current_user["role"]
    model = {"teacher": AuthTeacher, "admin": AuthAdmin}.get(role, AuthUser)
    user = db.query(model).filter_by(email=current_user["email"]).first()

    if not user:
        return JSONResponse(status_code=404, content={"success": False, "error": "User not found"})

    return {"success": True, "user": user.to_dict()}


@auth_router.post('/api/switch-role')
async def switch_user_role(
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher")),
    db: Session = Depends(get_db)
):
    data = await request.json()
    target_type = data.get('targetType')

    if target_type not in ('teacher', 'student'):
        return JSONResponse(status_code=400, content={"success": False, "error": "targetType must be 'teacher' or 'student'"})

    user_email = current_user["email"]
    model = AuthTeacher if target_type == 'teacher' else AuthUser
    target_user = db.query(model).filter_by(email=user_email).first()

    if not target_user:
        return JSONResponse(status_code=404, content={"success": False, "error": f"No {target_type} account found for this email"})

    user_info = {
        "_id": str(target_user.id),
        "username": target_user.username,
        "email": target_user.email,
        "userType": target_type
    }

    if target_type == 'teacher':
        user_info.update({
            "employeeId": target_user.employee_id,
            "department": target_user.department
        })

    token = issue_token(target_user.id, target_user.email, target_type)

    return {
        "success": True,
        "message": f"Switched to {target_type} role",
        "user": user_info,
        "userType": target_type,
        "token": token
    }
