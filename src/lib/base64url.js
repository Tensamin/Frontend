// browser + Node compatible

export function bufferToBase64url(buf) {
  const b64 = btoa(
    String.fromCharCode(...new Uint8Array(buf))
  );
  return b64.replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
}

export function base64urlToBuffer(b64url) {
  const pad = '='.repeat((4 - b64url.length % 4) % 4);
  const b64 = b64url.replace(/-/g, '+')
                    .replace(/_/g, '/')
            + pad;
  const bin = atob(b64);
  return new Uint8Array(
    [...bin].map(ch => ch.charCodeAt(0))
  );
}