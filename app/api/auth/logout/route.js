import { NextResponse } from 'next/server';
import { cookieOptions, SESSION_COOKIE, sameOrigin } from '../../../../lib/auth';
export async function POST(request) { if (!sameOrigin(request)) return NextResponse.json({ error: '来源无效' }, { status: 403 }); const response = NextResponse.json({ ok: true }); response.cookies.set(SESSION_COOKIE, '', cookieOptions(0)); return response; }
