/**
 * @fileoverview Módulo 1 — Fogo de Prometheus (Receptor de Publicações FEMURN, Planilha-Índice NER e Resumos no Google Chat).
 * Versão 2.0.0 — Fixação da Planilha Única e Prevenção de Duplicidades.
 */

const PROMETHEUS_CONFIG = {
  FOLDER_PORTARIAS_2026: OLYMPOS_IDS.SETORES_2026.PORTARIAS,
  FOLDER_GABINETE_2026: OLYMPOS_IDS.SETORES_2026.GABINETE,
  FOLDER_JURIDICO_2026: OLYMPOS_IDS.SETORES_2026.ASSESSORIA_JURIDICA,
  FOLDER_RAIZ_SMEB: OLYMPOS_IDS.RAIZ_SMEB,
  PROP_LAST_SYNC: 'PROMETHEUS_LAST_SYNC_META',
  PLANILHA_ID_OFICIAL: OLYMPOS_IDS.PLANILHA_DIARIO_OFICIAL || '1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY',
  ABA_DESTINO: OLYMPOS_IDS.ABA_DIARIO_OFICIAL || 'Publicações'
};

/**
 * Extrai ou normaliza entidades estruturadas (NER: Servidores, Matrículas, Nº do Ato).
 */
function extrairEntidadesNerPrometheus_(pub) {
  if (pub.entidades_ner && (pub.entidades_ner.numero_ato || (pub.entidades_ner.servidores && pub.entidades_ner.servidores.length))) {
    return {
      numeroAto: pub.entidades_ner.numero_ato || '',
      servidores: pub.entidades_ner.servidores || [],
      matriculas: pub.entidades_ner.matriculas || []
    };
  }

  const texto = `${pub.titulo_ato || pub.resumo || ''} ${pub.resumo_texto || ''}`;
  const mNum = texto.match(/(?:(?:REPUBLICA[ÇC][ÃA]O(?:\s+POR\s+INCORRE[ÇC][ÃA]O)?|REPUBLICAD[OA](?:\s+POR\s+INCORRE[ÇC][ÃA]O)?)\s+(?:D[AEO]\s+)?(?:PORTARIA|EDITAL|DECRETO|LEI|EXTRATO|CONTRATO)|PORTARIA|EDITAL|DECRETO|LEI|REPUBLICA[ÇC][ÃA]O|REPUBLICAD[OA]|EXTRATO|CONTRATO)(?:[^\d\n]{1,40})?(?:N[º°.]?\s*)?(\d{1,4}(?:[.]\d{3})?(?:[.\/\-]\d{2,4})?)/i);
  const numeroAto = mNum ? mNum[1] : '';

  const matriculas = [];
  const regMat = /matr[íi]cula(?:\s*n[º°.]?)?\s*[:\-]?\s*([\d.\-\/]{2,14})/gi;
  let m;
  while ((m = regMat.exec(texto)) !== null) {
    if (matriculas.indexOf(m[1]) === -1) matriculas.push(m[1]);
  }

  const servidores = [];
  const padroesSrv = [
    /servidor(?:\(a\)|a)?\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s']{5,65}?)(?=\s*[-–,]\s*matr[íi]cula|\s*,\s*matr[íi]cula|\s*,\s*portador|\s*,\s*ocupante|\s*,\s*lotad)/gi,
    /(?:conceder|concede|designar|designa|nomear|nomeia|exonerar|exonera|readaptar|readapta)\s+(?:(?:a|o|ao|à|o\(a\)|a\(o\))\s+servidor(?:\(a\)|a)?\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s']{5,65}?)(?=\s*[-–,]\s*matr[íi]cula|\s*,\s*matr[íi]cula|\s*,\s*CPF)/gi,
    /(?:nomear|nomeia|designar|designa)\s+(?:a\s+senhora|o\s+senhor|o\(a\)\s+servidor\(a\)|a\s+servidora|o\s+servidor)?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s']{5,65}?)(?=\s*,\s*para\s+|\s+para\s+(?:exercer|ocupar|responder|assumir|a\s+fun[çc][ãa]o|o\s+cargo))/gi,
    /(?:cargo\s+em\s+comissão|função\s+gratificada)\s+de\s+diretor(?:a)?\s+(?:escolar|de\s+escola)[^,\n]*?,\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s']{5,65}?)(?=\s*[-–,.\n]|\s+matr[íi]cula)/gi
  ];
  padroesSrv.forEach(function(reg) {
    let matchSrv;
    while ((matchSrv = reg.exec(texto)) !== null) {
      const nome = matchSrv[1].replace(/\s+/g, ' ').replace(/^[-–,.\s]+|[-–,.\s]+$/g, '').trim().toUpperCase();
      if (nome.split(' ').length >= 2 && servidores.indexOf(nome) === -1) {
        servidores.push(nome);
      }
    }
  });

  return { numeroAto: numeroAto, servidores: servidores, matriculas: matriculas };
}

/**
 * Alimenta EXCLUSIVAMENTE a planilha-índice oficial (ID Fixo: 1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY).
 * VEDAÇÃO ABSOLUTA: Jamais cria uma nova planilha.
 * Deduplica registros por Código FEMURN + Data para garantir idempotência.
 */
function registrarIndicePlanilhaDiarioOficial2026(resultadosSalvos) {
  if (!resultadosSalvos || resultadosSalvos.length === 0) return null;
  const planilhaId = PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL;

  try {
    let ss = null;
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.openById) {
      ss = SpreadsheetApp.openById(planilhaId);
    }
    if (!ss) {
      console.error(`Falha crítica: Não foi possível abrir a planilha oficial de Diário Oficial (ID: ${planilhaId}).`);
      registrarAlertaMemoriaOlympos('_memoria_helio.md', `[FALHA PLANILHA]: Impossível abrir planilha oficial do Diário Oficial.`);
      return null;
    }

    let sheet = ss.getSheetByName(PROMETHEUS_CONFIG.ABA_DESTINO);
    if (!sheet) {
      // Se não existir a aba nomeada, tenta a primeira aba ou cria a aba na MESMA planilha
      sheet = ss.getSheets()[0] || ss.insertSheet(PROMETHEUS_CONFIG.ABA_DESTINO);
    }

    const lastRow = sheet.getLastRow();
    const codigosExistentes = new Set();

    if (lastRow === 0) {
      sheet.appendRow([
        'Data Circulação',
        'Código FEMURN',
        'Órgão',
        'Categoria',
        'Nº do Ato',
        'Título do Ato',
        'Servidores Identificados (NER)',
        'Matrículas',
        'URL do PDF no Drive'
      ]);
    } else if (lastRow > 1) {
      // Lê coluna de códigos (Coluna B) para deduplicação
      const dadosColCodigo = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      dadosColCodigo.forEach(r => {
        const cod = String(r[0] || '').trim();
        if (cod) codigosExistentes.add(cod);
      });
    }

    const linhasParaInserir = [];
    resultadosSalvos.forEach(r => {
      const chaveCod = String(r.codigo || '').trim();
      if (chaveCod && codigosExistentes.has(chaveCod)) {
        // Já indexado nesta planilha
        return;
      }

      linhasParaInserir.push([
        r.data,
        r.codigo,
        r.orgao,
        r.categoria,
        r.numeroAto || '',
        r.titulo,
        (r.servidores || []).join(', '),
        (r.matriculas || []).join(', '),
        r.urlDrive
      ]);
      if (chaveCod) codigosExistentes.add(chaveCod);
    });

    if (linhasParaInserir.length > 0) {
      const proximaLinha = sheet.getLastRow() + 1;
      sheet.getRange(proximaLinha, 1, linhasParaInserir.length, 9).setValues(linhasParaInserir);
      SpreadsheetApp.flush();
    }

    return {
      planilha: ss.getName(),
      id: planilhaId,
      linhasInseridas: linhasParaInserir.length,
      duplicadasIgnoradas: resultadosSalvos.length - linhasParaInserir.length
    };
  } catch (e) {
    console.error('Erro crítico ao gravar índice na planilha oficial:', e);
    registrarAlertaMemoriaOlympos('_memoria_helio.md', `[ERRO PLANILHA FEMURN]: ${e.message}`);
    return null;
  }
}

