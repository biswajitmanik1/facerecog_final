"""Tk-level building blocks shared by every window in the app.

ui_kit paints pixels; this module turns those paintings into real windows.
Kept separate from attendance.py so the sub-windows can use it without
importing the main screen back (which would be a circular import).
"""

import ctypes
import tkinter as tk
from tkinter import ttk

from PIL import Image, ImageDraw, ImageTk

import ui_kit as ui

BASE_W, BASE_H = 1180, 790

# Same option lists the web app's dropdowns use (frontend/app/student/registrationform,
# teacher/start-session) -- kept here once so both call sites can share them
# instead of drifting apart as separate hardcoded lists.
DEPARTMENTS = [
    "Computer Science", "Information Technology", "Electronics",
    "Mechanical", "Civil", "Electrical", "Chemical", "Biotechnology",
]
YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"]
DIVISIONS = ["A", "B", "C", "D"]
SEMESTERS = [str(n) for n in range(1, 9)]

_combobox_style_ready = False


def _ensure_combobox_style():
    """ttk widgets ignore plain .configure(bg=...) on Windows' native theme --
    switching to 'clam' is what makes the flat field colour actually take,
    so the dropdown fields match the app's painted input boxes instead of
    looking like a stock Windows control."""
    global _combobox_style_ready
    if _combobox_style_ready:
        return
    style = ttk.Style()
    style.theme_use("clam")
    style.configure(
        "Field.TCombobox",
        fieldbackground="#f4f8ff",
        background="#f4f8ff",
        foreground=ui.NAVY,
        arrowcolor=ui.BLUE,
        bordercolor=ui.BORDER,
        lightcolor="#f4f8ff",
        darkcolor="#f4f8ff",
        relief="flat",
    )
    _combobox_style_ready = True


def dropdown(win, values, font_px):
    """A readonly ttk.Combobox styled to match the app's flat input boxes.
    .get()/.place() work the same as the tk.Entry fields it replaces, so
    callers don't need to change how they read the value."""
    _ensure_combobox_style()
    box = ttk.Combobox(
        win, values=values, state="readonly", style="Field.TCombobox",
        font=("Segoe UI", -int(font_px)),
    )
    return box


def clear_field(widget):
    """Resets a field to empty after a form submits -- widget.delete(0,
    "end") silently no-ops on a readonly ttk.Combobox (it blocks direct
    text edits the same way it blocks typing), so a dropdown needs
    .set("") instead. Works for both dropdown() and plain tk.Entry."""
    if isinstance(widget, ttk.Combobox):
        widget.set("")
    else:
        widget.delete(0, "end")


def keep(widget, pil_image):
    """Tk drops PhotoImages nothing references, blanking the canvas -- park each
    one on the widget that shows it, so it lives exactly as long as that widget."""
    photo = ImageTk.PhotoImage(pil_image)
    widget._kept_images = getattr(widget, "_kept_images", [])
    widget._kept_images.append(photo)
    return photo


def forget_images(widget):
    widget._kept_images = []


def enable_dpi_awareness():
    """Without this Windows stretches the window bitmap at >100% scaling and
    every rounded edge and glyph drawn here comes out soft."""
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)  # system DPI aware
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def dark_titlebar(win):
    """Windows 11 lets us tint the native caption to match the page."""
    try:
        win.update_idletasks()
        hwnd = ctypes.windll.user32.GetParent(win.winfo_id())
        for attribute, value in ((20, 1), (35, 0x3D1C0C)):  # dark mode, caption colour
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, attribute, ctypes.byref(ctypes.c_int(value)), 4
            )
    except Exception:
        pass  # any non-Win11 host just keeps the default caption


