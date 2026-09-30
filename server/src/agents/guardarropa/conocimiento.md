# Guardarropa — Manual de inventario y catalogación

Este departamento convierte fotos y descripciones en fichas de prenda fiables; de ellas dependen Estilismo, Planificación, Cuidado y Compras. Regla base: registrar lo que se ve, marcar lo que se infiere y preguntar lo que no se puede saber.

## Cómo leer una prenda en una foto

Analiza en este orden, sin saltarte pasos:

- **Categoría.** Elige una sola: `superior`, `inferior`, `vestido`, `abrigo`, `calzado`, `accesorio`, `ropa-interior`, `deporte`, `otro`. Un vestido o enterizo va a `vestido`. Blazer, chaqueta, cardigan grueso, gabardina, parka y saco van a `abrigo`. Una sudadera de uso diario es `superior`; si es técnica y se usa para entrenar, `deporte`. Calcetines y medias son `ropa-interior`.
- **Subtipo.** Una palabra concreta y en singular: camisa, camiseta, polo, blusa, suéter, cardigan, sudadera, jean, chino, jogger, falda, short, blazer, chaqueta, abrigo, parka, gabardina, vestido, zapatilla, zapato, bota, botín, sandalia, mocasín, bolso, cinturón, bufanda, gorro.
- **Colores.** Lista de uno a tres colores en lenguaje natural (ver paleta). El primero es el dominante. Un estampado se describe como colores más nota de estampado: `["azul marino", "blanco"]` y en notas "rayas finas".
- **Tela probable.** Se deduce por textura, brillo y caída (ver sección). Si no estás seguro, escribe la tela más probable y marca "por confirmar" en notas.
- **Temporada.** `verano` (tejidos ligeros, manga corta, lino, sandalias), `invierno` (lana gruesa, acolchado, forro polar, botas), `entretiempo` (camisas de manga larga, blazers ligeros, jeans, zapatillas de piel), `todo-el-ano` (camiseta de algodón, jean de peso medio, zapatilla blanca, cinturón de cuero) solo si la prenda se usa de verdad en verano e invierno en la ciudad del cliente.
- **Ocasiones.** Entre una y cuatro: oficina, casual, fiesta, deporte, formal, cita, viaje, casa.
- **Estado.** Por defecto `limpia` al registrar. Si el cliente dice que la trae puesta o que la usó, `usada` con `usosDesdeLavado: 1`. Si menciona una rotura, mancha o botón suelto, `reparar`. Si es de otra temporada y está guardada, `guardada`.

## Convención de nombres

El campo `nombre` es lo que el cliente leerá en cada plan. Debe identificar la prenda sin abrir la foto.

- Estructura: **subtipo + color dominante + rasgo distintivo** (tela, corte, estampado o detalle). Ejemplos: "Camisa blanca de lino", "Jean azul oscuro recto", "Blazer gris marengo de lana", "Zapatilla blanca de cuero", "Vestido negro midi de punto", "Suéter camel de cuello alto".
- Máximo seis palabras. Sin mayúsculas innecesarias, sin comillas, sin marca.
- Nunca solo la marca ("Zara", "Nike"). La marca va en el campo `marca`. Si el cliente insiste en distinguir dos prendas iguales de marcas distintas, se añade al final: "Camiseta negra básica (Uniqlo)".
- Si hay dos prendas casi idénticas, diferencia por rasgo real: "Camiseta blanca cuello redondo" y "Camiseta blanca cuello en V". Si no hay rasgo visible, numera: "Camiseta blanca básica 1" y "Camiseta blanca básica 2".
- El nombre no lleva estado ni ocasión. Eso va en sus campos.

## Estimar la tela sin etiqueta

Señales visuales fiables:

- **Algodón:** mate, textura visible, arrugas suaves y redondeadas, caída moderada. Camisetas, camisas de oxford y popelina, jeans.
- **Lino:** arrugas marcadas e irregulares, hilo grueso visible, ligero brillo seco. Casi siempre verano.
- **Lana:** superficie con pelo muy corto o textura de punto, sin brillo, caída pesada y rígida en blazers y abrigos. Puede tener pilling en zonas de roce.
- **Cashmere y lana merino:** punto muy fino, tacto que se ve suave, sin brillo, ligereza aparente. Confirma con el cliente.
- **Seda:** brillo suave y cambiante con la luz, caída fluida, arrugas finas. Blusas y pañuelos.
- **Viscosa y rayón:** caída muy fluida, brillo ligero, arrugas fáciles. Vestidos y blusas de precio medio.
- **Poliéster:** brillo uniforme y algo plástico, casi sin arrugas, caída rígida en tejidos planos o muy fluida en gasas. Común en blusas, forros, ropa de fiesta económica.
- **Nylon:** superficie lisa, crujiente, repele agua. Cortavientos, parkas, mochilas.
- **Denim:** trama diagonal visible, tono índigo con desgaste; muy liso y elástico indica elastano.
- **Cuero:** grano irregular, brillo suave, pliegues que marcan. Cuero sintético: grano perfectamente regular, brillo plástico, bordes cortados sin fibra.
- **Ante o nobuk:** mate, aterciopelado, cambia de tono al pasar la mano.
- **Plumas:** compartimentos acolchados, volumen alto, muy ligero al vestir.

Cuando la foto no permite decidir, registra la opción más probable y pregunta: "Parece algodón. Si tienes la etiqueta a mano, dime la composición y ajusto el cuidado". La tela decide `usosMaxAntesDeLavar`, así que siempre vale la pena confirmarla en prendas de lana, seda, cashmere y cuero.

## Tabla de usos antes de lavar

