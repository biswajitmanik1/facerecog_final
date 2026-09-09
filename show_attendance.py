import traceback

import ui_kit as ui
import ui_shell


def subjectchoose(text_to_speech, parent=None):
    def calculate_attendance():
        Subject = read_subject()
        if Subject == "":
            t = "Please enter the subject name."
            message.configure(text=t)
            text_to_speech(t)
            return

        from db_shared import AttendanceRecord, SessionLocal

        session = SessionLocal()
        try:
            records = session.query(AttendanceRecord).filter_by(subject=Subject).all()
            if not records:
                t = "No attendance sheets found for " + Subject + "."
                message.configure(text=t)
                text_to_speech(t)
                return

            # student_id -> {"name": str, "present": int}
            totals = {}
            for record in records:
                for s in (record.students or []):
                    sid = s.get("student_id")
                    if not sid:
                        continue
                    entry = totals.setdefault(sid, {"name": s.get("student_name"), "present": 0})
                    if s.get("present"):
                        entry["present"] += 1

            session_count = len(records)
            rows = [["Enrollment", "Name", "Attendance"]]
            for sid, data in totals.items():
                pct = round(data["present"] / session_count * 100) if session_count else 0
                rows.append([sid, data["name"], f"{pct}%"])

            ui_shell.table_window(win, "Attendance of " + Subject, rows, accent=ui.PURPLE)
            message.configure(text=f"{len(totals)} students across {session_count} session(s).")
        except Exception:
            traceback.print_exc()
            t = "Could not read the attendance records for " + Subject + "."
            message.configure(text=t)
            text_to_speech(t)
        finally:
            session.close()

    def open_folder():
        message.configure(text="Attendance is stored in the shared database now.")

    win, read_subject, message, _extra = ui_shell.subject_screen(
        parent,
        title="View Attendance",
        subtitle="Enter the subject to see its records",
        icon="bars",
        accent=ui.PURPLE,
        accent_dark=ui.PURPLE_DARK,
        action_label="View Records",
        action_icon="bars",
        on_action=calculate_attendance,
        on_open_folder=open_folder,
    )
    return win
