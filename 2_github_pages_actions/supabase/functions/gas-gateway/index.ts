// ==============================================================================
// Supabase Edge Function: gas-gateway
// Projeto Olympos — Secretaria Municipal de Educação Básica (SMEB de Ceará-Mirim/RN)
// Finalidade: Gateway Proxy com Validação de JWT, Rate Limiting Edge e Assinatura HMAC-SHA256
// ==============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

// Cabeçalhos CORS padronizados para o Frontend SPA (GitHub Pages e Localhost)
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-auth, x-olympos-turnstile-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Lista de ações públicas autorizadas a contornar autenticação estrita de usuário
export const PUBLIC_ACTIONS = new Set([
  "ping",
  "status",
  "health",
  "overview_get",
  "carregarDadosVisaoGeralHub",
  "cadmo_status",
  "certificados_verificar_publico"
]);

const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbw-zKUdYJO6Zw1_XHo12a49p2wpgNtfii-2CJOq1838f6S1-L0SYM6iI9A2PS2ZPjYdmQ/exec";

// ------------------------------------------------------------------------------
// Rate Limiter em Memória (Zero-Cost Sliding Window para Edge Deno Workers)
// ------------------------------------------------------------------------------
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
export const rateLimitMap = new Map<string, RateLimitEntry>();

// Limpeza periódica em memória para prevenir vazamento de memória (< 2MB)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
}

export function checkEdgeRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

