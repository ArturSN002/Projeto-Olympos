/**
 * Onda 2: Governança das 22 Memórias Google Docs.
 * - Rastreamento de hashOriginalSha256 via WebCrypto crypto.subtle.digest
 * - Prevenção de sobrescrita concorrente (CONFLICT_DETECTED) com resolução visual
 * - Diff Visual linha a linha LCS (memoriasDiffViewer.ts)
 * - Compactação com Arquivo Morto (memorias_compactar)
 * - Listagem, Preview Diff e Restauração de Snapshots do Dédalo (memorias_listar_snapshots / memorias_restaurar_snapshot)
 */

import '../styles/onda2.css';
import {
  calcularDiffLinhas,
  contarLinhasMemoria,
  formatarContagemLinhas,
  renderDiffHtml
} from '../modules/memoriasDiffViewer';

export interface MemoriaAtivaInfo {
  id: string;
  arquivo: string;
  slug: string;
  nome: string;
}

export interface SnapshotDedaloItem {
  id: string;
  nome: string;
  data: string;
  tamanhoBytes?: number;
  url?: string;
}

interface MemoriaGovernancaState {
  info: MemoriaAtivaInfo | null;
  baselineTexto: string;
  hashOriginalSha256: string;
  userDirty: boolean;
  diffVisible: boolean;
  snapshots: SnapshotDedaloItem[];
  previewSnapshot: {
    snapshotId: string;
    nomeSnapshot: string;
    conteudoSnapshot: string;
    hashSnapshot: string;
  } | null;
  pendingConflict: {
    conteudoAtual: string;
    hashAtual: string;
    conteudoLocal: string;
  } | null;
}

const state: MemoriaGovernancaState = {
  info: null,
  baselineTexto: '',
  hashOriginalSha256: '',
  userDirty: false,
  diffVisible: false,
  snapshots: [],
  previewSnapshot: null,
  pendingConflict: null
};

let modalObserver: MutationObserver | null = null;
let initialized = false;

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

function extrairSlugDeArquivo(val: string): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/^_+memoria_+/, '')
    .replace(/\.md$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function obterRoleAtual(): string {
  const app = (window as any).OlymposApp;
  if (app && typeof app.obterRoleIdSessao === 'function') {
    return String(app.obterRoleIdSessao() || 'VISITANTE').toUpperCase();
  }
  const sess = app?.getSession?.();
  return String(sess?.perfil?.id || sess?.role || 'VISITANTE').toUpperCase();
}

function podeEditarMemorias(): boolean {
  const app = (window as any).OlymposApp;
  if (app && typeof app.podeEditarMemorias === 'function') {
    return Boolean(app.podeEditarMemorias());
  }
  const r = obterRoleAtual();
  return r === 'MODERADOR' || r === 'ADMIN_GABINETE' || r === 'RH_COMISSAO' || r === 'PEDAGOGICO_EVENTOS' || r === 'JURIDICO';
}

function podeGovernancaAdmin(): boolean {
  const r = obterRoleAtual();
  return r === 'MODERADOR' || r === 'ADMIN_GABINETE';
}

/**
 * Calcula hash SHA-256 em hex minúsculo de 64 chars via WebCrypto API.
 */
export async function calcularSha256Hex(texto: string): Promise<string> {
  const normalized = String(texto ?? '');
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

function getGasGatewayUrl(): string | null {
  try {
    const custom = localStorage.getItem('olympos_gateway_url');
    if (custom && custom.startsWith('https://')) return custom;
  } catch {}

  const supa = (window as any).OlymposSupabase;
  if (supa && typeof supa.getConfig === 'function') {
    const cfg = supa.getConfig();
    if (cfg?.url) {
      return String(cfg.url).replace(/\/+$/, '') + '/functions/v1/gas-gateway';
    }
  }
  return null;
}

/**
 * Invoca o Gateway GAS preservando respostas estruturadas de conflito (ok: false, code: 'CONFLICT_DETECTED').
 */
async function invocarAcaoGas(action: string, payload: Record<string, any> = {}): Promise<any> {
  const api = (window as any).OlymposApi;
  const token = api && typeof api.getJwtToken === 'function' ? api.getJwtToken() : null;
  const bodyData: Record<string, any> = {
    ...payload,
    action,
    token,
    _token: token,
    sessionToken: token,
    jwtToken: token
  };

  // 1. GAS Nativo (google.script.run)
  const g = (window as any).google;
  if (g && g.script && g.script.run) {
    return new Promise((resolve, reject) => {
      g.script.run
        .withSuccessHandler((res: any) => resolve(res))
        .withFailureHandler((err: any) => reject(err))
        .executarAcaoHubClient(bodyData);
    });
  }

  // 2. Edge Gateway Zero-Trust (preserva payload completo mesmo quando ok === false)
  const gatewayUrl = getGasGatewayUrl();
  if (gatewayUrl) {
    const anonKey = (window as any).OlymposSupabase?.getConfig?.()?.anonKey || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: anonKey
    };
    if (token) {
      headers['x-supabase-auth'] = token;
      headers['authorization'] = `Bearer ${token}`;
    }

    const resp = await fetch(gatewayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData)
    });

    const data = await resp.json().catch(() => ({ ok: false, mensagem: `HTTP ${resp.status}` }));
    if (data?.code === 'MFA_REQUIRED') {
      (window as any).OlymposApp?.solicitarMfaObrigatorio?.(data);
    } else if (data?.code === 'AUTH_REQUIRED') {
      (window as any).OlymposApp?.solicitarLogin?.();
    }
    return data;
  }

  // 3. Fallback para OlymposApi.chamar se gatewayUrl indisponível
  if (api && typeof api.chamar === 'function') {
    return new Promise((resolve, reject) => {
      api.chamar(action, payload, resolve, reject);
    });
  }

  throw new Error('Gateway GAS indisponível.');
}

