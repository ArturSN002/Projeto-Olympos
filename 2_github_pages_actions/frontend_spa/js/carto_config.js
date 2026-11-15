/**
 * Hub Olympos V3.1 — Configuração Oficial da Integração Cartográfica CARTO (CARTO_API_KEY)
 * A variável secreta CARTO_API_KEY do GitHub Actions Secrets é injetada automaticamente
 * em window.OLYMPOS_CARTO_CONFIG.apiKey durante o deploy do GitHub Pages (deploy_pages.yml),
 * com suporte adicional a configuração local (localStorage 'olympos_carto_api_key').
 */
window.OLYMPOS_CARTO_CONFIG = window.OLYMPOS_CARTO_CONFIG || {
  apiKey: ''
};

window.OlymposCarto = (function() {
  'use strict';

  var STORAGE_KEY = 'olympos_carto_api_key';

  function getApiKey() {
    try {
      if (typeof localStorage !== 'undefined') {
        var saved = (localStorage.getItem(STORAGE_KEY) || '').trim();
        if (saved) return saved;
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      if (typeof window.CARTO_API_KEY === 'string' && window.CARTO_API_KEY.trim()) {
        return window.CARTO_API_KEY.trim();
      }
      if (window.OLYMPOS_CARTO_CONFIG && typeof window.OLYMPOS_CARTO_CONFIG.apiKey === 'string' && window.OLYMPOS_CARTO_CONFIG.apiKey.trim()) {
        return window.OLYMPOS_CARTO_CONFIG.apiKey.trim();
      }
    }
    return '';
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
      window.OLYMPOS_CARTO_CONFIG.apiKey = clean;
    }
    return clean;
  }

  function hasApiKey() {
    return Boolean(getApiKey());
  }

  function appendKeyParam(url) {
    var key = getApiKey();
    if (!key) return url;
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'api_key=' + encodeURIComponent(key);
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
      var targetUrl = url.indexOf('api_key=') === -1 ? appendKeyParam(url) : url;
      return {
        url: targetUrl,
        headers: {
          Authorization: 'Bearer ' + key
        }
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
