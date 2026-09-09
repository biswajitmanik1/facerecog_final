"""Admin-only institution-wide attendance report for the desktop app.

Mirrors the web app's /admin/reports page: aggregate present/absent counts
across every AttendanceRecord, grouped by department -- regardless of which
app (web or desktop) took the attendance, since both write to the same
attendance_records table.
"""
import ui_kit as ui
import ui_shell


def show_institution_report(parent):
    from db_shared import AttendanceRecord, SessionLocal

    session = SessionLocal()
    try:
        records = session.query(AttendanceRecord).all()

        by_department = {}
        for record in records:
            dept = record.department or "Unspecified"
            bucket = by_department.setdefault(dept, {"sessions": 0, "present": 0, "absent": 0})
            bucket["sessions"] += 1
            for entry in (record.students or []):
                if entry.get("present"):
                    bucket["present"] += 1
                else:
                    bucket["absent"] += 1
    finally:
        session.close()

    rows = [["Department", "Sessions", "Present", "Absent"]]
    for dept in sorted(by_department):
        stats = by_department[dept]
        rows.append([dept, stats["sessions"], stats["present"], stats["absent"]])

    if len(rows) == 1:
        rows.append(["No attendance sessions recorded yet.", "", "", ""])

    return ui_shell.table_window(parent, "Institution Attendance Report", rows, accent=ui.PURPLE)
