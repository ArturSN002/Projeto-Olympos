/**
 * Onda 2: Drawer Lateral Acessível de Timeline & Despacho de Pendências (.modal-backdrop).
 * Exibe detalhes, seletor de Responsável, histórico de comentários internos (pendencias_comentarios),
 * integração com Biblioteca de Snippets e despacho direto para Ofício ou Portaria.
 * REGRA CRÍTICA: ZERO envio de e-mail ao solicitante em qualquer alteração/finalização.
 */

import '../styles/onda2.css';
import '../styles/onda4.css';
import { openSnippetsDrawer } from '../core/snippetsDrawer';

export interface PendingDispatchContext {
  pendenciaId: number | string;
  numeroProtocolo: string;
  destinatario: string;
  assunto: string;
  corpoBase: string;
  tipo: 'OFICIO' | 'PORTARIA';
  setor?: string;
  solicitanteNome?: string;
  criadoEm?: string;
}

export interface DocumentoVinculadoPayload {
  documentoId?: number | null;
  numero?: string | null;
  url?: string | null;
}

interface StaffProfile {
  id: string;
  full_name: string;
  role?: string;
  department?: string;
}

interface PendenciaComentarioRow {
  id: number;
  pendencia_id: number;
  autor_id: string | null;
  tipo_evento: 'COMENTARIO' | 'MUDANCA_STATUS' | 'ATRIBUICAO' | 'DOCUMENTO_VINCULADO' | string;
  conteudo: string;
  criado_em: string;
}

export const DISPATCH_CONTEXT_STORAGE_KEY = 'olympos_pending_dispatch_context';

let activeTicket: any = null;
let staffProfilesCache: StaffProfile[] = [];
let comentariosCache: PendenciaComentarioRow[] = [];

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

function sanitizarUrlSegura(url: unknown): string {
  const raw = String(url || '').trim();
  if (/^https?:\/\/\S+/i.test(raw)) return raw;
  return '';
}

function getSupabaseClient(): any {
  const supa = (window as any).OlymposSupabase;
  if (!supa) return null;
  return typeof supa.getClient === 'function' ? supa.getClient() : supa.client || null;
}

async function getCurrentAuthUid(): Promise<string | null> {
  const appSess = (window as any).OlymposApp?.getSession?.();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const candidate = appSess?.user?.id || appSess?.profile?.id || appSess?.userId || appSess?.id || '';
  if (uuidRe.test(String(candidate))) return String(candidate);

  const supa = (window as any).OlymposSupabase;
  if (supa && typeof supa.getSession === 'function') {
    try {
      const sbSess = await supa.getSession();
      const uid = sbSess?.user?.id || '';
      if (uuidRe.test(String(uid))) return String(uid);
    } catch {
      // ignora
    }
  }
  return null;
}

function formatarDataHoraBr(iso: unknown): string {
  if (!iso) return '--';
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function resolverTicketAtual(ticketOrId: any): any {
  if (ticketOrId && typeof ticketOrId === 'object') return ticketOrId;
  const idStr = String(ticketOrId ?? '');
  const list = (window as any).OlymposSignals?.tickets?.peek?.() || [];
  return list.find((t: any) => String(t.id) === idStr) || null;
}

function extrairAnexosTicket(ticket: any): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const addUrl = (u: unknown) => {
    const safe = sanitizarUrlSegura(u);
    if (safe && !seen.has(safe)) {
      seen.add(safe);
      urls.push(safe);
    }
  };
  if (Array.isArray(ticket?.anexos_links)) {
    ticket.anexos_links.forEach(addUrl);
  }
  if (ticket?.anexos) {
    String(ticket.anexos)
      .split(/[\r\n,;|]+|\s+(?=https?:\/\/)/i)
      .forEach(addUrl);
  }
  return urls;
}

