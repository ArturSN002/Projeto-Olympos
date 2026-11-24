/**
 * Onda 4 (Sprint 4.2): Módulo Lazy do Oráculo Vetorial Olympos ($0 — Alucinação Zero).
 * Consome Edge Function `oraculo-busca` (`gemini-embedding-2` + RRF `pgvector`)
 * com fallback resiliente para RPC `match_olympos_knowledge` / FTS em `publicacoes_diario`.
 */

import '../styles/onda4.css';
import '../styles/onda8.css';
import oraculoHtml from '../templates/pages/oraculo.html?raw';

export const routeId = 'oraculo';
export const htmlTemplate = oraculoHtml;

export interface OraculoEvidenceItem {
  id?: string;
  fonte_tipo: string;
  fonte_id: string;
  chunk_index?: number;
  titulo: string;
  url_fonte?: string | null;
  persona_tag?: string | null;
  chunk_texto: string;
  rbac_min_role?: string;
  similarity?: number;
  rrf_score?: number;
}

export interface OraculoRoutedPersona {
  slug: string;
  nome: string;
  arquivo_memoria: string;
  rota_sugerida: string;
  descricao: string;
  aderencia: number;
}

let activeFonteFiltro = '';
let isSearching = false;

export function escHtml(val: unknown): string {
  if (val === null || val === undefined) return '';
  const app = typeof window !== 'undefined' ? (window as any).OlymposApp : null;
  if (app && typeof app.escapeHtml === 'function') {
    return app.escapeHtml(String(val));
  }
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizarUrlOraculo(raw: unknown): string {
  const u = String(raw || '').trim();
  if (!u) return '';
  if (u.startsWith('#')) return u;
  if (/^https?:\/\/\S+/i.test(u)) return u;
  return '';
}

export function formatSimilarityPct(sim: unknown): string {
  const num = Number(sim);
  if (!Number.isFinite(num) || num <= 0) return 'Match Textual';
  const bounded = Math.max(0, Math.min(1, num));
  return `${Math.round(bounded * 100)}% relevância`;
}

export function buildHighlightedSnippet(texto: string, query: string): string {
  const safeText = escHtml(texto || '');
  const tokens = String(query || '')
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter((t) => t.length >= 3)
    .slice(0, 6);

  if (!tokens.length) return safeText;
  const pattern = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const re = new RegExp(`(${pattern})`, 'gi');
  return safeText.replace(re, '<mark>$1</mark>');
}

export function renderPersonaCardHtml(persona: OraculoRoutedPersona | null | undefined): string {
  if (!persona) return '';
  const pct = Math.round(Math.max(0, Math.min(1, Number(persona.aderencia) || 0.7)) * 100);
  const rotaSafe = escHtml(sanitizarUrlOraculo(persona.rota_sugerida || '#configuracoes') || '#configuracoes');
  return (
    '<div class="surface-card oraculo-persona-card">' +
      '<div>' +
        `<span class="section-eyebrow">PERSONA ESPECIALISTA ROTEADA • ${pct}% DE ADERÊNCIA</span>` +
        `<h3 style="margin: 4px 0 4px;">${escHtml(persona.nome)} — ${escHtml(persona.arquivo_memoria)}</h3>` +
        `<p class="section-desc" style="margin: 0;">${escHtml(persona.descricao)}</p>` +
      '</div>' +
      '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
        `<a href="${rotaSafe}" class="btn btn-secondary btn-sm">Abrir Módulo Relacionado ↗</a>` +
      '</div>' +
    '</div>'
  );
}

function getSupabaseEndpointAndKey(): { url: string; anonKey: string; jwt: string } {
  const supa = (window as any).OlymposSupabase;
  const cfg = supa && typeof supa.getConfig === 'function' ? supa.getConfig() : null;
  const url = String(cfg?.url || 'https://rbwizevjvbvjwtbwwyif.supabase.co').replace(/\/+$/, '');
  const anonKey = String(cfg?.anonKey || '');
  const appSess = (window as any).OlymposApp?.getSession?.();
  const jwt = String(appSess?.access_token || appSess?.token || '');
  return { url, anonKey, jwt };
}

async function executarFallbackLocalSupabase(query: string): Promise<{
  evidencias: OraculoEvidenceItem[];
  modoBusca: string;
  fallbackMotivo: string;
}> {
  const supa = (window as any).OlymposSupabase;
  const client = supa && typeof supa.getClient === 'function' ? supa.getClient() : null;
  if (!client) {
    return {
      evidencias: [],
      modoBusca: 'OFFLINE',
      fallbackMotivo: 'Cliente Supabase indisponível no navegador.'
    };
  }

  try {
    const sess = await supa.getSession?.();
    if (sess) {
      const { data: rpcRows, error: rpcErr } = await client.rpc('match_olympos_knowledge', {
        query_embedding: null,
        query_text: query,
        match_threshold: 0.4,
        match_count: 8,
        filtro_fonte: activeFonteFiltro || null
      });
      if (!rpcErr && Array.isArray(rpcRows)) {
        return {
          evidencias: rpcRows,
          modoBusca: 'FTS_FALLBACK',
          fallbackMotivo: 'Busca textual direta via RPC PostgreSQL.'
        };
      }
    }

    const safeTerm = query.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (safeTerm) {
      const { data: diarioRows } = await client
        .from('publicacoes_diario')
        .select('id, codigo_femurn, data_publicacao, titulo, ato_tipo, resumo, texto_completo')
        .or(`titulo.ilike.%${safeTerm}%,texto_completo.ilike.%${safeTerm}%`)
        .order('data_publicacao', { ascending: false })
        .limit(8);
      if (Array.isArray(diarioRows)) {
        return {
          evidencias: diarioRows.map((d: any) => ({
            id: String(d.id || d.codigo_femurn || ''),
            fonte_tipo: 'FEMURN',
            fonte_id: String(d.codigo_femurn || d.id || ''),
            titulo: String(d.titulo || 'Publicação FEMURN'),
            url_fonte: '#diario-oficial',
            persona_tag: 'nike',
            chunk_texto: String(d.resumo || d.texto_completo || d.titulo || '').slice(0, 900),
            similarity: 0.6
          })),
          modoBusca: 'FTS_DIARIO_PUBLICO',
          fallbackMotivo: 'Fallback público direto na tabela publicacoes_diario.'
        };
      }
    }
  } catch (err) {
    console.warn('[Oraculo] Fallback local falhou:', err);
  }

  return {
    evidencias: [],
    modoBusca: 'FTS_FALLBACK',
    fallbackMotivo: 'Nenhum trecho localizado para a consulta.'
  };
}

function renderEvidencesList(evidences: OraculoEvidenceItem[], query: string): void {
  const container = document.getElementById('oraculoResultsContainer');
  if (!container) return;

  if (!Array.isArray(evidences) || evidences.length === 0) {
    container.innerHTML =
      '<div class="surface-card" style="padding: 24px; text-align: center;">' +
        '<h4 style="margin: 0 0 6px;">Nenhuma evidência literal encontrada</h4>' +
        '<p class="section-desc" style="margin: 0;">Tente termos mais amplos ou remova o filtro de fonte selecionado.</p>' +
      '</div>';
    return;
  }

  const labelFonte: Record<string, string> = {
    FEMURN: 'FEMURN',
    MEMORIA_DOC: 'Memória Docs',
    PORTARIA: 'Portaria',
    OFICIO: 'Ofício',
    NORMA_MUNICIPAL: 'Norma Municipal',
    MODELO_SNIPPET: 'Minuta'
  };

  container.innerHTML = evidences
    .map((ev) => {
      const fonteLbl = labelFonte[ev.fonte_tipo] || ev.fonte_tipo || 'Documento';
      const urlSegura = sanitizarUrlOraculo(ev.url_fonte);
      const isExternal = /^https?:\/\//i.test(urlSegura);
      const linkHtml = urlSegura
        ? `<a href="${escHtml(urlSegura)}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} class="folder-chip">Abrir Fonte (${escHtml(ev.fonte_id)}) ↗</a>`
        : `<span class="folder-chip">${escHtml(ev.fonte_id)}</span>`;

      return (
        '<article class="surface-card oraculo-evidence-card">' +
          '<div class="oraculo-evidence-head">' +
            '<div>' +
              `<span class="pill-badge pill-blue" style="font-size: 0.7rem;">${escHtml(fonteLbl)}</span>` +
              (ev.persona_tag ? ` <span class="pill-badge pill-gold" style="font-size: 0.7rem;">@${escHtml(ev.persona_tag)}</span>` : '') +
              `<h4 style="margin: 6px 0 0; font-size: 1rem;">${escHtml(ev.titulo)}</h4>` +
            '</div>' +
            `<span class="pill-badge pill-green" style="font-size: 0.72rem;">${escHtml(formatSimilarityPct(ev.similarity))}</span>` +
          '</div>' +
          `<p class="oraculo-evidence-snippet">${buildHighlightedSnippet(ev.chunk_texto, query)}</p>` +
          '<div class="oraculo-evidence-foot">' +
            `<span>Fonte: <code>${escHtml(ev.fonte_id)}</code></span>` +
            linkHtml +
          '</div>' +
        '</article>'
      );
    })
    .join('');
}

export function renderSynthesisCard(genMode: any): void {
  const box = document.getElementById('oraculoSynthesisContainer');
  if (!box) return;

  if (!genMode) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  if (genMode.enabled && genMode.answerText) {
    const modelStr = String(genMode.model || '');
    const modelLabel = modelStr.includes('gemma') ? 'Gemma 4 31B' : 'Gemini 3.5 Flash Lite';
    const quotaHtml = typeof genMode.quotaRemaining === 'number'
      ? `<span class="pill-badge pill-gold" style="font-size:0.7rem;">Cota restante hoje: ${genMode.quotaRemaining}</span>`
      : '';
    const citations: any[] = Array.isArray(genMode.citations) ? genMode.citations : [];
    const citHtml = citations
      .map((c) => {
        const safeUrl = sanitizarUrlOraculo(c.url_fonte);
        const tag = `[${Number(c.indice || 0)}] ${escHtml(c.titulo || c.fonte_id || '')}`;
        return safeUrl
          ? `<a href="${escHtml(safeUrl)}" ${/^https?:\/\//i.test(safeUrl) ? 'target="_blank" rel="noopener noreferrer"' : ''} class="folder-chip" style="font-size:0.74rem;">${tag} ↗</a>`
          : `<span class="folder-chip" style="font-size:0.74rem;">${tag}</span>`;
      })
      .join('');

    box.innerHTML =
      '<div class="surface-card oraculo-synthesis-card">' +
        '<div class="oraculo-synthesis-head">' +
          '<div>' +
            '<span class="section-eyebrow">SÍNTESE EXECUTIVA OLYMPOS • ALUCINAÇÃO ZERO</span>' +
            '<h3 style="margin:2px 0 0; font-size:1.05rem;">Resposta Fundamentada nas Fontes Oficiais</h3>' +
          '</div>' +
          '<div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">' +
            `<span class="pill-badge pill-purple" style="font-size:0.72rem;">${escHtml(modelLabel)}</span>` +
            quotaHtml +
            '<button type="button" id="btnCopiarSinteseOraculo" class="btn btn-secondary btn-sm">Copiar Síntese</button>' +
          '</div>' +
        '</div>' +
        `<div class="oraculo-synthesis-body">${escHtml(genMode.answerText)}</div>` +
        (citHtml ? `<div class="oraculo-citations-row">${citHtml}</div>` : '') +
      '</div>';
    box.classList.remove('hidden');

    const btnCopy = document.getElementById('btnCopiarSinteseOraculo');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const citText = citations
          .map((c) => `[${c.indice}] ${c.titulo} (${c.fonte_id})`)
          .join('\n');
        const full = `${genMode.answerText}\n\nFontes:\n${citText}`.trim();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(full).catch(() => {});
        }
        (window as any).OlymposApp?.showToast?.('Síntese copiada com citações!');
      });
    }
    return;
  }

  const st = String(genMode.status || 'INCUBATED').toUpperCase();
  if (st === 'QUOTA_FALLBACK' || st === 'PII_BLOCKED' || st === 'DISABLED') {
    box.innerHTML =
      '<div class="output-panel output-warning" style="font-size:0.84rem;">' +
        `<strong>Modo Literal Ativo (${escHtml(st)}):</strong> ${escHtml(genMode.motivo || 'Exibindo evidências literais oficiais.')}` +
      '</div>';
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
    box.innerHTML = '';
  }
}