def centre(win, width, height, lift=20):
    x = (win.winfo_screenwidth() - width) // 2
    y = max((win.winfo_screenheight() - height) // 2 - lift, 0)
    win.geometry(f"{int(width)}x{int(height)}+{int(x)}+{int(y)}")


def dialog_scale(win, lo=1.0, hi=1.5):
    """Dialogs size off the screen, not the main window, so they stay dialogs."""
    fit = min(win.winfo_screenwidth() / BASE_W, win.winfo_screenheight() / BASE_H)
    return min(max(fit, lo), hi)


def add_button(canvas, cx, cy, normal, hover, command):
    item = canvas.create_image(cx, cy, image=normal, anchor="center")

    def enter(_event):
        canvas.itemconfig(item, image=hover)
        canvas.config(cursor="hand2")

    def leave(_event):
        canvas.itemconfig(item, image=normal)
        canvas.config(cursor="")

    canvas.tag_bind(item, "<Enter>", enter)
    canvas.tag_bind(item, "<Leave>", leave)
    canvas.tag_bind(item, "<Button-1>", lambda _event: command())
    return item


def card_page(size, card_box, scale):
    """Gradient background with one white rounded card floating on it."""
    page = ui.add_blobs(ui.gradient(size))
    page = Image.alpha_composite(
        page, ui.shadow_layer(size, [(card_box, 20 * scale)], blur=int(16 * scale))
    )
    d = ImageDraw.Draw(page)
    d.rounded_rectangle(list(card_box), radius=20 * scale, fill=ui.WHITE)
    return page, d


def subject_screen(
    parent,
    title,
    subtitle,
    icon,
    accent,
    accent_dark,
    action_label,
    action_icon,
    on_action,
    on_open_folder,
    extra_fields=None,
):
    """The 'which subject?' screen, shared by taking and viewing attendance.

    extra_fields optionally adds more single-line inputs (e.g. Department,
    Year, Division) laid out two to a row below Subject -- used by "Take
    Attendance" so a session records the same class scoping the web app
    does, and left as None (the original one-field layout) for "View
    Attendance", which only ever needs Subject.

    Returns (window, read_subject, message_label, extra_getters) --
    message_label is a real Tk Label so callers can keep using
    .configure(text=...), and extra_getters is {label: get_value_fn},
    empty when extra_fields wasn't given.
    """
    # Each item is either a plain label (free-text field) or (label, options)
    # for a dropdown -- normalised once so the drawing and widget-creation
    # loops below don't each have to handle both shapes separately.
    extra_fields = [
        f if isinstance(f, tuple) else (f, None) for f in (extra_fields or [])
    ]
    rows_needed = (len(extra_fields) + 1) // 2

    win = tk.Toplevel(parent)
    win.title(title)
    S = dialog_scale(win)

    def s(v):
        return v * S

    def fnt(size, weight="regular"):
        return ui.font(max(int(size * S), 8), weight)

    ROW_SPACING = 72
    extra_block_h = rows_needed * ROW_SPACING
    notif_y = 296 + extra_block_h
    button_y = notif_y + 94

    W, H = int(s(640)), int(s(460 + extra_block_h))
    centre(win, W, H)
    win.resizable(0, 0)
    dark_titlebar(win)

    page, d = card_page((W, H), (s(40), s(30), s(600), s(30) + s(400 + extra_block_h)), S)

    cx, cy, r = s(320), s(92), s(34)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ui.tint_of(accent))
    ui.ICONS[icon](d, cx, cy, s(34), accent, ui.tint_of(accent))

    d.text((s(320), s(152)), title, font=fnt(22, "bold"), fill=ui.NAVY, anchor="mm")
    d.text((s(320), s(180)), subtitle, font=fnt(12), fill=ui.GREY, anchor="mm")

    d.text((s(100), s(222)), "Subject", font=fnt(12, "semibold"), fill=ui.NAVY, anchor="lm")
    d.rounded_rectangle(
        [s(100), s(238), s(540), s(282)],
        radius=s(10),
        fill="#f4f8ff",
        outline=ui.BORDER,
        width=1,
    )

    LEFT_X, RIGHT_X, COL_W = 100, 330, 210
    for i, (field_label, _options) in enumerate(extra_fields):
        row, col = divmod(i, 2)
        x0 = LEFT_X if col == 0 else RIGHT_X
        y = 294 + row * ROW_SPACING
        d.text((s(x0), s(y)), field_label, font=fnt(12, "semibold"), fill=ui.NAVY, anchor="lm")
        d.rounded_rectangle(
            [s(x0), s(y + 16), s(x0 + COL_W), s(y + 60)],
            radius=s(10),
            fill="#f4f8ff",
            outline=ui.BORDER,
            width=1,
        )

    d.text(
        (s(100), s(notif_y)), "Notification", font=fnt(12, "semibold"), fill=ui.NAVY, anchor="lm"
    )
    d.rounded_rectangle(
        [s(100), s(notif_y + 10), s(540), s(notif_y + 50)],
        radius=s(10),
        fill="#f7fafd",
        outline=ui.BORDER,
        width=1,
    )

    canvas = tk.Canvas(win, width=W, height=H, highlightthickness=0, bd=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_image(0, 0, image=keep(canvas, page), anchor="nw")

    # negative sizes are pixels -- point sizes would scale with the real DPI and
    # no longer line up with the input box painted into the background
    entry_style = dict(
        bd=0,
        relief="flat",
        bg="#f4f8ff",
        fg=ui.NAVY,
        font=("Segoe UI", -int(s(17))),
        highlightthickness=0,
    )
    entry = tk.Entry(win, **entry_style)
    entry.place(x=s(112), y=s(249), width=s(416), height=s(26))
    entry.focus_set()

    extra_getters = {}
    for i, (field_label, options) in enumerate(extra_fields):
        row, col = divmod(i, 2)
        x0 = LEFT_X if col == 0 else RIGHT_X
        y = 294 + row * ROW_SPACING
        if options:
            field_widget = dropdown(win, options, font_px=s(15))
        else:
            field_widget = tk.Entry(win, **entry_style)
        field_widget.place(x=s(x0 + 12), y=s(y + 27), width=s(COL_W - 20), height=s(26))
        extra_getters[field_label] = field_widget.get

    message = tk.Label(
        win,
        text="",
        bg="#f7fafd",
        fg=accent,
        font=("Segoe UI", -int(s(13))),
        anchor="w",
        justify="left",
        wraplength=int(s(410)),
    )
    message.place(x=s(112), y=s(notif_y + 18), width=s(416), height=s(24))

    bw, bh, label = s(170), s(42), max(int(13 * S), 9)
    add_button(
        canvas,
        s(240),
        s(button_y),
        keep(canvas, ui.pill(action_label, bw, bh, accent, icon=action_icon, size=label)),
        keep(canvas, ui.pill(action_label, bw, bh, accent_dark, icon=action_icon, size=label)),
        on_action,
    )
    add_button(
        canvas,
        s(420),
        s(button_y),
        keep(canvas, ui.pill("Check Sheets", bw, bh, ui.SOFT, text_colour=ui.NAVY, size=label)),
        keep(canvas, ui.pill("Check Sheets", bw, bh, ui.SOFT_DARK, text_colour=ui.NAVY, size=label)),
        on_open_folder,
    )

    win.bind("<Return>", lambda _e: on_action())
    return win, entry.get, message, extra_getters


def table_window(parent, title, rows, accent=ui.BLUE):
    """Show CSV rows as a styled table; first row is treated as the header."""
    win = tk.Toplevel(parent)
    win.title(title)
    S = dialog_scale(win)
    win.configure(bg=ui.WHITE)
    dark_titlebar(win)

    if not rows:
        rows = [["No data"]]
    columns = max(len(r) for r in rows)
    rows = [list(r) + [""] * (columns - len(r)) for r in rows]

    bar = tk.Frame(win, bg=accent, height=int(56 * S))
    bar.pack(fill="x")
    bar.pack_propagate(False)
    tk.Label(
        bar, text=title, bg=accent, fg=ui.WHITE, font=("Segoe UI Semibold", -int(19 * S))
    ).pack(side="left", padx=int(22 * S))

    outer = tk.Frame(win, bg=ui.WHITE)
    outer.pack(fill="both", expand=True, padx=int(14 * S), pady=int(14 * S))
    canvas = tk.Canvas(outer, bg=ui.WHITE, highlightthickness=0, bd=0)
    scroll = tk.Scrollbar(outer, orient="vertical", command=canvas.yview)
    grid = tk.Frame(canvas, bg=ui.WHITE)
    canvas.configure(yscrollcommand=scroll.set)
    canvas.pack(side="left", fill="both", expand=True)
    scroll.pack(side="right", fill="y")
    window_id = canvas.create_window((0, 0), window=grid, anchor="nw")
    grid.bind(
        "<Configure>", lambda _e: canvas.configure(scrollregion=canvas.bbox("all"))
    )
    canvas.bind("<Configure>", lambda e: canvas.itemconfig(window_id, width=e.width))
    canvas.bind_all(
        "<MouseWheel>", lambda e: canvas.yview_scroll(int(-e.delta / 120), "units")
    )

    widths = [
        min(max((len(str(r[c])) for r in rows), default=6) + 2, 26)
        for c in range(columns)
    ]
    for r, row in enumerate(rows):
        header = r == 0
        background = ui.NAVY if header else (ui.WHITE if r % 2 else "#f7fafd")
        colour = ui.WHITE if header else ui.NAVY
        for c, value in enumerate(row):
            tk.Label(
                grid,
                text=str(value),
                width=widths[c],
                bg=background,
                fg=colour,
                font=("Segoe UI Semibold" if header else "Segoe UI", -int(13 * S)),
                anchor="w",
                padx=int(10 * S),
                pady=int(7 * S),
            ).grid(row=r, column=c, sticky="nsew", padx=(0, 1), pady=(0, 1))

    win.update_idletasks()
    chrome = int(96 * S)  # title bar + surrounding padding
    wanted = grid.winfo_reqheight() + chrome
    height = min(wanted, int(win.winfo_screenheight() * 0.8))
    scrolls = wanted > height
    if not scrolls:
        scroll.pack_forget()
    width = min(
        grid.winfo_reqwidth() + int((44 if scrolls else 32) * S),
        int(win.winfo_screenwidth() * 0.9),
    )
    centre(win, width, height)
    return win
