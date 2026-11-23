/**
 * Onda 3 — Importador em Lote Inteligente (Homero / Orfeu).
 * Suporta CSV (lazy papaparse) e XLSX/XLS (lazy xlsx), validação inline editável,
 * detecção de duplicatas, modal de pré-visualização (< Anterior | Próximo >)
 * e envio integrado ao GAS ou callback customizado.
 */

import '../styles/onda3.css';

export type BatchMode = 'HOMERO' | 'ORFEU';

export interface BatchImporterOptions {
  containerId: string;
  mode: BatchMode;
  onSendValidRows?: (rows: any[]) => void | Promise<void>;
}

export interface HomeroBatchRow {
  servidor: string;
  matricula: string;
  cargo: string;
  tipo: string;
  dataInicio: string;
  periodoAquisitivo?: string;
  anosAfastados?: string;
}

export interface OrfeuBatchRow {
  nome: string;
  email: string;
  cargaHoraria: string;
  atividade: string;
  nota?: string;
}

export interface ValidatedBatchRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: Record<string, string>;
  isValid: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

function normalizarChaveCabecalho(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizarTextoComparacao(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function isValidDateInput(raw: string): boolean {
  const s = String(raw || '').trim();
  if (!s) return false;

  let year = 0;
  let month = 0;
  let day = 0;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (iso) {
    year = parseInt(iso[1], 10);
    month = parseInt(iso[2], 10);
    day = parseInt(iso[3], 10);
  } else if (br) {
    day = parseInt(br[1], 10);
    month = parseInt(br[2], 10);
    year = parseInt(br[3], 10);
  } else {
    return false;
  }

  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(year, month - 1, day, 12, 0, 0);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

export function parseCargaHorariaHoras(raw: unknown): number {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  const num = Number(s.replace(',', '.'));
  if (Number.isFinite(num)) return num;
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (m) {
    const parsed = Number(m[1].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function mapRawRowToMode(rawObj: Record<string, unknown>, mode: BatchMode): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [k, val] of Object.entries(rawObj || {})) {
    normalized[normalizarChaveCabecalho(k)] = String(val ?? '').trim();
  }

  const pick = (candidates: string[]): string => {
    for (const c of candidates) {
      if (normalized[c] !== undefined && normalized[c] !== '') {
        return normalized[c];
      }
    }
    return '';
  };

  if (mode === 'HOMERO') {
    return {
      servidor: pick(['servidor', 'servidora', 'nome', 'nomecompleto', 'nomeservidor']),
      matricula: pick(['matricula', 'mat', 'registro']),
      cargo: pick(['cargo', 'funcao', 'cargofuncao', 'categoria']),
      tipo: pick(['tipo', 'ato', 'tipoato', 'modalidade', 'operacao', 'portaria']),
      dataInicio: pick(['datainicio', 'inicio', 'data', 'dataato', 'datainicial']),
      periodoAquisitivo: pick(['periodoaquisitivo', 'periodo', 'quinquenio']),
      anosAfastados: pick(['anosafastados', 'anos'])
    };
  }

  return {
    nome: pick(['nome', 'nomecompleto', 'participante', 'servidor', 'aluno']),
    email: pick(['email', 'correio', 'mail']),
    cargaHoraria: pick(['cargahoraria', 'horas', 'ch', 'duracao', 'frequencia']),
    atividade: pick(['atividade', 'evento', 'atividadeevento', 'formacao', 'curso']),
    nota: pick(['nota', 'avaliacao'])
  };
}

export function validateBatchRows(rows: Array<Record<string, string>>, mode: BatchMode): ValidatedBatchRow[] {
  const emailCounts = new Map<string, number>();
  const nomeCounts = new Map<string, number>();

  if (mode === 'ORFEU') {
    for (const r of rows) {
      const em = String(r.email || '').trim().toLowerCase();
      const nm = normalizarTextoComparacao(r.nome || '');
      if (em) emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
      if (nm) nomeCounts.set(nm, (nomeCounts.get(nm) || 0) + 1);
    }
  }

  return rows.map((data, idx) => {
    const errors: Record<string, string> = {};

    if (mode === 'HOMERO') {
      if (!data.servidor || data.servidor.trim().length < 3) {
        errors.servidor = 'Informe o nome completo do servidor.';
      }
      if (!data.matricula || data.matricula.trim().length < 2) {
        errors.matricula = 'Matrícula funcional obrigatória.';
      }
      if (!data.cargo || data.cargo.trim().length < 2) {
        errors.cargo = 'Cargo ou função obrigatório.';
      }
      if (!data.tipo || data.tipo.trim().length < 2) {
        errors.tipo = 'Informe o tipo/ato (ex: PREMIO, READAPTACAO).';
      }
      if (!isValidDateInput(data.dataInicio)) {
        errors.dataInicio = 'Use dd/mm/aaaa ou aaaa-mm-dd válida.';
      }
    } else {
      const nomeTrim = (data.nome || '').trim();
      const emailTrim = (data.email || '').trim().toLowerCase();
      const chNum = parseCargaHorariaHoras(data.cargaHoraria);
      const ativTrim = (data.atividade || '').trim();

      if (nomeTrim.length < 3) {
        errors.nome = 'Nome do participante obrigatório.';
      } else {
        const nmNorm = normalizarTextoComparacao(nomeTrim);
        if ((nomeCounts.get(nmNorm) || 0) > 1) {
          errors.nome = 'Nome duplicado no lote.';
        }
      }

      if (!EMAIL_REGEX.test(emailTrim)) {
        errors.email = 'E-mail institucional/pessoal inválido.';
      } else if ((emailCounts.get(emailTrim) || 0) > 1) {
        errors.email = 'E-mail duplicado no lote.';
      }

      if (!(chNum > 0)) {
        errors.cargaHoraria = 'Carga horária deve ser > 0.';
      }

      if (ativTrim.length < 2) {
        errors.atividade = 'Informe a atividade ou evento.';
      }
    }

    return {
      rowIndex: idx,
      data,
      errors,
      isValid: Object.keys(errors).length === 0
    };
  });
}

export function renderMinutaPreviewHtml(row: Record<string, string>, mode: BatchMode, index: number): string {
  if (mode === 'HOMERO') {
    const tipoNorm = esc(row.tipo || 'PORTARIA');
    const servidor = esc(row.servidor || 'SERVIDOR NÃO INFORMADO');
    const matricula = esc(row.matricula || '--');
    const cargo = esc(row.cargo || '--');
    const dataInicio = esc(row.dataInicio || '--');
    return (
      `<div class="batch-preview-sheet">` +
        `<h4>Prefeitura Municipal de Ceará-Mirim/RN • SMEB<br>Minuta Prévia de Portaria (#${index + 1})</h4>` +
        `<p><strong>PORTARIA SMEB Nº AUTO/2026</strong> — Modalidade: <code>${tipoNorm}</code></p>` +
        `<p>O Secretário Municipal de Educação Básica de Ceará-Mirim/RN, no uso das atribuições legais que lhe confere a legislação municipal vigente, resolve:</p>` +
        `<p><strong>Art. 1º</strong> — Conceder/Registrar o ato administrativo referente a <code>${tipoNorm}</code> ao(à) servidor(a) <strong>${servidor}</strong>, matrícula funcional nº <strong>${matricula}</strong>, ocupante do cargo de <strong>${cargo}</strong>, com vigência a partir de <strong>${dataInicio}</strong>.</p>` +
        (row.periodoAquisitivo ? `<p><strong>Período Aquisitivo:</strong> ${esc(row.periodoAquisitivo)}</p>` : '') +
        (row.anosAfastados ? `<p><strong>Anos de Afastamento:</strong> ${esc(row.anosAfastados)}</p>` : '') +
        `<p style="margin-top: 18px; font-size: 12.5px; color: #475569;">Documento em fase de pré-validação (O Pincel de Homero) antes da geração oficial no Google Docs.</p>` +
      `</div>`
    );
  }

  const nome = esc(row.nome || 'Participante');
  const email = esc(row.email || '--');
  const ch = esc(row.cargaHoraria || '--');
  const atividade = esc(row.atividade || 'Formação Continuada SMEB');
  const nota = row.nota ? ` • Nota/Conceito: <strong>${esc(row.nota)}</strong>` : '';
  return (
    `<div class="batch-preview-sheet">` +
      `<h4>Secretaria Municipal de Educação Básica — Ceará-Mirim/RN<br>Prévia de Certificação Digital (#${index + 1})</h4>` +
      `<p>Certificamos que <strong>${nome}</strong> (<code>${email}</code>) participou com êxito da atividade formativa <strong>${atividade}</strong>, perfazendo carga horária total de <strong>${ch}</strong>${nota}.</p>` +
      `<p style="margin-top: 16px; font-size: 12.5px; color: #475569;">Registro sujeito a assinatura criptográfica institucional e QR Code de autenticidade via A Lira de Orfeu.</p>` +
    `</div>`
  );
}

interface BatchImporterState {
  opts: BatchImporterOptions;
  rows: Array<Record<string, string>>;
  validated: ValidatedBatchRow[];
  fileName: string;
  previewIndex: number;
  sending: boolean;
}

const COLUMNS_BY_MODE: Record<BatchMode, Array<{ key: string; label: string; placeholder: string }>> = {
  HOMERO: [
    { key: 'servidor', label: 'Servidor(a)', placeholder: 'Nome completo' },
    { key: 'matricula', label: 'Matrícula', placeholder: '2405231-0' },
    { key: 'cargo', label: 'Cargo', placeholder: 'Professor Fundamental' },
    { key: 'tipo', label: 'Tipo / Ato', placeholder: 'PREMIO / READAPTACAO' },
    { key: 'dataInicio', label: 'Data Início', placeholder: 'dd/mm/aaaa' }
  ],
  ORFEU: [
    { key: 'nome', label: 'Nome Completo', placeholder: 'Nome do participante' },
    { key: 'email', label: 'E-mail', placeholder: 'nome@escola.rn.gov.br' },
    { key: 'cargaHoraria', label: 'Carga Horária', placeholder: '40h' },
    { key: 'atividade', label: 'Atividade / Evento', placeholder: 'Formação Docente' }
  ]
};

async function parseFileToRows(file: File, mode: BatchMode): Promise<Array<Record<string, string>>> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    const PapaModule = await import('papaparse');
    const Papa = PapaModule.default || PapaModule;
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h: string) => h.trim()
    });
    const list = Array.isArray(parsed.data) ? parsed.data : [];
    return list
      .filter((r) => r && Object.values(r).some((v) => String(v ?? '').trim() !== ''))
      .map((r) => mapRawRowToMode(r, mode));
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = wb.Sheets[firstSheetName];
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    return jsonRows
      .filter((r) => r && Object.values(r).some((v) => String(v ?? '').trim() !== ''))
      .map((r) => mapRawRowToMode(r, mode));
  }

  throw new Error('Formato não suportado. Envie arquivo .csv, .xlsx ou .xls.');
}