/**
 * Extrai e valida a lista de destinatários de e-mail do Boletim Diário a partir das ScriptProperties.
 * Suporta separação por vírgula, ponto-e-vírgula ou espaços ([,;\s]+), com deduplicação e validação regex.
 * Fallback em cadeia: BOLETIM_DESTINATARIOS_EMAIL -> EMAIL_PARTICULAR -> EMAIL_RESUMO_PARTICULAR.
 * @param {GoogleAppsScript.Properties.Properties} [propsOpt]
 * @param {string} [overrideStr]
 * @return {string[]} Lista de endereços de e-mail válidos
 */
function extrairDestinatariosBoletimPrometheus_(propsOpt, overrideStr) {
  const props = propsOpt || PropertiesService.getScriptProperties();
  const raw = overrideStr ||
    props.getProperty('BOLETIM_DESTINATARIOS_EMAIL') ||
    props.getProperty('EMAIL_PARTICULAR') ||
    props.getProperty('EMAIL_RESUMO_PARTICULAR') ||
    '';

  if (!raw || typeof raw !== 'string') return [];

  const partes = raw.replace(/[;\t\r\n]+/g, ',').split(',');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validos = [];

  partes.forEach(function(item) {
    const limpo = String(item || '').trim().toLowerCase();
    if (limpo && emailRegex.test(limpo) && validos.indexOf(limpo) === -1) {
      validos.push(limpo);
    }
  });

  return validos;
}

/**
 * Monta o corpo de e-mail em HTML editorial responsivo para o Boletim Diário Executivo.
 * Utiliza paleta institucional Olympos (#0B1120, #D4AF37), tipografia limpa, badges de atos,
 * entidades NER (servidores e matrículas), extrato do teor e botão de 1 clique para o Drive.
 */
