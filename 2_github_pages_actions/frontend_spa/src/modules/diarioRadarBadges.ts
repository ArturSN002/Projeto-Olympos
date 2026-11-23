/**
 * Onda 3 — Badges de Radar Preditivo FEMURN para o módulo #diario-oficial.
 * Formata e injeta badges de `conteudo_ner` (`prazos_detectados`,
 * `servidores_citados`, `persona_destino`) nos cards/linhas do Diário Oficial
 * sem interferir nos filtros ou paginação existentes em `diarioOficial.js`.
 */

import '../styles/onda3.css';

export interface RadarPrazoItem {
  tipo?: string;
  texto?: string;
  valor?: string;
}

export interface RadarServidorCitadoItem {
  nome?: string;
  cargo?: string;
  matricula?: string;
  lotacao?: string;
  municipio?: string;
}

export interface RadarConteudoNer {
  prazos_detectados?: Array<RadarPrazoItem | string>;
  servidores_citados?: Array<RadarServidorCitadoItem | string>;
  servidores?: string[];
  persona_destino?: string;
  radar_severidade?: string;
  pss_editais_detectados?: Array<{ texto?: string } | string>;
}

export interface RadarMetaExtraida {
  prazos: string[];
  servidores: string[];
  personaSlug: string;
  personaLabel: string;
  severidade: string;
}

const PERSONA_LABELS: Record<string, string> = {
  nike: 'Niké (PSS/Editais)',
  temis: 'Têmis (Jurídico)',
  hera: 'Hera (RH/Permutas)',
  apolo: 'Apolo (Atos/Portarias)',
  demeter: 'Deméter (PNAE/Contratos)',
  helio: 'Hélio (FEMURN)'
};

let nerLookupByCodigo = new Map<string, RadarConteudoNer>();
let nerLookupByTitulo = new Map<string, RadarConteudoNer>();
let cacheLoadedAt = 0;
let tableObserver: MutationObserver | null = null;
let enrichingInProgress = false;

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (window.OlymposApp && typeof window.OlymposApp.escapeHtml === 'function') {
    return window.OlymposApp.escapeHtml(String(v));
  }
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizarTextoKey(raw: unknown): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function extrairRadarMeta(conteudoNer: unknown): RadarMetaExtraida {
  const ner = (conteudoNer && typeof conteudoNer === 'object' ? conteudoNer : {}) as RadarConteudoNer;

  const prazosRaw = Array.isArray(ner.prazos_detectados) ? ner.prazos_detectados : [];
  const prazos = prazosRaw
    .map((p) => {
      if (typeof p === 'string') return p.trim();
      if (p && typeof p === 'object') {
        return String(p.texto || (p.valor ? `${p.tipo || 'Prazo'}: ${p.valor}` : p.tipo || '')).trim();
      }
      return '';
    })
    .filter(Boolean);

  const srvRaw = Array.isArray(ner.servidores_citados)
    ? ner.servidores_citados
    : (Array.isArray(ner.servidores) ? ner.servidores : []);
  const servidores = srvRaw
    .map((s) => {
      if (typeof s === 'string') return s.trim();
      if (s && typeof s === 'object') {
        const nome = String(s.nome || '').trim();
        const mat = s.matricula ? ` (${String(s.matricula).trim()})` : '';
        return nome ? `${nome}${mat}` : '';
      }
      return '';
    })
    .filter(Boolean);

  const personaSlug = String(ner.persona_destino || '').trim().toLowerCase();
  const personaLabel = personaSlug
    ? (PERSONA_LABELS[personaSlug] || personaSlug.charAt(0).toUpperCase() + personaSlug.slice(1))
    : '';
  const severidade = String(ner.radar_severidade || '').trim().toUpperCase();

  return {
    prazos,
    servidores,
    personaSlug,
    personaLabel,
    severidade
  };
}

export function formatarBadgesRadarHtml(conteudoNer: unknown): string {
  const meta = extrairRadarMeta(conteudoNer);
  const badges: string[] = [];

  if (meta.personaLabel) {
    badges.push(
      `<span class="radar-badge radar-badge-persona" title="Persona roteada pelo Radar FEMURN">Persona: ${esc(meta.personaLabel)}</span>`
    );
  }

  if (meta.prazos.length > 0) {
    const primeiroPrazo = meta.prazos[0].length > 42 ? `${meta.prazos[0].slice(0, 40)}…` : meta.prazos[0];
    const extra = meta.prazos.length > 1 ? ` (+${meta.prazos.length - 1})` : '';
    const cls = meta.severidade === 'CRITICO' ? 'radar-badge-urgente' : 'radar-badge-prazo';
    badges.push(
      `<span class="radar-badge ${cls}" title="${esc(meta.prazos.join(' | '))}">Prazo: ${esc(primeiroPrazo)}${esc(extra)}</span>`
    );
  }

  if (meta.servidores.length > 0) {
    const resumoSrv =
      meta.servidores.length <= 2
        ? meta.servidores.join(', ')
        : `${meta.servidores[0]} (+${meta.servidores.length - 1})`;
    badges.push(
      `<span class="radar-badge radar-badge-servidor" title="${esc(meta.servidores.join(', '))}">SMEB: ${esc(resumoSrv)}</span>`
    );
  }

  if (badges.length === 0) return '';
  return `<div class="radar-badges-row" data-radar-enriched="1">${badges.join('')}</div>`;
}