function extrairInfoMemoriaDoModal(): MemoriaAtivaInfo {
  const sub = document.getElementById('modalMemoriaSubtitle')?.textContent || '';
  const title = document.getElementById('modalMemoriaTitle')?.textContent || '';
  const href = document.getElementById('modalMemoriaOpenDocLink')?.getAttribute('href') || '';

  const arqMatch = sub.match(/(_memoria_[a-z0-9_]+\.md)/i);
  const idSubMatch = sub.match(/ID\s+([a-zA-Z0-9_-]{15,})/);
  const idHrefMatch = href.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);

  const arquivo = arqMatch ? arqMatch[1] : (state.info?.arquivo || '');
  const id = (idSubMatch && idSubMatch[1]) || (idHrefMatch && idHrefMatch[1]) || (state.info?.id || '');
  const nome = title.replace(/\s*—\s*Google Docs$/i, '').trim() || state.info?.nome || arquivo || 'Memória';
  const slug = extrairSlugDeArquivo(arquivo || nome) || state.info?.slug || '';

  return { id, arquivo, slug, nome };
}

function atualizarBadgeHash(): void {
  const badge = document.getElementById('memoriaHashStatusBadge');
  if (!badge) return;
  if (state.hashOriginalSha256) {
    badge.textContent = `SHA-256: ${state.hashOriginalSha256.slice(0, 10)}…`;
    badge.title = `Hash original SHA-256: ${state.hashOriginalSha256}`;
    badge.className = 'pill-badge pill-blue';
  } else {
    badge.textContent = 'SHA-256 pendente';
    badge.className = 'pill-badge pill-gray';
  }
}

function atualizarContadorLinhasLocal(texto: string): void {
  const counter = document.getElementById('modalLineCounter');
  if (!counter) return;
  const total = contarLinhasMemoria(texto);
  counter.textContent = formatarContagemLinhas(texto, 60);
  counter.className = `pill-badge ${total > 55 ? 'pill-red' : 'pill-gold'}`;
}

