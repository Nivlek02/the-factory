/**
 * Qué archivos de storage usa una campaña.
 *
 * POR QUÉ EXISTE: hasta ahora **nada borraba archivos del bucket**. Quitar un adjunto, borrar la
 * tarea o borrar la campaña entera solo eliminaba la *referencia* dentro del blob JSONB; el
 * archivo se quedaba en storage y, como la lectura del bucket es pública, seguía abriéndose con su
 * URL para siempre — incluidos los de campañas que ya no existen. Además la cuota crecía sin tope.
 *
 * Con esto el store puede comparar qué rutas usaba una campaña antes de un cambio y cuáles usa
 * después, y borrar las que quedaron sin dueño (ver `persistAfter` en factoryStore).
 *
 * Se trabaja con **rutas** (`task-1234/56789_abc_pieza.png`), no con URLs: es lo que recibe
 * `storage.remove()`.
 */
import type { FabricaBriefItem, FactoryProject } from '@/store/factoryStore';

const BUCKET = 'task-attachments';

/** Un mismo archivo se puede referenciar por la URL pública o por la de transformación de
 *  imágenes (`/render/image/public/`, ver `getThumbnailUrl`). Las dos llevan a la misma ruta. */
const PREFIJOS = [
  `/storage/v1/object/public/${BUCKET}/`,
  `/storage/v1/render/image/public/${BUCKET}/`,
];

/**
 * Ruta dentro del bucket a partir de una URL pública. Devuelve `null` para todo lo que no sea de
 * nuestro storage: adjuntos legados en base64 (`data:…`), enlaces externos, o cadenas vacías.
 * Nunca lanza — esto corre dentro de la lógica de guardado y un dato raro no puede tumbarla.
 */
export const rutaDeUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const limpia = url.trim();
  if (!limpia || limpia.startsWith('data:')) return null;
  for (const prefijo of PREFIJOS) {
    const i = limpia.indexOf(prefijo);
    if (i === -1) continue;
    // Sin la query (`?width=400&quality=60`) ni el fragmento: no son parte de la ruta.
    const ruta = limpia.slice(i + prefijo.length).split(/[?#]/)[0];
    if (!ruta) return null;
    try {
      return decodeURIComponent(ruta);
    } catch {
      return ruta; // un % mal formado no puede romper el guardado
    }
  }
  return null;
};

/** `src` de las imágenes incrustadas en el HTML del editor. Con regex y no con DOMParser a
 *  propósito: esto vive en el store, que también se prueba fuera del navegador. */
const srcsDeHtml = (html?: string | null): string[] => {
  if (!html) return [];
  return [...html.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
};

/** Todas las rutas de storage que usa una tarea: sus adjuntos y las imágenes de su entregable. */
export const rutasDeBrief = (b: FabricaBriefItem): string[] => {
  const urls = [
    ...(b.deliverableAttachments ?? []).map((a) => a?.url),
    ...srcsDeHtml(b.deliverableContent),
  ];
  return urls.map(rutaDeUrl).filter((r): r is string => !!r);
};

/**
 * Todas las rutas de storage que usa una campaña: las de cada tarea, las de sus archivos de
 * referencia y las imágenes de la descripción.
 */
export const rutasDeProyecto = (p?: FactoryProject | null): string[] => {
  if (!p) return [];
  const urls = [
    ...(p.attachments ?? []).map((a) => a?.url),
    ...srcsDeHtml(p.description),
  ];
  return [
    ...urls.map(rutaDeUrl).filter((r): r is string => !!r),
    ...(p.fabricaBriefs ?? []).flatMap(rutasDeBrief),
  ];
};

/**
 * De una lista de rutas candidatas, las que **ya no usa nadie** en ninguna campaña.
 *
 * El chequeo contra todas las campañas no es paranoia: si alguien copia el contenido de un
 * entregable en otro (con su imagen incrustada), las dos tareas apuntan al mismo archivo y borrar
 * una dejaría la otra con la imagen rota. Ante la duda, no se borra.
 */
export const rutasHuerfanas = (candidatas: string[], proyectos: FactoryProject[]): string[] => {
  if (candidatas.length === 0) return [];
  const enUso = new Set(proyectos.flatMap(rutasDeProyecto));
  return [...new Set(candidatas)].filter((r) => !enUso.has(r));
};
