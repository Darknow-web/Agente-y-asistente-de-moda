"""Construye los vectores de marca SASTRA: isotipo (hilo + aguja formando una S),
wordmark (SASTRA en Bodoni Moda convertido a trazados) y composiciones.
Salida: SVG limpios + PNG de revisión.
"""
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, 'fonts')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

INK = '#000000'
LINO = '#EEEAE1'

# ---------------------------------------------------------------- isotipo
# ViewBox 0 0 240 240. La S se dibuja como un único trazo (el hilo) que sale
# del ojo de la aguja, arriba a la derecha, y termina abajo a la izquierda en
# una pequeña curva suelta (el cabo del hilo).

def needle(eye_pt, tip_pt, w_eye=7.2, eye_len=16.0, eye_w=2.6):
    """Aguja: silueta afilada desde el extremo del ojo hasta la punta, con ojo alargado."""
    ex, ey = eye_pt; tx, ty = tip_pt
    dx, dy = tx - ex, ty - ey
    L = math.hypot(dx, dy); ux, uy = dx / L, dy / L
    px, py = -uy, ux  # perpendicular
    # Perfil: ancho máximo cerca del ojo (a 12% de la longitud), luego adelgaza hasta la punta.
    pts_r, pts_l = [], []
    n = 40
    for i in range(n + 1):
        t = i / n
        # ancho: curva suave (redondeada en el extremo del ojo, aguda en la punta)
        if t < 0.10:
            w = w_eye * math.sqrt(max(t, 0) / 0.10)
        else:
            u = (t - 0.10) / 0.90
            w = w_eye * (1 - u) ** 1.35
        w = max(w, 0.0)
        cx, cy = ex + ux * L * t, ey + uy * L * t
        pts_r.append((cx + px * w / 2, cy + py * w / 2))
        pts_l.append((cx - px * w / 2, cy - py * w / 2))
    body = 'M ' + ' L '.join(f'{x:.2f} {y:.2f}' for x, y in pts_r + pts_l[::-1]) + ' Z'
    # Ojo: elipse alargada centrada a ~7% de la longitud
    cx, cy = ex + ux * L * 0.075, ey + uy * L * 0.075
    ang = math.degrees(math.atan2(uy, ux))
    eye = (f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{eye_len/2:.2f}" ry="{eye_w/2:.2f}" '
           f'transform="rotate({ang:.2f} {cx:.2f} {cy:.2f})" fill="{LINO}"/>')
    return body, eye, (cx, cy)


VB = 240  # viewBox del isotipo

def _pt(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def isotipo_svg(stroke=5.5, w_eye=10.0, bg=None, ink=INK, size=240, tail_deg=150,
                simple=False):
    """S de dos arcos tangentes (bowl superior r1 < inferior r2) dibujada como un hilo
    que sale del ojo de una aguja inclinada arriba a la derecha.
    simple=True: versión para tamaños pequeños (hilo recto del ojo al terminal)."""
    cx = 110.0; r1 = 34.0; r2 = 43.0
    cy1 = 90.0; cy2 = cy1 + r1 + r2
    t_deg = -44
    tx, ty = _pt(cx, cy1, r1, t_deg)
    mid = (cx, cy1 + r1)
    ex_, ey_ = _pt(cx, cy2, r2, tail_deg)
    # tangente del arco en el terminal (sentido de recorrido: ángulo decreciente)
    tvx, tvy = math.sin(math.radians(t_deg)), -math.cos(math.radians(t_deg))
    # aguja: a la derecha del bowl superior, apuntando arriba-derecha; el hilo sube
    # del ojo al terminal formando una V con la aguja.
    eye_pt = (154.0, 84.0)
    ang = math.radians(-57)
    L = 92.0
    ux, uy = math.cos(ang), math.sin(ang)
    tip_pt = (eye_pt[0] + L * ux, eye_pt[1] + L * uy)
    body, eye, (ecx, ecy) = needle(eye_pt, tip_pt, w_eye=w_eye, eye_len=17.0, eye_w=3.2)
    # dirección del ojo al terminal
    dxx, dyy = tx - ecx, ty - ecy
    dl = math.hypot(dxx, dyy); dxx, dyy = dxx / dl, dyy / dl
    k1 = dl * (0.30 if simple else 0.42)
    k2 = dl * (0.30 if simple else 0.42)
    c1 = (ecx + dxx * k1, ecy + dyy * k1)
    c2 = (tx - tvx * k2, ty - tvy * k2)
    thread = (
        f'M {ecx:.2f} {ecy:.2f} '
        f'C {c1[0]:.2f} {c1[1]:.2f}, {c2[0]:.2f} {c2[1]:.2f}, {tx:.2f} {ty:.2f} '
        f'A {r1} {r1} 0 1 0 {mid[0]:.2f} {mid[1]:.2f} '
        f'A {r2} {r2} 0 1 1 {ex_:.2f} {ey_:.2f}'
    )
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB} {VB}" width="{size}" height="{size}">']
    if bg:
        parts.append(f'<rect width="{VB}" height="{VB}" fill="{bg}"/>')
    parts.append(f'<path d="{thread}" fill="none" stroke="{ink}" stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round"/>')
    parts.append(f'<path d="{body}" fill="{ink}"/>')
    parts.append(eye.replace(LINO, bg or LINO))
    parts.append('</svg>')
    return '\n'.join(parts)


