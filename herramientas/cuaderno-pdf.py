#!/usr/bin/env python3
"""Convierte el cuaderno .md de un diplomado en PDF (reportlab). Uso: cuaderno-pdf.py entrada.md salida.pdf #color"""
import sys, re
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
entrada, salida, color = sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '#6c24dd'
fuente, negrita = 'Helvetica', 'Helvetica-Bold'
for base in ['/usr/share/fonts/truetype/dejavu/', '/usr/share/fonts/dejavu/']:
    if os.path.exists(base + 'DejaVuSans.ttf'):
        pdfmetrics.registerFont(TTFont('DejaVu', base + 'DejaVuSans.ttf')); pdfmetrics.registerFont(TTFont('DejaVuB', base + 'DejaVuSans-Bold.ttf'))
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        registerFontFamily('DejaVu', normal='DejaVu', bold='DejaVuB', italic='DejaVu', boldItalic='DejaVuB')
        fuente, negrita = 'DejaVu', 'DejaVuB'; break
st = getSampleStyleSheet(); c = colors.HexColor(color)
H1 = ParagraphStyle('h1', parent=st['Title'], fontName=negrita, textColor=c, fontSize=20, leading=24)
H2 = ParagraphStyle('h2', parent=st['Heading2'], fontName=negrita, textColor=c, fontSize=15, leading=19, spaceBefore=6)
H3 = ParagraphStyle('h3', parent=st['Heading3'], fontName=negrita, fontSize=12, leading=15, spaceBefore=8)
P = ParagraphStyle('p', parent=st['BodyText'], fontName=fuente, fontSize=10.5, leading=14.5)
L = ParagraphStyle('l', parent=P, leftIndent=12, bulletIndent=2)
def fmt(t):
    t = t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
def pie(canvas, doc):
    canvas.saveState(); canvas.setFont(fuente, 8); canvas.setFillColor(colors.grey)
    canvas.drawString(2 * cm, 1.2 * cm, 'Instituto Mara · Cuaderno de práctica'); canvas.drawRightString(19.6 * cm, 1.2 * cm, str(doc.page)); canvas.restoreState()
flujo, primero = [], True
for linea in open(entrada, encoding='utf-8').read().split('\n'):
    s = linea.strip()
    if not s: continue
    if s.startswith('# '): flujo += [Paragraph(fmt(s[2:]), H1), Spacer(1, 8)]
    elif s.startswith('## '):
        if not primero and re.match(r'## \d', s): flujo.append(PageBreak())
        primero = False; flujo.append(Paragraph(fmt(s[3:]), H2))
    elif s.startswith('### '): flujo.append(Paragraph(fmt(s[4:]), H3))
    elif s.startswith('- '): flujo.append(Paragraph(fmt(s[2:]), L, bulletText='•'))
    else: flujo += [Paragraph(fmt(s), P), Spacer(1, 4)]
SimpleDocTemplate(salida, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=1.8 * cm,
                  title='Cuaderno de práctica — Instituto Mara', author='Instituto Mara').build(flujo, onFirstPage=pie, onLaterPages=pie)
print('ok')
