/**
 * Onda 1 (Sprint 1.3 — Item 1.2): Modo Painel de Gabinete (Kiosk / TV 16:9).
 * Regra LGPD estrita: ZERO PII em qualquer quadrante (apenas protocolo, setor, assunto, status e SLA).
 */

import '../styles/kiosk.css';
import kioskHtml from '../templates/pages/kiosk.html?raw';
import { sanitizarTextoSeguroParaTv } from './comunicacao/kioskSanitizer';

export const routeId = 'kiosk';
export const htmlTemplate = kioskHtml;

const REFRESH_INTERVAL_MS = 120000;

interface KioskCachedState {
  prazos: Array<{
    numero_protocolo: string;
    setor: string;
    assunto_tipo: string;
    status: string;
    urgencia: boolean;
    auto_promovido_urgencia: boolean;
    data_limite_entrega: string | null;
    sla_estimado_entrega: string | null;
  }>;
  femurn: Array<{
    data_publicacao: string;
    edicao: string;
    ato_tipo: string;
    titulo: string;
  }>;
  agenda: Array<{
    data_inicio: string;
    horario: string | null;
    titulo: string;
    setor: string;
    local: string | null;
  }>;
  mural: Array<{
    id: number;
    titulo: string;
    resumo: string | null;
    tipo: string;
    publicado_em: string;
  }>;
  telemetria: {
    oficios: number;
    portarias: number;
    pendenciasAbertas: number;
    slaPct: number;
  };
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;
let wakeLockSentinel: any = null;
let hashListenerBound = false;
let lastGoodData: KioskCachedState | null = null;

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

function formatarDataCurta(iso: string | null | undefined): string {
  if (!iso) return 'Hoje';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return String(iso);
}

function atualizarRelogio(): void {
  const el = document.getElementById('kioskClock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function solicitarWakeLock(): Promise<void> {
  const pill = document.getElementById('kioskWakeLockPill');
  try {
    const nav = navigator as any;
    if (nav && nav.wakeLock && typeof nav.wakeLock.request === 'function') {
      wakeLockSentinel = await nav.wakeLock.request('screen');
      if (pill) pill.textContent = 'Tela Ativa: Wake Lock';
      wakeLockSentinel?.addEventListener?.('release', () => {
        if (pill) pill.textContent = 'Tela Ativa: Liberado';
      });
    }
  } catch {
    if (pill) pill.textContent = 'Tela Ativa: Sistema';
  }
}

function liberarWakeLock(): void {
  try {
    if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
      void wakeLockSentinel.release();
    }
  } catch {}
  wakeLockSentinel = null;
}

function sairModoKiosk(): void {
  document.body.classList.remove('kiosk-mode-active');
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
  liberarWakeLock();
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    document.exitFullscreen().catch(() => {});
  }
}

