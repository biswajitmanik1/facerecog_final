import datetime
import tkinter as tk

from PIL import Image, ImageDraw

import ui_kit as ui
import ui_shell
from ui_shell import add_button, centre, dark_titlebar, keep
from paths import (
    haarcasecade_path,
    trainimagelabel_path,
    trainimage_path,
    attendance_path,
    icon_path,
)

# project module
import show_attendance
import takeImage
import trainImage
import automaticAttedance
import login_screen
import manage_teachers
import institution_reports


def text_to_speech(user_text):
    """Spoken feedback is switched off; the notification labels carry the text.

    Every module still takes this as a parameter, so turning speech back on is a
    matter of restoring the body here -- nothing else has to change:

        import pyttsx3
        engine = pyttsx3.init()
        engine.say(user_text)
        engine.runAndWait()
    """


# The layout is authored against this reference size and then scaled to whatever
# the window actually is, so the same design fills any screen.
BASE_W, BASE_H = 1180, 790
MIN_SCALE, MAX_SCALE = 0.75, 1.7

CARDS = (
    {
        "title": "Register Student",
        "lines": ("Register a new student", "with face recognition"),
        "action": "Get Started",
        "icon": "person",
        "accent": ui.BLUE,
        "accent_dark": ui.BLUE_DARK,
        "tint": ui.TINT_BLUE,
    },
    {
        "title": "Take Attendance",
        "lines": ("Mark attendance using", "face recognition"),
        "action": "Take Attendance",
        "icon": "camera",
        "accent": ui.TEAL,
        "accent_dark": ui.TEAL_DARK,
        "tint": ui.TINT_TEAL,
    },
    {
        "title": "View Attendance",
        "lines": ("View and manage", "attendance records"),
        "action": "View Reports",
        "icon": "bars",
        "accent": ui.PURPLE,
        "accent_dark": ui.PURPLE_DARK,
        "tint": ui.TINT_PURPLE,
    },
)

class Layout:
    """Every measurement for one window size, in real pixels."""

    def __init__(self, width, height):
        self.W, self.H = width, height
        self.S = min(
            max(min(width / BASE_W, height / BASE_H), MIN_SCALE), MAX_SCALE
        )
        # when one axis limits the scale the other has slack; share it out so the
        # middle of the page stays optically centred
        self.offset = max((height - BASE_H * self.S) / 2, 0)

        self.header_h = self.s(110)
        self.card_w = self.s(266)
        self.card_h = self.s(306)
        self.gap = self.s(34)
        self.card_x0 = (width - (self.card_w * 3 + self.gap * 2)) / 2
        self.card_y = self.y(294)
        self.btn_w, self.btn_h = self.s(200), self.s(44)
        self.card_btn_cy = self.card_y + self.s(254)
        self.exit_cy = self.y(646)
        self.footer = (
            self.s(24),
            height - self.s(104),
            width - self.s(24),
            height - self.s(20),
        )

    def s(self, value):
        """Scale a size."""
        return value * self.S

    def y(self, value):
        """Scale a y-coordinate in the vertically centred middle band."""
        return value * self.S + self.offset

    def font(self, size, weight="regular"):
        return ui.font(max(int(size * self.S), 8), weight)

    def card_x(self, index):
        return self.card_x0 + index * (self.card_w + self.gap)


