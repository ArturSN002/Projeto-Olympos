/**
 * Sprint 5.1 — Mapeador Visual de Formulários Heterogêneos (Colunas Condicionais N:1)
 * + Importação via Google Sheets (gas-gateway) ou CSV/XLSX local (lazy xlsx/papaparse).
 */

import {
  callGasGatewayPss,
  escPss,
  getSupabaseClientPss,
  notifyPss,
  resolveConditionalMapping,
  type PssEdital
} from './pssUtils';

interface MapperState {
  headers: string[];
  amostra: Array<Record<string, unknown>>;
  planilhaId: string;
  abaNome: string;
}

const mapperState: MapperState = {
  headers: [],
  amostra: [],
  planilhaId: '',
  abaNome: ''
};

async function parseLocalFileRows(file: File): Promise<{ headers: string[]; rows: Array<Record<string, unknown>> }> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const Papa = (await import('papaparse')).default;
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    const rows = Array.isArray(parsed.data) ? parsed.data : [];
    const headers = parsed.meta?.fields || Object.keys(rows[0] || {});
    return { headers, rows };
  }

  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const headers = Object.keys(rows[0] || {});
  return { headers, rows };
}

function buildOptionsHtml(headers: string[], selectedVal = ''): string {
  return ['<option value="">— Não mapear —</option>']
    .concat(
      headers.map(
        (h) =>
          `<option value="${escPss(h)}"${h === selectedVal ? ' selected' : ''}>${escPss(h)}</option>`
      )
    )
    .join('');
}

function renderPreviewTable(container: HTMLElement, edital: PssEdital): void {
  const host = container.querySelector<HTMLElement>('#pssMapperPreviewHost');
  if (!host) return;
  if (mapperState.amostra.length === 0) {
    host.innerHTML = '<div class="section-desc">Inspecione uma planilha Google Sheets ou envie um arquivo CSV/XLSX para pré-visualizar o COALESCE.</div>';
    return;
  }

  const cfg = lerFormularioMapeamento(container);
  const rowsHtml = mapperState.amostra.slice(0, 5).map((raw, idx) => {
    const res = resolveConditionalMapping(raw, cfg);
    const badge = res.hasConflict
      ? `<span class="pill-badge pss-badge-quarentena">QUARENTENA: ${escPss(res.conflictReason)}</span>`
      : '<span class="pill-badge pss-badge-ativa">OK</span>';
    return (
      '<tr>' +
        `<td>${idx + 1}</td>` +
        `<td>${escPss(res.nome_completo || '--')}</td>` +
        `<td>${escPss(res.cpf || '--')}</td>` +
        `<td>${escPss(res.cargo_alvo || '--')}</td>` +
        `<td>${escPss(res.regiao_alvo || 'Município Único')}</td>` +
        `<td>${badge}</td>` +
      '</tr>'
    );
  }).join('');

  host.innerHTML =
    `<p class="section-desc" style="margin-bottom:8px;">Pré-visualização em tempo real do COALESCE (${escPss(edital.numero_edital)}):</p>` +
    '<div class="pss-table-scroll">' +
      '<table class="clean-table" style="font-size:0.82rem;">' +
        '<thead><tr><th>#</th><th>Nome</th><th>CPF</th><th>Cargo Resolvido</th><th>Região Resolvida</th><th>Validação</th></tr></thead>' +
        `<tbody>${rowsHtml}</tbody>` +
      '</table>' +
    '</div>';
}

function lerFormularioMapeamento(container: HTMLElement): Record<string, any> {
  const getVal = (id: string) => (container.querySelector<HTMLSelectElement>(`#${id}`)?.value || '').trim();
  const getMulti = (cls: string) =>
    Array.from(container.querySelectorAll<HTMLInputElement>(`.${cls}:checked`)).map((el) => el.value);

  return {
    nome_completo: getVal('pssMapNome'),
    cpf: getVal('pssMapCpf'),
    data_nascimento: getVal('pssMapNasc'),
    email: getVal('pssMapEmail'),
    telefone: getVal('pssMapTel'),
    timestamp: getVal('pssMapTs'),
    cargo_cols: getMulti('pss-map-cargo-chk'),
    regiao_cols: getMulti('pss-map-regiao-chk')
  };
}

