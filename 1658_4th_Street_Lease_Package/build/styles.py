# -*- coding: utf-8 -*-
"""Shared print CSS for the 1658 4th Street lease package (US Letter, WeasyPrint)."""

PROPERTY_ADDRESS = "1658 4th Street, Coachella, California 92236"

def page_css(doc_footer_label):
    """Return @page CSS with a running footer: property address (left) + Page X of Y (right)."""
    return f"""
@page {{
    size: Letter;
    margin: 0.85in 0.8in 0.9in 0.8in;
    @bottom-left {{
        content: "{doc_footer_label}";
        font-family: 'Liberation Sans', Arial, sans-serif;
        font-size: 7.5pt;
        color: #667085;
        vertical-align: top;
        padding-top: 6pt;
    }}
    @bottom-center {{
        content: "1658 4th Street, Coachella, California 92236";
        font-family: 'Liberation Sans', Arial, sans-serif;
        font-size: 7.5pt;
        color: #667085;
        vertical-align: top;
        padding-top: 6pt;
    }}
    @bottom-right {{
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Liberation Sans', Arial, sans-serif;
        font-size: 7.5pt;
        color: #667085;
        vertical-align: top;
        padding-top: 6pt;
    }}
}}
"""

BASE_CSS = """
* { box-sizing: border-box; }
html { -weasy-hyphens: none; }
body {
    font-family: 'Liberation Serif', 'Times New Roman', serif;
    font-size: 10.5pt;
    line-height: 1.42;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
}
.doc-title {
    font-family: 'Liberation Sans', Arial, sans-serif;
    font-size: 16pt;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.3pt;
    margin: 0 0 2pt 0;
    color: #0b1f3a;
}
.doc-subtitle {
    font-family: 'Liberation Sans', Arial, sans-serif;
    font-size: 10pt;
    font-weight: 400;
    text-align: center;
    color: #40506a;
    margin: 0 0 4pt 0;
}
.rule {
    border: none;
    border-top: 2px solid #0b1f3a;
    margin: 6pt 0 10pt 0;
}
.rule-thin {
    border: none;
    border-top: 0.7px solid #c3ccda;
    margin: 8pt 0 8pt 0;
}
h2.section {
    font-family: 'Liberation Sans', Arial, sans-serif;
    font-size: 10.8pt;
    font-weight: 700;
    color: #0b1f3a;
    margin: 12pt 0 3pt 0;
    padding-bottom: 1pt;
    border-bottom: 0.6px solid #d6dce6;
    break-after: avoid;
}
h3.subhead {
    font-family: 'Liberation Sans', Arial, sans-serif;
    font-size: 10pt;
    font-weight: 700;
    color: #22314f;
    margin: 8pt 0 2pt 0;
    break-after: avoid;
}
p { margin: 0 0 6pt 0; text-align: justify; orphans: 2; widows: 2; }
p.tight { margin: 0 0 3pt 0; }
.section-block { break-inside: auto; }
.lettered { margin: 0 0 4pt 0; padding-left: 16pt; text-indent: -16pt; }
.lettered .lbl { font-weight: 700; }
ul.clean { margin: 2pt 0 6pt 0; padding-left: 18pt; }
ul.clean li { margin: 0 0 2pt 0; }
.fill { border-bottom: 1px solid #444; display: inline-block; min-width: 40pt; }
.fill-line {
    display: block;
    border-bottom: 1px solid #555;
    height: 15pt;
    margin: 3pt 0;
}
.label-sm {
    font-family: 'Liberation Sans', Arial, sans-serif;
    font-size: 7.5pt;
    color: #667085;
    letter-spacing: 0.2pt;
}
.note {
    font-size: 9.3pt;
    color: #33404f;
    background: #f4f6fa;
    border-left: 3px solid #7089b0;
    padding: 6pt 9pt;
    margin: 6pt 0;
    text-align: left;
}
.note-strong {
    font-size: 9.6pt;
    background: #fbf3ec;
    border-left: 3px solid #b9772f;
    padding: 7pt 10pt;
    margin: 7pt 0;
    text-align: left;
}
.caption {
    font-family: 'Liberation Sans', Arial, sans-serif;
    font-size: 9pt; color: #40506a; margin: 0 0 8pt 0; text-align: left;
}
/* Data tables (utilities, disclosure checklist, condition, etc.) */
table.grid { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt 0; font-size: 9.5pt; }
table.grid th {
    font-family: 'Liberation Sans', Arial, sans-serif;
    background: #0b1f3a; color: #fff; font-weight: 600; font-size: 8.6pt;
    text-align: left; padding: 4pt 6pt; border: 0.6px solid #0b1f3a;
}
table.grid td { border: 0.6px solid #b9c2d0; padding: 5pt 6pt; vertical-align: top; }
table.grid tr:nth-child(even) td { background: #f6f8fb; }
td.fillcell { height: 20pt; }
/* Initials clause: text + landlord/tenant initial boxes */
table.initials { width: 100%; border-collapse: collapse; margin: 4pt 0; }
table.initials td.body { padding: 3pt 8pt 3pt 0; vertical-align: top; }
table.initials td.boxes {
    width: 118pt; vertical-align: top; padding-top: 2pt;
}
.ibox { display: inline-block; text-align: center; width: 52pt; margin-left: 4pt; }
.ibox .line { display: block; border-bottom: 1px solid #444; height: 15pt; }
.ibox .cap { font-family:'Liberation Sans',Arial,sans-serif; font-size: 6.8pt; color:#667085; }
/* Signature blocks */
.sigrow { display: flex; justify-content: space-between; margin-top: 14pt; }
.sigcol { width: 47%; }
.sigline { border-bottom: 1px solid #333; height: 20pt; margin-bottom: 1pt; }
.sigcap { font-family:'Liberation Sans',Arial,sans-serif; font-size: 8pt; color:#40506a; }
.pagebreak { break-before: page; }
.keepwith { break-inside: avoid; }
.big-space { height: 22pt; }
.numbered-lines { margin-top: 6pt; }
.numbered-lines .nl {
    display: flex; align-items: flex-end; margin-bottom: 12pt;
}
.numbered-lines .nl .n {
    font-family:'Liberation Sans',Arial,sans-serif; font-size:9pt; color:#40506a;
    width: 20pt; flex: 0 0 20pt;
}
.numbered-lines .nl .ln { flex: 1 1 auto; border-bottom: 1px solid #666; height: 16pt; }
.small { font-size: 9pt; }
.center { text-align: center; }
.mono-blank { letter-spacing: 1px; }
.badge {
    display:inline-block; font-family:'Liberation Sans',Arial,sans-serif;
    font-size:7.5pt; font-weight:700; letter-spacing:0.4pt;
    color:#fff; background:#7089b0; padding:2pt 7pt; border-radius:2pt;
}
.badge.optional { background:#b9772f; }
.badge.notlease { background:#5a3a7a; }
"""

def full_html(title, body_html, footer_label):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<style>{page_css(footer_label)}{BASE_CSS}</style></head>
<body>{body_html}</body></html>"""
