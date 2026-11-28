import '../styles/onda8.css';

interface QuotaModelInfo {
  modelo: string;
  usadas: number;
  soft_cap: number;
  hard_cap: number;
  rpm_limit?: number;
  tpm_limit?: number;
  erros_429: number;
}

interface IaStatusPayload {
  schemaReady: boolean;
  flags: {
    oraculo_generativo_ativo: boolean;
    prometheus_catalogacao_ia_ativo: boolean;
    triagem_assistiva_ativo: boolean;
    permitir_visitante_ia: boolean;
  };
  gemma: QuotaModelInfo;
  flash: QuotaModelInfo;
  embedding: QuotaModelInfo;
}

function esc(val: unknown): string {
  const app = (window as any).OlymposApp;
  if (app && typeof app.escapeHtml === 'function') {
    return app.escapeHtml(String(val ?? ''));
  }
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg: string, isErr = false): void {
  const app = (window as any).OlymposApp;
  if (app && typeof app.showToast === 'function') {
    app.showToast(msg, isErr);
  }
}

async function fetchStatusCotas(): Promise<IaStatusPayload> {
  const supa = (window as any).OlymposSupabase;
  const fallback: IaStatusPayload = {
    schemaReady: false,
    flags: {
      oraculo_generativo_ativo: true,
      prometheus_catalogacao_ia_ativo: true,
      triagem_assistiva_ativo: true,
      permitir_visitante_ia: false
    },
    gemma: { modelo: 'gemma-4-31b-it', usadas: 0, soft_cap: 10200, hard_cap: 12000, rpm_limit: 25, tpm_limit: 14000, erros_429: 0 },
    flash: { modelo: 'gemini-3.5-flash-lite', usadas: 0, soft_cap: 340, hard_cap: 400, rpm_limit: 10, tpm_limit: 200000, erros_429: 0 },
    embedding: { modelo: 'gemini-embedding-2-preview', usadas: 0, soft_cap: 680, hard_cap: 800, rpm_limit: 75, tpm_limit: 25000, erros_429: 0 }
  };

  if (!supa || typeof supa.obterStatusCotasIa !== 'function') {
    return fallback;
  }

  try {
    const res = await supa.obterStatusCotasIa();
    if (res && res.ok) {
      return {
        schemaReady: true,
        flags: {
          oraculo_generativo_ativo: res.flags?.oraculo_generativo_ativo !== false,
          prometheus_catalogacao_ia_ativo: res.flags?.prometheus_catalogacao_ia_ativo !== false,
          triagem_assistiva_ativo: res.flags?.triagem_assistiva_ativo !== false,
          permitir_visitante_ia: Boolean(res.flags?.permitir_visitante_ia)
        },
        gemma: res.modelos?.['gemma-4-31b-it'] || fallback.gemma,
        flash: res.modelos?.['gemini-3.5-flash-lite'] || fallback.flash,
        embedding: res.modelos?.['gemini-embedding-2-preview'] || fallback.embedding
      };
    }
  } catch {
    // pre-migration 043
  }
  return fallback;
}

function renderBar(label: string, badge: string, info: QuotaModelInfo): string {
  const hard = Math.max(1, Number(info.hard_cap || 1));
  const usadas = Math.max(0, Number(info.usadas || 0));
  const pct = Math.min(100, Math.round((usadas / hard) * 100));
  const rpmLabel = info.rpm_limit ? `${info.rpm_limit} RPM` : '--';
  const tpmLabel = info.tpm_limit ? `${Math.round(info.tpm_limit / 1000)}k TPM` : '--';
  return `
    <div class="ia-quota-card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <strong style="font-size:0.9rem;">${esc(label)}</strong>
        <span class="pill-badge pill-purple" style="font-size:0.7rem;">${esc(badge)}</span>
      </div>
      <div class="ia-quota-bar-track">
        <div class="ia-quota-bar-fill" style="width:${pct}%;"></div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-secondary);">
        <span><strong>${usadas}</strong> / ${hard.toLocaleString('pt-BR')} RPD</span>
        <span>Soft-cap: ${Number(info.soft_cap).toLocaleString('pt-BR')} • 429s: ${Number(info.erros_429 || 0)}</span>
      </div>
      <div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">Janela: ${esc(rpmLabel)} • ${esc(tpmLabel)}</div>
    </div>
  `;
}

