"""Provision the one Admin account for Smart College.

Run once, directly on the machine hosting the database:

    python create_admin.py

Admin has no public signup path (see auth/routes.py -- /api/signup rejects
userType "admin" outright), so this script is the only way to create one.
Password is read via getpass, never as a CLI argument or env var, so it
never ends up in shell history or a process listing.
"""
import getpass
import os
import re
import sys
import time

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    # "postgresql+psycopg2://ams_app:ams_app_pw@localhost:5432/facefast",
    "postgresql+psycopg2://postgres:Biswajit2005@localhost:5432/facefast",
)

import bcrypt
from database import engine, SessionLocal, Base
from models import AuthAdmin

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

def main():
    Base.metadata.create_all(engine)
    session = SessionLocal()

    try:
        username = input("Admin username: ").strip()
        if not username:
            sys.exit("Username is required.")

        email = input("Admin email: ").strip()
        if not EMAIL_RE.match(email):
            sys.exit("That doesn't look like a valid email address.")

        if session.query(AuthAdmin).filter_by(email=email).first():
            sys.exit(f"An admin account already exists for {email}.")

        password = getpass.getpass("Admin password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            sys.exit("Passwords did not match.")
        if len(password) < 8:
            sys.exit("Password must be at least 8 characters.")

        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin = AuthAdmin(
            username=username,
            email=email,
            password=hashed,
            status="active",
            created_at=time.time(),
        )
        session.add(admin)
        session.commit()

        print(f"\nAdmin account created for {email}. Sign in at /signin with the Admin option.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
