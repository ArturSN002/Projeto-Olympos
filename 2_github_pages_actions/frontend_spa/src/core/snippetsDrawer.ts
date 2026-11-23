/**
 * Onda 2: Biblioteca Lateral de Modelos e Snippets Institucionais (.modal-backdrop).
 * Consulta public.modelos_snippets, interpola placeholders {{escola.*}} / {{servidor.*}} / {{data_extenso}}
 * com estrita conformidade LGPD (6 campos públicos) e proteção XSS, além de CRUD para roles autorizadas.
 */

import '../styles/onda2.css';
import { ensureEscolasSeedData } from './lazyData';

export type SnippetCategoria =
  | 'OFICIO'
  | 'DESPACHO_JURIDICO'
  | 'CIRCULAR_ESCOLAS'
  | 'PERMUTA'
  | 'PORTARIA'
  | 'RESPOSTA_PENDENCIA';

export interface SnippetModel {
  id: string;
  titulo: string;
  categoria: SnippetCategoria | string;
  persona_tag?: string | null;
  conteudo_json?: Record<string, any> | null;
  conteudo_texto: string;
  variaveis_suportadas?: string[];
  roles_permitidos?: string[];
  criado_por?: string | null;
  atualizado_em?: string;
}

export interface EscolaSnippetContext {
  id?: string;
  nome: string;
  inep?: string;
  diretor?: string;
}

export interface ServidorSnippetContext {
  nome: string;
  cargo: string;
  matricula: string;
  lotacao: string;
  municipio: string;
  referencia?: string;
}

export interface SnippetInterpolationContext {
  escola?: EscolaSnippetContext | null;
  servidor?: ServidorSnippetContext | null;
  dataExtenso?: string;
  manterNaoPreenchidos?: boolean;
}

export interface SnippetInsertResult {
  snippet: SnippetModel;
  textoInterpolado: string;
  htmlInterpolado: string;
  conteudoJsonInterpolado: Record<string, any> | null;
  escola: EscolaSnippetContext | null;
  servidor: ServidorSnippetContext | null;
}

export interface OpenSnippetsDrawerOptions {
  onInsert?: (result: SnippetInsertResult) => void;
  allowCrud?: boolean;
  categoriaInicial?: string;
}

const CATEGORIAS_SNIPPETS: Array<{ value: SnippetCategoria; label: string }> = [
  { value: 'OFICIO', label: 'Ofício' },
  { value: 'DESPACHO_JURIDICO', label: 'Despacho Jurídico' },
  { value: 'CIRCULAR_ESCOLAS', label: 'Circular Escolas' },
  { value: 'PERMUTA', label: 'Permuta' },
  { value: 'PORTARIA', label: 'Portaria' },
  { value: 'RESPOSTA_PENDENCIA', label: 'Resposta Pendência' }
];

const CRUD_ROLES = new Set(['MODERADOR', 'ADMIN_GABINETE', 'JURIDICO']);

let snippetsCache: SnippetModel[] = [];
let escolasCache: EscolaSnippetContext[] = [];
let servidoresPublicosCache: ServidorSnippetContext[] | null = null;
let servidoresLoadPromise: Promise<ServidorSnippetContext[]> | null = null;

let activeOptions: OpenSnippetsDrawerOptions = {};
let selectedSnippetId: string = '';
let selectedCategoriaFiltro: string = 'TODAS';
let searchTerm: string = '';
let selectedEscolaIdx: string = '';
let selectedServidorIdx: string = '';
let filteredServidores: ServidorSnippetContext[] = [];
let activeTab: 'biblioteca' | 'crud' = 'biblioteca';
let editingSnippetId: string | null = null;

function esc(val: unknown): string {
  if (val === null || val === undefined) return '';
  const app = (window as any).OlymposApp;
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

function getSupabaseClient(): any {
  const supa = (window as any).OlymposSupabase;
  if (!supa) return null;
  return typeof supa.getClient === 'function' ? supa.getClient() : supa.client || null;
}

function getCurrentRole(): string {
  const app = (window as any).OlymposApp;
  if (app && typeof app.obterRoleIdSessao === 'function') {
    return String(app.obterRoleIdSessao() || 'VISITANTE').toUpperCase();
  }
  const sess = app?.getSession?.();
  return String(sess?.perfil?.id || sess?.role || 'VISITANTE').toUpperCase();
}

export function podeGerenciarSnippets(): boolean {
  return CRUD_ROLES.has(getCurrentRole());
}

function formatarDataExtensoPtBr(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  } catch {
    return date.toLocaleDateString('pt-BR');
  }
}

