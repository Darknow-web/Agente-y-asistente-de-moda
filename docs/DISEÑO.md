# Sistema de diseño SASTRA

Dirección aprobada por el cliente: **editorial de lujo silencioso**. Lino y negro, serif de alto contraste
para titulares, mucho aire, fotografía protagonista, ritmo pausado, movimiento con intención.

## Qué aprendimos de las webs de moda de alto tráfico

Revisamos referencias de lujo y moda (Bottega Veneta, Loewe, Net-a-Porter, SSENSE, Zara, Jacquemus,
Aimé Leon Dore y los seleccionados de Awwwards en la categoría lujo). Patrones comunes:

- **La foto manda.** El héroe es una imagen o un video a sangre completa, sin botones encima ni textos largos.
- **Tipografía con carácter.** Serif de alto contraste (tipo Didone, herencia Vogue/Harper's) para titulares,
  y una grotesca discreta para todo lo demás. Pocas familias, bien usadas.
- **Aire.** Márgenes generosos, pocas cosas por pantalla, cada elemento con espacio para respirar.
- **Ritmo pausado.** Nada de urgencia: sin pop-ups, sin contadores, sin "¡solo hoy!".
- **Movimiento con intención.** Una sola transición orquestada al entrar; hover y scroll sutiles.
- **Consistencia.** Campaña, producto y servicio se ven como una sola casa.
- **Rendimiento.** Lo bello carga rápido. Lo que bloquea no es lujo.

## Marca

- **Nombre:** SASTRA. "Sastre" + "śāstra" (tratado, conocimiento). El conocimiento del sastre.
- **Tagline:** Tu departamento de moda.
- **Imagotipo "Botón"** (aprobado por el cliente entre cinco propuestas): un disco de tinta con la S en
  Italiana, una serif caligráfica de alto contraste, y una aguja que recorre la diagonal de la letra como su
  espina. Dentro del disco, S y aguja van en lino. Funciona como botón, sello e ícono de app.
- **Versiones:** `isotipo.svg` (positivo: disco tinta, S lino), `isotipo-lino.svg` (negativo: disco lino, S
  tinta), `isotipo-simple.svg` (disco + S, sin aguja, para favicon e íconos ≤ 48 px), `isotipo-sin-disco.svg`
  (S y aguja en tinta, para usos especiales), `wordmark.svg` (SASTRA en Bodoni Moda 500 convertido a trazados),
  `lockup.svg` (disco + wordmark) y sus variantes en lino. Se conservan las propuestas anteriores
  (`isotipo-hilo-v1.svg`, `isotipo-espina-v2.svg`) y la hoja comparativa en `docs/marca/propuestas-isotipo.png`.
  Todo en `src/brand/`.

## Paleta

| Nombre | Hex | Uso | Contraste sobre lino |
|---|---|---|---|
| Lino | `#EEEAE1` | Fondo principal | — |
| Tinta | `#000000` | Texto, botones, líneas | 17.5:1 |
| Piedra | `#5E5952` | Texto secundario, metadatos | 5.8:1 |
| Añil | `#1F2F6B` | Único acento: foco, enlaces activos, el hilo en estados interactivos | 10.4:1 |
| Papel | `#F7F5F0` | Superficies elevadas (tarjetas, hojas) | — |
| Hilo | `#D9D3C7` | Líneas finas, divisores, bordes | — |

Modo oscuro (chat nocturno): fondo Tinta, texto Lino, secundario `#A8A39A` (8.4:1), acento Lino.

Todo cumple WCAG AA (≥ 4.5:1 en texto normal). El acento se usa poco: si un elemento de acento aparece
más de dos veces en una pantalla, sobra uno.

## Tipografía

- **Bodoni Moda** (Google Fonts): titulares, nombres de prendas, cifras grandes. Pesos 400 y 500.
  Óptico grande (opsz 96) en display. Line-height 1.05 a 1.15.
- **Schibsted Grotesk** (Google Fonts): interfaz, cuerpo, etiquetas, botones. Pesos 400, 500, 600.
  Line-height 1.5 en cuerpo.
- Escala (px, móvil / escritorio): display 44 / 88 · h1 32 / 56 · h2 24 / 36 · cuerpo 16 / 17 ·
  pequeño 13 / 14. Longitud de línea ≤ 72 caracteres.
- Etiquetas en mayúsculas con tracking 0.12em solo en navegación y categorías; nunca como "cejilla"
  sobre cada título.

## Retícula y espacio

- 12 columnas en escritorio (gutter 24, margen 80), 4 en móvil (gutter 16, margen 20).
- Composición asimétrica: módulos de imagen grandes, texto pequeño alineado a la izquierda.
- Espaciado en múltiplos de 8. Secciones separadas por 96–160 px en escritorio, 56–80 en móvil.
- Bordes: radio 0 en imágenes y tarjetas editoriales; radio 999 solo en chips y avatares.
- Sombras: ninguna. La jerarquía se construye con tamaño, espacio y líneas de 1 px color Hilo.

## Movimiento

- Una sola secuencia de entrada por pantalla (400–600 ms, easing `cubic-bezier(.2,.7,.2,1)`).
- Transiciones de estado 200–300 ms. Sin rebotes, sin parallax agresivo, sin autoplay con sonido.
- Respeta `prefers-reduced-motion`.

## Componentes clave

- **Botón primario:** fondo Tinta, texto Lino, sin radio, altura 48, tracking 0.04em.
- **Botón secundario:** borde 1 px Tinta, fondo transparente.
- **Tarjeta de prenda:** foto 4:5 a sangre, debajo nombre en Bodoni 18 y meta en Schibsted 13 Piedra.
- **Burbuja de chat:** sin burbujas. El Director habla en párrafos con su nombre en pequeño;
  el usuario escribe alineado a la derecha en Piedra. Como una conversación editorial, no un messenger.
- **Fotografía:** siempre 4:5 o 3:4 en prendas; a sangre completa en portadas. Nada de marcos.

## Lo que evitamos a propósito

Tarjetas idénticas con sombra gris, gradientes decorativos, emojis en la interfaz, cejillas en mayúsculas
sobre cada título, flechas "→" en botones, tipografías por defecto (Inter, Roboto, Arial), fondos
"casi negro" tintados. Si algo parece plantilla, se rehace.
