"""
Draws the nine sketchbook plates for the Projects section.

Each plate is one open spread at 1760x1240 - the exact aspect the sketchbook
component slices into a left and a right page - so a scene has to be composed
across the centre line (x=880) rather than split down it.

The look follows the reference spreads: ink linework with watercolour washes on
cream deckle-edged paper, the scene running across the gutter, and a
hand-lettered caption in the corner.

Artwork is built on two layers. Washes are filled shapes that get blurred
before compositing, which is what gives the paint its bleed; ink goes on top
crisp. Every coordinate is chosen to stay inside the page, and the deckle mask
crops whatever overhangs.

Run:  python tools/build-project-plates.py
Out:  public/landing-pages/meng-to-sketchbook/<slug>.png
"""

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1760, 1240
GUTTER = 880

PAPER = (243, 238, 227)
INK = (58, 48, 38)

# A small, deliberate palette. Everything is mixed from these so the nine
# plates read as one hand.
SEPIA = (154, 106, 62)
SLATE = (86, 116, 148)
SAGE = (122, 150, 118)
CLAY = (176, 104, 72)
SAND = (203, 174, 130)
MIST = (176, 186, 190)

FONTS = "C:/Windows/Fonts/"
SERIF = FONTS + "georgia.ttf"
SERIF_B = FONTS + "georgiab.ttf"
HAND = FONTS + "Inkfree.ttf"
MONO = FONTS + "consola.ttf"
# Nirmala UI is the only face here with Devanagari, which the Nepali calendar
# plate needs for its month name.
DEVA = FONTS + "Nirmala.ttc"

OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "landing-pages", "meng-to-sketchbook",
)

# where the scene lives, and where the caption sits
SCENE = (120, 165, 1640, 1000)


def font(path, size):
    return ImageFont.truetype(path, size)


def dev(size):
    return ImageFont.truetype(DEVA, size, index=0)


def alpha(c, a):
    """Re-alpha an RGB/RGBA tuple."""
    return (c[0], c[1], c[2], a)


# --------------------------------------------------------------- paper


def deckle_mask(seed):
    """A torn edge, so the sheet reads as a loose sheet rather than a crop.

    The boundary sits just inside the canvas and every nibble is centred on it,
    so the tear eats the margin and not the sheet.
    """
    rnd = random.Random(seed)
    inset = 4
    step = 15
    top = [(x, inset + rnd.uniform(-5, 5)) for x in range(-inset, W + inset, step)]
    right = [(W - inset + rnd.uniform(-5, 5), y) for y in range(inset, H + inset, step)]
    bottom = [(x, H - inset + rnd.uniform(-5, 5)) for x in range(W + inset, -inset, -step)]
    left = [(inset + rnd.uniform(-5, 5), y) for y in range(H + inset, -inset, -step)]

    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(top + right + bottom + left, fill=255)

    d = ImageDraw.Draw(mask)
    for edge in (top, right, bottom, left):
        for px, py in edge:
            if rnd.random() > 0.55:
                continue
            r = rnd.uniform(2, 5.5)
            d.ellipse([px - r, py - r, px + r, py + r], fill=0)
    return mask.filter(ImageFilter.GaussianBlur(0.8))


