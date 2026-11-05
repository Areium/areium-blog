import { ArrowUpRight } from 'lucide-react';
import friends from '../../content/friends.json';

export const metadata = { title: '友情链接' };

export default function Friends() {
  return <div className="shell inner friends-page">
    <div className="page-heading"><span className="eyebrow">FRIENDS & NEIGHBORS</span><h1>友情链接</h1></div>
    <div className="friends-grid">{friends.map(friend => <a className="friend-link friend-profile" key={friend.url} href={friend.url} target="_blank" rel="noopener noreferrer" style={{ '--friend-color': friend.color }}><img className="friend-avatar" src={friend.avatar} alt={`${friend.name}的头像`} width="68" height="68"/><span className="friend-copy"><strong>{friend.name}</strong><span className="friend-description">{friend.description}</span><small>{new URL(friend.url).hostname}</small></span><ArrowUpRight size={20}/></a>)}</div>
  </div>;
}
