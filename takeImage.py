import json
import os

import cv2
import numpy as np
from PIL import Image

_detector = None

METADATA_FILENAME = "_meta.json"

# MTCNN detection is the expensive step (~180ms/frame at 640x480 on CPU,
# ~5-6fps ceiling) -- running it on every webcam frame at full size is what
# makes the capture window feel laggy. Detecting on a half-size copy roughly
# halves that cost; the box is then scaled back up so the crop we actually
# save still comes from the full-resolution frame.
DETECTION_SCALE = 0.5
# Skip most frames entirely so cv2.imshow can keep refreshing at a smooth
# rate between detection attempts, instead of the whole loop being paced by
# MTCNN's ~100-200ms cost.
DETECT_EVERY_N_FRAMES = 3
CAPTURE_WIDTH, CAPTURE_HEIGHT = 640, 480


def _get_detector():
    """MTCNN loads its weights on first use, so it's created lazily and reused."""
    global _detector
    if _detector is None:
        from mtcnn import MTCNN
        _detector = MTCNN()
    return _detector


def _detect_face(frame_bgr, detection_scale=DETECTION_SCALE):
    small = cv2.resize(frame_bgr, None, fx=detection_scale, fy=detection_scale, interpolation=cv2.INTER_LINEAR)
    small_rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
    for d in _get_detector().detect_faces(small_rgb):
        if d["confidence"] > 0.9:
            x, y, w, h = d["box"]
            x, y = max(0, x), max(0, y)
            if w > 50 and h > 50:
                inv = 1.0 / detection_scale
                fx, fy, fw, fh = int(x * inv), int(y * inv), int(w * inv), int(h * inv)
                full_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                return full_rgb[fy:fy + fh, fx:fx + fw]
    return None


# take Image of user
def TakeImage(
    l1,
    l2,
    haarcasecade_path,
    trainimage_path,
    message,
    err_screen,
    text_to_speech,
    department="",
    year="",
    division="",
    semester="",
    email="",
    target_count=5,
):
    """Capture `target_count` clear face crops via webcam and stage them on
    disk under trainimage_path for TrainImage to turn into DeepFace
    embeddings. haarcasecade_path is kept in the signature for compatibility
    with existing callers (attendance.py, register_ctk.py) but is no longer
    used -- detection now uses MTCNN, matching the web app's face pipeline.

    department/year/division/semester/email mirror the fields the web app's
    registration form collects (see backend/models.py Student); they are
    optional here and get written alongside the captured images so
    TrainImage can carry them into the shared students row.
    """
    def missing(t):
        message.configure(text=t)
        text_to_speech(t)
        err_screen()

    if (l1 == "") and (l2 == ""):
        missing("Please enter your enrollment number and name.")
        return
    elif l1 == "":
        missing("Please enter your enrollment number.")
        return
    elif l2 == "":
        missing("Please enter your name.")
        return

    Enrollment = l1
    Name = l2
    email = email.strip()

    from db_shared import SessionLocal, Student

    session = SessionLocal()
    try:
        if session.query(Student).filter_by(student_id=Enrollment).first():
            t = "Enrollment number " + Enrollment + " is already registered."
            message.configure(text=t)
            text_to_speech(t)
            return
        if email and session.query(Student).filter_by(email=email).first():
            t = "Email " + email + " is already registered to another student."
            message.configure(text=t)
            text_to_speech(t)
            return
    finally:
        session.close()

    directory = Enrollment + "_" + Name
    path = os.path.join(trainimage_path, directory)
    os.makedirs(path, exist_ok=True)

    with open(os.path.join(path, METADATA_FILENAME), "w", encoding="utf-8") as f:
        json.dump(
            {
                "student_id": Enrollment,
                "student_name": Name,
                "department": department.strip() or None,
                "year": year.strip() or None,
                "division": division.strip() or None,
                "semester": semester.strip() or None,
                "email": email or None,
            },
            f,
        )

    cam = cv2.VideoCapture(0)
    cam.set(cv2.CAP_PROP_FRAME_WIDTH, CAPTURE_WIDTH)
    cam.set(cv2.CAP_PROP_FRAME_HEIGHT, CAPTURE_HEIGHT)
    saved = 0
    frame_idx = 0
    try:
        while saved < target_count:
            ret, frame = cam.read()
            if not ret:
                break

            # Detection is the slow part -- only attempt it on every Nth
            # frame so the preview itself keeps refreshing smoothly in
            # between instead of stalling on MTCNN each time.
            frame_idx += 1
            if frame_idx % DETECT_EVERY_N_FRAMES == 0:
                face_rgb = _detect_face(frame)
                if face_rgb is not None:
                    saved += 1
                    Image.fromarray(face_rgb).save(
                        os.path.join(path, f"{Name}_{Enrollment}_{saved}.jpg")
                    )
                    cv2.putText(frame, "Face captured", (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(frame, f"Captured {saved}/{target_count}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
            cv2.imshow("Register - press q to cancel", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cam.release()
        cv2.destroyAllWindows()

    if saved < target_count:
        res = f"Only captured {saved}/{target_count} images -- try again before training."
    else:
        res = f"Captured {saved} images for ER No:{Enrollment} Name:{Name}. Now click Train Image."
    message.configure(text=res)
    text_to_speech(res)