export function renderDiffPreviewAtual(): void {
  const wrap = document.getElementById('memoriaDiffPreviewWrap');
  const toggleBtn = document.getElementById('toggleMemoriaDiffBtn');
  const ta = document.getElementById('modalMemoriaTextarea') as HTMLTextAreaElement | null;
  if (!wrap || !ta) return;

  const textoAlvo = state.previewSnapshot ? state.previewSnapshot.conteudoSnapshot : ta.value;
  const textoBase = state.previewSnapshot ? ta.value : state.baselineTexto;
  const diff = calcularDiffLinhas(textoBase, textoAlvo);
  const html = renderDiffHtml(diff, esc);

  if (state.previewSnapshot) {
    wrap.innerHTML =
      `<div style="margin-top:8px; padding:8px 10px; border-radius:8px; background:var(--bg-tonal); border:1px solid var(--border-hairline); font-size:12px;">` +
        `Pré-visualização do Snapshot <strong>${esc(state.previewSnapshot.nomeSnapshot)}</strong> vs. conteúdo atual do editor ` +
        `(<code>SHA-256 ${esc(state.previewSnapshot.hashSnapshot.slice(0, 12))}…</code>)` +
      '</div>' +
      html;
  } else {
    wrap.innerHTML = html;
  }

  const mostrar = state.diffVisible || Boolean(state.previewSnapshot);
  wrap.classList.toggle('hidden', !mostrar);
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', mostrar ? 'true' : 'false');
    toggleBtn.textContent = mostrar ? 'Ocultar Diff Visual' : 'Mostrar Diff Visual';
  }
}

function ocultarPainelConflito(): void {
  state.pendingConflict = null;
  const panel = document.getElementById('memoriaConflictPanel');
  if (panel) panel.classList.add('hidden');
}

function exibirPainelConflito(conteudoAtual: string, hashAtual: string, conteudoLocal: string): void {
  state.pendingConflict = { conteudoAtual, hashAtual, conteudoLocal };
  const panel = document.getElementById('memoriaConflictPanel');
  const remotePre = document.getElementById('memoriaConflictRemotePre');
  const localPre = document.getElementById('memoriaConflictLocalPre');
  if (remotePre) remotePre.textContent = conteudoAtual;
  if (localPre) localPre.textContent = conteudoLocal;
  if (panel) panel.classList.remove('hidden');

  state.baselineTexto = conteudoAtual;
  state.diffVisible = true;
  renderDiffPreviewAtual();
}

async function sincronizarBaselineAoAbrir(): Promise<void> {
  const ta = document.getElementById('modalMemoriaTextarea') as HTMLTextAreaElement | null;
  if (!ta) return;

  const info = extrairInfoMemoriaDoModal();
  state.info = info;
  state.userDirty = false;
  state.previewSnapshot = null;
  ocultarPainelConflito();

  const restoreBtn = document.getElementById('restoreSnapshotDedaloBtn') as HTMLButtonElement | null;
  if (restoreBtn) restoreBtn.disabled = true;

  // Baseline inicial a partir do catálogo (antes de eventuais edições locais pendentes)
  const cat = (window as any).OLYMPOS_MEMORIAS_CATALOGO;
  const catMeta = cat
    ? (info.id && cat.obterPorId?.(info.id)) || cat.obterPorArquivo?.(info.arquivo || info.slug)
    : null;
  const temPendente = Boolean(cat && info.arquivo && cat.temEdicaoLocalPendente?.(info.arquivo));
  const textoBaseInicial = temPendente && catMeta?.conteudoCompleto ? String(catMeta.conteudoCompleto) : ta.value;

  state.baselineTexto = textoBaseInicial;
  state.hashOriginalSha256 = await calcularSha256Hex(textoBaseInicial);
  atualizarBadgeHash();
  atualizarContadorLinhasLocal(ta.value);
  state.diffVisible = temPendente;
  renderDiffPreviewAtual();

  // Visibilidade de botões de governança conforme RBAC
  const isAdmin = podeGovernancaAdmin();
  const compactBtn = document.getElementById('compactMemoriaBtn');
  const govBar = document.getElementById('memoriaGovBar');
  if (compactBtn) compactBtn.classList.toggle('hidden', !isAdmin);
  if (govBar) govBar.classList.toggle('hidden', !isAdmin);

  // Busca leitura viva para garantir hashOriginalSha256 real do Google Docs
  try {
    const res = await invocarAcaoGas('memorias_ler', {
      id: info.id || undefined,
      arquivo: info.arquivo || undefined,
      slug: info.slug || undefined
    });
    const mem = res?.memoria || res?.data?.memoria;
    if (mem && typeof mem.conteudoCompleto === 'string') {
      const currentInfo = extrairInfoMemoriaDoModal();
      if (currentInfo.arquivo !== info.arquivo && currentInfo.id !== info.id) return;

      const hashServidor = mem.hashSha256 || (await calcularSha256Hex(mem.conteudoCompleto));
      state.baselineTexto = mem.conteudoCompleto;
      state.hashOriginalSha256 = hashServidor;
      atualizarBadgeHash();

      if (!temPendente && !state.userDirty) {
        ta.value = mem.conteudoCompleto;
        atualizarContadorLinhasLocal(ta.value);
      }
      renderDiffPreviewAtual();
    }
  } catch {
    // offline: mantém hash SHA-256 calculado localmente
  }

  if (isAdmin) {
    void listarSnapshotsDedalo();
  }
}