def paper(seed):
    """Cream stock: a warm lift, tooth, the crease at the gutter, a soft edge."""
    rnd = random.Random(seed)
    img = Image.new("RGBA", (W, H), PAPER + (255,))
    d = ImageDraw.Draw(img)

    for y in range(H):
        t = y / H
        lift = 7 * (1 - t) - 5 * t
        d.line([(0, y), (W, y)],
               fill=(int(PAPER[0] + lift), int(PAPER[1] + lift), int(PAPER[2] + lift * 0.8), 255))

    tooth = Image.new("L", (W // 2, H // 2))
    td = ImageDraw.Draw(tooth)
    for _ in range(24000):
        td.point((rnd.randrange(W // 2), rnd.randrange(H // 2)), fill=rnd.randrange(120, 190))
    tooth = tooth.resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.4))
    img = Image.composite(Image.new("RGBA", (W, H), (124, 110, 92, 255)), img,
                          tooth.point(lambda v: int(v * 0.12)))

    d = ImageDraw.Draw(img)

    # the crease: a soft dip either side of the gutter, not a hard line
    gut = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(gut)
    for i in range(120):
        a = int(58 * (1 - abs(i - 60) / 60.0) ** 1.7)
        gd.line([(GUTTER - 60 + i, 0), (GUTTER - 60 + i, H)], fill=a)
    gut = gut.filter(ImageFilter.GaussianBlur(26))
    img = Image.composite(Image.new("RGBA", (W, H), (150, 138, 118, 255)), img, gut)

    # the sheet lifts slightly off the surface it lies on
    vig = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vig)
    for i in range(120):
        a = int(40 * (1 - i / 120.0) ** 2)
        vd.rectangle([i, i, W - 1 - i, H - 1 - i], outline=a)
    vig = vig.filter(ImageFilter.GaussianBlur(34))
    img = Image.composite(Image.new("RGBA", (W, H), (96, 84, 68, 255)), img, vig)

    img.putalpha(deckle_mask(seed))
    return img


# ------------------------------------------------------------- ink & wash


def _clip(x1, y1, x2, y2, box):
    """Clip a line to a box (Liang-Barsky). Returns the segment, or None."""
    x0, y0, x1b, y1b = box
    dx, dy = x2 - x1, y2 - y1
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x1 - x0), (dx, x1b - x1), (-dy, y1 - y0), (dy, y1b - y1)):
        if p == 0:
            if q < 0:
                return None
        else:
            r = q / p
            if p < 0:
                if r > t1:
                    return None
                t0 = max(t0, r)
            else:
                if r < t0:
                    return None
                t1 = min(t1, r)
    return (x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy)