def build_page(L):
    W, H = L.W, L.H
    page = ui.add_blobs(ui.gradient((W, H)))

    shapes = [((-L.s(30), -L.s(40), W + L.s(30), L.header_h), L.s(22))]
    admin = (W - L.s(205), L.s(22), W - L.s(20), L.s(88))
    shapes.append((admin, L.s(14)))
    shapes += [
        (
            (L.card_x(i), L.card_y, L.card_x(i) + L.card_w, L.card_y + L.card_h),
            L.s(16),
        )
        for i in range(3)
    ]
    shapes.append((L.footer, L.s(18)))
    page = Image.alpha_composite(
        page, ui.shadow_layer((W, H), shapes, blur=int(L.s(16)))
    )

    d = ImageDraw.Draw(page)

    # ---- header -------------------------------------------------------
    d.rounded_rectangle(
        [-L.s(30), -L.s(40), W + L.s(30), L.header_h], radius=L.s(22), fill=ui.WHITE
    )
    ui.cap(d, L.s(80), L.s(52), L.s(30), ui.BLUE)
    d.text(
        (L.s(132), L.s(40)),
        "Smart College",
        font=L.font(27, "bold"),
        fill=ui.NAVY,
        anchor="lm",
    )
    d.text(
        (L.s(134), L.s(72)),
        "Face Recognition Attendance Syste",
        font=L.font(13),
        fill=ui.SLATE,
        anchor="lm",
    )

    d.rounded_rectangle(
        list(admin), radius=L.s(14), fill=ui.WHITE, outline=ui.BORDER, width=1
    )
    avatar_cx, avatar_cy, r = admin[0] + L.s(37), L.s(55), L.s(20)
    d.ellipse(
        [avatar_cx - r, avatar_cy - r, avatar_cx + r, avatar_cy + r], fill=ui.BLUE
    )
    ui.person(d, avatar_cx, avatar_cy + L.s(2), L.s(19), ui.WHITE)
    display_name = current_user["username"] if current_user else "Guest"
    role_label = current_user["role"].capitalize() if current_user else ""
    d.text(
        (admin[0] + L.s(71), L.s(45)),
        display_name,
        font=L.font(15, "bold"),
        fill=ui.BLUE,
        anchor="lm",
    )
    d.text(
        (admin[0] + L.s(71), L.s(67)),
        role_label,
        font=L.font(11),
        fill="#6b8bb5",
        anchor="lm",
    )

    # ---- hero ---------------------------------------------------------
    d.text(
        (W / 2, L.y(142)),
        "Welcome to the",
        font=L.font(17, "bold"),
        fill=ui.BLUE,
        anchor="mm",
    )
    d.text(
        (W / 2, L.y(180)),
        "Face Recognition Based",
        font=L.font(31, "bold"),
        fill=ui.NAVY,
        anchor="mm",
    )
    d.text(
        (W / 2, L.y(221)),
        "Attendance Management System",
        font=L.font(31, "bold"),
        fill=ui.BLUE,
        anchor="mm",
    )
    ui.centered(
        d,
        W / 2,
        L.y(259),
        [
            ("Fast", ui.GREY),
            ("   *   ", ui.BLUE),
            ("Secure", ui.GREY),
            ("   *   ", ui.BLUE),
            ("Accurate", ui.GREY),
        ],
        L.font(14),
    )

    # ---- cards --------------------------------------------------------
    for i, card in enumerate(CARDS):
        x, y = L.card_x(i), L.card_y
        d.rounded_rectangle(
            [x, y, x + L.card_w, y + L.card_h], radius=L.s(16), fill=card["accent"]
        )
        d.rounded_rectangle(
            [x, y + L.s(5), x + L.card_w, y + L.card_h], radius=L.s(16), fill=ui.WHITE
        )

        cx, icon_cy, r = x + L.card_w / 2, y + L.s(82), L.s(47)
        d.ellipse([cx - r, icon_cy - r, cx + r, icon_cy + r], fill=card["tint"])
        ui.ICONS[card["icon"]](d, cx, icon_cy, L.s(46), card["accent"], card["tint"])

        d.text(
            (cx, y + L.s(148)),
            card["title"],
            font=L.font(19, "bold"),
            fill=ui.NAVY,
            anchor="mm",
        )
        for line_no, line in enumerate(card["lines"]):
            d.text(
                (cx, y + L.s(180 + line_no * 21)),
                line,
                font=L.font(13),
                fill=ui.GREY,
                anchor="mm",
            )

    # ---- footer -------------------------------------------------------
    d.rounded_rectangle(list(L.footer), radius=L.s(18), fill=ui.FOOTER)
    fx0, fy0, fx1, fy1 = L.footer
    inner, cy = fx1 - fx0, (fy0 + fy1) / 2
    today = datetime.datetime.now().strftime("%d %B %Y | %A")
    blocks = (
        (0.06, "shield", True, "Smart • Secure • Reliable", "Built for a better tomorrow"),
        (0.40, "calendar", False, "Today's Date", today),
        (0.73, "code", True, "Developed by", "Biswajit | CSE Department"),
    )
    for fraction, kind, on_blue, line1, line2 in blocks:
        x = fx0 + inner * fraction
        disc, glyph = (ui.BLUE, ui.WHITE) if on_blue else (ui.WHITE, ui.BLUE)
        r = L.s(21)
        d.ellipse([x - r, cy - r, x + r, cy + r], fill=disc)
        if kind == "shield":
            ui.shield(d, x, cy, L.s(30), glyph, disc)
        elif kind == "calendar":
            ui.calendar(d, x, cy, L.s(28), glyph)
        else:
            ui.code(d, x, cy, L.s(30), glyph)
        d.text(
            (x + L.s(34), cy - L.s(10)),
            line1,
            font=L.font(14, "bold"),
            fill=ui.WHITE,
            anchor="lm",
        )
        d.text(
            (x + L.s(34), cy + L.s(13)),
            line2,
            font=L.font(12),
            fill=ui.FOOTER_TEXT,
            anchor="lm",
        )

    return page


