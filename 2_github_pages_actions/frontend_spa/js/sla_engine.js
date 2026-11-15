/**
 * SlaEngine — Motor Matemático Canônico de SLA Útil do Hub Olympos V3.0
 * SMEB de Ceará-Mirim/RN
 * 
 * Regras Canônicas de Expediente e Dimensionamento:
 * 1. Janela Útil: 08h00 às 15h00 (7 horas = 420 minutos úteis por dia) de segunda a sexta-feira.
 * 2. Carga Unitária: 90 minutos por atividade pendente na fila ((k + 1) * 90 minutos).
 * 3. Normalização de Entrada:
 *    - Fim de semana (sábado/domingo) -> segunda-feira às 08h00.
 *    - Dia útil antes das 08h00 -> mesmo dia às 08h00.
 *    - Dia útil a partir das 15h00 -> próximo dia útil às 08h00 (sexta >= 15h transita para segunda às 08h).
 *    - Dia útil entre 08h00 e 14h59:59 -> horário de entrada preservado.
 * 4. Consumo Temporal:
 *    - Consome minutos disponíveis no dia útil corrente até às 15h00.
 *    - O excedente transita para as 08h00 do dia útil seguinte até zerar.
 * 5. Previsão Textual:
 *    - Exemplo: "Previsão em até 1h30min (Segunda-feira, 16/11/2026 às 09h30)"
 * 
 * Suporte Universal: Browser (window.SlaEngine), CommonJS (module.exports) e GAS.
 */