export async function listarSnapshotsDedalo(): Promise<SnapshotDedaloItem[]> {
  const select = document.getElementById('snapshotDedaloSelect') as HTMLSelectElement | null;
  if (select) {
    select.innerHTML = '<option value="">Carregando snapshots do Dédalo...</option>';
  }

  try {
    const res = await invocarAcaoGas('memorias_listar_snapshots', {});
    const list: SnapshotDedaloItem[] = Array.isArray(res?.snapshots) ? res.snapshots : [];
    state.snapshots = list;
    if (select) {
      if (!list.length) {
        select.innerHTML = '<option value="">Nenhum snapshot disponível no Drive</option>';
      } else {
        select.innerHTML = list
          .map((s) => {
            const dt = s.data ? s.data.slice(0, 16).replace('T', ' ') : '';
            return `<option value="${esc(s.id)}">${esc(s.nome)}${dt ? ` (${esc(dt)})` : ''}</option>`;
          })
          .join('');
      }
    }
    return list;
  } catch (err) {
    if (select) {
      select.innerHTML = '<option value="">Snapshots indisponíveis (Gateway offline)</option>';
    }
    return [];
  }
}

export async function visualizarSnapshotDedalo(): Promise<void> {
  const select = document.getElementById('snapshotDedaloSelect') as HTMLSelectElement | null;
  const previewBtn = document.getElementById('previewSnapshotDedaloBtn') as HTMLButtonElement | null;
  const restoreBtn = document.getElementById('restoreSnapshotDedaloBtn') as HTMLButtonElement | null;
  const snapshotFileId = select?.value || '';
  const info = extrairInfoMemoriaDoModal();

  if (!snapshotFileId) {
    (window as any).OlymposApp?.showToast?.('Selecione um snapshot do Dédalo para pré-visualizar.', true);
    return;
  }

  if (previewBtn) {
    previewBtn.disabled = true;
    previewBtn.textContent = 'Carregando...';
  }

  try {
    const res = await invocarAcaoGas('memorias_restaurar_snapshot', {
      snapshotFileId,
      slugMemoria: info.slug || info.arquivo,
      confirmar: false
    });

    if (!res || res.ok === false || typeof res.conteudoSnapshot !== 'string') {
      throw new Error(res?.mensagem || 'Não foi possível extrair a memória deste snapshot.');
    }

    state.previewSnapshot = {
      snapshotId: snapshotFileId,
      nomeSnapshot: res.nomeSnapshot || snapshotFileId,
      conteudoSnapshot: res.conteudoSnapshot,
      hashSnapshot: res.hashSnapshot || (await calcularSha256Hex(res.conteudoSnapshot))
    };
    state.diffVisible = true;
    renderDiffPreviewAtual();
    if (restoreBtn) restoreBtn.disabled = false;
    (window as any).OlymposApp?.showToast?.('Diff do snapshot carregado para revisão!');
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(err?.message || 'Erro ao pré-visualizar snapshot.', true);
  } finally {
    if (previewBtn) {
      previewBtn.disabled = false;
      previewBtn.textContent = 'Pré-visualizar Diff';
    }
  }
}

