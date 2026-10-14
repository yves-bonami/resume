import json
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from bs4 import BeautifulSoup
from pypdf import PdfReader
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[1]
PAGE_SIZE = (595.276, 841.89)
PAGE_COUNT = 2
CONTENT_LEFT = 42
CONTENT_WIDTH = 511.276
FIRST_PAGE_TOP = 790
CONTINUATION_PAGE_TOP = 772
MINIMUM_CONTENT_BOTTOM = 45
FOOTER_LINE_Y = 34
FOOTER_TEXT_Y = 21
HEADING_SPACE_BEFORE = 24
HEADING_SPACE_AFTER = 23
JOB_SPACE_AFTER = 18
PHOTO_SIZE = 58
CONTACT_LEFT = 380
CONTACT_LINE_HEIGHT = 14
SOFT_SKILL_COLUMN_GAP = 12
SOFT_SKILL_ROW_GAP = 8

INK = HexColor("#172b3a")
MUTED = HexColor("#596873")
ACCENT = HexColor("#b64e46")
BORDER = HexColor("#eedbd7")
TIMELINE_FILL = HexColor("#fcf1ee")
SOFT_SKILL_FILL = HexColor("#f7fafb")
NAME = "Yves Bonami"
ROLE = "Senior .NET Software Engineer"


def element_text(element):
    return element.get_text(" ", strip=True)


def register_fonts():
    for name, face in [("Body", "DejaVu Sans"), ("Bold", "DejaVu Sans:style=Bold")]:
        font = subprocess.check_output(["fc-match", "-f", "%{file}", face], text=True)
        pdfmetrics.registerFont(TTFont(name, font))
    pdfmetrics.registerFontFamily("Body", normal="Body", bold="Bold")