function montarHtmlBoletimEditorial_(dataRef, resultadosSalvos) {
  const total = (resultadosSalvos || []).length;
  const dataExtenso = formatarDataPorExtensoPtBr_(dataRef);

  // Mapeamento de contagem por categoria
  const contadores = {};
  (resultadosSalvos || []).forEach(function(r) {
    const cat = String(r.categoria || 'ATO_GABINETE').toUpperCase();
    contadores[cat] = (contadores[cat] || 0) + 1;
  });

  const badgesResumo = Object.keys(contadores).map(function(c) {
    return '<span style="display:inline-block;padding:3px 9px;margin:2px 4px;background-color:#E2E8F0;color:#1E293B;border-radius:12px;font-size:11.5px;font-weight:600;">' + c + ': ' + contadores[c] + '</span>';
  }).join(' ');

  const cardsHtml = (resultadosSalvos || []).map(function(r) {
    const cat = String(r.categoria || 'ATO_GABINETE').toUpperCase();
    let badgeBg = '#DBEAFE';
    let badgeColor = '#1E40AF';
    if (cat.includes('REPUBLIC')) {
      badgeBg = '#FEE2E2'; badgeColor = '#991B1B';
    } else if (cat.includes('DIRETOR') || cat.includes('NOMEACAO')) {
      badgeBg = '#E0E7FF'; badgeColor = '#3730A3';
    } else if (cat.includes('EDITAL') || cat.includes('PSS')) {
      badgeBg = '#F3E8FF'; badgeColor = '#6B21A8';
    } else if (cat.includes('DECRETO') || cat.includes('LEI') || cat.includes('NORMATIVO')) {
      badgeBg = '#FEF3C7'; badgeColor = '#92400E';
    } else if (cat.includes('PERMUTA') || cat.includes('CESS')) {
      badgeBg = '#D1FAE5'; badgeColor = '#065F46';
    }

    const nerPartes = [];
    if (r.servidores && r.servidores.length > 0) {
      nerPartes.push('👤 <b>Servidor(es):</b> ' + r.servidores.join(', '));
    }
    if (r.matriculas && r.matriculas.length > 0) {
      nerPartes.push('🏷️ <b>Matrícula(s):</b> ' + r.matriculas.join(', '));
    }

    const nerBox = nerPartes.length > 0
      ? '<div style="margin:9px 0 8px;padding:8px 12px;background-color:#F8FAFC;border-left:3px solid #D4AF37;border-radius:4px;font-size:12px;color:#334155;line-height:1.45;">' + nerPartes.join('<br>') + '</div>'
      : '';

    const resumoTexto = r.resumo || '';
    const resumoSnippet = resumoTexto
      ? '<p style="margin:8px 0 10px;font-size:12.5px;color:#475569;line-height:1.5;">' + String(resumoTexto).substring(0, 260) + (resumoTexto.length > 260 ? '...' : '') + '</p>'
      : '';

    const urlDrive = r.urlDrive || '#';

    return `
      <div style="margin-bottom:16px;padding:16px;background-color:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;box-shadow:0 1px 3px rgba(15,23,42,0.04);">
        <div style="margin-bottom:6px;">
          <span style="display:inline-block;padding:2px 8px;background-color:${badgeBg};color:${badgeColor};font-size:11px;font-weight:700;border-radius:4px;text-transform:uppercase;">${cat}</span>
          <span style="font-size:12px;color:#64748B;margin-left:8px;">${r.orgao || 'SMEB'}${r.codigo ? ' • Cód. ' + r.codigo : ''}</span>
        </div>
        <h3 style="margin:4px 0 6px;font-size:15px;font-weight:700;color:#0F172A;line-height:1.35;">${r.titulo}</h3>
        ${nerBox}
        ${resumoSnippet}
        <div style="margin-top:10px;">
          <a href="${urlDrive}" target="_blank" style="display:inline-block;padding:8px 16px;background-color:#0B1120;color:#D4AF37;text-decoration:none;font-size:12px;font-weight:700;border-radius:6px;border:1px solid #D4AF37;">
            📄 Abrir PDF no Google Drive ➔
          </a>
        </div>
      </div>
    `;
  }).join('');

  const planilhaId = PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Boletim Diário Executivo FEMURN</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F1F5F9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:660px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.08);border:1px solid #E2E8F0;">
          <tr>
            <td style="background-color:#0B1120;padding:28px 24px;border-bottom:3px solid #D4AF37;">
              <div style="display:inline-block;padding:4px 10px;background-color:rgba(212,175,55,0.15);border:1px solid #D4AF37;border-radius:20px;color:#D4AF37;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;">
                GOVERNANÇA EXECUTIVA • SMEB 2026
              </div>
              <h1 style="margin:0 0 6px;color:#FFFFFF;font-size:21px;font-weight:700;line-height:1.25;">
                🔥 Boletim Diário Executivo FEMURN
              </h1>
              <p style="margin:0;color:#94A3B8;font-size:13px;line-height:1.4;">
                Secretaria Municipal de Educação Básica • Prefeitura de Ceará-Mirim/RN
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:16px 24px;border-bottom:1px solid #E2E8F0;">
              <div style="font-size:13px;color:#334155;line-height:1.5;">
                📅 <strong>Edição:</strong> ${dataExtenso || dataRef} &nbsp;•&nbsp;
                📊 <strong>Total de Atos:</strong> <b>${total} publicação(ões)</b>
              </div>
              ${badgesResumo ? `<div style="margin-top:8px;">${badgesResumo}</div>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 20px;">
              ${total > 0 ? cardsHtml : '<div style="padding:24px;text-align:center;background:#F8FAFC;border-radius:8px;color:#64748B;">ℹ️ Nenhuma publicação referente à Educação / SMEB foi localizada nesta edição.</div>'}
            </td>
          </tr>
          <tr>
            <td style="background-color:#F8FAFC;padding:18px 20px;border-top:1px solid #E2E8F0;text-align:center;">
              <a href="https://docs.google.com/spreadsheets/d/${planilhaId}/edit" target="_blank" style="display:inline-block;padding:9px 16px;background-color:#0B1120;color:#FFFFFF;text-decoration:none;font-size:12.5px;font-weight:600;border-radius:6px;">
                📊 Abrir Planilha Oficial Diário 2026 ↗
              </a>
              <p style="margin:14px 0 0;font-size:11px;color:#94A3B8;line-height:1.4;">
                Informativo matinal automatizado gerado pelo motor <strong>Fogo de Prometheus</strong>.<br>
                Configurado via Script Properties (<code>BOLETIM_DESTINATARIOS_EMAIL</code>).
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Despacha o Boletim Executivo por e-mail para a lista configurada de múltiplos destinatários.
 */
function enviarBoletimExecutivoEmail(dataRef, resultadosSalvos, destinatariosOverride) {
  const destinatarios = extrairDestinatariosBoletimPrometheus_(null, destinatariosOverride);
  if (!destinatarios || destinatarios.length === 0) {
    return { enviado: false, motivo: 'Nenhum destinatário de e-mail válido configurado.' };
  }

  if (typeof MailApp === 'undefined' || !MailApp.sendEmail) {
    return { enviado: false, motivo: 'Serviço MailApp indisponível neste ambiente de execução.' };
  }

  const total = (resultadosSalvos || []).length;
  const assunto = `🔥 [Fogo de Prometheus] Boletim Executivo FEMURN (${dataRef}) — ${total} ato(s)`;
  const htmlBody = montarHtmlBoletimEditorial_(dataRef, resultadosSalvos);

  const linhasTexto = [
    `🔥 Boletim Diário Executivo FEMURN (${dataRef})`,
    `Secretaria Municipal de Educação Básica • SMEB Ceará-Mirim/RN`,
    `Total de Atos Identificados: ${total}`,
    ''
  ];
  (resultadosSalvos || []).forEach(function(r, i) {
    linhasTexto.push(`${i + 1}. [${r.categoria}] ${r.titulo} (${r.orgao || 'SMEB'})`);
    if (r.servidores && r.servidores.length) {
      linhasTexto.push(`   Servidores: ${r.servidores.join(', ')}`);
    }
    if (r.matriculas && r.matriculas.length) {
      linhasTexto.push(`   Matrículas: ${r.matriculas.join(', ')}`);
    }
    if (r.resumo) {
      linhasTexto.push(`   Resumo: ${String(r.resumo).substring(0, 180)}`);
    }
    linhasTexto.push(`   PDF Drive: ${r.urlDrive}`);
    linhasTexto.push('');
  });

  try {
    MailApp.sendEmail({
      to: destinatarios.join(', '),
      subject: assunto,
      body: linhasTexto.join('\n'),
      htmlBody: htmlBody
    });
    return {
      enviado: true,
      destinatarios: destinatarios,
      totalDestinatarios: destinatarios.length,
      totalAtos: total
    };
  } catch (err) {
    console.error('Falha ao enviar Boletim Executivo via MailApp:', err);
    return { enviado: false, erro: err.message };
  }
}

/**
 * Envia o Resumo Executivo de publicações para o Espaço do Google Chat da SMEB e E-mail Institucional.
 */
function enviarResumoEspacoGoogleChat(dataRef, resultadosSalvos) {
  const props = PropertiesService.getScriptProperties();
  const chatWebhookUrl = (props.getProperty('GOOGLE_CHAT_WEBHOOK_URL') || '').trim();
  const total = (resultadosSalvos || []).length;

  const linhasTexto = [
    `🔥 *Fogo de Prometheus — Resumo Diário FEMURN (${dataRef})*`,
    total > 0
      ? `📌 *${total} publicação(ões)* da Educação / SMEB Ceará-Mirim arquivada(s) no Google Drive:`
      : `ℹ️ Nenhuma publicação referente à SMEB / Educação foi localizada na edição de ${dataRef}.`
  ];

  const widgets = [];
  (resultadosSalvos || []).slice(0, 15).forEach((r, idx) => {
    const infoNer = (r.servidores && r.servidores.length > 0)
      ? ` | 👤 ${r.servidores.join(', ')}${r.matriculas && r.matriculas.length ? ` (Mat. ${r.matriculas.join(', ')})` : ''}`
      : '';
    linhasTexto.push(`${idx + 1}. *[${r.categoria}]* ${r.titulo} (${r.orgao || 'SMEB'})${infoNer} • <${r.urlDrive}|Abrir PDF>`);

    widgets.push({
      decoratedText: {
        topLabel: `${r.categoria} • ${r.orgao || 'SMEB'}`,
        text: `<b>${r.titulo}</b>${infoNer}`,
        wrapText: true,
        button: {
          text: 'Abrir PDF',
          onClick: { openLink: { url: r.urlDrive } }
        }
      }
    });
  });

  const payloadChat = {
    text: linhasTexto.join('\n'),
    cardsV2: total > 0 ? [{
      cardId: `prometheus-hub-${String(dataRef).replace(/\//g, '-')}`,
      card: {
        header: {
          title: '🔥 Fogo de Prometheus — Resumo Diário FEMURN',
          subtitle: `SMEB Ceará-Mirim/RN • Edição ${dataRef} (${total} atos)`
        },
        sections: [{ widgets: widgets }]
      }
    }] : []
  };

  let enviadoChat = false;

  if (chatWebhookUrl && chatWebhookUrl.startsWith('https://chat.googleapis.com/') && typeof UrlFetchApp !== 'undefined' && UrlFetchApp.fetch) {
    try {
      UrlFetchApp.fetch(chatWebhookUrl, {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        payload: JSON.stringify(payloadChat),
        muteHttpExceptions: true
      });
      enviadoChat = true;
    } catch (e) {
      console.warn('Falha no webhook Google Chat:', e);
    }
  }

  // Disparo do Boletim Diário Executivo via MailApp para múltiplos destinatários
  const resultadoEmail = enviarBoletimExecutivoEmail(dataRef, resultadosSalvos);

  return {
    enviado: enviadoChat || resultadoEmail.enviado,
    viaChat: enviadoChat,
    viaEmail: resultadoEmail.enviado,
    totalAtos: total,
    detalheEmail: resultadoEmail
  };
}