function normSearch(val: string): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Interpola os 9 placeholders institucionais sem executar scripts ou quebrar textos.
 */
export function interpolarTemplateSnippet(
  template: string,
  contexto: SnippetInterpolationContext = {}
): string {
  const raw = String(template ?? '');
  const manter = contexto.manterNaoPreenchidos !== false;
  const escola = contexto.escola || null;
  const servidor = contexto.servidor || null;
  const dataExtenso = contexto.dataExtenso || formatarDataExtensoPtBr();

  const replacements: Record<string, string | undefined> = {
    'escola.nome': escola ? escola.nome || '' : undefined,
    'escola.inep': escola ? escola.inep || '' : undefined,
    'escola.diretor': escola ? escola.diretor || '' : undefined,
    'servidor.nome': servidor ? servidor.nome || '' : undefined,
    'servidor.cargo': servidor ? servidor.cargo || '' : undefined,
    'servidor.matricula': servidor ? servidor.matricula || '' : undefined,
    'servidor.lotacao': servidor ? servidor.lotacao || '' : undefined,
    'servidor.municipio': servidor ? servidor.municipio || '' : undefined,
    data_extenso: dataExtenso
  };

  return raw.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key: string) => {
    const val = replacements[key];
    if (val === undefined) {
      return manter ? match : '';
    }
    return String(val);
  });
}

export function interpolarJsonProseMirror(
  json: Record<string, any> | null | undefined,
  contexto: SnippetInterpolationContext = {}
): Record<string, any> | null {
  if (!json || typeof json !== 'object') return null;
  const cloneNode = (node: any): any => {
    if (Array.isArray(node)) {
      return node.map(cloneNode);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === 'text' && typeof v === 'string') {
          out[k] = interpolarTemplateSnippet(v, contexto);
        } else {
          out[k] = cloneNode(v);
        }
      }
      return out;
    }
    return node;
  };
  return cloneNode(json);
}

function extrairVariaveisTemplate(texto: string): string[] {
  const found = new Set<string>();
  const matches = String(texto || '').matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g);
  for (const m of matches) {
    if (m[1]) found.add(`{{${m[1]}}}`);
  }
  return Array.from(found);
}

async function carregarEscolasContexto(): Promise<void> {
  const mapByNome = new Map<string, EscolaSnippetContext>();

  try {
    const seed = await ensureEscolasSeedData();
    if (Array.isArray(seed)) {
      for (const item of seed) {
        const nome = String(item?.nome || '').trim();
        if (!nome) continue;
        mapByNome.set(nome.toLowerCase(), {
          id: item.id ? String(item.id) : undefined,
          nome,
          inep: String(item.inep || ''),
          diretor: String(item.diretor || '')
        });
      }
    }
  } catch {
    // fallback silencioso
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('escolas')
        .select('id, nome, inep, diretor')
        .order('nome', { ascending: true })
        .limit(200);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const nome = String(row?.nome || '').trim();
          if (!nome) continue;
          mapByNome.set(nome.toLowerCase(), {
            id: row.id ? String(row.id) : undefined,
            nome,
            inep: String(row.inep || ''),
            diretor: String(row.diretor || '')
          });
        }
      }
    } catch {
      // mantém cache seed
    }
  }

  escolasCache = Array.from(mapByNome.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR')
  );
}

/**
 * Carrega servidores mantendo estritamente os 6 campos públicos LGPD (n, g, m, l, e, r).
 */