async function carregarStaffProfiles(): Promise<void> {
  const map = new Map<string, StaffProfile>();
  const appSess = (window as any).OlymposApp?.getSession?.();
  const selfUid = await getCurrentAuthUid();
  if (selfUid) {
    map.set(selfUid, {
      id: selfUid,
      full_name: String(appSess?.nome || appSess?.profile?.full_name || appSess?.email || 'Operador Atual'),
      role: String(appSess?.perfil?.id || appSess?.role || ''),
      department: String(appSess?.profile?.department || '')
    });
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name, role, department')
        .order('full_name', { ascending: true });
      if (!error && Array.isArray(data)) {
        for (const p of data) {
          if (!p?.id) continue;
          map.set(String(p.id), {
            id: String(p.id),
            full_name: String(p.full_name || p.id),
            role: p.role ? String(p.role) : '',
            department: p.department ? String(p.department) : ''
          });
        }
      }
    } catch {
      // mantém perfil próprio em cache
    }
  }

  staffProfilesCache = Array.from(map.values()).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, 'pt-BR')
  );
}

async function carregarComentariosPendencia(pendenciaId: number | string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || pendenciaId === undefined || pendenciaId === null) {
    comentariosCache = [];
    return;
  }

  try {
    const { data, error } = await client
      .from('pendencias_comentarios')
      .select('id, pendencia_id, autor_id, tipo_evento, conteudo, criado_em')
      .eq('pendencia_id', pendenciaId)
      .order('criado_em', { ascending: true });
    if (!error && Array.isArray(data)) {
      comentariosCache = data as PendenciaComentarioRow[];
    } else {
      comentariosCache = [];
    }
  } catch (err) {
    console.warn('[TimelineDrawer] Erro ao carregar comentários:', err);
    comentariosCache = [];
  }
}

async function registrarComentarioEvento(
  pendenciaId: number | string,
  tipoEvento: 'COMENTARIO' | 'MUDANCA_STATUS' | 'ATRIBUICAO' | 'DOCUMENTO_VINCULADO',
  conteudo: string
): Promise<boolean> {
  const client = getSupabaseClient();
  const txt = String(conteudo || '').trim();
  if (!client || !txt) return false;

  const autorId = await getCurrentAuthUid();
  const { error } = await client.from('pendencias_comentarios').insert({
    pendencia_id: Number(pendenciaId) || pendenciaId,
    autor_id: autorId,
    tipo_evento: tipoEvento,
    conteudo: txt
  });

  if (error) {
    console.warn('[TimelineDrawer] Falha ao registrar evento em pendencias_comentarios:', error);
    return false;
  }
  return true;
}

function renderResponsavelSelect(): void {
  const sel = document.getElementById('timelineResponsavelSelect') as HTMLSelectElement | null;
  if (!sel || !activeTicket) return;
  const currentResp = activeTicket.responsavel_id ? String(activeTicket.responsavel_id) : '';
  const opts = ['<option value="">— Não atribuído —</option>'];
  let foundCurrent = !currentResp;

  for (const p of staffProfilesCache) {
    const selected = p.id === currentResp ? ' selected' : '';
    if (p.id === currentResp) foundCurrent = true;
    const label = `${p.full_name}${p.department ? ` (${p.department})` : ''}`;
    opts.push(`<option value="${esc(p.id)}"${selected}>${esc(label)}</option>`);
  }

  if (!foundCurrent && currentResp) {
    opts.push(`<option value="${esc(currentResp)}" selected>Operador (${esc(currentResp.slice(0, 8))})</option>`);
  }

  sel.innerHTML = opts.join('');
}

function renderTimelineFeed(): void {
  const feedEl = document.getElementById('timelineEventosFeed');
  if (!feedEl) return;

  if (!comentariosCache.length) {
    feedEl.innerHTML =
      '<div class="output-panel" style="padding:14px; text-align:center; font-size:0.82rem;">' +
        'Nenhum evento ou comentário interno registrado para esta pendência.' +
      '</div>';
    return;
  }

  const labelEvento: Record<string, string> = {
    COMENTARIO: 'Comentário Interno',
    MUDANCA_STATUS: 'Mudança de Status',
    ATRIBUICAO: 'Atribuição',
    DOCUMENTO_VINCULADO: 'Documento Vinculado'
  };

  feedEl.innerHTML = comentariosCache
    .map((c) => {
      const autorProfile = c.autor_id
        ? staffProfilesCache.find((p) => p.id === String(c.autor_id))
        : null;
      const autorNome = autorProfile
        ? autorProfile.full_name
        : c.autor_id
          ? `Operador (${String(c.autor_id).slice(0, 8)})`
          : 'Sistema Olympos';
      const tipoLabel = labelEvento[c.tipo_evento] || c.tipo_evento;

      return (
        `<div class="timeline-item timeline-item--${esc(c.tipo_evento)}">` +
          '<div class="timeline-item-head">' +
            `<span><strong>${esc(tipoLabel)}</strong> • ${esc(autorNome)}</span>` +
            `<span>${esc(formatarDataHoraBr(c.criado_em))}</span>` +
          '</div>' +
          `<div class="timeline-item-text">${esc(c.conteudo)}</div>` +
        '</div>'
      );
    })
    .join('');
}

