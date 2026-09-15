<div align="center">

# 🎓 Smart Attendance System

### AI-Powered Face Recognition Attendance for Modern Classrooms

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

> Automate classroom attendance using real-time face recognition.
> Students enroll their face once — teachers just open a webcam session.

<br/>

![Smart Attendance Banner](https://img.shields.io/badge/MTCNN%20+%20DeepFace%20Facenet512-Face%20Recognition%20Engine-orange?style=flat-square)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Face Recognition** | MTCNN face detection + DeepFace Facenet512 (512D embeddings) |
| 📷 **5-Angle Enrollment** | Students register 5 face photos for robust multi-pose matching |
| ⚡ **Real-Time Attendance** | Teachers scan the classroom live via webcam — attendance marks instantly |
| 🛡️ **Role-Based Access** | Separate dashboards for Students, Teachers, and Admins |
| 📊 **Rich Analytics** | Heatmap calendar, subject-wise breakdown, monthly trends, defaulter list |
| 📋 **Master Roster Upload** | Admin uploads CSV/XLSX student roster for auto-fill at signup |
| 🔐 **JWT Authentication** | Secure token-based auth with bcrypt password hashing |
| 🚫 **Duplicate Prevention** | Blocks face re-registration and duplicate attendance marking |

---

## 🏗️ Architecture

```
Browser (React + Vite — localhost:3000)
        │  HTTP REST / JSON + JWT
        ▼
FastAPI Server (localhost:5000)
  ├── auth.routes              → /api/signup  /api/signin
  ├── student.registration     → /api/student/*
  ├── student.view_attendance  → /api/attendance
  ├── teacher.attendance_records → /api/attendance/session/*
  ├── admin.routes             → /api/admin/*
  └── ModelManager (Singleton)
        ├── MTCNN   — face detection
        └── DeepFace Facenet512 — 512D embedding
              │  SQLAlchemy ORM
              ▼
        PostgreSQL (facefast database)
          ├── auth_users / auth_teachers / auth_admins
          ├── students  (embeddings stored as JSONB)
          ├── attendance_records
          └── master_student_roster
```

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.10+
- **Node.js** 18+
- **PostgreSQL** 15+ (create a database named `facefast`)
- GPU optional but recommended for faster face recognition

---

### 1. Clone the Repository

```bash
git clone https://github.com/biswajitmanik1/facerecog_final.git
cd facerecog_final
```

---

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` folder:

```env
DB_URL=postgresql://your_user:your_password@localhost:5432/facefast
SECRET_KEY=your-secret-key-here
THRESHOLD=0.6
```

Create the first admin account (one-time setup):

```bash
python create_admin.py
```

Start the FastAPI server:

```bash
python app.py
# Runs on http://localhost:5000
# First start takes 30–60s (model initialization)
```

Verify models are ready:

```
GET http://localhost:5000/health
→ { "status": "healthy", "models_ready": true }
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

---

### 4. Production Build

```bash
cd frontend
npm run build
# Output in frontend/dist/
```

---

## 👤 User Roles

### 🎓 Student
1. Sign up with email + 10-digit phone
2. Complete profile registration (auto-filled from master roster)
3. Enroll face — 5 photos at different angles (front, left, right, up, down)
4. View personal attendance dashboard with heatmap, subject stats, history, monthly trends

### 👩‍🏫 Teacher
1. Sign up with Employee ID + department
2. Start a live attendance session (select subject, year, division)
3. Point webcam at classroom — students are auto-recognized and marked present
4. End session to finalize; absentees are automatically recorded

### 🛡️ Admin
1. Created via CLI only (`python create_admin.py`) — cannot self-register
2. Upload master student roster (CSV or XLSX)
3. Create and manage teacher accounts
4. Review and approve student registrations
5. View institution-wide reports and export defaulter lists

---

## 🤖 Face Recognition Pipeline

```
ENROLLMENT (once per student)
  5 Photos → MTCNN crop → Facenet512 → 5 × [512 floats] → PostgreSQL JSONB

ATTENDANCE (every webcam frame)
  Live Frame → MTCNN crop → Facenet512 → [512 floats]
                                              │
                           Cosine distance vs avg(stored embeddings)
                           distance < 0.60  →  ✅ MATCH  → Mark Present
```

| Parameter | Value |
|---|---|
| Embedding Model | DeepFace Facenet512 |
| Embedding Size | 512 float32 values per photo |
| Face Detector | MTCNN (confidence > 0.85) |
| Match Threshold | Cosine distance < 0.60 (configurable via env) |
| Angles Enrolled | 5 (front, left, right, up, down) |
| Duplicate Guard | Cosine distance < 0.40 blocks re-registration |
| Embedding Cache | 10-minute in-memory TTL per session filter |

---

## 📁 Project Structure

```
facerecog_final/
├── backend/
│   ├── app.py                         # FastAPI entry point + ModelManager singleton
│   ├── models.py                      # SQLAlchemy ORM models (7 tables)
│   ├── database.py                    # PostgreSQL engine + session
│   ├── auth_utils.py                  # JWT issue / verify helpers
│   ├── create_admin.py                # CLI admin account creator
│   ├── auth/routes.py                 # Signup, signin, logout, /me
│   ├── admin/routes.py                # Teacher CRUD, student approvals, reports, roster
│   ├── student/
│   │   ├── registration.py            # Face enrollment endpoint
│   │   ├── updatedetails.py           # Profile update
│   │   ├── view_attendance.py         # Attendance fetch & defaulter list
│   │   └── demo_session.py            # Face recognition demo mode
│   └── teacher/
│       └── attendance_records.py      # Live session + real-time face recognition
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # React Router v6 route definitions
│   │   ├── lib/api.js                 # API helper with JWT injection
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx      # Student dashboard (5 tabs, donut chart, heatmap)
│   │   │   ├── SignInPage.jsx
│   │   │   ├── SignUpPage.jsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── ManageTeachers.jsx
│   │   │   │   ├── StudentApprovals.jsx
│   │   │   │   └── InstitutionReports.jsx
│   │   │   ├── student/
│   │   │   │   ├── StudentRegistrationForm.jsx
│   │   │   │   ├── UpdateStudentDetails.jsx
│   │   │   │   ├── ViewAttendance.jsx
│   │   │   │   └── DemoSession.jsx
│   │   │   └── teacher/
│   │   │       ├── TeacherDashboard.jsx
│   │   │       ├── StartSession.jsx
│   │   │       └── TeacherUpdateDetails.jsx
│   │   └── components/
│   │       ├── AttendanceHeatmap.jsx   # GitHub-style calendar heatmap
│   │       ├── MultiCameraCapture.jsx  # 5-angle face capture UI
│   │       └── CameraCapture.jsx
│   └── public/
│       ├── sample_master_student_roster.csv
│       └── sample_master_student_roster.xlsx
│
└── README.md
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup` | Register student or teacher |
| `POST` | `/api/signin` | Login → returns JWT token |
| `GET` | `/api/me` | Get current user profile |
| `GET` | `/health` | Server + model health check |

### Student
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/register-student` | Enroll profile + 5 face embeddings |
| `GET` | `/api/attendance` | Fetch own attendance records |
| `POST` | `/api/student/demo/start` | Start demo recognition session |

### Teacher
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/attendance/create_session` | Start a new attendance session |
| `POST` | `/api/attendance/real-mark` | Submit webcam frame → recognize + mark present |
| `POST` | `/api/attendance/end_session` | Finalize session |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/admin/teachers` | List / create teacher accounts |
| `GET` | `/api/admin/students` | List all student registrations |
| `POST` | `/api/admin/roster/upload` | Upload CSV/XLSX master roster |
| `GET` | `/api/admin/reports` | Institution-wide attendance reports |

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_URL` | — | PostgreSQL connection string |
| `SECRET_KEY` | — | JWT signing secret (keep private!) |
| `THRESHOLD` | `0.6` | Face match cosine distance threshold (0.0 – 1.0) |

---

## 🔒 Security

- Passwords hashed with **bcrypt** (auto-generated salt per user)
- All protected routes require a valid **JWT Bearer token**
- Admin accounts can **only be created via CLI** — no web self-registration
- Phone numbers enforced as **10 digits**, unique across all account types
- Teachers are **department-isolated** — cannot access other departments' data
- Duplicate face check prevents **same face from registering under multiple IDs**
- Face match threshold configurable without code changes (env var)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v6 |
| Icons | Lucide React |
| Backend Framework | FastAPI |
| ORM | SQLAlchemy |
| ASGI Server | Uvicorn |
| Auth | bcrypt + JWT |
| Face Detector | MTCNN |
| Face Embedder | DeepFace (Facenet512) |
| Similarity Metric | SciPy Cosine Distance |
| Database | PostgreSQL |
| Image Processing | Pillow + NumPy |
| Excel / CSV | pandas + openpyxl |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ by [Biswajit Manik](https://github.com/biswajitmanik1)

⭐ Star this repo if you found it useful!

</div>