async function carregarBaseServidoresPublicos(): Promise<ServidorSnippetContext[]> {
  if (servidoresPublicosCache) return servidoresPublicosCache;
  if (servidoresLoadPromise) return servidoresLoadPromise;

  servidoresLoadPromise = (async () => {
    const lista: ServidorSnippetContext[] = [];
    const seen = new Set<string>();

    const pushItem = (raw: any) => {
      const nome = String(raw?.n || raw?.nome || '').trim();
      if (!nome) return;
      const matricula = String(raw?.m || raw?.matricula || '').trim();
      const cargo = String(raw?.g || raw?.cargo || '').trim();
      const lotacao = String(raw?.l || raw?.lotacao || '').trim();
      const municipio = String(raw?.e || raw?.municipio || raw?.ente || 'Ceará-Mirim').trim();
      const referencia = String(raw?.r || raw?.mes_referencia || '').trim();
      const key = `${nome.toLowerCase()}|${matricula}`;
      if (seen.has(key)) return;
      seen.add(key);
      lista.push({ nome, cargo, matricula, lotacao, municipio, referencia });
    };

    try {
      const resp = await fetch('./data/servidores_consolidados.json', { cache: 'default' });
      if (resp.ok) {
        const json = await resp.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            pushItem(item);
          }
        }
      }
    } catch {
      // tenta fallback carregado em memória se disponível
      const srvGlobal = (window as any).OlymposServidores;
      if (srvGlobal && typeof srvGlobal.obterTodos === 'function') {
        const arr = srvGlobal.obterTodos();
        if (Array.isArray(arr)) {
          for (const item of arr) pushItem(item);
        }
      }
    }

    servidoresPublicosCache = lista;
    return lista;
  })();

  return servidoresLoadPromise;
}

export async function buscarServidoresPublicosLgpd(termo: string): Promise<ServidorSnippetContext[]> {
  const q = normSearch(termo);
  const resultados: ServidorSnippetContext[] = [];
  const seen = new Set<string>();

  const add = (item: ServidorSnippetContext) => {
    const key = `${item.nome.toLowerCase()}|${item.matricula}`;
    if (seen.has(key)) return;
    seen.add(key);
    resultados.push(item);
  };

  // 1. Consulta opcional na view/tabela pública LGPD no Supabase (6 campos)
  const client = getSupabaseClient();
  if (client && q.length >= 2) {
    try {
      const cleanQ = termo.replace(/[%_,()]/g, ' ').trim();
      const { data, error } = await client
        .from('servidores_pedagogico_view')
        .select('nome, cargo, lotacao')
        .ilike('nome', `%${cleanQ}%`)
        .limit(15);
      if (!error && Array.isArray(data)) {
        for (const r of data) {
          add({
            nome: String(r.nome || ''),
            cargo: String(r.cargo || ''),
            matricula: '',
            lotacao: String(r.lotacao || ''),
            municipio: 'Ceará-Mirim'
          });
        }
      }
    } catch {
      // ignora caso view não esteja acessível para o papel atual
    }
  }

  // 2. Base JSON pública consolidada (6 campos LGPD)
  const base = await carregarBaseServidoresPublicos();
  for (const s of base) {
    if (!q) {
      if (normSearch(s.municipio).includes('ceara-mirim')) {
        add(s);
      }
    } else {
      const hay = normSearch(`${s.nome} ${s.matricula} ${s.lotacao} ${s.cargo} ${s.municipio}`);
      if (hay.includes(q)) add(s);
    }
    if (resultados.length >= 40) break;
  }

  return resultados.slice(0, 40);
}

async function carregarModelosSnippets(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('modelos_snippets')
      .select('id, titulo, categoria, persona_tag, conteudo_json, conteudo_texto, variaveis_suportadas, roles_permitidos, criado_por, atualizado_em')
      .order('titulo', { ascending: true });
    if (!error && Array.isArray(data)) {
      snippetsCache = data as SnippetModel[];
    }
  } catch (err) {
    console.warn('[SnippetsDrawer] Falha ao consultar modelos_snippets:', err);
  }
}

function getContextoSelecionado(): { escola: EscolaSnippetContext | null; servidor: ServidorSnippetContext | null } {
  const escolaIdx = selectedEscolaIdx !== '' ? parseInt(selectedEscolaIdx, 10) : -1;
  const servIdx = selectedServidorIdx !== '' ? parseInt(selectedServidorIdx, 10) : -1;
  return {
    escola: !isNaN(escolaIdx) && escolasCache[escolaIdx] ? escolasCache[escolaIdx] : null,
    servidor: !isNaN(servIdx) && filteredServidores[servIdx] ? filteredServidores[servIdx] : null
  };
}

function getSnippetSelecionado(): SnippetModel | null {
  return snippetsCache.find((s) => String(s.id) === String(selectedSnippetId)) || null;
}

