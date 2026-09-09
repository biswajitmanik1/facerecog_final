import os

# Every project path is resolved against this file's own directory so the app
# behaves the same no matter which folder it is launched from.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

haarcasecade_path = os.path.join(BASE_DIR, "haarcascade_frontalface_default.xml")
trainimagelabel_path = os.path.join(BASE_DIR, "TrainingImageLabel", "Trainner.yml")
trainimage_path = os.path.join(BASE_DIR, "TrainingImage")
attendance_path = os.path.join(BASE_DIR, "Attendance")
icon_path = os.path.join(BASE_DIR, "AMS.ico")

for _folder in (
    trainimage_path,
    os.path.dirname(trainimagelabel_path),
    attendance_path,
):
    os.makedirs(_folder, exist_ok=True)