async function executarBuscaOraculo(query: string): Promise<void> {
  if (isSearching) return;
  const clean = String(query || '').trim();
  if (!clean) return;

  const btn = document.getElementById('oraculoSubmitBtn') as HTMLButtonElement | null;
  const modeBadge = document.getElementById('oraculoModeBadge');
  const piiAlert = document.getElementById('oraculoPiiAlert');
  const personaBox = document.getElementById('oraculoPersonaContainer');
  const synthBox = document.getElementById('oraculoSynthesisContainer');
  const resultsEl = document.getElementById('oraculoResultsContainer');

  isSearching = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Buscando...';
  }
  if (synthBox) {
    synthBox.classList.add('hidden');
    synthBox.innerHTML = '';
  }
  if (resultsEl) {
    resultsEl.innerHTML = '<div class="surface-card" style="padding: 24px; text-align: center;">Consultando base institucional ($0)...</div>';
  }
  if (piiAlert) {
    piiAlert.classList.add('hidden');
    piiAlert.textContent = '';
  }

  try {
    const { url, anonKey, jwt } = getSupabaseEndpointAndKey();
    const authToken = jwt || anonKey;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (anonKey) headers['apikey'] = anonKey;
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const resp = await fetch(`${url}/functions/v1/oraculo-busca`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: clean,
        filtroFonte: activeFonteFiltro || null,
        matchCount: 8
      })
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    if (!data || data.ok === false) {
      throw new Error(data?.mensagem || 'Erro no Oráculo');
    }

    if (modeBadge) {
      const modo = String(data.modoBusca || 'FTS_FALLBACK');
      modeBadge.textContent = modo === 'HIBRIDO_RRF_VETORIAL'
        ? `Híbrido pgvector (${data.modelUsed || 'gemini-embedding-2'})`
        : 'Fallback FTS Postgres ($0)';
    }

    if (piiAlert && data.piiBlocked) {
      piiAlert.textContent =
        data.fallbackMotivo ||
        'Gate Zero-PII ativado: dados pessoais/sigilosos foram removidos antes da consulta.';
      piiAlert.classList.remove('hidden');
    }

    if (personaBox) {
      if (data.personaRoteada) {
        personaBox.innerHTML = renderPersonaCardHtml(data.personaRoteada);
        personaBox.classList.remove('hidden');
      } else {
        personaBox.classList.add('hidden');
        personaBox.innerHTML = '';
      }
    }

    renderSynthesisCard(data.generativeMode);
    renderEvidencesList(data.evidencias || [], data.query || clean);
  } catch (err) {
    console.warn('[Oraculo] Edge Function indisponível, executando fallback local:', err);
    const fb = await executarFallbackLocalSupabase(clean);
    if (modeBadge) modeBadge.textContent = 'Fallback FTS Local ($0)';
    if (personaBox) personaBox.classList.add('hidden');
    renderSynthesisCard(null);
    renderEvidencesList(fb.evidencias, clean);
  } finally {
    isSearching = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Consultar Oráculo';
    }
  }
}