export async function restaurarSnapshotDedalo(): Promise<void> {
  const select = document.getElementById('snapshotDedaloSelect') as HTMLSelectElement | null;
  const restoreBtn = document.getElementById('restoreSnapshotDedaloBtn') as HTMLButtonElement | null;
  const snapshotFileId = state.previewSnapshot?.snapshotId || select?.value || '';
  const info = extrairInfoMemoriaDoModal();

  if (!snapshotFileId) return;
  if (
    typeof window.confirm === 'function' &&
    !window.confirm(
      `Confirmar restauração in-place de ${info.arquivo || info.slug} a partir do snapshot selecionado? Esta ação sobrescreve o Google Docs e será auditada.`
    )
  ) {
    return;
  }

  if (restoreBtn) {
    restoreBtn.disabled = true;
    restoreBtn.textContent = 'Restaurando...';
  }

  try {
    const res = await invocarAcaoGas('memorias_restaurar_snapshot', {
      snapshotFileId,
      slugMemoria: info.slug || info.arquivo,
      confirmar: true
    });

    if (!res || res.ok === false) {
      throw new Error(res?.mensagem || 'Falha ao restaurar snapshot no Google Docs.');
    }

    const novoTexto = res.conteudoCompleto || state.previewSnapshot?.conteudoSnapshot || '';
    const ta = document.getElementById('modalMemoriaTextarea') as HTMLTextAreaElement | null;
    if (ta) {
      ta.value = novoTexto;
      atualizarContadorLinhasLocal(novoTexto);
    }

    state.baselineTexto = novoTexto;
    state.hashOriginalSha256 = res.hashSha256 || (await calcularSha256Hex(novoTexto));
    state.previewSnapshot = null;
    state.userDirty = false;
    atualizarBadgeHash();
    renderDiffPreviewAtual();

    (window as any).OLYMPOS_MEMORIAS_CATALOGO?.removerEdicaoLocal?.(info.arquivo);
    (window as any).OlymposViews?.personas?.recarregar?.(true);
    (window as any).OlymposApp?.showToast?.('Memória restaurada a partir do snapshot do Dédalo!');
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(err?.message || 'Erro ao restaurar snapshot.', true);
  } finally {
    if (restoreBtn) {
      restoreBtn.disabled = false;
      restoreBtn.textContent = 'Restaurar Snapshot';
    }
  }
}

export async function compactarMemoriaAtiva(): Promise<void> {
  if (!podeGovernancaAdmin()) {
    (window as any).OlymposApp?.showToast?.('Apenas Moderador ou Gabinete podem compactar memórias.', true);
    return;
  }

  const info = extrairInfoMemoriaDoModal();
  if (
    typeof window.confirm === 'function' &&
    !window.confirm(
      `Compactar ${info.arquivo || info.nome} para <= 60 linhas? As entradas antigas do Rolling Log serão movidas para Arquivos_Mortos no Drive sem perda de histórico.`
    )
  ) {
    return;
  }

  const btn = document.getElementById('compactMemoriaBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Compactando...';
  }

  try {
    const res = await invocarAcaoGas('memorias_compactar', {
      arquivo: info.arquivo || undefined,
      id: info.id || undefined,
      slug: info.slug || undefined
    });

    if (!res || res.ok === false) {
      throw new Error(res?.mensagem || 'Falha ao compactar memória.');
    }

    const textoCompactado = res.conteudoCompleto || '';
    const ta = document.getElementById('modalMemoriaTextarea') as HTMLTextAreaElement | null;
    if (ta && textoCompactado) {
      ta.value = textoCompactado;
      atualizarContadorLinhasLocal(textoCompactado);
    }

    if (textoCompactado) {
      state.baselineTexto = textoCompactado;
      state.hashOriginalSha256 = res.hashSha256 || (await calcularSha256Hex(textoCompactado));
      state.userDirty = false;
      atualizarBadgeHash();
      renderDiffPreviewAtual();
    }

    (window as any).OLYMPOS_MEMORIAS_CATALOGO?.removerEdicaoLocal?.(info.arquivo);
    (window as any).OlymposViews?.personas?.recarregar?.(true);

    const linhasInfo = res.linhasDepois !== undefined
      ? ` (${res.linhasAntes || '?'} -> ${res.linhasDepois} linhas, ${res.linhasArquivadas || 0} arquivadas)`
      : '';
    (window as any).OlymposApp?.showToast?.(`Memória compactada com sucesso${linhasInfo}!`);
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(err?.message || 'Erro ao compactar memória.', true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Compactar Memória (<= 60 linhas)';
    }
  }
}

