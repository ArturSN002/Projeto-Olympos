/**
 * Onda 3 — Relatórios Executivos Mensais (1-Clique PDF Vetorial + XLSX Multi-Abas).
 * Consolida indicadores via Supabase RPC `rpc_relatorio_executivo_mensal(p_ano, p_mes)`.
 */

import '../styles/onda3.css';
import '../styles/relatoriosPrint.css';
import relatoriosHtml from '../templates/pages/relatorios.html?raw';

export const routeId = 'relatorios';
export const htmlTemplate = relatoriosHtml;

export interface RelatorioSubcategoriaItem {
  subcategoria: string;
  total: number;
}

export interface RelatorioSetorItem {
  setor: string;
  recebidas: number;
  resolvidas: number;
  slaMedioMinutos: number | null;
}

export interface RelatorioFemurnTipoItem {
  tipo: string;
  total: number;
}

export interface RelatorioMensalNormalizado {
  ano: number;
  mes: number;
  competencia: string;
  oficiosTotal: number;
  portariasTotal: number;
  portariasPorSubcategoria: RelatorioSubcategoriaItem[];
  licencasTotal: number;
  licencasPorTipo: RelatorioSubcategoriaItem[];
  pendenciasRecebidas: number;
  pendenciasResolvidas: number;
  pendenciasAbertas: number;
  slaMedioMinutos: number | null;
  pendenciasPorSetor: RelatorioSetorItem[];
  femurnTotal: number;
  femurnPorTipo: RelatorioFemurnTipoItem[];
  documentosLista: Array<Record<string, unknown>>;
  femurnLista: Array<Record<string, unknown>>;
  origemDados: 'rpc' | 'fallback_tables';
}

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const SUBCATEGORIA_LABELS: Record<string, string> = {
  GERAL: 'Portarias Gerais',
  LICENCA: 'Licenças (Ativas)',
  LICENCA_PUBLICADA: 'Licenças Publicadas',
  READAPTACAO: 'Readaptações',
  FEMURN_PUBLICADA: 'Publicadas FEMURN'
};

const FEMURN_TIPO_LABELS: Record<string, string> = {
  PORTARIA: 'Portarias',
  ATO_GABINETE: 'Atos de Gabinete',
  NOMEACAO_DIRETOR: 'Nomeações',
  EDITAL_PSS: 'Editais/PSS',
  PERMUTA_RH: 'Permutas/RH',
  NORMATIVO_JURIDICO: 'Normativos',
  REPUBLICACAO: 'Republicações',
  ATO_OFICIAL: 'Atos Oficiais'
};

let ultimoRelatorio: RelatorioMensalNormalizado | null = null;
let carregando = false;

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

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function toNullableNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function formatarSlaMinutos(minutos: number | null): string {
  if (minutos === null || !Number.isFinite(minutos) || minutos < 0) return '--';
  const total = Math.round(minutos);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function parseMapOrArrayToPairs(
  raw: unknown,
  labelKeyCandidates: string[],
  countKeyCandidates: string[]
): Array<{ label: string; total: number }> {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;
        const lbl = labelKeyCandidates.map((k) => obj[k]).find((val) => typeof val === 'string' && val.trim());
        const cnt = countKeyCandidates.map((k) => obj[k]).find((val) => val !== undefined && val !== null);
        return {
          label: String(lbl || 'Outros'),
          total: toInt(cnt, 0)
        };
      })
      .filter((x): x is { label: string; total: number } => Boolean(x));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([k, val]) => ({
      label: k,
      total: toInt(val, 0)
    }));
  }
  return [];
}

