/**
 * Onda 3 — Cartão "Telegram Institucional (Alertas & Consultas)" para #configuracoes.
 * Gerencia pareamento de uso único via RPC `gerar_token_pareamento_telegram()`,
 * vínculo em `public.telegram_vinculos`, preferências de alertas, envio de teste
 * via Edge Function `notification-dispatcher` e desvinculação.
 */

import '../styles/onda3.css';

export interface TelegramPreferencias {
  pendencias: boolean;
  femurn: boolean;
  prazos: boolean;
  anomalias: boolean;
}

export interface TelegramVinculoRow {
  id: string;
  user_id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  ativo: boolean;
  preferencias_json: Partial<TelegramPreferencias> | null;
  vinculado_em: string;
}

export const TELEGRAM_BOT_USERNAME = 'HubOlympos_bot';

const DEFAULT_PREFS: TelegramPreferencias = {
  pendencias: true,
  femurn: true,
  prazos: true,
  anomalias: false
};

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

export function buildTelegramPairLink(token: string): string {
  const clean = String(token || '').trim();
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${encodeURIComponent(clean)}`;
}

function normalizePrefs(raw: Partial<TelegramPreferencias> | null | undefined): TelegramPreferencias {
  return {
    pendencias: raw?.pendencias !== false,
    femurn: raw?.femurn !== false,
    prazos: raw?.prazos !== false,
    anomalias: raw?.anomalias === true
  };
}

async function getCurrentUserIdAndToken(): Promise<{ userId: string; accessToken: string } | null> {
  const sess = await window.OlymposSupabase?.getSession?.();
  if (sess?.user?.id) {
    return {
      userId: String(sess.user.id),
      accessToken: String(sess.access_token || '')
    };
  }
  const appSess = window.OlymposApp?.getSession?.();
  if (appSess?.user?.id) {
    return {
      userId: String(appSess.user.id),
      accessToken: String(appSess.access_token || appSess.token || '')
    };
  }
  return null;
}

export function mountTelegramConfig(containerId: string): void {
  const root = document.getElementById(containerId);
  if (!root) return;

  const uidPrefix = `tg_${containerId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  let currentVinculo: TelegramVinculoRow | null = null;
  let currentPairToken = '';
  let currentPairExpiry = '';
  let currentPrefs: TelegramPreferencias = { ...DEFAULT_PREFS };
  let statusFeedback = '';
  let statusError = false;

  root.innerHTML =
    `<div class="telegram-config-card" id="${uidPrefix}-card">` +
      `<div class="telegram-status-row">` +
        `<div>` +
          `<span class="section-eyebrow" style="font-size: 10px;">ALERTAS &amp; CONSULTAS RÁPIDAS • ZERO PII</span>` +
          `<h3 style="margin: 2px 0 4px; font-size: 1.08rem;">Telegram Institucional (Alertas &amp; Consultas)</h3>` +
          `<p class="section-desc" style="margin: 0; font-size: 12.5px;">Receba alertas de prazos, pendências e Radar FEMURN ou consulte protocolos via <code>/status &lt;PROTOCOLO&gt;</code> e <code>/pendentes</code>.</p>` +
        `</div>` +
        `<span id="${uidPrefix}-status-badge" class="pill-badge pill-gray">Verificando vínculo...</span>` +
      `</div>` +

      `<div id="${uidPrefix}-linked-meta" class="output-panel hidden" style="font-size: 12.5px; margin-bottom: 12px;"></div>` +

      `<div id="${uidPrefix}-pair-box" class="telegram-pair-box hidden">` +
        `<div style="font-size: 12.5px; font-weight: 600; color: var(--text-primary);">` +
          `Token gerado (uso único • validade 10 minutos):` +
        `</div>` +
        `<div class="telegram-pair-link-row">` +
          `<input type="text" id="${uidPrefix}-pair-url-input" class="telegram-pair-url" readonly aria-label="Link de pareamento do bot Telegram" />` +
          `<button type="button" id="${uidPrefix}-copy-link-btn" class="btn btn-secondary btn-sm">Copiar Link</button>` +
          `<a id="${uidPrefix}-open-bot-link" href="https://t.me/OlymposSMEBBot" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Abrir Bot ↗</a>` +
        `</div>` +
        `<div id="${uidPrefix}-pair-hint" style="font-size: 11.5px; color: var(--text-secondary);"></div>` +
      `</div>` +

      `<div class="telegram-prefs-grid" role="group" aria-label="Preferências de alertas do Telegram">` +
        `<label class="telegram-pref-item">` +
          `<input type="checkbox" id="${uidPrefix}-pref-pendencias" checked />` +
          `<span><strong>Pendências</strong><br><small class="text-muted">Novos chamados urgentes e atribuições</small></span>` +
        `</label>` +
        `<label class="telegram-pref-item">` +
          `<input type="checkbox" id="${uidPrefix}-pref-femurn" checked />` +
          `<span><strong>FEMURN</strong><br><small class="text-muted">Atos do Radar Preditivo no Diário Oficial</small></span>` +
        `</label>` +
        `<label class="telegram-pref-item">` +
          `<input type="checkbox" id="${uidPrefix}-pref-prazos" checked />` +
          `<span><strong>Prazos</strong><br><small class="text-muted">Alertas preventivos de vencimento (48h / 24h)</small></span>` +
        `</label>` +
        `<label class="telegram-pref-item">` +
          `<input type="checkbox" id="${uidPrefix}-pref-anomalias" />` +
          `<span><strong>Anomalias</strong><br><small class="text-muted">Auditoria operacional e integridade DR</small></span>` +
        `</label>` +
      `</div>` +

      `<div class="telegram-actions-row">` +
        `<button type="button" id="${uidPrefix}-connect-btn" class="btn btn-primary btn-sm">Conectar Telegram</button>` +
        `<button type="button" id="${uidPrefix}-refresh-btn" class="btn btn-ghost btn-sm">Atualizar Status</button>` +
        `<button type="button" id="${uidPrefix}-test-btn" class="btn btn-secondary btn-sm">Enviar mensagem de teste</button>` +
        `<button type="button" id="${uidPrefix}-unlink-btn" class="btn btn-danger btn-sm hidden">Desvincular conta</button>` +
      `</div>` +
      `<div id="${uidPrefix}-feedback" style="font-size: 12px; margin-top: 10px;" aria-live="polite"></div>` +
    `</div>`;

  const statusBadge = document.getElementById(`${uidPrefix}-status-badge`);
  const linkedMeta = document.getElementById(`${uidPrefix}-linked-meta`);
  const pairBox = document.getElementById(`${uidPrefix}-pair-box`);
  const pairUrlInput = document.getElementById(`${uidPrefix}-pair-url-input`) as HTMLInputElement | null;
  const openBotLink = document.getElementById(`${uidPrefix}-open-bot-link`) as HTMLAnchorElement | null;
  const pairHint = document.getElementById(`${uidPrefix}-pair-hint`);
  const feedbackEl = document.getElementById(`${uidPrefix}-feedback`);

  const chkPendencias = document.getElementById(`${uidPrefix}-pref-pendencias`) as HTMLInputElement | null;
  const chkFemurn = document.getElementById(`${uidPrefix}-pref-femurn`) as HTMLInputElement | null;
  const chkPrazos = document.getElementById(`${uidPrefix}-pref-prazos`) as HTMLInputElement | null;
  const chkAnomalias = document.getElementById(`${uidPrefix}-pref-anomalias`) as HTMLInputElement | null;

  const connectBtn = document.getElementById(`${uidPrefix}-connect-btn`) as HTMLButtonElement | null;
  const refreshBtn = document.getElementById(`${uidPrefix}-refresh-btn`) as HTMLButtonElement | null;
  const testBtn = document.getElementById(`${uidPrefix}-test-btn`) as HTMLButtonElement | null;
  const unlinkBtn = document.getElementById(`${uidPrefix}-unlink-btn`) as HTMLButtonElement | null;
  const copyBtn = document.getElementById(`${uidPrefix}-copy-link-btn`) as HTMLButtonElement | null;

  function renderState(): void {
    if (statusBadge) {
      if (!currentVinculo) {
        statusBadge.className = 'pill-badge pill-gray';
        statusBadge.textContent = 'Não vinculado';
      } else if (currentVinculo.ativo) {
        statusBadge.className = 'pill-badge pill-green';
        statusBadge.textContent = currentVinculo.telegram_username
          ? `Vinculado (@${currentVinculo.telegram_username})`
          : 'Vinculado e Ativo';
      } else {
        statusBadge.className = 'pill-badge pill-amber';
        statusBadge.textContent = 'Vinculado (Silenciado)';
      }
    }

    if (linkedMeta) {
      if (currentVinculo) {
        const dtFmt = currentVinculo.vinculado_em
          ? new Date(currentVinculo.vinculado_em).toLocaleString('pt-BR')
          : '--';
        const userHandle = currentVinculo.telegram_username ? `@${currentVinculo.telegram_username}` : 'Chat privado';
        linkedMeta.innerHTML =
          `<strong>Conta conectada:</strong> ${esc(userHandle)} • ` +
          `Chat ID: <code>${esc(currentVinculo.telegram_chat_id)}</code> • ` +
          `Vinculado em: <span>${esc(dtFmt)}</span> • ` +
          `Estado: <strong>${currentVinculo.ativo ? 'Notificações Ativas' : 'Silenciado (/ativar para retomar)'}</strong>`;
        linkedMeta.classList.remove('hidden');
      } else {
        linkedMeta.classList.add('hidden');
      }
    }

    if (pairBox) {
      if (currentPairToken) {
        const url = buildTelegramPairLink(currentPairToken);
        if (pairUrlInput) pairUrlInput.value = url;
        if (openBotLink) openBotLink.href = url;
        if (pairHint) {
          const expFmt = currentPairExpiry ? new Date(currentPairExpiry).toLocaleTimeString('pt-BR') : '10 minutos';
          pairHint.innerHTML = `Comando direto: <code>/start ${esc(currentPairToken)}</code> • Expira às ${esc(expFmt)}. Após enviar no Telegram, clique em <strong>Atualizar Status</strong>.`;
        }
        pairBox.classList.remove('hidden');
      } else {
        pairBox.classList.add('hidden');
      }
    }

    if (chkPendencias) chkPendencias.checked = currentPrefs.pendencias;
    if (chkFemurn) chkFemurn.checked = currentPrefs.femurn;
    if (chkPrazos) chkPrazos.checked = currentPrefs.prazos;
    if (chkAnomalias) chkAnomalias.checked = currentPrefs.anomalias;

    if (unlinkBtn) unlinkBtn.classList.toggle('hidden', !currentVinculo);
    if (testBtn) testBtn.disabled = !currentVinculo;

    if (feedbackEl) {
      feedbackEl.textContent = statusFeedback;
      feedbackEl.style.color = statusError ? 'var(--danger)' : 'var(--text-secondary)';
    }
  }

  async function carregarVinculo(): Promise<void> {
    const client = window.OlymposSupabase?.getClient?.();
    const authInfo = await getCurrentUserIdAndToken();
    if (!client || !authInfo) {
      currentVinculo = null;
      statusFeedback = 'Faça login institucional para vincular seu Telegram.';
      statusError = false;
      renderState();
      return;
    }

    try {
      const { data, error } = await client
        .from('telegram_vinculos')
        .select('id,user_id,telegram_chat_id,telegram_username,ativo,preferencias_json,vinculado_em')
        .eq('user_id', authInfo.userId)
        .maybeSingle();

      if (error) {
        statusFeedback = `Aviso ao consultar vínculo Telegram: ${error.message}`;
        statusError = true;
      } else if (data) {
        currentVinculo = data as TelegramVinculoRow;
        currentPrefs = normalizePrefs(currentVinculo.preferencias_json);
        currentPairToken = '';
        statusFeedback = '';
        statusError = false;
      } else {
        currentVinculo = null;
        statusFeedback = 'Nenhuma conta Telegram vinculada a este perfil.';
        statusError = false;
      }
    } catch (err: any) {
      statusFeedback = `Falha ao consultar telegram_vinculos: ${err?.message || 'erro'}`;
      statusError = true;
    }
    renderState();
  }

  async function gerarTokenPareamento(): Promise<void> {
    const client = window.OlymposSupabase?.getClient?.();
    const authInfo = await getCurrentUserIdAndToken();
    if (!client || !authInfo) {
      window.OlymposApp?.showToast?.('Autentique-se antes de conectar o Telegram.', true);
      return;
    }

    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.textContent = 'Gerando token...';
    }
    try {
      const { data, error } = await client.rpc('gerar_token_pareamento_telegram');
      if (error) throw error;
      const token = String(data?.token || '').trim();
      if (!token) throw new Error('Token de pareamento não retornado pelo servidor.');
      currentPairToken = token;
      currentPairExpiry = String(data?.expira_em || '');
      statusFeedback = 'Link de pareamento gerado! Abra o bot e envie /start para concluir.';
      statusError = false;
      renderState();
    } catch (err: any) {
      statusFeedback = `Falha ao gerar token: ${err?.message || 'erro'}`;
      statusError = true;
      renderState();
      window.OlymposApp?.showToast?.(statusFeedback, true);
    } finally {
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Conectar Telegram';
      }
    }
  }

  async function salvarPreferencias(): Promise<void> {
    currentPrefs = {
      pendencias: Boolean(chkPendencias?.checked),
      femurn: Boolean(chkFemurn?.checked),
      prazos: Boolean(chkPrazos?.checked),
      anomalias: Boolean(chkAnomalias?.checked)
    };

    if (!currentVinculo) return;
    const client = window.OlymposSupabase?.getClient?.();
    const authInfo = await getCurrentUserIdAndToken();
    if (!client || !authInfo) return;

    try {
      const { error } = await client
        .from('telegram_vinculos')
        .update({ preferencias_json: currentPrefs })
        .eq('user_id', authInfo.userId);
      if (error) throw error;
      currentVinculo.preferencias_json = { ...currentPrefs };
      statusFeedback = 'Preferências de alerta atualizadas.';
      statusError = false;
      renderState();
    } catch (err: any) {
      statusFeedback = `Erro ao salvar preferências: ${err?.message || 'erro'}`;
      statusError = true;
      renderState();
    }
  }

  async function enviarMensagemTeste(): Promise<void> {
    const client = window.OlymposSupabase?.getClient?.();
    const authInfo = await getCurrentUserIdAndToken();
    if (!client || !authInfo) {
      window.OlymposApp?.showToast?.('Autentique-se para enviar mensagem de teste.', true);
      return;
    }

    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = 'Enviando teste...';
    }
    try {
      const payload = {
        evento: 'AVISO_GESTOR',
        canal: 'telegram',
        teste: true,
        user_id: authInfo.userId,
        titulo: 'Teste Telegram Institucional • Hub Olympos',
        mensagem: 'Conexão validada com sucesso pela tela de Ajustes do Hub Olympos (SMEB Ceará-Mirim/RN).'
      };

      let resultData: any = null;
      if (client.functions && typeof client.functions.invoke === 'function') {
        const { data, error } = await client.functions.invoke('notification-dispatcher', {
          body: payload
        });
        if (error) throw error;
        resultData = data;
      } else {
        const cfg = window.OlymposSupabase?.getConfig?.();
        const url = `${String(cfg?.url || '').replace(/\/+$/, '')}/functions/v1/notification-dispatcher`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg?.anonKey || '',
            Authorization: `Bearer ${authInfo.accessToken}`
          },
          body: JSON.stringify(payload)
        });
        resultData = await resp.json();
        if (!resp.ok) throw new Error(resultData?.mensagem || `HTTP ${resp.status}`);
      }

      const enviados = Number(resultData?.enviados || 0);
      if (enviados > 0) {
        statusFeedback = 'Mensagem de teste enviada para seu Telegram!';
        statusError = false;
        window.OlymposApp?.showToast?.(statusFeedback);
      } else {
        statusFeedback = 'Despacho processado (verifique se o bot token está configurado no servidor e o chat está ativo).';
        statusError = false;
      }
      renderState();
    } catch (err: any) {
      statusFeedback = `Falha no envio de teste: ${err?.message || 'erro'}`;
      statusError = true;
      renderState();
      window.OlymposApp?.showToast?.(statusFeedback, true);
    } finally {
      if (testBtn) {
        testBtn.disabled = !currentVinculo;
        testBtn.textContent = 'Enviar mensagem de teste';
      }
    }
  }

  async function desvincularConta(): Promise<void> {
    if (!currentVinculo) return;
    if (typeof window.confirm === 'function' && !window.confirm('Deseja desvincular sua conta Telegram do Hub Olympos?')) {
      return;
    }

    const client = window.OlymposSupabase?.getClient?.();
    const authInfo = await getCurrentUserIdAndToken();
    if (!client || !authInfo) return;

    if (unlinkBtn) unlinkBtn.disabled = true;
    try {
      const { error } = await client
        .from('telegram_vinculos')
        .delete()
        .eq('user_id', authInfo.userId);
      if (error) throw error;
      currentVinculo = null;
      currentPairToken = '';
      statusFeedback = 'Conta Telegram desvinculada com sucesso.';
      statusError = false;
      window.OlymposApp?.showToast?.(statusFeedback);
      renderState();
    } catch (err: any) {
      statusFeedback = `Erro ao desvincular conta: ${err?.message || 'erro'}`;
      statusError = true;
      renderState();
    } finally {
      if (unlinkBtn) unlinkBtn.disabled = false;
    }
  }

  connectBtn?.addEventListener('click', () => {
    void gerarTokenPareamento();
  });
  refreshBtn?.addEventListener('click', () => {
    void carregarVinculo();
  });
  testBtn?.addEventListener('click', () => {
    void enviarMensagemTeste();
  });
  unlinkBtn?.addEventListener('click', () => {
    void desvincularConta();
  });
  copyBtn?.addEventListener('click', () => {
    if (!currentPairToken) return;
    const link = buildTelegramPairLink(currentPairToken);
    if (window.OlymposApp && typeof window.OlymposApp.copiarTexto === 'function') {
      window.OlymposApp.copiarTexto(link, 'Link de pareamento Telegram');
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
  });

  [chkPendencias, chkFemurn, chkPrazos, chkAnomalias].forEach((chk) => {
    chk?.addEventListener('change', () => {
      void salvarPreferencias();
    });
  });

  renderState();
  void carregarVinculo();
}

if (typeof window !== 'undefined') {
  (window as any).OlymposTelegramConfig = {
    mount: mountTelegramConfig,
    buildTelegramPairLink
  };
}