export async function salvarMemoriaComGovernanca(overrideHash?: string): Promise<void> {
  if (!podeEditarMemorias()) {
    (window as any).OlymposApp?.showToast?.('Seu perfil possui acesso somente leitura às memórias institucionais.', true);
    return;
  }

  const ta = document.getElementById('modalMemoriaTextarea') as HTMLTextAreaElement | null;
  const btn = document.getElementById('saveMemoriaBtn') as HTMLButtonElement | null;
  const modal = document.getElementById('memoriaModal');
  if (!ta) return;

  const info = extrairInfoMemoriaDoModal();
  const novoConteudo = ta.value;

  // Backup local imediato
  (window as any).OLYMPOS_MEMORIAS_CATALOGO?.salvarLocal?.(info.arquivo, novoConteudo);

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verificando SHA-256 e salvando...';
  }

  const hashParaEnvio = overrideHash !== undefined ? overrideHash : state.hashOriginalSha256;

  try {
    const res = await invocarAcaoGas('memorias_salvar', {
      arquivo: info.arquivo,
      id: info.id || undefined,
      conteudo: novoConteudo,
      hashOriginalSha256: hashParaEnvio || undefined
    });

    if (res && res.code === 'CONFLICT_DETECTED') {
      const conteudoRemoto = String(res.conteudoAtual || '');
      const hashRemoto = String(res.hashAtual || (await calcularSha256Hex(conteudoRemoto)));
      exibirPainelConflito(conteudoRemoto, hashRemoto, novoConteudo);
      (window as any).OlymposApp?.showToast?.(
        res.mensagem || 'Conflito detectado: o documento foi alterado no Google Docs após sua abertura.',
        true
      );
      return;
    }

    if (res && res.ok !== false) {
      const textoFinal = String(res.conteudoCompleto || novoConteudo);
      state.baselineTexto = textoFinal;
      state.hashOriginalSha256 = res.hashSha256 || (await calcularSha256Hex(textoFinal));
      state.userDirty = false;
      ocultarPainelConflito();
      atualizarBadgeHash();

      (window as any).OLYMPOS_MEMORIAS_CATALOGO?.removerEdicaoLocal?.(info.arquivo);
      (window as any).OlymposApp?.showToast?.(`Memória ${info.arquivo || info.nome} sincronizada com sucesso!`);
      if (modal) modal.classList.add('hidden');
      (window as any).OlymposViews?.personas?.recarregar?.(true);
      (window as any).OlymposViews?.visaoGeral?.recarregar?.();
    } else {
      (window as any).OlymposApp?.showToast?.(
        `Salvo localmente no navegador! Sincronização pendente (${res?.mensagem || 'offline'}).`,
        false
      );
      if (modal) modal.classList.add('hidden');
      (window as any).OlymposViews?.personas?.recarregar?.(true);
    }
  } catch {
    (window as any).OlymposApp?.showToast?.(
      'Salvo localmente no navegador! Sincronização ocorrerá quando o Gateway estiver online.',
      false
    );
    if (modal) modal.classList.add('hidden');
    (window as any).OlymposViews?.personas?.recarregar?.(true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar no Google Docs';
    }
  }
}

export function setMemoriaAtiva(info: MemoriaAtivaInfo): void {
  state.info = info;
}