/**
 * Permite disparar manualmente o Resumo Executivo ao Espaço do Google Chat ou e-mail pelo Hub Olympos.
 */
function dispararResumoGoogleChatManual() {
  const painel = carregarPainelPrometheus();
  const dataRef = Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy');
  const itensConvertidos = (painel.arquivosDrive || []).slice(0, 10).map((arq, i) => ({
    codigo: `DOC${i + 1}`,
    data: dataRef,
    orgao: arq.setor,
    categoria: arq.setor.includes('Portarias') ? 'PORTARIA' : 'ATO_GABINETE',
    titulo: arq.nome,
    servidores: [],
    matriculas: [],
    urlDrive: arq.url
  }));

  const res = enviarResumoEspacoGoogleChat(dataRef, itensConvertidos);
  return {
    status: 'OK',
    enviadoAoWebhook: res.enviado,
    totalItensResumo: itensConvertidos.length,
    mensagem: res.enviado
      ? `Resumo com ${itensConvertidos.length} ato(s) enviado com sucesso!`
      : `Resumo gerado para ${itensConvertidos.length} ato(s). Configure GOOGLE_CHAT_WEBHOOK_URL nas Script Properties para disparo externo.`
  };
}

/**
 * Disparo manual do Boletim Diário Executivo por e-mail a partir da UI ou API Hub.
 */