def render(canvas, width, height):
    """Repaint the whole main screen for the current window size."""
    L = Layout(width, height)
    canvas.delete("all")
    ui_shell.forget_images(canvas)

    canvas.create_image(0, 0, image=keep(canvas, build_page(L)), anchor="nw")

    label = max(int(14 * L.S), 9)
    commands = (TakeImageUI, automatic_attedance, view_attendance)
    for index, card in enumerate(CARDS):
        add_button(
            canvas,
            L.card_x(index) + L.card_w / 2,
            L.card_btn_cy,
            keep(
                canvas,
                ui.pill(
                    card["action"], L.btn_w, L.btn_h, card["accent"],
                    icon=card["icon"], size=label,
                ),
            ),
            keep(
                canvas,
                ui.pill(
                    card["action"], L.btn_w, L.btn_h, card["accent_dark"],
                    icon=card["icon"], size=label,
                ),
            ),
            commands[index],
        )

    is_admin = current_user and current_user["role"] == "admin"
    # Admin gets a second button alongside Exit rather than stacked above it
    # -- stacking left barely any breathing room below the cards and made it
    # look like it was overlapping the middle card.
    exit_cx = L.W / 2 - L.s(112) if is_admin else L.W / 2
    exit_w = L.s(180) if is_admin else L.s(204)

    add_button(
        canvas,
        exit_cx,
        L.exit_cy,
        keep(canvas, ui.pill("Exit System", exit_w, L.btn_h, ui.RED, icon="exit", size=label)),
        keep(
            canvas,
            ui.pill("Exit System", exit_w, L.btn_h, ui.RED_DARK, icon="exit", size=label),
        ),
        window.destroy,
    )

    if is_admin:
        add_button(
            canvas,
            L.W / 2 + L.s(112),
            L.exit_cy,
            keep(canvas, ui.pill("Admin Tools", L.s(180), L.btn_h, ui.PURPLE, icon="bars", size=label)),
            keep(
                canvas,
                ui.pill("Admin Tools", L.s(180), L.btn_h, ui.PURPLE_DARK, icon="bars", size=label),
            ),
            admin_tools_menu,
        )


# ---------------------------------------------------------------- windows ---


