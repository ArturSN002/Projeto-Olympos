/**
 * Hub Olympos V3.1 — Configuração Oficial da Integração Cartográfica CARTO (CARTO_API_KEY)
 * A variável secreta CARTO_API_KEY do GitHub Actions Secrets é injetada automaticamente
 * em window.OLYMPOS_CARTO_CONFIG.apiKey durante o deploy do GitHub Pages (deploy_pages.yml),
 * com suporte adicional a configuração local (localStorage 'olympos_carto_api_key').
 */
window.OLYMPOS_CARTO_CONFIG = window.OLYMPOS_CARTO_CONFIG || {
  apiKey: 'cb1_59be_1_e706175c142a6271abaac593'
};

window.OlymposCarto = (function() {
  'use strict';

  var STORAGE_KEY = 'olympos_carto_api_key';
  var CANONICAL_FALLBACK_KEY = 'cb1_59be_1_e706175c142a6271abaac593';

  function getApiKey() {
    try {
      if (typeof localStorage !== 'undefined') {
        var saved = (localStorage.getItem(STORAGE_KEY) || '').trim();
        if (saved) return saved;
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      if (typeof window.__OLYMPOS_CARTO_API_KEY__ === 'string' && window.__OLYMPOS_CARTO_API_KEY__.trim()) {
        return window.__OLYMPOS_CARTO_API_KEY__.trim();
      }
      if (typeof window.CARTO_API_KEY === 'string' && window.CARTO_API_KEY.trim()) {
        return window.CARTO_API_KEY.trim();
      }
      if (window.OLYMPOS_CARTO_CONFIG && typeof window.OLYMPOS_CARTO_CONFIG.apiKey === 'string' && window.OLYMPOS_CARTO_CONFIG.apiKey.trim()) {
        return window.OLYMPOS_CARTO_CONFIG.apiKey.trim();
      }
    }
    return CANONICAL_FALLBACK_KEY;
  }

  function setApiKey(key) {
    var clean = String(key || '').trim();
    try {
      if (typeof localStorage !== 'undefined') {
        if (clean) {
          localStorage.setItem(STORAGE_KEY, clean);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {}
    if (typeof window !== 'undefined' && window.OLYMPOS_CARTO_CONFIG) {
      window.OLYMPOS_CARTO_CONFIG.apiKey = clean || CANONICAL_FALLBACK_KEY;
    }
    return clean || CANONICAL_FALLBACK_KEY;
  }

  function hasApiKey() {
    return Boolean(getApiKey());
  }

  function appendKeyParam(url) {
    var key = getApiKey();
    if (!key) return url;
    if (url.indexOf('key=') !== -1) {
      if (url.indexOf('api_key=') === -1) {
        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return url + sep + 'api_key=' + encodeURIComponent(key);
      }
      return url;
    }
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    if (url.indexOf('api_key=') !== -1) {
      return url + sep + 'key=' + encodeURIComponent(key);
    }
    return url + sep + 'key=' + encodeURIComponent(key) + '&api_key=' + encodeURIComponent(key);
  }

  function getStyleUrl(isDark) {
    var base = isDark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    return appendKeyParam(base);
  }

  function getRasterTileUrl(isDark) {
    var base = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    return appendKeyParam(base);
  }

  function transformRequest(url) {
    var key = getApiKey();
    if (key && typeof url === 'string' && (url.indexOf('cartocdn.com') !== -1 || url.indexOf('carto.com') !== -1)) {
      var targetUrl = (url.indexOf('key=') === -1)
        ? appendKeyParam(url)
        : url;
      return {
        url: targetUrl
      };
    }
    return { url: url };
  }

  return {
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    hasApiKey: hasApiKey,
    getStyleUrl: getStyleUrl,
    getRasterTileUrl: getRasterTileUrl,
    transformRequest: transformRequest
  };
})();
