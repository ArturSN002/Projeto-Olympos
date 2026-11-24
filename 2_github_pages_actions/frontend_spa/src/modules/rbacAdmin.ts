import '../styles/onda7.css';
import OlymposRbac, {
  CATALOGO_PERMISSOES,
  MATRIZ_PADRAO,
  SETORES_MAP,
  SETORES_ORGANIZACIONAIS,
  inferirCargoPorRoleLegado,
  inferirSetorPorRoleLegado,
  type PermissaoCatalogoItem
} from '../core/rbacEngine';

type SubtabKey = 'operadores' | 'matriz' | 'overrides' | 'numeracao';

interface MatrizMap {
  [setor: string]: {
    ENCARREGADO: Record<string, boolean>;
    MEMBRO: Record<string, boolean>;
  };
}

let activeSubtab: SubtabKey = 'matriz';
let selectedSetorMatriz = 'GABINETE';
let schemaReady = false;
let catalogoLista: PermissaoCatalogoItem[] = [...CATALOGO_PERMISSOES];
let perfisLista: any[] = [];
let overridesLista: any[] = [];
let matrizEstado: MatrizMap = buildMatrizFallback();
let dirtySetorMap: Record<string, boolean> = {};
let numeracaoData: { oficios: any[]; portaria: any | null } = buildNumeracaoFallback();

function buildMatrizFallback(): MatrizMap {
  const out: MatrizMap = {};
  for (const s of SETORES_ORGANIZACIONAIS) {
    if (s.codigo === 'MODERADOR') continue;
    out[s.codigo] = { ENCARREGADO: {}, MEMBRO: {} };
    const padrao = MATRIZ_PADRAO[s.codigo];
    for (const p of CATALOGO_PERMISSOES) {
      out[s.codigo].ENCARREGADO[p.codigo] = Boolean(padrao?.ENCARREGADO.has(p.codigo));
      out[s.codigo].MEMBRO[p.codigo] = Boolean(padrao?.MEMBRO.has(p.codigo));
    }
  }
  return out;
}

function buildNumeracaoFallback(): { oficios: any[]; portaria: any | null } {
  const oficios = SETORES_ORGANIZACIONAIS.filter((s) => s.codigo !== 'MODERADOR').map((s) => ({
    tipo_documento: 'OFICIO',
    ano: 2026,
    setor_codigo: s.codigo,
    setor_nome: s.nome,
    sigla_documento: s.siglaOficio,
    proximo_numero: s.pisoOficio2026,
    ultimo_numero: Math.max(0, s.pisoOficio2026 - 1)
  }));
  const portaria = {
    tipo_documento: 'PORTARIA',
    ano: 2026,
    setor_codigo: 'GABINETE',
    setor_nome: 'Gabinete da Secretaria',
    sigla_documento: 'SMEB',
    proximo_numero: 163,
    ultimo_numero: 162
  };
  return { oficios, portaria };
}

