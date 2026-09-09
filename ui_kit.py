"""Drawing helpers for the Smart College UI.

Tkinter has no rounded corners, gradients or shadows, so the whole screen is
painted with Pillow and shown as a single image on a Canvas.  Only the buttons
are separate images, so they can swap to a hover state.
"""

import os

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------- palette ---

NAVY = "#0f2b52"
BLUE = "#1e6fe0"
BLUE_DARK = "#1750b5"
TEAL = "#0d9b7a"
TEAL_DARK = "#0a7d62"
PURPLE = "#7c3aed"
PURPLE_DARK = "#6428c7"
RED = "#ef4444"
RED_DARK = "#c62f2f"
GREY = "#64748b"
SLATE = "#5b7ba6"
WHITE = "#ffffff"
FOOTER = "#12294d"
FOOTER_TEXT = "#9fc0ea"
BORDER = "#dbe7f7"

TINT_BLUE = "#e8f1fe"
TINT_TEAL = "#e3f7f1"
TINT_PURPLE = "#f0e9fe"

SOFT = "#e8eef7"        # neutral secondary button
SOFT_DARK = "#d5e0ee"

BG_TOP = (238, 245, 255)
BG_BOTTOM = (206, 224, 250)

# ------------------------------------------------------------------ fonts ---

_FONT_DIR = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
_FAMILIES = {
    "regular": ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"),
    "semibold": ("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"),
    "bold": ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"),
}
_font_cache = {}


def font(size, weight="regular"):
    key = (size, weight)
    if key not in _font_cache:
        loaded = None
        for name in _FAMILIES[weight]:
            try:
                loaded = ImageFont.truetype(os.path.join(_FONT_DIR, name), size)
                break
            except OSError:
                try:
                    loaded = ImageFont.truetype(name, size)
                    break
                except OSError:
                    continue
        _font_cache[key] = loaded or ImageFont.load_default()
    return _font_cache[key]


# ------------------------------------------------------------- primitives ---


def gradient(size, top=BG_TOP, bottom=BG_BOTTOM):
    """Vertical gradient, drawn one row at a time then stretched."""
    w, h = size
    strip = Image.new("RGB", (1, h))
    px = strip.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return strip.resize((w, h), Image.BILINEAR).convert("RGBA")


def add_blobs(img):
    """The pale organic shapes drifting behind the page."""
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([-180, h * 0.30, w * 0.30, h * 1.10], fill=(255, 255, 255, 70))
    d.ellipse([w * 0.74, h * 0.16, w * 1.22, h * 0.86], fill=(255, 255, 255, 60))
    d.ellipse([w * 0.10, -140, w * 0.55, h * 0.20], fill=(255, 255, 255, 45))
    layer = layer.filter(ImageFilter.GaussianBlur(38))
    return Image.alpha_composite(img, layer)