class Art:
    """One plate's drawing: crisp ink, and washes that bleed when composited."""

    def __init__(self, seed):
        self.ink = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.i = ImageDraw.Draw(self.ink)
        self.w = ImageDraw.Draw(self.wash)
        self.rnd = random.Random(seed)

    # -- ink ------------------------------------------------------------
    def _jit(self, x, y, amt=1.8):
        return (x + self.rnd.uniform(-amt, amt), y + self.rnd.uniform(-amt, amt))

    def path(self, pts, colour=INK, width=5, passes=2, close=False, amt=1.8):
        p = list(pts) + ([pts[0]] if close else [])
        for _ in range(passes):
            self.i.line([self._jit(x, y, amt) for x, y in p], fill=colour, width=width,
                        joint="curve")

    def line(self, x1, y1, x2, y2, colour=INK, width=5, passes=2, amt=1.8):
        self.path([(x1, y1), (x2, y2)], colour, width, passes, amt=amt)

    def rect(self, box, colour=INK, width=5, passes=2, radius=0):
        x1, y1, x2, y2 = box
        if radius:
            for _ in range(passes):
                self.i.rounded_rectangle(box, radius=radius, outline=colour, width=width)
            return
        self.path([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], colour, width, passes, close=True)

    def ellipse(self, box, colour=INK, width=5, passes=2):
        for _ in range(passes):
            self.i.ellipse(box, outline=colour, width=width)

    def arc(self, box, start, end, colour=INK, width=5, passes=2):
        for _ in range(passes):
            self.i.arc(box, start, end, fill=colour, width=width)

    def dot(self, x, y, r=5, colour=INK):
        self.i.ellipse([x - r, y - r, x + r, y + r], fill=colour)

    # -- washes ----------------------------------------------------------
    # Every wash edge is nudged off true, because a watercolour boundary is
    # never a straight line - and a crisp one reads as a filled rectangle.
    def _rough(self, pts):
        return [(x + self.rnd.uniform(-5, 5), y + self.rnd.uniform(-5, 5)) for x, y in pts]

    def wpath(self, pts, colour, a=110, close=True):
        p = self._rough(pts)
        self.w.polygon(p + ([p[0]] if close else []), fill=alpha(colour, a))

    def wrect(self, box, colour, a=110, radius=0):
        x1, y1, x2, y2 = box
        if radius:
            self.w.rounded_rectangle(box, radius=radius, fill=alpha(colour, a))
        else:
            self.wpath([(x1, y1), (x2, y1), (x2, y2), (x1, y2)], colour, a)

    def wellipse(self, box, colour, a=110):
        self.w.ellipse(box, fill=alpha(colour, a))

    def wband(self, y0, y1, colour, a=110, step=120):
        """A full-width band whose far edge wanders, for skies and ground."""
        pts = [(0, y0), (W, y0)]
        x = W
        while x >= 0:
            pts.append((x, y1 + self.rnd.uniform(-14, 14)))
            x -= step
        self.wpath(pts, colour, a)

    def shadow(self, cx, cy, rx, ry, a=90, colour=INK):
        """A soft pool under an object - the cheapest way to stop it floating."""
        self.w.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=alpha(colour, a))

    def hatch(self, box, gap=16, angle=45, colour=INK, a=95, width=3):
        """Tone built from short strokes, the way a sketch shades rather than fills."""
        x0, y0, x1, y1 = box
        dx, dy = x1 - x0, y1 - y0
        m = math.tan(math.radians(angle))
        if abs(angle) == 45 or abs(angle) == 135:
            span = abs(dx) + abs(dy)
            for c in range(-span, span, gap):
                seg = _clip(x0, y0 + c, x0 + span, y0 + c + m * span, box)
                if seg:
                    self.i.line(seg, fill=alpha(colour, a), width=width)
        else:
            for y in range(int(y0), int(y1), gap):
                self.i.line([(x0, y), (x1, y)], fill=alpha(colour, a), width=width)

    def tone(self, pts, colour, a=110, shade=0.45):
        """A wash plus a darker, offset copy - the build-up of two passes."""
        self.wpath(pts, colour, a)
        off = 7
        self.wpath([(x + off, y + off * 0.7) for x, y in pts], colour, int(a * shade))

    def compose(self, base):
        """A soft bleed, a tighter core, an offset pass, then the ink."""
        for blur, k, dx in ((16, 0.8, 0), (6, 0.5, 0), (3, 0.35, 5)):
            lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            lay.paste(self.wash, (dx, int(dx * 0.7)), self.wash)
            lay = lay.filter(ImageFilter.GaussianBlur(blur))
            lay.putalpha(lay.getchannel("A").point(lambda v: int(v * k)))
            base.alpha_composite(lay)
        base.alpha_composite(self.ink)


# ------------------------------------------------------------- lettering


def text(d, xy, s, f, colour=INK, anchor=None):
    d.text(xy, s, font=f, fill=colour, anchor=anchor)


def tracked(d, xy, s, f, colour, track=5):
    """Letter-spaced small caps, the way a plate is signed."""
    x, y = xy
    for ch in s:
        d.text((x, y), ch, font=f, fill=colour)
        x += d.textlength(ch, font=f) + track


def caption(a, name, stack):
    """The hand-lettered signature in the corner of the spread.

    The reference prints its caption straight over the artwork, so this does
    too - but over a soft patch of paper, or the ink disappears into the paint.
    """
    f1 = font(HAND, 30)
    f2 = font(HAND, 22)
    w = max(textwidth(name, f1, 3), textwidth(stack, f2, 2))
    x = SCENE[2] - 40 - w
    y = SCENE[3] + 62
    a.wrect((x - 70, y - 60, SCENE[2] + 40, y + 180), PAPER, 250, radius=26)
    tracked(a.i, (x, y), name.upper(), f1, alpha(INK, 225), track=3)
    tracked(a.i, (x + 4, y + 50), stack.upper(), f2, alpha(INK, 140), track=2)


