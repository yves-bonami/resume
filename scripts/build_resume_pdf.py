from pathlib import Path
from xml.sax.saxutils import escape
from bs4 import BeautifulSoup
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
import subprocess
import json, re, sys

root = Path(__file__).resolve().parents[1]
lang = sys.argv[1] if len(sys.argv) > 1 else "nl"
assert lang in ("nl", "en")
translations = json.loads((root / f"src/locales/{lang}.json").read_text())


def tr(key):
    value = translations.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing {lang} translation: {key}")
    return value


source = subprocess.check_output(
    ["node", str(root / "scripts/pages.mjs"), "--pdf-source", lang], text=True
)
soup = BeautifulSoup(source, "html.parser")
for name, face in [("Body", "DejaVu Sans"), ("Bold", "DejaVu Sans:style=Bold")]:
    font = subprocess.check_output(["fc-match", "-f", "%{file}", face], text=True)
    pdfmetrics.registerFont(TTFont(name, font))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Bold")
pdf_path = root / (
    "public/Yves_Bonami_CV_EN.pdf" if lang == "en" else "public/Yves_Bonami_CV.pdf"
)
pdf_path.parent.mkdir(exist_ok=True)
c = canvas.Canvas(str(pdf_path), pagesize=(595.276, 841.89))
c.setTitle("Yves Bonami | Senior .NET Software Engineer")
c.setAuthor("Yves Bonami")
ink, muted, accent, border = [
    HexColor(v) for v in ["#172b3a", "#596873", "#b64e46", "#eedbd7"]
]
x, width, y = 42, 511.276, 790
styles = {
    "body": ParagraphStyle(
        "body", fontName="Body", fontSize=10.2, leading=14.5, textColor=ink
    ),
    "small": ParagraphStyle(
        "small", fontName="Body", fontSize=9.2, leading=13.2, textColor=muted
    ),
}


def text(el):
    return el.get_text(" ", strip=True)


def para(value, style="body", left=0, gap=0, available=None):
    global y
    p = Paragraph(value, styles[style])
    _, height = p.wrap(available or (width - left), 900)
    p.drawOn(c, x + left, y - height)
    y -= height + gap


def heading(value):
    global y
    y -= 24
    c.setFont("Bold", 10)
    c.setFillColor(accent)
    c.drawString(x, y, value.upper())
    tw = pdfmetrics.stringWidth(value.upper(), "Bold", 10)
    c.setStrokeColor(border)
    c.setLineWidth(0.6)
    c.line(x + tw + 12, y + 3, x + width, y + 3)
    y -= 23


def footer(page):
    assert y > 45, f"Page {page} overflows: {y}"
    c.setStrokeColor(border)
    c.setLineWidth(0.6)
    c.line(x, 34, x + width, 34)
    c.setFillColor(muted)
    c.setFont("Body", 7.5)
    c.drawString(x, 21, "Yves Bonami · Senior .NET Software Engineer")
    c.drawRightString(x + width, 21, f"{page} / 2")


def draw_job(job):
    global y
    start = y
    company = text(job.select_one(".job-heading h3"))
    role = text(job.select_one(".company"))
    location = text(job.select_one(".job-location"))
    date = text(job.select_one(".date")).replace("—", "-")
    c.setFillColor(ink)
    c.setFont("Bold", 12)
    c.drawString(x, y, company)
    c.setFillColor(muted)
    c.setFont("Body", 8.8)
    c.drawRightString(x + width, y, date)
    y -= 19
    c.setFillColor(accent)
    c.setFont("Body", 10)
    c.drawString(x, y, role + " · " + location)
    y -= 13
    para(escape(text(job.select_one(".scope"))), "small", gap=8)
    for li in job.select("li"):
        c.setFillColor(accent)
        c.circle(x + 2, y - 5, 1.3, fill=1, stroke=0)
        para(escape(text(li)), left=12, gap=4)
    c.setStrokeColor(border)
    c.setLineWidth(1)
    c.line(x - 12, start - 5, x - 12, y + 3)
    c.setFillColor(HexColor("#fcf1ee"))
    c.circle(x - 12, start + 3, 5.5, fill=1, stroke=0)
    c.setFillColor(accent)
    c.circle(x - 12, start + 3, 2.5, fill=1, stroke=0)
    y -= 18