function renderDetalhesTicket(): void {
  if (!activeTicket) return;
  const protoEl = document.getElementById('timelineDrawerProtocolo');
  const titleEl = document.getElementById('timelineDrawerTitle');
  const metaEl = document.getElementById('timelineDrawerMeta');
  const descEl = document.getElementById('timelineDrawerDescricao');
  const docWrap = document.getElementById('timelineDrawerDocVinculado');

  const proto = String(activeTicket.numero_protocolo || activeTicket.id || '--');
  const nome = String(activeTicket.nome || activeTicket.nome_completo || 'Solicitante SMEB');
  const email = String(activeTicket.email || activeTicket.email_solicitante || '--');
  const setor = String(activeTicket.setor || 'Geral');
  const status = String(activeTicket.status || 'RECEBIDO').toUpperCase();
  const dataLim = String(activeTicket.data_limite_entrega || activeTicket.dia_entrega || 'Conforme fila');
  const assunto = String(activeTicket.assunto_tipo || 'Solicitação Geral');
  const justificativa = String(activeTicket.justificativa || activeTicket.descricao || 'Sem descrição.');

  if (protoEl) protoEl.textContent = `PROTOCOLO #${proto} • ${status}`;
  if (titleEl) titleEl.textContent = `${nome} — ${assunto}`;

  if (metaEl) {
    const anexos = extrairAnexosTicket(activeTicket);
    const anexosHtml = anexos.length
      ? anexos
          .map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-primary); text-decoration:underline; margin-right:8px;">Anexo ${i + 1} ↗</a>`)
          .join('')
      : '<span class="text-muted">Nenhum anexo</span>';

    metaEl.innerHTML =
      `<div class="timeline-meta-item"><strong>Setor</strong><span>${esc(setor)}</span></div>` +
      `<div class="timeline-meta-item"><strong>Solicitante / E-mail</strong><span>${esc(email)}</span></div>` +
      `<div class="timeline-meta-item"><strong>Data Limite / Carimbo</strong><span>${esc(dataLim)} • ${esc(formatarDataHoraBr(activeTicket.criado_em || activeTicket.carimbo_data_hora))}</span></div>` +
      `<div class="timeline-meta-item"><strong>Anexos</strong><div>${anexosHtml}</div></div>`;
  }

  if (descEl) descEl.textContent = justificativa;

  if (docWrap) {
    const docNum = activeTicket.documento_vinculado_numero;
    const docUrl = sanitizarUrlSegura(activeTicket.documento_vinculado_url);
    if (docNum || docUrl) {
      docWrap.classList.remove('hidden');
      docWrap.innerHTML = docUrl
        ? `<a href="${esc(docUrl)}" target="_blank" rel="noopener noreferrer" class="kanban-card-doc-badge">Documento vinculado: ${esc(docNum || 'Abrir no Docs')} ↗</a>`
        : `<span class="kanban-card-doc-badge">Documento vinculado: ${esc(docNum)}</span>`;
    } else {
      docWrap.classList.add('hidden');
      docWrap.innerHTML = '';
    }
  }

  renderTriagemAssistivaBanner();
  renderResponsavelSelect();
}

