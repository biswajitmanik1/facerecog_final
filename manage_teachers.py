"""Admin-only teacher account management for the desktop app.

Mirrors the web app's /admin/teachers page: list, create, activate/
deactivate, and delete teacher accounts, writing to the same auth_teachers
table the web app's admin panel uses.
"""
import time
import tkinter as tk
from tkinter import messagebox

import bcrypt

import ui_kit as ui
from ui_shell import centre, dark_titlebar


def manage_teachers_window(parent):
    from db_shared import AuthTeacher, SessionLocal

    win = tk.Toplevel(parent)
    win.title("Manage Teachers")
    centre(win, 900, 640)
    win.minsize(760, 520)
    win.configure(bg=ui.WHITE)
    dark_titlebar(win)

    header = tk.Frame(win, bg=ui.PURPLE, height=64)
    header.pack(fill="x")
    header.pack_propagate(False)
    tk.Label(
        header, text="Manage Teachers", bg=ui.PURPLE, fg=ui.WHITE, font=("Segoe UI Semibold", 18)
    ).pack(side="left", padx=20)

    body = tk.Frame(win, bg=ui.WHITE)
    body.pack(fill="both", expand=True, padx=16, pady=16)

    # ---- new teacher form -----------------------------------------------
    form = tk.LabelFrame(
        body, text="New Teacher Account", bg=ui.WHITE, fg=ui.NAVY,
        font=("Segoe UI Semibold", 11), padx=14, pady=14,
    )
    form.pack(side="left", fill="y", padx=(0, 16))

    fields = {}
    for key, label in (
        ("username", "Username"),
        ("email", "Email"),
        ("password", "Temporary Password"),
        ("employee_id", "Employee ID"),
        ("department", "Department"),
    ):
        tk.Label(form, text=label, bg=ui.WHITE, fg=ui.NAVY, font=("Segoe UI", 10)).pack(anchor="w", pady=(8, 2))
        entry = tk.Entry(form, width=28, show="*" if key == "password" else "", font=("Segoe UI", 11))
        entry.pack()
        fields[key] = entry

    status_label = tk.Label(
        form, text="", bg=ui.WHITE, fg="#c0392b", font=("Segoe UI", 9), wraplength=220, justify="left"
    )
    status_label.pack(pady=(10, 0))

    # ---- teacher list -----------------------------------------------------
    list_frame = tk.Frame(body, bg=ui.WHITE)
    list_frame.pack(side="left", fill="both", expand=True)

    tk.Label(list_frame, text="Teachers", bg=ui.WHITE, fg=ui.NAVY, font=("Segoe UI Semibold", 13)).pack(anchor="w")

    canvas = tk.Canvas(list_frame, bg=ui.WHITE, highlightthickness=0)
    scrollbar = tk.Scrollbar(list_frame, orient="vertical", command=canvas.yview)
    rows_frame = tk.Frame(canvas, bg=ui.WHITE)
    canvas.configure(yscrollcommand=scrollbar.set)
    canvas.pack(side="left", fill="both", expand=True, pady=(8, 0))
    scrollbar.pack(side="right", fill="y")
    window_id = canvas.create_window((0, 0), window=rows_frame, anchor="nw")
    rows_frame.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
    canvas.bind("<Configure>", lambda e: canvas.itemconfig(window_id, width=e.width))

    def refresh():
        for child in rows_frame.winfo_children():
            child.destroy()

        session = SessionLocal()
        try:
            teachers = session.query(AuthTeacher).order_by(AuthTeacher.username.asc()).all()
        finally:
            session.close()

        if not teachers:
            tk.Label(rows_frame, text="No teacher accounts yet.", bg=ui.WHITE, fg=ui.GREY, font=("Segoe UI", 11)).pack(pady=20)
            return

        for teacher in teachers:
            row = tk.Frame(rows_frame, bg="#f7fafd", highlightbackground=ui.BORDER, highlightthickness=1)
            row.pack(fill="x", pady=4, ipady=8, ipadx=10)

            info = tk.Frame(row, bg="#f7fafd")
            info.pack(side="left", fill="both", expand=True, padx=10)
            tk.Label(
                info, text=f"{teacher.username}  ({teacher.status})", bg="#f7fafd", fg=ui.NAVY,
                font=("Segoe UI Semibold", 12), anchor="w",
            ).pack(anchor="w")
            tk.Label(info, text=teacher.email, bg="#f7fafd", fg=ui.GREY, font=("Segoe UI", 10), anchor="w").pack(anchor="w")
            details = " • ".join(filter(None, [teacher.employee_id, teacher.department]))
            if details:
                tk.Label(info, text=details, bg="#f7fafd", fg=ui.GREY, font=("Segoe UI", 9), anchor="w").pack(anchor="w")

            actions = tk.Frame(row, bg="#f7fafd")
            actions.pack(side="right", padx=10)

            def toggle(t=teacher):
                session = SessionLocal()
                try:
                    obj = session.get(AuthTeacher, t.id)
                    obj.status = "inactive" if obj.status == "active" else "active"
                    session.commit()
                finally:
                    session.close()
                refresh()

            def delete(t=teacher):
                if not messagebox.askyesno(
                    "Delete teacher", f"Delete {t.username} ({t.email})? This cannot be undone.", parent=win
                ):
                    return
                session = SessionLocal()
                try:
                    obj = session.get(AuthTeacher, t.id)
                    session.delete(obj)
                    session.commit()
                finally:
                    session.close()
                refresh()

            tk.Button(
                actions, text=("Deactivate" if teacher.status == "active" else "Activate"), command=toggle,
                relief="flat", bg="#eef3fb", fg=ui.NAVY, font=("Segoe UI", 9), cursor="hand2",
            ).pack(side="left", padx=4)
            tk.Button(
                actions, text="Delete", command=delete, relief="flat", bg="#fbe8e8", fg="#c0392b",
                font=("Segoe UI", 9), cursor="hand2",
            ).pack(side="left")

    def create_teacher():
        username = fields["username"].get().strip()
        email = fields["email"].get().strip()
        password = fields["password"].get()
        employee_id = fields["employee_id"].get().strip()
        department = fields["department"].get().strip()

        if not all([username, email, password, employee_id]):
            status_label.configure(text="Username, email, password, and employee ID are required.")
            return

        session = SessionLocal()
        try:
            if session.query(AuthTeacher).filter_by(email=email).first():
                status_label.configure(text="Email already registered as teacher.")
                return
            hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            teacher = AuthTeacher(
                username=username,
                email=email,
                password=hashed,
                employee_id=employee_id,
                department=department or None,
                role="teacher",
                status="active",
                created_at=time.time(),
            )
            session.add(teacher)
            session.commit()
        finally:
            session.close()

        status_label.configure(text="")
        for entry in fields.values():
            entry.delete(0, "end")
        refresh()

    tk.Button(
        form, text="Create Teacher Account", command=create_teacher,
        bg=ui.PURPLE, fg=ui.WHITE, activebackground=ui.PURPLE_DARK, activeforeground=ui.WHITE,
        relief="flat", font=("Segoe UI Semibold", 10), cursor="hand2", width=24, pady=8,
    ).pack(pady=(14, 0))

    refresh()
    return win
