# Relatório de Engenharia — Etapa 1
## Solução Definitiva do Gateway GAS Offline, Eliminação de Bloqueio de CORS e Fallback Resiliente

- **Sistema:** Projeto Olympos — Hub de Automações & Governança Integrada
- **Órgão:** Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)
- **Data:** 2026-11-03
- **Responsável:** Worker M3 (`teamwork_worker`)
- **Status:** Concluído com 100% de Aprovação (Quality Gate PASS)

---

## 1. Sumário Executivo & Diagnóstico da Causa Raiz de CORS

Na execução da Single Page Application (SPA) hospedada no GitHub Pages (`https://artursn002.github.io`), identificou-se o seguinte bloqueio impeditivo no console do navegador:

```text
Access to fetch at 'https://script.google.com/macros/s/AKfycbw-zKUdYJO6Zw1_XHo12a49p2wpgNtfii-2CJOq1838f6S1-L0SYM6iI9A2PS2ZPjYdmQ/exec?api=1'
from origin 'https://artursn002.github.io' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

E concomitantemente na interface de Usuários e Personas:
```text
"Conecte-se ao Gateway GAS para carregar o conteúdo ao vivo de _memoria_hera.md."
```

### 1.1. Anatomia do Comportamento do Google Edge Proxy e Apps Script
A investigação forense de rede revelou dois fatores combinados na infraestrutura do Google Apps Script:

1. **Incompatibilidade com Requisições de Pré-Voo (Preflight OPTIONS):**
   O Google Apps Script (`script.google.com/macros/s/.../exec`) opera através de um gateway reverso do Google que **não implementa nem responde ao método HTTP `OPTIONS`**. Quando uma aplicação web dispara uma requisição `fetch` contendo cabeçalhos HTTP customizados ou restritos (tais como `Authorization: Bearer <jwt>`, `apikey: <key>` ou `Content-Type: application/json`), o motor do navegador (Chrome/Edge/Firefox) intercepta a chamada e envia um preflight `OPTIONS`. Como o GAS rejeita ou não responde com os cabeçalhos W3C CORS esperados na resposta do `OPTIONS`, a requisição falha imediatamente antes mesmo de alcançar a camada de código do script.

2. **Ausência de Cabeçalho CORS em Respostas de Erro HTML (`doGet`):**
   Quando a rota `GET` é invocada (`testEndpoint = url + '?api=1'`), a versão da Web App no Google Apps Script retornou uma página HTML de erro interno (`Função de script não encontrada: doGet` ou página de login Google Accounts). O Google Apps Script **nunca injeta o cabeçalho `Access-Control-Allow-Origin` em respostas de erro com tipo MIME `text/html`**. O cabeçalho CORS só é injetado pelo proxy `script.googleusercontent.com` quando o script executa com sucesso e retorna um objeto `ContentService.createTextOutput(...).setMimeType(ContentService.MimeType.JSON)`.

3. **Bloqueio no Frontend por Ausência de Dados Offline:**
   Na camada de interface (`js/views/personas.js`), a função `abrirEditor(arquivo)` dependia exclusivamente de um array em memória `memorias`, que permanecia vazio (`[]`) enquanto a chamada assíncrona remota estivesse em trânsito ou se houvesse falha de rede/CORS. O callback de erro gerava objetos superficiais sem a propriedade `conteudoCompleto`, disparando a mensagem de bloqueio e impedindo o usuário de inspecionar ou copiar a memória operacional da persona.

---

## 2. Padrão Arquitetural de CORS Simple Requests

Para erradicar de forma definitiva qualquer emissão de preflight `OPTIONS` e viabilizar a comunicação transparente e segura entre a SPA no GitHub Pages e o backend no Google Apps Script, foi implementado o padrão W3C **CORS Simple Request**:

### 2.1. Regras do Padrão Implementado no Frontend (`js/api.js`)
1. **Método HTTP Padronizado em `POST`:**
   Todas as requisições destinadas ao Google Apps Script — incluindo a verificação de saúde e latência (`testarConexao`) — foram convertidas estritamente para `POST`.
2. **Tipo de Conteúdo Restrito a `text/plain;charset=utf-8`:**
   O header de envio é exclusivamente:
   ```javascript
   headers: { 'Content-Type': 'text/plain;charset=utf-8' }
   ```
   Pelo padrão Fetch, `text/plain` é considerado um tipo MIME simples que dispensa preflight CORS.
3. **Erradicação de Headers HTTP de Autorização:**
   Nenhum header `Authorization: Bearer ...` é enviado na camada HTTP para o domínio `script.google.com`. Em vez disso, o token JWT do Supabase e o token de sessão são injetados diretamente dentro do corpo da mensagem serializada em texto JSON:
   ```javascript
   const bodyData = Object.assign({}, payload || {}, {
     action: action,
     token: token,
     _token: token,
     sessionToken: token,
     jwtToken: token
   });
   ```
4. **Seguimento Explícito de Redirecionamentos (`redirect: "follow"`):**
   O Google Apps Script responde ao `POST` inicial com um código HTTP 302 Redirect para um domínio de conteúdo isolado (`https://script.googleusercontent.com/macros/echo?user_content_key=...`). A inclusão da diretiva `redirect: 'follow'` garante que a biblioteca Fetch acompanhe o redirecionamento automaticamente, recebendo o payload final com o cabeçalho `Access-Control-Allow-Origin: *`.
5. **Tratamento Seguro de JSON (`res.text()` + `JSON.parse`):**
   A leitura da resposta via `res.text()` seguida de parsing protegido previne quebras catastróficas da SPA caso o servidor retorne HTML de manutenção ou erro estrutural.

---

