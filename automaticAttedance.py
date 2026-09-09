import datetime
import time
import traceback

import cv2
import numpy as np
from PIL import Image
from scipy.spatial.distance import cosine

import ui_kit as ui
import ui_shell

_detector = None

# MTCNN detection is the expensive step (~180ms/frame at 640x480 on CPU,
# ~5-6fps ceiling) -- running it on every webcam frame at full size is what
# makes this window feel laggy. Detecting on a half-size copy roughly halves
# that cost, and only attempting detection on every Nth frame lets
# cv2.imshow keep refreshing smoothly in between instead of the whole loop
# being paced by MTCNN.
DETECTION_SCALE = 0.5
DETECT_EVERY_N_FRAMES = 3
CAPTURE_WIDTH, CAPTURE_HEIGHT = 640, 480


def _get_detector():
    global _detector
    if _detector is None:
        from mtcnn import MTCNN
        _detector = MTCNN()
    return _detector


def _detect_faces(frame_bgr, detection_scale=DETECTION_SCALE):
    small = cv2.resize(frame_bgr, None, fx=detection_scale, fy=detection_scale, interpolation=cv2.INTER_LINEAR)
    small_rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
    faces = []
    inv = 1.0 / detection_scale
    for d in _get_detector().detect_faces(small_rgb):
        if d["confidence"] > 0.85:
            x, y, w, h = d["box"]
            x, y = max(0, x), max(0, y)
            if w > 40 and h > 40:
                fx, fy, fw, fh = int(x * inv), int(y * inv), int(w * inv), int(h * inv)
                full_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                faces.append({"box": (fx, fy, fw, fh), "face": full_rgb[fy:fy + fh, fx:fx + fw]})
    return faces


def _extract_embedding(face_rgb):
    try:
        from deepface import DeepFace
        face_pil = Image.fromarray(face_rgb.astype("uint8")).resize((160, 160))
        rep = DeepFace.represent(
            np.array(face_pil), model_name="Facenet512", detector_backend="skip", enforce_detection=False
        )
        return np.array(rep[0]["embedding"], dtype=np.float32)
    except Exception as e:
        print("Embedding error:", e)
        return None


