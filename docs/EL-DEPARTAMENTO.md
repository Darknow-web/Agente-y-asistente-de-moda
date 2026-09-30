# El departamento de moda: quién es quién y cómo se edita

SASTRA funciona como una empresa de moda pequeña. El cliente habla siempre con **Sastra**, pero por dentro
trabajan ocho departamentos, cada uno con su rol, su conocimiento y sus herramientas. Todos comparten el
propósito de la casa (`server/src/config/empresa.md`) y el contexto real del cliente (perfil, armario,
clima).

## Organigrama

```
                 Cliente
                    │
          Dirección Creativa (director)
   entiende, delega, consolida, recuerda
                    │
   ┌──────────┬─────┴─────┬──────────────┬──────────┬──────────┐
Guardarropa Estilismo Planificación   Cuidado   Compras   Probador
 inventario   looks     semana/día    lavado    huecos y  veredicto
 y fotos                y clima       y manchas  precios   en tienda
                    │
             Control de Calidad
       revisa lo importante antes de enviar
```

## Cada departamento

| Carpeta | Rol | Herramientas que puede usar | Modelo por defecto |
|---|---|---|---|
| `agents/director` | Recibe el mensaje, resuelve lo simple, delega lo especializado con `delegar_a`, consolida una sola respuesta y guarda lo que aprende del cliente. | delegar_a, actualizar_perfil, listar_prendas, registrar_uso, marcar_lavada | Gemini Flash |
| `agents/guardarropa` | Cataloga prendas desde foto (nombre, categoría, colores, tela, temporada, usos antes de lavar), corrige datos, detecta duplicados, guarda deseos. | listar/crear/editar prendas, registrar_uso, marcar_lavada, guardar_deseo | Gemini Flash |
| `agents/estilismo` | Arma looks con lo que existe, explica el porqué, ofrece alternativas, resuelve dudas de estilo. | listar_prendas, actualizar_perfil | Gemini Flash |
| `agents/planificacion` | Plan semanal (JSON validado contra el armario) y ajuste diario según rutina y clima. | listar_prendas, clima, actualizar_perfil | Gemini Pro (semana), Lite (día) |
| `agents/cuidado` | Cuándo y cómo lavar, manchas, planchado, guardado, calzado, reparaciones. | listar_prendas, registrar_uso, marcar_lavada, editar_prenda | Gemini Flash-Lite |
| `agents/compras` | Huecos del armario, prioridades, precios y tiendas reales con búsqueda en internet. | listar_prendas, guardar_deseo, buscar_en_internet | Gemini Pro (+ Flash para buscar) |
| `agents/probador` | Veredicto honesto sobre foto o video en tienda: calce, color, si sirve con el armario. | listar_prendas, guardar_deseo | Gemini Flash |
| `agents/calidad` | Revisa borradores importantes (planes, compras, veredictos, catalogación, respuestas largas) y devuelve JSON con el texto corregido. Encendido por defecto. | ninguna | Gemini Flash |

## Cómo se construye cada agente

Dentro de cada carpeta hay tres cosas:

1. **`prompt.md`**: su rol y sus reglas de trabajo. Está escrito en español, en segunda persona. Se puede editar
   como un documento normal. Ejemplo: si quieres que Estilismo proponga siempre dos alternativas, se añade
   esa regla ahí.
2. **`conocimiento.md`**: el manual interno del departamento (teoría del color, tabla de lavados, criterios de
   compra, cómo juzgar el calce…). Aquí va el conocimiento de la marca. Cuanto mejor sea este texto, mejores
   son las respuestas. Se edita libremente; conviene mantenerlo entre 900 y 1.600 palabras para no encarecer
   cada llamada.
3. **`index.ts`** (solo algunos): lógica especial, como la catalogación estructurada de Guardarropa o el plan
   semanal de Planificación. Esto ya es código.

Los cambios en `prompt.md` y `conocimiento.md` se aplican al reiniciar el servidor (o en la siguiente
publicación). No hace falta programar.

## Cómo fluye un mensaje

1. El cliente escribe (con o sin foto/video). El servidor comprueba su acceso y su límite diario.
2. Se construye el contexto: perfil resumido, armario en tabla compacta, fecha, clima de su ciudad.
3. La Dirección lee el mensaje y decide: responde directo o delega. Cada delegación es una llamada a un
   departamento con un encargo claro; el departamento puede usar sus herramientas (leer o editar el armario,
   consultar el clima, buscar en internet) y devuelve su respuesta.
4. La Dirección consolida una sola respuesta en la voz de Sastra.
5. Si la respuesta es importante (plan, compras, veredicto, catalogación o texto largo), pasa por Calidad.
6. Se envía al cliente, se guarda la conversación (resumida si crece) y se registra el consumo.

En la app, mientras esto ocurre, aparece una línea discreta: "Estilismo y Cuidado están trabajando".

## El propósito de la casa

`server/src/config/empresa.md` es el texto que todos los agentes leen primero: misión, cómo trabajamos,
tono, lo que no hacemos. Si la marca cambia de rumbo, se cambia ahí y todo el departamento se alinea.

## Añadir un departamento nuevo

1. Crear la carpeta `server/src/agents/<nombre>/` con `prompt.md` y `conocimiento.md`.
2. Añadir el nombre en `shared/types.ts` (`NombreAgente` y `AGENTES`), en `modelos.json` (motor y nivel) y en
   `server/src/agents/departamentos.ts` (lista de delegables y herramientas permitidas).
3. Mencionarlo en el `prompt.md` de la Dirección para que sepa cuándo delegarle.
