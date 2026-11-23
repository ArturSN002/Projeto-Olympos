/**
 * Utilitários compartilhados do módulo Processos Seletivos (Onda 5 — Motor Niké).
 * Mantém zero dependência no entry bundle e reuso seguro de piiMask, pdfBundler e Supabase/GAS Gateway.
 */

export interface PssEdital {
  id: string;
  numero_edital: string;
  titulo: string;
  ano: number;
  status: string;
  vigencia_inicio?: string | null;
  vigencia_fim?: string | null;
  regra_duplicidade: 'POR_EDITAL' | 'POR_EDITAL_CARGO';
  planilha_origem_id?: string | null;
  aba_origem_nome?: string | null;
  mapping_config_json?: Record<string, any> | null;
  criterios_desempate_json?: string[] | null;
}

export interface PssSegmento {
  id: string;
  edital_id: string;
  cargo_nome: string;
  regiao_nome?: string | null;
  vagas_imediatas: number;
  vagas_cr: number;
  exige_certificacao: boolean;
  certificacoes_exigidas_json?: string[] | null;
}

export interface PssEtapaConfig {
  id: string;
  edital_id: string;
  cargo_nome?: string | null;
  ordem: number;
  titulo_etapa: string;
  tipo_etapa: 'TRIAGEM_DOCUMENTAL' | 'TITULOS' | 'CHECKLIST_HABILITACAO' | 'ENTREVISTA' | 'PROVA_PRATICA';
  carater: 'CLASSIFICATORIO' | 'ELIMINATORIO' | 'MISTO';
  nota_minima: number;
  peso: number;
  permite_recurso: boolean;
  status_etapa: 'CONFIGURADA' | 'EM_AVALIACAO' | 'CONGELADA' | 'HOMOLOGADA';
}

export function escPss(val: unknown): string {
  if (val === null || val === undefined) return '';
  const app = typeof window !== 'undefined' ? window.OlymposApp : null;
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

export function maskCpfSafe(rawCpf: unknown): string {
  const s = String(rawCpf || '');
  if (typeof window !== 'undefined' && window.OlymposPiiMask?.maskCpf) {
    if (s.includes('***')) return s;
    return window.OlymposPiiMask.maskCpf(s);
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  return '***.***.***-**';
}

export function getSupabaseClientPss(): any {
  return typeof window !== 'undefined' ? window.OlymposSupabase?.getClient?.() || null : null;
}

export function notifyPss(msg: string, isError = false): void {
  if (typeof window !== 'undefined' && window.OlymposApp?.showToast) {
    window.OlymposApp.showToast(msg, isError);
  }
  if (typeof window !== 'undefined' && window.OlymposShortcuts?.anunciarLeitorTela) {
    window.OlymposShortcuts.anunciarLeitorTela(msg, isError);
  }
}

export async function callGasGatewayPss(action: string, dados: Record<string, any> = {}): Promise<any> {
  if (typeof window !== 'undefined' && window.OlymposApi && typeof window.OlymposApi.request === 'function') {
    return window.OlymposApi.request(action, { dados });
  }
  throw new Error('Gateway Zero-Trust OlymposApi indisponível.');
}

/**
 * Resolve mapeamento N:1 (COALESCE de múltiplas colunas condicionais do Google Forms)
 * e detecta conflitos quando mais de uma coluna condicional está preenchida na mesma linha.
 */
export function resolveConditionalMapping(
  rawRow: Record<string, unknown>,
  mapping: {
    nome_completo?: string;
    cpf?: string;
    data_nascimento?: string;
    email?: string;
    telefone?: string;
    timestamp?: string;
    cargo_cols?: string[];
    regiao_cols?: string[];
  }
): {
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  submitted_at: string;
  cargo_alvo: string;
  regiao_alvo: string;
  hasConflict: boolean;
  conflictReason: string;
} {
  const row = rawRow || {};
  const pick1to1 = (col?: string) => (col ? String(row[col] ?? '').trim() : '');
  const pickNto1 = (cols?: string[]) => {
    const filled: string[] = [];
    for (const c of Array.isArray(cols) ? cols : []) {
      const val = String(row[c] ?? '').trim();
      if (val) filled.push(val);
    }
    return { first: filled[0] || '', count: filled.length };
  };

  const cargoRes = pickNto1(mapping.cargo_cols);
  const regiaoRes = pickNto1(mapping.regiao_cols);
  const reasons: string[] = [];
  if (cargoRes.count > 1) reasons.push(`Múltiplas colunas de Cargo preenchidas (${cargoRes.count})`);
  if (cargoRes.count === 0 && (mapping.cargo_cols?.length || 0) > 0) reasons.push('Cargo ausente nas colunas condicionais');
  if (regiaoRes.count > 1) reasons.push(`Múltiplas colunas de Região preenchidas (${regiaoRes.count})`);

  return {
    nome_completo: pick1to1(mapping.nome_completo),
    cpf: pick1to1(mapping.cpf),
    data_nascimento: pick1to1(mapping.data_nascimento),
    email: pick1to1(mapping.email),
    telefone: pick1to1(mapping.telefone),
    submitted_at: pick1to1(mapping.timestamp),
    cargo_alvo: cargoRes.first,
    regiao_alvo: regiaoRes.first,
    hasConflict: reasons.length > 0,
    conflictReason: reasons.join(' | ')
  };
}

/**
 * Higieniza qualquer item antes de publicação pública (Google Docs / PDF FEMURN):
 * remove e-mail, telefone e endereço e garante CPF mascarado no padrão ***.XXX.YYY-**.
 */
export function sanitizarRegistroPublicacaoPss(row: Record<string, any>): {
  posicao: number;
  numero_inscricao: string;
  nome_completo: string;
  cpf_mascarado: string;
  cargo_nome: string;
  regiao_nome: string;
  nota_total: number;
  situacao: string;
} {
  return {
    posicao: Number(row.posicao || row.posicao_classificacao || 0),
    numero_inscricao: String(row.numero_inscricao || '--'),
    nome_completo: String(row.nome_completo || '--'),
    cpf_mascarado: maskCpfSafe(row.cpf_mascarado || row.cpf || ''),
    cargo_nome: String(row.cargo_nome || 'Geral'),
    regiao_nome: String(row.regiao_nome || 'Município Único'),
    nota_total: Number(row.nota_total ?? 0),
    situacao: String(row.situacao || row.status_pos_chamada || 'CLASSIFICADO')
  };
}