function dispararBoletimEmailManual(destinatariosCustom) {
  const painel = carregarPainelPrometheus();
  const dataRef = Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy');
  const rawMeta = PropertiesService.getScriptProperties().getProperty(PROMETHEUS_CONFIG.PROP_LAST_SYNC);
  let itens = [];
  if (rawMeta) {
    try {
      const parsed = JSON.parse(rawMeta);
      itens = parsed.publicacoes || [];
    } catch (e) {}
  }
  if (!itens || itens.length === 0) {
    itens = (painel.arquivosDrive || []).slice(0, 10).map((arq, i) => ({
      codigo: `DOC${i + 1}`,
      data: dataRef,
      orgao: arq.setor,
      categoria: arq.setor.includes('Portarias') ? 'PORTARIA' : 'ATO_GABINETE',
      titulo: arq.nome.replace(/\.pdf$/i, ''),
      servidores: [],
      matriculas: [],
      urlDrive: arq.url,
      resumo: 'Ato oficial arquivado na pasta de governança de 2026.'
    }));
  }
  const res = enviarBoletimExecutivoEmail(dataRef, itens, destinatariosCustom);
  return {
    ok: res.enviado,
    status: res.enviado ? 'OK' : 'FALHA',
    mensagem: res.enviado
      ? `Boletim com ${itens.length} ato(s) enviado com sucesso para ${res.totalDestinatarios} destinatário(s)!`
      : `Falha no envio do boletim: ${res.motivo || res.erro || 'Verifique as configurações de e-mail.'}`,
    detalhe: res
  };
}

/**
 * Converte data para formato por extenso em português (ex: "29 de Outubro de 2026").
 */
function formatarDataPorExtensoPtBr_(dataStr) {
  if (!dataStr) return '';
  const partes = String(dataStr).trim().split(/[-/]/);
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  if (partes.length === 3) {
    let dia, mes, ano;
    if (partes[0].length === 4) {
      ano = partes[0]; mes = parseInt(partes[1], 10); dia = parseInt(partes[2], 10);
    } else {
      dia = parseInt(partes[0], 10); mes = parseInt(partes[1], 10); ano = partes[2];
    }
    const nomeMes = (mes >= 1 && mes <= 12) ? meses[mes - 1] : String(mes);
    return `${dia} de ${nomeMes} de ${ano}`;
  }
  return String(dataStr);
}

/**
 * Gera nome de arquivo canônico padronizado no formato:
 * "Portaria - SMEB nº 163 de 29 de Outubro de 2026.pdf"
 */
