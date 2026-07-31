# -*- coding: utf-8 -*-
"""HTML block builders shared by all documents."""

def fill(width_pt=90):
    return f'<span class="fill" style="min-width:{width_pt}pt">&nbsp;</span>'

def line(label=None):
    lab = f'<div class="label-sm">{label}</div>' if label else ''
    return f'<div class="fill-line"></div>{lab}'

def initials_clause(body_html):
    """A clause paragraph with Landlord / Tenant initial boxes on the right."""
    return f"""
<table class="initials"><tr>
  <td class="body">{body_html}</td>
  <td class="boxes">
    <span class="ibox"><span class="line"></span><span class="cap">Landlord</span></span>
    <span class="ibox"><span class="line"></span><span class="cap">Tenant</span></span>
  </td>
</tr></table>"""

def section(num, title, inner_html):
    return f'<div class="section-block"><h2 class="section">{num}. {title}</h2>{inner_html}</div>'

def numbered_blank_lines(n):
    rows = "".join(
        f'<div class="nl"><span class="n">{i}.</span><span class="ln"></span></div>'
        for i in range(1, n + 1)
    )
    return f'<div class="numbered-lines">{rows}</div>'

def grid(headers, rows, col_widths=None):
    thead = "".join(f"<th>{h}</th>" for h in headers)
    body = ""
    for r in rows:
        cells = "".join(f"<td>{c}</td>" for c in r)
        body += f"<tr>{cells}</tr>"
    colgroup = ""
    if col_widths:
        colgroup = "<colgroup>" + "".join(f'<col style="width:{w}">' for w in col_widths) + "</colgroup>"
    return f'<table class="grid">{colgroup}<thead><tr>{thead}</tr></thead><tbody>{body}</tbody></table>'

def blank_grid(headers, n_rows, col_widths=None):
    rows = [["&nbsp;"] * len(headers) for _ in range(n_rows)]
    # make cells tall
    thead = "".join(f"<th>{h}</th>" for h in headers)
    body = ""
    for _ in range(n_rows):
        cells = "".join('<td class="fillcell">&nbsp;</td>' for _ in headers)
        body += f"<tr>{cells}</tr>"
    colgroup = ""
    if col_widths:
        colgroup = "<colgroup>" + "".join(f'<col style="width:{w}">' for w in col_widths) + "</colgroup>"
    return f'<table class="grid">{colgroup}<thead><tr>{thead}</tr></thead><tbody>{body}</tbody></table>'