def textwidth(s, f, track):
    # tracked() advances by glyph width plus tracking for every character
    return sum(f.getlength(c) + track for c in s)


def plate_mark(a, number):
    """A small plate number, top left, so the spread can be found in the book."""
    tracked(a.i, (SCENE[0], SCENE[1]), "PLATE " + number, font(HAND, 20),
            alpha(INK, 120), track=4)


def figure(a, x, y, s, colour=CLAY):
    """A small standing figure - the cheapest way to give a scene its scale."""
    w = max(3, int(5 * s))
    a.wellipse((x - 26 * s, y - 150 * s, x + 26 * s, y - 98 * s), colour, 200)
    a.ellipse((x - 26 * s, y - 150 * s, x + 26 * s, y - 98 * s), width=w)
    body = [(x - 32 * s, y - 96 * s), (x + 32 * s, y - 96 * s),
            (x + 38 * s, y - 24 * s), (x - 38 * s, y - 24 * s)]
    a.wpath(body, colour, 190)
    a.path(body, width=w, close=True)
    a.line(x - 30 * s, y - 24 * s, x - 46 * s, y, width=w)
    a.line(x + 30 * s, y - 24 * s, x + 46 * s, y, width=w)
    a.line(x - 28 * s, y - 88 * s, x - 58 * s, y - 44 * s, width=w, passes=1)
    a.line(x + 28 * s, y - 88 * s, x + 58 * s, y - 46 * s, width=w, passes=1)


# ------------------------------------------------------------ the sketches