function renderPanel(root: HTMLElement, st: IaStatusPayload): void {
  const aviso = st.schemaReady
    ? ''
    : `<div class="output-panel output-warning" style="margin-bottom:12px; font-size:0.82rem;">
         Migrations <code>042</code> e <code>043</code> ainda não aplicadas no Supabase remoto. Exibindo leitura padrão (toggles serão habilitados após executar os scripts SQL).
       </div>`;

  root.innerHTML = `
    <div class="ia-gov-panel">
      <div class="card-header-row" style="margin-bottom:10px;">
        <div>
          <span class="section-eyebrow">ONDA 12 • GOVERNANÇA DE IA HÍBRIDA (MODO MODERADOR)</span>
          <h3 class="section-title" style="font-size:1.12rem;">Cotas Diárias RPD / RPM / TPM &amp; Controles de IA</h3>
          <p class="section-desc" style="margin-bottom:0;">Limites oficiais: Gemma 4 31B (25 RPM • 14k TPM • 12k RPD), Gemini 3.5 Flash Lite (10 RPM • 200k TPM • 400 RPD) e Gemini Embedding 2 (75 RPM • 25k TPM • 800 RPD).</p>
        </div>
        <button type="button" id="btnIaRecarregarCotas" class="btn btn-secondary btn-sm">Atualizar Cotas</button>
      </div>
      ${aviso}
      <div class="ia-quota-grid">
        ${renderBar('Gemma 4 31B', '25 RPM • 14k TPM • 12k RPD', st.gemma)}
        ${renderBar('Gemini 3.5 Flash Lite', '10 RPM • 200k TPM • 400 RPD', st.flash)}
        ${renderBar('Gemini Embedding 2', '75 RPM • 25k TPM • 800 RPD', st.embedding)}
      </div>
      <div class="ia-flags-grid">
        <label class="ia-flag-item">
          <span>Oráculo Generativo (Autenticados)</span>
          <input type="checkbox" class="ia-flag-toggle" data-flag="oraculo_generativo_ativo" ${st.flags.oraculo_generativo_ativo ? 'checked' : ''} ${!st.schemaReady ? 'disabled' : ''} />
        </label>
        <label class="ia-flag-item">
          <span>Catalogação Gemma no Prometheus</span>
          <input type="checkbox" class="ia-flag-toggle" data-flag="prometheus_catalogacao_ia_ativo" ${st.flags.prometheus_catalogacao_ia_ativo ? 'checked' : ''} ${!st.schemaReady ? 'disabled' : ''} />
        </label>
        <label class="ia-flag-item">
          <span>Assistente Briefing / Triagem</span>
          <input type="checkbox" class="ia-flag-toggle" data-flag="triagem_assistiva_ativo" ${st.flags.triagem_assistiva_ativo ? 'checked' : ''} ${!st.schemaReady ? 'disabled' : ''} />
        </label>
        <label class="ia-flag-item">
          <span>Liberar Síntese IA a Visitantes</span>
          <input type="checkbox" class="ia-flag-toggle" data-flag="permitir_visitante_ia" ${st.flags.permitir_visitante_ia ? 'checked' : ''} ${!st.schemaReady ? 'disabled' : ''} />
        </label>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <button type="button" id="btnIaRecatalogarRecentes" class="btn btn-primary btn-sm">Recatalogar Publicações Recentes com Gemma 4 31B</button>
        <span id="iaGovStatusMsg" style="font-size:0.8rem; color:var(--text-muted);"></span>
      </div>
    </div>
  `;

  const btnRefresh = root.querySelector<HTMLButtonElement>('#btnIaRecarregarCotas');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      void mountIaGovernancaAdmin(root.id);
    });
  }

  root.querySelectorAll<HTMLInputElement>('.ia-flag-toggle').forEach((chk) => {
    chk.addEventListener('change', async () => {
      const supa = (window as any).OlymposSupabase;
      const key = chk.getAttribute('data-flag') || '';
      if (!key || !supa || typeof supa.atualizarFeatureFlagsIa !== 'function') return;
      try {
        await supa.atualizarFeatureFlagsIa({ [key]: chk.checked });
        toast(`Flag IA "${key}" atualizada.`);
      } catch (err: any) {
        toast(`Falha ao atualizar flag IA: ${err?.message || 'erro'}`, true);
        chk.checked = !chk.checked;
      }
    });
  });

  const btnRecat = root.querySelector<HTMLButtonElement>('#btnIaRecatalogarRecentes');
  const statusMsg = root.querySelector<HTMLElement>('#iaGovStatusMsg');
  if (btnRecat) {
    btnRecat.addEventListener('click', async () => {
      const supa = (window as any).OlymposSupabase;
      const cfg = supa?.getConfig?.();
      const baseUrl = String(cfg?.url || 'https://rbwizevjvbvjwtbwwyif.supabase.co').replace(/\/+$/, '');
      const anonKey = String(cfg?.anonKey || '');
      const sess = (window as any).OlymposApp?.getSession?.();
      const jwt = String(sess?.access_token || sess?.token || '');
      if (!jwt) {
        toast('Sessão autenticada de Moderador necessária.', true);
        return;
      }
      btnRecat.disabled = true;
      if (statusMsg) statusMsg.textContent = 'Processando lote recente com Gemma 4 31B...';
      try {
        const resp = await fetch(`${baseUrl}/functions/v1/ia-assistente`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(anonKey ? { apikey: anonKey } : {}),
            Authorization: `Bearer ${jwt}`
          },
          body: JSON.stringify({ modo: 'recatalogar_recentes' })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) {
          toast(`Recatalogação concluída: ${data.recatalogados || 0} ato(s) enriquecido(s)!`);
          if (statusMsg) statusMsg.textContent = `Analisados: ${data.totalAnalisados || 0} • Atualizados: ${data.recatalogados || 0}`;
          void mountIaGovernancaAdmin(root.id);
        } else {
          toast(data?.mensagem || `Erro HTTP ${resp.status}`, true);
          if (statusMsg) statusMsg.textContent = data?.mensagem || '';
        }
      } catch (err: any) {
        toast(`Edge Function ia-assistente indisponível: ${err?.message || 'rede'}`, true);
      } finally {
        btnRecat.disabled = false;
      }
    });
  }
}

export async function mountIaGovernancaAdmin(containerId = 'iaGovernancaPanelRoot'): Promise<void> {
  const root = document.getElementById(containerId);
  if (!root) return;

  const app = (window as any).OlymposApp;
  const rbac = (window as any).OlymposRbac;
  const isMod = Boolean((app && typeof app.isModerador === 'function' && app.isModerador()) || (rbac && rbac.isModerador?.()));
  if (!isMod) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = '<div style="padding:14px; font-size:0.84rem; color:var(--text-muted);">Carregando cotas de IA e feature flags...</div>';
  const status = await fetchStatusCotas();
  renderPanel(root, status);
}

export default mountIaGovernancaAdmin;