(function(global) {
  'use strict';

  const SlaEngine = {
    HORA_INICIO: 8,
    MINUTO_INICIO: 0,
    HORA_FIM: 15,
    MINUTO_FIM: 0,
    MINUTOS_DIA_UTIL: 420, // (15 - 8) * 60
    MINUTOS_POR_TAREFA: 90,

    /**
     * Adiciona N dias corridos a uma data mantendo mesmo horário.
     * @param {Date} date
     * @param {number} dias
     * @returns {Date}
     */
    _adicionarDias: function(date, dias) {
      const res = new Date(date.getTime());
      res.setDate(res.getDate() + dias);
      return res;
    },

    /**
     * Normaliza um timestamp para o início do próximo expediente válido.
     * @param {Date|string|number} dataEntrada
     * @returns {Date}
     */
    normalizarInicioExpediente: function(dataEntrada) {
      let d = (dataEntrada instanceof Date) ? new Date(dataEntrada.getTime()) : new Date(dataEntrada);
      if (isNaN(d.getTime())) {
        d = new Date();
      }

      const diaSemana = d.getDay(); // 0 = Domingo, 6 = Sábado
      const hora = d.getHours();
      const minuto = d.getMinutes();
      const segundo = d.getSeconds();
      const milisegundo = d.getMilliseconds();

      // 1. Tratamento de Fins de Semana
      if (diaSemana === 6) { // Sábado -> Pula 2 dias para Segunda 08:00
        d = this._adicionarDias(d, 2);
        d.setHours(this.HORA_INICIO, this.MINUTO_INICIO, 0, 0);
        return d;
      }
      if (diaSemana === 0) { // Domingo -> Pula 1 dia para Segunda 08:00
        d = this._adicionarDias(d, 1);
        d.setHours(this.HORA_INICIO, this.MINUTO_INICIO, 0, 0);
        return d;
      }

      // 2. Dias Úteis (Segunda a Sexta)
      const minDoDia = hora * 60 + minuto + (segundo / 60) + (milisegundo / 60000);
      const minInicio = this.HORA_INICIO * 60 + this.MINUTO_INICIO; // 480 (08:00)
      const minFim = this.HORA_FIM * 60 + this.MINUTO_FIM;          // 900 (15:00)

      if (minDoDia < minInicio) {
        // Chegou antes das 08:00 -> inicia hoje às 08:00
        d.setHours(this.HORA_INICIO, this.MINUTO_INICIO, 0, 0);
        return d;
      }

      if (minDoDia >= minFim) {
        // Chegou às 15:00 ou após -> transita para o próximo dia útil às 08:00
        const diasParaAvancar = (diaSemana === 5) ? 3 : 1; // Sexta vai para Segunda
        d = this._adicionarDias(d, diasParaAvancar);
        d.setHours(this.HORA_INICIO, this.MINUTO_INICIO, 0, 0);
        return d;
      }

      // Chegou dentro da janela útil (08:00 às 14:59:59) -> horário exato
      return d;
    },

    /**
     * Calcula a data/hora projetada de entrega e o total de minutos de SLA.
     * @param {Date|string|number} dataSubmissao - Timestamp do formulário
     * @param {number} [tarefasAFrente=0] - Qtd de chamados pendentes à frente na fila
     * @returns {{slaMinutos: number, dataEntregaEstimada: Date, dataEntregaIso: string, textoFormatado: string}}
     */
    calcularSla: function(dataSubmissao, tarefasAFrente) {
      const fila = (typeof tarefasAFrente === 'number' && tarefasAFrente >= 0) ? tarefasAFrente : 0;
      const slaMinutosTotal = (fila + 1) * this.MINUTOS_POR_TAREFA;
      let cursor = this.normalizarInicioExpediente(dataSubmissao);
      let minutosRestantes = slaMinutosTotal;

      while (minutosRestantes > 0) {
        const minCursor = cursor.getHours() * 60 + cursor.getMinutes() + (cursor.getSeconds() / 60);
        const minFimDia = this.HORA_FIM * 60 + this.MINUTO_FIM; // 900
        const disponivelHoje = minFimDia - minCursor;

        if (minutosRestantes <= disponivelHoje) {
          cursor = new Date(cursor.getTime() + minutosRestantes * 60 * 1000);
          minutosRestantes = 0;
        } else {
          minutosRestantes -= disponivelHoje;
          const diaSemana = cursor.getDay();
          const diasParaAvancar = (diaSemana === 5) ? 3 : 1; // Pula fim de semana se sexta
          cursor = this._adicionarDias(cursor, diasParaAvancar);
          cursor.setHours(this.HORA_INICIO, this.MINUTO_INICIO, 0, 0);
        }
      }

      return {
        slaMinutos: slaMinutosTotal,
        dataEntregaEstimada: cursor,
        dataEntregaIso: cursor.toISOString(),
        textoFormatado: this.formatarPrevisao(cursor, slaMinutosTotal)
      };
    },

    /**
     * Alias de cálculo direto retornando a data/hora final de entrega.
     * @param {Date|string|number} dataSubmissao
     * @param {number} [filaPendente=0]
     * @returns {Date}
     */
    calcularConclusao: function(dataSubmissao, filaPendente) {
      return this.calcularSla(dataSubmissao, filaPendente).dataEntregaEstimada;
    },

    /**
     * Formata a previsão textual detalhada no padrão SMEB.
     * Exemplo: "Previsão em até 1h30min (Segunda-feira, 16/11/2026 às 09h30)"
     * @param {Date} dataObj
     * @param {number} minutos
     * @returns {string}
     */
    formatarPrevisao: function(dataObj, minutos) {
      const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const diaNome = dias[dataObj.getDay()];
      const diaNum = String(dataObj.getDate()).padStart(2, '0');
      const mesNum = String(dataObj.getMonth() + 1).padStart(2, '0');
      const ano = dataObj.getFullYear();
      const hh = String(dataObj.getHours()).padStart(2, '0');
      const mm = String(dataObj.getMinutes()).padStart(2, '0');

      const horas = Math.floor(minutos / 60);
      const mins = minutos % 60;
      const duracaoStr = mins > 0 ? `${horas}h${mins}min` : `${horas}h00`;

      return `Previsão em até ${duracaoStr} (${diaNome}, ${diaNum}/${mesNum}/${ano} às ${hh}h${mm})`;
    }
  };

  // Exportação Universal (Browser, Node.js CommonJS, ESM)
  if (typeof window !== 'undefined') {
    window.SlaEngine = SlaEngine;
    window.OlymposSlaEngine = SlaEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SlaEngine;
  }
  if (typeof global !== 'undefined') {
    global.SlaEngine = SlaEngine;
    global.OlymposSlaEngine = SlaEngine;
  }

  return SlaEngine;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