export function renderSchemaMapperPanel(
  container: HTMLElement,
  edital: PssEdital | null,
  onAfterSync: () => Promise<void>
): void {
  if (!edital) {
    container.innerHTML = '<div class="surface-card" style="padding:20px;">Selecione ou cadastre um edital na aba 1 para configurar o mapeamento.</div>';
    return;
  }

  const savedMap = edital.mapping_config_json || {};
  const headers = mapperState.headers.length > 0
    ? mapperState.headers
    : Array.from(
        new Set<string>([
          savedMap.nome_completo,
          savedMap.cpf,
          savedMap.data_nascimento,
          savedMap.email,
          savedMap.telefone,
          savedMap.timestamp,
          ...(Array.isArray(savedMap.cargo_cols) ? savedMap.cargo_cols : []),
          ...(Array.isArray(savedMap.regiao_cols) ? savedMap.regiao_cols : [])
        ].filter(Boolean))
      );

  const cargoColsSet = new Set<string>(Array.isArray(savedMap.cargo_cols) ? savedMap.cargo_cols : []);
  const regiaoColsSet = new Set<string>(Array.isArray(savedMap.regiao_cols) ? savedMap.regiao_cols : []);

  container.innerHTML =
    '<div class="pss-grid-2">' +
      '<div class="surface-card" style="padding:20px;">' +
        '<h3 style="margin-top:0;">Fonte de Respostas (Google Forms / Planilha)</h3>' +
        '<div class="field-group" style="margin-bottom:10px;">' +
          '<label for="pssSheetIdInput">ID ou URL da Planilha Google Sheets</label>' +
          `<input type="text" id="pssSheetIdInput" class="input-clean" value="${escPss(mapperState.planilhaId || edital.planilha_origem_id || '')}" placeholder="Cole o ID ou URL completa do Google Sheets" />` +
        '</div>' +
        '<div class="field-group" style="margin-bottom:12px;">' +
          '<label for="pssSheetTabInput">Nome da Aba (opcional)</label>' +
          `<input type="text" id="pssSheetTabInput" class="input-clean" value="${escPss(mapperState.abaNome || edital.aba_origem_nome || '')}" placeholder="Ex: Respostas ao formulário 1" />` +
        '</div>' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">' +
          '<button type="button" id="btnPssInspecionarSheets" class="btn btn-secondary btn-sm">1. Inspecionar Cabeçalhos (GAS)</button>' +
          '<button type="button" id="btnPssImportarSheets" class="btn btn-primary btn-sm">3. Importar Respostas em Lotes (GAS)</button>' +
        '</div>' +
        '<hr style="border-color:var(--border-hairline); margin:14px 0;" />' +
        '<div class="field-group">' +
          '<label for="pssLocalFileInput">Alternativa Offline: Upload CSV / XLSX de Inscrições</label>' +
          '<input type="file" id="pssLocalFileInput" accept=".csv,.xlsx,.xls" class="input-clean" />' +
        '</div>' +
        '<div id="pssImportProgressBox" class="section-desc" style="margin-top:10px;"></div>' +
      '</div>' +
      '<div class="surface-card" style="padding:20px;">' +
        '<h3 style="margin-top:0;">Mapeador 1:1 e Colunas Condicionais (N:1)</h3>' +
        '<div class="pss-grid-2" style="gap:10px;">' +
          `<div><label for="pssMapNome">Nome Completo</label><select id="pssMapNome" class="input-clean">${buildOptionsHtml(headers, savedMap.nome_completo || '')}</select></div>` +
          `<div><label for="pssMapCpf">CPF</label><select id="pssMapCpf" class="input-clean">${buildOptionsHtml(headers, savedMap.cpf || '')}</select></div>` +
          `<div><label for="pssMapNasc">Data Nascimento</label><select id="pssMapNasc" class="input-clean">${buildOptionsHtml(headers, savedMap.data_nascimento || '')}</select></div>` +
          `<div><label for="pssMapEmail">E-mail</label><select id="pssMapEmail" class="input-clean">${buildOptionsHtml(headers, savedMap.email || '')}</select></div>` +
          `<div><label for="pssMapTel">Telefone</label><select id="pssMapTel" class="input-clean">${buildOptionsHtml(headers, savedMap.telefone || '')}</select></div>` +
          `<div><label for="pssMapTs">Carimbo Data/Hora</label><select id="pssMapTs" class="input-clean">${buildOptionsHtml(headers, savedMap.timestamp || '')}</select></div>` +
        '</div>' +
        '<div class="pss-grid-2" style="gap:12px; margin-top:12px;">' +
          '<div>' +
            '<strong style="font-size:0.82rem;">Colunas Condicionais de Cargo (COALESCE N:1)</strong>' +
            '<div style="max-height:140px; overflow:auto; border:1px solid var(--border-hairline); border-radius:8px; padding:8px; margin-top:4px;">' +
              (headers.length === 0
                ? '<span class="section-desc">Carregue cabeçalhos primeiro.</span>'
                : headers.map((h) => `<label style="display:flex; gap:6px; font-size:0.8rem; margin-bottom:4px;"><input type="checkbox" class="pss-map-cargo-chk" value="${escPss(h)}"${cargoColsSet.has(h) ? ' checked' : ''}/> <span>${escPss(h)}</span></label>`).join('')) +
            '</div>' +
          '</div>' +
          '<div>' +
            '<strong style="font-size:0.82rem;">Colunas Condicionais de Região (COALESCE N:1)</strong>' +
            '<div style="max-height:140px; overflow:auto; border:1px solid var(--border-hairline); border-radius:8px; padding:8px; margin-top:4px;">' +
              (headers.length === 0
                ? '<span class="section-desc">Carregue cabeçalhos primeiro.</span>'
                : headers.map((h) => `<label style="display:flex; gap:6px; font-size:0.8rem; margin-bottom:4px;"><input type="checkbox" class="pss-map-regiao-chk" value="${escPss(h)}"${regiaoColsSet.has(h) ? ' checked' : ''}/> <span>${escPss(h)}</span></label>`).join('')) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">' +
          '<button type="button" id="btnPssSalvarMapeamento" class="btn btn-primary btn-sm">2. Salvar Mapeamento do Edital</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="surface-card" id="pssMapperPreviewHost" style="padding:18px; margin-top:16px;"></div>';

  renderPreviewTable(container, edital);

  container.querySelectorAll('select, .pss-map-cargo-chk, .pss-map-regiao-chk').forEach((el) => {
    el.addEventListener('change', () => renderPreviewTable(container, edital));
  });

  container.querySelector('#btnPssInspecionarSheets')?.addEventListener('click', async () => {
    const planilhaId = (container.querySelector<HTMLInputElement>('#pssSheetIdInput')?.value || '').trim();
    const abaNome = (container.querySelector<HTMLInputElement>('#pssSheetTabInput')?.value || '').trim();
    if (!planilhaId) {
      notifyPss('Informe o ID ou URL da planilha Google Sheets.', true);
      return;
    }
    try {
      const resp = await callGasGatewayPss('pss_inspecionar_planilha', { planilhaId, abaNome });
      if (!resp || resp.ok === false) {
        notifyPss(resp?.mensagem || 'Falha ao inspecionar planilha.', true);
        return;
      }
      mapperState.headers = Array.isArray(resp.headers) ? resp.headers : [];
      mapperState.amostra = Array.isArray(resp.amostra) ? resp.amostra : [];
      mapperState.planilhaId = resp.planilhaId || planilhaId;
      mapperState.abaNome = resp.abaNome || abaNome;
      notifyPss(`Cabeçalhos carregados (${mapperState.headers.length} colunas, ${resp.totalLinhasDados || 0} linha(s)).`);
      renderSchemaMapperPanel(container, edital, onAfterSync);
    } catch (err: any) {
      notifyPss(`Erro ao inspecionar planilha: ${err?.message || 'falha'}`, true);
    }
  });

  container.querySelector('#btnPssSalvarMapeamento')?.addEventListener('click', async () => {
    const client = getSupabaseClientPss();
    if (!client) return;
    const mapping = lerFormularioMapeamento(container);
    const planilhaId = (container.querySelector<HTMLInputElement>('#pssSheetIdInput')?.value || '').trim();
    const abaNome = (container.querySelector<HTMLInputElement>('#pssSheetTabInput')?.value || '').trim();

    const { error } = await client
      .from('pss_editais')
      .update({
        planilha_origem_id: planilhaId || edital.planilha_origem_id || null,
        aba_origem_nome: abaNome || edital.aba_origem_nome || null,
        mapping_config_json: mapping
      })
      .eq('id', edital.id);

    if (error) {
      notifyPss(`Erro ao salvar mapeamento: ${error.message}`, true);
      return;
    }
    edital.mapping_config_json = mapping;
    notifyPss('Mapeamento condicional salvo com sucesso!');
    await onAfterSync();
  });

  container.querySelector('#btnPssImportarSheets')?.addEventListener('click', async () => {
    const planilhaId = (container.querySelector<HTMLInputElement>('#pssSheetIdInput')?.value || '').trim();
    const abaNome = (container.querySelector<HTMLInputElement>('#pssSheetTabInput')?.value || '').trim();
    const prog = container.querySelector<HTMLElement>('#pssImportProgressBox');
    if (!planilhaId) {
      notifyPss('Informe a planilha de respostas antes de importar.', true);
      return;
    }

    let offset = 0;
    let hasMore = true;
    let totalProc = 0;
    try {
      while (hasMore) {
        if (prog) prog.textContent = `Importando lote a partir da linha ${offset + 1}...`;
        const resp = await callGasGatewayPss('pss_importar_lote_respostas', {
          editalId: edital.id,
          planilhaId,
          abaNome,
          offset,
          limit: 200
        });
        if (!resp || resp.ok === false) {
          notifyPss(resp?.mensagem || 'Falha durante importação paginada.', true);
          return;
        }
        totalProc += Number(resp.processadas || 0);
        hasMore = Boolean(resp.hasMore);
        offset = Number(resp.nextOffset || 0);
      }
      if (prog) prog.textContent = `Importação concluída: ${totalProc} inscrição(ões) processadas.`;
      notifyPss(`Importação GAS concluída (${totalProc} linha(s)).`);
      await onAfterSync();
    } catch (err: any) {
      notifyPss(`Erro na importação em lote: ${err?.message || 'falha'}`, true);
    }
  });

  container.querySelector<HTMLInputElement>('#pssLocalFileInput')?.addEventListener('change', async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const prog = container.querySelector<HTMLElement>('#pssImportProgressBox');
    try {
      const { headers: fileHeaders, rows } = await parseLocalFileRows(file);
      mapperState.headers = fileHeaders;
      mapperState.amostra = rows.slice(0, 5);
      if (rows.length > 0 && (!edital.mapping_config_json || Object.keys(edital.mapping_config_json).length === 0)) {
        notifyPss(`Arquivo lido (${rows.length} linhas). Mapeie e salve as colunas à direita e reenvie ou importe.`);
        renderSchemaMapperPanel(container, edital, onAfterSync);
        return;
      }

      const client = getSupabaseClientPss();
      if (!client) return;
      let total = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200).map((raw, idx) => ({
          source_row_number: i + idx + 1,
          raw
        }));
        if (prog) prog.textContent = `Gravando linhas ${i + 1}–${i + chunk.length}...`;
        const { error } = await client.rpc('rpc_pss_ingerir_lote_inscricoes', {
          p_edital_id: edital.id,
          p_linhas: chunk
        });
        if (error) throw error;
        total += chunk.length;
      }
      if (prog) prog.textContent = `Upload local concluído: ${total} inscrição(ões) ingeridas.`;
      notifyPss(`Arquivo "${file.name}" ingerido (${total} inscrição(ões)).`);
      await onAfterSync();
    } catch (err: any) {
      notifyPss(`Erro ao processar arquivo: ${err?.message || 'falha'}`, true);
    }
  });
}