class ResumePdf:
    def __init__(self, output_path, document, translations, language):
        self.document = document
        self.translations = translations
        self.language = language
        self.cursor_y = FIRST_PAGE_TOP
        self.canvas = canvas.Canvas(str(output_path), pagesize=PAGE_SIZE)
        self.canvas.setTitle(f"{NAME} | {ROLE}")
        self.canvas.setAuthor(NAME)
        self.styles = {
            "body": ParagraphStyle(
                "body", fontName="Body", fontSize=10.2, leading=14.5, textColor=INK
            ),
            "small": ParagraphStyle(
                "small", fontName="Body", fontSize=9.2, leading=13.2, textColor=MUTED
            ),
        }

    def translate(self, key):
        value = self.translations.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Missing {self.language} translation: {key}")
        return value

    def draw_paragraph(
        self, content, style_name="body", indent=0, space_after=0, available_width=None
    ):
        paragraph = Paragraph(content, self.styles[style_name])
        _, paragraph_height = paragraph.wrap(
            available_width or (CONTENT_WIDTH - indent), 900
        )
        paragraph.drawOn(
            self.canvas, CONTENT_LEFT + indent, self.cursor_y - paragraph_height
        )
        self.cursor_y -= paragraph_height + space_after

    def draw_heading(self, title):
        self.cursor_y -= HEADING_SPACE_BEFORE
        self.canvas.setFont("Bold", 10)
        self.canvas.setFillColor(ACCENT)
        self.canvas.drawString(CONTENT_LEFT, self.cursor_y, title.upper())
        heading_width = pdfmetrics.stringWidth(title.upper(), "Bold", 10)
        self.canvas.setStrokeColor(BORDER)
        self.canvas.setLineWidth(0.6)
        self.canvas.line(
            CONTENT_LEFT + heading_width + 12,
            self.cursor_y + 3,
            CONTENT_LEFT + CONTENT_WIDTH,
            self.cursor_y + 3,
        )
        self.cursor_y -= HEADING_SPACE_AFTER

    def draw_footer(self, page):
        assert (
            self.cursor_y > MINIMUM_CONTENT_BOTTOM
        ), f"Page {page} overflows: {self.cursor_y}"
        self.canvas.setStrokeColor(BORDER)
        self.canvas.setLineWidth(0.6)
        self.canvas.line(
            CONTENT_LEFT, FOOTER_LINE_Y, CONTENT_LEFT + CONTENT_WIDTH, FOOTER_LINE_Y
        )
        self.canvas.setFillColor(MUTED)
        self.canvas.setFont("Body", 7.5)
        self.canvas.drawString(CONTENT_LEFT, FOOTER_TEXT_Y, f"{NAME} · {ROLE}")
        self.canvas.drawRightString(
            CONTENT_LEFT + CONTENT_WIDTH, FOOTER_TEXT_Y, f"{page} / {PAGE_COUNT}"
        )

    def draw_job(self, job):
        job_top = self.cursor_y
        company = element_text(job.select_one(".job-heading h3"))
        role = element_text(job.select_one(".company"))
        location = element_text(job.select_one(".job-location"))
        date = element_text(job.select_one(".date")).replace("—", "-")
        self.canvas.setFillColor(INK)
        self.canvas.setFont("Bold", 12)
        self.canvas.drawString(CONTENT_LEFT, self.cursor_y, company)
        self.canvas.setFillColor(MUTED)
        self.canvas.setFont("Body", 8.8)
        self.canvas.drawRightString(CONTENT_LEFT + CONTENT_WIDTH, self.cursor_y, date)
        self.cursor_y -= 19
        self.canvas.setFillColor(ACCENT)
        self.canvas.setFont("Body", 10)
        self.canvas.drawString(CONTENT_LEFT, self.cursor_y, role + " · " + location)
        self.cursor_y -= 13
        self.draw_paragraph(
            escape(element_text(job.select_one(".scope"))), "small", space_after=8
        )
        for bullet in job.select("li"):
            self.canvas.setFillColor(ACCENT)
            self.canvas.circle(
                CONTENT_LEFT + 2, self.cursor_y - 5, 1.3, fill=1, stroke=0
            )
            self.draw_paragraph(escape(element_text(bullet)), indent=12, space_after=4)
        self.canvas.setStrokeColor(BORDER)
        self.canvas.setLineWidth(1)
        self.canvas.line(
            CONTENT_LEFT - 12, job_top - 5, CONTENT_LEFT - 12, self.cursor_y + 3
        )
        self.canvas.setFillColor(TIMELINE_FILL)
        self.canvas.circle(CONTENT_LEFT - 12, job_top + 3, 5.5, fill=1, stroke=0)
        self.canvas.setFillColor(ACCENT)
        self.canvas.circle(CONTENT_LEFT - 12, job_top + 3, 2.5, fill=1, stroke=0)
        self.cursor_y -= JOB_SPACE_AFTER

    def draw_header(self):
        profile = self.document.select_one("#profiel")
        photo_left, photo_bottom = CONTENT_LEFT, self.cursor_y - 40
        self.canvas.saveState()
        clip = self.canvas.beginPath()
        clip.circle(
            photo_left + PHOTO_SIZE / 2, photo_bottom + PHOTO_SIZE / 2, PHOTO_SIZE / 2
        )
        self.canvas.clipPath(clip, stroke=0, fill=0)
        self.canvas.drawImage(
            str(ROOT / "public/yves-bonami.jpg"),
            photo_left,
            photo_bottom,
            width=PHOTO_SIZE,
            height=PHOTO_SIZE,
            mask="auto",
        )
        self.canvas.restoreState()
        self.canvas.setStrokeColor(BORDER)
        self.canvas.setLineWidth(0.8)
        self.canvas.circle(
            photo_left + PHOTO_SIZE / 2,
            photo_bottom + PHOTO_SIZE / 2,
            PHOTO_SIZE / 2,
            stroke=1,
            fill=0,
        )
        self.canvas.setFont("Bold", 25)
        self.canvas.setFillColor(INK)
        self.canvas.drawString(
            CONTENT_LEFT + 73, self.cursor_y, element_text(profile.h1)
        )
        self.canvas.setFont("Body", 11.2)
        self.canvas.setFillColor(ACCENT)
        self.canvas.drawString(
            CONTENT_LEFT + 73,
            self.cursor_y - 24,
            element_text(profile.select_one(".role")),
        )
        self.canvas.setStrokeColor(BORDER)
        self.canvas.line(367, self.cursor_y - 42, 367, self.cursor_y + 15)
        self.canvas.setFont("Body", 8.6)
        self.canvas.setFillColor(MUTED)
        for contact_index, element in enumerate(
            profile.select_one(".contact").find_all(["a", "span"], recursive=False)
        ):
            self.canvas.drawString(
                CONTACT_LEFT,
                self.cursor_y + 2 - CONTACT_LINE_HEIGHT * contact_index,
                element_text(element),
            )
            if element.name == "a":
                baseline = self.cursor_y + 2 - CONTACT_LINE_HEIGHT * contact_index
                self.canvas.linkURL(
                    element["href"],
                    (
                        CONTACT_LEFT,
                        baseline - 2,
                        CONTACT_LEFT
                        + pdfmetrics.stringWidth(element_text(element), "Body", 8.6),
                        baseline + 9,
                    ),
                    relative=0,
                    thickness=0,
                )
        self.cursor_y -= 49

    def draw_continuation_header(self):
        self.cursor_y = CONTINUATION_PAGE_TOP
        self.canvas.setFillColor(INK)
        self.canvas.setFont("Bold", 18)
        self.canvas.drawString(CONTENT_LEFT, self.cursor_y, NAME)
        self.canvas.setFillColor(ACCENT)
        self.canvas.setFont("Body", 10)
        self.canvas.drawRightString(CONTENT_LEFT + CONTENT_WIDTH, self.cursor_y, ROLE)
        self.cursor_y -= 7

    def draw_technical_skills(self):
        groups = self.document.select("#vaardigheden .skill-panel")
        label_width = (
            max(
                pdfmetrics.stringWidth(element_text(group.h3), "Bold", 9.2)
                for group in groups
            )
            + 14
        )
        for group in groups:
            label = element_text(group.h3)
            values = ", ".join(element_text(tag) for tag in group.select(".tag"))
            self.canvas.setFont("Bold", 9.2)
            self.canvas.setFillColor(MUTED)
            self.canvas.drawString(CONTENT_LEFT, self.cursor_y - 9.2, label)
            self.draw_paragraph(
                escape(values), "small", indent=label_width, space_after=6
            )

    def draw_tools(self):
        self.draw_paragraph(
            "  |  ".join(
                escape(element_text(tag)) for tag in self.document.select("#tools .tag")
            ),
            "small",
        )

    def draw_soft_skills(self):
        items = self.document.select("#soft-skills li")
        column_width = (CONTENT_WIDTH - SOFT_SKILL_COLUMN_GAP) / 2
        for row_start in range(0, len(items), 2):
            row = items[row_start : row_start + 2]
            paragraphs = [
                Paragraph(escape(element_text(item)), self.styles["small"])
                for item in row
            ]
            heights = [
                paragraph.wrap(column_width - 30, 300)[1] for paragraph in paragraphs
            ]
            row_height = max(heights) + 14
            for column_index, (paragraph, paragraph_height) in enumerate(
                zip(paragraphs, heights)
            ):
                card_left = CONTENT_LEFT + column_index * (
                    column_width + SOFT_SKILL_COLUMN_GAP
                )
                self.canvas.setFillColor(SOFT_SKILL_FILL)
                self.canvas.roundRect(
                    card_left,
                    self.cursor_y - row_height,
                    column_width,
                    row_height,
                    5,
                    fill=1,
                    stroke=0,
                )
                icon_center_y = self.cursor_y - row_height / 2
                self.canvas.setStrokeColor(ACCENT)
                self.canvas.setLineWidth(0.8)
                self.canvas.circle(card_left + 10, icon_center_y, 4, fill=0, stroke=1)
                check = self.canvas.beginPath()
                check.moveTo(card_left + 8, icon_center_y)
                check.lineTo(card_left + 9.5, icon_center_y - 1.5)
                check.lineTo(card_left + 12.2, icon_center_y + 1.8)
                self.canvas.drawPath(check)
                paragraph.drawOn(
                    self.canvas,
                    card_left + 20,
                    self.cursor_y - (row_height + paragraph_height) / 2,
                )
            self.cursor_y -= row_height + SOFT_SKILL_ROW_GAP

    def draw_education_and_languages(self):
        education = self.document.select_one("#opleiding")
        self.draw_paragraph(
            "<b>"
            + escape(element_text(education.h3))
            + "</b> | "
            + escape(element_text(education.select_one(".scope")))
            + " | "
            + escape(element_text(education.select_one(".date"))),
            "small",
            space_after=5,
        )
        self.draw_paragraph(
            "  |  ".join(
                escape(element_text(element.strong))
                + ": "
                + escape(element_text(element.span))
                for element in self.document.select(".language")
            ),
            "small",
        )

    def render(self):
        self.draw_header()
        self.draw_heading(self.translate("sections.profile"))
        self.draw_paragraph(
            escape(element_text(self.document.select_one(".summary"))), space_after=3
        )
        self.draw_heading(self.translate("sections.experience"))
        jobs = self.document.select("#ervaring .job")
        for job in jobs[:2]:
            self.draw_job(job)
        print("Page 1 bottom:", self.cursor_y)
        self.draw_footer(1)
        self.canvas.showPage()

        self.draw_continuation_header()
        self.draw_heading(self.translate("pdf.experienceContinued"))
        for job in jobs[2:]:
            self.draw_job(job)
        self.draw_heading(self.translate("sections.technicalSkills"))
        self.draw_technical_skills()
        self.draw_heading(self.translate("sections.tools"))
        self.draw_tools()
        self.draw_heading(self.translate("sections.softSkills"))
        self.draw_soft_skills()
        self.draw_heading(self.translate("pdf.educationLanguages"))
        self.draw_education_and_languages()
        print("Page 2 bottom:", self.cursor_y)
        self.draw_footer(2)
        self.canvas.save()


