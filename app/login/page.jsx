import Link from 'next/link';
import { Github } from 'lucide-react';
import { authReady } from '../../lib/auth';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'GitHub 登录' };
export default async function Login({ searchParams }) { const { error } = await searchParams; return <div className="shell inner empty"><Github size={36}/><h1>用 GitHub 加入交流</h1><p>{error || '登录后即可在文章下发表评论。'}</p>{authReady() ? <a className="button primary" href="/api/auth/github">继续使用 GitHub</a> : <p>此模板尚未配置 GitHub 登录，请在本地环境文件中填写 OAuth App 信息。</p>}<p><Link href="/blog">← 返回文章</Link></p></div>; }
