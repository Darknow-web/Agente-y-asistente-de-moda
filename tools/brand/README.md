# Generador de la marca SASTRA

`build_brand.py` construye todos los vectores de la marca (isotipo, wordmark, lockup, favicon, íconos de app,
imagen para redes) a partir de geometría, no de un dibujo a mano. Así cualquier ajuste (grosor del hilo,
inclinación de la aguja) se aplica a todos los archivos a la vez.

## Regenerar

```bash
pip install fonttools cairosvg pillow
python3 tools/brand/build_brand.py .          # exporta a src/brand/ y public/
```

Los parámetros están al inicio de `isotipo_svg()` (radios de los dos arcos, posición y largo de la aguja,
grosor del hilo). La fuente del wordmark (Bodoni Moda 500) está en `fonts/` y se convierte a trazados,
por lo que los SVG no dependen de tener la fuente instalada.

El manual de marca en PDF se genera desde `docs/marca/manual.html` con Chromium:

```bash
chrome --headless=new --print-to-pdf=docs/marca/SASTRA-manual-de-marca.pdf --no-pdf-header-footer "file://$PWD/docs/marca/manual.html"
```