function gerarNomeArquivoPadronizado_(pub, dataISO, dataRef) {
  if (pub.nome_arquivo && String(pub.nome_arquivo).toLowerCase().endsWith('.pdf') && !pub.nome_arquivo.includes('FEMURN_')) {
    return pub.nome_arquivo;
  }
  const ner = extrairEntidadesNerPrometheus_(pub);
  const cat = String(pub.categoria || pub.tipo_ato || 'PORTARIA').toUpperCase();
  let tipo = 'Portaria';
  if (cat.includes('EDITAL')) tipo = 'Edital';
  else if (cat.includes('DECRETO')) tipo = 'Decreto';
  else if (cat.includes('LEI')) tipo = 'Lei';
  else if (cat.includes('EXTRATO')) tipo = 'Extrato';
  else if (cat.includes('RESOLU')) tipo = 'Resolução';
  else if (cat.includes('AVISO')) tipo = 'Aviso';

  const orgao = 'SMEB';
  const dataExtenso = formatarDataPorExtensoPtBr_(pub.data_circulacao || dataRef || dataISO);
  let num = (ner && ner.numeroAto) ? String(ner.numeroAto) : '';
  if (num) {
    num = num.replace(/[\\/:*?"<>|]/g, '-').replace(/\/\d{4}$/, '').trim();
  }

  let baseNome = '';
  if (num) {
    baseNome = `${tipo} - ${orgao} nº ${num}`;
  } else if (pub.codigo_identificador || pub.codigo) {
    baseNome = `${tipo} - ${orgao} (${pub.codigo_identificador || pub.codigo})`;
  } else {
    baseNome = `${tipo} - ${orgao}`;
  }

  if (dataExtenso) {
    baseNome = `${baseNome} de ${dataExtenso}`;
  }

  baseNome = baseNome.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  return `${baseNome}.pdf`;
}

/**
 * Processa o pacote diário enviado pela VM do Fogo de Prometheus (GitHub Actions).
 */
function processarPacotePrometheus(payload) {
  const dataRef = payload.data_referencia || payload.data_execucao || Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy');
  const dataISO = dataRef.includes('/') ? dataRef.split('/').reverse().join('-') : dataRef;
  const publicacoes = payload.publicacoes || [];
  const resultadosSalvos = [];
  const alertasDespachados = [];
  const cachePastas = {};

  function obterPastaCacheada(folderId) {
    if (!cachePastas[folderId]) {
      cachePastas[folderId] = DriveApp.getFolderById(folderId);
    }
    return cachePastas[folderId];
  }

  publicacoes.forEach(pub => {
    const categoria = pub.categoria || pub.tipo_ato || 'ATO_GABINETE';
    const tituloAto = pub.titulo_ato || pub.resumo || pub.nome_arquivo || 'Ato_FEMURN';
    const codId = pub.codigo_identificador || 'DOC';

    let folderId = PROMETHEUS_CONFIG.FOLDER_GABINETE_2026;
    if (String(pub.entidade || '').includes('Câmara')) {
      folderId = PROMETHEUS_CONFIG.FOLDER_JURIDICO_2026;
    } else if (categoria === 'PORTARIA') {
      folderId = PROMETHEUS_CONFIG.FOLDER_PORTARIAS_2026;
    } else if (categoria === 'NORMATIVO_JURIDICO') {
      folderId = PROMETHEUS_CONFIG.FOLDER_GABINETE_2026;
    }

    let fileUrl = pub.url_drive || pub.urlDrive || '';
    if (!fileUrl) {
      const folder = obterPastaCacheada(folderId);
      const fileName = pub.nome_arquivo || gerarNomeArquivoPadronizado_(pub, dataISO, dataRef);

      const existentes = folder.getFilesByName(fileName);
      if (existentes.hasNext()) {
        fileUrl = existentes.next().getUrl();
      } else if (pub.pdf_base64) {
        const decodedBytes = Utilities.base64Decode(pub.pdf_base64);
        const blob = Utilities.newBlob(decodedBytes, 'application/pdf', fileName);
        const novoArquivo = folder.createFile(blob);
        fileUrl = novoArquivo.getUrl();
      }
    }

    const ner = extrairEntidadesNerPrometheus_(pub);

    resultadosSalvos.push({
      codigo: codId,
      data: dataRef,
      entidade: pub.entidade || 'Prefeitura Municipal de Ceará-Mirim',
      orgao: pub.orgao || 'SMEB',
      titulo: tituloAto,
      categoria: categoria,
      numeroAto: ner.numeroAto,
      servidores: ner.servidores,
      matriculas: ner.matriculas,
      resumo: pub.resumo_texto || pub.resumo || '',
      urlDrive: fileUrl
    });

    if (categoria === 'PERMUTA_RH' || String(tituloAto).toLowerCase().includes('permuta')) {
      registrarAlertaMemoriaOlympos('_memoria_hera.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
      alertasDespachados.push('Hera (Permuta/RH)');
    } else if (categoria === 'EDITAL_PSS') {
      registrarAlertaMemoriaOlympos('_memoria_nike.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
      alertasDespachados.push('Nike (Edital/PSS)');
    } else if (categoria === 'NORMATIVO_JURIDICO') {
      registrarAlertaMemoriaOlympos('_memoria_temis.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
      alertasDespachados.push('Têmis (Normativo Jurídico)');
    } else if (categoria === 'NOMEACAO_DIRETOR' || (String(tituloAto).toLowerCase().includes('diretor') && (String(tituloAto).toLowerCase().includes('escolar') || String(tituloAto).toLowerCase().includes('educação') || String(tituloAto).toLowerCase().includes('educacao') || String(tituloAto).toLowerCase().includes('smeb')))) {
      registrarAlertaMemoriaOlympos('_memoria_atena.md', `[${dataISO}] [HÉLIO/FEMURN]: Publicado ${tituloAto} (${fileUrl})`);
      alertasDespachados.push('Atena (Gestão Escolar/Diretores)');
    } else if (categoria === 'REPUBLICACAO' || String(tituloAto).toLowerCase().includes('republica')) {
      registrarAlertaMemoriaOlympos('_memoria_helio.md', `[${dataISO}] [HÉLIO/FEMURN]: Republicação Detectada ${tituloAto} (${fileUrl})`);
      alertasDespachados.push('Hélio (Republicação/Correção)');
    }
  });

  const resumoDia = resultadosSalvos.length > 0
    ? resultadosSalvos.map(r => `[${r.orgao}] ${r.titulo} -> ${r.urlDrive}`).join(' | ')
    : 'Nenhuma publicação da SMEB/Educação localizada nesta edição.';

  let resIndice = null;
  let lock = null;
  try {
    if (typeof LockService !== 'undefined' && LockService.getScriptLock) {
      lock = LockService.getScriptLock();
      lock.tryLock(25000);
    }
    registrarAlertaMemoriaOlympos('_memoria_helio.md', `[${dataISO}] Edição FEMURN (${resultadosSalvos.length} atos): ${resumoDia}`);

    // Grava exclusivamente na planilha oficial de ID 1AIncS3ITYx_kT_tmfkAL5cYnw7nnuMAAUgiCd2lluqY
    resIndice = registrarIndicePlanilhaDiarioOficial2026(resultadosSalvos);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }

  // Envia resumo para o Espaço do Google Chat / E-mail
  const statusChat = enviarResumoEspacoGoogleChat(dataRef, resultadosSalvos);

  const metaSync = {
    ultimaExecucao: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm:ss'),
    dataReferencia: dataRef,
    totalSalvos: resultadosSalvos.length,
    alertasSetoriais: alertasDespachados,
    indiceGravado: resIndice,
    publicacoes: resultadosSalvos.slice(0, 25)
  };
  PropertiesService.getScriptProperties().setProperty(PROMETHEUS_CONFIG.PROP_LAST_SYNC, JSON.stringify(metaSync));

  return {
    status: 'OK',
    data: dataRef,
    salvos: resultadosSalvos.length,
    planilhaOficial: PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL,
    indice: resIndice,
    detalhes: resultadosSalvos,
    notificacao: statusChat
  };
}

/**
 * Retorna o status atual do Webhook Fogo de Prometheus e as últimas publicações da SMEB/Gabinete salvas nas pastas de 2026.
 */
function obterStatusWebhookPrometheus() {
  const props = PropertiesService.getScriptProperties();
  const rawMeta = props.getProperty(PROMETHEUS_CONFIG.PROP_LAST_SYNC);
  const temTokenConfigurado = Boolean(props.getProperty('OLYMPOS_SECRET_TOKEN'));

  if (rawMeta) {
    try {
      const parsed = JSON.parse(rawMeta);
      parsed.webhookAtivo = temTokenConfigurado;
      return parsed;
    } catch (e) {
      console.warn('Erro ao ler PROMETHEUS_LAST_SYNC_META:', e);
    }
  }

  return {
    webhookAtivo: temTokenConfigurado,
    ultimaExecucao: 'Aguardando primeiro disparo da VM GitHub Actions',
    dataReferencia: Utilities.formatDate(new Date(), 'America/Fortaleza', 'dd/MM/yyyy'),
    totalSalvos: 0,
    alertasSetoriais: [],
    publicacoes: []
  };
}

/**
 * Varre as pastas de Portarias 2026, Gabinete 2026 e Jurídico 2026 em busca dos últimos PDFs da FEMURN.
 */
function carregarPainelPrometheus() {
  const statusWebhook = obterStatusWebhookPrometheus();
  const arquivosRecentes = [];

  const pastasParaVarrer = [
    { id: PROMETHEUS_CONFIG.FOLDER_PORTARIAS_2026, setor: 'Portarias 2026' },
    { id: PROMETHEUS_CONFIG.FOLDER_GABINETE_2026, setor: 'Gabinete 2026' },
    { id: PROMETHEUS_CONFIG.FOLDER_JURIDICO_2026, setor: 'Assessoria Jurídica 2026' }
  ];

  pastasParaVarrer.forEach(p => {
    try {
      const folder = DriveApp.getFolderById(p.id);
      const it = folder.getFiles();
      let count = 0;
      while (it.hasNext() && count < 15) {
        const f = it.next();
        const nome = f.getName();
        if (nome.includes('FEMURN') || nome.toLowerCase().endsWith('.pdf')) {
          arquivosRecentes.push({
            nome: nome,
            setor: p.setor,
            dataCriacao: Utilities.formatDate(f.getDateCreated(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm'),
            timestamp: f.getDateCreated().getTime(),
            url: f.getUrl()
          });
          count++;
        }
      }
    } catch (e) {
      console.warn(`Não foi possível listar pasta ${p.setor}:`, e);
    }
  });

  arquivosRecentes.sort((a, b) => b.timestamp - a.timestamp);

  return {
    statusWebhook: statusWebhook,
    planilhaOficialUrl: `https://docs.google.com/spreadsheets/d/${PROMETHEUS_CONFIG.PLANILHA_ID_OFICIAL}/edit`,
    arquivosDrive: arquivosRecentes.slice(0, 20)
  };
}

/**
 * Dispara sincronização manual das publicações encontradas no Drive para _memoria_helio.md.
 */
function sincronizarManualPrometheusParaHelio() {
  const painel = carregarPainelPrometheus();
  const hojeISO = Utilities.formatDate(new Date(), 'America/Fortaleza', 'yyyy-MM-dd');
  const qtd = painel.arquivosDrive.length;
  const amostra = painel.arquivosDrive
    .slice(0, 5)
    .map(a => `[${a.setor}] ${a.nome} (${a.url})`)
    .join(' | ');

  const texto = qtd > 0
    ? `[${hojeISO}] [SYNC MANUAL HUB]: ${qtd} documento(s) monitorado(s) nas pastas 2026. Destaques: ${amostra}`
    : `[${hojeISO}] [SYNC MANUAL HUB]: Verificação manual concluída. Nenhum novo PDF FEMURN nas pastas 2026.`;

  registrarAlertaMemoriaOlympos('_memoria_helio.md', texto);
  return {
    ok: true,
    status: 'OK',
    mensagem: 'Memória de Hélio (_memoria_helio.md) sincronizada com sucesso!',
    totalMonitorados: qtd
  };
}

/**
 * Ponte Bidirecional GAS ➔ GitHub Actions:
 * Dispara remotamente um workflow_dispatch no repositório unificado do Hub Olympos
 * quando GITHUB_PAT e GITHUB_REPO estiverem configurados nas Script Properties.
 */
function dispararWorkflowGitHubOlympos_(workflowFileName, inputsObj) {
  const props = PropertiesService.getScriptProperties();
  const pat = String(props.getProperty('GITHUB_PAT') || '').trim();
  const repo = String(props.getProperty('GITHUB_REPO') || '').trim();
  const branch = String(props.getProperty('GITHUB_REF') || 'main').trim();

  if (!pat || !repo) {
    return {
      ok: true,
      disparadoRemotamente: false,
      configurado: false,
      workflow: workflowFileName,
      mensagem: 'Integração pronta no código. Para disparo 1-clique direto pelo Hub, defina GITHUB_REPO (ex: usuario/olympos-smeb) e GITHUB_PAT nas Script Properties do GAS, ou acione via aba Actions no GitHub.'
    };
  }

  const endpoint = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFileName}/dispatches`;
  const resp = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({
      ref: branch,
      inputs: inputsObj || {}
    }),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code === 204 || code === 200) {
    return {
      ok: true,
      disparadoRemotamente: true,
      configurado: true,
      workflow: workflowFileName,
      repo: repo,
      urlActions: `https://github.com/${repo}/actions`,
      mensagem: `Execução remota iniciada no GitHub Actions (${workflowFileName} em ${repo}@${branch}). Os resultados chegarão ao Hub em instantes.`
    };
  }

  return {
    ok: false,
    disparadoRemotamente: false,
    configurado: true,
    statusHttp: code,
    mensagem: `GitHub API respondeu HTTP ${code}: ${String(resp.getContentText() || '').substring(0, 180)}`
  };
}

/**
 * Dispara sob demanda o Fogo de Prometheus (GitHub Actions -> Webhook GAS Hub Olympos).
 */
function dispararColetaPrometheusRemota(dataInicio, dataFim, secaoDiario) {
  const inputs = {};
  if (dataInicio) inputs.data_inicio = String(dataInicio).trim();
  if (dataFim) inputs.data_fim = String(dataFim).trim();
  if (secaoDiario) inputs.secao_diario = String(secaoDiario).trim();
  return dispararWorkflowGitHubOlympos_('fogo_prometheus_cron.yml', inputs);
}

/**
 * Carrega o painel ao vivo de O Papiro de Cadmo inspecionando a pasta oficial de CSVs consolidados
 * e fornecendo os links oficiais (sem expor IDs técnicos na interface).
 */
function carregarPainelPapiroCadmo() {
  const props = PropertiesService.getScriptProperties();
  const repo = String(props.getProperty('GITHUB_REPO') || '').trim();
  const temGitHubBridge = Boolean(props.getProperty('GITHUB_PAT') && repo);
  const arquivosCsv = [];

  try {
    const folder = DriveApp.getFolderById(OLYMPOS_IDS.SUBPROJETOS.PAPIRO_CADMO_PASTA);
    const files = folder.getFiles();
    let count = 0;
    while (files.hasNext() && count < 25) {
      const f = files.next();
      const nome = f.getName();
      if (nome.toLowerCase().endsWith('.csv') || nome.toLowerCase().includes('servidores-intermunicipais')) {
        const mComp = nome.match(/(20\d{2}-\d{2})/);
        arquivosCsv.push({
          nome: nome,
          competencia: mComp ? mComp[1] : 'Consolidado',
          dataCriacao: Utilities.formatDate(f.getDateCreated(), 'America/Fortaleza', 'dd/MM/yyyy HH:mm'),
          timestamp: f.getDateCreated().getTime(),
          tamanhoKb: Math.max(1, Math.round((f.getSize ? f.getSize() : 1024) / 1024)),
          url: f.getUrl()
        });
        count++;
      }
    }
  } catch (e) {
    console.warn('Aviso ao inspecionar pasta do Papiro de Cadmo:', e);
  }

  arquivosCsv.sort((a, b) => b.timestamp - a.timestamp);

  return {
    pastaConsolidadaUrl: OLYMPOS_IDS.LINKS_OFICIAIS_UI.pastaPapiroCadmo,
    planilhaPermutasUrl: OLYMPOS_IDS.LINKS_OFICIAIS_UI.planilhaPermutas,
    workflowConfigurado: temGitHubBridge,
    urlGitHubActions: repo ? `https://github.com/${repo}/actions` : '',
    ultimaCompetencia: arquivosCsv.length > 0 ? arquivosCsv[0].competencia : 'Aguardando 1º ciclo mensal (Dia 12)',
    ultimoUploadEm: arquivosCsv.length > 0 ? arquivosCsv[0].dataCriacao : '--',
    totalArquivosCsv: arquivosCsv.length,
    arquivosCsv: arquivosCsv.slice(0, 12)
  };
}

/**
 * Dispara sob demanda o ETL mensal O Papiro de Cadmo via GitHub Actions.
 */
function dispararColetaPapiroCadmoRemota(competencia, filtroEnte) {
  const inputs = {};
  if (competencia) inputs.competencia = String(competencia).trim();
  if (filtroEnte) inputs.filtro_ente = String(filtroEnte).trim();
  return dispararWorkflowGitHubOlympos_('papiro_cadmo_cron.yml', inputs);
}
