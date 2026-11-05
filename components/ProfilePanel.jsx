import { Github, Mail, ArrowUpRight } from 'lucide-react';
import profile from '../content/profile.json';

export default function ProfilePanel({ posts }) {
  const published = posts.filter(post => !post.example);
  return <aside className="profile-panel">
    <div className="profile-banner"/>
    <img className="profile-avatar" src={profile.avatar} alt={`${profile.name} 的头像`} width="84" height="84"/>
    <div className="profile-content">
      <span className="eyebrow">THE PERSON BEHIND THE NOTES</span>
      <h2>{profile.name}<span className="green-dot"/></h2>
      <p>{profile.bio}</p>
      <div className="profile-stats"><div><strong>{published.length}</strong><span>收录文章</span></div><div><strong>{new Set(published.flatMap(post => post.tags)).size}</strong><span>探索主题</span></div></div>
      <a href={`mailto:${profile.email}`}><Mail size={16}/><span>{profile.email}</span><ArrowUpRight size={13}/></a>
      <a href={profile.github} target="_blank" rel="noreferrer"><Github size={16}/><span>GitHub / Areium</span><ArrowUpRight size={13}/></a>
      <div className="profile-signature">Learn. Think. Share.</div>
    </div>
  </aside>;
}