def shadow_layer(size, shapes, blur=16, color=(15, 45, 95, 55), offset=(0, 6)):
    """One blurred layer holding every drop shadow on the page."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for box, radius in shapes:
        x0, y0, x1, y1 = box
        d.rounded_rectangle(
            [x0 + offset[0], y0 + offset[1], x1 + offset[0], y1 + offset[1]],
            radius=radius,
            fill=color,
        )
    return layer.filter(ImageFilter.GaussianBlur(blur))


def lighten(colour, amount):
    """Blend a colour towards white -- used for the pale bar in the chart icon."""
    return tuple(
        int(c + (255 - c) * amount) for c in ImageColor.getrgb(colour)[:3]
    )


def tint_of(colour):
    """The pale wash used behind an icon of this colour."""
    return lighten(colour, 0.88)


def centered(draw, cx, y, segments, fnt):
    """Draw [(text, colour), ...] as one centred run."""
    widths = [draw.textlength(text, font=fnt) for text, _ in segments]
    x = cx - sum(widths) / 2
    for (text, colour), width in zip(segments, widths):
        draw.text((x, y), text, font=fnt, fill=colour, anchor="lm")
        x += width


# ------------------------------------------------------------------ icons ---


def person(d, cx, cy, s, colour, badge=None, badge_ring=WHITE):
    """Head-and-shoulders silhouette, optionally with a '+' badge."""
    d.ellipse([cx - 0.30 * s, cy - 0.62 * s, cx + 0.30 * s, cy - 0.02 * s], fill=colour)
    d.pieslice(
        [cx - 0.52 * s, cy - 0.02 * s, cx + 0.52 * s, cy + 0.96 * s],
        start=180,
        end=360,
        fill=colour,
    )
    if badge:
        bx, by, r = cx + 0.44 * s, cy + 0.40 * s, 0.30 * s
        d.ellipse([bx - r - 2, by - r - 2, bx + r + 2, by + r + 2], fill=badge_ring)
        d.ellipse([bx - r, by - r, bx + r, by + r], fill=badge)
        arm = r * 0.52
        d.line([bx - arm, by, bx + arm, by], fill=badge_ring, width=max(2, int(s * 0.09)))
        d.line([bx, by - arm, bx, by + arm], fill=badge_ring, width=max(2, int(s * 0.09)))


def camera(d, cx, cy, s, colour, hole):
    d.rounded_rectangle(
        [cx - 0.62 * s, cy - 0.30 * s, cx + 0.62 * s, cy + 0.46 * s],
        radius=0.18 * s,
        fill=colour,
    )
    d.rounded_rectangle(
        [cx - 0.24 * s, cy - 0.50 * s, cx + 0.18 * s, cy - 0.24 * s],
        radius=0.08 * s,
        fill=colour,
    )
    r = 0.26 * s
    d.ellipse([cx - r, cy + 0.08 * s - r, cx + r, cy + 0.08 * s + r], fill=hole)
    d.ellipse(
        [cx + 0.36 * s, cy - 0.18 * s, cx + 0.48 * s, cy - 0.06 * s], fill=hole
    )


def bars(d, cx, cy, s, colour):
    base = cy + 0.50 * s
    width = 0.21 * s
    gap = 0.42 * s
    light = lighten(colour, 0.45)
    for i, (height, fill) in enumerate(
        ((0.40, light), (0.70, colour), (1.00, colour))
    ):
        x = cx + (i - 1) * gap
        d.rounded_rectangle(
            [x - width / 2, base - height * s, x + width / 2, base],
            radius=width / 2.4,
            fill=fill,
        )


def cap(d, cx, cy, s, colour):
    """Simplified graduation cap with laurel arcs."""
    d.polygon(
        [(cx, cy - 0.60 * s), (cx + 0.98 * s, cy - 0.16 * s),
         (cx, cy + 0.28 * s), (cx - 0.98 * s, cy - 0.16 * s)],
        fill=colour,
    )
    d.polygon(
        [(cx - 0.56 * s, cy + 0.02 * s), (cx + 0.56 * s, cy + 0.02 * s),
         (cx + 0.42 * s, cy + 0.58 * s), (cx - 0.42 * s, cy + 0.58 * s)],
        fill=colour,
    )
    width = max(2, int(s * 0.10))
    d.line(
        [cx + 0.98 * s, cy - 0.16 * s, cx + 0.98 * s, cy + 0.40 * s],
        fill=colour,
        width=width,
    )
    d.ellipse(
        [cx + 0.86 * s, cy + 0.36 * s, cx + 1.10 * s, cy + 0.60 * s], fill=colour
    )


def shield(d, cx, cy, s, colour, mark):
    d.polygon(
        [(cx, cy - 0.62 * s), (cx + 0.52 * s, cy - 0.36 * s),
         (cx + 0.52 * s, cy + 0.12 * s), (cx, cy + 0.62 * s),
         (cx - 0.52 * s, cy + 0.12 * s), (cx - 0.52 * s, cy - 0.36 * s)],
        fill=colour,
    )
    width = max(2, int(s * 0.13))
    d.line(
        [cx - 0.24 * s, cy, cx - 0.06 * s, cy + 0.20 * s, cx + 0.26 * s, cy - 0.22 * s],
        fill=mark,
        width=width,
        joint="curve",
    )


def calendar(d, cx, cy, s, colour):
    width = max(2, int(s * 0.12))
    d.rounded_rectangle(
        [cx - 0.52 * s, cy - 0.42 * s, cx + 0.52 * s, cy + 0.56 * s],
        radius=0.16 * s,
        outline=colour,
        width=width,
    )
    d.line(
        [cx - 0.52 * s, cy - 0.10 * s, cx + 0.52 * s, cy - 0.10 * s],
        fill=colour,
        width=width,
    )
    for dx in (-0.24, 0.24):
        d.line(
            [cx + dx * s, cy - 0.62 * s, cx + dx * s, cy - 0.34 * s],
            fill=colour,
            width=width,
        )
    d.rectangle(
        [cx - 0.22 * s, cy + 0.12 * s, cx - 0.10 * s, cy + 0.24 * s], fill=colour
    )


def code(d, cx, cy, s, colour):
    width = max(2, int(s * 0.13))
    d.line(
        [cx - 0.16 * s, cy - 0.36 * s, cx - 0.52 * s, cy, cx - 0.16 * s, cy + 0.36 * s],
        fill=colour,
        width=width,
        joint="curve",
    )
    d.line(
        [cx + 0.16 * s, cy - 0.36 * s, cx + 0.52 * s, cy, cx + 0.16 * s, cy + 0.36 * s],
        fill=colour,
        width=width,
        joint="curve",
    )
    d.line(
        [cx + 0.06 * s, cy - 0.44 * s, cx - 0.06 * s, cy + 0.44 * s],
        fill=colour,
        width=width,
    )


def exit_arrow(d, cx, cy, s, colour):
    width = max(2, int(s * 0.15))
    d.arc(
        [cx - 0.70 * s, cy - 0.50 * s, cx - 0.10 * s, cy + 0.50 * s],
        start=40,
        end=320,
        fill=colour,
        width=width,
    )
    d.line([cx - 0.06 * s, cy, cx + 0.54 * s, cy], fill=colour, width=width)
    d.line(
        [cx + 0.26 * s, cy - 0.26 * s, cx + 0.56 * s, cy, cx + 0.26 * s, cy + 0.26 * s],
        fill=colour,
        width=width,
        joint="curve",
    )


ICONS = {
    "person": lambda d, cx, cy, s, c, hole: person(d, cx, cy, s, c, badge=c, badge_ring=hole),
    "camera": camera,
    "bars": lambda d, cx, cy, s, c, hole: bars(d, cx, cy, s, c),
    "exit": lambda d, cx, cy, s, c, hole: exit_arrow(d, cx, cy, s, c),
}


# ---------------------------------------------------------------- buttons ---

PAD = 14


def pill(text, w, h, fill, icon=None, text_colour=WHITE, size=14):
    """A rounded button image, shadow included. Anchor it by its centre."""
    w, h = int(w), int(h)
    img = Image.new("RGBA", (w + 2 * PAD, h + 2 * PAD), (0, 0, 0, 0))
    box = [PAD, PAD, PAD + w, PAD + h]

    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle(
        [box[0], box[1] + 5, box[2], box[3] + 5], radius=h / 2, fill=(15, 45, 95, 70)
    )
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(7)))

    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=h / 2, fill=fill)

    fnt = font(size, "semibold")
    label_w = d.textlength(text, font=fnt)
    cy = PAD + h / 2
    if icon:
        icon_s = h * 0.36
        total = label_w + icon_s * 1.5 + 10
        x = PAD + (w - total) / 2
        ICONS[icon](d, x + icon_s * 0.75, cy, icon_s, text_colour, fill)
        d.text((x + icon_s * 1.5 + 10, cy), text, font=fnt, fill=text_colour, anchor="lm")
    else:
        d.text((PAD + w / 2, cy), text, font=fnt, fill=text_colour, anchor="mm")
    return img