export function normalizarPayloadRelatorio(raw: any, ano: number, mes: number): RelatorioMensalNormalizado {
  const src = raw && typeof raw === 'object' ? (raw.relatorio || raw.data || raw) : {};
  const docsObj = src.documentos && typeof src.documentos === 'object' ? src.documentos : {};
  const pendObj = src.pendencias && typeof src.pendencias === 'object' ? src.pendencias : {};
  const licObj = src.licencas && typeof src.licencas === 'object' ? src.licencas : {};
  const femObj =
    src.publicacoes_diario && typeof src.publicacoes_diario === 'object'
      ? src.publicacoes_diario
      : (src.femurn && typeof src.femurn === 'object'
          ? src.femurn
          : (src.diario && typeof src.diario === 'object' ? src.diario : {}));

  const portSubRaw =
    src.portarias_por_subcategoria ??
    docsObj.portarias_por_subcategoria ??
    docsObj.por_subcategoria ??
    src.portariasPorSubcategoria;

  const portariasPorSubcategoria = parseMapOrArrayToPairs(
    portSubRaw,
    ['subcategoria', 'categoria', 'label', 'nome'],
    ['total', 'quantidade', 'count', 'qtd']
  ).map((p) => ({
    subcategoria: p.label,
    total: p.total
  }));

  const portariasSumSub = portariasPorSubcategoria.reduce((acc, it) => acc + it.total, 0);
  const oficiosTotal = toInt(
    src.oficios_total ?? src.total_oficios ?? docsObj.total_oficios ?? docsObj.oficios ?? docsObj.oficios_total ?? src.oficios,
    0
  );
  const portariasTotal = toInt(
    src.portarias_total ?? src.total_portarias ?? docsObj.total_portarias ?? docsObj.portarias ?? docsObj.portarias_total ?? src.portarias,
    portariasSumSub
  );

  const licPorTipoRaw = src.licencas_por_tipo ?? licObj.por_tipo ?? licObj.por_modalidade;
  const licencasPorTipo = parseMapOrArrayToPairs(
    licPorTipoRaw,
    ['tipo', 'modalidade', 'label', 'subcategoria'],
    ['total', 'quantidade', 'count']
  ).map((p) => ({ subcategoria: p.label, total: p.total }));
  const licTotal = toInt(
    src.licencas_total ?? src.total_licencas ?? (typeof src.licencas === 'number' ? src.licencas : licObj.total),
    licencasPorTipo.reduce((acc, it) => acc + it.total, 0)
  );

  const pendPorSetorRaw = src.pendencias_por_setor ?? pendObj.por_setor ?? src.por_setor;
  const pendenciasPorSetor: RelatorioSetorItem[] = Array.isArray(pendPorSetorRaw)
    ? pendPorSetorRaw.map((item: any) => ({
        setor: String(item?.setor || item?.departamento || item?.nome || 'Geral'),
        recebidas: toInt(item?.recebidas ?? item?.total ?? item?.quantidade, 0),
        resolvidas: toInt(item?.resolvidas ?? item?.concluidas ?? 0, 0),
        slaMedioMinutos: toNullableNum(item?.sla_medio_minutos ?? item?.slaMedioMinutos)
      }))
    : (pendPorSetorRaw && typeof pendPorSetorRaw === 'object'
        ? Object.entries(pendPorSetorRaw as Record<string, any>).map(([setor, val]) => {
            if (typeof val === 'object' && val !== null) {
              return {
                setor,
                recebidas: toInt(val.recebidas ?? val.total, 0),
                resolvidas: toInt(val.resolvidas ?? 0, 0),
                slaMedioMinutos: toNullableNum(val.sla_medio_minutos)
              };
            }
            return { setor, recebidas: toInt(val, 0), resolvidas: 0, slaMedioMinutos: null };
          })
        : []);

  const pendenciasRecebidas = toInt(
    src.pendencias_recebidas ?? pendObj.recebidas ?? pendObj.total ?? src.total_pendencias,
    pendenciasPorSetor.reduce((acc, it) => acc + it.recebidas, 0)
  );
  const pendenciasResolvidas = toInt(
    src.pendencias_resolvidas ?? pendObj.resolvidas ?? pendObj.concluidas,
    pendenciasPorSetor.reduce((acc, it) => acc + it.resolvidas, 0)
  );
  const pendenciasAbertas = toInt(
    src.pendencias_abertas ?? pendObj.abertas,
    Math.max(0, pendenciasRecebidas - pendenciasResolvidas)
  );
  const slaMedioMinutos = toNullableNum(
    src.sla_medio_minutos ?? pendObj.sla_medio_minutos ?? src.slaMedioMinutos
  );

  const femPorTipoRaw = src.femurn_por_tipo ?? femObj.por_tipo ?? femObj.por_ato_tipo;
  const femurnPorTipo = parseMapOrArrayToPairs(
    femPorTipoRaw,
    ['ato_tipo', 'tipo', 'categoria', 'label'],
    ['total', 'quantidade', 'count']
  ).map((p) => ({ tipo: p.label, total: p.total }));
  const femurnTotal = toInt(
    src.femurn_total ?? src.publicacoes_femurn_total ?? femObj.total ?? (typeof src.femurn === 'number' ? src.femurn : undefined),
    femurnPorTipo.reduce((acc, it) => acc + it.total, 0)
  );

  const mesPad = String(mes).padStart(2, '0');
  return {
    ano,
    mes,
    competencia: `${mesPad}/${ano}`,
    oficiosTotal,
    portariasTotal,
    portariasPorSubcategoria,
    licencasTotal: licTotal,
    licencasPorTipo,
    pendenciasRecebidas,
    pendenciasResolvidas,
    pendenciasAbertas,
    slaMedioMinutos,
    pendenciasPorSetor,
    femurnTotal,
    femurnPorTipo,
    documentosLista: Array.isArray(src.documentos_lista ?? docsObj.itens) ? (src.documentos_lista ?? docsObj.itens) : [],
    femurnLista: Array.isArray(src.femurn_lista ?? femObj.itens) ? (src.femurn_lista ?? femObj.itens) : [],
    origemDados: 'rpc'
  };
}

