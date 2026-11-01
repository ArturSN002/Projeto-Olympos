/**
 * OlymposPasswordSecurity — Módulo de Proteção de Senhas e Verificação HaveIBeenPwned
 * Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)
 * 
 * Implementa verificação k-Anonymity SHA-1 conforme RFC e documentação HaveIBeenPwned.org (v3 API)
 * e validação estrutural de complexidade de senhas baseada no NIST SP 800-63B.
 * 
 * Funciona nativamente no navegador sem expor a senha ou o hash completo para a rede.
 */
(function(global) {
  'use strict';

  /**
   * Converte uma string em hash SHA-1 hexadecimal (maiúsculo).
   * Utiliza a Web Crypto API (crypto.subtle) com fallback para ambiente Node.js se disponível.
   * @param {string} text 
   * @returns {Promise<string>}
   */
  async function sha1Hex(text) {
    if (typeof text !== 'string') {
      text = String(text || '');
    }

    // Suporte a Web Crypto API no navegador
    var cryptoObj = (typeof window !== 'undefined' && (window.crypto || window.msCrypto)) || 
                    (typeof global !== 'undefined' && global.crypto);

    if (cryptoObj && cryptoObj.subtle && typeof TextEncoder !== 'undefined') {
      var encoder = new TextEncoder();
      var data = encoder.encode(text);
      var hashBuffer = await cryptoObj.subtle.digest('SHA-1', data);
      var hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(function(b) {
        return b.toString(16).padStart(2, '0');
      }).join('').toUpperCase();
    }

    // Fallback para Node.js (execução de testes em backend)
    if (typeof require !== 'undefined') {
      try {
        var nodeCrypto = require('crypto');
        return nodeCrypto.createHash('sha1').update(text, 'utf8').digest('hex').toUpperCase();
      } catch (e) {
        // Fallback não disponível
      }
    }

    throw new Error('Ambiente criptográfico seguro (Web Crypto API) não disponível.');
  }

  /**
   * Consulta a API pública HaveIBeenPwned usando o modelo k-Anonymity (v3 Range API).
   * Envia apenas os primeiros 5 caracteres do hash SHA-1 da senha.
   * A senha em texto claro e o hash completo NUNCA trafegam pela rede.
   * 
   * @param {string} password Senha a ser verificada
   * @returns {Promise<{ leaked: boolean, breachCount: number, checked: boolean }>}
   */
  async function checkHaveIBeenPwned(password) {
    if (!password || typeof password !== 'string') {
      return { leaked: false, breachCount: 0, checked: false };
    }

    try {
      var fullHash = await sha1Hex(password);
      var prefix = fullHash.substring(0, 5);
      var suffix = fullHash.substring(5);

      var fetchFn = typeof fetch === 'function' ? fetch : (typeof window !== 'undefined' ? window.fetch : null);
      if (!fetchFn) {
        console.warn('[OlymposPasswordSecurity] Função fetch não disponível no ambiente.');
        return { leaked: false, breachCount: 0, checked: false };
      }

      var response = await fetchFn('https://api.pwnedpasswords.com/range/' + prefix, {
        method: 'GET',
        headers: {
          'Add-Padding': 'true' // Previne análise de tráfego por tamanho de pacote
        }
      });

      if (!response.ok) {
        console.warn('[OlymposPasswordSecurity] API HaveIBeenPwned indisponível (HTTP ' + response.status + '). Prosseguindo em modo defensivo.');
        return { leaked: false, breachCount: 0, checked: false };
      }

      var bodyText = await response.text();
      var lines = bodyText.split('\n');

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var parts = line.split(':');
        if (parts[0] && parts[0].toUpperCase() === suffix) {
          var count = parseInt(parts[1], 10) || 1;
          return { leaked: true, breachCount: count, checked: true };
        }
      }

      return { leaked: false, breachCount: 0, checked: true };
    } catch (err) {
      console.warn('[OlymposPasswordSecurity] Falha na verificação de vazamento HaveIBeenPwned:', err);
      // Fallback gracioso: não bloqueia o fluxo em caso de falha de conexão externa
      return { leaked: false, breachCount: 0, checked: false };
    }
  }

  /**
   * Valida os requisitos estruturais de complexidade de senha institucional recomendados pelo NIST SP 800-63B.
   * @param {string} password 
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateComplexity(password) {
    var errors = [];
    if (!password || typeof password !== 'string' || password.length < 12) {
      errors.push('A senha deve possuir pelo menos 12 caracteres.');
    }
    if (!/[A-Z]/.test(password || '')) {
      errors.push('A senha deve conter ao menos uma letra maiúscula.');
    }
    if (!/[a-z]/.test(password || '')) {
      errors.push('A senha deve conter ao menos uma letra minúscula.');
    }
    if (!/[0-9]/.test(password || '')) {
      errors.push('A senha deve conter ao menos um número.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password || '')) {
      errors.push('A senha deve conter ao menos um caractere especial (!@#$%...).');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  var api = {
    sha1Hex: sha1Hex,
    checkHaveIBeenPwned: checkHaveIBeenPwned,
    validateComplexity: validateComplexity
  };

  // Exportação em ambiente de navegador
  if (typeof window !== 'undefined') {
    window.OlymposPasswordSecurity = api;
  }

  // Exportação em ambiente CommonJS / Node.js (testes unitários)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  return api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