function bindModalControls(): void {
  const modal = document.getElementById('memoriaModal') as any;
  if (!modal || modal._boundGovernanca) return;
  modal._boundGovernanca = true;

  const ta = document.getElementById('modalMemoriaTextarea') as HTMLTextAreaElement | null;
  if (ta) {
    ta.addEventListener('input', () => {
      state.userDirty = true;
      atualizarContadorLinhasLocal(ta.value);
      if (state.diffVisible) {
        renderDiffPreviewAtual();
      }
    });
  }

  document.getElementById('toggleMemoriaDiffBtn')?.addEventListener('click', () => {
    state.diffVisible = !state.diffVisible;
    renderDiffPreviewAtual();
  });

  document.getElementById('compactMemoriaBtn')?.addEventListener('click', () => {
    void compactarMemoriaAtiva();
  });

  document.getElementById('previewSnapshotDedaloBtn')?.addEventListener('click', () => {
    void visualizarSnapshotDedalo();
  });

  document.getElementById('restoreSnapshotDedaloBtn')?.addEventListener('click', () => {
    void restaurarSnapshotDedalo();
  });

  document.getElementById('btnConflictUseRemote')?.addEventListener('click', () => {
    if (!state.pendingConflict || !ta) return;
    ta.value = state.pendingConflict.conteudoAtual;
    state.baselineTexto = state.pendingConflict.conteudoAtual;
    state.hashOriginalSha256 = state.pendingConflict.hashAtual;
    state.userDirty = false;
    atualizarContadorLinhasLocal(ta.value);
    atualizarBadgeHash();
    ocultarPainelConflito();
    renderDiffPreviewAtual();
    (window as any).OlymposApp?.showToast?.('Conteúdo atualizado para a versão mais recente do Google Docs.');
  });

  document.getElementById('btnConflictMergeManual')?.addEventListener('click', () => {
    if (!state.pendingConflict) return;
    state.baselineTexto = state.pendingConflict.conteudoAtual;
    state.hashOriginalSha256 = state.pendingConflict.hashAtual;
    atualizarBadgeHash();
    ocultarPainelConflito();
    state.diffVisible = true;
    renderDiffPreviewAtual();
    (window as any).OlymposApp?.showToast?.('Compare no Diff Visual abaixo, ajuste seu texto e clique em Salvar novamente.');
  });

  document.getElementById('btnConflictForceLocal')?.addEventListener('click', () => {
    if (!state.pendingConflict) return;
    const hashAtual = state.pendingConflict.hashAtual;
    ocultarPainelConflito();
    void salvarMemoriaComGovernanca(hashAtual);
  });

  // Captura clique de salvar ANTES do handler legado de app.js para enviar hashOriginalSha256
  const saveBtn = document.getElementById('saveMemoriaBtn');
  if (saveBtn) {
    saveBtn.addEventListener(
      'click',
      (ev) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        void salvarMemoriaComGovernanca();
      },
      true
    );
  }

  // Ao recarregar do Docs, re-sincroniza baseline e SHA-256
  document.getElementById('reloadMemoriaBtn')?.addEventListener('click', () => {
    setTimeout(() => {
      void sincronizarBaselineAoAbrir();
    }, 350);
  });
}

export function mountMemoriasGovernanca(): void {
  const modal = document.getElementById('memoriaModal');
  if (modal) {
    bindModalControls();
    if (!modal.classList.contains('hidden')) {
      void sincronizarBaselineAoAbrir();
    }
  }

  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  let wasOpen = Boolean(modal && !modal.classList.contains('hidden'));
  modalObserver = new MutationObserver(() => {
    const m = document.getElementById('memoriaModal');
    if (!m) return;
    bindModalControls();
    const isOpen = !m.classList.contains('hidden');
    if (isOpen && !wasOpen) {
      wasOpen = true;
      void sincronizarBaselineAoAbrir();
    } else if (!isOpen) {
      wasOpen = false;
      state.info = null;
      state.previewSnapshot = null;
      state.pendingConflict = null;
      state.userDirty = false;
    }
  });

  modalObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class']
  });
}

export const OlymposMemoriasGovernanca = {
  mount: mountMemoriasGovernanca,
  calcularSha256Hex,
  setMemoriaAtiva,
  salvar: salvarMemoriaComGovernanca,
  compactar: compactarMemoriaAtiva,
  listarSnapshots: listarSnapshotsDedalo,
  visualizarSnapshot: visualizarSnapshotDedalo,
  restaurarSnapshot: restaurarSnapshotDedalo
};

if (typeof window !== 'undefined') {
  (window as any).OlymposMemoriasGovernanca = OlymposMemoriasGovernanca;
}
