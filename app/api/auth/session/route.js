import { NextResponse } from 'next/server';
import { getUser, authReady } from '../../../../lib/auth';
export async function GET(request) { return NextResponse.json({ user: getUser(request), configured: authReady() }, { headers: { 'Cache-Control': 'no-store' } }); }