# ---------------------------------------------------------------- wordmark
def text_to_paths(font_path, text, tracking_em=0.0):
    f = TTFont(font_path)
    upem = f['head'].unitsPerEm
    cmap = f.getBestCmap(); glyphs = f.getGlyphSet(); hmtx = f['hmtx']
    x = 0.0; paths = []; minx = 1e9; maxx = -1e9; miny = 1e9; maxy = -1e9
    for ch in text:
        gname = cmap[ord(ch)]
        pen = SVGPathPen(glyphs); glyphs[gname].draw(pen)
        bp = BoundsPen(glyphs); glyphs[gname].draw(bp)
        d = pen.getCommands()
        if d:
            paths.append((d, x))
        if bp.bounds:
            bx0, by0, bx1, by1 = bp.bounds
            minx = min(minx, x + bx0); maxx = max(maxx, x + bx1)
            miny = min(miny, by0); maxy = max(maxy, by1)
        x += hmtx[gname][0] + tracking_em * upem
    return paths, (minx, miny, maxx, maxy), upem


def wordmark_svg(weight=500, tracking=0.16, height=64, ink=INK, bg=None, margin=0.0):
    font = os.path.join(FONTS, f'BodoniModa-{weight}.woff')
    paths, (x0, y0, x1, y1), upem = text_to_paths(font, 'SASTRA', tracking)
    w_units = x1 - x0; h_units = y1 - y0
    scale = height / h_units
    W = w_units * scale + 2 * margin; H = height + 2 * margin
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" width="{W:.2f}" height="{H:.2f}">']
    if bg:
        parts.append(f'<rect width="{W:.2f}" height="{H:.2f}" fill="{bg}"/>')
    # fuente: y hacia arriba; SVG: y hacia abajo -> voltear
    parts.append(f'<g fill="{ink}" transform="translate({margin - x0*scale:.3f},{margin + y1*scale:.3f}) scale({scale:.5f},{-scale:.5f})">')
    for d, x in paths:
        parts.append(f'<path transform="translate({x:.2f},0)" d="{d}"/>')
    parts.append('</g></svg>')
    return '\n'.join(parts), W, H


def lockup_svg(iso_size=120, gap=28, wm_height=44, ink=INK, bg=None, pad=32):
    wm, ww, wh = wordmark_svg(height=wm_height, ink=ink)
    # extraer el <g ...>...</g> del wordmark
    inner = wm[wm.index('<g'):wm.rindex('</svg>')]
    W = pad*2 + iso_size + gap + ww; H = pad*2 + iso_size
    iso = isotipo_v2_svg(ink=ink, acento=(LINO if bg == '#000000' else ACENTO), bg=None)
    iso_inner = iso[iso.index('<path'):iso.rindex('</svg>')].replace(f'stroke="{LINO}" stroke-width="14.0"', f'stroke="{bg or LINO}" stroke-width="14.0"').replace(f'fill="{LINO}"/>', f'fill="{bg or LINO}"/>')
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" width="{W:.2f}" height="{H:.2f}">']
    if bg:
        parts.append(f'<rect width="{W:.2f}" height="{H:.2f}" fill="{bg}"/>')
    s = iso_size / 240
    parts.append(f'<g transform="translate({pad},{pad}) scale({s:.4f})">{iso_inner}</g>')
    ty = pad + (iso_size - wh) / 2
    parts.append(f'<g transform="translate({pad+iso_size+gap:.2f},{ty:.2f})">{inner}</g>')
    parts.append('</svg>')
    return '\n'.join(parts)


