import { createHmac, timingSafeEqual } from 'node:crypto';
export const SESSION_COOKIE = 'fieldnotes_session';
export const STATE_COOKIE = 'fieldnotes_oauth';
export function baseURL() { return new URL(process.env.SITE_URL || 'http://localhost:3000').origin; }
export function authReady() { return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.AUTH_SECRET?.length >= 32); }
export function sign(value) { if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET must contain at least 32 characters'); const data = Buffer.from(JSON.stringify(value)).toString('base64url'); return `${data}.${createHmac('sha256', process.env.AUTH_SECRET).update(data).digest('base64url')}`; }
export function verify(token) { try { if (!token || !process.env.AUTH_SECRET) return null; const [data, signature, extra] = token.split('.'); if (extra || !signature) return null; const expected = createHmac('sha256', process.env.AUTH_SECRET).update(data).digest(); const actual = Buffer.from(signature, 'base64url'); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null; const result = JSON.parse(Buffer.from(data, 'base64url').toString()); return Number.isFinite(result.exp) && result.exp > Date.now() ? result : null; } catch { return null; } }
export function cookieOptions(maxAge) { return { httpOnly: true, secure: baseURL().startsWith('https:'), sameSite: 'lax', path: '/', maxAge }; }
export function getUser(request) { const value = verify(request.cookies.get(SESSION_COOKIE)?.value); return value?.kind === 'session' && Number.isSafeInteger(value.user?.id) && typeof value.user?.login === 'string' ? value.user : null; }
export function sameOrigin(request) { return request.headers.get('origin') === baseURL(); }
