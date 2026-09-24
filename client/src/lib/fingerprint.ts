/**
 * Generates a lightweight, privacy-conscious browser/hardware fingerprint
 * combining Canvas 2D rendering, WebGL GPU info, screen metrics, timezone, and platform.
 */
export async function getBrowserFingerprint(): Promise<string> {
  try {
    const components: string[] = [];

    // 1. Screen & Display
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    components.push(`dpr:${window.devicePixelRatio || 1}`);

    // 2. Timezone & Locale
    components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    components.push(`tzo:${new Date().getTimezoneOffset()}`);
    components.push(`lang:${navigator.language || ''}`);

    // 3. Hardware concurrency & platform
    components.push(`cores:${navigator.hardwareConcurrency || 0}`);
    components.push(`platform:${navigator.platform || ''}`);

    // 4. WebGL GPU / Renderer info
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl && gl instanceof WebGLRenderingContext) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          components.push(`gpu:${vendor}~${renderer}`);
        }
      }
    } catch (_) {}

    // 5. Canvas 2D Text & Geometry Hash
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('LogicWhileQuiz-FP-2026', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('LogicWhileQuiz-FP-2026', 4, 17);
        components.push(`canvas:${canvas.toDataURL().slice(-50)}`);
      }
    } catch (_) {}

    const rawString = components.join('|');

    // SHA-256 Hash
    if (crypto?.subtle) {
      const msgBuffer = new TextEncoder().encode(rawString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    }

    // Fallback simple 32-bit hash if subtle crypto unavailable
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      hash = (hash << 5) - hash + rawString.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  } catch (e) {
    return 'fallback_' + Math.random().toString(36).substring(2, 15);
  }
}