Valores por defecto para `usosMaxAntesDeLavar`. Cuidado puede ajustarlos por clima caluroso, sudoración o uso intenso.

| Prenda | Tela habitual | Usos |
|---|---|---|
| Camiseta, top, polo | algodón, mezcla | 1–2 |
| Camisa, blusa | algodón, lino, viscosa | 2–3 |
| Camisa, blusa | seda | 1–2 |
| Suéter fino, cardigan | algodón, viscosa | 3–4 |
| Suéter de lana, merino, cashmere | lana | 5–7 |
| Sudadera, hoodie | algodón, mezcla | 3–5 |
| Jean | denim | 5–10 |
| Pantalón de vestir, chino | algodón, lana, mezcla | 3–5 |
| Falda, short | según tela | 3–5 |
| Vestido de diario | algodón, viscosa | 1–2 |
| Vestido de fiesta | seda, poliéster | 1–2 |
| Blazer, chaqueta de sastrería | lana, mezcla | 5–8 (o por temporada) |
| Abrigo, gabardina, parka | lana, nylon, plumas | por temporada (registrar 20) |
| Chaqueta de cuero | cuero | no se lava (registrar 30) |
| Calzado | cualquiera | n/a (registrar 0) |
| Ropa interior, calcetines | cualquiera | 1 |
| Ropa de deporte | técnica | 1 |
| Bufanda, gorro | lana, acrílico | por temporada (registrar 10) |
| Bolso, cinturón | cuero, tela | n/a (registrar 0) |

Regla para rangos: elige el valor bajo en climas calurosos o personas que sudan más; el valor alto en climas templados y uso de oficina.

## Paleta de colores en lenguaje natural

Usa siempre estos nombres para que la búsqueda y la combinación funcionen. No uses códigos ni nombres comerciales.

- **Blancos y claros:** blanco, blanco roto, marfil, crudo, hueso, arena, beige, piedra.
- **Marrones:** camel, tostado, chocolate, café, tabaco, caqui, coñac.
- **Grises:** gris claro, gris medio, gris marengo, grafito, antracita.
- **Negros y azules oscuros:** negro, azul marino, azul noche.
- **Azules:** azul claro, celeste, azul índigo, azul denim, azul rey, azul petróleo.
- **Verdes:** verde oliva, verde militar, verde botella, verde salvia, verde menta, verde esmeralda.
- **Rojos y rosas:** rojo, burdeos, vino, granate, terracota, ladrillo, coral, rosa palo, rosa empolvado, fucsia.
- **Amarillos y naranjas:** mostaza, ocre, amarillo, naranja, óxido.
- **Morados y metálicos:** lila, lavanda, ciruela, morado; dorado, plateado.

Para jeans, indica el lavado: "azul oscuro", "azul medio", "azul claro", "negro", "gris", "blanco". Para estampados, registra los dos colores principales y describe el motivo en notas: rayas, cuadros, lunares, flores, animal print, tie-dye, gráfico.

## Detección de duplicados

Antes de crear una prenda nueva, compara con el inventario:

- Mismo subtipo, mismo color dominante y misma tela probable: duplicado probable. Pregunta: "Ya tienes una camisa blanca de algodón registrada. ¿Es la misma o es otra?".
- Misma foto o misma prenda fotografiada desde otro ángulo (mismo fondo, misma luz): muy probablemente duplicado. Confirma antes de guardar.
- Prendas casi iguales que sí son distintas se registran ambas, con nombres diferenciados y la nota "tiene dos similares". Con tres o más del mismo subtipo y color, informa a Compras: es un patrón de compra repetida.

## Compra guardada (deseo)

Un `Deseo` no es una prenda del armario. Es algo que el cliente quiere comprar o que Compras recomienda. Se registra con `nombre`, `motivo`, `prioridad` (alta, media, baja) y `precioObjetivo` opcional.

- Nunca aparece en looks ni planes hasta que se convierte en prenda real; cuando el cliente confirma la compra, se crea la prenda y se cierra el deseo.
- Si el cliente sube una foto de tienda preguntando si comprar, eso va a Probador, no a inventario. Solo se registra cuando dice "ya la compré" o "ya la tengo".

## Problemas frecuentes en la foto

- **Prenda colgada o doblada:** el corte y el largo no se aprecian. Registra subtipo y color; pide una foto extendida si el largo importa (pantalones, vestidos, faldas).
- **Luz cálida o fría:** un blanco puede verse crema y un azul marino, negro. Si el color es dudoso, pregunta: "¿Es negro o azul marino? En la foto cuesta distinguirlo".
- **Varias prendas en una foto:** registra una por una y confirma la lista con el cliente antes de guardar.
- **Etiqueta borrosa:** no adivines la talla ni la composición. Pide otra foto o que la lea.
- **Captura de pantalla de una tienda:** no es del armario. Ofrece registrarla como deseo.

## Preguntas que sí vale la pena hacer

Pregunta solo lo que cambia una decisión, en una sola línea cuando sea posible:

- **Talla:** siempre útil para Compras y Probador. "¿Qué talla es? Lo guardo para futuras compras".
- **Tela:** cuando la foto no la revela y afecta cuidado (lana, seda, cuero, mezclas).
- **Marca:** opcional, útil para tallaje futuro; no insistas.
- **Dónde se compró y precio:** opcional; alimentan el costo por uso y las recomendaciones de tienda.
- **Estado real:** si la prenda tiene señales de desgaste visibles, pregunta si quiere marcarla para reparar.

Cierra cada registro con una confirmación breve en lenguaje natural: "Registré: Camisa blanca de lino, entretiempo, oficina y casual, limpia. Lavar cada 2 o 3 usos. ¿Corregimos algo?".
