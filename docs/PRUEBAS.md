# Cómo probar SASTRA

## Automáticas (sin gastar)

```bash
npm test          # 40+ pruebas: motor intercambiable, mapeos a Gemini y Claude, agentes en modo simulado, fechas, contexto
npm run typecheck # tipos del cliente y del servidor
npm run lint
```

## Con llave real, una sola llamada

```bash
npm run smoke
```

Lista los modelos disponibles, comprueba que cada agente apunte a un modelo que existe y hace una llamada mínima
("Responde solo: ok") a cada motor con llave. Imprime tokens y costo estimado. Si algo falla, el mensaje dice
qué variable falta.

## Recorrido manual completo (15 minutos)

Hazlo con dos cuentas de Google distintas para confirmar que los armarios están separados.

1. **Acceso**: abrir la app sin estar invitado → pantalla "Sin acceso" con tu correo. Agregarte desde una
   cuenta administradora en Invitados → recargar → entras.
2. **Diagnóstico** (Perfil › Diagnóstico): Firestore ok, Storage ok, Gemini ok, modelos válidos.
3. **Perfil**: Sastra pregunta ciudad y rutina en el chat; comprobar que aparecen en Perfil sin haberlas
   escrito a mano.
4. **Armario**: subir 5 prendas con foto. Revisar que la propuesta de catalogación sea razonable y que las
   preguntas (tela, talla) tengan sentido. Corregir una y guardar.
5. **Look**: pedir "¿Qué me pongo hoy para la oficina?" → solo prendas del armario, con motivo. Pedir otra
   opción.
6. **Semana**: Planificar → 7 días, sin prendas visibles repetidas, respetando las que están para lavar.
7. **Cuidado**: "Se me cayó vino en la camisa blanca" → pasos concretos. "Marca el jean como lavado" →
   estado limpia.
8. **Compras**: "¿Qué me falta para el invierno?" → máximo 3 recomendaciones con prioridad. "¿Dónde
   consigo un abrigo camel en Lima?" → tiendas y precios con fuentes.
9. **Probador**: subir foto en el espejo → veredicto con calce y combinación con el armario; guardar en deseos.
10. **Avisos**: ejecutar las tareas con `curl -X POST -H "x-jobs-secret: TU_SECRETO" https://TU-APP/api/jobs/look-del-dia`
    → aparece el aviso en la app.
11. **Costo**: `/api/uso/resumen` (admin) muestra llamadas y dólares por agente para el mes.

## Qué mirar en el diseño

- Móvil (390 px) y escritorio (1440 px) contra las maquetas aprobadas.
- Sin tarjetas con sombra, sin emojis, sin flechas en botones, sin cejillas en mayúsculas sobre cada título.
- Foco visible al navegar con teclado; botones de al menos 44 px; contraste AA.