function downloadSampleTemplate(mode: BatchMode): void {
  const header =
    mode === 'HOMERO'
      ? 'servidor;matricula;cargo;tipo;dataInicio\nMARIA DAS DORES SILVA;2405112-0;Professor Fundamental I;PREMIO;01/03/2026\n'
      : 'nome;email;cargaHoraria;atividade\nJoao Batista da Silva;joao.silva@smeb.cearamirim.rn.gov.br;40h;Jornada Pedagógica 2026\n';
  const blob = new Blob(['\ufeff' + header], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = mode === 'HOMERO' ? 'modelo_lote_homero.csv' : 'modelo_lote_orfeu.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function enviarLotePadraoGas(mode: BatchMode, validRows: Array<Record<string, string>>): Promise<void> {
  if (!window.OlymposApi || typeof window.OlymposApi.chamar !== 'function') {
    throw new Error('Gateway OlymposApi indisponível no momento.');
  }

  if (mode === 'ORFEU') {
    const planId = (document.getElementById('liraPlanilhaSelect') as HTMLSelectElement | null)?.value || '';
    const sheetName = (document.getElementById('liraAbaSelect') as HTMLSelectElement | null)?.value || '';
    if (!planId || !sheetName) {
      throw new Error('Selecione uma planilha e aba na Lira de Orfeu antes de enviar o lote.');
    }

    await new Promise<void>((resolve, reject) => {
      window.OlymposApi.chamar(
        'certificados_salvar_lote',
        {
          spreadsheetId: planId,
          sheetName,
          participantes: validRows.map((r) => ({
            nome: r.nome,
            email: r.email,
            cargaHoraria: r.cargaHoraria,
            nota: r.nota || '',
            atividade: r.atividade
          }))
        },
        (res: any) => {
          if (res && res.ok) {
            window.OlymposApp?.showToast?.(`${validRows.length} participante(s) importado(s) na Lira de Orfeu!`);
            window.OlymposViews?.certificados?.carregarParticipantesAba?.();
            resolve();
          } else {
            reject(new Error((res && res.mensagem) || 'Falha ao importar lote na Lira de Orfeu.'));
          }
        },
        (err: any) => reject(err instanceof Error ? err : new Error(String(err?.message || err)))
      );
    });
    return;
  }

  // Modo HOMERO: cadastra linhas válidas no Pincel de Homero via licenca_cadastrar (em lote sequencial seguro)
  let enviados = 0;
  for (const row of validRows) {
    const tipoUp = String(row.tipo || 'PREMIO').toUpperCase();
    const tipoLic = tipoUp.includes('NAO') || tipoUp.includes('SEM')
      ? 'NAO_REMUNERADA'
      : (tipoUp.includes('ANULA') ? 'ANULACAO' : 'PREMIO');

    await new Promise<void>((resolve, reject) => {
      window.OlymposApi.chamar(
        'licenca_cadastrar',
        {
          tipoLicenca: tipoLic,
          nome: row.servidor,
          matricula: row.matricula,
          cargo: row.cargo,
          periodoAquisitivo: row.periodoAquisitivo || '1',
          anosAfastados: row.anosAfastados || '',
          dataInicio: row.dataInicio,
          numPortaria: 'AUTO',
          gerarDocumentoAgora: false
        },
        (res: any) => {
          if (res && res.ok) {
            enviados++;
            resolve();
          } else {
            reject(new Error((res && res.mensagem) || `Falha ao registrar ${row.servidor}`));
          }
        },
        (err: any) => reject(err instanceof Error ? err : new Error(String(err?.message || err)))
      );
    });
  }
  window.OlymposApp?.showToast?.(`${enviados} registro(s) enviado(s) para emissão no Pincel de Homero!`);
}

export function mountBatchImporter(opts: BatchImporterOptions): void {
  const root = document.getElementById(opts.containerId);
  if (!root) return;

  const mode = opts.mode;
  const cols = COLUMNS_BY_MODE[mode];
  const uid = `batch_${mode.toLowerCase()}_${opts.containerId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const state: BatchImporterState = {
    opts,
    rows: [],
    validated: [],
    fileName: '',
    previewIndex: 0,
    sending: false
  };

  const modeTitle = mode === 'HOMERO'
    ? 'Importação Inteligente de Portarias (CSV / XLSX)'
    : 'Importação Inteligente de Participantes (CSV / XLSX)';
  const modeDesc = mode === 'HOMERO'
    ? 'Valida servidor, matrícula, cargo, tipo/ato e data de início antes de despachar para o Pincel de Homero.'
    : 'Valida nome, e-mail, carga horária (> 0), atividade/evento e detecta duplicidades antes da Lira de Orfeu.';

  root.innerHTML =
    `<div class="batch-importer-shell" id="${uid}-shell">` +
      `<div class="batch-importer-header">` +
        `<div>` +
          `<span class="section-eyebrow" style="font-size: 10px;">LOTE INTELIGENTE • ${esc(mode)}</span>` +
          `<h3 style="margin: 2px 0 4px; font-size: 1.05rem;">${esc(modeTitle)}</h3>` +
          `<p class="section-desc" style="margin: 0; font-size: 12.5px;">${esc(modeDesc)}</p>` +
        `</div>` +
        `<div class="button-group">` +
          `<button type="button" id="${uid}-tpl-btn" class="btn btn-ghost btn-sm">Baixar Modelo CSV</button>` +
          `<button type="button" id="${uid}-add-row-btn" class="btn btn-secondary btn-sm">+ Linha Manual</button>` +
        `</div>` +
      `</div>` +
      `<div id="${uid}-dropzone" class="batch-dropzone" tabindex="0" role="button" aria-label="Solte planilha CSV ou XLSX aqui ou clique para selecionar">` +
        `<p class="batch-dropzone-title">Arraste e solte um arquivo <code>.csv</code>, <code>.xlsx</code> ou <code>.xls</code></p>` +
        `<p class="batch-dropzone-sub" id="${uid}-file-label">Ou clique para escolher no computador — processamento local sem upload prévio.</p>` +
        `<input type="file" id="${uid}-file-input" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" class="hidden" />` +
        `<span class="btn btn-secondary btn-sm">Selecionar Planilha</span>` +
      `</div>` +
      `<div id="${uid}-summary" class="batch-summary-bar hidden">` +
        `<div class="batch-counters-group">` +
          `<span id="${uid}-valid-count" class="pill-badge pill-green">0 válidas</span>` +
          `<span id="${uid}-error-count" class="pill-badge pill-red">0 com erro</span>` +
          `<span id="${uid}-total-count" class="pill-badge pill-blue">0 linhas</span>` +
        `</div>` +
        `<div class="button-group">` +
          `<button type="button" id="${uid}-preview-btn" class="btn btn-secondary btn-sm">Pré-visualizar Minutas</button>` +
          `<button type="button" id="${uid}-clear-btn" class="btn btn-ghost btn-sm">Limpar Lote</button>` +
          `<button type="button" id="${uid}-send-btn" class="btn btn-primary btn-sm">Enviar Lote Válido</button>` +
        `</div>` +
      `</div>` +
      `<div id="${uid}-table-wrap" class="batch-table-wrap hidden">` +
        `<table class="batch-table">` +
          `<thead><tr>` +
            `<th style="width: 52px;">#</th>` +
            cols.map((c) => `<th>${esc(c.label)}</th>`).join('') +
            `<th style="width: 90px;">Status</th>` +
            `<th style="width: 72px;" class="text-right">Ação</th>` +
          `</tr></thead>` +
          `<tbody id="${uid}-tbody"></tbody>` +
        `</table>` +
      `</div>` +
    `</div>`;

  const dropzone = document.getElementById(`${uid}-dropzone`);
  const fileInput = document.getElementById(`${uid}-file-input`) as HTMLInputElement | null;
  const fileLabel = document.getElementById(`${uid}-file-label`);
  const summaryBar = document.getElementById(`${uid}-summary`);
  const tableWrap = document.getElementById(`${uid}-table-wrap`);
  const tbody = document.getElementById(`${uid}-tbody`);
  const validBadge = document.getElementById(`${uid}-valid-count`);
  const errorBadge = document.getElementById(`${uid}-error-count`);
  const totalBadge = document.getElementById(`${uid}-total-count`);
  const sendBtn = document.getElementById(`${uid}-send-btn`) as HTMLButtonElement | null;
  const previewBtn = document.getElementById(`${uid}-preview-btn`) as HTMLButtonElement | null;

  function ensurePreviewModal(): HTMLElement {
    const modalId = `${uid}-preview-modal`;
    let modal = document.getElementById(modalId);
    if (modal) return modal;

    const modalRoot = document.getElementById('modal-root') || document.body;
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-backdrop hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', `${uid}-preview-title`);
    modal.innerHTML =
      `<div class="modal-card batch-preview-modal-card">` +
        `<div class="modal-header">` +
          `<h3 id="${uid}-preview-title" style="margin: 0; font-size: 1.08rem;">Pré-visualização de Minuta Mesclada</h3>` +
          `<button type="button" id="${uid}-preview-close-x" class="icon-capsule-btn" aria-label="Fechar pré-visualização">✕</button>` +
        `</div>` +
        `<div class="modal-body">` +
          `<div class="batch-preview-nav">` +
            `<button type="button" id="${uid}-prev-item" class="btn btn-secondary btn-sm">&lt; Anterior</button>` +
            `<span id="${uid}-preview-counter" class="pill-badge pill-blue">1 de 1</span>` +
            `<button type="button" id="${uid}-next-item" class="btn btn-secondary btn-sm">Próximo &gt;</button>` +
          `</div>` +
          `<div id="${uid}-preview-content"></div>` +
        `</div>` +
        `<div class="modal-footer">` +
          `<span id="${uid}-preview-status" class="pill-badge pill-green">Válida</span>` +
          `<button type="button" id="${uid}-preview-close-btn" class="btn btn-primary btn-sm">Fechar</button>` +
        `</div>` +
      `</div>`;

    modalRoot.appendChild(modal);

    const close = () => {
      modal!.classList.add('hidden');
    };
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) close();
    });
    document.getElementById(`${uid}-preview-close-x`)?.addEventListener('click', close);
    document.getElementById(`${uid}-preview-close-btn`)?.addEventListener('click', close);
    document.getElementById(`${uid}-prev-item`)?.addEventListener('click', () => {
      if (state.previewIndex > 0) {
        state.previewIndex--;
        renderPreviewModal();
      }
    });
    document.getElementById(`${uid}-next-item`)?.addEventListener('click', () => {
      if (state.previewIndex < state.validated.length - 1) {
        state.previewIndex++;
        renderPreviewModal();
      }
    });

    return modal;
  }

  function renderPreviewModal(): void {
    if (state.validated.length === 0) return;
    const modal = ensurePreviewModal();
    if (state.previewIndex >= state.validated.length) state.previewIndex = state.validated.length - 1;
    if (state.previewIndex < 0) state.previewIndex = 0;

    const item = state.validated[state.previewIndex];
    const contentEl = document.getElementById(`${uid}-preview-content`);
    const counterEl = document.getElementById(`${uid}-preview-counter`);
    const statusEl = document.getElementById(`${uid}-preview-status`);
    const prevBtn = document.getElementById(`${uid}-prev-item`) as HTMLButtonElement | null;
    const nextBtn = document.getElementById(`${uid}-next-item`) as HTMLButtonElement | null;

    if (counterEl) counterEl.textContent = `${state.previewIndex + 1} de ${state.validated.length}`;
    if (prevBtn) prevBtn.disabled = state.previewIndex <= 0;
    if (nextBtn) nextBtn.disabled = state.previewIndex >= state.validated.length - 1;
    if (statusEl) {
      statusEl.className = `pill-badge ${item.isValid ? 'pill-green' : 'pill-red'}`;
      statusEl.textContent = item.isValid ? 'Linha Válida' : `${Object.keys(item.errors).length} erro(s)`;
    }
    if (contentEl) {
      contentEl.innerHTML = renderMinutaPreviewHtml(item.data, mode, state.previewIndex);
    }
    modal.classList.remove('hidden');
  }

  function refreshValidationCountsAndCells(): void {
    state.validated = validateBatchRows(state.rows, mode);
    const total = state.validated.length;
    const validCount = state.validated.filter((r) => r.isValid).length;
    const errorCount = total - validCount;

    if (summaryBar) summaryBar.classList.toggle('hidden', total === 0);
    if (tableWrap) tableWrap.classList.toggle('hidden', total === 0);
    if (validBadge) validBadge.textContent = `${validCount} válida${validCount === 1 ? '' : 's'}`;
    if (errorBadge) {
      errorBadge.textContent = `${errorCount} com erro`;
      errorBadge.className = `pill-badge ${errorCount > 0 ? 'pill-red' : 'pill-green'}`;
    }
    if (totalBadge) totalBadge.textContent = `${total} linha${total === 1 ? '' : 's'}`;
    if (sendBtn) {
      sendBtn.disabled = state.sending || validCount === 0;
      sendBtn.textContent = state.sending
        ? 'Enviando lote...'
        : `Enviar Lote Válido (${validCount})`;
    }
    if (previewBtn) {
      previewBtn.disabled = total === 0;
    }

    if (!tbody) return;
    state.validated.forEach((vRow, idx) => {
      const tr = tbody.querySelector<HTMLTableRowElement>(`tr[data-batch-row="${idx}"]`);
      if (!tr) return;
      tr.classList.toggle('batch-row-error', !vRow.isValid);

      cols.forEach((col) => {
        const input = tr.querySelector<HTMLInputElement>(`input[data-batch-col="${col.key}"]`);
        const hint = tr.querySelector<HTMLElement>(`span[data-batch-hint="${col.key}"]`);
        const errMsg = vRow.errors[col.key] || '';
        if (input) {
          input.classList.toggle('batch-cell-invalid', Boolean(errMsg));
          input.setAttribute('aria-invalid', errMsg ? 'true' : 'false');
        }
        if (hint) {
          hint.textContent = errMsg;
          hint.classList.toggle('hidden', !errMsg);
        }
      });

      const statusCell = tr.querySelector<HTMLElement>('[data-batch-status]');
      if (statusCell) {
        statusCell.innerHTML = vRow.isValid
          ? '<span class="pill-badge pill-green">Válida</span>'
          : `<span class="pill-badge pill-red">${Object.keys(vRow.errors).length} erro(s)</span>`;
      }
    });
  }

  function renderFullTable(): void {
    state.validated = validateBatchRows(state.rows, mode);
    if (!tbody) return;

    tbody.innerHTML = state.validated
      .map((vRow, idx) => {
        const cellsHtml = cols
          .map((col) => {
            const val = vRow.data[col.key] || '';
            const errMsg = vRow.errors[col.key] || '';
            return (
              `<td>` +
                `<input type="text" class="batch-cell-input${errMsg ? ' batch-cell-invalid' : ''}" ` +
                  `data-batch-row-idx="${idx}" data-batch-col="${esc(col.key)}" ` +
                  `value="${esc(val)}" placeholder="${esc(col.placeholder)}" ` +
                  `aria-label="${esc(col.label)} linha ${idx + 1}" aria-invalid="${errMsg ? 'true' : 'false'}" />` +
                `<span class="batch-cell-error-hint${errMsg ? '' : ' hidden'}" data-batch-hint="${esc(col.key)}">${esc(errMsg)}</span>` +
              `</td>`
            );
          })
          .join('');

        return (
          `<tr data-batch-row="${idx}" class="${vRow.isValid ? '' : 'batch-row-error'}">` +
            `<td><strong>${idx + 1}</strong></td>` +
            cellsHtml +
            `<td data-batch-status>` +
              (vRow.isValid
                ? '<span class="pill-badge pill-green">Válida</span>'
                : `<span class="pill-badge pill-red">${Object.keys(vRow.errors).length} erro(s)</span>`) +
            `</td>` +
            `<td class="text-right">` +
              `<button type="button" class="btn btn-ghost btn-xs" data-batch-remove="${idx}" aria-label="Remover linha ${idx + 1}">✕</button>` +
            `</td>` +
          `</tr>`
        );
      })
      .join('');

    refreshValidationCountsAndCells();
  }

  async function handleFileSelection(file: File | undefined): Promise<void> {
    if (!file) return;
    if (fileLabel) fileLabel.textContent = `Lendo "${file.name}"...`;
    try {
      const parsed = await parseFileToRows(file, mode);
      state.rows = parsed;
      state.fileName = file.name;
      if (fileLabel) {
        fileLabel.textContent = parsed.length > 0
          ? `Arquivo carregado: ${file.name} (${parsed.length} linha(s))`
          : `Arquivo "${file.name}" não contém registros utilizáveis.`;
      }
      renderFullTable();
    } catch (err: any) {
      if (fileLabel) fileLabel.textContent = err?.message || 'Erro ao ler planilha.';
      window.OlymposApp?.showToast?.(err?.message || 'Falha ao ler arquivo.', true);
    }
  }

  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      fileInput?.click();
    }
  });
  dropzone?.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragover');
  });
  dropzone?.addEventListener('drop', (ev) => {
    ev.preventDefault();
    dropzone.classList.remove('is-dragover');
    const f = ev.dataTransfer?.files?.[0];
    void handleFileSelection(f);
  });

  fileInput?.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    void handleFileSelection(f);
    fileInput.value = '';
  });

  tbody?.addEventListener('input', (ev) => {
    const target = ev.target as HTMLInputElement | null;
    if (!target || !target.matches('input[data-batch-col]')) return;
    const idx = parseInt(target.getAttribute('data-batch-row-idx') || '', 10);
    const colKey = target.getAttribute('data-batch-col') || '';
    if (!Number.isFinite(idx) || !state.rows[idx] || !colKey) return;
    state.rows[idx][colKey] = target.value;
    refreshValidationCountsAndCells();
  });

  tbody?.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement | null)?.closest('[data-batch-remove]') as HTMLElement | null;
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-batch-remove') || '', 10);
    if (!Number.isFinite(idx)) return;
    state.rows.splice(idx, 1);
    renderFullTable();
  });

  document.getElementById(`${uid}-tpl-btn`)?.addEventListener('click', () => downloadSampleTemplate(mode));
  document.getElementById(`${uid}-add-row-btn`)?.addEventListener('click', () => {
    const empty: Record<string, string> = {};
    cols.forEach((c) => {
      empty[c.key] = '';
    });
    state.rows.push(empty);
    renderFullTable();
  });
  document.getElementById(`${uid}-clear-btn`)?.addEventListener('click', () => {
    state.rows = [];
    state.validated = [];
    if (fileLabel) fileLabel.textContent = 'Ou clique para escolher no computador — processamento local sem upload prévio.';
    renderFullTable();
  });
  previewBtn?.addEventListener('click', () => {
    state.previewIndex = 0;
    renderPreviewModal();
  });

  sendBtn?.addEventListener('click', async () => {
    if (state.sending) return;
    const validRows = state.validated.filter((r) => r.isValid).map((r) => ({ ...r.data }));
    if (validRows.length === 0) {
      window.OlymposApp?.showToast?.('Nenhuma linha válida para envio.', true);
      return;
    }

    state.sending = true;
    refreshValidationCountsAndCells();

    try {
      if (typeof state.opts.onSendValidRows === 'function') {
        await state.opts.onSendValidRows(validRows);
      } else {
        await enviarLotePadraoGas(mode, validRows);
      }
    } catch (err: any) {
      window.OlymposApp?.showToast?.(err?.message || 'Erro ao enviar lote válido.', true);
    } finally {
      state.sending = false;
      refreshValidationCountsAndCells();
    }
  });
}
