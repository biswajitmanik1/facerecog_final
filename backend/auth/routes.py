import time
import re
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
import bcrypt

from database import get_db
from models import AuthAdmin, AuthTeacher, AuthUser, Student, MasterStudentRoster
from auth_utils import issue_token, require_auth, AuthException

auth_router = APIRouter()


def clean_phone_number(val: str) -> str:
    """Normalize phone number by extracting digits and trimming country codes to 10 digits."""
    if not val:
        return ""
    digits = re.sub(r'\D', '', str(val))
    if len(digits) == 12 and digits.startswith('91'):
        return digits[2:]
    if len(digits) == 11 and digits.startswith('0'):
        return digits[1:]
    if len(digits) > 10:
        return digits[-10:]
    return digits


@auth_router.post('/api/signup')
async def api_signup(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip()
    password = data.get('password')
    phone_number = (
        data.get('phoneNumber') or 
        data.get('phone_number') or 
        data.get('phone') or 
        ''
    ).strip()
    user_type = (data.get('userType') or data.get('role') or 'student').lower().strip()

    if not all([username, email, password, phone_number]):
        return JSONResponse(status_code=400, content={"success": False, "error": "Username, email, phone number, and password are all required"})

    clean_p = clean_phone_number(phone_number)
    if len(clean_p) != 10:
        return JSONResponse(status_code=400, content={"success": False, "error": "A valid 10-digit phone number is required"})

    if user_type == 'admin':
        return JSONResponse(status_code=403, content={"success": False, "error": "Admin accounts cannot be self-registered"})

    if user_type == 'teacher':
        model = AuthTeacher
        employee_id = data.get('employeeId') or data.get('employee_id') or username
        department = data.get('department') or 'General'
        if not employee_id:
            return JSONResponse(status_code=400, content={"success": False, "error": "Employee ID required for teachers"})
    else:
        model = AuthUser

    if db.query(model).filter_by(email=email).first():
        return JSONResponse(status_code=400, content={"success": False, "error": f"Email already registered as {user_type}"})

    # Enforce phone number uniqueness across all accounts
    existing_phone = (
        db.query(AuthUser).filter(or_(AuthUser.phone_number == clean_p, AuthUser.phone_number.ilike(f"%{clean_p}%"))).first() or
        db.query(AuthTeacher).filter(or_(AuthTeacher.phone_number == clean_p, AuthTeacher.phone_number.ilike(f"%{clean_p}%"))).first() or
        db.query(AuthAdmin).filter(or_(AuthAdmin.phone_number == clean_p, AuthAdmin.phone_number.ilike(f"%{clean_p}%"))).first()
    )
    if existing_phone:
        return JSONResponse(status_code=400, content={"success": False, "error": f"Phone number '{phone_number}' is already registered to an account"})

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    if user_type == 'teacher':
        user = AuthTeacher(
            username=username,
            email=email,
            password=hashed_pw,
            employee_id=employee_id,
            department=department,
            phone_number=clean_p,
            role="teacher",
            status="active",
            created_at=time.time(),
        )
    else:
        user = AuthUser(
            username=username,
            email=email,
            password=hashed_pw,
            phone_number=clean_p,
            status="pending_approval",
            created_at=time.time(),
        )

    db.add(user)
    db.commit()

    if user_type == 'student':
        return {
            "success": True, 
            "status": "pending_approval",
            "message": "Student account registered successfully! Your account is pending administrator approval before you can log in."
        }

    return {"success": True, "message": f"{user_type.capitalize()} registered successfully"}


@auth_router.post('/api/signin')
async def api_signin(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    identifier = (
        data.get('email') or 
        data.get('username') or 
        data.get('employeeId') or 
        data.get('phoneNumber') or
        data.get('phone_number') or
        data.get('phone') or
        data.get('identifier') or 
        ''
    ).strip()
    password = data.get('password')
    user_type = (data.get('userType') or data.get('role') or 'student').lower().strip()

    if not all([identifier, password]):
        return JSONResponse(status_code=400, content={"success": False, "error": "Email/Phone/ID and password required"})

    clean_phone = clean_phone_number(identifier)
    has_phone = len(clean_phone) >= 7

    user = None
    user_role = user_type

    if user_type == 'admin':
        user_role = "admin"
        admin_conditions = [
            AuthAdmin.email.ilike(identifier),
            AuthAdmin.username.ilike(identifier),
            AuthAdmin.phone_number == identifier,
        ]
        if has_phone:
            admin_conditions.append(AuthAdmin.phone_number.ilike(f"%{clean_phone}%"))

        user = db.query(AuthAdmin).filter(or_(*admin_conditions)).first()
        if not user and identifier.lower().strip() in ['admin', 'admin123']:
            user = db.query(AuthAdmin).first()

    elif user_type == 'teacher':
        user_role = "teacher"
        teacher_conditions = [
            AuthTeacher.email.ilike(identifier),
            AuthTeacher.username.ilike(identifier),
            AuthTeacher.employee_id.ilike(identifier),
            AuthTeacher.phone_number == identifier,
        ]
        if has_phone:
            teacher_conditions.append(AuthTeacher.phone_number.ilike(f"%{clean_phone}%"))

        user = db.query(AuthTeacher).filter(or_(*teacher_conditions)).first()

        # Fallback auto-heal: check if user registered as student by mistake during signup
        if not user:
            student_user_conditions = [
                AuthUser.email.ilike(identifier),
                AuthUser.username.ilike(identifier),
                AuthUser.phone_number == identifier,
            ]
            if has_phone:
                student_user_conditions.append(AuthUser.phone_number.ilike(f"%{clean_phone}%"))

            student_user = db.query(AuthUser).filter(or_(*student_user_conditions)).first()
            if student_user:
                user = AuthTeacher(
                    username=student_user.username,
                    email=student_user.email,
                    password=student_user.password,
                    employee_id=student_user.username,
                    department="General",
                    phone_number=student_user.phone_number,
                    role="teacher",
                    status="active",
                    created_at=student_user.created_at or time.time(),
                )
                db.add(user)
                db.commit()
                db.refresh(user)

    else:
        user_role = "student"
        student_conditions = [
            AuthUser.email.ilike(identifier),
            AuthUser.username.ilike(identifier),
            AuthUser.phone_number == identifier,
        ]
        if has_phone:
            student_conditions.append(AuthUser.phone_number.ilike(f"%{clean_phone}%"))

        user = db.query(AuthUser).filter(or_(*student_conditions)).first()
        if not user:
            # Also check if student entered student_id (e.g. 002-BCS-2023-113) or phone number in Student profile
            stu_conditions = [
                Student.student_id.ilike(identifier),
                Student.email.ilike(identifier),
                Student.phone_number == identifier,
            ]
            if has_phone:
                stu_conditions.append(Student.phone_number.ilike(f"%{clean_phone}%"))

            stu = db.query(Student).filter(or_(*stu_conditions)).first()
            if stu and stu.email:
                user = db.query(AuthUser).filter(AuthUser.email.ilike(stu.email)).first()
                if user and stu.phone_number and not user.phone_number:
                    user.phone_number = stu.phone_number
                    db.commit()

    # Smart Auto-detection Fallback:
    # If credentials did not match the selected tab, check whether credentials match any other role
    # so users don't get locked out just for selecting the wrong tab!
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        # 1. Check Admin
        admin_conditions = [
            AuthAdmin.email.ilike(identifier),
            AuthAdmin.username.ilike(identifier),
            AuthAdmin.phone_number == identifier,
        ]
        if has_phone:
            admin_conditions.append(AuthAdmin.phone_number.ilike(f"%{clean_phone}%"))
        admin_match = db.query(AuthAdmin).filter(or_(*admin_conditions)).first()
        if not admin_match and identifier.lower().strip() in ['admin', 'admin123']:
            admin_match = db.query(AuthAdmin).first()

        if admin_match and bcrypt.checkpw(password.encode('utf-8'), admin_match.password.encode('utf-8')):
            user = admin_match
            user_role = "admin"
            user_type = "admin"

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        # 2. Check Teacher
        teacher_conditions = [
            AuthTeacher.email.ilike(identifier),
            AuthTeacher.username.ilike(identifier),
            AuthTeacher.employee_id.ilike(identifier),
            AuthTeacher.phone_number == identifier,
        ]
        if has_phone:
            teacher_conditions.append(AuthTeacher.phone_number.ilike(f"%{clean_phone}%"))
        teacher_match = db.query(AuthTeacher).filter(or_(*teacher_conditions)).first()

        if teacher_match and bcrypt.checkpw(password.encode('utf-8'), teacher_match.password.encode('utf-8')):
            user = teacher_match
            user_role = "teacher"
            user_type = "teacher"

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        # 3. Check Student
        student_conditions = [
            AuthUser.email.ilike(identifier),
            AuthUser.username.ilike(identifier),
            AuthUser.phone_number == identifier,
        ]
        if has_phone:
            student_conditions.append(AuthUser.phone_number.ilike(f"%{clean_phone}%"))
        student_match = db.query(AuthUser).filter(or_(*student_conditions)).first()

        if not student_match:
            stu_conditions = [
                Student.student_id.ilike(identifier),
                Student.email.ilike(identifier),
                Student.phone_number == identifier,
            ]
            if has_phone:
                stu_conditions.append(Student.phone_number.ilike(f"%{clean_phone}%"))
            stu = db.query(Student).filter(or_(*stu_conditions)).first()
            if stu and stu.email:
                student_match = db.query(AuthUser).filter(AuthUser.email.ilike(stu.email)).first()

        if student_match and bcrypt.checkpw(password.encode('utf-8'), student_match.password.encode('utf-8')):
            user = student_match
            user_role = "student"
            user_type = "student"

    if not user:
        return JSONResponse(
            status_code=401, 
            content={"success": False, "error": f"No account found matching '{identifier}'"}
        )

    if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        return JSONResponse(status_code=401, content={"success": False, "error": "Invalid password"})

    if getattr(user, 'status', 'active') == 'pending_approval':
        return JSONResponse(
            status_code=403, 
            content={
                "success": False, 
                "status": "pending_approval",
                "error": "Your registration is currently under Administrator review. Once approved by the college admin, you will be able to access your account."
            }
        )

    if getattr(user, 'status', 'active') == 'rejected':
        return JSONResponse(
            status_code=403, 
            content={
                "success": False, 
                "status": "rejected",
                "error": "Your registration request was rejected by the administrator. Please contact your college administration."
            }
        )

    if user.status == 'inactive':
        return JSONResponse(status_code=401, content={"success": False, "error": "Account is deactivated. Contact administrator."})

    user_info = {
        "_id": str(user.id),
        "username": user.username,
        "email": user.email,
        "phoneNumber": getattr(user, 'phone_number', '') or '',
        "userType": user_type,
        "role": user_role
    }

    if user_type == 'teacher':
        user_info.update({
            "employeeId": user.employee_id or user.username,
            "department": user.department or "General",
            "name": user.username
        })
        student_record = db.query(Student).filter_by(email=user.email).first()
        if student_record:
            user_info['hasStudentRecord'] = True
            user_info['studentId'] = student_record.student_id
            if not user_info.get("phoneNumber") and student_record.phone_number:
                user_info["phoneNumber"] = student_record.phone_number
    elif user_type == 'student':
        student_record = db.query(Student).filter(
            (Student.email.ilike(user.email)) |
            (Student.student_id.ilike(user.username))
        ).first()
        if student_record:
            user_info.update({
                "studentId": student_record.student_id,
                "studentName": student_record.student_name,
                "department": student_record.department,
                "year": student_record.year or "",
                "division": student_record.division or "",
                "hasStudentRecord": True
            })
            if not user_info.get("phoneNumber") and student_record.phone_number:
                user_info["phoneNumber"] = student_record.phone_number
        else:
            user_info["hasStudentRecord"] = False
            user_info["studentId"] = user.username
            master_match = db.query(MasterStudentRoster).filter(
                (MasterStudentRoster.roll_number.ilike(user.username)) |
                (MasterStudentRoster.email.ilike(user.email))
            ).first()
            if master_match:
                user_info.update({
                    "studentName": master_match.full_name,
                    "department": master_match.department,
                    "year": master_match.year or "",
                    "division": master_match.division or "",
                })
                if not user_info.get("phoneNumber") and master_match.phone_number:
                    user_info["phoneNumber"] = master_match.phone_number

    user_dept = getattr(user, 'department', None)
    if user_type == 'student' and 'student_record' in locals() and student_record:
        user_dept = student_record.department
    token = issue_token(user.id, user.email, user_role, department=user_dept)

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

    user_dict = user.to_dict()
    if role == "student":
        student_record = db.query(Student).filter(
            (Student.email.ilike(user.email)) |
            (Student.student_id.ilike(user.username))
        ).first()
        if student_record:
            user_dict.update({
                "studentId": student_record.student_id,
                "studentName": student_record.student_name,
                "department": student_record.department,
                "year": student_record.year or "",
                "division": student_record.division or "",
                "hasStudentRecord": True,
            })
            if not user_dict.get("phoneNumber") and student_record.phone_number:
                user_dict["phoneNumber"] = student_record.phone_number
        else:
            user_dict["hasStudentRecord"] = False
            user_dict["studentId"] = user.username
            master_match = db.query(MasterStudentRoster).filter(
                (MasterStudentRoster.roll_number.ilike(user.username)) |
                (MasterStudentRoster.email.ilike(user.email))
            ).first()
            if master_match:
                user_dict.update({
                    "studentName": master_match.full_name,
                    "department": master_match.department,
                    "year": master_match.year or "",
                    "division": master_match.division or "",
                })
                if not user_dict.get("phoneNumber") and master_match.phone_number:
                    user_dict["phoneNumber"] = master_match.phone_number

    return {"success": True, "user": user_dict}


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

    user_dept = getattr(target_user, 'department', None)
    token = issue_token(target_user.id, target_user.email, target_type, department=user_dept)

    return {
        "success": True,
        "message": f"Switched to {target_type} role",
        "user": user_info,
        "userType": target_type,
        "token": token
    }