# for choose subject and fill attendance
def subjectChoose(text_to_speech, parent=None):
    def FillAttendance():
        sub = read_subject()
        department = extra["Department"]().strip()
        year = extra["Year"]().strip()
        division = extra["Division"]().strip()

        if sub == "":
            t = "Please enter the subject name!!!"
            message.configure(text=t)
            text_to_speech(t)
            return

        from db_shared import AttendanceRecord, SessionLocal, Student

        session = SessionLocal()
        try:
            # Scoping to a class (like the web app's create_session) builds an
            # explicit roster, so absentees get recorded too and this session
            # is discoverable from the web dashboard's filtered attendance
            # view. Left blank, it falls back to the original behaviour: an
            # ad-hoc scan against every registered student, present-only.
            roster_clauses = []
            if department:
                roster_clauses.append(Student.department == department)
            if year:
                roster_clauses.append(Student.year == year)
            if division:
                roster_clauses.append(Student.division == division)

            roster = session.query(Student).filter(*roster_clauses).all() if roster_clauses else []
            candidates = roster if roster_clauses else session.query(Student).filter(Student.embeddings.isnot(None)).all()
            candidates = [s for s in candidates if s.embeddings]

            if not candidates:
                e = "No registered students found for this class, please register students first"
                message.configure(text=e)
                text_to_speech(e)
                return

            threshold = 0.6
            recognized = {}  # student_id -> student_name

            # Average each student's stored embeddings once up front instead
            # of redoing it for every detected face on every processed frame
            # -- that recomputation was pure waste since the roster doesn't
            # change during this session.
            student_avgs = []
            for student in candidates:
                stored = student.embeddings
                if not stored:
                    continue
                avg = np.mean(stored, axis=0) if isinstance(stored[0], list) else np.array(stored)
                student_avgs.append((student, avg))

            cam = cv2.VideoCapture(0)
            cam.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH)
            cam.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT)
            font = cv2.FONT_HERSHEY_SIMPLEX
            future = time.time() + 20
            frame_idx = 0
            try:
                while time.time() < future and len(recognized) < len(student_avgs):
                    ret, im = cam.read()
                    if not ret:
                        break

                    # Detection+matching is the slow part -- only attempt it
                    # on every Nth frame so the preview itself keeps
                    # refreshing smoothly in between.
                    frame_idx += 1
                    if frame_idx % DETECT_EVERY_N_FRAMES == 0:
                        for f in _detect_faces(im):
                            emb = _extract_embedding(f["face"])
                            if emb is None:
                                continue

                            best, min_d = None, float("inf")
                            for student, avg in student_avgs:
                                d_ = cosine(emb, avg)
                                if d_ < min_d:
                                    min_d, best = d_, student

                            x, y, w, h = f["box"]
                            if best is not None and min_d < threshold:
                                recognized[best.student_id] = best.student_name
                                cv2.rectangle(im, (x, y), (x + w, y + h), (0, 255, 0), 3)
                                cv2.putText(im, best.student_name, (x, y - 10), font, 0.8, (0, 255, 0), 2)
                            else:
                                cv2.rectangle(im, (x, y), (x + w, y + h), (0, 0, 255), 3)
                                cv2.putText(im, "Unknown", (x, y - 10), font, 0.8, (0, 0, 255), 2)

                    cv2.imshow("Filling Attendance...", im)
                    if cv2.waitKey(30) & 0xFF == 27:
                        break
            finally:
                cam.release()
                cv2.destroyAllWindows()

            date = datetime.datetime.now().strftime("%Y-%m-%d")
            record_filter = dict(subject=sub, date=date, department=department or None, year=year or None, division=division or None)
            record = session.query(AttendanceRecord).filter_by(**record_filter).first()
            if not record:
                record = AttendanceRecord(created_at=datetime.datetime.now(), students=[], **record_filter)
                session.add(record)
                session.flush()

            by_id = {s.get("student_id"): s for s in (record.students or [])}
            now_iso = datetime.datetime.now().isoformat()
            for sid, sname in recognized.items():
                by_id[sid] = {"student_id": sid, "student_name": sname, "present": True, "marked_at": now_iso}

            # Explicitly record absentees for a scoped roster -- mirrors the
            # web app's end_session, so this session shows a complete
            # present/absent picture instead of only "who showed up".
            for student in roster:
                if student.student_id not in by_id:
                    by_id[student.student_id] = {
                        "student_id": student.student_id,
                        "student_name": student.student_name,
                        "present": False,
                        "marked_at": None,
                    }

            record.students = list(by_id.values())
            session.commit()

            rows = [["Enrollment", "Name"]] + [[sid, sname] for sid, sname in recognized.items()]
            m = f"Attendance filled for {sub}: {len(recognized)} student(s) marked present"
            message.configure(text=m)
            text_to_speech(m)
            ui_shell.table_window(win, "Attendance of " + sub, rows, accent=ui.TEAL)

        except Exception:
            traceback.print_exc()
            session.rollback()
            f = "No face found for attendance"
            message.configure(text=f)
            text_to_speech(f)
            cv2.destroyAllWindows()
        finally:
            session.close()

    def open_folder():
        message.configure(text="Attendance is stored in the shared database now.")

    win, read_subject, message, extra = ui_shell.subject_screen(
        parent,
        title="Take Attendance",
        subtitle="Enter the subject, then look at the camera",
        icon="camera",
        accent=ui.TEAL,
        accent_dark=ui.TEAL_DARK,
        action_label="Fill Attendance",
        action_icon="camera",
        on_action=FillAttendance,
        on_open_folder=open_folder,
        extra_fields=[
            ("Department", ui_shell.DEPARTMENTS),
            ("Year", ui_shell.YEARS),
            ("Division", ui_shell.DIVISIONS),
        ],
    )
    return win