function renderTriagemAssistivaBanner(): void {
  const bannerEl = document.getElementById('timelineTriagemBanner');
  if (!bannerEl || !activeTicket) return;

  const setorSug = activeTicket.triagem_setor_sugerido ? String(activeTicket.triagem_setor_sugerido) : '';
  const confiancaNum = Number(activeTicket.triagem_confianca);
  const confiancaPct = Number.isFinite(confiancaNum) && confiancaNum > 0 ? Math.round(confiancaNum * 100) : null;
  const coerente = activeTicket.triagem_urgencia_coerente;
  const motivo = String(activeTicket.triagem_urgencia_motivo || '').trim();
  const snippetId = activeTicket.triagem_snippet_sugerido_id ? String(activeTicket.triagem_snippet_sugerido_id) : '';
  const snippetTitulo = String(activeTicket.triagem_snippet_sugerido_titulo || 'Minuta Recomendada');

  if (!setorSug) {
    bannerEl.innerHTML =
      '<div class="triagem-assistiva-head">' +
        '<div>' +
          '<strong style="font-size:0.8rem;">Triagem Assistiva ($0 — Vetorial + Determinística)</strong>' +
          '<p style="margin:2px 0 0; font-size:0.75rem; color:var(--text-muted);">Classifique setor, valide coerência de urgência e localize minuta pronta sem enviar dados pessoais.</p>' +
        '</div>' +
        '<button type="button" id="timelineExecutarTriagemBtn" class="btn btn-secondary btn-sm">Executar Triagem Assistiva ($0)</button>' +
      '</div>';
    document.getElementById('timelineExecutarTriagemBtn')?.addEventListener('click', () => {
      void executarTriagemAssistiva();
    });
    return;
  }

  const urgBadgeClass = coerente === false ? 'pill-amber' : 'pill-green';
  const urgBadgeText = coerente === false ? 'Revisar Urgência' : 'Urgência Coerente';

  bannerEl.innerHTML =
    '<div class="triagem-assistiva-head">' +
      `<div style="font-size:0.8rem;"><strong>Sugestão de Triagem:</strong> Setor ${esc(setorSug)}${confiancaPct ? ` (${confiancaPct}%)` : ''}</div>` +
      `<span class="pill-badge ${urgBadgeClass}" style="font-size:0.7rem;">${esc(urgBadgeText)}</span>` +
    '</div>' +
    (motivo ? `<div style="font-size:0.76rem; color:var(--text-secondary);">${esc(motivo)}</div>` : '') +
    '<div class="triagem-assistiva-actions">' +
      `<button type="button" id="timelineAplicarSetorTriagemBtn" class="btn btn-secondary btn-sm">Aplicar Setor (${esc(setorSug)})</button>` +
      (snippetId ? `<button type="button" id="timelineAplicarMinutaTriagemBtn" class="btn btn-primary btn-sm">Aplicar ${esc(snippetTitulo)}</button>` : '') +
      '<button type="button" id="timelineExecutarTriagemBtn" class="btn btn-ghost btn-sm">Reanalisar</button>' +
    '</div>';

  document.getElementById('timelineExecutarTriagemBtn')?.addEventListener('click', () => {
    void executarTriagemAssistiva();
  });
  document.getElementById('timelineAplicarSetorTriagemBtn')?.addEventListener('click', () => {
    void aplicarSetorSugeridoTriagem(setorSug);
  });
  if (snippetId) {
    document.getElementById('timelineAplicarMinutaTriagemBtn')?.addEventListener('click', () => {
      void aplicarMinutaRecomendadaTriagem(snippetId);
    });
  }
}