function bindOraculoEvents(): void {
  const form = document.getElementById('oraculoSearchForm') as any;
  const input = document.getElementById('oraculoQueryInput') as HTMLInputElement | null;
  if (form && !form._boundOraculo) {
    form._boundOraculo = true;
    form.addEventListener('submit', (ev: Event) => {
      ev.preventDefault();
      if (input && input.value.trim()) {
        void executarBuscaOraculo(input.value.trim());
      }
    });
  }

  const filterRow = document.getElementById('oraculoFonteFilters') as any;
  if (filterRow && !filterRow._boundOraculo) {
    filterRow._boundOraculo = true;
    filterRow.addEventListener('click', (ev: Event) => {
      const raw = ev.target as Element | null;
      const btn = raw && typeof raw.closest === 'function' ? raw.closest('[data-oraculo-fonte]') : null;
      if (!btn) return;
      activeFonteFiltro = btn.getAttribute('data-oraculo-fonte') || '';
      filterRow.querySelectorAll('[data-oraculo-fonte]').forEach((el: Element) => {
        el.classList.toggle('active', el === btn);
      });
      if (input && input.value.trim()) {
        void executarBuscaOraculo(input.value.trim());
      }
    });
  }
}

export async function mount(): Promise<void> {
  bindOraculoEvents();
}

export const OlymposOraculo = {
  mount,
  executarBuscaOraculo,
  buildHighlightedSnippet,
  formatSimilarityPct,
  renderPersonaCardHtml
};

if (typeof window !== 'undefined') {
  window.OlymposOraculo = OlymposOraculo;
  window.OlymposViews = window.OlymposViews || {};
  window.OlymposViews.oraculo = {
    init: () => {
      bindOraculoEvents();
    },
    pesquisar: (termo: string) => {
      const input = document.getElementById('oraculoQueryInput') as HTMLInputElement | null;
      if (input) input.value = termo;
      void executarBuscaOraculo(termo);
    }
  };
}