def err_screen():
    sc1 = tk.Toplevel(window)
    sc1.title("Missing details")
    centre(sc1, 420, 170)
    sc1.resizable(0, 0)
    sc1.configure(background=ui.WHITE)
    try:
        sc1.iconbitmap(icon_path)
    except tk.TclError:
        pass
    dark_titlebar(sc1)
    tk.Label(
        sc1,
        text="Enrollment & Name required",
        bg=ui.WHITE,
        fg=ui.NAVY,
        font=("Segoe UI Semibold", -20),
    ).pack(pady=(38, 6))
    tk.Label(
        sc1,
        text="Please fill in both fields before capturing.",
        bg=ui.WHITE,
        fg=ui.GREY,
        font=("Segoe UI", -13),
    ).pack()
    tk.Button(
        sc1,
        text="OK",
        command=sc1.destroy,
        bg=ui.BLUE,
        fg=ui.WHITE,
        activebackground=ui.BLUE_DARK,
        activeforeground=ui.WHITE,
        relief="flat",
        bd=0,
        width=12,
        font=("Segoe UI Semibold", -13),
        cursor="hand2",
    ).pack(pady=18)


def testVal(inStr, acttyp):
    """Restricts the Enrollment field to letters, digits, and hyphens -- e.g.
    "002-BCS-2023-113" -- instead of digits only."""
    if acttyp == "1":  # insert
        if not all(ch.isalnum() or ch == "-" for ch in inStr):
            return False
    return True


