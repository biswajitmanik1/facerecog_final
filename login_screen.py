"""Login screen for the desktop app.

The desktop app previously had no login at all -- whoever was at the
console could do everything. This brings it in line with the web app's
Teacher/Admin split: a Teacher or Admin signs in against the same
auth_teachers/auth_admins tables (bcrypt-checked, same hashes the web app
writes), and the role that comes back gates what the home screen shows.
"""
import tkinter as tk

import bcrypt
from PIL import Image, ImageDraw

import ui_kit as ui
from ui_shell import add_button, centre, dark_titlebar, dialog_scale, enable_dpi_awareness, keep
from paths import icon_path


def _authenticate(email, password, role):
    """Returns (user_dict, None) on success or (None, error_message)."""
    from db_shared import AuthAdmin, AuthTeacher, SessionLocal

    model = AuthAdmin if role == "admin" else AuthTeacher
    session = SessionLocal()
    try:
        user = session.query(model).filter_by(email=email).first()
        if not user:
            return None, f"No {role} account found with this email"
        if not bcrypt.checkpw(password.encode("utf-8"), user.password.encode("utf-8")):
            return None, "Invalid password"
        if user.status == "inactive":
            return None, "Account is deactivated. Contact administrator."
        return {"role": role, "email": user.email, "username": user.username, "id": user.id}, None
    finally:
        session.close()


def show_login():
    """Blocks until sign-in succeeds or the window is closed.

    Returns the user dict {"role", "email", "username", "id"}, or None if
    the window was closed without signing in.
    """
    result = {"user": None}

    enable_dpi_awareness()
    win = tk.Tk()
    win.title("Sign In - Smart College")
    S = dialog_scale(win, lo=1.0, hi=1.5)

    def s(v):
        return v * S

    W, H = int(s(480)), int(s(560))
    centre(win, W, H)
    win.resizable(0, 0)
    try:
        win.iconbitmap(icon_path)
    except tk.TclError:
        pass
    dark_titlebar(win)

    state = {"role": "teacher"}

    card = (s(30), s(30), s(450), s(530))
    page = ui.add_blobs(ui.gradient((W, H)))
    page = Image.alpha_composite(page, ui.shadow_layer((W, H), [(card, s(20))], blur=int(s(16))))
    d = ImageDraw.Draw(page)
    d.rounded_rectangle(list(card), radius=s(20), fill=ui.WHITE)

    def fnt(size, weight="regular"):
        return ui.font(max(int(size * S), 8), weight)

    icon_cx, icon_cy, r = s(240), s(88), s(32)
    d.ellipse([icon_cx - r, icon_cy - r, icon_cx + r, icon_cy + r], fill=ui.TINT_BLUE)
    ui.person(d, icon_cx, icon_cy, s(32), ui.BLUE, badge=ui.BLUE, badge_ring=ui.TINT_BLUE)
    d.text((s(240), s(146)), "Sign In", font=fnt(23, "bold"), fill=ui.NAVY, anchor="mm")
    d.text((s(240), s(174)), "Smart College Attendance System", font=fnt(12), fill=ui.GREY, anchor="mm")

    for label, y in (("Email", 292), ("Password", 372)):
        d.text((s(70), s(y)), label, font=fnt(12, "semibold"), fill=ui.NAVY, anchor="lm")
        d.rounded_rectangle(
            [s(70), s(y + 16), s(410), s(y + 60)], radius=s(10), fill="#f4f8ff", outline=ui.BORDER, width=1
        )

    canvas = tk.Canvas(win, width=W, height=H, highlightthickness=0, bd=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_image(0, 0, image=keep(canvas, page), anchor="nw")

    entry_style = dict(
        bd=0, relief="flat", bg="#f4f8ff", fg=ui.NAVY, font=("Segoe UI", -int(s(16))), highlightthickness=0
    )
    email_entry = tk.Entry(win, **entry_style)
    email_entry.place(x=s(82), y=s(319), width=s(316), height=s(26))
    email_entry.focus_set()

    password_entry = tk.Entry(win, show="*", **entry_style)
    password_entry.place(x=s(82), y=s(399), width=s(316), height=s(26))

    message = tk.Label(
        win, text="", bg=ui.WHITE, fg="#c0392b", font=("Segoe UI", -int(s(12))),
        anchor="w", justify="left", wraplength=int(s(390)),
    )
    message.place(x=s(70), y=s(438), width=s(340), height=s(24))

    # Role toggle -- plain Tk buttons so the selected state can just flip
    # their own colours, instead of needing separate hover-state pill images
    # per role like the rest of the app's buttons.
    role_buttons = {}

    def paint_role_buttons():
        for role, btn in role_buttons.items():
            selected = state["role"] == role
            btn.configure(
                bg=ui.BLUE if selected else "#eef3fb",
                fg=ui.WHITE if selected else ui.NAVY,
                activebackground=ui.BLUE_DARK if selected else "#e2eaf6",
            )

    def select_role(role):
        state["role"] = role
        paint_role_buttons()

    btn_style = dict(
        relief="flat", bd=0, font=("Segoe UI Semibold", -int(s(13))), cursor="hand2", width=12,
    )
    teacher_btn = tk.Button(win, text="Teacher", command=lambda: select_role("teacher"), **btn_style)
    teacher_btn.place(x=s(70), y=s(206), width=s(160), height=s(36))
    admin_btn = tk.Button(win, text="Admin", command=lambda: select_role("admin"), **btn_style)
    admin_btn.place(x=s(250), y=s(206), width=s(160), height=s(36))
    role_buttons["teacher"] = teacher_btn
    role_buttons["admin"] = admin_btn
    paint_role_buttons()

    def attempt_login():
        email = email_entry.get().strip()
        password = password_entry.get()
        if not email or not password:
            message.configure(text="Please enter both email and password.")
            return

        message.configure(text="Signing in...")
        win.update_idletasks()

        user, error = _authenticate(email, password, state["role"])
        if error:
            message.configure(text=error)
            return

        result["user"] = user
        win.destroy()

    bw, bh, label_size = s(200), s(44), max(int(14 * S), 9)
    add_button(
        canvas, s(240), s(492),
        keep(canvas, ui.pill("Sign In", bw, bh, ui.BLUE, size=label_size)),
        keep(canvas, ui.pill("Sign In", bw, bh, ui.BLUE_DARK, size=label_size)),
        attempt_login,
    )

    win.bind("<Return>", lambda _e: attempt_login())
    win.mainloop()
    return result["user"]
