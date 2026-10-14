/**
 * Datos del proveedor que exigen los términos, la política de privacidad y el Libro de Reclamaciones
 * (Código de Protección y Defensa del Consumidor, Ley 29571; Ley 29733 de Protección de Datos Personales).
 * COMPLETAR antes de cobrar: nombre o razón social, RUC, domicilio y correo de atención. Mientras falten,
 * las páginas legales muestran el aviso "por completar".
 */
export const PROVEEDOR = {
  nombre: '[Nombre o razón social del titular]',
  ruc: '[RUC]',
  domicilio: '[Domicilio fiscal], Lima, Perú',
  correo: 'cingacordova@gmail.com',
  marca: 'SASTRA',
  /** Fecha de la versión vigente de los textos legales. */
  vigencia: '14 de octubre de 2026',
};

export const proveedorIncompleto = Object.values(PROVEEDOR).some((v) => v.startsWith('['));
