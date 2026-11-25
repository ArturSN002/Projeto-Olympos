/**
 * Hub Olympos — A Forja de Hefesto (Inventário Patrimonial SMEB)
 * Geração vetorial de QR Codes (`qrcode` em chunk lazy), impressão de etiquetas A4
 * e parser de leitura por câmera (`BarcodeDetector`) ou leitor óptico USB.
 */

export interface EtiquetaQrItem {
  codigo: string;
  nome: string;
  categoria?: string;
  lote?: string;
}

function escHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildInventarioItemUrl(codigo: string): string {
  const clean = String(codigo || '').trim().toUpperCase();
  const base =
    typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://artursn002.github.io/Projeto-Olympos/';
  return `${base}#inventario?item=${encodeURIComponent(clean)}`;
}

export function extrairCodigoDeLeituraQr(rawText: string): string {
  const raw = String(rawText || '').trim();
  if (!raw) return '';
  const queryMatch = raw.match(/[?&](?:item|codigo|lote)=([A-Za-z0-9_-]+)/i);
  if (queryMatch && queryMatch[1]) {
    return decodeURIComponent(queryMatch[1]).trim().toUpperCase();
  }
  const tokenMatch = raw.match(/\b(SMEB-(?:PAT|CON|LOT)-\d{4}-\d+|REM-\d{4}-\d+)\b/i);
  if (tokenMatch && tokenMatch[1]) {
    return tokenMatch[1].toUpperCase();
  }
  return raw.toUpperCase();
}

export async function renderQrSvg(text: string, size = 180): Promise<string> {
  const qrMod: any = await import('qrcode');
  const QRCode = qrMod.default || qrMod;
  const svg = await QRCode.toString(String(text || ''), {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
  return String(svg || '');
}

export function gerarEtiquetasHtml(items: EtiquetaQrItem[], svgs: string[]): string {
  const cards = items
    .map((it, idx) => {
      const svg = svgs[idx] || '';
      const nomeCurto = escHtml((it.nome || 'Item Patrimonial').slice(0, 52));
      const cat = escHtml(it.categoria || 'PATRIMÔNIO');
      const codigo = escHtml(it.codigo);
      return `
        <div class="qr-label-card">
          <div class="qr-label-svg">${svg}</div>
          <div class="qr-label-meta">
            <div class="qr-label-org">SMEB CEARÁ-MIRIM/RN</div>
            <div class="qr-label-code">${codigo}</div>
            <div class="qr-label-name">${nomeCurto}</div>
            <div class="qr-label-cat">${cat}</div>
          </div>
        </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Etiquetas Patrimoniais SMEB — Hub Olympos</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #0f172a; background: #fff; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #cbd5e1; margin-bottom: 12px; }
    .toolbar button { padding: 8px 16px; border-radius: 6px; border: 0; background: #0f172a; color: #fff; font-weight: 600; cursor: pointer; }
    .qr-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 4px; }
    .qr-label-card {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 82px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .qr-label-svg { width: 64px; height: 64px; flex: 0 0 64px; }
    .qr-label-svg svg { width: 100%; height: 100%; display: block; }
    .qr-label-meta { min-width: 0; flex: 1; }
    .qr-label-org { font-size: 8px; font-weight: 700; letter-spacing: 0.05em; color: #475569; text-transform: uppercase; }
    .qr-label-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 800; color: #0f172a; margin: 2px 0; word-break: break-all; }
    .qr-label-name { font-size: 9.5px; font-weight: 600; line-height: 1.25; color: #1e293b; overflow: hidden; }
    .qr-label-cat { font-size: 8px; color: #64748b; margin-top: 2px; text-transform: uppercase; }
    @media print {
      .toolbar { display: none !important; }
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span><strong>${items.length}</strong> etiqueta(s) patrimonial(is) pronta(s) para impressão A4</span>
    <button type="button" onclick="window.print()">Imprimir Etiquetas</button>
  </div>
  <div class="qr-grid">${cards}</div>
  <script>setTimeout(function(){ try{ window.print(); }catch(e){} }, 250);</script>
</body>
</html>`;
}

export async function abrirImpressaoEtiquetasQr(items: EtiquetaQrItem[]): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) return;
  const svgs = await Promise.all(
    items.map((it) => renderQrSvg(buildInventarioItemUrl(it.codigo), 140))
  );
  const docHtml = gerarEtiquetasHtml(items, svgs);

  const win = typeof window !== 'undefined' ? window.open('', '_blank', 'width=940,height=720') : null;
  if (win && win.document) {
    win.document.open();
    win.document.write(docHtml);
    win.document.close();
    return;
  }

  // Fallback sem popup via iframe oculto
  if (typeof document !== 'undefined') {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const iDoc = iframe.contentWindow?.document;
    if (iDoc) {
      iDoc.open();
      iDoc.write(docHtml);
      iDoc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // ignore print cancel
        }
        setTimeout(() => iframe.remove(), 3000);
      }, 300);
    }
  }
}

export async function iniciarLeitorCameraQr(
  videoEl: HTMLVideoElement,
  onDetected: (codigo: string) => void,
  onError: (msg: string) => void
): Promise<() => void> {
  let stopped = false;
  let stream: MediaStream | null = null;
  let rafId = 0;

  const stop = () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  };

  const w: any = typeof window !== 'undefined' ? window : {};
  const BarcodeDetectorCtor = w.BarcodeDetector;
  if (!BarcodeDetectorCtor) {
    onError('Leitor de câmera nativo (BarcodeDetector) indisponível neste navegador. Digite ou use leitor USB no campo acima.');
    return stop;
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    onError('Câmera não disponível neste dispositivo/contexto.');
    return stop;
  }

  try {
    const detector = new BarcodeDetectorCtor({ formats: ['qr_code', 'code_128', 'ean_13'] });
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    if (stopped) {
      stop();
      return stop;
    }
    videoEl.srcObject = stream;
    await videoEl.play();

    let lastTick = 0;
    const scanLoop = async (ts: number) => {
      if (stopped) return;
      if (ts - lastTick >= 220 && videoEl.readyState >= 2) {
        lastTick = ts;
        try {
          const codes = await detector.detect(videoEl);
          if (Array.isArray(codes) && codes.length > 0 && codes[0]?.rawValue) {
            const code = extrairCodigoDeLeituraQr(String(codes[0].rawValue));
            if (code) {
              stop();
              onDetected(code);
              return;
            }
          }
        } catch {
          // frame inválido ignorado
        }
      }
      rafId = requestAnimationFrame(scanLoop);
    };
    rafId = requestAnimationFrame(scanLoop);
  } catch (err: any) {
    stop();
    onError(err?.message || 'Não foi possível acessar a câmera.');
  }

  return stop;
}
