import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

const SESSION_COOKIE = '__Host-patchloop_session';
const STATE_COOKIE = '__Host-patchloop_oauth_state';
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function cookieValue(header = '', name) {
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function appendCookie(res, value) {
  const existing = res.getHeader('set-cookie');
  res.setHeader('set-cookie', [...(Array.isArray(existing) ? existing : existing ? [existing] : []), value]);
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function signSession(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const [encoded, supplied, extra] = token.split('.');
  if (!encoded || !supplied || extra) return null;
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!secureEqual(supplied, expected)) return null;
  try {
    const user = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (typeof user.sub !== 'string' || !user.sub || !Number.isInteger(user.exp) || user.exp <= now / 1000) return null;
    return { sub: user.sub, email: user.email, name: user.name };
  } catch { return null; }
}

export function createGoogleAuth({ clientId, clientSecret, publicUrl, sessionSecret }) {
  if (!clientId || !clientSecret || !publicUrl || !sessionSecret) throw new Error('Google hosted mode requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, PATCHLOOP_PUBLIC_URL, and PATCHLOOP_SESSION_SECRET.');
  const base = new URL(publicUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('PATCHLOOP_PUBLIC_URL must be the HTTPS origin of the deployed site.');
  if (Buffer.byteLength(sessionSecret) < 32) throw new Error('PATCHLOOP_SESSION_SECRET must contain at least 32 bytes.');

  const redirectUri = new URL('/auth/google/callback', base).toString();
  const oauth = new OAuth2Client(clientId, clientSecret, redirectUri);
  const signingKey = Buffer.from(sessionSecret);
  const pending = new Map();

  function readSession(header) {
    const token = cookieValue(header, SESSION_COOKIE);
    return token ? verifySession(token, signingKey) : null;
  }

  return {
    redirectUri,
    publicOrigin: base.origin,
    readSession,
    start(res) {
      const state = randomBytes(32).toString('base64url');
      const nonce = randomBytes(32).toString('base64url');
      const now = Date.now();
      for (const [key, item] of pending) if (item.expiresAt < now) pending.delete(key);
      pending.set(state, { nonce, expiresAt: now + 10 * 60 * 1000 });
      appendCookie(res, cookie(STATE_COOKIE, state, 600));
      return oauth.generateAuthUrl({
        response_type: 'code',
        scope: ['openid', 'email', 'profile'],
        state,
        nonce,
        prompt: 'select_account',
      });
    },
    async complete(req, res, url) {
      const state = url.searchParams.get('state');
      const browserState = cookieValue(req.headers.cookie, STATE_COOKIE);
      const transaction = state && pending.get(state);
      if (!transaction || transaction.expiresAt < Date.now() || !browserState || !secureEqual(state, browserState)) throw new Error('Google sign-in state was missing, expired, or did not match. Please try again.');
      pending.delete(state);
      appendCookie(res, cookie(STATE_COOKIE, '', 0));
      const code = url.searchParams.get('code');
      if (!code) throw new Error('Google did not return an authorization code. Please try again.');
      const { tokens } = await oauth.getToken(code);
      if (!tokens.id_token) throw new Error('Google did not return an identity token. Please try again.');
      const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      const claims = ticket.getPayload();
      if (!claims?.sub || claims.nonce !== transaction.nonce || claims.email_verified !== true) throw new Error('Google account could not be verified. Please try a verified account.');
      const session = signSession({
        sub: claims.sub,
        email: claims.email ?? '',
        name: claims.name ?? '',
        exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
      }, signingKey);
      appendCookie(res, cookie(SESSION_COOKIE, session, SESSION_SECONDS));
    },
    clear(res) {
      appendCookie(res, cookie(SESSION_COOKIE, '', 0));
    },
  };
}

export { SESSION_COOKIE, STATE_COOKIE };