def save(name, svg, png_w=None):
    p = os.path.join(OUT, name + '.svg')
    open(p, 'w').write(svg)
    kw = {'output_width': png_w} if png_w else {}
    cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, name + '.png'), **kw)
    return p


def _principal():
    save('isotipo', isotipo_svg(bg=LINO), 800)
    save('isotipo-fino', isotipo_svg(stroke=3.6, w_eye=6.0, bg=LINO), 800)
    save('isotipo-oscuro', isotipo_svg(bg='#000000', ink=LINO), 800)
    wm, _, _ = wordmark_svg(bg=LINO, margin=24)
    save('wordmark', wm, 1200)
    save('lockup', lockup_svg(bg=LINO), 1400)
    # hoja de revisión
    sheet = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1000" width="1200" height="1000">
<rect width="1200" height="1000" fill="{LINO}"/>
<g transform="translate(60,40)">{isotipo_svg(bg=None)[isotipo_svg(bg=None).index('<path'):-6]}</g>
<g transform="translate(340,40) scale(0.5)">{isotipo_svg(bg=None)[isotipo_svg(bg=None).index('<path'):-6]}</g>
<g transform="translate(480,40) scale(0.2)">{isotipo_svg(stroke=8,w_eye=12,bg=None,simple=True)[isotipo_svg(stroke=8,w_eye=12,bg=None,simple=True).index('<path'):-6]}</g>
<g transform="translate(540,40) scale(0.1)">{isotipo_svg(stroke=12,w_eye=15,bg=None,simple=True)[isotipo_svg(stroke=12,w_eye=15,bg=None,simple=True).index('<path'):-6]}</g>
<g transform="translate(600,40) scale(0.0667)">{isotipo_svg(stroke=16,w_eye=18,bg=None,simple=True)[isotipo_svg(stroke=16,w_eye=18,bg=None,simple=True).index('<path'):-6]}</g>
<g transform="translate(60,330)">{lockup_svg(bg=None)[lockup_svg(bg=None).index('<g'):-6]}</g>
<rect x="60" y="560" width="1080" height="380" fill="#000000"/>
<g transform="translate(120,620)">{lockup_svg(bg='#000000', ink=LINO)[lockup_svg(bg='#000000', ink=LINO).index('<g'):-6]}</g>
</svg>'''
    save('hoja-revision', sheet, 1600)
    print('ok', os.listdir(OUT))


# ---------------------------------------------------------------- exportación al repo
def export_repo(repo):
    from PIL import Image
    import io
    brand = os.path.join(repo, 'src', 'brand'); pub = os.path.join(repo, 'public'); icons = os.path.join(pub, 'icons')
    for d in (brand, pub, icons): os.makedirs(d, exist_ok=True)
    def w(path, svg): open(path, 'w').write(svg)
    # isotipos (fondo transparente)
    w(f'{brand}/isotipo.svg', isotipo_v2_svg())
    w(f'{brand}/isotipo-lino.svg', isotipo_v2_svg(ink=LINO, acento=LINO, bg=None).replace(f'stroke="{LINO}" stroke-width="14.0"', 'stroke="#000000" stroke-width="14.0"').replace(f'fill="{LINO}"/>\n</svg>', 'fill="#000000"/>\n</svg>'))
    w(f'{brand}/isotipo-simple.svg', isotipo_v2_svg(simple=True))
    w(f'{brand}/isotipo-simple-lino.svg', isotipo_v2_svg(simple=True, ink=LINO))
    w(f'{brand}/isotipo-hilo-v1.svg', isotipo_svg())  # versión anterior (hilo formando la S), por si se quiere recuperar
    wm, _, _ = wordmark_svg(); w(f'{brand}/wordmark.svg', wm)
    wm2, _, _ = wordmark_svg(ink=LINO); w(f'{brand}/wordmark-lino.svg', wm2)
    w(f'{brand}/lockup.svg', lockup_svg(pad=0))
    w(f'{brand}/lockup-lino.svg', lockup_svg(pad=0, ink=LINO).replace(f'fill="{LINO}"/>', 'fill="#000000"/>'))
    # favicon svg: cuadrado lino con S simple en tinta
    fav = isotipo_v2_svg(simple=True, bg=LINO, alto_S=170.0)
    w(f'{pub}/favicon.svg', fav)
    # PNG icons
    for size, name in [(192, f'{icons}/icon-192.png'), (512, f'{icons}/icon-512.png'), (180, f'{pub}/apple-touch-icon.png'), (32, f'{pub}/favicon-32.png'), (16, f'{pub}/favicon-16.png')]:
        cairosvg.svg2png(bytestring=fav.encode(), write_to=name, output_width=size, output_height=size)
    # maskable: mismo con más margen (escala 0.8 centrada)
    inner = fav[fav.index('<path'):fav.rindex('</svg>')]
    mask = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="{LINO}"/><g transform="translate(24,24) scale(0.8)">{inner}</g></svg>'
    cairosvg.svg2png(bytestring=mask.encode(), write_to=f'{icons}/maskable-512.png', output_width=512, output_height=512)
    # ico
    ims = [Image.open(f'{pub}/favicon-32.png'), Image.open(f'{pub}/favicon-16.png')]
    ims[0].save(f'{pub}/favicon.ico', format='ICO', sizes=[(32, 32), (16, 16)])
    # OG image 1200x630
    lk = lockup_svg(pad=0)
    inner = lk[lk.index('<g'):lk.rindex('</svg>')]
    import re
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', lk); lw, lh = float(vb.group(1)), float(vb.group(2))
    s = 640 / lw; ox = (1200 - lw * s) / 2; oy = (630 - lh * s) / 2 - 20
    og = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="{LINO}"/>'
          f'<g transform="translate({ox:.1f},{oy:.1f}) scale({s:.4f})">{inner}</g>'
          f'<text x="600" y="{oy + lh*s + 70:.0f}" text-anchor="middle" font-family="Georgia, serif" font-size="26" letter-spacing="6" fill="#5E5952">TU DEPARTAMENTO DE MODA</text></svg>')
    cairosvg.svg2png(bytestring=og.encode(), write_to=f'{pub}/og.png', output_width=1200, output_height=630)
    print('exportado a', brand, pub)



# ---------------------------------------------------------------- isotipo v2: S tipográfica + aguja
ACENTO = '#1F2F6B'

def glifo_S(weight=500):
    """Devuelve (path_d, bounds, upem) del glifo S en Bodoni Moda."""
    f = TTFont(os.path.join(FONTS, f'BodoniModa-{weight}.woff'))
    gs = f.getGlyphSet(); gname = f.getBestCmap()[ord('S')]
    pen = SVGPathPen(gs); gs[gname].draw(pen)
    bp = BoundsPen(gs); gs[gname].draw(bp)
    return pen.getCommands(), bp.bounds, f['head'].unitsPerEm


def isotipo_v2_svg(bg=None, ink=INK, acento=ACENTO, size=240, alto_S=150.0, hilo=True, simple=False):
    """S tipográfica (Bodoni Moda) atravesada en diagonal por una aguja; el hilo sale del ojo,
    da una vuelta y cae a la derecha; una puntada discontinua acompaña el bowl inferior.
    simple=True: solo la S (para favicon e íconos pequeños, donde la diagonal se confundiría con $)."""
    d, (x0, y0, x1, y1), upem = glifo_S()
    s = alto_S / (y1 - y0)
    ancho = (x1 - x0) * s
    ox = 106 - ancho / 2
    oy = 128 + alto_S / 2
    tr = f'translate({ox - x0*s:.3f},{oy + y0*s:.3f}) scale({s:.5f},{-s:.5f})'
    partes = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB} {VB}" width="{size}" height="{size}">']
    if bg:
        partes.append(f'<rect width="{VB}" height="{VB}" fill="{bg}"/>')
    if simple:
        # S centrada, sin aguja
        tr_c = f'translate({120 - ancho/2 - x0*s:.3f},{oy + y0*s:.3f}) scale({s:.5f},{-s:.5f})'
        partes.append(f'<path transform="{tr_c}" d="{d}" fill="{ink}"/>')
        partes.append('</svg>')
        return '\n'.join(partes)
    partes.append(f'<path transform="{tr}" d="{d}" fill="{ink}"/>')
    # aguja: ojo arriba a la derecha, punta abajo a la izquierda
    ojo = (163.0, 30.0); punta = (72.0, 216.0)
    w_ag = 9.0
    body, eye, (ecx, ecy) = needle(ojo, punta, w_eye=w_ag, eye_len=19.0, eye_w=3.4)
    if hilo:
        # vuelta del hilo alrededor de un punto arriba-derecha del ojo y caída hacia la derecha
        cx_, cy_ = ecx + 17, ecy - 6
        r = 13.0
        pts = []
        for i in range(0, 34):
            a = math.radians(205 + i * 10)
            pts.append((cx_ + r * math.cos(a), cy_ + r * math.sin(a)))
        loop = f'M {ecx:.1f} {ecy:.1f} L {pts[0][0]:.1f} {pts[0][1]:.1f} ' + ' '.join(f'L {x:.1f} {y:.1f}' for x, y in pts[1:])
        fx, fy = pts[-1]
        loop += f' C {fx+18:.1f} {fy+14:.1f}, {fx+26:.1f} {fy+44:.1f}, {fx+14:.1f} {fy+78:.1f}'
        partes.append(f'<path d="{loop}" fill="none" stroke="{acento}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>')
        # arco fino que acompaña el bowl inferior izquierdo (por fuera del trazo)
        partes.append(f'<path d="M 52 148 c -12 26, 0 56, 32 66" fill="none" stroke="{acento}" stroke-width="1.8" stroke-linecap="round"/>')
        # puntada discontinua por fuera del bowl inferior derecho
        partes.append(f'<path d="M 152 138 c 24 10, 30 44, 8 62 c -9 7, -20 10, -30 9" fill="none" stroke="{acento}" stroke-width="1.7" stroke-dasharray="4.5 3.5" stroke-linecap="round"/>')
    halo = (f'<line x1="{ojo[0]}" y1="{ojo[1]}" x2="{punta[0]}" y2="{punta[1]}" stroke="{bg or LINO}" '
            f'stroke-width="{w_ag + 5:.1f}" stroke-linecap="round"/>')
    partes.append(halo)
    partes.append(f'<path d="{body}" fill="{ink}"/>')
    partes.append(eye.replace(LINO, bg or LINO))
    partes.append('</svg>')
    return '\n'.join(partes)


def hoja_v2():
    iso = lambda **k: isotipo_v2_svg(**k)
    wm, _, _ = wordmark_svg(ink=LINO, height=56)
    wm_inner = wm[wm.index('<g'):wm.rindex('</svg>')]
    def inner(svg):
        return svg[svg.index('<path'):svg.rindex('</svg>')]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760">
<rect width="1200" height="760" fill="{LINO}"/>
<g transform="translate(60,40) scale(1.4)">{inner(iso())}</g>
<g transform="translate(440,40) scale(0.6)">{inner(iso())}</g>
<g transform="translate(600,40) scale(0.3)">{inner(iso(simple=True))}</g>
<g transform="translate(690,40) scale(0.15)">{inner(iso(simple=True))}</g>
<g transform="translate(740,40) scale(0.0833)">{inner(iso(simple=True))}</g>
<rect x="60" y="420" width="1080" height="300" fill="#000"/>
<g transform="translate(100,440) scale(1.1)">{inner(iso(bg='#000', ink=LINO, acento=LINO))}</g>
<g transform="translate(420,540)">{wm_inner}</g>
</svg>'''




if __name__ == '__main__':
    _principal()
    save('isotipo-v2', isotipo_v2_svg(bg=LINO), 800)
    save('hoja-v2', hoja_v2(), 1600)
    if len(sys.argv) > 1:
        export_repo(sys.argv[1])
