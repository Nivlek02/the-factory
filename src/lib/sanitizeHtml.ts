/**
 * Saneamiento del HTML que se pinta con `dangerouslySetInnerHTML`.
 *
 * POR QUÉ: la descripción de la campaña, los entregables y los comentarios se guardan como HTML
 * del editor (TipTap) y se renderizaban tal cual salían de la base. Eso es un XSS almacenado: un
 * `<img src=x onerror="...">` guardado en un entregable se ejecuta en el navegador de CUALQUIERA
 * que abra esa campaña, y desde ahí se puede leer la sesión de Supabase de localStorage. Si la
 * víctima es Estratega o Soporte, el atacante se queda con la gestión de usuarios completa.
 * (Ojo: un `<script>` inyectado por innerHTML no corre, pero los atributos `onerror`/`onload` sí,
 * así que "no hay <script>" no es ninguna defensa.)
 *
 * CÓMO: DOMPurify con una lista blanca de etiquetas/atributos igual a lo que produce el editor.
 * Es lista blanca a propósito — bloquear "lo malo" siempre se queda corto.
 *
 * Es idempotente y no toca el dato guardado: solo limpia en la LECTURA, así que el HTML que ya
 * esté en Supabase queda cubierto sin migrar nada (mismo patrón que `stripApprovalNodes`).
 */
import DOMPurify from 'dompurify';

/** Etiquetas que el RichTextEditor puede generar (starter-kit + link, image, underline,
 *  text-align, task-list, font-family/size → todo eso viaja en `style`). */
const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code', 'hr',
  'a', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'label', 'input', // las listas de tareas de TipTap son <li><label><input type=checkbox>
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height',
  'colspan', 'rowspan',
  'style', 'class',
  'data-type', 'data-checked', // task-list
  'type', 'checked', 'disabled',
];

export const sanitizeHtml = (html: string | null | undefined): string => {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // `javascript:` y compañía en href/src. DOMPurify ya filtra los esquemas peligrosos; esto
    // lo deja explícito para que un cambio futuro no lo relaje sin querer.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
    // Sin esto, un `<form>` o un `<a name="...">` malicioso puede pisar propiedades del
    // document (DOM clobbering) y confundir código que lea document.<algo>.
    SANITIZE_DOM: true,
    // Los `<img src="data:image/...">` que pega el editor tienen que sobrevivir.
    ADD_DATA_URI_TAGS: ['img'],
  });
};

/** Listo para `dangerouslySetInnerHTML={dangerousHtml(valor)}`. Un solo lugar que decide. */
export const dangerousHtml = (html: string | null | undefined) => ({ __html: sanitizeHtml(html) });
