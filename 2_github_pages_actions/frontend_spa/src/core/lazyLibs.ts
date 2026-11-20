/**
 * Carregador Sob Demanda (Lazy Loading) de Bibliotecas Pesadas de Terceiros.
 * Elimina ~1 MB de MapLibre/Leaflet e libs de busca do carregamento inicial.
 */

const loadedScripts = new Map<string, Promise<void>>();
const loadedStyles = new Set<string>();

function loadCssOnce(href: string, integrity?: string): void {
  if (typeof document === 'undefined' || loadedStyles.has(href)) return;
  if (document.querySelector(`link[href="${href}"]`)) {
    loadedStyles.add(href);
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  if (integrity) {
    link.integrity = integrity;
    link.crossOrigin = '';
  }
  document.head.appendChild(link);
  loadedStyles.add(href);
}

function loadScriptOnce(src: string, integrity?: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  const existingPromise = loadedScripts.get(src);
  if (existingPromise) return existingPromise;

  if (document.querySelector(`script[src="${src}"]`)) {
    const resolved = Promise.resolve();
    loadedScripts.set(src, resolved);
    return resolved;
  }

  const p = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
    }
    script.onload = () => resolve();
    script.onerror = () => {
      loadedScripts.delete(src);
      reject(new Error(`Falha ao carregar biblioteca externa: ${src}`));
    };
    document.head.appendChild(script);
  });

  loadedScripts.set(src, p);
  return p;
}

let mapStackPromise: Promise<void> | null = null;

/**
 * Carrega Leaflet 1.9.4 + MapLibre GL 4.7.1 + Bridge exclusivamente para #escolas e #papiro-cadmo.
 */
export function loadMapStack(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).L && (window as any).maplibregl) {
    return Promise.resolve();
  }
  if (mapStackPromise) return mapStackPromise;

  loadCssOnce(
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
  );
  loadCssOnce('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css');

  mapStackPromise = Promise.all([
    loadScriptOnce(
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
      'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    ),
    loadScriptOnce('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js')
  ])
    .then(() =>
      loadScriptOnce('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.1.4/dist/leaflet-maplibre-gl.js')
    )
    .catch((err) => {
      mapStackPromise = null;
      throw err;
    });

  return mapStackPromise;
}

let searchStackPromise: Promise<void> | null = null;

/**
 * Carrega motor de descompressão, IndexedDB e indexação vetorial/texto apenas para #servidores e #busca.
 */
export function loadSearchEngineStack(): Promise<void> {
  if (searchStackPromise) return searchStackPromise;

  searchStackPromise = Promise.all([
    loadScriptOnce('https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/umd.js'),
    loadScriptOnce('https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js'),
    loadScriptOnce('https://cdn.jsdelivr.net/npm/minisearch@7.1.0/dist/umd/index.min.js'),
    loadScriptOnce('https://cdn.jsdelivr.net/npm/clusterize.js@1.0.0/clusterize.min.js'),
    loadScriptOnce('https://cdn.jsdelivr.net/npm/comlink@4.4.1/dist/umd/comlink.min.js')
  ])
    .then(() => undefined)
    .catch((err) => {
      searchStackPromise = null;
      throw err;
    });

  return searchStackPromise;
}