function gerarSvgBarrasHorizontais(
  items: Array<{ label: string; value: number; secondary?: number }>,
  opts: { primaryColor: string; secondaryColor?: string; emptyText: string; ariaLabel: string }
): string {
  if (!items || items.length === 0) {
    return `<div class="text-muted" style="padding: 18px 8px; font-size: 12.5px;">${esc(opts.emptyText)}</div>`;
  }

  const maxVal = Math.max(1, ...items.map((i) => Math.max(i.value, i.secondary || 0)));
  const rowH = 34;
  const padTop = 10;
  const labelW = 155;
  const rightPad = 56;
  const width = 520;
  const barMaxW = width - labelW - rightPad;
  const height = padTop + items.length * rowH + 10;

  const rowsSvg = items
    .map((item, idx) => {
      const y = padTop + idx * rowH;
      const w1 = Math.max(2, Math.round((item.value / maxVal) * barMaxW));
      const shortLabel = item.label.length > 22 ? item.label.slice(0, 20) + '…' : item.label;
      const valueText = item.secondary !== undefined ? `${item.value} / ${item.secondary}` : `${item.value}`;

      const bar2Svg =
        item.secondary !== undefined && opts.secondaryColor
          ? `<rect x="${labelW}" y="${y + 15}" width="${Math.max(2, Math.round((item.secondary / maxVal) * barMaxW))}" height="8" rx="4" fill="${esc(opts.secondaryColor)}" opacity="0.88" />`
          : '';

      return (
        `<g>` +
          `<text x="${labelW - 10}" y="${y + 15}" text-anchor="end" font-size="11.5" font-weight="600" fill="currentColor">${esc(shortLabel)}</text>` +
          `<rect x="${labelW}" y="${y + 4}" width="${barMaxW}" height="${item.secondary !== undefined ? 10 : 16}" rx="5" fill="var(--bg-tonal, #1F2533)" />` +
          `<rect x="${labelW}" y="${y + 4}" width="${w1}" height="${item.secondary !== undefined ? 10 : 16}" rx="5" fill="${esc(opts.primaryColor)}" />` +
          bar2Svg +
          `<text x="${labelW + barMaxW + 8}" y="${y + 16}" font-size="11.5" font-family="var(--font-mono, monospace)" font-weight="700" fill="currentColor">${esc(valueText)}</text>` +
        `</g>`
      );
    })
    .join('');

  return (
    `<svg class="relatorios-svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(opts.ariaLabel)}">` +
      `<title>${esc(opts.ariaLabel)}</title>` +
      rowsSvg +
    `</svg>`
  );
}