async function executarTriagemAssistiva(): Promise<void> {
  if (!activeTicket) return;
  const btn = document.getElementById('timelineExecutarTriagemBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Analisando...';
  }

  try {
    const supa = (window as any).OlymposSupabase;
    const cfg = supa?.getConfig?.();
    const baseUrl = String(cfg?.url || 'https://rbwizevjvbvjwtbwwyif.supabase.co').replace(/\/+$/, '');
    const anonKey = String(cfg?.anonKey || '');
    const appSess = (window as any).OlymposApp?.getSession?.();
    const sbSess = await supa?.getSession?.();
    const jwt = String(sbSess?.access_token || appSess?.access_token || appSess?.token || '');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (anonKey) headers['apikey'] = anonKey;
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    const resp = await fetch(`${baseUrl}/functions/v1/triagem-vetorial`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pendencia_id: activeTicket.id,
        assunto_tipo: activeTicket.assunto_tipo || '',
        justificativa: activeTicket.justificativa || activeTicket.descricao || '',
        setor: activeTicket.setor || 'SMEB',
        data_limite_entrega: activeTicket.data_limite_entrega || '',
        urgencia: Boolean(activeTicket.urgencia || activeTicket.urgencia_ativa)
      })
    });
    const data = await resp.json();
    if (!resp.ok || !data || data.ok === false) {
      throw new Error(data?.mensagem || `HTTP ${resp.status}`);
    }

    const patch: Record<string, any> = {
      triagem_setor_sugerido: data.setor_sugerido,
      triagem_confianca: data.confianca,
      triagem_urgencia_coerente: data.urgencia_coerente,
      triagem_urgencia_motivo: data.urgencia_motivo,
      triagem_snippet_sugerido_id: data.snippet_sugerido_id,
      triagem_snippet_sugerido_titulo: data.snippet_sugerido_titulo,
      triagem_executada_em: data.triagem_executada_em
    };
    Object.assign(activeTicket, patch);
    (window as any).OlymposSignals?.updateTicket?.(activeTicket.id, patch);
    renderTriagemAssistivaBanner();
    (window as any).OlymposApp?.showToast?.('Triagem assistiva ($0) concluída!');
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(`Não foi possível executar triagem: ${err?.message || 'erro'}`, true);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Executar Triagem Assistiva ($0)';
    }
  }
}

async function aplicarSetorSugeridoTriagem(setorSug: string): Promise<void> {
  if (!activeTicket || !setorSug) return;
  if (typeof window.confirm === 'function' && !window.confirm(`Confirmar alteração do setor da pendência para "${setorSug}"?`)) {
    return;
  }
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { error } = await client
      .from('pendencias_solicitacoes')
      .update({ setor: setorSug })
      .eq('id', activeTicket.id);
    if (error) throw error;
    activeTicket.setor = setorSug;
    (window as any).OlymposSignals?.updateTicket?.(activeTicket.id, { setor: setorSug });
    await registrarComentarioEvento(activeTicket.id, 'COMENTARIO', `Setor atualizado via Triagem Assistiva para: ${setorSug}.`);
    renderDetalhesTicket();
    await carregarComentariosPendencia(activeTicket.id);
    renderTimelineFeed();
    (window as any).OlymposApp?.showToast?.(`Setor atualizado para ${setorSug}.`);
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(`Falha ao aplicar setor: ${err?.message || 'erro'}`, true);
  }
}

async function aplicarMinutaRecomendadaTriagem(snippetId: string): Promise<void> {
  const client = getSupabaseClient();
  const ta = document.getElementById('timelineNovoComentarioInput') as HTMLTextAreaElement | null;
  if (!client || !ta) return;
  try {
    const { data, error } = await client
      .from('modelos_snippets')
      .select('titulo, corpo_texto')
      .eq('id', snippetId)
      .maybeSingle();
    if (error || !data?.corpo_texto) {
      throw new Error('Minuta recomendada não encontrada na Biblioteca.');
    }
    const prefix = ta.value.trim() ? `${ta.value.trim()}\n\n` : '';
    ta.value = `${prefix}${String(data.corpo_texto)}`;
    ta.focus();
    (window as any).OlymposApp?.showToast?.(`Minuta "${String(data.titulo || 'Recomendada')}" inserida para revisão humana!`);
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(err?.message || 'Erro ao carregar minuta recomendada.', true);
  }
}

