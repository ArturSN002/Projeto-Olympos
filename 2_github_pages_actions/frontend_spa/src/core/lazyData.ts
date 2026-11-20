/**
 * Carregador Sob Demanda (Lazy Data) para catálogos JSON estáticos.
 * Substitui wrappers .js síncronos pesados (permutasVigentesData.js, escolasCearaMirim.js).
 */

let escolasSeedPromise: Promise<any[]> | null = null;
let permutasDataPromise: Promise<any> | null = null;

async function fetchJsonWithPerfCache(cacheKey: string, url: string): Promise<any> {
  const perf = (window as any).OlymposPerfEngine;
  if (perf && typeof perf.getCache === 'function') {
    try {
      const cached = await perf.getCache(cacheKey);
      if (cached) return cached;
    } catch {
      // ignora erro de cache local
    }
  }

  const resp = await fetch(url, { cache: 'default' });
  if (!resp.ok) {
    throw new Error(`Falha ao carregar ${url}: HTTP ${resp.status}`);
  }
  const data = await resp.json();

  if (perf && typeof perf.setCache === 'function') {
    try {
      await perf.setCache(cacheKey, data, 1000 * 60 * 60 * 12);
    } catch {
      // ignora erro de persistência
    }
  }
  return data;
}

export function ensureEscolasSeedData(): Promise<any[]> {
  const win = window as any;
  if (Array.isArray(win.BANCO_SEMENTE_ESCOLAS) && win.BANCO_SEMENTE_ESCOLAS.length > 0) {
    return Promise.resolve(win.BANCO_SEMENTE_ESCOLAS);
  }
  if (escolasSeedPromise) return escolasSeedPromise;

  escolasSeedPromise = fetchJsonWithPerfCache('olympos_escolas_seed_v1', './data/escolas_ceara_mirim.json')
    .then((data) => {
      const list = Array.isArray(data) ? data : [];
      win.BANCO_SEMENTE_ESCOLAS = list;
      return list;
    })
    .catch((err) => {
      escolasSeedPromise = null;
      console.warn('[LazyData] Falha ao carregar escolas_ceara_mirim.json:', err);
      return [];
    });

  return escolasSeedPromise;
}

export function ensurePermutasData(): Promise<any> {
  const win = window as any;
  if (win.OLYMPOS_PERMUTAS_VIGENTES && Array.isArray(win.OLYMPOS_PERMUTAS_VIGENTES.servidores)) {
    return Promise.resolve(win.OLYMPOS_PERMUTAS_VIGENTES);
  }
  if (permutasDataPromise) return permutasDataPromise;

  permutasDataPromise = fetchJsonWithPerfCache('olympos_permutas_vigentes_v1', './data/permutas_vigentes.json')
    .then((data) => {
      if (data) {
        win.DADOS_PERMUTAS_VIGENTES = data;
        win.OLYMPOS_PERMUTAS_VIGENTES = data;
      }
      return data;
    })
    .catch((err) => {
      permutasDataPromise = null;
      console.warn('[LazyData] Falha ao carregar permutas_vigentes.json:', err);
      return null;
    });

  return permutasDataPromise;
}
