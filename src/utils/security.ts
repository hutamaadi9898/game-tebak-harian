const textEncoder = new TextEncoder();

async function hmacHex(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(input));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveClientId(secret: string, request: Request, provided?: string | null) {
  if (provided) return provided;
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ua = request.headers.get('user-agent') || 'unknown';
  return hmacHex(secret, `${ip}|${ua}`);
}

export async function hashEmail(secret: string, email: string) {
  return hmacHex(secret, email.toLowerCase().trim());
}

export function emailHint(email: string) {
  const [user, domain] = email.split('@');
  if (!user || !domain) return 'redacted';
  const visible = user.slice(0, 2);
  return `${visible}***@${domain}`;
}
