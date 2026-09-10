import math
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import get_db
from models import AttendanceRecord, Student, AuthUser
from auth_utils import require_auth

attendance_router = APIRouter()

def _apply_filters(query, model, date=None, department=None, year=None, division=None, subject=None):
    if date and hasattr(model, "date"):
        query = query.filter(model.date == date)
    if department:
        query = query.filter(model.department == department)
    if year:
        query = query.filter(model.year == year)
    if division:
        query = query.filter(model.division == division)
    if subject and hasattr(model, "subject"):
        query = query.filter(model.subject == subject)
    return query


# ------------------------- GET ATTENDANCE -------------------------
@attendance_router.get('/api/attendance')
async def get_attendance(
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    date = request.query_params.get('date')
    department = request.query_params.get('department')
    year = request.query_params.get('year')
    division = request.query_params.get('division')
    subject = request.query_params.get('subject')
    student_id = request.query_params.get('student_id')

    try:
        # Resolve student_id if it's an AuthUser username or email
        actual_student_id = student_id
        student_obj = None
        if student_id:
            student_obj = db.query(Student).filter(
                (Student.student_id == student_id) | (Student.email == student_id)
            ).first()
            if not student_obj:
                au = db.query(AuthUser).filter(
                    (AuthUser.username == student_id) | (AuthUser.email == student_id)
                ).first()
                if au and au.email:
                    student_obj = db.query(Student).filter(Student.email == au.email).first()
            if student_obj:
                actual_student_id = student_obj.student_id

        # If student_id is provided without a specific date (e.g. Student Dashboard),
        # retrieve all attendance records across all sessions for that student over the semester.
        if student_id and not date:
            if not student_obj:
                # Student account exists in auth, but has not completed student registration / face enrollment yet
                return {
                    "success": True,
                    "registered": False,
                    "message": "Student profile not registered yet",
                    "attendance": [],
                    "stats": {
                        "totalStudents": 0,
                        "totalClasses": 0,
                        "presentToday": 0,
                        "absentToday": 0,
                        "attendanceRate": 0.0
                    }
                }

            s_dept = department or student_obj.department
            s_year = year or student_obj.year
            s_div = division or student_obj.division

            sess_query = db.query(AttendanceRecord)
            if s_dept:
                sess_query = sess_query.filter(AttendanceRecord.department == s_dept)
            if s_year:
                sess_query = sess_query.filter(AttendanceRecord.year == s_year)
            if s_div:
                sess_query = sess_query.filter(AttendanceRecord.division == s_div)
            if subject:
                sess_query = sess_query.filter(AttendanceRecord.subject == subject)

            sessions = sess_query.order_by(AttendanceRecord.date.asc()).all()

            attendance_list = []
            present_count = 0
            for sess in sessions:
                found = False
                for entry in (sess.students or []):
                    entry_sid = str(entry.get("student_id") or "")
                    if entry_sid in [str(student_id), str(actual_student_id)]:
                        found = True
                        present = bool(entry.get("present"))
                        if present:
                            present_count += 1
                        attendance_list.append({
                            "studentId": str(actual_student_id or student_id),
                            "studentName": entry.get("student_name") or (student_obj.student_name if student_obj else ""),
                            "date": str(sess.date),
                            "subject": str(sess.subject),
                            "department": str(sess.department),
                            "year": str(sess.year),
                            "division": str(sess.division),
                            "status": "present" if present else "absent",
                            "markedAt": entry.get("marked_at"),
                            "time": entry.get("marked_at") or "—"
                        })
                        break
                if not found:
                    attendance_list.append({
                        "studentId": str(actual_student_id or student_id),
                        "studentName": student_obj.student_name if student_obj else f"Student {student_id}",
                        "date": str(sess.date),
                        "subject": str(sess.subject),
                        "department": str(sess.department),
                        "year": str(sess.year),
                        "division": str(sess.division),
                        "status": "absent",
                        "markedAt": None,
                        "time": "—"
                    })

            total_sessions = len(sessions)
            absent_count = max(0, total_sessions - present_count)
            attendance_rate = round((present_count / total_sessions * 100), 1) if total_sessions > 0 else 0.0

            return {
                "success": True,
                "attendance": attendance_list,
                "stats": {
                    "totalStudents": 1,
                    "totalClasses": total_sessions,
                    "presentToday": present_count,
                    "absentToday": absent_count,
                    "attendanceRate": attendance_rate
                }
            }

        attendance_query = _apply_filters(db.query(AttendanceRecord), AttendanceRecord, date, department, year, division, subject)
        attendance_doc = attendance_query.first()

        roster_query = None
        if department or year or division:
            roster_query = _apply_filters(db.query(Student), Student, department=department, year=year, division=division)
        roster = roster_query.all() if roster_query is not None else []

        session_map = {}
        if attendance_doc:
            for s in (attendance_doc.students or []):
                sid = s.get("student_id")
                session_map[sid] = s

        attendance_list = []
        seen_students = set()

        for student in roster:
            sid = student.student_id
            if not sid or sid in seen_students:
                continue
            seen_students.add(sid)
            if student_id and sid not in [student_id, actual_student_id]:
                continue

            sess = session_map.get(sid, None)
            if sess:
                present = bool(sess.get("present"))
                marked_at = sess.get("marked_at")
            else:
                present = False
                marked_at = None

            attendance_list.append({
                "studentId": str(sid) if sid is not None else "",
                "studentName": student.student_name,
                "date": str(attendance_doc.date) if attendance_doc else str(date),
                "subject": str(attendance_doc.subject) if attendance_doc else str(subject),
                "department": str(attendance_doc.department) if attendance_doc else str(department),
                "year": str(attendance_doc.year) if attendance_doc else str(year),
                "division": str(attendance_doc.division) if attendance_doc else str(division),
                "status": "present" if present else "absent",
                "markedAt": marked_at
            })

        # Also include any session-only students not in roster (fallback)
        if attendance_doc:
            for s in (attendance_doc.students or []):
                sid = s.get("student_id")
                if sid in seen_students:
                    continue
                if student_id and sid not in [student_id, actual_student_id]:
                    continue
                seen_students.add(sid)
                marked = s.get("marked_at")

                attendance_list.append({
                    "studentId": str(sid) if sid is not None else "",
                    "studentName": s.get("student_name"),
                    "date": str(attendance_doc.date),
                    "subject": str(attendance_doc.subject),
                    "department": str(attendance_doc.department),
                    "year": str(attendance_doc.year),
                    "division": str(attendance_doc.division),
                    "status": "present" if s.get("present") else "absent",
                    "markedAt": marked
                })

        total_students = roster_query.count() if roster_query is not None else 0
        present_count = sum(1 for r in attendance_list if r.get("status") == "present")
        absent_count = max(total_students - present_count, 0)
        attendance_rate = round((present_count / total_students * 100) if total_students > 0 else 0, 1)

        return {
            "success": True,
            "attendance": attendance_list,
            "stats": {
                "totalStudents": total_students,
                "presentToday": present_count,
                "absentToday": absent_count,
                "attendanceRate": attendance_rate
            }
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# ------------------------- EXPORT TO EXCEL -------------------------
@attendance_router.get('/api/attendance/export')
async def export_attendance(
    request: Request,
    current_user: dict = Depends(require_auth("student", "teacher", "admin")),
    db: Session = Depends(get_db)
):
    date = request.query_params.get('date')
    department = request.query_params.get('department')
    year = request.query_params.get('year')
    division = request.query_params.get('division')
    subject = request.query_params.get('subject')

    try:
        attendance_query = _apply_filters(db.query(AttendanceRecord), AttendanceRecord, date, department, year, division, subject)
        attendance_doc = attendance_query.first()
        present_students = set()

        if attendance_doc:
            for student in (attendance_doc.students or []):
                present_students.add(student.get("student_id"))

        student_query = _apply_filters(db.query(Student), Student, department=department, year=year, division=division)
        students = student_query.all()
        export_data = []

        for student in students:
            sid = student.student_id
            name = student.student_name
            status = "present" if sid in present_students else "absent"
            export_data.append({
                "studentId": str(sid) if sid is not None else "",
                "name": name,
                "subject": str(subject) if subject else "N/A",
                "date": str(date) if date else "N/A",
                "status": status
            })

        return {"success": True, "data": export_data}

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


# ------------------------- DEFAULTER LIST GENERATOR (< 75%) -------------------------
@attendance_router.get('/api/attendance/defaulters')
async def get_defaulter_list(
    request: Request,
    current_user: dict = Depends(require_auth("teacher", "admin")),
    db: Session = Depends(get_db)
):
    """
    Computes cumulative attendance across sessions within the selected filters
    (department, year, division, subject, date range), determines shortfall against
    the threshold (default 75%), calculates recovery targets (classes needed),
    and categorizes student risk levels (critical < 50%, warning < threshold, safe).
    """
    department = request.query_params.get('department')
    year = request.query_params.get('year')
    division = request.query_params.get('division')
    subject = request.query_params.get('subject')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    month = request.query_params.get('month')
    threshold_param = request.query_params.get('threshold')

    try:
        threshold_val = float(threshold_param) if threshold_param else 75.0
        if threshold_val <= 0 or threshold_val > 100:
            threshold_val = 75.0
    except ValueError:
        threshold_val = 75.0

    try:
        # 1. Query matching AttendanceRecord sessions
        session_query = db.query(AttendanceRecord)
        if department:
            session_query = session_query.filter(AttendanceRecord.department == department)
        if year:
            session_query = session_query.filter(AttendanceRecord.year == year)
        if division:
            session_query = session_query.filter(AttendanceRecord.division == division)
        if subject:
            session_query = session_query.filter(AttendanceRecord.subject == subject)
        if month:
            session_query = session_query.filter(AttendanceRecord.date.like(f"{month}%"))
        if start_date:
            session_query = session_query.filter(AttendanceRecord.date >= start_date)
        if end_date:
            session_query = session_query.filter(AttendanceRecord.date <= end_date)

        sessions = session_query.order_by(AttendanceRecord.date.asc()).all()
        total_sessions = len(sessions)

        # 2. Query Student roster for matching department / year / division
        student_query = db.query(Student)
        if department:
            student_query = student_query.filter(Student.department == department)
        if year:
            student_query = student_query.filter(Student.year == year)
        if division:
            student_query = student_query.filter(Student.division == division)

        roster = student_query.order_by(Student.student_id.asc()).all()

        # 3. Map students and attendance counts
        student_map = {}
        for s in roster:
            sid = str(s.student_id) if s.student_id is not None else ""
            if not sid:
                continue
            student_map[sid] = {
                "studentId": sid,
                "studentName": s.student_name,
                "department": s.department or department or "",
                "year": s.year or year or "",
                "division": s.division or division or "",
                "email": s.email or "",
                "phone": s.phone_number or "",
                "attended": 0,
            }

        # 4. Tally attendances from sessions
        for session in sessions:
            for entry in (session.students or []):
                sid = str(entry.get("student_id") or "")
                if not sid:
                    continue
                if sid not in student_map:
                    student_map[sid] = {
                        "studentId": sid,
                        "studentName": entry.get("student_name") or f"Student {sid}",
                        "department": session.department or department or "",
                        "year": session.year or year or "",
                        "division": session.division or division or "",
                        "email": "",
                        "phone": "",
                        "attended": 0,
                    }
                if entry.get("present"):
                    student_map[sid]["attended"] += 1

        # 5. Compute percentages, recovery classes, and risk status
        students_list = []
        defaulters_list = []
        total_attendance_rate_sum = 0.0

        for sid, data in student_map.items():
            attended = data["attended"]
            t = total_sessions
            if t > 0:
                pct = round((attended / t) * 100.0, 1)
                absent = max(0, t - attended)
            else:
                pct = 0.0
                absent = 0

            total_attendance_rate_sum += pct

            # Recovery classes required to reach threshold:
            # (attended + x) / (t + x) >= threshold_val / 100
            # x >= (threshold_val * t - 100 * attended) / (100 - threshold_val)
            classes_needed = 0
            if pct < threshold_val and threshold_val < 100.0 and t > 0:
                req = (threshold_val * t - 100.0 * attended) / (100.0 - threshold_val)
                classes_needed = max(0, math.ceil(req))

            # Status classification
            if t == 0:
                status = "safe"
                risk_label = "No Sessions Held"
            elif pct < 50.0:
                status = "critical"
                risk_label = "Critical Deficit (<50%)"
            elif pct < threshold_val:
                status = "warning"
                risk_label = f"Defaulter (<{threshold_val}%)"
            else:
                status = "safe"
                risk_label = "Eligible / Above Threshold"

            is_defaulter = (pct < threshold_val) and (t > 0)

            record = {
                "studentId": data["studentId"],
                "studentName": data["studentName"],
                "department": data["department"],
                "year": data["year"],
                "division": data["division"],
                "email": data["email"],
                "phone": data["phone"],
                "totalSessions": t,
                "attended": attended,
                "absent": absent,
                "percentage": pct,
                "isDefaulter": is_defaulter,
                "classesNeeded": classes_needed,
                "status": status,
                "riskLabel": risk_label
            }

            students_list.append(record)
            if is_defaulter:
                defaulters_list.append(record)

        # Sort defaulters by lowest percentage first (most urgent at top)
        defaulters_list.sort(key=lambda x: (x["percentage"], x["studentId"]))
        # Sort full class list by percentage ascending as well
        students_list.sort(key=lambda x: (x["percentage"], x["studentId"]))

        total_count = len(students_list)
        defaulter_count = len(defaulters_list)
        critical_count = sum(1 for s in defaulters_list if s["status"] == "critical")
        safe_count = total_count - defaulter_count
        avg_attendance = round(total_attendance_rate_sum / total_count, 1) if total_count > 0 else 0.0

        return {
            "success": True,
            "metadata": {
                "department": department or "All Departments",
                "year": year or "All Years",
                "division": division or "All Divisions",
                "subject": subject or "All Subjects (Composite)",
                "threshold": threshold_val,
                "totalSessions": total_sessions,
                "generatedAt": datetime.now().strftime("%d-%b-%Y %H:%M:%S"),
            },
            "stats": {
                "totalStudents": total_count,
                "defaulterCount": defaulter_count,
                "criticalCount": critical_count,
                "safeCount": safe_count,
                "defaulterRate": round((defaulter_count / total_count * 100), 1) if total_count > 0 else 0.0,
                "averageAttendance": avg_attendance,
                "totalSessions": total_sessions
            },
            "defaulters": defaulters_list,
            "allStudents": students_list
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