async function ensureNerCache(force = false): Promise<void> {
  const now = Date.now();
  if (!force && cacheLoadedAt > 0 && now - cacheLoadedAt < 60000 && (nerLookupByCodigo.size > 0 || nerLookupByTitulo.size > 0)) {
    return;
  }

  const client = window.OlymposSupabase?.getClient?.();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('publicacoes_diario')
      .select('codigo_femurn,titulo,conteudo_ner')
      .order('data_publicacao', { ascending: false })
      .limit(500);

    if (error || !Array.isArray(data)) return;

    const nextByCode = new Map<string, RadarConteudoNer>();
    const nextByTitle = new Map<string, RadarConteudoNer>();

    for (const row of data) {
      if (!row || !row.conteudo_ner || typeof row.conteudo_ner !== 'object') continue;
      const ner = row.conteudo_ner as RadarConteudoNer;
      if (row.codigo_femurn) {
        nextByCode.set(normalizarTextoKey(row.codigo_femurn), ner);
      }
      if (row.titulo) {
        nextByTitle.set(normalizarTextoKey(row.titulo), ner);
      }
    }

    nerLookupByCodigo = nextByCode;
    nerLookupByTitulo = nextByTitle;
    cacheLoadedAt = Date.now();
  } catch {
    // Falha não-bloqueante: mantém interface funcional sem quebrar tabela do Diário Oficial
  }
}

function findNerForElement(el: HTMLElement): RadarConteudoNer | null {
  const rawAttr = el.getAttribute('data-radar-ner');
  if (rawAttr) {
    try {
      const parsed = JSON.parse(rawAttr);
      if (parsed && typeof parsed === 'object') return parsed as RadarConteudoNer;
    } catch {
      // ignora json inválido
    }
  }

  const codeAttr = el.getAttribute('data-codigo-femurn');
  if (codeAttr) {
    const hit = nerLookupByCodigo.get(normalizarTextoKey(codeAttr));
    if (hit) return hit;
  }

  const text = normalizarTextoKey(el.textContent || '');
  const codMatch = text.match(/cod\.\s*([a-z0-9_-]+)/i);
  if (codMatch && codMatch[1]) {
    const hit = nerLookupByCodigo.get(normalizarTextoKey(codMatch[1]));
    if (hit) return hit;
  }

  const titleCell = el.querySelector<HTMLElement>('td[data-label="Ato Oficial"] > div:first-child, .diario-card-title');
  if (titleCell) {
    const hit = nerLookupByTitulo.get(normalizarTextoKey(titleCell.textContent || ''));
    if (hit) return hit;
  }

  return null;
}

function applyBadgesToDom(container: ParentNode): void {
  const rows = container.querySelectorAll<HTMLElement>('#prometheusTableBody tr, [data-radar-ner], .diario-card');
  rows.forEach((row) => {
    // Ignora linhas de loading/empty state
    if (row.querySelector('.empty-state-card')) return;
    if (row.querySelector('[data-radar-enriched="1"]')) return;

    const ner = findNerForElement(row);
    if (!ner) return;

    const html = formatarBadgesRadarHtml(ner);
    if (!html) return;

    const targetCell = row.querySelector<HTMLElement>('td[data-label="Ato Oficial"], .diario-card-body') || row;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    if (wrapper.firstElementChild) {
      targetCell.appendChild(wrapper.firstElementChild);
    }
  });
}

function ensureTableObserver(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const tbody = document.getElementById('prometheusTableBody');
  if (!tbody || tableObserver) return;

  tableObserver = new MutationObserver(() => {
    if (enrichingInProgress) return;
    enrichingInProgress = true;
    try {
      applyBadgesToDom(document);
    } finally {
      enrichingInProgress = false;
    }
  });
  tableObserver.observe(tbody, { childList: true });
}

export async function enriquecerCardsDiarioComRadar(container?: ParentNode | null): Promise<void> {
  if (typeof document === 'undefined') return;
  const root = container || document.getElementById('page-diario-oficial') || document;
  await ensureNerCache();
  enrichingInProgress = true;
  try {
    applyBadgesToDom(root);
    ensureTableObserver();
  } finally {
    enrichingInProgress = false;
  }
}

if (typeof window !== 'undefined') {
  (window as any).OlymposDiarioRadar = {
    enriquecerCardsDiarioComRadar,
    formatarBadgesRadarHtml,
    extrairRadarMeta
  };
}