profile = soup.select_one("#profiel")
photo_x, photo_y, photo_size = x, y - 40, 58
c.saveState()
clip = c.beginPath()
clip.circle(photo_x + photo_size / 2, photo_y + photo_size / 2, photo_size / 2)
c.clipPath(clip, stroke=0, fill=0)
c.drawImage(
    str(root / "public/yves-bonami.jpg"),
    photo_x,
    photo_y,
    width=photo_size,
    height=photo_size,
    mask="auto",
)
c.restoreState()
c.setStrokeColor(border)
c.setLineWidth(0.8)
c.circle(
    photo_x + photo_size / 2, photo_y + photo_size / 2, photo_size / 2, stroke=1, fill=0
)
c.setFont("Bold", 25)
c.setFillColor(ink)
c.drawString(x + 73, y, text(profile.h1))
c.setFont("Body", 11.2)
c.setFillColor(accent)
c.drawString(x + 73, y - 24, text(profile.select_one(".role")))
c.setStrokeColor(border)
c.line(367, y - 42, 367, y + 15)
c.setFont("Body", 8.6)
c.setFillColor(muted)
for i, el in enumerate(
    profile.select_one(".contact").find_all(["a", "span"], recursive=False)
):
    c.drawString(380, y + 2 - 14 * i, text(el))
    if el.name == "a":
        baseline = y + 2 - 14 * i
        c.linkURL(
            el["href"],
            (
                380,
                baseline - 2,
                380 + pdfmetrics.stringWidth(text(el), "Body", 8.6),
                baseline + 9,
            ),
            relative=0,
            thickness=0,
        )
y -= 49
heading(tr("sections.profile"))
para(escape(text(soup.select_one(".summary"))), gap=3)
heading(tr("sections.experience"))
jobs = soup.select("#ervaring .job")
for job in jobs[:2]:
    draw_job(job)
print("Page 1 bottom:", y)
footer(1)
c.showPage()
y = 772
c.setFillColor(ink)
c.setFont("Bold", 18)
c.drawString(x, y, "Yves Bonami")
c.setFillColor(accent)
c.setFont("Body", 10)
c.drawRightString(x + width, y, "Senior .NET Software Engineer")
y -= 7
heading(tr("pdf.experienceContinued"))
for job in jobs[2:]:
    draw_job(job)
heading(tr("sections.technicalSkills"))
groups = soup.select("#vaardigheden .skill-panel")
label_width = (
    max(pdfmetrics.stringWidth(text(group.h3), "Bold", 9.2) for group in groups) + 14
)
for group in groups:
    label = text(group.h3)
    values = ", ".join(text(t) for t in group.select(".tag"))
    c.setFont("Bold", 9.2)
    c.setFillColor(muted)
    c.drawString(x, y - 9.2, label)
    para(escape(values), "small", left=label_width, gap=6)
heading(tr("sections.tools"))
para("  |  ".join(escape(text(t)) for t in soup.select("#tools .tag")), "small")
heading(tr("sections.softSkills"))
items = soup.select("#soft-skills li")
col = (width - 12) / 2
for i in range(0, len(items), 2):
    row = items[i : i + 2]
    paragraphs = [Paragraph(escape(text(item)), styles["small"]) for item in row]
    heights = [p.wrap(col - 30, 300)[1] for p in paragraphs]
    height = max(heights) + 14
    for j, (p, h) in enumerate(zip(paragraphs, heights)):
        xx = x + j * (col + 12)
        c.setFillColor(HexColor("#f7fafb"))
        c.roundRect(xx, y - height, col, height, 5, fill=1, stroke=0)
        cy = y - height / 2
        c.setStrokeColor(accent)
        c.setLineWidth(0.8)
        c.circle(xx + 10, cy, 4, fill=0, stroke=1)
        check = c.beginPath()
        check.moveTo(xx + 8, cy)
        check.lineTo(xx + 9.5, cy - 1.5)
        check.lineTo(xx + 12.2, cy + 1.8)
        c.drawPath(check)
        p.drawOn(c, xx + 20, y - (height + h) / 2)
    y -= height + 8
heading(tr("pdf.educationLanguages"))
edu = soup.select_one("#opleiding")
para(
    "<b>"
    + escape(text(edu.h3))
    + "</b> | "
    + escape(text(edu.select_one(".scope")))
    + " | "
    + escape(text(edu.select_one(".date"))),
    "small",
    gap=5,
)
para(
    "  |  ".join(
        escape(text(el.strong)) + ": " + escape(text(el.span))
        for el in soup.select(".language")
    ),
    "small",
)
print("Page 2 bottom:", y)
footer(2)
c.save()
reader = PdfReader(pdf_path)
assert len(reader.pages) == 2
out = " ".join(" ".join(page.extract_text().split()) for page in reader.pages)
for el in soup.select(".summary, .job .scope, .job li, .tag, #soft-skills li"):
    value = " ".join(text(el).split())
    assert value in out, value
assert (
    "complex legacy integration" if lang == "en" else "complexe legacy-integratie"
) in out
assert "Software Engineer → Senior Software Engineer" in out
assert "OOP" not in out
assert "klantadvies" not in text(soup.select_one(".summary"))
print("Verified", lang, "two pages, exact website wording, and achievement.")
print(pdf_path)