def verify_pdf(pdf_path, document, language):
    reader = PdfReader(pdf_path)
    assert len(reader.pages) == PAGE_COUNT
    extracted_text = " ".join(
        " ".join(page.extract_text().split()) for page in reader.pages
    )
    for element in document.select(
        ".summary, .job .scope, .job li, .tag, #soft-skills li"
    ):
        value = " ".join(element_text(element).split())
        assert value in extracted_text, value
    assert (
        "complex legacy integration"
        if language == "en"
        else "complexe legacy-integratie"
    ) in extracted_text
    assert "Software Engineer → Senior Software Engineer" in extracted_text
    assert "OOP" not in extracted_text
    assert "klantadvies" not in element_text(document.select_one(".summary"))
    print("Verified", language, "two pages, exact website wording, and achievement.")


def build_resume(language):
    if language not in ("nl", "en"):
        raise ValueError(f"Unsupported language: {language}")
    translations = json.loads((ROOT / f"src/locales/{language}.json").read_text())
    source = subprocess.check_output(
        ["node", str(ROOT / "scripts/pages.mjs"), "--pdf-source", language], text=True
    )
    document = BeautifulSoup(source, "html.parser")
    register_fonts()
    filename = "Yves_Bonami_CV_EN.pdf" if language == "en" else "Yves_Bonami_CV.pdf"
    output_path = ROOT / "public" / filename
    output_path.parent.mkdir(exist_ok=True)
    ResumePdf(output_path, document, translations, language).render()
    verify_pdf(output_path, document, language)
    print(output_path)


if __name__ == "__main__":
    build_resume(sys.argv[1] if len(sys.argv) > 1 else "nl")
