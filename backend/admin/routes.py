import io
import time
import re
import pandas as pd

from fastapi import APIRouter, Depends, Request, UploadFile, File
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
import bcrypt

from database import get_db
from models import AttendanceRecord, AuthTeacher, AuthUser, Student, MasterStudentRoster
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
    phone_number = (data.get('phoneNumber') or data.get('phone_number') or data.get('phone') or '').strip()

    if not all([username, email, password, employee_id, phone_number]):
        return JSONResponse(status_code=400, content={"success": False, "error": "Full name, email, password, employee ID, and phone number are all required"})

    clean_p = re.sub(r'\D', '', str(phone_number))
    if len(clean_p) == 12 and clean_p.startswith('91'):
        clean_p = clean_p[2:]
    elif len(clean_p) == 11 and clean_p.startswith('0'):
        clean_p = clean_p[1:]
    elif len(clean_p) > 10:
        clean_p = clean_p[-10:]

    if len(clean_p) != 10:
        return JSONResponse(status_code=400, content={"success": False, "error": "A valid 10-digit phone number is required"})

    if db.query(AuthTeacher).filter_by(email=email).first():
        return JSONResponse(status_code=400, content={"success": False, "error": "Email already registered as teacher"})

    teacher = AuthTeacher(
        username=username,
        email=email,
        password=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
        employee_id=employee_id,
        department=department,
        phone_number=clean_p,
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
    teacher = db.query(AuthTeacher).filter(AuthTeacher.id == teacher_id).first()
    if not teacher:
        return JSONResponse(status_code=404, content={"success": False, "error": "Teacher not found"})

    if data.get('email') and data.get('email').strip().lower() != teacher.email.lower():
        new_email = data['email'].strip()
        existing = db.query(AuthTeacher).filter(
            AuthTeacher.email.ilike(new_email),
            AuthTeacher.id != teacher.id
        ).first()
        if existing:
            return JSONResponse(status_code=400, content={"success": False, "error": f"Email '{new_email}' is already registered to another teacher"})
        teacher.email = new_email

    if 'username' in data and data['username'].strip():
        teacher.username = data['username'].strip()
    if 'employeeId' in data or 'employee_id' in data:
        teacher.employee_id = (data.get('employeeId') or data.get('employee_id') or '').strip()
    if 'department' in data:
        teacher.department = (data.get('department') or '').strip()
    if 'phoneNumber' in data or 'phone_number' in data or 'phone' in data:
        raw_phone = (data.get('phoneNumber') or data.get('phone_number') or data.get('phone') or '').strip()
        if raw_phone:
            clean_p = re.sub(r'\D', '', str(raw_phone))
            if len(clean_p) == 12 and clean_p.startswith('91'):
                clean_p = clean_p[2:]
            elif len(clean_p) == 11 and clean_p.startswith('0'):
                clean_p = clean_p[1:]
            elif len(clean_p) > 10:
                clean_p = clean_p[-10:]
            if len(clean_p) != 10:
                return JSONResponse(status_code=400, content={"success": False, "error": "Phone number must be exactly 10 digits"})
            teacher.phone_number = clean_p
        else:
            teacher.phone_number = None
    if data.get('status') in ('active', 'inactive'):
        teacher.status = data['status']
    if data.get('password') and data['password'].strip():
        teacher.password = bcrypt.hashpw(data['password'].strip().encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

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


# ============================================================================
# STUDENT REGISTRATION APPROVALS (admin only)
# ============================================================================

@admin_router.get('/pending-count')
async def get_pending_count(
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Returns count of students waiting for admin approval."""
    stu_pending = db.query(Student).filter(Student.status == "pending_approval").count()
    user_pending = db.query(AuthUser).filter(AuthUser.status == "pending_approval").count()
    stu_emails = {s.email for s in db.query(Student.email).filter(Student.status == "pending_approval").all() if s.email}
    user_emails = {u.email for u in db.query(AuthUser.email).filter(AuthUser.status == "pending_approval").all() if u.email}
    total_unique = len(stu_emails.union(user_emails)) or max(stu_pending, user_pending)
    
    return {
        "success": True,
        "pendingCount": total_unique,
        "totalStudents": db.query(Student).count()
    }


@admin_router.get('/approvals/students')
@admin_router.get('/students')
async def list_students(
    status: str = None,
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """List students with status filter (all, pending_approval, active, rejected)."""
    q = db.query(Student)
    if status and status.lower() != 'all':
        q = q.filter(Student.status == status.lower())
    students = q.order_by(Student.created_at.desc()).all()

    auth_users = db.query(AuthUser).all()
    registered_emails = {s.email.lower() for s in db.query(Student.email).all() if s.email}

    result = []
    for s in students:
        s_dict = s.to_dict(include_embeddings=False)
        s_dict['hasAuthAccount'] = True
        s_dict['hasFaceProfile'] = bool(s.face_registered)
        result.append(s_dict)

    for u in auth_users:
        if u.email and u.email.lower() not in registered_emails:
            if not status or status.lower() == 'all' or u.status == status.lower():
                result.append({
                    "_id": f"auth_{u.id}",
                    "studentId": u.username,
                    "studentName": u.username,
                    "department": "Pending Enrollment",
                    "year": "N/A",
                    "division": "N/A",
                    "semester": "N/A",
                    "email": u.email,
                    "phoneNumber": u.phone_number or '',
                    "status": u.status or 'pending_approval',
                    "face_registered": False,
                    "hasAuthAccount": True,
                    "hasFaceProfile": False,
                    "created_at": u.created_at,
                })

    master_records = db.query(MasterStudentRoster).all()
    roster_by_roll = {r.roll_number.strip().lower(): r for r in master_records if r.roll_number}
    roster_by_email = {r.email.strip().lower(): r for r in master_records if r.email}

    for item in result:
        sid = (item.get("studentId") or "").strip().lower()
        sem = (item.get("email") or "").strip().lower()
        matched = roster_by_roll.get(sid) or (roster_by_email.get(sem) if sem else None)
        if matched:
            item["rosterMatched"] = True
            item["rosterRecord"] = {
                "rollNumber": matched.roll_number,
                "fullName": matched.full_name,
                "department": matched.department,
                "year": matched.year or '',
                "division": matched.division or '',
                "email": matched.email or '',
                "phoneNumber": matched.phone_number or ''
            }
        else:
            item["rosterMatched"] = False
            item["rosterRecord"] = None

    return {
        "success": True,
        "students": result,
        "count": len(result),
        "rosterTotal": len(master_records)
    }


@admin_router.post('/approve-student/{identifier}')
async def approve_student(
    identifier: str,
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Approve a student account and activate their status."""
    student = None
    auth_user = None

    if identifier.startswith("auth_"):
        try:
            auth_id = int(identifier.replace("auth_", ""))
            auth_user = db.query(AuthUser).filter_by(id=auth_id).first()
        except:
            pass

    if not auth_user:
        auth_user = db.query(AuthUser).filter(
            (AuthUser.email == identifier) | (AuthUser.username == identifier)
        ).first()

    student = db.query(Student).filter(
        (Student.email == identifier) | (Student.student_id == identifier)
    ).first()

    if not student and not auth_user:
        return JSONResponse(status_code=404, content={"success": False, "error": f"No student found matching '{identifier}'"})

    if student:
        student.status = "active"
        if not auth_user and student.email:
            auth_user = db.query(AuthUser).filter_by(email=student.email).first()

    if auth_user:
        auth_user.status = "active"
        if not student and auth_user.email:
            student = db.query(Student).filter_by(email=auth_user.email).first()
            if student:
                student.status = "active"

    db.commit()
    target_name = (student.student_name if student else None) or (auth_user.username if auth_user else identifier)
    return {
        "success": True,
        "message": f"Student '{target_name}' approved successfully! Account is now active."
    }


@admin_router.post('/reject-student/{identifier}')
async def reject_student(
    identifier: str,
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Reject a student account."""
    student = None
    auth_user = None

    if identifier.startswith("auth_"):
        try:
            auth_id = int(identifier.replace("auth_", ""))
            auth_user = db.query(AuthUser).filter_by(id=auth_id).first()
        except:
            pass

    if not auth_user:
        auth_user = db.query(AuthUser).filter(
            (AuthUser.email == identifier) | (AuthUser.username == identifier)
        ).first()

    student = db.query(Student).filter(
        (Student.email == identifier) | (Student.student_id == identifier)
    ).first()

    if not student and not auth_user:
        return JSONResponse(status_code=404, content={"success": False, "error": f"No student found matching '{identifier}'"})

    if student:
        student.status = "rejected"
        if not auth_user and student.email:
            auth_user = db.query(AuthUser).filter_by(email=student.email).first()

    if auth_user:
        auth_user.status = "rejected"

    db.commit()
    target_name = (student.student_name if student else None) or (auth_user.username if auth_user else identifier)
    return {
        "success": True,
        "message": f"Student '{target_name}' registration rejected."
    }


@admin_router.post('/approve-all-students')
async def approve_all_students(
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Bulk approve all pending student registrations."""
    pending_students = db.query(Student).filter(Student.status == "pending_approval").all()
    for s in pending_students:
        s.status = "active"

    pending_users = db.query(AuthUser).filter(AuthUser.status == "pending_approval").all()
    for u in pending_users:
        u.status = "active"

    total = len(pending_students) + len(pending_users)
    db.commit()
    return {
        "success": True,
        "message": f"Successfully approved {total} pending student registration(s)."
    }


# ============================================================================
# MASTER STUDENT ROSTER (Official College Admitted Student Records)
# ============================================================================

@admin_router.post('/roster/upload')
async def upload_master_roster(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Upload official college student roster via CSV or Excel (.xlsx/.xls)."""
    filename = (file.filename or '').lower()
    if not (filename.endswith('.csv') or filename.endswith('.xlsx') or filename.endswith('.xls')):
        return JSONResponse(status_code=400, content={"success": False, "error": "Only .csv, .xlsx, or .xls files are supported"})

    try:
        content = await file.read()
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content), dtype=str)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str)
    except Exception as e:
        return JSONResponse(status_code=400, content={"success": False, "error": f"Failed to parse file: {str(e)}"})

    if df.empty:
        return JSONResponse(status_code=400, content={"success": False, "error": "Uploaded file is empty"})

    # Flexible column mapping (case-insensitive, normalized)
    col_map = {}
    for col in df.columns:
        norm = re.sub(r'[^a-z0-9]', '', str(col).lower())
        if any(k in norm for k in ['roll', 'studentid', 'registration', 'regno', 'enrollment', 'enroll']):
            col_map['roll_number'] = col
        elif any(k in norm for k in ['name', 'fullname', 'studentname']) and 'dept' not in norm:
            col_map['full_name'] = col
        elif any(k in norm for k in ['dept', 'department', 'branch', 'course', 'stream']):
            col_map['department'] = col
        elif any(k in norm for k in ['year', 'classyear', 'academicyear']):
            col_map['year'] = col
        elif any(k in norm for k in ['div', 'division', 'section', 'sec']):
            col_map['division'] = col
        elif any(k in norm for k in ['email', 'mail']):
            col_map['email'] = col
        elif any(k in norm for k in ['phone', 'mobile', 'contact', 'cell']):
            col_map['phone_number'] = col

    if 'roll_number' not in col_map or 'full_name' not in col_map:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "Could not find required columns. Please ensure your sheet has 'Roll Number' (or 'Student ID') and 'Full Name'."
            }
        )

    dept_col = col_map.get('department')
    year_col = col_map.get('year')
    div_col = col_map.get('division')
    email_col = col_map.get('email')
    phone_col = col_map.get('phone_number')

    inserted = 0
    updated = 0

    for _, row in df.iterrows():
        roll = str(row.get(col_map['roll_number']) or '').strip()
        name = str(row.get(col_map['full_name']) or '').strip()
        if not roll or roll.lower() == 'nan' or not name or name.lower() == 'nan':
            continue

        dept = str(row.get(dept_col) or 'General').strip() if dept_col else 'General'
        if dept.lower() == 'nan':
            dept = 'General'

        yr = str(row.get(year_col) or '').strip() if year_col else ''
        if yr.lower() == 'nan': yr = ''

        div = str(row.get(div_col) or '').strip() if div_col else ''
        if div.lower() == 'nan': div = ''

        em = str(row.get(email_col) or '').strip().lower() if email_col else ''
        if em.lower() == 'nan': em = ''

        ph = str(row.get(phone_col) or '').strip() if phone_col else ''
        if ph.lower() == 'nan': ph = ''
        if ph:
            digits = re.sub(r'\D', '', ph)
            if len(digits) == 12 and digits.startswith('91'):
                digits = digits[2:]
            elif len(digits) == 11 and digits.startswith('0'):
                digits = digits[1:]
            elif len(digits) > 10:
                digits = digits[-10:]
            ph = digits if len(digits) == 10 else ''

        existing = db.query(MasterStudentRoster).filter(
            MasterStudentRoster.roll_number.ilike(roll)
        ).first()

        if existing:
            existing.full_name = name
            existing.department = dept
            if yr: existing.year = yr
            if div: existing.division = div
            if em: existing.email = em
            if ph: existing.phone_number = ph
            updated += 1
        else:
            new_r = MasterStudentRoster(
                roll_number=roll,
                full_name=name,
                department=dept,
                year=yr,
                division=div,
                email=em,
                phone_number=ph,
                created_at=time.time()
            )
            db.add(new_r)
            inserted += 1

    db.commit()
    total = inserted + updated
    return {
        "success": True,
        "message": f"Master Roster uploaded successfully! {inserted} added, {updated} updated.",
        "stats": {
            "totalProcessed": total,
            "inserted": inserted,
            "updated": updated
        }
    }


@admin_router.get('/roster/summary')
async def get_roster_summary(
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Returns statistics of current Master Student Roster."""
    total = db.query(MasterStudentRoster).count()
    depts = [d[0] for d in db.query(MasterStudentRoster.department).distinct().all() if d[0]]
    return {
        "success": True,
        "total": total,
        "departments": depts,
        "hasRoster": total > 0
    }


@admin_router.get('/roster/template')
async def download_roster_template(
    format: str = "xlsx",
    current_user: dict = Depends(require_auth("admin"))
):
    """Generate sample Excel or CSV template for Master Roster."""
    xlsx_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sample_master_student_roster.xlsx")
    if (format == "xlsx" or format == "excel") and os.path.exists(xlsx_path):
        from fastapi.responses import FileResponse
        return FileResponse(
            xlsx_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="master_student_roster_sample.xlsx"
        )

    csv_content = "Roll_Number,Full_Name,Department,Year,Division,Email,Phone_Number\n" \
                  "006-BCA-2023-264,Rahul Sharma,Computer Applications,2nd Year,B,rahul.sharma@college.com,9823457895\n" \
                  "002-BCS-2023-113,Biswajit Manik,Computer Science,4th Year,A,manikbiswajit303@gmail.com,9832752658\n" \
                  "015-BIT-2023-089,Aarav Patel,Information Technology,3rd Year,A,aarav.patel@college.com,9876543210\n" \
                  "021-ECE-2023-044,Sneha Mukherjee,Electronics,2nd Year,C,sneha.m@college.com,9811223344\n"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=master_student_roster_sample.csv"}
    )


@admin_router.post('/roster/clear')
async def clear_master_roster(
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Clear all records from Master Student Roster."""
    count = db.query(MasterStudentRoster).delete()
    db.commit()
    return {
        "success": True,
        "message": f"Master Roster cleared. {count} records removed."
    }


@admin_router.post('/auto-approve-verified')
async def auto_approve_verified_students(
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Auto-approve only pending registrations that have a verified match in MasterStudentRoster."""
    master_records = db.query(MasterStudentRoster).all()
    roster_rolls = {r.roll_number.strip().lower() for r in master_records if r.roll_number}
    roster_emails = {r.email.strip().lower() for r in master_records if r.email}

    approved_count = 0
    approved_names = []

    # 1. Pending Students
    pending_students = db.query(Student).filter(Student.status == "pending_approval").all()
    for s in pending_students:
        sid = (s.student_id or '').strip().lower()
        sem = (s.email or '').strip().lower()
        if sid in roster_rolls or (sem and sem in roster_emails):
            s.status = "active"
            approved_count += 1
            approved_names.append(s.student_name)
            # sync AuthUser
            if s.email:
                u = db.query(AuthUser).filter_by(email=s.email).first()
                if u: u.status = "active"

    # 2. Pending AuthUsers
    pending_users = db.query(AuthUser).filter(AuthUser.status == "pending_approval").all()
    for u in pending_users:
        uid = (u.username or '').strip().lower()
        uem = (u.email or '').strip().lower()
        if uid in roster_rolls or (uem and uem in roster_emails):
            if u.status != "active":
                u.status = "active"
                approved_count += 1
                approved_names.append(u.username)
                if u.email:
                    s = db.query(Student).filter_by(email=u.email).first()
                    if s: s.status = "active"

    db.commit()
    return {
        "success": True,
        "approvedCount": approved_count,
        "approvedStudents": approved_names,
        "message": f"Successfully auto-approved {approved_count} student(s) verified against College Master Roster."
    }