function renderEscolasSelect(): void {
  const sel = document.getElementById('snippetsEscolaSelect') as HTMLSelectElement | null;
  if (!sel) return;
  const opts = ['<option value="">— Nenhuma escola selecionada —</option>'];
  escolasCache.forEach((e, idx) => {
    const selected = String(idx) === selectedEscolaIdx ? ' selected' : '';
    const extra = e.inep ? ` (INEP ${e.inep})` : '';
    opts.push(`<option value="${idx}"${selected}>${esc(e.nome + extra)}</option>`);
  });
  sel.innerHTML = opts.join('');
}

function renderServidoresSelect(): void {
  const sel = document.getElementById('snippetsServidorSelect') as HTMLSelectElement | null;
  if (!sel) return;
  const opts = ['<option value="">— Nenhum servidor selecionado —</option>'];
  filteredServidores.forEach((s, idx) => {
    const selected = String(idx) === selectedServidorIdx ? ' selected' : '';
    const label = `${s.nome}${s.matricula ? ` • Mat. ${s.matricula}` : ''}${s.cargo ? ` (${s.cargo})` : ''}`;
    opts.push(`<option value="${idx}"${selected}>${esc(label)}</option>`);
  });
  sel.innerHTML = opts.join('');
}

function renderListaSnippets(): void {
  const listEl = document.getElementById('snippetsListContainer');
  const previewEl = document.getElementById('snippetsPreviewBox');
  const insertBtn = document.getElementById('snippetsConfirmInsertBtn') as HTMLButtonElement | null;
  if (!listEl) return;

  const q = normSearch(searchTerm);
  const filtrados = snippetsCache.filter((s) => {
    if (selectedCategoriaFiltro !== 'TODAS' && s.categoria !== selectedCategoriaFiltro) return false;
    if (q) {
      const hay = normSearch(`${s.titulo} ${s.categoria} ${s.persona_tag || ''} ${s.conteudo_texto}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!filtrados.length) {
    listEl.innerHTML =
      '<div class="output-panel" style="padding:18px; text-align:center;">' +
        'Nenhum modelo ou snippet encontrado para os filtros aplicados.' +
      '</div>';
    if (previewEl) previewEl.textContent = 'Selecione um modelo para visualizar a interpolação.';
    if (insertBtn) insertBtn.disabled = true;
    return;
  }

  if (!selectedSnippetId || !filtrados.some((s) => String(s.id) === String(selectedSnippetId))) {
    selectedSnippetId = String(filtrados[0].id);
  }

  const canCrud = activeOptions.allowCrud !== false && podeGerenciarSnippets();
  listEl.innerHTML = filtrados
    .map((s) => {
      const isSelected = String(s.id) === String(selectedSnippetId);
      const catLabel = CATEGORIAS_SNIPPETS.find((c) => c.value === s.categoria)?.label || s.categoria;
      return (
        `<div class="snippet-card" style="${isSelected ? 'border-color: var(--accent-primary); box-shadow: 0 0 0 1px var(--accent-primary);' : ''}">` +
          '<div class="snippet-card-head">' +
            '<div>' +
              `<strong style="font-size:0.88rem;">${esc(s.titulo)}</strong>` +
              '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">' +
                `<span class="pill-badge pill-blue">${esc(catLabel)}</span>` +
                (s.persona_tag ? `<span class="pill-badge pill-gold">${esc(s.persona_tag)}</span>` : '') +
              '</div>' +
            '</div>' +
            '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
              `<button type="button" class="btn btn-secondary btn-sm" data-snippet-select="${esc(s.id)}">${isSelected ? 'Selecionado' : 'Pré-visualizar'}</button>` +
              (canCrud
                ? `<button type="button" class="btn btn-ghost btn-sm" data-snippet-edit="${esc(s.id)}">Editar</button>` +
                  `<button type="button" class="btn btn-ghost btn-sm" data-snippet-delete="${esc(s.id)}">Excluir</button>`
                : '') +
            '</div>' +
          '</div>' +
        '</div>'
      );
    })
    .join('');

  const ativo = getSnippetSelecionado();
  if (ativo && previewEl) {
    const ctx = getContextoSelecionado();
    const textoInterpolado = interpolarTemplateSnippet(ativo.conteudo_texto, ctx);
    previewEl.textContent = textoInterpolado;
    if (insertBtn) insertBtn.disabled = false;
  } else if (insertBtn) {
    insertBtn.disabled = true;
  }
}

function preencherFormCrud(snippet: SnippetModel | null): void {
  editingSnippetId = snippet ? String(snippet.id) : null;
  const tituloEl = document.getElementById('snippetCrudTitulo') as HTMLInputElement | null;
  const catEl = document.getElementById('snippetCrudCategoria') as HTMLSelectElement | null;
  const personaEl = document.getElementById('snippetCrudPersona') as HTMLInputElement | null;
  const textoEl = document.getElementById('snippetCrudTexto') as HTMLTextAreaElement | null;
  const headingEl = document.getElementById('snippetCrudFormTitle');

  if (headingEl) {
    headingEl.textContent = editingSnippetId ? 'Editar Modelo Institucional' : 'Novo Modelo Institucional';
  }
  if (tituloEl) tituloEl.value = snippet?.titulo || '';
  if (catEl) catEl.value = snippet?.categoria || 'OFICIO';
  if (personaEl) personaEl.value = snippet?.persona_tag || '';
  if (textoEl) textoEl.value = snippet?.conteudo_texto || '';
}

function alternarAbaDrawer(tab: 'biblioteca' | 'crud'): void {
  activeTab = tab;
  const libBtn = document.getElementById('snippetsTabLibBtn');
  const crudBtn = document.getElementById('snippetsTabCrudBtn');
  const libPane = document.getElementById('snippetsLibPane');
  const crudPane = document.getElementById('snippetsCrudPane');

  if (libBtn) libBtn.classList.toggle('is-active', tab === 'biblioteca');
  if (crudBtn) crudBtn.classList.toggle('is-active', tab === 'crud');
  if (libPane) libPane.classList.toggle('hidden', tab !== 'biblioteca');
  if (crudPane) crudPane.classList.toggle('hidden', tab !== 'crud');
}

async function handleSalvarCrud(ev: Event): Promise<void> {
  ev.preventDefault();
  if (!podeGerenciarSnippets()) {
    (window as any).OlymposApp?.showToast?.('Apenas Moderador, Gabinete ou Jurídico podem gerenciar modelos.', true);
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    (window as any).OlymposApp?.showToast?.('Cliente Supabase indisponível para salvar modelo.', true);
    return;
  }

  const titulo = ((document.getElementById('snippetCrudTitulo') as HTMLInputElement | null)?.value || '').trim();
  const categoria = ((document.getElementById('snippetCrudCategoria') as HTMLSelectElement | null)?.value || 'OFICIO').trim();
  const persona_tag = ((document.getElementById('snippetCrudPersona') as HTMLInputElement | null)?.value || '').trim() || null;
  const conteudo_texto = ((document.getElementById('snippetCrudTexto') as HTMLTextAreaElement | null)?.value || '').trim();

  if (!titulo || !conteudo_texto) {
    (window as any).OlymposApp?.showToast?.('Informe Título e Texto do modelo.', true);
    return;
  }

  const variaveis_suportadas = extrairVariaveisTemplate(conteudo_texto);
  const saveBtn = document.getElementById('snippetCrudSaveBtn') as HTMLButtonElement | null;
  if (saveBtn) saveBtn.disabled = true;

  try {
    if (editingSnippetId) {
      const { error } = await client
        .from('modelos_snippets')
        .update({ titulo, categoria, persona_tag, conteudo_texto, variaveis_suportadas })
        .eq('id', editingSnippetId);
      if (error) throw error;
      (window as any).OlymposApp?.showToast?.('Modelo atualizado com sucesso!');
    } else {
      const sbSess = await (window as any).OlymposSupabase?.getSession?.();
      const userId = sbSess?.user?.id || null;
      const { error } = await client
        .from('modelos_snippets')
        .insert({
          titulo,
          categoria,
          persona_tag,
          conteudo_texto,
          variaveis_suportadas,
          criado_por: userId
        });
      if (error) throw error;
      (window as any).OlymposApp?.showToast?.('Novo modelo cadastrado na biblioteca!');
    }
    preencherFormCrud(null);
    await carregarModelosSnippets();
    alternarAbaDrawer('biblioteca');
    renderListaSnippets();
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(`Falha ao salvar modelo: ${err?.message || 'erro'}`, true);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function handleExcluirSnippet(id: string): Promise<void> {
  if (!podeGerenciarSnippets()) return;
  const target = snippetsCache.find((s) => String(s.id) === String(id));
  if (!target) return;
  if (typeof window.confirm === 'function' && !window.confirm(`Excluir o modelo "${target.titulo}"?`)) {
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { error } = await client.from('modelos_snippets').delete().eq('id', id);
    if (error) throw error;
    (window as any).OlymposApp?.showToast?.('Modelo removido da biblioteca.');
    if (selectedSnippetId === id) selectedSnippetId = '';
    await carregarModelosSnippets();
    renderListaSnippets();
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(`Erro ao excluir modelo: ${err?.message || 'permissão/rede'}`, true);
  }
}

function ensureSnippetsDrawerDom(): HTMLElement {
  let backdrop = document.getElementById('snippetsLibraryDrawer');
  if (backdrop) return backdrop;

  const container = document.getElementById('modal-root') || document.body;
  backdrop = document.createElement('div');
  backdrop.id = 'snippetsLibraryDrawer';
  backdrop.className = 'modal-backdrop onda2-drawer-backdrop hidden';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'snippetsDrawerTitle');

  const canCrud = podeGerenciarSnippets();
  const catOptions = CATEGORIAS_SNIPPETS.map(
    (c) => `<option value="${esc(c.value)}">${esc(c.label)}</option>`
  ).join('');

  backdrop.innerHTML =
    '<div class="modal-card onda2-drawer-panel onda2-drawer-panel--wide">' +
      '<div class="onda2-drawer-header">' +
        '<div>' +
          '<span class="section-eyebrow" style="font-size:10px;">MINUTAS &amp; INTERPOLAÇÃO LGPD</span>' +
          '<h3 id="snippetsDrawerTitle" style="margin:2px 0 0; font-size:1.12rem;">Biblioteca de Modelos e Snippets</h3>' +
        '</div>' +
        '<button type="button" id="btnFecharSnippetsDrawer" class="icon-capsule-btn" aria-label="Fechar biblioteca de snippets">✕</button>' +
      '</div>' +
      '<div class="onda2-drawer-body">' +
        '<div class="snippets-tabs" role="tablist">' +
          '<button type="button" id="snippetsTabLibBtn" class="snippets-tab-btn is-active" role="tab">Biblioteca de Modelos</button>' +
          `<button type="button" id="snippetsTabCrudBtn" class="snippets-tab-btn${canCrud ? '' : ' hidden'}" role="tab">Gerenciar Modelos (CRUD)</button>` +
        '</div>' +
        '<div id="snippetsLibPane">' +
          '<div class="snippets-context-bar" style="margin-bottom:12px;">' +
            '<div class="field-group" style="margin:0;">' +
              '<label for="snippetsEscolaSelect">Escola (Opcional — preenche {{escola.*}})</label>' +
              '<select id="snippetsEscolaSelect" class="input-clean"><option value="">Carregando escolas...</option></select>' +
            '</div>' +
            '<div class="field-group" style="margin:0;">' +
              '<label for="snippetsServidorBusca">Servidor (LGPD 6 campos — {{servidor.*}})</label>' +
              '<input type="search" id="snippetsServidorBusca" class="input-clean" placeholder="Filtrar nome ou matrícula..." autocomplete="off" style="margin-bottom:6px;" />' +
              '<select id="snippetsServidorSelect" class="input-clean"><option value="">— Nenhum servidor selecionado —</option></select>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">' +
            '<input type="search" id="snippetsSearchInput" class="input-clean" style="flex:1; min-width:180px;" placeholder="Buscar modelo por título, persona ou texto..." autocomplete="off" />' +
            '<select id="snippetsCategoriaFilter" class="input-clean" style="max-width:210px;" aria-label="Filtrar categoria de modelo">' +
              '<option value="TODAS">Todas as categorias</option>' +
              catOptions +
            '</select>' +
          '</div>' +
          '<div id="snippetsListContainer" class="snippets-list" style="margin-bottom:12px;">' +
            '<div class="output-panel">Carregando modelos institucionais...</div>' +
          '</div>' +
          '<div>' +
            '<div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:6px;">Pré-visualização Interpolada</div>' +
            '<div id="snippetsPreviewBox" class="snippets-preview-box">Selecione um modelo para visualizar.</div>' +
          '</div>' +
        '</div>' +
        '<div id="snippetsCrudPane" class="hidden">' +
          '<form id="snippetsCrudForm" class="snippets-crud-form" style="display:flex; flex-direction:column; gap:10px;">' +
            '<h4 id="snippetCrudFormTitle" style="margin:0; font-size:0.95rem;">Novo Modelo Institucional</h4>' +
            '<div class="field-group" style="margin:0;">' +
              '<label for="snippetCrudTitulo">Título do Modelo</label>' +
              '<input type="text" id="snippetCrudTitulo" class="input-clean" required placeholder="Ex: Despacho Jurídico Padrão" />' +
            '</div>' +
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
              '<div class="field-group" style="margin:0;">' +
                '<label for="snippetCrudCategoria">Categoria</label>' +
                `<select id="snippetCrudCategoria" class="input-clean">${catOptions}</select>` +
              '</div>' +
              '<div class="field-group" style="margin:0;">' +
                '<label for="snippetCrudPersona">Persona / Tag</label>' +
                '<input type="text" id="snippetCrudPersona" class="input-clean" placeholder="Ex: Têmis, Hera, Apolo" />' +
              '</div>' +
            '</div>' +
            '<div class="field-group" style="margin:0;">' +
              '<label for="snippetCrudTexto">Texto do Modelo (suporta {{escola.nome}}, {{escola.inep}}, {{escola.diretor}}, {{servidor.nome}}, {{servidor.cargo}}, {{servidor.matricula}}, {{servidor.lotacao}}, {{servidor.municipio}}, {{data_extenso}})</label>' +
              '<textarea id="snippetCrudTexto" rows="8" class="input-clean" required style="font-family:var(--font-mono); font-size:12px;"></textarea>' +
            '</div>' +
            '<div style="display:flex; gap:8px; justify-content:flex-end;">' +
              '<button type="button" id="snippetCrudCancelBtn" class="btn btn-ghost btn-sm">Cancelar Edição</button>' +
              '<button type="submit" id="snippetCrudSaveBtn" class="btn btn-primary btn-sm">Salvar Modelo</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>' +
      '<div class="onda2-drawer-footer">' +
        '<span style="font-size:0.75rem; color:var(--text-muted);">Variáveis interpoladas sem exposição de PII sensível.</span>' +
        '<div style="display:flex; gap:8px;">' +
          '<button type="button" id="snippetsCancelFooterBtn" class="btn btn-ghost btn-sm">Fechar</button>' +
          '<button type="button" id="snippetsConfirmInsertBtn" class="btn btn-primary btn-sm" disabled>Inserir Modelo Selecionado</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  container.appendChild(backdrop);

  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeSnippetsDrawer();
  });

  document.getElementById('btnFecharSnippetsDrawer')?.addEventListener('click', closeSnippetsDrawer);
  document.getElementById('snippetsCancelFooterBtn')?.addEventListener('click', closeSnippetsDrawer);

  document.getElementById('snippetsTabLibBtn')?.addEventListener('click', () => alternarAbaDrawer('biblioteca'));
  document.getElementById('snippetsTabCrudBtn')?.addEventListener('click', () => {
    preencherFormCrud(null);
    alternarAbaDrawer('crud');
  });
  document.getElementById('snippetCrudCancelBtn')?.addEventListener('click', () => {
    preencherFormCrud(null);
    alternarAbaDrawer('biblioteca');
  });

  document.getElementById('snippetsCrudForm')?.addEventListener('submit', (ev) => {
    void handleSalvarCrud(ev);
  });

  document.getElementById('snippetsSearchInput')?.addEventListener('input', (ev) => {
    searchTerm = (ev.target as HTMLInputElement).value || '';
    renderListaSnippets();
  });

  document.getElementById('snippetsCategoriaFilter')?.addEventListener('change', (ev) => {
    selectedCategoriaFiltro = (ev.target as HTMLSelectElement).value || 'TODAS';
    renderListaSnippets();
  });

  document.getElementById('snippetsEscolaSelect')?.addEventListener('change', (ev) => {
    selectedEscolaIdx = (ev.target as HTMLSelectElement).value || '';
    renderListaSnippets();
  });

  let srvDebounce: ReturnType<typeof setTimeout> | null = null;
  document.getElementById('snippetsServidorBusca')?.addEventListener('input', (ev) => {
    const val = (ev.target as HTMLInputElement).value || '';
    if (srvDebounce) clearTimeout(srvDebounce);
    srvDebounce = setTimeout(async () => {
      filteredServidores = await buscarServidoresPublicosLgpd(val);
      selectedServidorIdx = '';
      renderServidoresSelect();
      renderListaSnippets();
    }, 220);
  });

  document.getElementById('snippetsServidorSelect')?.addEventListener('change', (ev) => {
    selectedServidorIdx = (ev.target as HTMLSelectElement).value || '';
    renderListaSnippets();
  });

  document.getElementById('snippetsListContainer')?.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement | null;
    const selectBtn = target?.closest?.('[data-snippet-select]') as HTMLElement | null;
    if (selectBtn) {
      selectedSnippetId = selectBtn.getAttribute('data-snippet-select') || '';
      renderListaSnippets();
      return;
    }
    const editBtn = target?.closest?.('[data-snippet-edit]') as HTMLElement | null;
    if (editBtn) {
      const id = editBtn.getAttribute('data-snippet-edit') || '';
      const found = snippetsCache.find((s) => String(s.id) === id) || null;
      if (found) {
        preencherFormCrud(found);
        alternarAbaDrawer('crud');
      }
      return;
    }
    const delBtn = target?.closest?.('[data-snippet-delete]') as HTMLElement | null;
    if (delBtn) {
      const id = delBtn.getAttribute('data-snippet-delete') || '';
      if (id) void handleExcluirSnippet(id);
    }
  });

  document.getElementById('snippetsConfirmInsertBtn')?.addEventListener('click', () => {
    const ativo = getSnippetSelecionado();
    if (!ativo) return;
    const ctx = getContextoSelecionado();
    const textoInterpolado = interpolarTemplateSnippet(ativo.conteudo_texto, ctx);
    const conteudoJsonInterpolado = interpolarJsonProseMirror(ativo.conteudo_json, ctx);
    const htmlInterpolado = textoInterpolado
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('');

    const result: SnippetInsertResult = {
      snippet: ativo,
      textoInterpolado,
      htmlInterpolado,
      conteudoJsonInterpolado,
      escola: ctx.escola,
      servidor: ctx.servidor
    };

    closeSnippetsDrawer();
    if (typeof activeOptions.onInsert === 'function') {
      activeOptions.onInsert(result);
    }
  });

  return backdrop;
}

export async function openSnippetsDrawer(options: OpenSnippetsDrawerOptions = {}): Promise<void> {
  activeOptions = options;
  selectedCategoriaFiltro = options.categoriaInicial || 'TODAS';
  activeTab = 'biblioteca';

  const backdrop = ensureSnippetsDrawerDom();
  const canCrud = options.allowCrud !== false && podeGerenciarSnippets();
  const crudTabBtn = document.getElementById('snippetsTabCrudBtn');
  if (crudTabBtn) crudTabBtn.classList.toggle('hidden', !canCrud);

  const catSel = document.getElementById('snippetsCategoriaFilter') as HTMLSelectElement | null;
  if (catSel) catSel.value = selectedCategoriaFiltro;

  alternarAbaDrawer('biblioteca');
  backdrop.classList.remove('hidden');

  await Promise.all([
    carregarModelosSnippets(),
    carregarEscolasContexto(),
    buscarServidoresPublicosLgpd('').then((list) => {
      filteredServidores = list;
    })
  ]);

  renderEscolasSelect();
  renderServidoresSelect();
  renderListaSnippets();
}

export function closeSnippetsDrawer(): void {
  const backdrop = document.getElementById('snippetsLibraryDrawer');
  if (backdrop) backdrop.classList.add('hidden');
}

export const OlymposSnippets = {
  open: openSnippetsDrawer,
  close: closeSnippetsDrawer,
  interpolar: interpolarTemplateSnippet,
  interpolarJson: interpolarJsonProseMirror,
  podeGerenciar: podeGerenciarSnippets
};

if (typeof window !== 'undefined') {
  (window as any).OlymposSnippets = OlymposSnippets;
}