function renderizarRelatorioNaTela(rel: RelatorioMensalNormalizado): void {
  const mesNome = MESES_PT[rel.mes - 1] || String(rel.mes);
  const compText = `${mesNome}/${rel.ano} (${rel.competencia})`;

  const compBadge = document.getElementById('relatoriosCompetenciaBadge');
  if (compBadge) compBadge.textContent = `Competência ${rel.competencia}`;

  const printComp = document.getElementById('relatoriosPrintCompetencia');
  if (printComp) printComp.textContent = compText;
  const printTs = document.getElementById('relatoriosPrintTimestamp');
  if (printTs) printTs.textContent = new Date().toLocaleString('pt-BR');

  const setTxt = (id: string, txt: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt('kpiRelOficios', String(rel.oficiosTotal));
  setTxt('kpiRelOficiosSub', `Ofícios indexados em ${rel.competencia}`);

  setTxt('kpiRelPortarias', String(rel.portariasTotal));
  setTxt(
    'kpiRelPortariasSub',
    rel.portariasPorSubcategoria.length
      ? `${rel.portariasPorSubcategoria.length} subcategoria(s) com movimento`
      : 'Sem portarias registradas no mês'
  );

  setTxt('kpiRelLicencas', String(rel.licencasTotal));
  setTxt(
    'kpiRelLicencasSub',
    rel.licencasPorTipo.length
      ? rel.licencasPorTipo.map((x) => `${x.subcategoria}: ${x.total}`).join(' • ')
      : 'Prêmio, não remunerada e anulações'
  );

  setTxt('kpiRelPendencias', `${rel.pendenciasRecebidas} / ${rel.pendenciasResolvidas}`);
  const taxaRes = rel.pendenciasRecebidas > 0
    ? Math.round((rel.pendenciasResolvidas / rel.pendenciasRecebidas) * 100)
    : 100;
  setTxt('kpiRelPendenciasSub', `Resolução: ${taxaRes}% • Em aberto: ${rel.pendenciasAbertas}`);

  setTxt('kpiRelSlaMedio', formatarSlaMinutos(rel.slaMedioMinutos));
  setTxt('kpiRelSlaMedioSub', rel.slaMedioMinutos !== null ? `Média útil (${rel.slaMedioMinutos} min)` : 'Sem resoluções no período');

  setTxt('kpiRelFemurn', String(rel.femurnTotal));
  setTxt(
    'kpiRelFemurnSub',
    rel.femurnPorTipo.length
      ? rel.femurnPorTipo
          .map((f) => `${FEMURN_TIPO_LABELS[String(f.tipo || '').toUpperCase()] || f.tipo}: ${f.total}`)
          .slice(0, 3)
          .join(' • ')
      : `Atos FEMURN em ${rel.competencia}`
  );

  setTxt('relatoriosChartPortariasTotal', `${rel.portariasTotal} ato(s)`);
  const portChartWrap = document.getElementById('relatoriosChartPortariasSvgWrap');
  if (portChartWrap) {
    const chartItems = rel.portariasPorSubcategoria.map((s) => ({
      label: SUBCATEGORIA_LABELS[s.subcategoria] || s.subcategoria,
      value: s.total
    }));
    portChartWrap.innerHTML = gerarSvgBarrasHorizontais(chartItems, {
      primaryColor: 'var(--accent-primary, #4E8DF5)',
      emptyText: 'Nenhuma portaria contabilizada nesta competência.',
      ariaLabel: 'Gráfico de barras de portarias por subcategoria'
    });
  }

  setTxt('relatoriosChartPendenciasTotal', `${rel.pendenciasRecebidas} demanda(s)`);
  const pendChartWrap = document.getElementById('relatoriosChartPendenciasSetorSvgWrap');
  if (pendChartWrap) {
    const chartSetores = rel.pendenciasPorSetor.map((s) => ({
      label: s.setor,
      value: s.recebidas,
      secondary: s.resolvidas
    }));
    pendChartWrap.innerHTML = gerarSvgBarrasHorizontais(chartSetores, {
      primaryColor: 'var(--accent-primary, #4E8DF5)',
      secondaryColor: 'var(--success, #34D399)',
      emptyText: 'Nenhuma pendência registrada nesta competência.',
      ariaLabel: 'Gráfico de barras de pendências recebidas e resolvidas por setor'
    });
  }

  const tbodyDocs = document.getElementById('relatoriosTabelaDocumentosBody');
  if (tbodyDocs) {
    const linhasDocs: Array<{ label: string; total: number }> = [
      { label: 'Ofícios Emitidos', total: rel.oficiosTotal },
      ...rel.portariasPorSubcategoria.map((p) => ({
        label: `Portaria — ${SUBCATEGORIA_LABELS[p.subcategoria] || p.subcategoria}`,
        total: p.total
      })),
      { label: 'Licenças Registradas', total: rel.licencasTotal },
      { label: 'Publicações FEMURN', total: rel.femurnTotal }
    ];
    tbodyDocs.innerHTML = linhasDocs
      .map(
        (r) =>
          `<tr>` +
            `<td data-label="Categoria">${esc(r.label)}</td>` +
            `<td data-label="Quantidade" class="text-right"><strong>${esc(r.total)}</strong></td>` +
          `</tr>`
      )
      .join('');
  }

  const tbodySetores = document.getElementById('relatoriosTabelaSetoresBody');
  if (tbodySetores) {
    if (rel.pendenciasPorSetor.length === 0) {
      tbodySetores.innerHTML = '<tr><td colspan="4" class="text-muted text-center" style="padding: 18px;">Sem movimentação de pendências por setor neste mês.</td></tr>';
    } else {
      tbodySetores.innerHTML = rel.pendenciasPorSetor
        .map(
          (s) =>
            `<tr>` +
              `<td data-label="Setor">${esc(s.setor)}</td>` +
              `<td data-label="Recebidas" class="text-right">${esc(s.recebidas)}</td>` +
              `<td data-label="Resolvidas" class="text-right">${esc(s.resolvidas)}</td>` +
              `<td data-label="SLA Médio" class="text-right"><code>${esc(formatarSlaMinutos(s.slaMedioMinutos))}</code></td>` +
            `</tr>`
        )
        .join('');
    }
  }
}

async function fallbackConsultarTabelasDireto(client: any, ano: number, mes: number): Promise<RelatorioMensalNormalizado> {
  const mesStr = String(mes).padStart(2, '0');
  const startIso = `${ano}-${mesStr}-01T00:00:00Z`;
  const endIso = new Date(Date.UTC(ano, mes, 1)).toISOString();
  const startDate = `${ano}-${mesStr}-01`;
  const endDate = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);

  const [docsRes, pendRes, femRes, licRes] = await Promise.all([
    client.from('documentos_emitidos').select('tipo,subcategoria').gte('sincronizado_em', startIso).lt('sincronizado_em', endIso),
    client.from('pendencias_solicitacoes').select('setor,status,sla_estimado_minutos').gte('criado_em', startIso).lt('criado_em', endIso),
    client.from('publicacoes_diario').select('ato_tipo').gte('data_publicacao', startDate).lt('data_publicacao', endDate),
    client.from('licencas').select('tipo_licenca').gte('created_at', startIso).lt('created_at', endIso)
  ]);

  const docs = Array.isArray(docsRes?.data) ? docsRes.data : [];
  const pends = Array.isArray(pendRes?.data) ? pendRes.data : [];
  const fems = Array.isArray(femRes?.data) ? femRes.data : [];
  const lics = Array.isArray(licRes?.data) ? licRes.data : [];

  const subMap = new Map<string, number>();
  let oficiosTotal = 0;
  let portariasTotal = 0;
  for (const d of docs) {
    if (d.tipo === 'OFICIO') oficiosTotal++;
    else if (d.tipo === 'PORTARIA') {
      portariasTotal++;
      const sub = String(d.subcategoria || 'GERAL');
      subMap.set(sub, (subMap.get(sub) || 0) + 1);
    }
  }

  const setorMap = new Map<string, { rec: number; res: number; slaSum: number; slaCount: number }>();
  let resolvidas = 0;
  let slaTotal = 0;
  let slaCount = 0;
  for (const p of pends) {
    const setor = String(p.setor || 'Geral');
    const cur = setorMap.get(setor) || { rec: 0, res: 0, slaSum: 0, slaCount: 0 };
    cur.rec++;
    if (p.status === 'RESOLVIDO') {
      cur.res++;
      resolvidas++;
      if (typeof p.sla_estimado_minutos === 'number') {
        cur.slaSum += p.sla_estimado_minutos;
        cur.slaCount++;
        slaTotal += p.sla_estimado_minutos;
        slaCount++;
      }
    }
    setorMap.set(setor, cur);
  }

  const femMap = new Map<string, number>();
  for (const f of fems) {
    const t = String(f.ato_tipo || 'ATO_OFICIAL');
    femMap.set(t, (femMap.get(t) || 0) + 1);
  }

  const norm = normalizarPayloadRelatorio(
    {
      oficios_total: oficiosTotal,
      portarias_total: portariasTotal,
      portarias_por_subcategoria: Array.from(subMap.entries()).map(([subcategoria, total]) => ({ subcategoria, total })),
      licencas_total: lics.length,
      pendencias_recebidas: pends.length,
      pendencias_resolvidas: resolvidas,
      sla_medio_minutos: slaCount > 0 ? slaTotal / slaCount : null,
      pendencias_por_setor: Array.from(setorMap.entries()).map(([setor, st]) => ({
        setor,
        recebidas: st.rec,
        resolvidas: st.res,
        sla_medio_minutos: st.slaCount > 0 ? st.slaSum / st.slaCount : null
      })),
      femurn_total: fems.length,
      femurn_por_tipo: Array.from(femMap.entries()).map(([tipo, total]) => ({ tipo, total }))
    },
    ano,
    mes
  );
  norm.origemDados = 'fallback_tables';
  return norm;
}

