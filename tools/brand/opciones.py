"""Propuestas de isotipo SASTRA para aprobación del cliente.
Cada opción es un SVG 240x240 construido por geometría. `python3 tools/brand/opciones.py`
genera tools/brand/out/opciones.png (hoja comparativa) y un SVG por opción.
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_brand as b  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402
from fontTools.pens.boundsPen import BoundsPen  # noqa: E402
from fontTools.pens.recordingPen import RecordingPen  # noqa: E402
import cairosvg  # noqa: E402

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tmp')  # no usado
FONTDIR = '/tmp/claude-0/-home-user-Agente-y-asistente-de-moda/b69de5c0-b046-514a-8455-8e93da6b24b2/scratchpad/fonts'
LINO, INK, ACENTO = b.LINO, b.INK, b.ACENTO
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')


def glifo(font, ch='S'):
    f = TTFont(os.path.join(FONTDIR, font))
    gs = f.getGlyphSet(); g = gs[f.getBestCmap()[ord(ch)]]
    pen = SVGPathPen(gs); g.draw(pen)
    bp = BoundsPen(gs); g.draw(bp)
    rec = RecordingPen(); g.draw(rec)
    pts = [p for op, args in rec.value for p in args if op in ('moveTo', 'lineTo', 'qCurveTo', 'curveTo') for p in [args[-1]] if p]
    return pen.getCommands(), bp.bounds, pts


def colocar_S(font, alto, cx, cy):
    """Devuelve (transform, d, escala, bounds) para centrar la S en (cx, cy) con altura `alto`."""
    d, (x0, y0, x1, y1), pts = glifo(font)
    s = alto / (y1 - y0)
    w = (x1 - x0) * s
    tx = cx - w / 2 - x0 * s
    ty = cy + alto / 2 + y0 * s
    return f'translate({tx:.3f},{ty:.3f}) scale({s:.5f},{-s:.5f})', d, s, (tx, ty, x0, y0, x1, y1), pts


def svg(partes, bg=None, size=240):
    cab = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="{size}" height="{size}">']
    if bg:
        cab.append(f'<rect width="240" height="240" fill="{bg}"/>')
    return '\n'.join(cab + partes + ['</svg>'])


def aguja(ojo, punta, w, fondo, eye_len=18, eye_w=3.2):
    body, eye, c = b.needle(ojo, punta, w_eye=w, eye_len=eye_len, eye_w=eye_w)
    return body, eye.replace(b.LINO, fondo), c


def hilo_desde_ojo(ecx, ecy, acento, sentido=1, escala=1.0, largo=1.0):
    """Hilo que sale del ojo, da una vuelta suelta y cae a la derecha."""
    r = 12 * escala
    cx_, cy_ = ecx + 15 * escala * sentido, ecy - 8 * escala
    pts = []
    for i in range(0, 32):
        a = math.radians(210 + i * 10) if sentido == 1 else math.radians(330 - i * 10)
        pts.append((cx_ + r * math.cos(a), cy_ + r * math.sin(a)))
    d = f'M {ecx:.1f} {ecy:.1f} ' + ' '.join(f'L {x:.1f} {y:.1f}' for x, y in pts)
    fx, fy = pts[-1]
    d += f' C {fx+16*sentido:.1f} {fy+16:.1f}, {fx+22*sentido:.1f} {fy+44*largo:.1f}, {fx+8*sentido:.1f} {fy+78*largo:.1f}'
    return f'<path d="{d}" fill="none" stroke="{acento}" stroke-width="{2.2*escala:.1f}" stroke-linecap="round" stroke-linejoin="round"/>'


# ------------------------------------------------------------------ A · Espina
def opcion_A(bg=None, ink=INK, acento=ACENTO, simple=False):
    fondo = bg or LINO
    tr, d, s, _, _ = colocar_S('Italiana-normal.woff', 150, 110, 128)
    partes = [f'<path transform="{tr}" d="{d}" fill="{ink}"/>']
    if simple:
        return svg(partes, bg)
    # la aguja sigue la espina de la S: pasa por el centro con la inclinación de la diagonal
    ang = math.radians(-62)
    cx, cy = 112, 126
    L = 104
    ojo = (cx + L * math.cos(ang), cy + L * math.sin(ang))
    punta = (cx - L * 1.02 * math.cos(ang), cy - L * 1.02 * math.sin(ang))
    body, eye, (ecx, ecy) = aguja(ojo, punta, 8.0, fondo)
    partes.append(f'<line x1="{ojo[0]:.1f}" y1="{ojo[1]:.1f}" x2="{punta[0]:.1f}" y2="{punta[1]:.1f}" stroke="{fondo}" stroke-width="12" stroke-linecap="round"/>')
    partes.append(f'<path d="{body}" fill="{ink}"/>')
    partes.append(eye)
    partes.append(hilo_desde_ojo(ecx, ecy, acento, sentido=1, escala=1.15, largo=1.1))
    return svg(partes, bg)


# ------------------------------------------------------------------ B · Sello
def opcion_B(bg=None, ink=INK, acento=ACENTO, simple=False):
    fondo = bg or LINO
    tr, d, s_, _, _ = colocar_S('Italiana-normal.woff', 120 if not simple else 150, 120, 124)
    if simple:
        return svg([f'<path transform="{tr}" d="{d}" fill="{ink}"/>'], bg)
    partes = []
    r = 94
    # anillo de hilo con un hueco arriba a la derecha (de 272° a 322°)
    partes.append(f'<path d="{arco(120, 120, r, 322, 632)}" fill="none" stroke="{acento}" stroke-width="2.2" stroke-linecap="round"/>')
    partes.append(f'<path transform="{tr}" d="{d}" fill="{ink}"/>')
    # aguja tangente que cubre el hueco: ojo en el extremo de 322°, punta hacia arriba-izquierda
    a_ojo = math.radians(322)
    ojo = (120 + r * math.cos(a_ojo), 120 + r * math.sin(a_ojo))
    tang = (math.sin(a_ojo), -math.cos(a_ojo))  # tangente en sentido antihorario (hacia el hueco)
    punta = (ojo[0] + 84 * tang[0], ojo[1] + 84 * tang[1])
    body, eye, (ecx, ecy) = aguja(ojo, punta, 7.5, fondo, eye_len=16, eye_w=3.0)
    # el hilo del extremo superior del anillo (272°) sube y entra al ojo
    a_top = math.radians(272)
    top = (120 + r * math.cos(a_top), 120 + r * math.sin(a_top))
    partes.append(f'<path d="M {top[0]:.1f} {top[1]:.1f} C {top[0]+22:.1f} {top[1]-14:.1f}, {ecx-14:.1f} {ecy-16:.1f}, {ecx:.1f} {ecy:.1f}" fill="none" stroke="{acento}" stroke-width="2.2" stroke-linecap="round"/>')
    partes.append(f'<path d="{body}" fill="{ink}"/>')
    partes.append(eye)
    return svg(partes, bg)


def arco(cx, cy, r, a0, a1, paso=6):
    pts = []
    a = a0
    while a <= a1:
        pts.append((cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))))
        a += paso
    return 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in pts)


# ------------------------------------------------------------------ C · Aguja vertical, hilo en S
def opcion_C(bg=None, ink=INK, acento=ACENTO, simple=False):
    fondo = bg or LINO
    cx = 120.0
    r1, r2 = 30.0, 38.0
    cy1 = 92.0; cy2 = cy1 + r1 + r2
    grosor = 5.2 if not simple else 9
    # aguja vertical detrás del hilo
    ojo = (cx, 26.0); punta = (cx, 224.0)
    body, eye, (ecx, ecy) = aguja(ojo, punta, 8.5 if not simple else 11, fondo, eye_len=20, eye_w=3.4)
    partes = [f'<path d="{body}" fill="{ink}"/>', eye]
    # hilo: sale del ojo hacia la izquierda y forma la S alrededor de la aguja (bowl superior a la izquierda, inferior a la derecha)
    t0 = b._pt(cx, cy1, r1, -90)  # arriba del bowl superior
    mid = (cx, cy1 + r1)
    fin = b._pt(cx, cy2, r2, 150)
    if simple:
        hilo = f'M {t0[0]:.1f} {t0[1]:.1f} A {r1} {r1} 0 1 0 {mid[0]:.1f} {mid[1]:.1f} A {r2} {r2} 0 1 1 {fin[0]:.1f} {fin[1]:.1f}'
    else:
        hilo = (f'M {ecx:.1f} {ecy+4:.1f} C {cx+14:.1f} {ecy+16:.1f}, {cx+26:.1f} {cy1-r1-6:.1f}, {t0[0]+8:.1f} {t0[1]:.1f} '
                f'L {t0[0]:.1f} {t0[1]:.1f} A {r1} {r1} 0 1 0 {mid[0]:.1f} {mid[1]:.1f} A {r2} {r2} 0 1 1 {fin[0]:.1f} {fin[1]:.1f}')
    partes.append(f'<path d="{hilo}" fill="none" stroke="{ink}" stroke-width="{grosor}" stroke-linecap="round" stroke-linejoin="round"/>')
    # pequeño halo donde el hilo pasa por delante de la aguja (tramo central) para que se lea "enrollado"
    return svg(partes, bg)


# ------------------------------------------------------------------ D · Terminal (la S es la aguja)
def opcion_D(bg=None, ink=INK, acento=ACENTO, simple=False):
    fondo = bg or LINO
    tr, d, s, (tx, ty, x0, y0, x1, y1), pts = colocar_S('Italiana-normal.woff', 150, 104, 134)
    partes = [f'<path transform="{tr}" d="{d}" fill="{ink}"/>']
    if simple:
        return svg(partes, bg)
    # punto más arriba-derecha del contorno (terminal superior) en coordenadas SVG
    def a_svg(p):
        return (tx + p[0] * s, ty - p[1] * s)
    term = max((a_svg(p) for p in pts), key=lambda q: q[0] - q[1] * 1.15)
    # aguja pequeña que continúa la dirección del terminal hacia arriba-derecha; ojo en el extremo
    ang = math.radians(-50)
    base = (term[0] - 6 * math.cos(ang), term[1] - 6 * math.sin(ang))
    ojo = (base[0] + 70 * math.cos(ang), base[1] + 70 * math.sin(ang))
    body, eye, (ecx, ecy) = aguja(ojo, base, 7.5, fondo, eye_len=16, eye_w=3.0)
    partes.append(f'<path d="{body}" fill="{ink}"/>')
    partes.append(eye)
    partes.append(hilo_desde_ojo(ecx, ecy, acento, sentido=1, escala=0.9, largo=1.7))
    return svg(partes, bg)


# ------------------------------------------------------------------ E · Hilván
def opcion_E(bg=None, ink=INK, acento=ACENTO, simple=False):
    fondo = bg or LINO
    cx = 118.0; r1, r2 = 32.0, 41.0; cy1 = 90.0; cy2 = cy1 + r1 + r2
    t0 = b._pt(cx, cy1, r1, -40)
    mid = (cx, cy1 + r1)
    fin = b._pt(cx, cy2, r2, 165)
    s_path = f'M {t0[0]:.1f} {t0[1]:.1f} A {r1} {r1} 0 1 0 {mid[0]:.1f} {mid[1]:.1f} A {r2} {r2} 0 1 1 {fin[0]:.1f} {fin[1]:.1f}'
    if simple:
        return svg([f'<path d="{s_path}" fill="none" stroke="{ink}" stroke-width="10" stroke-linecap="round"/>'], bg)
    partes = [f'<path d="{s_path}" fill="none" stroke="{ink}" stroke-width="4.6" stroke-linecap="round" stroke-dasharray="8 5"/>']
    # la aguja tira del hilo al final del recorrido (abajo-izquierda), apuntando hacia abajo-izquierda
    ang = math.radians(150)
    ojo = (fin[0] + 10 * math.cos(ang), fin[1] + 10 * math.sin(ang))
    punta = (ojo[0] + 80 * math.cos(ang), ojo[1] + 80 * math.sin(ang))
    body, eye, (ecx, ecy) = aguja(ojo, punta, 8.5, fondo, eye_len=18, eye_w=3.2)
    partes.append(f'<path d="M {fin[0]:.1f} {fin[1]:.1f} L {ecx:.1f} {ecy:.1f}" fill="none" stroke="{acento}" stroke-width="2.4" stroke-linecap="round"/>')
    partes.append(f'<path d="{body}" fill="{ink}"/>')
    partes.append(eye)
    return svg(partes, bg)


# ------------------------------------------------------------------ F · Botón (ícono)
def opcion_F(bg=None, ink=INK, acento=ACENTO, simple=False):
    # disco del color de la tinta; dentro, la S y la aguja en el color del fondo (marca en negativo)
    disco = ink
    dentro = bg or LINO
    partes = [f'<circle cx="120" cy="120" r="108" fill="{disco}"/>']
    tr, d, s_, _, _ = colocar_S('Italiana-normal.woff', 118 if not simple else 130, 116, 122)
    partes.append(f'<path transform="{tr}" d="{d}" fill="{dentro}"/>')
    if simple:
        return svg(partes, bg)
    ang = math.radians(-62)
    cx, cy = 118, 120
    L = 82
    ojo = (cx + L * math.cos(ang), cy + L * math.sin(ang))
    punta = (cx - L * math.cos(ang), cy - L * math.sin(ang))
    body, eye, (ecx, ecy) = aguja(ojo, punta, 6.5, disco, eye_len=14, eye_w=2.6)
    partes.append(f'<line x1="{ojo[0]:.1f}" y1="{ojo[1]:.1f}" x2="{punta[0]:.1f}" y2="{punta[1]:.1f}" stroke="{disco}" stroke-width="10" stroke-linecap="round"/>')
    partes.append(f'<path d="{body}" fill="{dentro}"/>')
    partes.append(eye)
    return svg(partes, bg)


OPCIONES = [
    ('A', 'Espina', 'La aguja recorre la diagonal de la S; el hilo sale del ojo.', opcion_A),
    ('B', 'Sello', 'S dentro de un círculo de hilo que termina en la aguja.', opcion_B),
    ('D', 'Terminal', 'La S se prolonga en una aguja pequeña con su hilo.', opcion_D),
    ('E', 'Hilván', 'S de puntadas; la aguja tira del hilo al final.', opcion_E),
    ('F', 'Botón', 'Disco de tinta con la S y la aguja en lino. Pensado como ícono de app.', opcion_F),
]


def inner(s):
    i0 = min([k for k in (s.find('<path'), s.find('<circle')) if k >= 0]); return s[i0:s.rindex('</svg>')]


def hoja():
    W, H = 1500, 1150
    col = 300
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">', f'<rect width="{W}" height="{H}" fill="{LINO}"/>']
    for i, (letra, nombre, desc, fn) in enumerate(OPCIONES):
        x = i * col
        p.append(f'<text x="{x+150}" y="52" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#000">{letra}</text>')
        p.append(f'<text x="{x+150}" y="80" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#5E5952">{nombre}</text>')
        p.append(f'<g transform="translate({x+30},100)">{inner(fn())}</g>')
        p.append(f'<g transform="translate({x+60},380) scale(0.4)">{inner(fn())}</g>')
        p.append(f'<g transform="translate({x+170},380) scale(0.2)">{inner(fn(simple=True))}</g>')
        p.append(f'<g transform="translate({x+230},380) scale(0.1)">{inner(fn(simple=True))}</g>')
        # lockup
        wm, ww, wh = b.wordmark_svg(height=22)
        p.append(f'<g transform="translate({x+38},520) scale(0.3)">{inner(fn())}</g>')
        p.append(f'<g transform="translate({x+118},545)">{wm[wm.index("<g"):wm.rindex("</svg>")]}</g>')
        # negativo
        p.append(f'<rect x="{x+20}" y="620" width="260" height="260" fill="#000"/>')
        neg = fn(bg='#000000', ink=LINO, acento=LINO)
        p.append(f'<g transform="translate({x+30},630)">{inner(neg)}</g>')
        # descripción
        for j, linea in enumerate(partir(desc, 30)):
            p.append(f'<text x="{x+150}" y="{920+j*20}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#5E5952">{linea}</text>')
    p.append(f'<text x="{W/2}" y="{H-40}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#5E5952">Cada columna: isotipo grande · 96 px · 48 px (versión simple) · 24 px · lockup · negativo. Hilo en añil, el acento de la marca.</text>')
    p.append('</svg>')
    return '\n'.join(p)


def partir(t, n):
    out, act = [], ''
    for w in t.split():
        if len(act) + len(w) + 1 > n:
            out.append(act); act = w
        else:
            act = (act + ' ' + w).strip()
    if act:
        out.append(act)
    return out


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for letra, nombre, _, fn in OPCIONES:
        open(os.path.join(OUT, f'opcion-{letra}.svg'), 'w').write(fn(bg=LINO))
    cairosvg.svg2png(bytestring=hoja().encode(), write_to=os.path.join(OUT, 'opciones.png'), output_width=1800)
    print('ok')