function renderizarQuadrantes(st: KioskCachedState): void {
  const prazosEl = document.getElementById('kioskPrazosList');
  const femurnEl = document.getElementById('kioskFemurnList');
  const agendaEl = document.getElementById('kioskAgendaList');

  if (prazosEl) {
    if (st.prazos.length === 0) {
      prazosEl.innerHTML = '<div class="kiosk-card-sub">Nenhuma pendência aberta na fila operacional.</div>';
    } else {
      prazosEl.innerHTML = st.prazos
        .map((p) => {
          const isUrgent = Boolean(p.urgencia || p.auto_promovido_urgencia);
          const prazo = p.data_limite_entrega ? formatarDataCurta(p.data_limite_entrega) : (p.sla_estimado_entrega || 'Expediente');
          return (
            `<div class="kiosk-card-row${isUrgent ? ' is-urgent' : ''}">` +
              '<div>' +
                `<div class="kiosk-card-main">${esc(p.numero_protocolo)} • ${esc(p.assunto_tipo)}</div>` +
                `<div class="kiosk-card-sub">Setor: ${esc(p.setor)} • Status: ${esc(p.status)}</div>` +
              '</div>' +
              `<span class="kiosk-status-pill${isUrgent ? ' is-warning' : ''}">${isUrgent ? 'URGENTE • ' : ''}${esc(prazo)}</span>` +
            '</div>'
          );
        })
        .join('');
    }
  }

  if (femurnEl) {
    if (st.femurn.length === 0) {
      femurnEl.innerHTML = '<div class="kiosk-card-sub">Sem atos FEMURN recentes indexados.</div>';
    } else {
      femurnEl.innerHTML = st.femurn
        .map((f) => (
          '<div class="kiosk-card-row">' +
            '<div>' +
              `<div class="kiosk-card-main">${esc(f.titulo)}</div>` +
              `<div class="kiosk-card-sub">${esc(f.ato_tipo)} • Edição ${esc(f.edicao || '--')}</div>` +
            '</div>' +
            `<span class="kiosk-status-pill">${esc(formatarDataCurta(f.data_publicacao))}</span>` +
          '</div>'
        ))
        .join('');
    }
  }

  if (agendaEl) {
    const agendaRows = st.agenda
      .map((a) => (
        '<div class="kiosk-card-row">' +
          '<div>' +
            `<div class="kiosk-card-main">${esc(a.titulo)}</div>` +
            `<div class="kiosk-card-sub">${esc(a.setor)}${a.local ? ` • ${esc(a.local)}` : ''}</div>` +
          '</div>' +
          `<span class="kiosk-status-pill">${esc(formatarDataCurta(a.data_inicio))}${a.horario ? ` ${esc(a.horario)}` : ''}</span>` +
        '</div>'
      ));

    const muralRows = (st.mural || [])
      .map((m) => {
        const tituloSeguro = sanitizarTextoSeguroParaTv(m.titulo, 90);
        const resumoSeguro = sanitizarTextoSeguroParaTv(m.resumo, 110);
        return (
          '<div class="kiosk-card-row">' +
            '<div>' +
              `<div class="kiosk-card-main">${esc(tituloSeguro)}</div>` +
              `<div class="kiosk-card-sub">Mural SMEB${resumoSeguro ? ` • ${esc(resumoSeguro)}` : ''}</div>` +
            '</div>' +
            `<span class="kiosk-status-pill">${esc(m.tipo || 'COMUNICADO')}</span>` +
          '</div>'
        );
      });

    const combined = [...agendaRows, ...muralRows];
    if (combined.length === 0) {
      agendaEl.innerHTML = '<div class="kiosk-card-sub">Nenhum compromisso próximo na Agenda Intersetorial ou Mural.</div>';
    } else {
      agendaEl.innerHTML = combined.join('');
    }
  }

  const elOf = document.getElementById('kioskKpiOficios');
  const elPt = document.getElementById('kioskKpiPortarias');
  const elPd = document.getElementById('kioskKpiPendencias');
  const elSla = document.getElementById('kioskKpiSlaRate');

  if (elOf) elOf.textContent = String(st.telemetria.oficios);
  if (elPt) elPt.textContent = String(st.telemetria.portarias);
  if (elPd) elPd.textContent = String(st.telemetria.pendenciasAbertas);
  if (elSla) elSla.textContent = `${st.telemetria.slaPct}%`;
}

