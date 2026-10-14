/**
 * Foto de catálogo con IA generativa (Gemini de imagen) y verificación de fidelidad.
 *
 * Cuesta unos 4 centavos por foto. En Premium se aplica sola a cada prenda nueva y, a pedido, con el botón
 * "Mejorar foto" o "Pasar mi armario a foto de catálogo"; siempre dentro del cupo diario
 * (planes.json → mejorarFotoPorDia; en el plan Gratis es 0).
 *
 * El modelo repinta la prenda, y podría cambiar un estampado o un color. Por eso, después, el
 * motor de Guardarropa compara el original con el resultado y lo descarta si ya no es la misma prenda.
 */
import { ErrorProveedor } from '../ai/provider.js';
import { estimarCostoUsd } from '../ai/costos.js';
import { modelosImagen, router } from '../ai/router.js';
import { type ProveedorGemini } from '../ai/gemini.js';
import { registrarConsumo } from '../data/repos.js';
import { leerLimites } from '../config/limites.js';

/** Foto de catálogo: la misma prenda, fotografiada como producto de tienda sobre el lino de la marca. */
const INSTRUCCION_CATALOGO = [
  'Turn this photo of a garment into a clean e-commerce catalog product photo of the SAME garment.',
  'The garment must look freshly ironed, without wrinkles, centered, front view, entirely visible and not cropped.',
  'Tops, shirts, dresses and jackets: invisible ghost mannequin (3D shape, no person, no hanger). Trousers, skirts, shoes and accessories: neatly laid out or standing alone.',
  'Keep EVERYTHING about the garment identical: same cut, same exact colors, same fabric texture, same print, logos, text, buttons, zippers, stitching and labels. Do not add or remove details.',
  'Background: plain, seamless, evenly lit warm light beige (#EEEAE1) with a soft natural shadow under the garment. No people, no text overlays, no props, no other garments.',
  'Photorealistic studio product photography, soft diffused light.',
].join(' ');

const ESQUEMA_FIDELIDAD = {
  type: 'object',
  properties: {
    mismaPrenda: { type: 'boolean', description: 'true solo si la segunda foto muestra exactamente la misma prenda que la primera (mismo corte, color, estampado, logos y detalles)' },
    motivo: { type: 'string' },
  },
  required: ['mismaPrenda', 'motivo'],
};

export interface ResultadoCatalogo {
  datos: Buffer;
  mime: string;
  costoUsd: number;
  modelo: string;
}

export function catalogoDisponible(): boolean {
  return router.proveedorDisponible('gemini') && modelosImagen().length > 0;
}

/**
 * Devuelve la foto de catálogo o null si el resultado no pasó la verificación de fidelidad.
 * Lanza ErrorProveedor si ningún modelo de imagen respondió.
 */
export async function generarFotoCatalogo(uid: string, foto: { datos: Buffer; mime: string }): Promise<ResultadoCatalogo | null> {
  const gemini = router.obtenerProveedor('gemini') as ProveedorGemini;
  const candidatos = modelosImagen();
  if (!candidatos.length) throw new ErrorProveedor('No hay un modelo de imagen configurado en modelos.json ("imagen.modelos").', 'gemini', false);
  const senal = AbortSignal.timeout(leerLimites().segundosMaxPorLlamadaIA * 1000);

  let ultimo: ErrorProveedor | null = null;
  for (const modelo of candidatos) {
    try {
      const r = await gemini.generarImagen(modelo, { instruccion: INSTRUCCION_CATALOGO, imagen: { mime: foto.mime, base64: foto.datos.toString('base64') }, senal });
      const costo = estimarCostoUsd('gemini', modelo, r.tokensEntrada, r.tokensSalida);
      await registrarConsumo(uid, { agente: 'guardarropa', proveedor: 'gemini', modelo, tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida, costoEstimadoUsd: costo, fecha: new Date().toISOString() }).catch(() => undefined);
      const resultado = { datos: Buffer.from(r.base64, 'base64'), mime: r.mime, costoUsd: costo, modelo };
      const fiel = await esLaMismaPrenda(uid, foto, resultado);
      if (!fiel.misma) {
        console.warn(`[imagenes] foto de catálogo descartada (${modelo}): ${fiel.motivo}`);
        return null;
      }
      return { ...resultado, costoUsd: costo + fiel.costoUsd };
    } catch (e) {
      if (!(e instanceof ErrorProveedor)) throw e;
      ultimo = e;
      // Modelo inexistente en la cuenta (404) o petición inválida (400): probamos el siguiente de la lista.
      if (/HTTP (404|400)/.test(e.message)) continue;
      throw e;
    }
  }
  throw ultimo ?? new ErrorProveedor('Ningún modelo de imagen respondió.', 'gemini', false);
}

/** Comparación barata con el motor de Guardarropa: ¿es la misma prenda? */
async function esLaMismaPrenda(uid: string, original: { datos: Buffer; mime: string }, retocada: { datos: Buffer; mime: string }): Promise<{ misma: boolean; motivo: string; costoUsd: number }> {
  try {
    const { respuesta, costoUsd } = await router.generar('guardarropa', {
      sistema: 'Eres un revisor de fotos de prendas. Respondes solo con el JSON pedido.',
      mensajes: [
        {
          rol: 'usuario',
          partes: [
            { tipo: 'texto', texto: 'Primera foto: la prenda original. Segunda foto: la misma prenda convertida por IA en foto de catálogo. ¿La segunda muestra exactamente la misma prenda (corte, color, estampado, logos, botones, detalles)? Ignora el fondo, la luz, las arrugas, el ángulo y si va sobre maniquí invisible.' },
            { tipo: 'imagen', mime: original.mime, base64: original.datos.toString('base64') },
            { tipo: 'imagen', mime: retocada.mime, base64: retocada.datos.toString('base64') },
          ],
        },
      ],
      esquemaJson: ESQUEMA_FIDELIDAD,
      temperatura: 0,
    });
    await registrarConsumo(uid, { agente: 'guardarropa', proveedor: respuesta.proveedor, modelo: respuesta.modelo, tokensEntrada: respuesta.uso.tokensEntrada, tokensSalida: respuesta.uso.tokensSalida, costoEstimadoUsd: costoUsd, fecha: new Date().toISOString() }).catch(() => undefined);
    const json = JSON.parse(respuesta.texto.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { mismaPrenda?: boolean; motivo?: string };
    return { misma: json.mismaPrenda === true, motivo: String(json.motivo ?? ''), costoUsd };
  } catch (e) {
    // Si la verificación falla, mejor conservar el original que arriesgar una prenda cambiada.
    return { misma: false, motivo: `verificación no disponible: ${e instanceof Error ? e.message : String(e)}`, costoUsd: 0 };
  }
}
