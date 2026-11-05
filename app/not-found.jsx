import Link from 'next/link';
export default function NotFound() { return <div className="shell inner empty"><span className="eyebrow">404 / LOST IN THE CODE</span><h1>这一页还没有写下。</h1><p>页面不存在，回首页继续看看吧。</p><Link href="/" className="button primary">回到首页 →</Link></div>; }
