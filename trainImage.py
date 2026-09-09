import json
import os
import shutil

import numpy as np
from PIL import Image

from takeImage import METADATA_FILENAME


def _extract_embedding(face_rgb):
    try:
        from deepface import DeepFace
        face_pil = Image.fromarray(face_rgb.astype("uint8")).resize((160, 160))
        rep = DeepFace.represent(
            np.array(face_pil), model_name="Facenet512", detector_backend="skip", enforce_detection=False
        )
        return np.array(rep[0]["embedding"], dtype=float)
    except Exception as e:
        print("Embedding error:", e)
        return None


# Train Image
def TrainImage(haarcasecade_path, trainimage_path, trainimagelabel_path, message, text_to_speech):
    """Turn the face crops TakeImage staged on disk into DeepFace embeddings
    and upsert them into the shared `students` table -- along with
    department/year/division/semester/email if TakeImage recorded them in
    the folder's _meta.json. haarcasecade_path and trainimagelabel_path are
    kept in the signature for compatibility with existing callers
    (attendance.py, register_ctk.py) but are no longer used -- embeddings
    replace the local LBPH model, and Postgres replaces the local .yml file
    as the store of record.
    """
    from db_shared import SessionLocal, Student

    if not os.path.isdir(trainimage_path):
        res = "No captured faces found, please take images first"
        message.configure(text=res)
        text_to_speech(res)
        return

    folders = [
        d for d in os.listdir(trainimage_path)
        if os.path.isdir(os.path.join(trainimage_path, d))
    ]
    if not folders:
        res = "No captured faces found, please take images first"
        message.configure(text=res)
        text_to_speech(res)
        return

    session = SessionLocal()
    trained = 0
    try:
        for folder in folders:
            folder_path = os.path.join(trainimage_path, folder)
            meta_path = os.path.join(folder_path, METADATA_FILENAME)

            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                enrollment = meta.get("student_id")
                name = meta.get("student_name")
            elif "_" in folder:
                enrollment, name = folder.split("_", 1)
                meta = {}
            else:
                continue

            if not enrollment or not name:
                continue

            image_files = [fn for fn in os.listdir(folder_path) if fn != METADATA_FILENAME]
            embeddings = []
            for fname in image_files:
                # `with` closes the file handle immediately after decoding,
                # instead of leaving it open until garbage collection -- on
                # Windows a still-open handle can make the cleanup below
                # silently fail, leaving these exact photos to be re-trained
                # on the next click.
                with Image.open(os.path.join(folder_path, fname)) as raw:
                    emb = _extract_embedding(np.array(raw.convert("RGB")))
                if emb is not None:
                    embeddings.append(emb.tolist())

            if not embeddings:
                continue

            student = session.query(Student).filter_by(student_id=enrollment).first()
            if student:
                student.student_name = name
                student.embeddings = embeddings
                student.face_registered = True
                # only overwrite when TakeImage actually collected a value,
                # so re-training doesn't blank out fields set some other way
                if meta.get("department"):
                    student.department = meta["department"]
                if meta.get("year"):
                    student.year = meta["year"]
                if meta.get("division"):
                    student.division = meta["division"]
                if meta.get("semester"):
                    student.semester = meta["semester"]
                if meta.get("email"):
                    student.email = meta["email"]
            else:
                student = Student(
                    student_id=enrollment,
                    student_name=name,
                    department=meta.get("department"),
                    year=meta.get("year"),
                    division=meta.get("division"),
                    semester=meta.get("semester"),
                    email=meta.get("email"),
                    embeddings=embeddings,
                    face_registered=True,
                )
                session.add(student)
            session.commit()
            trained += 1

            # Delete every staged file explicitly, not just the folder --
            # this is what actually guarantees these exact photos can't get
            # re-embedded and re-saved on the next click. rmtree alone can
            # silently no-op if the directory handle itself is momentarily
            # locked (e.g. antivirus scanning a just-written file) even once
            # the files inside are gone.
            for fname in image_files:
                try:
                    os.remove(os.path.join(folder_path, fname))
                except OSError:
                    pass
            if os.path.exists(meta_path):
                try:
                    os.remove(meta_path)
                except OSError:
                    pass
            shutil.rmtree(folder_path, ignore_errors=True)
    except Exception as e:
        session.rollback()
        res = f"Training failed: {e}"
        message.configure(text=res)
        text_to_speech(res)
        return
    finally:
        session.close()

    if trained == 0:
        res = "No registered faces found, please register a student first"
    else:
        res = f"Trained and saved {trained} student(s) to the shared database"
    message.configure(text=res)
    text_to_speech(res)
