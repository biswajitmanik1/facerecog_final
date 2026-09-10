import time
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from database import get_db
from models import Student, AuthTeacher
from auth_utils import require_auth

student_update_router = APIRouter()


def parse_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def get_teacher_department(current_user: dict, db: Session) -> Optional[str]:
    dept = current_user.get("department")
    if not dept and current_user.get("role") == "teacher":
        teacher = db.query(AuthTeacher).filter_by(email=current_user.get("email")).first()
        if teacher:
            dept = teacher.department
    return dept


# ============================================================================
# STUDENT ROUTES (Students can only update their own records)
# ============================================================================

@student_update_router.get('/api/students')
async def get_students(
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Get students for the logged-in user (only meaningful for the student role)"""
    try:
        user_email = current_user["email"]
        user_type = current_user["role"]

        if user_type == 'student':
            query = db.query(Student).filter_by(email=user_email)

            department = request.query_params.get('department', '')
            year = request.query_params.get('year', '')
            search = request.query_params.get('search', '')

            if department:
                query = query.filter(Student.department == department)
            if year:
                query = query.filter(Student.year == year)
            if search:
                like = f"%{search}%"
                query = query.filter(or_(
                    Student.student_name.ilike(like),
                    Student.student_id.ilike(like)
                ))

            students = [s.to_dict() for s in query.order_by(Student.student_name.asc()).all()]

            return {
                "success": True,
                "students": students,
                "count": len(students),
                "authorized_email": user_email,
                "user_type": user_type
            }
        else:
            return JSONResponse(status_code=400, content={
                "success": False,
                "error": "Teachers/admins should use /api/admin/students endpoint"
            })

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.get('/api/students/{student_id}')
async def get_student(
    student_id: str,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Get specific student (students may only view their own record)"""
    try:
        user_email = current_user["email"]
        user_type = current_user["role"]

        db_id = parse_id(student_id)
        student = db.query(Student).get(db_id) if db_id is not None else None
        if not student:
            return JSONResponse(status_code=404, content={"success": False, "error": "Student not found"})

        if user_type == 'student' and student.email != user_email:
            return JSONResponse(status_code=403, content={
                "success": False,
                "error": "Unauthorized: You can only view your own student record"
            })

        if user_type == 'teacher':
            teacher_dept = get_teacher_department(current_user, db)
            if teacher_dept and student.department and student.department.strip().lower() != teacher_dept.strip().lower():
                return JSONResponse(status_code=403, content={
                    "success": False,
                    "error": f"Unauthorized: Student belongs to {student.department}. You can only view {teacher_dept} students."
                })

        return {"success": True, "student": student.to_dict()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.put('/api/students/{student_id}')
async def update_student(
    student_id: str,
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Update student (students may only update their own record, teachers only their department)"""
    data = await request.json()

    try:
        user_email = current_user["email"]
        user_type = current_user["role"]
        is_staff = user_type in ("teacher", "admin")

        db_id = parse_id(student_id)
        student = db.query(Student).get(db_id) if db_id is not None else None
        if not student:
            return JSONResponse(status_code=404, content={"success": False, "error": "Student not found"})

        if user_type == 'student':
            if student.email != user_email:
                return JSONResponse(status_code=403, content={
                    "success": False,
                    "error": "Unauthorized: You can only update your own student record"
                })

            if data.get('email') and data.get('email') != student.email:
                return JSONResponse(status_code=400, content={
                    "success": False,
                    "error": "Email cannot be changed for security reasons. Contact administrator."
                })

        elif is_staff:
            if user_type == 'teacher':
                teacher_dept = get_teacher_department(current_user, db)
                if teacher_dept:
                    if student.department and student.department.strip().lower() != teacher_dept.strip().lower():
                        return JSONResponse(status_code=403, content={
                            "success": False,
                            "error": f"Unauthorized: Student belongs to {student.department}. You can only modify {teacher_dept} students."
                        })
                    new_dept = data.get('department')
                    if new_dept and new_dept.strip().lower() != teacher_dept.strip().lower():
                        return JSONResponse(status_code=403, content={
                            "success": False,
                            "error": f"Unauthorized: Teachers cannot change a student's department to {new_dept}."
                        })
            if data.get('email') and data.get('email') != student.email:
                existing = db.query(Student).filter(
                    Student.email == data.get('email'),
                    Student.id != student.id
                ).first()
                if existing:
                    return JSONResponse(status_code=400, content={"success": False, "error": "Email already registered"})

        if data.get('studentId') and data.get('studentId') != student.student_id:
            existing = db.query(Student).filter(
                Student.student_id == data.get('studentId'),
                Student.id != student.id
            ).first()
            if existing:
                return JSONResponse(status_code=400, content={"success": False, "error": "Student ID already exists"})

        student.student_name = data.get("studentName", student.student_name)
        student.student_id = data.get("studentId", student.student_id)
        student.department = data.get("department", student.department)
        student.year = data.get("year", student.year)
        student.division = data.get("division", student.division)
        student.semester = data.get("semester", student.semester)
        student.phone_number = data.get("phoneNumber", student.phone_number)
        student.updated_at = time.time()
        student.updated_by = user_email
        student.updated_by_type = user_type

        if is_staff:
            student.email = data.get("email", student.email)

        db.commit()

        message = "Student details updated successfully"
        if user_type == 'student':
            message = "Your student details updated successfully"
        return {"success": True, "message": message}

    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.delete('/api/students/{student_id}')
async def delete_student(
    student_id: str,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Delete student (students may only delete their own record)"""
    try:
        user_email = current_user["email"]
        user_type = current_user["role"]

        db_id = parse_id(student_id)
        student = db.query(Student).get(db_id) if db_id is not None else None
        if not student:
            return JSONResponse(status_code=404, content={"success": False, "error": "Student not found"})

        if user_type == 'student' and student.email != user_email:
            return JSONResponse(status_code=403, content={
                "success": False,
                "error": "Unauthorized: You can only delete your own student record"
            })

        if user_type == 'teacher':
            return JSONResponse(status_code=403, content={
                "success": False,
                "error": "Unauthorized: Teachers are not permitted to delete student records. Contact an administrator."
            })

        name = student.student_name
        db.delete(student)
        db.commit()

        message = f"Student {name} deleted successfully"
        if user_type == 'student':
            message = f"Your student record ({name}) deleted successfully"

        return {"success": True, "message": message}

    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.put('/api/update-student/{student_id}')
async def update_student_alt(
    student_id: str,
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Alternative route for frontend compatibility"""
    return await update_student(student_id, request, current_user, db)


@student_update_router.delete('/api/delete-student/{student_id}')
async def delete_student_alt(
    student_id: str,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Alternative route for frontend compatibility"""
    return await delete_student(student_id, current_user, db)


# ============================================================================
# TEACHER/ADMIN ROUTES (Teachers and admins can access all students)
# ============================================================================

@student_update_router.get('/api/admin/students')
async def get_all_students_admin(
    request: Request,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Teacher/admin route to view all students with filtering"""
    try:
        user_role = current_user.get("role")
        department = request.query_params.get('department', '')
        year = request.query_params.get('year', '')
        division = request.query_params.get('division', '')
        student_id = request.query_params.get('studentId', '')
        search = request.query_params.get('search', '')

        query = db.query(Student)

        # Department scoping: teachers only see students from their own department
        if user_role == "teacher":
            teacher_dept = get_teacher_department(current_user, db)
            if teacher_dept:
                query = query.filter(Student.department == teacher_dept)
        elif department:
            query = query.filter(Student.department == department)

        if year:
            query = query.filter(Student.year == year)
        if division:
            query = query.filter(Student.division == division)
        if student_id:
            query = query.filter(Student.student_id.ilike(f"%{student_id}%"))
        if search:
            like = f"%{search}%"
            query = query.filter(or_(
                Student.student_name.ilike(like),
                Student.student_id.ilike(like),
                Student.email.ilike(like)
            ))

        students = [s.to_dict() for s in query.order_by(Student.student_name.asc()).all()]

        return {
            "success": True,
            "students": students,
            "count": len(students),
            "admin_view": True,
            "user_type": current_user["role"]
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.get('/api/teacher/students/search')
async def search_students_teacher(
    request: Request,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Advanced search for teachers/admins with department scoping"""
    try:
        user_role = current_user.get("role")
        student_id = request.query_params.get('studentId', '').strip()
        student_name = request.query_params.get('studentName', '').strip()
        department = request.query_params.get('department', '').strip()
        year = request.query_params.get('year', '').strip()
        division = request.query_params.get('division', '').strip()

        query = db.query(Student)
        applied_filters = {}

        if student_id:
            query = query.filter(Student.student_id.ilike(f"%{student_id}%"))
            applied_filters['studentId'] = student_id
        if student_name:
            query = query.filter(Student.student_name.ilike(f"%{student_name}%"))
            applied_filters['studentName'] = student_name

        # Department scoping: Teachers can only search in their own department
        if user_role == "teacher":
            teacher_dept = get_teacher_department(current_user, db)
            if teacher_dept:
                query = query.filter(Student.department == teacher_dept)
                applied_filters['department'] = teacher_dept
        elif department:
            query = query.filter(Student.department == department)
            applied_filters['department'] = department

        if year:
            query = query.filter(Student.year == year)
            applied_filters['year'] = year
        if division:
            query = query.filter(Student.division == division)
            applied_filters['division'] = division

        students = [s.to_dict() for s in query.order_by(Student.student_name.asc()).limit(50).all()]

        return {
            "success": True,
            "students": students,
            "count": len(students),
            "query": applied_filters
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.get('/api/teacher/student/{student_id_or_db_id}')
async def get_student_by_id_teacher(
    student_id_or_db_id: str,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Teacher/admin route to get any student by Student ID or database id"""
    try:
        student = db.query(Student).filter_by(student_id=student_id_or_db_id).first()

        if not student:
            db_id = parse_id(student_id_or_db_id)
            if db_id is not None:
                student = db.query(Student).get(db_id)

        if not student:
            return JSONResponse(status_code=404, content={"success": False, "error": f"Student with ID '{student_id_or_db_id}' not found"})

        if current_user.get("role") == "teacher":
            teacher_dept = get_teacher_department(current_user, db)
            if teacher_dept and student.department and student.department.strip().lower() != teacher_dept.strip().lower():
                return JSONResponse(status_code=403, content={
                    "success": False,
                    "error": f"Unauthorized: Student belongs to {student.department}. You can only view {teacher_dept} students."
                })

        return {"success": True, "student": student.to_dict()}

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.put('/api/teacher/student/{student_db_id}')
async def update_student_teacher(
    student_db_id: str,
    request: Request,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Teacher/admin route to update student with department scoping"""
    data = await request.json()

    try:
        db_id = parse_id(student_db_id)
        student = db.query(Student).get(db_id) if db_id is not None else None
        if not student:
            return JSONResponse(status_code=404, content={"success": False, "error": "Student not found"})

        if current_user.get("role") == "teacher":
            teacher_dept = get_teacher_department(current_user, db)
            if teacher_dept:
                if student.department and student.department.strip().lower() != teacher_dept.strip().lower():
                    return JSONResponse(status_code=403, content={
                        "success": False,
                        "error": f"Unauthorized: Student belongs to {student.department}. You can only modify {teacher_dept} students."
                    })
                new_dept = data.get("department")
                if new_dept and new_dept.strip().lower() != teacher_dept.strip().lower():
                    return JSONResponse(status_code=403, content={
                        "success": False,
                        "error": f"Unauthorized: Teachers cannot change a student's department to {new_dept}."
                    })

        if data.get('studentId') and data.get('studentId') != student.student_id:
            existing = db.query(Student).filter(
                Student.student_id == data.get('studentId'),
                Student.id != student.id
            ).first()
            if existing:
                return JSONResponse(status_code=400, content={"success": False, "error": "Student ID already exists"})

        if data.get('email') and data.get('email') != student.email:
            existing = db.query(Student).filter(
                Student.email == data.get('email'),
                Student.id != student.id
            ).first()
            if existing:
                return JSONResponse(status_code=400, content={"success": False, "error": "Email already registered"})

        student.student_name = data.get("studentName", student.student_name)
        student.student_id = data.get("studentId", student.student_id)
        student.department = data.get("department", student.department)
        student.year = data.get("year", student.year)
        student.division = data.get("division", student.division)
        student.semester = data.get("semester", student.semester)
        student.email = data.get("email", student.email)
        student.phone_number = data.get("phoneNumber", student.phone_number)
        student.updated_at = time.time()
        student.updated_by = current_user["email"]
        student.updated_by_type = current_user["role"]

        db.commit()

        return {
            "success": True,
            "message": f"Student {data.get('studentName', 'record')} updated successfully"
        }

    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.delete('/api/teacher/student/{student_db_id}')
async def delete_student_teacher(
    student_db_id: str,
    current_user: dict = Depends(require_auth("admin")),
    db: Session = Depends(get_db)
):
    """Admin-only route to delete any student by database id"""
    try:
        db_id = parse_id(student_db_id)
        student = db.query(Student).get(db_id) if db_id is not None else None
        if not student:
            return JSONResponse(status_code=404, content={"success": False, "error": "Student not found"})

        name = student.student_name
        db.delete(student)
        db.commit()

        return {
            "success": True,
            "message": f"Student {name} deleted successfully"
        }

    except Exception as e:
        db.rollback()
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# ============================================================================
# UTILITY ROUTES
# ============================================================================

@student_update_router.get('/api/students/search')
async def search_students(
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    """General search students by various criteria"""
    try:
        user_type = current_user["role"]
        user_email = current_user["email"]

        search_term = request.query_params.get('q', '')
        department = request.query_params.get('department', '')
        year = request.query_params.get('year', '')
        limit = int(request.query_params.get('limit', 10))

        if not search_term and not department and not year:
            return JSONResponse(status_code=400, content={"success": False, "error": "Search term or filters required"})

        query = db.query(Student)

        if user_type == 'student':
            query = query.filter(Student.email == user_email)

        if search_term:
            like = f"%{search_term}%"
            query = query.filter(or_(
                Student.student_name.ilike(like),
                Student.student_id.ilike(like),
                Student.email.ilike(like)
            ))

        if department:
            query = query.filter(Student.department == department)
        if year:
            query = query.filter(Student.year == year)

        students = [s.to_dict() for s in query.order_by(Student.student_name.asc()).limit(limit).all()]

        return {
            "success": True,
            "students": students,
            "count": len(students),
            "search_term": search_term,
            "user_type": user_type
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@student_update_router.get('/api/students/stats')
async def get_student_stats(
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """Get student statistics (teacher/admin only)"""
    try:
        total_students = db.query(Student).count()

        dept_rows = (
            db.query(Student.department, func.count(Student.id))
            .group_by(Student.department)
            .order_by(func.count(Student.id).desc())
            .all()
        )
        dept_stats = [{"_id": d, "count": c} for d, c in dept_rows]

        year_rows = (
            db.query(Student.year, func.count(Student.id))
            .group_by(Student.year)
            .order_by(Student.year.asc())
            .all()
        )
        year_stats = [{"_id": y, "count": c} for y, c in year_rows]

        face_registered = db.query(Student).filter(Student.embeddings.isnot(None)).count()

        return {
            "success": True,
            "stats": {
                "total_students": total_students,
                "face_registered": face_registered,
                "by_department": dept_stats,
                "by_year": year_stats
            }
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})