function esc(val: any): string {
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

function toast(msg: string, isError = false): void {
  const app = (window as any).OlymposApp;
  if (app && typeof app.showToast === 'function') {
    app.showToast(msg, isError);
  }
}

async function carregarDadosCompletos(): Promise<void> {
  const supa = (window as any).OlymposSupabase;
  schemaReady = false;
  matrizEstado = buildMatrizFallback();
  dirtySetorMap = {};
  numeracaoData = buildNumeracaoFallback();
  overridesLista = [];

  if (!supa) return;

  try {
    if (typeof supa.listarPerfisUsuarios === 'function') {
      const perf = await supa.listarPerfisUsuarios();
      if (Array.isArray(perf)) perfisLista = perf;
    }
  } catch {
    perfisLista = [];
  }

  try {
    const [catRows, matRows] = await Promise.all([
      typeof supa.listarPermissoesCatalogo === 'function' ? supa.listarPermissoesCatalogo() : null,
      typeof supa.listarMatrizSetorCargo === 'function' ? supa.listarMatrizSetorCargo() : null
    ]);

    if (Array.isArray(catRows) && catRows.length > 0) {
      catalogoLista = catRows.map((r: any) => ({
        codigo: String(r.codigo),
        grupo: String(r.grupo),
        rotulo: String(r.rotulo),
        descricao: String(r.descricao || ''),
        rotaPagina: r.rota_pagina || null,
        exclusivoGabinete: Boolean(r.exclusivo_gabinete),
        somenteModerador: Boolean(r.somente_moderador),
        requerAal2: Boolean(r.requer_aal2),
        ordem: Number(r.ordem || 0)
      }));
    }

    if (Array.isArray(matRows) && matRows.length > 0) {
      schemaReady = true;
      for (const row of matRows) {
        const sc = String(row.setor_codigo || '').toUpperCase();
        const cs = String(row.cargo_setor || '').toUpperCase() as 'ENCARREGADO' | 'MEMBRO';
        const perm = String(row.permissao_codigo || '');
        if (matrizEstado[sc] && (cs === 'ENCARREGADO' || cs === 'MEMBRO') && perm) {
          matrizEstado[sc][cs][perm] = Boolean(row.permitido);
        }
      }
    }
  } catch {
    schemaReady = false;
  }

  if (schemaReady) {
    try {
      if (typeof supa.listarOverridesUsuario === 'function') {
        const ov = await supa.listarOverridesUsuario();
        if (Array.isArray(ov)) overridesLista = ov;
      }
    } catch {
      overridesLista = [];
    }

    try {
      if (typeof supa.listarNumeracaoVisivel === 'function') {
        const num = await supa.listarNumeracaoVisivel(2026);
        if (num && num.ok) {
          numeracaoData = {
            oficios: Array.isArray(num.oficios) ? num.oficios : buildNumeracaoFallback().oficios,
            portaria: num.portaria || buildNumeracaoFallback().portaria
          };
        }
      }
    } catch {
      // keep fallback
    }
  }
}

function renderOperadoresHierarquia(): string {
  const setoresOp = SETORES_ORGANIZACIONAIS.filter((s) => s.codigo !== 'MODERADOR');
  const candidatos = perfisLista.filter((u) => {
    const setorU = inferirSetorPorRoleLegado(u.role, u.setor_codigo);
    const cargoU = inferirCargoPorRoleLegado(u.role, u.cargo_setor);
    return setorU !== 'MODERADOR' && cargoU !== 'MODERADOR' && u.ativo !== false;
  });

  const cardsHtml = setoresOp
    .map((s) => {
      const usuariosSetor = perfisLista.filter(
        (u) => inferirSetorPorRoleLegado(u.role, u.setor_codigo) === s.codigo
      );
      const enc = usuariosSetor.find(
        (u) => inferirCargoPorRoleLegado(u.role, u.cargo_setor) === 'ENCARREGADO' && u.ativo !== false
      );
      const membrosCount = usuariosSetor.filter(
        (u) => inferirCargoPorRoleLegado(u.role, u.cargo_setor) !== 'ENCARREGADO'
      ).length;

      const optionsCandidatos = candidatos
        .map((u) => {
          const curSetor = inferirSetorPorRoleLegado(u.role, u.setor_codigo);
          const sel = enc && enc.id === u.id ? ' selected' : '';
          return `<option value="${esc(u.id)}"${sel}>${esc(u.full_name || u.email)} (${esc(curSetor)})</option>`;
        })
        .join('');

      return `
        <div class="rbac-num-card">
          <div class="rbac-num-head">
            <div>
              <div style="font-weight:700; font-size:0.92rem; color:var(--text-primary);">${esc(s.nome)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">Sigla Ofícios: <strong>${esc(s.siglaOficio)}</strong> • Membros: ${membrosCount}</div>
            </div>
            <span class="setor-pill ${enc ? 'is-encarregado' : ''}">${enc ? 'Com Encarregado' : 'Sem Encarregado'}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--text-secondary);">
            Encarregado atual: <strong>${enc ? esc(enc.full_name || enc.email) : 'Não designado'}</strong>
          </div>
          <div class="rbac-num-actions">
            <select class="input-clean rbac-enc-select" data-setor="${esc(s.codigo)}" style="font-size:0.78rem; padding:6px 8px; flex:1;" ${!schemaReady || candidatos.length === 0 ? 'disabled' : ''}>
              <option value="">Selecionar operador...</option>
              ${optionsCandidatos}
            </select>
            <button type="button" class="btn btn-secondary btn-sm rbac-btn-set-encarregado" data-setor="${esc(s.codigo)}" ${!schemaReady || candidatos.length === 0 ? 'disabled' : ''}>
              Definir Encarregado
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="rbac-toolbar">
      <div style="font-size:0.84rem; color:var(--text-secondary);">
        Estrutura oficial dos <strong>9 setores operacionais</strong> (além do Moderador único). Cada setor possui no máximo 1 Encarregado ativo; ao promover um novo Encarregado, o anterior passa automaticamente a Membro.
      </div>
    </div>
    <div class="rbac-num-grid">${cardsHtml}</div>
  `;
}

function renderMatrizDinamica(): string {
  const setoresOp = SETORES_ORGANIZACIONAIS.filter((s) => s.codigo !== 'MODERADOR');
  const setorObj = SETORES_MAP[selectedSetorMatriz] || setoresOp[0];
  const mat = matrizEstado[selectedSetorMatriz] || { ENCARREGADO: {}, MEMBRO: {} };
  const isDirty = Boolean(dirtySetorMap[selectedSetorMatriz]);

  const setorOptions = setoresOp
    .map(
      (s) =>
        `<option value="${esc(s.codigo)}"${s.codigo === selectedSetorMatriz ? ' selected' : ''}>${esc(s.nome)} (${esc(s.siglaOficio)})</option>`
    )
    .join('');

  const copyOptions = setoresOp
    .filter((s) => s.codigo !== selectedSetorMatriz)
    .map((s) => `<option value="${esc(s.codigo)}">${esc(s.nome)}</option>`)
    .join('');

  const grupos = new Map<string, PermissaoCatalogoItem[]>();
  for (const item of catalogoLista) {
    if (!grupos.has(item.grupo)) grupos.set(item.grupo, []);
    grupos.get(item.grupo)!.push(item);
  }

  let rowsHtml = '';
  grupos.forEach((itens, grupoNome) => {
    rowsHtml += `<tr class="rbac-group-row"><td colspan="3">${esc(grupoNome)} (${itens.length})</td></tr>`;
    for (const perm of itens) {
      const lockedMod = perm.somenteModerador;
      const lockedGab = perm.exclusivoGabinete && selectedSetorMatriz !== 'GABINETE';
      const isLocked = lockedMod || lockedGab || !schemaReady;

      const encChecked = !lockedMod && !lockedGab && Boolean(mat.ENCARREGADO[perm.codigo]);
      const memChecked = !lockedMod && !lockedGab && Boolean(mat.MEMBRO[perm.codigo]);

      const badges: string[] = [];
      if (lockedMod) badges.push('<span class="rbac-lock-badge">Exclusivo Moderador</span>');
      else if (perm.exclusivoGabinete) {
        badges.push(
          `<span class="rbac-lock-badge">${lockedGab ? 'Bloqueado (Exclusivo Gabinete)' : 'Exclusivo Gabinete'}</span>`
        );
      }
      if (perm.requerAal2) {
        badges.push('<span class="pill-badge pill-purple" style="font-size:0.66rem;">MFA aal2</span>');
      }

      rowsHtml += `
        <tr>
          <td>
            <div class="rbac-perm-title">${esc(perm.rotulo)} ${badges.join(' ')}</div>
            <div class="rbac-perm-code">${esc(perm.codigo)}${perm.rotaPagina ? ` • #${esc(perm.rotaPagina)}` : ''}</div>
            <div class="rbac-perm-desc">${esc(perm.descricao)}</div>
          </td>
          <td style="text-align:center; width:115px;">
            <input type="checkbox" class="rbac-toggle-check rbac-matrix-toggle"
              aria-label="Encarregado — ${esc(perm.rotulo)}"
              data-cargo="ENCARREGADO" data-perm="${esc(perm.codigo)}"
              ${encChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''} />
          </td>
          <td style="text-align:center; width:115px;">
            <input type="checkbox" class="rbac-toggle-check rbac-matrix-toggle"
              aria-label="Membro — ${esc(perm.rotulo)}"
              data-cargo="MEMBRO" data-perm="${esc(perm.codigo)}"
              ${memChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''} />
          </td>
        </tr>
      `;
    }
  });

  return `
    <div class="rbac-toolbar">
      <div class="rbac-toolbar-group">
        <label for="rbacMatrizSetorSelect" style="font-size:0.8rem; font-weight:600; color:var(--text-secondary);">Setor:</label>
        <select id="rbacMatrizSetorSelect" class="input-clean" style="min-width:240px;">${setorOptions}</select>
        <select id="rbacCopiarSetorSelect" class="input-clean" style="min-width:190px;" ${!schemaReady ? 'disabled' : ''}>
          <option value="">Copiar permissões de...</option>
          ${copyOptions}
        </select>
        <button type="button" id="rbacBtnCopiarSetor" class="btn btn-secondary btn-sm" ${!schemaReady ? 'disabled' : ''}>Aplicar Cópia</button>
      </div>
      <div class="rbac-toolbar-group">
        <button type="button" id="rbacBtnRestaurarSetor" class="btn btn-secondary btn-sm" ${!schemaReady ? 'disabled' : ''}>Restaurar Padrão</button>
        <button type="button" id="rbacBtnSalvarMatriz" class="btn btn-primary btn-sm" ${!schemaReady ? 'disabled' : ''}>
          ${isDirty ? 'Salvar Alterações *' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">
      Editando <strong>${esc(setorObj.nome)}</strong> (${catalogoLista.length} chaves em 8 grupos). Portarias e Gestão de Usuários mantêm travas estruturais de governança.
    </div>
    <div class="rbac-matrix-wrap">
      <table class="rbac-matrix-table">
        <thead>
          <tr>
            <th>Permissão / Escopo</th>
            <th style="text-align:center;">Encarregado</th>
            <th style="text-align:center;">Membro</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function renderOverrides(): string {
  const operadoresNaoMod = perfisLista.filter((u) => {
    const setorU = inferirSetorPorRoleLegado(u.role, u.setor_codigo);
    return setorU !== 'MODERADOR';
  });

  const userOptions = operadoresNaoMod
    .map((u) => {
      const setorU = inferirSetorPorRoleLegado(u.role, u.setor_codigo);
      return `<option value="${esc(u.id)}" data-setor="${esc(setorU)}">${esc(u.full_name || u.email)} — ${esc(setorU)}</option>`;
    })
    .join('');

  const permOptions = catalogoLista
    .filter((p) => !p.somenteModerador)
    .map((p) => `<option value="${esc(p.codigo)}">[${esc(p.grupo)}] ${esc(p.rotulo)} (${esc(p.codigo)})</option>`)
    .join('');

  const rowsHtml =
    overridesLista.length === 0
      ? `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhuma exceção individual ativa no momento.</td></tr>`
      : overridesLista
          .map((ov) => {
            const usr = perfisLista.find((u) => u.id === ov.user_id);
            const permInfo = catalogoLista.find((p) => p.codigo === ov.permissao_codigo);
            const expStr = ov.expira_em ? new Date(ov.expira_em).toLocaleString('pt-BR') : 'Sem expiração';
            return `
              <tr>
                <td>
                  <div style="font-weight:600;">${esc(usr?.full_name || usr?.email || ov.user_id)}</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">${esc(usr?.email || '')}</div>
                </td>
                <td>
                  <div style="font-weight:600;">${esc(permInfo?.rotulo || ov.permissao_codigo)}</div>
                  <div style="font-family:var(--font-mono); font-size:0.74rem; color:var(--text-muted);">${esc(ov.permissao_codigo)}</div>
                </td>
                <td>
                  <span class="pill-badge ${ov.permitido ? 'pill-green' : 'pill-red'}" style="font-size:0.72rem;">
                    ${ov.permitido ? 'Concedido (+)' : 'Revogado (-)'}
                  </span>
                </td>
                <td>
                  <div style="font-size:0.82rem;">${esc(ov.motivo || '--')}</div>
                  <div style="font-size:0.74rem; color:var(--text-muted);">Validade: ${esc(expStr)}</div>
                </td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn-danger btn-sm rbac-btn-remove-ov"
                    data-uid="${esc(ov.user_id)}" data-perm="${esc(ov.permissao_codigo)}" ${!schemaReady ? 'disabled' : ''}>
                    Remover
                  </button>
                </td>
              </tr>
            `;
          })
          .join('');

  return `
    <div style="padding:14px 16px; border:1px solid var(--border-hairline); border-radius:12px; background:var(--bg-surface); margin-bottom:16px;">
      <div style="font-weight:700; margin-bottom:10px; font-size:0.92rem;">Registrar Exceção Individual (Override)</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:10px;">
        <select id="rbacOvUsuario" class="input-clean" ${!schemaReady || operadoresNaoMod.length === 0 ? 'disabled' : ''}>
          <option value="">Selecionar operador...</option>
          ${userOptions}
        </select>
        <select id="rbacOvPerm" class="input-clean" ${!schemaReady ? 'disabled' : ''}>
          <option value="">Selecionar permissão...</option>
          ${permOptions}
        </select>
        <select id="rbacOvPermitido" class="input-clean" ${!schemaReady ? 'disabled' : ''}>
          <option value="true">Conceder permissão (+)</option>
          <option value="false">Revogar permissão (-)</option>
        </select>
        <input id="rbacOvExpira" type="datetime-local" class="input-clean" title="Expiração opcional" ${!schemaReady ? 'disabled' : ''} />
      </div>
      <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
        <input id="rbacOvMotivo" type="text" class="input-clean" style="flex:1; min-width:240px;" placeholder="Justificativa formal obrigatória (mín. 5 caracteres)..." ${!schemaReady ? 'disabled' : ''} />
        <button type="button" id="rbacBtnSalvarOverride" class="btn btn-primary btn-sm" ${!schemaReady ? 'disabled' : ''}>Aplicar Exceção</button>
      </div>
    </div>
    <div class="rbac-matrix-wrap">
      <table class="rbac-matrix-table">
        <thead>
          <tr>
            <th>Operador</th>
            <th>Permissão</th>
            <th>Efeito</th>
            <th>Justificativa / Validade</th>
            <th style="text-align:right;">Ação</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

function renderNumeracaoSetorial(): string {
  const port = numeracaoData.portaria;
  const portCard = port
    ? `
      <div class="rbac-num-card is-portaria">
        <div class="rbac-num-head">
          <div>
            <div style="font-weight:700; font-size:0.92rem;">Portarias 2026 — Gabinete</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Exclusivo Gabinete + Moderador • Sigla: <strong>${esc(port.sigla_documento || 'SMEB')}</strong></div>
          </div>
          <span class="pill-badge pill-purple" style="font-size:0.7rem;">Portarias</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">Último emitido: <strong>${esc(port.ultimo_numero ?? 0)}</strong></div>
        <div class="rbac-num-actions">
          <input type="number" min="1" class="input-clean rbac-num-input" data-tipo="PORTARIA" data-setor="GABINETE" value="${esc(port.proximo_numero ?? 163)}" style="width:100px;" ${!schemaReady ? 'disabled' : ''} />
          <button type="button" class="btn btn-primary btn-sm rbac-btn-save-num" data-tipo="PORTARIA" data-setor="GABINETE" ${!schemaReady ? 'disabled' : ''}>Salvar Próximo Nº</button>
        </div>
      </div>
    `
    : '';

  const oficiosCards = (numeracaoData.oficios || [])
    .map(
      (n: any) => `
      <div class="rbac-num-card">
        <div class="rbac-num-head">
          <div>
            <div style="font-weight:700; font-size:0.9rem;">${esc(n.setor_nome || n.setor_codigo)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Pasta: Ofícios 2026 - <strong>${esc(n.sigla_documento || '')}</strong></div>
          </div>
          <span class="setor-pill">${esc(n.sigla_documento || 'OF')}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary);">Último emitido: <strong>${esc(n.ultimo_numero ?? 0)}</strong></div>
        <div class="rbac-num-actions">
          <input type="number" min="1" class="input-clean rbac-num-input" data-tipo="OFICIO" data-setor="${esc(n.setor_codigo)}" value="${esc(n.proximo_numero ?? 1)}" style="width:100px;" ${!schemaReady ? 'disabled' : ''} />
          <button type="button" class="btn btn-secondary btn-sm rbac-btn-save-num" data-tipo="OFICIO" data-setor="${esc(n.setor_codigo)}" ${!schemaReady ? 'disabled' : ''}>Salvar Próximo Nº</button>
        </div>
      </div>
    `
    )
    .join('');

  return `
    <div style="font-size:0.84rem; color:var(--text-secondary); margin-bottom:14px;">
      Controle global dos contadores de 2026. Gabinete inicia Ofícios em <strong>155</strong> (<code>GS</code>) e Portarias em <strong>163</strong> (<code>SMEB</code>); os outros 8 setores iniciam Ofícios próprios em <strong>001/2026</strong>.
    </div>
    <div class="rbac-num-grid">
      ${portCard}
      ${oficiosCards}
    </div>
  `;
}

function bindEvents(root: HTMLElement): void {
  const supa = (window as any).OlymposSupabase;

  root.querySelectorAll<HTMLButtonElement>('.rbac-subtab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-rbac-tab') as SubtabKey;
      if (next) {
        activeSubtab = next;
        render(root);
      }
    });
  });

  const selMatriz = root.querySelector<HTMLSelectElement>('#rbacMatrizSetorSelect');
  if (selMatriz) {
    selMatriz.addEventListener('change', () => {
      selectedSetorMatriz = selMatriz.value;
      render(root);
    });
  }

  root.querySelectorAll<HTMLInputElement>('.rbac-matrix-toggle').forEach((chk) => {
    chk.addEventListener('change', () => {
      const cargo = chk.getAttribute('data-cargo') as 'ENCARREGADO' | 'MEMBRO';
      const perm = chk.getAttribute('data-perm') || '';
      if (!matrizEstado[selectedSetorMatriz]) return;
      matrizEstado[selectedSetorMatriz][cargo][perm] = chk.checked;
      dirtySetorMap[selectedSetorMatriz] = true;
      const btnSave = root.querySelector<HTMLButtonElement>('#rbacBtnSalvarMatriz');
      if (btnSave) btnSave.textContent = 'Salvar Alterações *';
    });
  });

  const btnCopy = root.querySelector<HTMLButtonElement>('#rbacBtnCopiarSetor');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const srcSel = root.querySelector<HTMLSelectElement>('#rbacCopiarSetorSelect');
      const src = srcSel?.value || '';
      if (!src || !matrizEstado[src]) {
        toast('Selecione um setor de origem para copiar.', true);
        return;
      }
      const targetMat = matrizEstado[selectedSetorMatriz];
      const srcMat = matrizEstado[src];
      for (const perm of catalogoLista) {
        if (perm.somenteModerador) continue;
        if (perm.exclusivoGabinete && selectedSetorMatriz !== 'GABINETE') continue;
        targetMat.ENCARREGADO[perm.codigo] = Boolean(srcMat.ENCARREGADO[perm.codigo]);
        targetMat.MEMBRO[perm.codigo] = Boolean(srcMat.MEMBRO[perm.codigo]);
      }
      dirtySetorMap[selectedSetorMatriz] = true;
      render(root);
      toast(`Permissões copiadas de ${src} para pré-visualização. Clique em Salvar Alterações para gravar.`);
    });
  }

  const btnSaveMatriz = root.querySelector<HTMLButtonElement>('#rbacBtnSalvarMatriz');
  if (btnSaveMatriz) {
    btnSaveMatriz.addEventListener('click', async () => {
      if (!supa || typeof supa.salvarPermissoesSetorCargo !== 'function') return;
      btnSaveMatriz.disabled = true;
      try {
        const cur = matrizEstado[selectedSetorMatriz];
        await supa.salvarPermissoesSetorCargo(selectedSetorMatriz, 'ENCARREGADO', cur.ENCARREGADO);
        await supa.salvarPermissoesSetorCargo(selectedSetorMatriz, 'MEMBRO', cur.MEMBRO);
        delete dirtySetorMap[selectedSetorMatriz];
        await OlymposRbac.carregarContextoAcesso(true);
        toast(`Matriz de ${SETORES_MAP[selectedSetorMatriz]?.nome || selectedSetorMatriz} salva com sucesso!`);
        render(root);
      } catch (err: any) {
        toast(`Falha ao salvar matriz: ${err?.message || 'erro desconhecido'}`, true);
        btnSaveMatriz.disabled = false;
      }
    });
  }

  const btnRestore = root.querySelector<HTMLButtonElement>('#rbacBtnRestaurarSetor');
  if (btnRestore) {
    btnRestore.addEventListener('click', async () => {
      if (!supa || typeof supa.restaurarPadraoSetor !== 'function') return;
      if (!confirm(`Restaurar todas as permissões de ${selectedSetorMatriz} ao padrão Onda 7?`)) return;
      btnRestore.disabled = true;
      try {
        await supa.restaurarPadraoSetor(selectedSetorMatriz);
        await carregarDadosCompletos();
        toast(`Padrão de ${selectedSetorMatriz} restaurado!`);
        render(root);
      } catch (err: any) {
        toast(`Falha ao restaurar padrão: ${err?.message || 'erro desconhecido'}`, true);
        btnRestore.disabled = false;
      }
    });
  }

  root.querySelectorAll<HTMLButtonElement>('.rbac-btn-set-encarregado').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const setorCod = btn.getAttribute('data-setor') || '';
      const sel = root.querySelector<HTMLSelectElement>(`.rbac-enc-select[data-setor="${setorCod}"]`);
      const targetUid = sel?.value || '';
      if (!targetUid) {
        toast('Selecione um operador para promover a Encarregado.', true);
        return;
      }
      if (!supa || typeof supa.definirEncarregadoSetor !== 'function') return;
      btn.disabled = true;
      try {
        await supa.definirEncarregadoSetor(setorCod, targetUid);
        toast(`Encarregado do setor ${setorCod} atualizado com sucesso!`);
        await carregarDadosCompletos();
        render(root);
        (window as any).OlymposViews?.configuracoes?.carregarUsuarios?.();
      } catch (err: any) {
        toast(`Erro ao definir Encarregado: ${err?.message || 'erro desconhecido'}`, true);
        btn.disabled = false;
      }
    });
  });

  const btnSaveOv = root.querySelector<HTMLButtonElement>('#rbacBtnSalvarOverride');
  if (btnSaveOv) {
    btnSaveOv.addEventListener('click', async () => {
      const uid = root.querySelector<HTMLSelectElement>('#rbacOvUsuario')?.value || '';
      const perm = root.querySelector<HTMLSelectElement>('#rbacOvPerm')?.value || '';
      const permitido = (root.querySelector<HTMLSelectElement>('#rbacOvPermitido')?.value || 'true') === 'true';
      const expRaw = root.querySelector<HTMLInputElement>('#rbacOvExpira')?.value || '';
      const motivo = (root.querySelector<HTMLInputElement>('#rbacOvMotivo')?.value || '').trim();

      if (!uid || !perm) {
        toast('Selecione operador e permissão.', true);
        return;
      }
      if (motivo.length < 5) {
        toast('Informe justificativa formal com no mínimo 5 caracteres.', true);
        return;
      }
      if (!supa || typeof supa.salvarOverrideUsuario !== 'function') return;
      btnSaveOv.disabled = true;
      try {
        const expIso = expRaw ? new Date(expRaw).toISOString() : null;
        await supa.salvarOverrideUsuario(uid, perm, permitido, motivo, expIso);
        toast('Exceção individual registrada com auditoria!');
        await carregarDadosCompletos();
        render(root);
      } catch (err: any) {
        toast(`Falha ao salvar exceção: ${err?.message || 'erro desconhecido'}`, true);
        btnSaveOv.disabled = false;
      }
    });
  }

  root.querySelectorAll<HTMLButtonElement>('.rbac-btn-remove-ov').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const uid = btn.getAttribute('data-uid') || '';
      const perm = btn.getAttribute('data-perm') || '';
      if (!uid || !perm || !supa || typeof supa.removerOverrideUsuario !== 'function') return;
      btn.disabled = true;
      try {
        await supa.removerOverrideUsuario(uid, perm);
        toast('Exceção individual removida.');
        await carregarDadosCompletos();
        render(root);
      } catch (err: any) {
        toast(`Falha ao remover exceção: ${err?.message || 'erro desconhecido'}`, true);
        btn.disabled = false;
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>('.rbac-btn-save-num').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tipo = btn.getAttribute('data-tipo') || 'OFICIO';
      const setor = btn.getAttribute('data-setor') || 'GABINETE';
      const inp = root.querySelector<HTMLInputElement>(`.rbac-num-input[data-tipo="${tipo}"][data-setor="${setor}"]`);
      const val = Number(inp?.value || 0);
      if (!Number.isInteger(val) || val < 1) {
        toast('Informe um número inteiro maior ou igual a 1.', true);
        return;
      }
      if (!supa || typeof supa.ajustarContadorDocumento !== 'function') return;
      btn.disabled = true;
      try {
        await supa.ajustarContadorDocumento(tipo, setor, val, 2026, 'Ajuste painel Moderador Onda 7');
        toast(`Contador ${tipo} (${setor}) ajustado para ${String(val).padStart(3, '0')}/2026.`);
        await carregarDadosCompletos();
        render(root);
      } catch (err: any) {
        toast(`Erro ao ajustar contador: ${err?.message || 'erro desconhecido'}`, true);
        btn.disabled = false;
      }
    });
  });
}

function render(root: HTMLElement): void {
  const banner = schemaReady
    ? ''
    : `<div class="rbac-status-banner is-warning">
         <div>
           <strong>Migrations Onda 7 pendentes no Supabase remoto:</strong> execute os scripts SQL <code>038</code> a <code>041</code> no SQL Editor para habilitar edição ao vivo da matriz, overrides e numeração setorial.
         </div>
         <span class="pill-badge pill-amber" style="font-size:0.72rem;">Prévia Local</span>
       </div>`;

  let bodyHtml = '';
  if (activeSubtab === 'operadores') bodyHtml = renderOperadoresHierarquia();
  else if (activeSubtab === 'matriz') bodyHtml = renderMatrizDinamica();
  else if (activeSubtab === 'overrides') bodyHtml = renderOverrides();
  else bodyHtml = renderNumeracaoSetorial();

  root.innerHTML = `
    <div class="rbac-admin-panel">
      <div style="margin-bottom:14px;">
        <span class="section-eyebrow">ONDA 7 • GOVERNANÇA GRANULAR</span>
        <h4 style="margin:2px 0 4px; font-size:1.08rem;">Hierarquia dos 10 Setores, Matriz de Permissões &amp; Numeração Setorial</h4>
      </div>
      ${banner}
      <div class="rbac-subtabs" role="tablist" aria-label="Governança RBAC Onda 7">
        <button type="button" class="rbac-subtab-btn${activeSubtab === 'matriz' ? ' active' : ''}" data-rbac-tab="matriz">Matriz de Permissões (9×45)</button>
        <button type="button" class="rbac-subtab-btn${activeSubtab === 'operadores' ? ' active' : ''}" data-rbac-tab="operadores">Setores &amp; Encarregados</button>
        <button type="button" class="rbac-subtab-btn${activeSubtab === 'overrides' ? ' active' : ''}" data-rbac-tab="overrides">Exceções Individuais (${overridesLista.length})</button>
        <button type="button" class="rbac-subtab-btn${activeSubtab === 'numeracao' ? ' active' : ''}" data-rbac-tab="numeracao">Numeração Setorial 2026</button>
      </div>
      ${bodyHtml}
    </div>
  `;

  bindEvents(root);
}

export async function mountRbacAdmin(containerId = 'rbacAdminPanelRoot'): Promise<void> {
  const root = document.getElementById(containerId);
  if (!root) return;

  const app = (window as any).OlymposApp;
  const isMod = Boolean((app && typeof app.isModerador === 'function' && app.isModerador()) || OlymposRbac.isModerador());
  if (!isMod) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = '<div style="padding:18px; color:var(--text-muted); font-size:0.86rem;">Carregando matriz dinâmica e setores organizacionais...</div>';
  await carregarDadosCompletos();
  render(root);
}

export default mountRbacAdmin;
