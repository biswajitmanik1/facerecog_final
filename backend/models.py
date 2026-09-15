import time
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from database import Base

class AuthUser(Base):
    __tablename__ = "auth_users"

    id = Column(Integer, primary_key=True)
    username = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    phone_number = Column(String(30), nullable=True)
    status = Column(String(20), default="active")
    created_at = Column(Float, default=time.time)

    def to_dict(self, include_password=False):
        d = {
            "_id": str(self.id),
            "username": self.username,
            "email": self.email,
            "phoneNumber": self.phone_number,
            "phone_number": self.phone_number,
            "status": self.status,
            "created_at": self.created_at,
        }
        if include_password:
            d["password"] = self.password
        return d


class AuthTeacher(Base):
    __tablename__ = "auth_teachers"

    id = Column(Integer, primary_key=True)
    username = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    employee_id = Column(String(100))
    department = Column(String(100))
    phone_number = Column(String(30), nullable=True)
    role = Column(String(20), default="teacher")
    status = Column(String(20), default="active")
    created_at = Column(Float, default=time.time)

    def to_dict(self, include_password=False):
        d = {
            "_id": str(self.id),
            "username": self.username,
            "email": self.email,
            "employeeId": self.employee_id,
            "department": self.department,
            "phoneNumber": self.phone_number,
            "phone_number": self.phone_number,
            "role": self.role,
            "status": self.status,
            "created_at": self.created_at,
        }
        if include_password:
            d["password"] = self.password
        return d


class AuthAdmin(Base):
    __tablename__ = "auth_admins"

    id = Column(Integer, primary_key=True)
    username = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    phone_number = Column(String(30), nullable=True)
    status = Column(String(20), default="active")
    created_at = Column(Float, default=time.time)

    def to_dict(self, include_password=False):
        d = {
            "_id": str(self.id),
            "username": self.username,
            "email": self.email,
            "phoneNumber": self.phone_number,
            "phone_number": self.phone_number,
            "role": "admin",
            "status": self.status,
            "created_at": self.created_at,
        }
        if include_password:
            d["password"] = self.password
        return d


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True)
    student_id = Column(String(100), unique=True, nullable=False)
    student_name = Column(String(200), nullable=False)
    department = Column(String(100))
    year = Column(String(20))
    division = Column(String(20))
    semester = Column(String(20))
    email = Column(String(255), unique=True, nullable=True)
    phone_number = Column(String(30))
    status = Column(String(20), default="active")
    embeddings = Column(JSONB)
    face_registered = Column(Boolean, default=False)
    created_at = Column(Float, default=time.time)
    updated_at = Column(Float, default=time.time)
    updated_by = Column(String(255))
    updated_by_type = Column(String(20))

    def to_dict(self, include_embeddings=False):
        d = {
            "_id": str(self.id),
            "studentId": self.student_id,
            "studentName": self.student_name,
            "department": self.department,
            "year": self.year,
            "division": self.division,
            "semester": self.semester,
            "email": self.email,
            "phoneNumber": self.phone_number,
            "status": self.status,
            "face_registered": self.face_registered,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if include_embeddings:
            d["embeddings"] = self.embeddings
        return d


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True)
    date = Column(String(20))
    subject = Column(String(100))
    department = Column(String(100))
    year = Column(String(20))
    division = Column(String(20))
    created_at = Column(DateTime, default=func.now())
    finalized = Column(Boolean, default=False)
    ended_at = Column(DateTime, nullable=True)
    students = Column(JSONB, default=list)


class DemoSession(Base):
    __tablename__ = "demo_sessions"

    id = Column(Integer, primary_key=True)
    session_id = Column(String(100), unique=True)
    started_at = Column(Float, default=time.time)
    status = Column(String(20), default="active")
    recognitions = Column(JSONB, default=list)


class FaceUser(Base):
    __tablename__ = "face_users"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(100))
    name = Column(String(200))
    embedding = Column(JSONB)


class MasterStudentRoster(Base):
    __tablename__ = "master_student_roster"

    id = Column(Integer, primary_key=True)
    roll_number = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False)
    year = Column(String(50), nullable=True)
    division = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    phone_number = Column(String(30), nullable=True)
    created_at = Column(Float, default=time.time)

    def to_dict(self):
        return {
            "id": self.id,
            "rollNumber": self.roll_number,
            "fullName": self.full_name,
            "department": self.department,
            "year": self.year,
            "division": self.division,
            "email": self.email,
            "phoneNumber": self.phone_number,
            "createdAt": self.created_at,
        }

