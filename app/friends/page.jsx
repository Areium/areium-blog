import { ArrowUpRight } from 'lucide-react';

export const metadata = { title: '友情链接' };

export default function Friends() {
  return <div className="shell inner friends-page">
    <div className="page-heading"><span className="eyebrow">FRIENDS & NEIGHBORS</span><h1>友情链接</h1></div>
    <a className="friend-link" href="https://suborbit.net/" target="_blank" rel="noopener noreferrer"><span className="friend-avatar" aria-hidden="true">S</span><span><strong>Suborbit</strong><small>suborbit.net</small></span><ArrowUpRight size={20}/></a>
  </div>;
}