PROJECTS = [
    dict(slug="nepali-date-widget", number="01 / 09",
         title="Nepali Date Widget", kicker="Real-world project",
         stack="C++ / Windows",
         blurb="A lightweight, native C++ desktop widget that keeps the Nepali date "
               "to hand on a Windows machine, without asking for an installer.",
         bullets=["Native Win32 desktop widget",
                  "Nepali Bikram Sambat conversion",
                  "Single executable, no setup"],
         link="aayushlbef.github.io/Nepali-Date-Widget",
         notes=[("Type", "Desktop widget"), ("Language", "C++"),
                ("Platform", "Windows"), ("Status", "Shipped")],
         note="Built to be small enough to sit in the corner of the screen all day."),
    dict(slug="car-obstacle-game", number="02 / 09",
         title="Car Obstacle Game", kicker="Real-world project",
         stack="HTML / CSS / JS",
         blurb="A car game made in plain HTML, CSS and JavaScript - dodge what comes "
               "down the road and keep the score you drove.",
         bullets=["Keyboard controls",
                  "Score kept as you go",
                  "No engine, no framework"],
         link="github.com/aayushlbef/Car-Obstacle-Game",
         notes=[("Type", "Browser game"), ("Language", "JavaScript"),
                ("Built with", "HTML / CSS"), ("Status", "Shipped")],
         note="The first thing I finished end to end, start to deploy."),
    dict(slug="terminal-editor", number="03 / 09",
         title="Terminal Editor", kicker="Real-world project",
         stack="Web / Terminal UI",
         blurb="A text editor webpage that recreates the look and feel of a terminal, "
               "so writing on the web reads like working in one.",
         bullets=["Terminal styling in CSS",
                  "Editable text area",
                  "Responds to the keyboard"],
         link="aayushlbef.github.io/TerminalEditor",
         notes=[("Type", "Web app"), ("Language", "JavaScript"),
                ("Built with", "HTML / CSS"), ("Status", "Live")],
         note="The look was the whole point - every glyph earned its place."),
    dict(slug="medical-center-management", number="04 / 09",
         title="Medical Center Mgmt", kicker="Academic project",
         stack="Java / Academic",
         blurb="A Java project for managing a medical centre: patients, appointments "
               "and records held in one place instead of a stack of registers.",
         bullets=["Patient records",
                  "Appointment scheduling",
                  "Stored in a database"],
         link="github.com/aayushlbef/APU-Medical-Center-Management-Software",
         notes=[("Type", "Desktop system"), ("Language", "Java"),
                ("Database", "MS SQL"), ("Status", "Complete")],
         note="An academic submission, and the biggest thing I had written so far."),
    dict(slug="restaurant-management", number="05 / 09",
         title="Restaurant Management", kicker="Academic project",
         stack="Python / Academic",
         blurb="A Python project for running a restaurant - the menu, the orders and "
               "the bill all handled from the console.",
         bullets=["Menu and order handling",
                  "Bill generated per table",
                  "Console interface"],
         link="github.com/aayushlbef/Resturant-Management-System",
         notes=[("Type", "Console system"), ("Language", "Python"),
                ("Interface", "Terminal"), ("Status", "Complete")],
         note="My first real Python program that did something other than homework."),
    dict(slug="health-and-wellness", number="06 / 09",
         title="Health & Wellness Site", kicker="Academic project",
         stack="Web / Student Org",
         blurb="A website for a student organisation, covering health and wellness "
               "for the people it was set up to help.",
         bullets=["Built for a student body",
                  "Health and wellness content",
                  "Team of six"],
         link="github.com/aayushlbef/FDD-Assignment-Team6",
         notes=[("Type", "Website"), ("Built with", "HTML / CSS / JS"),
                ("Team", "Six"), ("Status", "Delivered")],
         note="My first group project - I wrote the front end, I learned a lot."),
    dict(slug="todo-app", number="07 / 09",
         title="Todo App", kicker="Academic project",
         stack="React",
         blurb="A todo list app made with React - add what needs doing, tick it off, "
               "and watch the list get shorter.",
         bullets=["Built with React",
                  "State held in components",
                  "Items tick off and clear"],
         link="github.com/aayushlbef/Todo-App",
         notes=[("Type", "Web app"), ("Framework", "React"),
                ("Language", "JavaScript"), ("Status", "Shipped")],
         note="Small, but the one that taught me how state actually flows."),
    dict(slug="movie-ticket-booking", number="08 / 09",
         title="Movie Ticket Booking", kicker="Academic project",
         stack="C / Academic",
         blurb="A C project for managing a ticket booking system: shows, seats and "
               "who is sitting in which one.",
         bullets=["Show and seat selection",
                  "Bookings written to file",
                  "Written in plain C"],
         link="github.com/aayushlbef/Movie-Ticket-Booking-System",
         notes=[("Type", "Console system"), ("Language", "C"),
                ("Storage", "File based"), ("Status", "Complete")],
         note="Writing this in C is where I stopped guessing and started reading docs."),
    dict(slug="the-stack", number="09 / 09",
         title="The Stack", kicker="Toolkit",
         stack="Toolkit",
         blurb="The toolkit behind this sketchbook: the generator and the type "
               "settings that every spread you are turning through was built with.",
         bullets=["Ruled notebook spreads",
                  "Generated plate by plate",
                  "Kept in a single script"],
         link="aayushlbef.github.io",
         notes=[("Type", "Toolkit"), ("Written in", "Python"),
                ("Output", "PNG plates"), ("Status", "In use")],
         note="The plates in here are generated, not drawn by hand - same rules each time."),
]


