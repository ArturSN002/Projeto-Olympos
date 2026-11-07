/**
 * OlymposCertificadosCrypto — Motor Criptográfico de Assinatura Assimétrica ECDSA P-256
 * Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)
 * 
 * Implementa verificação 100% offline de certificados digitais e declarações (A Lira de Orfeu)
 * utilizando Web Crypto API nativa (crypto.subtle), curva NIST P-256 (secp256r1) e SHA-256 (ES256).
 * Formato canônico de payload JSON compatível com RFC 8785 (JSON Canonicalization Scheme).
 * 
 * Executa em menos de 2ms no navegador sem necessidade de chamadas de rede ou servidores.
 */
(function(global) {
  'use strict';

  // Chave Pública Institucional da SMEB de Ceará-Mirim/RN (Formato JWK Curve P-256 / ES256)
  const SMEB_PUBLIC_KEY_JWK = {
    kty: "EC",
    crv: "P-256",
    x: "V-D6-vXeV_ZTJpe9oBdqxh35HvNeTy3EUBwpKvZ0mW4",
    y: "ahFp_ltmGzq_X0SVKFnts5t5oqiTG2DvVpeZWz5l0e8",
    ext: true,
    key_ops: ["verify"]
  };

  /**
   * Converte Uint8Array para string Base64URL (sem padding '=' e com '-' e '_').
   */
  function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = (typeof btoa === 'function') 
      ? btoa(binary) 
      : Buffer.from(binary, 'binary').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Converte string Base64URL para Uint8Array.
   */
  function base64UrlToBuffer(base64Url) {
    let b64 = String(base64Url || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    if (typeof atob === 'function') {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } else {
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
  }

  /**
   * Converte string UTF-8 para string Base64URL.
   */
  function textToBase64Url(text) {
    const encoder = new TextEncoder();
    return bufferToBase64Url(encoder.encode(text));
  }

  /**
   * Converte string Base64URL para texto UTF-8.
   */
  function base64UrlToText(base64Url) {
    const bytes = base64UrlToBuffer(base64Url);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  /**
   * Serialização canônica determinística de objetos JSON conforme RFC 8785 (JCS).
   * Garante que as chaves fiquem ordenadas lexicograficamente em todos os níveis.
   */
  function canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(canonicalStringify).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    const parts = [];
    for (let i = 0; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const val = obj[key];
      if (val !== undefined) {
        parts.push(JSON.stringify(key) + ':' + canonicalStringify(val));
      }
    }
    return '{' + parts.join(',') + '}';
  }

  /**
   * Obtém a instância de WebCrypto (navegador ou Node.js).
   */
  function getSubtleCrypto() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
      return globalThis.crypto.subtle;
    }
    if (typeof global !== 'undefined' && global.crypto && global.crypto.subtle) {
      return global.crypto.subtle;
    }
    if (typeof crypto !== 'undefined' && crypto && crypto.subtle) {
      return crypto.subtle;
    }
    if (typeof require !== 'undefined') {
      try {
        const cryptoMod = require('crypto');
        if (cryptoMod.webcrypto && cryptoMod.webcrypto.subtle) {
          return cryptoMod.webcrypto.subtle;
        }
      } catch (e) {}
    }
    throw new Error('WebCrypto API (crypto.subtle) indisponível no ambiente de execução.');
  }

  /**
   * Constrói o payload estruturado canônico do certificado institucional.
   */
  function gerarPayloadCanonico(dados) {
    const d = dados || {};
    return {
      cert_id: String(d.cert_id || d.codigo || d.id || 'SMEB-2026-CERT').trim(),
      event_date: String(d.event_date || d.data_evento || d.dataEvento || '2026-11-07').trim(),
      event_name: String(d.event_name || d.evento || d.nome_evento || 'Formação SMEB').trim(),
      event_type: String(d.event_type || d.tipo || 'CERTIFICADO').trim().toUpperCase(),
      hours: Number(d.hours || d.carga_horaria || d.cargaHoraria || 40),
      issued_at: String(d.issued_at || d.data_emissao || new Date().toISOString()).trim(),
      issuer: "SMEB Ceará-Mirim/RN",
      recipient_id_hash: String(d.recipient_id_hash || d.hash_aluno || d.cpf_hash || 'ANON_ID').trim(),
      recipient_name: String(d.recipient_name || d.aluno || d.nome || 'Participante').trim()
    };
  }

  /**
   * Importa uma chave pública ECDSA P-256 no WebCrypto.
   */
  async function importarChavePublica(jwkOpt) {
    const subtle = getSubtleCrypto();
    const jwk = jwkOpt || SMEB_PUBLIC_KEY_JWK;
    return await subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
  }

  /**
   * Assina um payload com uma chave privada ECDSA P-256 (SHA-256 / ES256).
   * Gera token compacto: <base64url(canonical_json)>.<base64url(signature_bytes)>.
   */
  async function assinarPayload(payloadObj, privateKeyJwk) {
    const subtle = getSubtleCrypto();
    const canonicalText = canonicalStringify(payloadObj);
    const enc = new TextEncoder();
    const dataBytes = enc.encode(canonicalText);

    const privateKey = await subtle.importKey(
      'jwk',
      privateKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      privateKey,
      dataBytes
    );

    const payloadB64 = textToBase64Url(canonicalText);
    const signatureB64 = bufferToBase64Url(signatureBuffer);
    return payloadB64 + '.' + signatureB64;
  }

  /**
   * Verifica a autenticidade criptográfica de um token de certificado 100% offline.
   * Executa em < 2ms usando a chave pública institucional da SMEB.
   * 
   * @param {string} tokenString Token no formato "<payload_b64url>.<signature_b64url>"
   * @param {object} [publicKeyJwkOverride] Chave pública opcional para testes
   * @returns {Promise<{ valido: boolean, certificado: object|null, canonicalJson: string, tempoMs: number, erro?: string }>}
   */
  async function verificarCertificadoOffline(tokenString, publicKeyJwkOverride) {
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      if (!tokenString || typeof tokenString !== 'string') {
        throw new Error('Token de certificado não informado ou malformado.');
      }

      const cleanToken = tokenString.trim();
      const parts = cleanToken.split('.');
      if (parts.length !== 2) {
        throw new Error('Formato de token inválido. Esperado: <payload>.<assinatura>.');
      }

      const payloadText = base64UrlToText(parts[0]);
      let certObj = null;
      try {
        certObj = JSON.parse(payloadText);
      } catch (eParse) {
        throw new Error('Payload do certificado não é um JSON válido: ' + eParse.message);
      }

      // Re-serialização canônica para evitar adulteração de ordenação/espaços
      const canonicalText = canonicalStringify(certObj);
      const enc = new TextEncoder();
      const dataBytes = enc.encode(canonicalText);
      const signatureBytes = base64UrlToBuffer(parts[1]);

      const publicKey = await importarChavePublica(publicKeyJwkOverride);
      const subtle = getSubtleCrypto();

      const isValid = await subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        publicKey,
        signatureBytes,
        dataBytes
      );

      const endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      return {
        valido: Boolean(isValid),
        certificado: certObj,
        canonicalJson: canonicalText,
        tempoMs: Math.round((endTime - startTime) * 100) / 100
      };
    } catch (err) {
      const endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      return {
        valido: false,
        certificado: null,
        canonicalJson: '',
        tempoMs: Math.round((endTime - startTime) * 100) / 100,
        erro: err.message
      };
    }
  }

  const api = {
    SMEB_PUBLIC_KEY_JWK: SMEB_PUBLIC_KEY_JWK,
    bufferToBase64Url: bufferToBase64Url,
    base64UrlToBuffer: base64UrlToBuffer,
    textToBase64Url: textToBase64Url,
    base64UrlToText: base64UrlToText,
    canonicalStringify: canonicalStringify,
    serializarCanonico: canonicalStringify,
    gerarPayloadCanonico: gerarPayloadCanonico,
    importarChavePublica: importarChavePublica,
    assinarPayload: assinarPayload,
    verificarCertificadoOffline: verificarCertificadoOffline,
    verificarToken: verificarCertificadoOffline
  };

  if (typeof window !== 'undefined') {
    window.OlymposCertificadosCrypto = api;
    window.CertificadosCrypto = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  return api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