async function atualizarPainelKiosk(): Promise<void> {
  const statusEl = document.getElementById('kioskSyncStatus');
  const client = window.OlymposSupabase?.getClient?.();

  if (!client) {
    if (statusEl) {
      statusEl.textContent = 'Modo offline — aguardando conexão Supabase';
      statusEl.classList.add('is-warning');
    }
    if (lastGoodData) renderizarQuadrantes(lastGoodData);
    return;
  }

  try {
    const hojeIso = new Date().toISOString().slice(0, 10);

    const [resPend, resFemurn, resAgenda, resMural, resOficiosCount, resPortariasCount, resAllPendCount, resResolvedCount] = await Promise.all([
      // Consulta estritamente não-pessoal: apenas protocolo, setor, assunto, status e prazo
      client
        .from('pendencias_solicitacoes')
        .select('numero_protocolo,setor,assunto_tipo,status,urgencia,auto_promovido_urgencia,data_limite_entrega,sla_estimado_entrega')
        .in('status', ['PENDENTE', 'EM_ANDAMENTO'])
        .order('urgencia', { ascending: false })
        .order('data_limite_entrega', { ascending: true, nullsFirst: false })
        .limit(6),
      client
        .from('publicacoes_diario')
        .select('data_publicacao,edicao,ato_tipo,titulo')
        .order('data_publicacao', { ascending: false })
        .limit(5),
      client
        .from('calendario_agenda')
        .select('data_inicio,horario,titulo,setor,local')
        .gte('data_inicio', hojeIso)
        .order('data_inicio', { ascending: true })
        .limit(4),
      client
        .from('mural_publicacoes')
        .select('id,titulo,resumo,tipo,publicado_em')
        .eq('escopo', 'GERAL_SMEB')
        .eq('exibir_no_kiosk', true)
        .is('arquivado_em', null)
        .order('fixado', { ascending: false })
        .order('publicado_em', { ascending: false })
        .limit(3),
      client
        .from('documentos_emitidos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'OFICIO'),
      client
        .from('documentos_emitidos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'PORTARIA'),
      client
        .from('pendencias_solicitacoes')
        .select('id', { count: 'exact', head: true }),
      client
        .from('pendencias_solicitacoes')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'RESOLVIDO')
    ]);

    const anyFatalError = Boolean(resPend.error && resFemurn.error && resAgenda.error);
    if (anyFatalError) {
      throw new Error('Falha nas consultas principais do painel.');
    }

    const totalPend = typeof resAllPendCount.count === 'number' ? resAllPendCount.count : 0;
    const totalResolv = typeof resResolvedCount.count === 'number' ? resResolvedCount.count : 0;
    const prazosList = Array.isArray(resPend.data) ? resPend.data : (lastGoodData?.prazos || []);

    const nextState: KioskCachedState = {
      prazos: prazosList,
      femurn: Array.isArray(resFemurn.data) ? resFemurn.data : (lastGoodData?.femurn || []),
      agenda: Array.isArray(resAgenda.data) ? resAgenda.data : (lastGoodData?.agenda || []),
      mural: Array.isArray(resMural.data) ? resMural.data : (lastGoodData?.mural || []),
      telemetria: {
        oficios: typeof resOficiosCount.count === 'number' ? resOficiosCount.count : (lastGoodData?.telemetria.oficios || 0),
        portarias: typeof resPortariasCount.count === 'number' ? resPortariasCount.count : (lastGoodData?.telemetria.portarias || 0),
        pendenciasAbertas: prazosList.length,
        slaPct: totalPend > 0 ? Math.round((totalResolv / totalPend) * 100) : 100
      }
    };

    lastGoodData = nextState;
    renderizarQuadrantes(nextState);

    if (statusEl) {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      statusEl.textContent = `Última atualização: ${hora}`;
      statusEl.classList.remove('is-warning');
    }
  } catch {
    if (statusEl) {
      statusEl.textContent = 'Modo contingência — mantendo último painel';
      statusEl.classList.add('is-warning');
    }
    if (lastGoodData) renderizarQuadrantes(lastGoodData);
  }
}

export async function mount(): Promise<void> {
  document.body.classList.add('kiosk-mode-active');
  atualizarRelogio();

  if (clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(atualizarRelogio, 1000);

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    void atualizarPainelKiosk();
  }, REFRESH_INTERVAL_MS);

  await solicitarWakeLock();
  void atualizarPainelKiosk();

  document.getElementById('kioskRefreshNowBtn')?.addEventListener('click', () => {
    void atualizarPainelKiosk();
  });

  document.getElementById('kioskFullscreenBtn')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  document.getElementById('kioskExitBtn')?.addEventListener('click', () => {
    sairModoKiosk();
    window.OlymposRouter?.navegarPara?.('visao-geral');
  });

  if (!hashListenerBound) {
    hashListenerBound = true;
    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '').trim();
      if (h !== 'kiosk') {
        sairModoKiosk();
      }
    });
    document.addEventListener('visibilitychange', () => {
      const h = window.location.hash.replace('#', '').trim();
      if (h === 'kiosk' && document.visibilityState === 'visible') {
        void solicitarWakeLock();
      }
    });
  }
}