export async function carregarRelatorioMensal(anoInput?: number, mesInput?: number): Promise<RelatorioMensalNormalizado | null> {
  if (carregando) return ultimoRelatorio;

  const anoSel = document.getElementById('relatoriosAnoSelect') as HTMLSelectElement | null;
  const mesSel = document.getElementById('relatoriosMesSelect') as HTMLSelectElement | null;
  const ano = anoInput || parseInt(anoSel?.value || String(new Date().getFullYear()), 10) || 2026;
  const mes = mesInput || parseInt(mesSel?.value || String(new Date().getMonth() + 1), 10) || 1;

  const statusBanner = document.getElementById('relatoriosStatusBanner');
  const btn = document.getElementById('btnGerarRelatorioMensal') as HTMLButtonElement | null;

  const client = window.OlymposSupabase?.getClient?.();
  if (!client) {
    if (statusBanner) {
      statusBanner.textContent = 'Cliente Supabase não inicializado. Autentique-se para gerar a prestação de contas.';
    }
    return null;
  }

  carregando = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Consolidando dados...';
  }
  if (statusBanner) {
    statusBanner.textContent = `Consultando prestação de contas oficial de ${String(mes).padStart(2, '0')}/${ano}...`;
  }

  try {
    let relatorio: RelatorioMensalNormalizado;
    const { data, error } = await client.rpc('rpc_relatorio_executivo_mensal', {
      p_ano: ano,
      p_mes: mes
    });

    if (error) {
      console.warn('[Relatórios] RPC rpc_relatorio_executivo_mensal indisponível ou retornou erro, tentando consolidação direta:', error.message);
      relatorio = await fallbackConsultarTabelasDireto(client, ano, mes);
      if (statusBanner) {
        statusBanner.textContent = `Relatório consolidado (${relatorio.competencia}) via consulta direta às tabelas operacionais.`;
      }
    } else {
      relatorio = normalizarPayloadRelatorio(data, ano, mes);
      if (statusBanner) {
        statusBanner.textContent = `Prestação de contas oficial (${relatorio.competencia}) gerada com sucesso via Supabase RPC.`;
      }
    }

    ultimoRelatorio = relatorio;
    renderizarRelatorioNaTela(relatorio);
    return relatorio;
  } catch (err: any) {
    if (statusBanner) {
      statusBanner.textContent = `Falha ao consolidar relatório mensal: ${err?.message || 'erro desconhecido'}`;
    }
    window.OlymposApp?.showToast?.(`Erro ao gerar relatório: ${err?.message || 'falha'}`, true);
    return null;
  } finally {
    carregando = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Gerar Prestação de Contas';
    }
  }
}

