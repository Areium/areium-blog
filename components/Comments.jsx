'use client';
import { useEffect, useRef, useState } from 'react';
import { Github, ImagePlus, MessageCircle, Smile, X } from 'lucide-react';

const emojis = ['😀', '😊', '😂', '😍', '🤔', '😎', '🥳', '😭', '👍', '👏', '🙏', '❤️', '🔥', '🎉', '✨', '🚀'];
const maxImageBytes = 5 * 1024 * 1024;

export default function Comments({ slug }) {
  const [comments, setComments] = useState([]);
  const [session, setSession] = useState(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const textarea = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    let active = true;
    setComments([]);
    setReplyTo(null);
    setText('');
    setFile(null);
    setMessage('');
    setShowEmojis(false);
    Promise.all([
      fetch(`/api/comments?slug=${encodeURIComponent(slug)}`).then(r => { if (!r.ok) throw Error(); return r.json(); }),
      fetch('/api/auth/session').then(r => { if (!r.ok) throw Error(); return r.json(); }),
    ]).then(([data, auth]) => {
      if (active) { setComments(data.comments); setSession(auth); }
    }).catch(() => { if (active) setMessage('评论暂时无法加载，请刷新后重试。'); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function insertEmoji(emoji) {
    const input = textarea.current;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const next = text.slice(0, start) + emoji + text.slice(end);
    if (next.length > 2000) { setMessage('评论文字最多 2000 字。'); return; }
    setText(next);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function selectImage(event) {
    const selected = event.target.files[0];
    event.target.value = '';
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(selected.type)) {
      setMessage('请选择 JPG、PNG、WebP 或 GIF 图片。');
      return;
    }
    if (!selected.size || selected.size > maxImageBytes) {
      setMessage('图片大小需在 5 MB 以内。');
      return;
    }
    setFile(selected);
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const data = new FormData();
      data.set('slug', slug);
      data.set('body', text);
      if (replyTo) data.set('reply_to_id', String(replyTo.id));
      if (file) data.set('image', file);
      const response = await fetch('/api/comments', { method: 'POST', body: data });
      const result = await response.json().catch(() => { throw Error('上传失败，请稍后重试。'); });
      if (!response.ok) throw Error(result.error);
      setComments(previous => [result.comment, ...previous]);
      setReplyTo(null);
      setText('');
      setFile(null);
      setShowEmojis(false);
      setMessage('评论已发布。');
    } catch (error) {
      setMessage(error.message || '提交失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw Error();
      setSession({ ...session, user: null });
      setReplyTo(null);
      setText('');
      setFile(null);
    } catch {
      setMessage('退出失败，请稍后重试。');
    }
  }

  function beginReply(comment) {
    setReplyTo(comment);
    setMessage('');
    textarea.current.focus();
    textarea.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderComment(comment) {
    return <div className="comment" id={`comment-${comment.id}`} key={comment.id}>
      <a href={`https://github.com/${encodeURIComponent(comment.login)}`} target="_blank" rel="noreferrer"><b>{comment.name}</b><span>@{comment.login}</span></a>
      <time>{comment.created_at.slice(0, 10)}</time>
      {comment.reply_to_id && <div className="comment-reply-label">
        {comment.reply_to_login ? <span>回复 @{comment.reply_to_login}</span> : <span>回复了一条已隐藏的评论</span>}
      </div>}
      {comment.body && <p>{comment.body}</p>}
      {comment.image_url && <a className="comment-image-link" href={comment.image_url} target="_blank" rel="noreferrer" aria-label="查看评论图片"><img src={comment.image_url} alt={`${comment.name} 分享的图片`} loading="lazy"/></a>}
      {session?.user ? <button className="comment-reply-button" type="button" disabled={busy} onClick={() => beginReply(comment)} aria-label={`回复 ${comment.name}`}>回复</button>
        : session?.configured && <a className="comment-reply-button" href={`/api/auth/github?next=/blog/${slug}`}>登录后回复</a>}
    </div>;
  }

  return <section className="comments" id="comments">
    <h2><MessageCircle size={23}/> 留下一点想法 <span>{comments.length}</span></h2>
    <p className="muted">友好交流，分享你的思考。评论发布后公开。</p>
    {session?.user ? <form onSubmit={submit}>
      <div className="comment-user">
        <span><Github size={16}/> {session.user.name} <small>@{session.user.login}</small></span>
        <button type="button" disabled={busy} onClick={logout}>退出登录</button>
      </div>
      {replyTo && <div className="comment-reply-target">
        <div><b>回复 @{replyTo.login}</b><p>{replyTo.body.slice(0, 100) || '图片评论'}</p></div>
        <button type="button" disabled={busy} onClick={() => setReplyTo(null)}><X size={16}/> 取消回复</button>
      </div>}
      <textarea ref={textarea} aria-label="评论内容" disabled={busy} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="有什么想法？写下文字、选择表情或分享一张图片…"/>
      <div className="comment-tools">
        <button type="button" disabled={busy} aria-expanded={showEmojis} onClick={() => setShowEmojis(!showEmojis)}><Smile size={18}/> 表情</button>
        <button type="button" disabled={busy} onClick={() => fileInput.current.click()}><ImagePlus size={18}/> {file ? '更换图片' : '添加图片'}</button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden aria-label="选择评论图片" disabled={busy} onChange={selectImage}/>
        <span className="muted">可选 1 张图片，最多 5 MB · GIF 将转为静态图片</span>
      </div>
      {showEmojis && <div className="comment-emojis" role="group" aria-label="选择表情" onKeyDown={event => { if (event.key === 'Escape') { setShowEmojis(false); textarea.current.focus(); } }}>
        {emojis.map(emoji => <button key={emoji} type="button" disabled={busy} aria-label={`插入表情 ${emoji}`} onMouseDown={event => event.preventDefault()} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}
      </div>}
      {preview && <div className="comment-preview">
        <img src={preview} alt="待发布的评论图片"/>
        <button type="button" disabled={busy} onClick={() => setFile(null)} aria-label="移除图片"><X size={18}/> 移除</button>
        <span>{file?.name}</span>
      </div>}
      <button className="button primary" disabled={busy || (!text.trim() && !file)}>{busy ? '发布中…' : replyTo ? '发表回复' : '发表评论'}</button>
    </form> : <div className="login-prompt">
      <Github size={26}/><div><b>用 GitHub 身份参与讨论</b><p>{session && !session.configured ? 'GitHub 登录尚未配置，配置后即可发表评论。' : '登录后即可发表评论，与你的 GitHub 身份关联。'}</p></div>
      {session?.configured ? <a className="button secondary" href={`/api/auth/github?next=/blog/${slug}`}>GitHub 登录 ↗</a> : <button className="button secondary" disabled>{session ? '等待配置' : '加载中…'}</button>}
    </div>}
    <p role="status" className="status">{message}</p>
    <div>{comments.filter(comment => !comment.thread_id).map(root => <div className="comment-thread" key={root.id}>
      {renderComment(root)}
      <div className="comment-replies">
        {comments.filter(comment => comment.thread_id === root.id).sort((a, b) => a.id - b.id).map(renderComment)}
      </div>
    </div>)}
    {!comments.length && session && <p className="empty-comment">还没有公开评论，期待你的第一条想法。</p>}</div>
  </section>;
}
