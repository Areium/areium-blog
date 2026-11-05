import { NextResponse } from 'next/server';
import { authReady, baseURL, sign, verify, cookieOptions, STATE_COOKIE, SESSION_COOKIE } from '../../../../../lib/auth';
export const runtime = 'nodejs';
export async function GET(request) {
  const state = verify(request.cookies.get(STATE_COOKIE)?.value);
  const fail = (message) => { const response = NextResponse.redirect(`${baseURL()}/login?error=${encodeURIComponent(message)}`); response.cookies.set(STATE_COOKIE, '', cookieOptions(0)); return response; };
  if (!authReady()) return fail('GitHub 登录尚未配置。');
  if (!state || state.kind !== 'oauth' || state.state !== request.nextUrl.searchParams.get('state')) return fail('登录请求已过期，请重新登录。');
  if (request.nextUrl.searchParams.has('error')) return fail('GitHub 授权已取消，可以重新尝试。');
  const code = request.nextUrl.searchParams.get('code'); if (!code) return fail('缺少授权码，请重新登录。');
  try {
    const result = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, code_verifier: state.verifier, redirect_uri: `${baseURL()}/api/auth/callback/github` }), signal: AbortSignal.timeout(15000) });
    const token = await result.json(); if (!result.ok || !token.access_token) return fail('授权未成功，请重新尝试。');
    const profileResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Fieldnotes-Blog' }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const profile = await profileResponse.json(); if (!profileResponse.ok || !Number.isSafeInteger(profile.id) || typeof profile.login !== 'string') return fail('无法读取 GitHub 资料，请稍后重试。');
    const user = { id: profile.id, login: profile.login, name: String(profile.name || profile.login).slice(0, 100) };
    const response = NextResponse.redirect(`${baseURL()}${state.next}#comments`); response.cookies.set(SESSION_COOKIE, sign({ kind: 'session', user, exp: Date.now() + 7 * 86400000 }), cookieOptions(7 * 86400)); response.cookies.set(STATE_COOKIE, '', cookieOptions(0)); return response;
  } catch { return fail('暂时无法连接 GitHub，请稍后重试。'); }
}