def TakeImageUI():
    S = ui_shell.dialog_scale(window)

    def s(value):
        return value * S

    RW, RH = int(s(820)), int(s(730))
    win = tk.Toplevel(window)
    win.title("Register Student")
    centre(win, RW, RH)
    win.resizable(0, 0)
    try:
        win.iconbitmap(icon_path)
    except tk.TclError:
        pass
    dark_titlebar(win)

    card = (s(40), s(30), s(780), s(700))
    page = ui.add_blobs(ui.gradient((RW, RH)))
    page = Image.alpha_composite(
        page, ui.shadow_layer((RW, RH), [(card, s(20))], blur=int(s(16)))
    )
    d = ImageDraw.Draw(page)
    d.rounded_rectangle(list(card), radius=s(20), fill=ui.WHITE)

    def fnt(size, weight="regular"):
        return ui.font(max(int(size * S), 8), weight)

    icon_cx, icon_cy, r = s(410), s(88), s(34)
    d.ellipse([icon_cx - r, icon_cy - r, icon_cx + r, icon_cy + r], fill=ui.TINT_BLUE)
    ui.person(d, icon_cx, icon_cy, s(34), ui.BLUE, badge=ui.BLUE, badge_ring=ui.TINT_BLUE)
    d.text(
        (s(410), s(152)),
        "Register Your Face",
        font=fnt(24, "bold"),
        fill=ui.NAVY,
        anchor="mm",
    )
    d.text(
        (s(410), s(182)),
        "Enter the student details below",
        font=fnt(13),
        fill=ui.GREY,
        anchor="mm",
    )

    # Two columns keep this dialog short enough to fit on a laptop screen --
    # stacking all 8 fields in one column (as a first pass did) produced a
    # window taller than most displays.
    LEFT_X, RIGHT_X, COL_W = 150, 430, 250
    FULL_X, FULL_W = 150, 530

    PAIRED_ROWS = (
        ("Enrollment No", "Name", 222),
        ("Department", "Year", 294),
        ("Division", "Semester", 366),
    )
    FULL_ROWS = (
        ("Email (optional)", 438),
        ("Notification", 510),
    )

    for left_label, right_label, y in PAIRED_ROWS:
        for label, x0 in ((left_label, LEFT_X), (right_label, RIGHT_X)):
            d.text((s(x0), s(y)), label, font=fnt(12, "semibold"), fill=ui.NAVY, anchor="lm")
            d.rounded_rectangle(
                [s(x0), s(y + 16), s(x0 + COL_W), s(y + 60)],
                radius=s(10),
                fill="#f4f8ff",
                outline=ui.BORDER,
                width=1,
            )

    for label, y in FULL_ROWS:
        d.text((s(FULL_X), s(y)), label, font=fnt(12, "semibold"), fill=ui.NAVY, anchor="lm")
        d.rounded_rectangle(
            [s(FULL_X), s(y + 16), s(FULL_X + FULL_W), s(y + 60)],
            radius=s(10),
            fill="#f4f8ff",
            outline=ui.BORDER,
            width=1,
        )

    canvas = tk.Canvas(win, width=RW, height=RH, highlightthickness=0, bd=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_image(0, 0, image=keep(canvas, page), anchor="nw")

    # negative sizes are pixels -- point sizes would scale with the real DPI and
    # no longer line up with the input boxes painted into the background
    entry_style = dict(
        bd=0,
        relief="flat",
        bg="#f4f8ff",
        fg=ui.NAVY,
        font=("Segoe UI", -int(s(17))),
        highlightthickness=0,
    )
    txt1 = tk.Entry(win, validate="key", **entry_style)
    txt1["validatecommand"] = (txt1.register(testVal), "%P", "%d")
    txt1.place(x=s(LEFT_X + 14), y=s(249), width=s(COL_W - 20), height=s(26))

    txt2 = tk.Entry(win, **entry_style)
    txt2.place(x=s(RIGHT_X + 14), y=s(249), width=s(COL_W - 20), height=s(26))

    # department/year/division/semester/email mirror the fields the web
    # app's registration form collects (see backend/models.py Student).
    # The first four are dropdowns, same option lists as the web form, so a
    # student can't be registered under a typo'd department/year/etc. that
    # doesn't match anything the web app's filters would ever match against.
    extra_entries = {}
    for key, options, x0, y in (
        ("department", ui_shell.DEPARTMENTS, LEFT_X, 294),
        ("year", ui_shell.YEARS, RIGHT_X, 294),
        ("division", ui_shell.DIVISIONS, LEFT_X, 366),
        ("semester", ui_shell.SEMESTERS, RIGHT_X, 366),
    ):
        field = ui_shell.dropdown(win, options, font_px=s(15))
        field.place(x=s(x0 + 14), y=s(y + 27), width=s(COL_W - 20), height=s(26))
        extra_entries[key] = field

    email_entry = tk.Entry(win, **entry_style)
    email_entry.place(x=s(FULL_X + 14), y=s(438 + 27), width=s(FULL_W - 20), height=s(26))
    extra_entries["email"] = email_entry

    message = tk.Label(
        win,
        text="",
        bg="#f4f8ff",
        fg=ui.BLUE,
        font=("Segoe UI", -int(s(13))),
        anchor="w",
        justify="left",
        wraplength=int(s(FULL_W - 6)),
    )
    message.place(x=s(FULL_X + 14), y=s(510 + 25), width=s(FULL_W - 20), height=s(30))

    def take_image():
        takeImage.TakeImage(
            txt1.get(),
            txt2.get(),
            haarcasecade_path,
            trainimage_path,
            message,
            err_screen,
            text_to_speech,
            department=extra_entries["department"].get(),
            year=extra_entries["year"].get(),
            division=extra_entries["division"].get(),
            semester=extra_entries["semester"].get(),
            email=extra_entries["email"].get(),
        )
        txt1.delete(0, "end")
        txt2.delete(0, "end")
        for entry in extra_entries.values():
            ui_shell.clear_field(entry)

    def train_image():
        trainImage.TrainImage(
            haarcasecade_path,
            trainimage_path,
            trainimagelabel_path,
            message,
            text_to_speech,
        )

    bw, bh, label = s(200), s(44), max(int(14 * S), 9)
    add_button(
        canvas,
        s(270),
        s(630),
        keep(canvas, ui.pill("Take Image", bw, bh, ui.BLUE, icon="camera", size=label)),
        keep(canvas, ui.pill("Take Image", bw, bh, ui.BLUE_DARK, icon="camera", size=label)),
        take_image,
    )
    add_button(
        canvas,
        s(550),
        s(630),
        keep(canvas, ui.pill("Train Image", bw, bh, ui.TEAL, icon="bars", size=label)),
        keep(canvas, ui.pill("Train Image", bw, bh, ui.TEAL_DARK, icon="bars", size=label)),
        train_image,
    )


def automatic_attedance():
    automaticAttedance.subjectChoose(text_to_speech, parent=window)


def view_attendance():
    show_attendance.subjectchoose(text_to_speech, parent=window)


def admin_tools_menu():
    """Small popup offering the admin-only screens -- kept separate from the
    home screen's fixed 3-card grid, which would need a much larger rework
    to support a variable number of cards."""
    S = ui_shell.dialog_scale(window)

    def s(v):
        return v * S

    win = tk.Toplevel(window)
    win.title("Admin Tools")
    W, H = int(s(360)), int(s(280))
    centre(win, W, H)
    win.resizable(0, 0)
    try:
        win.iconbitmap(icon_path)
    except tk.TclError:
        pass
    dark_titlebar(win)

    page, d = ui_shell.card_page((W, H), (s(20), s(20), s(340), s(260)), S)
    d.text((s(180), s(56)), "Admin Tools", font=ui.font(int(s(18)), "bold"), fill=ui.NAVY, anchor="mm")

    canvas = tk.Canvas(win, width=W, height=H, highlightthickness=0, bd=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_image(0, 0, image=keep(canvas, page), anchor="nw")

    label = max(int(13 * S), 9)
    bw, bh = s(260), s(46)

    def open_manage_teachers():
        win.destroy()
        manage_teachers.manage_teachers_window(window)

    def open_reports():
        win.destroy()
        institution_reports.show_institution_report(window)

    add_button(
        canvas, s(180), s(120),
        keep(canvas, ui.pill("Manage Teachers", bw, bh, ui.PURPLE, icon="person", size=label)),
        keep(canvas, ui.pill("Manage Teachers", bw, bh, ui.PURPLE_DARK, icon="person", size=label)),
        open_manage_teachers,
    )
    add_button(
        canvas, s(180), s(180),
        keep(canvas, ui.pill("Institution Reports", bw, bh, ui.TEAL, icon="bars", size=label)),
        keep(canvas, ui.pill("Institution Reports", bw, bh, ui.TEAL_DARK, icon="bars", size=label)),
        open_reports,
    )


# ------------------------------------------------------------------- main ---

window = None
current_user = None


def main():
    global window, current_user

    current_user = login_screen.show_login()
    if not current_user:
        return  # login window closed without signing in

    ui_shell.enable_dpi_awareness()
    window = tk.Tk()
    window.title("Smart College - Face Recognition Attendance System")
    window.minsize(940, 660)
    centre(window, BASE_W, BASE_H)
    try:
        window.iconbitmap(icon_path)
    except tk.TclError:
        pass
    dark_titlebar(window)
    window.state("zoomed")  # open filling the screen

    canvas = tk.Canvas(window, highlightthickness=0, bd=0)
    canvas.pack(fill="both", expand=True)

    window.update_idletasks()
    render(canvas, canvas.winfo_width(), canvas.winfo_height())

    # repaint on resize, but only once the dragging settles
    state = {"size": (canvas.winfo_width(), canvas.winfo_height()), "job": None}

    def on_configure(event):
        if event.widget is not canvas:
            return
        size = (event.width, event.height)
        if size == state["size"] or min(size) < 50:
            return
        state["size"] = size
        if state["job"]:
            canvas.after_cancel(state["job"])
        state["job"] = canvas.after(120, lambda: render(canvas, *size))

    canvas.bind("<Configure>", on_configure)
    window.mainloop()


if __name__ == "__main__":
    main()