export function exportarRelatorioPdf1Clique(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  document.body.classList.add('printing-relatorio');
  const limpar = () => {
    document.body.classList.remove('printing-relatorio');
    window.removeEventListener('afterprint', limpar);
  };
  window.addEventListener('afterprint', limpar);
  window.print();
  setTimeout(limpar, 1500);
}

export function construirWorkbookRelatorioXlsx(XLSX: any, rel: RelatorioMensalNormalizado): any {
  const wb = XLSX.utils.book_new();

  const resumoRows = [
    { Indicador: 'Competência', Valor: rel.competencia },
    { Indicador: 'Ofícios Emitidos', Valor: rel.oficiosTotal },
    { Indicador: 'Portarias Emitidas', Valor: rel.portariasTotal },
    { Indicador: 'Licenças Funcionais', Valor: rel.licencasTotal },
    { Indicador: 'Pendências Recebidas', Valor: rel.pendenciasRecebidas },
    { Indicador: 'Pendências Resolvidas', Valor: rel.pendenciasResolvidas },
    { Indicador: 'Pendências em Aberto', Valor: rel.pendenciasAbertas },
    { Indicador: 'SLA Médio Útil', Valor: formatarSlaMinutos(rel.slaMedioMinutos) },
    { Indicador: 'Publicações FEMURN', Valor: rel.femurnTotal }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), 'Resumo');

  const oficiosPortariasRows = [
    { Tipo: 'OFICIO', Subcategoria: 'GERAL', Quantidade: rel.oficiosTotal },
    ...rel.portariasPorSubcategoria.map((p) => ({
      Tipo: 'PORTARIA',
      Subcategoria: SUBCATEGORIA_LABELS[p.subcategoria] || p.subcategoria,
      Quantidade: p.total
    })),
    ...(rel.documentosLista.length > 0
      ? rel.documentosLista.map((d) => ({
          Tipo: String(d.tipo || ''),
          Subcategoria: String(d.subcategoria || ''),
          Numero: d.numero ?? '',
          Arquivo: String(d.nome_arquivo || d.titulo || ''),
          Destinatario_Servidor: String(d.destinatario_ou_servidor || '')
        }))
      : [])
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(oficiosPortariasRows.length ? oficiosPortariasRows : [{ Info: 'Sem documentos no período' }]),
    'Oficios_Portarias'
  );

  const pendenciasSlaRows = rel.pendenciasPorSetor.length
    ? rel.pendenciasPorSetor.map((s) => ({
        Setor: s.setor,
        Recebidas: s.recebidas,
        Resolvidas: s.resolvidas,
        Abertas: Math.max(0, s.recebidas - s.resolvidas),
        SLA_Medio_Minutos: s.slaMedioMinutos ?? '--',
        SLA_Medio_Formatado: formatarSlaMinutos(s.slaMedioMinutos)
      }))
    : [
        {
          Setor: 'Consolidado Geral',
          Recebidas: rel.pendenciasRecebidas,
          Resolvidas: rel.pendenciasResolvidas,
          Abertas: rel.pendenciasAbertas,
          SLA_Medio_Minutos: rel.slaMedioMinutos ?? '--',
          SLA_Medio_Formatado: formatarSlaMinutos(rel.slaMedioMinutos)
        }
      ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendenciasSlaRows), 'Pendencias_SLA');

  const femurnRows =
    rel.femurnLista.length > 0
      ? rel.femurnLista.map((f) => ({
          Data: String(f.data_publicacao || ''),
          Codigo_FEMURN: String(f.codigo_femurn || ''),
          Tipo: String(f.ato_tipo || ''),
          Orgao: String(f.orgao || ''),
          Titulo: String(f.titulo || '')
        }))
      : (rel.femurnPorTipo.length > 0
          ? rel.femurnPorTipo.map((f) => ({
              Tipo_Ato: f.tipo,
              Quantidade: f.total
            }))
          : [{ Info: `Total de publicações FEMURN em ${rel.competencia}: ${rel.femurnTotal}` }]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(femurnRows), 'FEMURN');

  return wb;
}