def wrap(text, f, maxw):
    """Break a line of text to a pixel width, the way a page would.

    A URL has no spaces in it to break on, so any token too long to fit on its
    own is split by character first, or it runs straight off the page.
    """
    words = []
    for word in text.split():
        if f.getlength(word) <= maxw:
            words.append(word)
            continue
        part = ""
        for ch in word:
            if part and f.getlength(part + ch) > maxw:
                words.append(part)
                part = ch
            else:
                part += ch
        if part:
            words.append(part)

    lines, cur = [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if not cur or f.getlength(trial) <= maxw:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def sketch_page(a, seed, p):
    """One spread: ruled paper, and the project typed onto it."""
    f_kick = font(HAND, 22)
    f_mono = font(MONO, 25)
    f_body = font(SERIF, 29)
    f_bul = font(SERIF, 26)
    f_note = font(HAND, 26)
    f_lab = font(HAND, 20)
    f_val = font(SERIF, 29)

    # a long title steps down a size or two rather than run past the margin
    tsize = 72
    while tsize > 38 and font(SERIF_B, tsize).getlength(p["title"]) > 548:
        tsize -= 2
    f_title = font(SERIF_B, tsize)

    # the rules, dipping towards the gutter the way a bound page does
    y = 232
    while y < 1152:
        a.path([(0, y), (600, y + 7), (880, y + 17), (1160, y + 7), (1760, y)],
               alpha(INK, 42), width=2, passes=1)
        y += 46

    # the margin each page is written against
    for mx in (236, 1000):
        a.line(mx, 172, mx, 1152, alpha(CLAY, 150), width=3, passes=1)

    # ---- left page: what it is
    tracked(a.i, (284, 238), p["kicker"].upper(), f_kick, alpha(INK, 155), track=5)
    a.i.text((284, 278), p["title"], font=f_title, fill=alpha(INK, 240))
    a.line(284, 392, 832, 392, alpha(INK, 115), width=4, passes=1)
    a.i.text((284, 408), p["stack"], font=f_mono, fill=alpha(INK, 170))

    y = 476
    for ln in wrap(p["blurb"], f_body, 546):
        a.i.text((284, y), ln, font=f_body, fill=alpha(INK, 215))
        y += 46

    y += 22
    for b in p["bullets"]:
        lines = wrap(b, f_bul, 512)
        a.dot(296, y + 16, 5, alpha(INK, 185))
        for i, ln in enumerate(lines):
            a.i.text((320, y + i * 40 - 8), ln, font=f_bul, fill=alpha(INK, 195))
        y += len(lines) * 40 + 10

    y += 22
    a.line(284, y, 832, y, alpha(INK, 90), width=3, passes=1)
    a.i.text((284, y + 22), "LINK", font=f_lab, fill=alpha(INK, 150))
    for i, ln in enumerate(wrap(p["link"], f_mono, 540)):
        a.i.text((284, y + 52 + i * 34), ln, font=f_mono, fill=alpha(SEPIA, 235))

    # ---- right page: the details, in the facing margin
    tracked(a.i, (1052, 238), "DETAILS", f_kick, alpha(INK, 155), track=5)
    y = 288
    for k, v in p["notes"]:
        lines = wrap(v, f_val, 430)
        a.i.text((1052, y), k.upper(), font=f_lab, fill=alpha(INK, 150))
        for i, ln in enumerate(lines):
            a.i.text((1052, y + 28 + i * 40), ln, font=f_val, fill=alpha(INK, 225))
        y += 74 + (len(lines) - 1) * 40

    # a note jotted down in the box, the way a builder leaves one
    y += 12
    a.wrect((1052, y, 1656, y + 172), PAPER, 250, radius=10)
    a.rect((1052, y, 1656, y + 172), width=3, radius=10)
    tracked(a.i, (1076, y + 22), "NOTE", f_lab, alpha(INK, 150), track=4)
    ny = y + 54
    for ln in wrap(p["note"], f_note, 552):
        a.i.text((1076, ny), ln, font=f_note, fill=alpha(INK, 205))
        ny += 38

    caption(a, p["title"], p["stack"])


PLATES = [dict(slug=p["slug"], sketch=sketch_page, number=p["number"], data=p)
          for p in PROJECTS]


def build(seed, plate):
    img = paper(seed)
    a = Art(seed + 7)
    plate["sketch"](a, seed, plate["data"])
    plate_mark(a, plate["number"])
    a.compose(img)

    path = os.path.join(OUT, plate["slug"] + ".png")
    img.save(path, "PNG", optimize=True)
    return path


def main():
    os.makedirs(OUT, exist_ok=True)
    for i, plate in enumerate(PLATES):
        print("wrote", build(2000 + i * 13, plate))


if __name__ == "__main__":
    main()