async function handleAtribuirResponsavel(): Promise<void> {
  if (!activeTicket) return;
  const sel = document.getElementById('timelineResponsavelSelect') as HTMLSelectElement | null;
  const btn = document.getElementById('timelineAtribuirBtn') as HTMLButtonElement | null;
  const novoRespId = sel ? sel.value.trim() : '';
  const client = getSupabaseClient();
  if (!client) {
    (window as any).OlymposApp?.showToast?.('Cliente Supabase indisponível.', true);
    return;
  }

  if (btn) btn.disabled = true;
  try {
    const { error } = await client
      .from('pendencias_solicitacoes')
      .update({ responsavel_id: novoRespId || null })
      .eq('id', activeTicket.id);
    if (error) throw error;

    const respObj = staffProfilesCache.find((p) => p.id === novoRespId);
    const respNome = respObj ? respObj.full_name : novoRespId ? novoRespId : 'Não atribuído';
    await registrarComentarioEvento(
      activeTicket.id,
      'ATRIBUICAO',
      novoRespId ? `Responsável atribuído para ${respNome}.` : 'Responsável removido da pendência.'
    );

    activeTicket.responsavel_id = novoRespId || null;
    (window as any).OlymposSignals?.updateTicket?.(activeTicket.id, { responsavel_id: novoRespId || null });
    await carregarComentariosPendencia(activeTicket.id);
    renderTimelineFeed();
    (window as any).OlymposApp?.showToast?.(`Responsável atualizado: ${respNome}`);
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(`Falha ao atribuir responsável: ${err?.message || 'erro'}`, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleEnviarComentario(ev: Event): Promise<void> {
  ev.preventDefault();
  if (!activeTicket) return;
  const input = document.getElementById('timelineNovoComentarioInput') as HTMLTextAreaElement | null;
  const btn = document.getElementById('timelineEnviarComentarioBtn') as HTMLButtonElement | null;
  const texto = (input?.value || '').trim();
  if (!texto) {
    (window as any).OlymposApp?.showToast?.('Digite um comentário ou despacho interno antes de registrar.', true);
    return;
  }

  if (btn) btn.disabled = true;
  try {
    const ok = await registrarComentarioEvento(activeTicket.id, 'COMENTARIO', texto);
    if (!ok) throw new Error('Não foi possível gravar o comentário no Supabase.');
    if (input) input.value = '';
    await carregarComentariosPendencia(activeTicket.id);
    renderTimelineFeed();
    (window as any).OlymposApp?.showToast?.('Comentário interno registrado na timeline!');
  } catch (err: any) {
    (window as any).OlymposApp?.showToast?.(err?.message || 'Erro ao registrar comentário.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function despacharParaDocumento(tipo: 'OFICIO' | 'PORTARIA'): void {
  if (!activeTicket) return;
  const numeroProtocolo = String(activeTicket.numero_protocolo || activeTicket.id || '');
  const solicitante = String(activeTicket.nome || activeTicket.nome_completo || 'Solicitante SMEB');
  const setor = String(activeTicket.setor || 'SMEB');
  const assuntoOriginal = String(activeTicket.assunto_tipo || 'Atendimento de Pendência');
  const justificativa = String(activeTicket.justificativa || activeTicket.descricao || '');

  const ctx: PendingDispatchContext = {
    pendenciaId: activeTicket.id,
    numeroProtocolo,
    destinatario: `${solicitante} — Setor: ${setor}`,
    assunto: `[Protocolo #${numeroProtocolo}] ${assuntoOriginal}`,
    corpoBase:
      `Em atenção à solicitação protocolada sob nº #${numeroProtocolo} (${setor}), apresentada por ${solicitante}, ` +
      `com o seguinte objeto:\n\n${justificativa}`,
    tipo,
    setor,
    solicitanteNome: solicitante,
    criadoEm: new Date().toISOString()
  };

  try {
    sessionStorage.setItem(DISPATCH_CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // ignora restrição de storage
  }
  (window as any).OlymposDispatchContext = ctx;

  closeChamadoTimelineDrawer();

  const targetRoute = tipo === 'OFICIO' ? 'oficios' : 'portarias';
  const router = (window as any).OlymposRouter;
  if (router && typeof router.navegarPara === 'function') {
    router.navegarPara(targetRoute);
  } else {
    window.location.hash = `#${targetRoute}`;
  }
}

export function getPendingDispatchContext(): PendingDispatchContext | null {
  const winCtx = (window as any).OlymposDispatchContext;
  if (winCtx && typeof winCtx === 'object') return winCtx as PendingDispatchContext;
  try {
    const raw = sessionStorage.getItem(DISPATCH_CONTEXT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PendingDispatchContext;
  } catch {
    // ignora
  }
  return null;
}

export function clearPendingDispatchContext(): void {
  delete (window as any).OlymposDispatchContext;
  try {
    sessionStorage.removeItem(DISPATCH_CONTEXT_STORAGE_KEY);
  } catch {
    // ignora
  }
}

/**
 * Helper para vincular um Ofício ou Portaria emitido à pendência de origem (chamado pelo fe-integrator).
 * ZERO envio de e-mail ao solicitante.
 */
export async function registrarVinculoDocumentoNaPendencia(
  pendenciaId: number | string,
  doc: DocumentoVinculadoPayload
): Promise<boolean> {
  if (pendenciaId === undefined || pendenciaId === null || pendenciaId === '') return false;
  const client = getSupabaseClient();
  const safeUrl = sanitizarUrlSegura(doc?.url) || null;
  const numeroStr = doc?.numero ? String(doc.numero) : null;
  let documentoIdBigInt: number | null =
    doc?.documentoId !== undefined && doc?.documentoId !== null && !isNaN(Number(doc.documentoId))
      ? Number(doc.documentoId)
      : null;

  if (client && documentoIdBigInt === null && safeUrl) {
    try {
      const { data: foundDoc } = await client
        .from('documentos_emitidos')
        .select('id')
        .eq('drive_url', safeUrl)
        .limit(1)
        .maybeSingle();
      if (foundDoc && foundDoc.id !== undefined) {
        documentoIdBigInt = Number(foundDoc.id);
      }
    } catch {
      // prossegue salvando número e URL
    }
  }

  const patch: Record<string, any> = {
    documento_vinculado_id: documentoIdBigInt,
    documento_vinculado_numero: numeroStr,
    documento_vinculado_url: safeUrl
  };

  (window as any).OlymposSignals?.updateTicket?.(pendenciaId, patch);
  if (activeTicket && String(activeTicket.id) === String(pendenciaId)) {
    Object.assign(activeTicket, patch);
  }

  if (!client) return true;

  try {
    const { error } = await client
      .from('pendencias_solicitacoes')
      .update(patch)
      .eq('id', pendenciaId);
    if (error) throw error;

    const resumoDoc = numeroStr || safeUrl || (documentoIdBigInt ? `#${documentoIdBigInt}` : 'Documento Oficial');
    await registrarComentarioEvento(
      pendenciaId,
      'DOCUMENTO_VINCULADO',
      `Documento oficial vinculado à pendência: ${resumoDoc}${safeUrl ? ` (${safeUrl})` : ''}.`
    );
    return true;
  } catch (err) {
    console.warn('[TimelineDrawer] Falha ao vincular documento na pendência:', err);
    return false;
  }
}

function ensureTimelineDrawerDom(): HTMLElement {
  let backdrop = document.getElementById('chamadoTimelineDrawer');
  if (backdrop) return backdrop;

  const container = document.getElementById('modal-root') || document.body;
  backdrop = document.createElement('div');
  backdrop.id = 'chamadoTimelineDrawer';
  backdrop.className = 'modal-backdrop onda2-drawer-backdrop hidden';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'timelineDrawerTitle');

  backdrop.innerHTML =
    '<div class="modal-card onda2-drawer-panel">' +
      '<div class="onda2-drawer-header">' +
        '<div>' +
          '<span id="timelineDrawerProtocolo" class="section-eyebrow" style="font-size:10px;">PROTOCOLO</span>' +
          '<h3 id="timelineDrawerTitle" style="margin:2px 0 0; font-size:1.08rem;">Timeline da Pendência</h3>' +
        '</div>' +
        '<button type="button" id="btnFecharTimelineDrawer" class="icon-capsule-btn" aria-label="Fechar timeline da pendência">✕</button>' +
      '</div>' +
      '<div class="onda2-drawer-body">' +
        '<div id="timelineDrawerMeta" class="timeline-meta-grid"></div>' +
        '<div class="output-panel" style="padding:12px;">' +
          '<div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;">Justificativa / Descrição</div>' +
          '<div id="timelineDrawerDescricao" style="font-size:0.84rem; line-height:1.45; white-space:pre-wrap;"></div>' +
          '<div id="timelineDrawerDocVinculado" class="hidden" style="margin-top:8px;"></div>' +
        '</div>' +
        '<div id="timelineTriagemBanner" class="triagem-assistiva-banner"></div>' +
        '<div style="display:flex; gap:8px; align-items:flex-end; flex-wrap:wrap;">' +
          '<div class="field-group" style="flex:1; min-width:200px; margin:0;">' +
            '<label for="timelineResponsavelSelect">Responsável pelo Atendimento</label>' +
            '<select id="timelineResponsavelSelect" class="input-clean"></select>' +
          '</div>' +
          '<button type="button" id="timelineAtribuirBtn" class="btn btn-secondary btn-sm">Atribuir Responsável</button>' +
        '</div>' +
        '<div class="timeline-dispatch-actions">' +
          '<button type="button" id="timelineGerarOficioBtn" class="btn btn-primary btn-sm">Gerar Ofício a partir desta Pendência</button>' +
          '<button type="button" id="timelineGerarPortariaBtn" class="btn btn-secondary btn-sm">Gerar Portaria a partir desta Pendência</button>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:0.78rem; font-weight:700; margin-bottom:8px;">Linha do Tempo Interna</div>' +
          '<div id="timelineEventosFeed" class="timeline-feed"></div>' +
        '</div>' +
        '<form id="timelineComentarioForm" style="display:flex; flex-direction:column; gap:8px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">' +
            '<label for="timelineNovoComentarioInput" style="font-size:0.78rem; font-weight:700;">Novo Comentário / Despacho Interno</label>' +
            '<button type="button" id="timelineInserirSnippetBtn" class="btn btn-ghost btn-sm">Inserir da Biblioteca</button>' +
          '</div>' +
          '<textarea id="timelineNovoComentarioInput" rows="3" class="input-clean" placeholder="Registre andamento, análise técnica ou despacho interno (não envia e-mail ao solicitante)..."></textarea>' +
          '<div style="display:flex; justify-content:flex-end;">' +
            '<button type="submit" id="timelineEnviarComentarioBtn" class="btn btn-primary btn-sm">Registrar Comentário</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';

  container.appendChild(backdrop);

  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeChamadoTimelineDrawer();
  });

  document.getElementById('btnFecharTimelineDrawer')?.addEventListener('click', closeChamadoTimelineDrawer);
  document.getElementById('timelineAtribuirBtn')?.addEventListener('click', () => {
    void handleAtribuirResponsavel();
  });
  document.getElementById('timelineGerarOficioBtn')?.addEventListener('click', () => {
    despacharParaDocumento('OFICIO');
  });
  document.getElementById('timelineGerarPortariaBtn')?.addEventListener('click', () => {
    despacharParaDocumento('PORTARIA');
  });
  document.getElementById('timelineComentarioForm')?.addEventListener('submit', (ev) => {
    void handleEnviarComentario(ev);
  });
  document.getElementById('timelineInserirSnippetBtn')?.addEventListener('click', () => {
    void openSnippetsDrawer({
      categoriaInicial: 'RESPOSTA_PENDENCIA',
      onInsert: (result) => {
        const ta = document.getElementById('timelineNovoComentarioInput') as HTMLTextAreaElement | null;
        if (!ta) return;
        const prefix = ta.value.trim() ? `${ta.value.trim()}\n\n` : '';
        ta.value = `${prefix}${result.textoInterpolado}`;
        ta.focus();
      }
    });
  });

  return backdrop;
}

export async function openChamadoTimelineDrawer(ticketOrId: any): Promise<void> {
  const resolved = resolverTicketAtual(ticketOrId);
  if (!resolved) return;
  activeTicket = resolved;

  const backdrop = ensureTimelineDrawerDom();
  renderDetalhesTicket();
  backdrop.classList.remove('hidden');

  const feedEl = document.getElementById('timelineEventosFeed');
  if (feedEl) {
    feedEl.innerHTML = '<div class="output-panel" style="padding:12px; font-size:0.8rem;">Carregando linha do tempo...</div>';
  }

  await Promise.all([
    carregarStaffProfiles(),
    carregarComentariosPendencia(resolved.id)
  ]);

  renderResponsavelSelect();
  renderTimelineFeed();
}

export function closeChamadoTimelineDrawer(): void {
  const backdrop = document.getElementById('chamadoTimelineDrawer');
  if (backdrop) backdrop.classList.add('hidden');
}

export const OlymposChamadosTimeline = {
  open: openChamadoTimelineDrawer,
  close: closeChamadoTimelineDrawer,
  getPendingDispatchContext,
  clearPendingDispatchContext,
  registrarVinculoDocumentoNaPendencia
};

if (typeof window !== 'undefined') {
  (window as any).OlymposChamadosTimeline = OlymposChamadosTimeline;
}