// ------------------------------------------------------------------------------
// Assinatura Criptográfica HMAC-SHA256 com Web Crypto API (Nativo no Deno)
// ------------------------------------------------------------------------------
export async function generateHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret || "OLYMPOS_DEFAULT_DEV_SECRET"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ------------------------------------------------------------------------------
// Servidor de Requisições HTTP
// ------------------------------------------------------------------------------
export async function handleRequest(req: Request): Promise<Response> {
  // 1. Tratamento universal de CORS Preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, mensagem: "Método não permitido. Utilize POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                   req.headers.get("cf-connecting-ip") || "unknown_ip";

  try {
    // 2. Extração e validação do corpo da requisição
    let bodyText = "";
    try {
      bodyText = await req.text();
    } catch (_e) {
      bodyText = "{}";
    }

    let payload: Record<string, any> = {};
    try {
      payload = JSON.parse(bodyText);
    } catch (_eParse) {
      return new Response(JSON.stringify({ ok: false, mensagem: "JSON malformado no corpo da requisição." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const action = String(payload.action || payload.modulo || "").trim();
    if (!action) {
      return new Response(JSON.stringify({ ok: false, mensagem: "Parâmetro 'action' não informado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 3. Rate Limiting Edge
    // Limite geral: 120 requisições por minuto por IP
    // Limite para ações de login e admin: 10 requisições por minuto por IP
    const isSensitive = action === "auth_login" || action === "usuario_criar";
    const rateLimitKey = isSensitive ? `rl_sens_${clientIp}` : `rl_gen_${clientIp}`;
    const maxReqs = isSensitive ? 10 : 120;
    const windowMs = 60 * 1000;

    const rateCheck = checkEdgeRateLimit(rateLimitKey, maxReqs, windowMs);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "RATE_LIMIT_EXCEEDED",
          mensagem: `Limite de requisições excedido. Tente novamente em ${rateCheck.retryAfter} segundos.`
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateCheck.retryAfter)
          }
        }
      );
    }

    // 4. Validação de Autenticação Supabase
    const isPublicAction = PUBLIC_ACTIONS.has(action);
    let authenticatedUser: any = null;
    let authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || req.headers.get("x-supabase-auth");
    let jwtToken = "";

    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      jwtToken = authHeader.substring(7).trim();
    } else if (authHeader) {
      jwtToken = authHeader.trim();
    } else if (payload.token || payload._token || payload.access_token) {
      jwtToken = String(payload.token || payload._token || payload.access_token).trim();
    }

    const supabaseUrl = (typeof Deno !== "undefined" && Deno.env.get("SUPABASE_URL")) || "https://rbwizevjvbvjwtbwwyif.supabase.co";
    const supabaseAnonKey = (typeof Deno !== "undefined" && Deno.env.get("SUPABASE_ANON_KEY")) || "";
    const olymposSecretToken = (typeof Deno !== "undefined" && Deno.env.get("OLYMPOS_SECRET_TOKEN")) || "OLYMPOS_SECRET_TOKEN_PROD";
    const gasWebappUrl = (typeof Deno !== "undefined" && Deno.env.get("GAS_WEBAPP_URL")) || DEFAULT_GAS_URL;

    if (!isPublicAction) {
      if (!jwtToken) {
        return new Response(
          JSON.stringify({ ok: false, code: "AUTH_REQUIRED", mensagem: "Autenticação requerida: JWT ausente." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${jwtToken}` } }
        });

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData || !userData.user) {
          return new Response(
            JSON.stringify({
              ok: false,
              code: "AUTH_REQUIRED",
              mensagem: "Sessão expirada ou JWT inválido no Supabase Auth."
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        authenticatedUser = userData.user;
      }
    }

    // 5. Montagem do Payload Assinado para o Google Apps Script
    const timestamp = Date.now();
    const gasPayload: Record<string, any> = {
      ...payload,
      action: action,
      gateway_proxy: true,
      gateway_timestamp: timestamp,
      client_ip: clientIp,
      token: jwtToken || payload.token
    };

    if (authenticatedUser) {
      gasPayload.gateway_user_id = authenticatedUser.id;
      gasPayload.gateway_user_email = authenticatedUser.email;
      gasPayload.gateway_user_role =
        (authenticatedUser.app_metadata && authenticatedUser.app_metadata.role) ||
        (authenticatedUser.user_metadata && authenticatedUser.user_metadata.role) ||
        "RH_COMISSAO";
    }

    // String canônica: action:timestamp:payload_dados
    const canonicalString = `${action}:${timestamp}:${JSON.stringify(payload.dados || payload.data || {})}`;
    const hmacSignature = await generateHmacSha256(olymposSecretToken, canonicalString);
    gasPayload.gateway_signature = hmacSignature;

    // 6. Encaminhamento Server-to-Server para o Google Apps Script
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 25000); // 25s timeout

    let gasResponse: Response;
    try {
      gasResponse = await fetch(gasWebappUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
          "x-olympos-signature": hmacSignature,
          "x-olympos-timestamp": String(timestamp),
          "X-Olympos-Gateway-Signature": hmacSignature,
          "X-Olympos-Gateway-Timestamp": String(timestamp)
        },
        body: JSON.stringify(gasPayload),
        redirect: "follow",
        signal: abortController.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!gasResponse.ok) {
      throw new Error(`Google Apps Script respondeu com HTTP ${gasResponse.status}: ${gasResponse.statusText}`);
    }

    const gasText = await gasResponse.text();
    let gasJson: any;
    try {
      gasJson = JSON.parse(gasText);
    } catch (_eJson) {
      return new Response(
        JSON.stringify({
          ok: false,
          mensagem: "O Gateway GAS retornou formato inválido (não-JSON).",
          rawSnippet: gasText.substring(0, 150)
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Retorno normalizado para o cliente
    return new Response(JSON.stringify(gasJson), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    const isTimeout = err.name === "AbortError";
    console.error(`[gas-gateway] Erro ao processar requisição:`, err);
    return new Response(
      JSON.stringify({
        ok: false,
        code: isTimeout ? "GATEWAY_TIMEOUT" : "GATEWAY_ERROR",
        mensagem: isTimeout
          ? "Tempo limite esgotado ao aguardar resposta do Google Apps Script (25s)."
          : `Erro de comunicação no Gateway: ${err.message}`
      }),
      { status: isTimeout ? 504 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Inicia servidor apenas se executado diretamente como script principal
if (typeof Deno !== "undefined" && import.meta.main) {
  serve(handleRequest);
}
