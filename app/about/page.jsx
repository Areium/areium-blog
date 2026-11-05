import { Github, Mail } from 'lucide-react';
import profile from '../../content/profile.json';
import interests from '../../content/interests.json';
export const metadata = { title: '关于 Areium' };
export default function About() {
  return <div className="shell inner about">
    <span className="eyebrow">HELLO, I'M AREIUM.</span>
    <div className="about-identity"><img src={profile.avatar} width="100" height="100" alt="Areium 的头像"/><h1>保持好奇，<br/>慢慢记录。</h1></div>
    <div className="prose"><p>你好，我是 Areium。这里是我的个人博客，记录技术调研、开发实践，也放一些文字创作。</p></div>
    <section className="interest-section" aria-labelledby="games-heading">
      <div className="interest-heading"><span className="eyebrow">OFFLINE / IN GAME</span><h2 id="games-heading">喜欢的游戏</h2></div>
      <div className="game-grid">{interests.games.map(game => <article className={`game-card game-${game.style}`} key={game.name}><span className="game-number" aria-hidden="true">{game.mark}</span><span className="game-english">{game.english}</span><h3>{game.name}</h3></article>)}</div>
    </section>
    <section className="interest-section" aria-labelledby="anime-heading">
      <div className="interest-heading"><span className="eyebrow">STORIES I LOVE</span><h2 id="anime-heading">喜欢的动漫</h2></div>
      <div className="anime-grid">{interests.anime.map(anime => <figure className="anime-card" key={anime.name}><img src={anime.image} alt={`${anime.name} 动漫封面`} width="225" height="320" loading="lazy"/><figcaption>{anime.name}</figcaption></figure>)}</div>
    </section>
    <div className="prose about-contact"><h2>找到我</h2><p><a href={profile.github} target="_blank" rel="noreferrer"><Github size={16}/> GitHub / Areium</a><br/><a href={'mailto:' + profile.email}><Mail size={16}/> {profile.email}</a></p></div>
  </div>;
}
