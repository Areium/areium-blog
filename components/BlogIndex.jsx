'use client';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import ArticleCard from './ArticleCard';

export default function BlogIndex({ posts, initialTag = '' }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [tag, setTag] = useState(initialTag);
  const tags = [...new Set(posts.flatMap(post => post.tags))];
  const filtered = posts.filter(post =>
    (category === '全部' || post.category === category) &&
    (!tag || post.tags.includes(tag)) &&
    (post.title + post.description + post.tags.join(' ')).toLowerCase().includes(query.toLowerCase())
  );
  return <>
    <div className="filter-bar">
      <div className="filters">{['全部', ...new Set(posts.map(post => post.category))].map(value => <button aria-pressed={category === value} className={category === value ? 'selected' : ''} key={value} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <label className="search"><Search size={17}/><input aria-label="搜索文章" placeholder="搜索文章、标签…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    </div>
    <div className="tag-filter" aria-label="按标签筛选"><span>标签</span>{tags.map(value => <button key={value} aria-pressed={tag === value} className={tag === value ? 'active' : ''} onClick={() => setTag(tag === value ? '' : value)}># {value}</button>)}{tag && <button onClick={() => setTag('')} aria-label="清除标签"><X size={13}/>清除</button>}</div>
    <p className="result-count" aria-live="polite">{tag ? '「' + tag + '」 · ' : ''}{filtered.length} 篇文章</p>
    <div className="post-card-grid">{filtered.map(post => <ArticleCard key={post.slug} post={post}/>)}</div>
    {!filtered.length && <div className="empty">没有找到相关文章，试试其他关键词或清除筛选。</div>}
  </>;
}