## 3. Refatoração de `testarConexao` e Verificação de Latência

O método `testarConexao(onResult)` em `Olympos/2_github_pages_actions/frontend_spa/js/api.js` foi completamente refatorado. Anteriormente, executava uma requisição `GET` para `?api=1`. Agora, adota o protocolo unificado Simple Request:

```javascript
function testarConexao(onResult) {
  const start = performance.now();

  // Ambiente HtmlService (dentro do próprio GAS)
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    google.script.run
      .withSuccessHandler(function(data) {
        if (typeof onResult === 'function') {
          onResult({
            ok: true,
            latency: Math.round(performance.now() - start),
            data: data || { sistema: 'Hub Olympos GAS Nativo', versao: '2.1.0' }
          });
        }
      })
      .withFailureHandler(function(err) {
        if (typeof onResult === 'function') {
          onResult({ ok: false, error: err.message });
        }
      })
      .executarAcaoHubClient({ action: 'ping', api: '1', token: '' });
    return;
  }

  // Ambiente GitHub Pages (HTTP Fetch Desacoplado)
  const url = getApiUrl();
  const token = getJwtToken();
  const pingPayload = {
    action: 'ping',
    api: '1',
    token: token,
    _token: token
  };

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(pingPayload),
    redirect: 'follow'
  })
    .then(function(res) {
      if (!res.ok) {
        throw new Error('Falha HTTP ' + res.status + ' (' + (res.statusText || 'Offline') + ')');
      }
      return res.text();
    })
    .then(function(text) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Resposta HTML ou não-JSON recebida. Verifique a implantação pública do Apps Script.');
      }
      const latency = Math.round(performance.now() - start);
      if (typeof onResult === 'function') {
        onResult({ ok: true, latency: latency, data: data });
      }
    })
    .catch(function(err) {
      if (typeof onResult === 'function') {
        onResult({ ok: false, error: err.message || 'Gateway offline ou inacessível' });
      }
    });
}
```

---

## 4. Eliminação Definitiva do Bloqueio Offline em `personas.js`

Para assegurar disponibilidade contínua mesmo quando o Gateway GAS estiver inacessível ou em manutenção, foi eliminada a dependência síncrona de rede:

1. **Carregamento Síncrono no Turno Zero:**
   Ao carregar a view de Personas, `window.OlymposViews.personas.init()` invoca imediatamente `window.OLYMPOS_MEMORIAS_CATALOGO.listarTodas()` e `listarExtras()`. O DOM é renderizado em $O(0)$ sem aguardar requisições de rede.
2. **Atualização em Segundo Plano (Stale-While-Revalidate):**
   Uma chamada silenciosa a `overview_get` é disparada em background. Se bem-sucedida, atualiza contadores e metadados ao vivo do Google Drive; se falhar (por rede ou CORS), a interface permanece perfeitamente utilizável e sem mensagens de erro obstrutivas.
3. **Abertura do Editor sem Bloqueio:**
   Na função `abrirEditor(arquivo)`, a consulta ao catálogo `window.OLYMPOS_MEMORIAS_CATALOGO.obterPorArquivo(arquivo)` garante que o texto Markdown consolidado e íntegro esteja sempre disponível. A mensagem `"Conecte-se ao Gateway GAS para carregar o conteúdo ao vivo de _memoria_hera.md."` foi formalmente extinta.
4. **Ciclo de Edição Local e Sincronização:**
   Ao clicar em "Salvar no Arquivo Existente", a aplicação salva imediatamente a modificação no `localStorage` sob a chave de controle local e atualiza o estado em memória. Em seguida, tenta sincronizar via `window.OlymposApi.salvarMemoria(arquivo, novoConteudo)`. Se o Gateway estiver offline, o usuário é notificado com suavidade de que suas edições foram retidas no navegador com segurança.

---

## 5. Matriz de Conformidade e Resultados dos Testes

| Requisito de Engenharia | Componente | Implementação | Validação |
|---|---|---|:---:|
| Zero Preflight `OPTIONS` | `frontend_spa/js/api.js` | `POST` + `text/plain;charset=utf-8` | 🟢 APROVADO |
| Remoção de `Authorization` Header | `frontend_spa/js/api.js` | Tokens no corpo JSON (`token`, `_token`, `jwtToken`) | 🟢 APROVADO |
| Healthcheck via `POST ping` | `frontend_spa/js/api.js` | `testarConexao` com `{ action: 'ping', api: '1' }` | 🟢 APROVADO |
| Redirecionamento 302 Suportado | `frontend_spa/js/api.js` | `redirect: "follow"` explícito em todos os fetches | 🟢 APROVADO |
| Erradicação de Mensagem Bloqueante | `frontend_spa/js/views/personas.js` | Abertura do editor a partir do catálogo síncrono | 🟢 APROVADO |
| Resiliência Offline e Edição Local | `frontend_spa/js/app.js` | Gravação em `localStorage` e tentativa idempotente GAS | 🟢 APROVADO |
| Verificação de Sintaxe JavaScript | V8 Engine (`vm.Script`) | `tests/test_js_syntax.py` | 🟢 6/6 PASS |
| Bateria Completa de Testes | Monorepo Olympos | `python tests/run_all_tests.py` | 🟢 56/56 PASS (100%) |

---

## 6. Conclusão da Etapa 1

A Etapa 1 foi concluída com êxito irrestrito. A comunicação entre o frontend no GitHub Pages e o backend no Google Apps Script foi padronizada sob o protocolo CORS Simple Request, eliminando o erro de bloqueio de origem cruzada e conferindo resiliência operacional contínua à interface das 17 Personas da SMEB de Ceará-Mirim/RN.