export async function exportarRelatorioXlsxMultiAbas(relInput?: RelatorioMensalNormalizado | null): Promise<void> {
  const rel = relInput || ultimoRelatorio;
  if (!rel) {
    window.OlymposApp?.showToast?.('Gere a prestação de contas antes de exportar o XLSX.', true);
    return;
  }

  const btn = typeof document !== 'undefined'
    ? (document.getElementById('btnExportarRelatorioXlsx') as HTMLButtonElement | null)
    : null;
  if (btn) btn.disabled = true;

  try {
    // Importação estritamente dinâmica para manter xlsx fora de main-*.js
    const XLSX = await import('xlsx');
    const wb = construirWorkbookRelatorioXlsx(XLSX, rel);
    const fileName = `Relatorio_Executivo_SMEB_${rel.ano}_${String(rel.mes).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    window.OlymposApp?.showToast?.(`Planilha ${fileName} exportada com 4 abas!`);
  } catch (err: any) {
    window.OlymposApp?.showToast?.(`Falha ao exportar XLSX: ${err?.message || 'erro'}`, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindEvents(): void {
  const anoSel = document.getElementById('relatoriosAnoSelect') as HTMLSelectElement | null;
  const mesSel = document.getElementById('relatoriosMesSelect') as HTMLSelectElement | null;
  const now = new Date();
  if (anoSel && !anoSel.dataset.initDefault) {
    anoSel.dataset.initDefault = '1';
    const curYear = String(now.getFullYear());
    if (Array.from(anoSel.options).some((o) => o.value === curYear)) {
      anoSel.value = curYear;
    }
  }
  if (mesSel && !mesSel.dataset.initDefault) {
    mesSel.dataset.initDefault = '1';
    mesSel.value = String(now.getMonth() + 1);
  }

  const bindClick = (id: string, fn: () => void) => {
    const el = document.getElementById(id) as any;
    if (el && !el._boundRelatorio) {
      el._boundRelatorio = true;
      el.addEventListener('click', fn);
    }
  };

  bindClick('btnGerarRelatorioMensal', () => {
    void carregarRelatorioMensal();
  });

  bindClick('btnExportarRelatorioPdf', () => {
    exportarRelatorioPdf1Clique();
  });

  bindClick('btnExportarRelatorioXlsx', () => {
    void exportarRelatorioXlsxMultiAbas();
  });
}

const relatoriosView = {
  init() {
    bindEvents();
    void carregarRelatorioMensal();
  },
  carregarRelatorioMensal,
  exportarRelatorioPdf1Clique,
  exportarRelatorioXlsxMultiAbas
};

if (typeof window !== 'undefined') {
  window.OlymposViews = window.OlymposViews || {};
  window.OlymposViews.relatorios = relatoriosView;
}

export async function mount(): Promise<void> {
  bindEvents();
}
