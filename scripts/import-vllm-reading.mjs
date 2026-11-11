import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Reimport the exported collection without modifying its source workspace.
const source = process.argv[2];
if (!source) throw Error('Usage: node scripts/import-vllm-reading.mjs <collection directory>');
const assets = 'public/reading/vllm';
const output = 'content/vllm-source-reading';
fs.mkdirSync(assets, { recursive: true });
fs.mkdirSync(output, { recursive: true });
const root = '/blog/vllm-source-reading';
const files = ['index.html', ...fs.readdirSync(source).filter(f => /^chapter-\d\d-[a-z]+\.html$/.test(f))];
const header = `<header class="blog-header"><a class="blog-brand black-hole-brand" href="/" aria-label="Areium · 首页"><span class="black-hole" aria-hidden="true"><span class="black-hole-halo"></span><span class="black-hole-ring"></span><span class="black-hole-core"></span><span class="black-hole-ring black-hole-ring-front"></span></span><span>Areium<small>NOTES & EXPLORATIONS</small></span></a><nav aria-label="博客主导航"><a href="/">首页</a><a href="/blog" aria-current="page">文章</a><a href="/projects">作品</a><a href="/friends">友链</a><a href="/about">关于</a></nav><div class="blog-actions"><a href="https://github.com/Areium" target="_blank" rel="noreferrer">GitHub ↗</a><button id="reading-theme" type="button" aria-label="切换夜间模式">夜间</button></div></header>`;
const jumps = `<nav class="reading-jumps" aria-label="页面跳转"><button type="button" id="reading-top" aria-label="跳转到顶部" title="跳转到顶部">↑</button><button type="button" id="reading-bottom" aria-label="跳转到底部" title="跳转到底部">↓</button></nav>`;
for (const file of files) {
  let h = fs.readFileSync(path.join(source, file), 'utf8');
  h = h.replace(/data:font\/([^;]+);base64,([A-Za-z0-9+/=]+)/g, (_, type, data) => {
    const bytes = Buffer.from(data, 'base64');
    const name = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12) + (type === 'woff2' ? '.woff2' : '.ttf');
    fs.writeFileSync(path.join(assets, name), bytes);
    return `/reading/vllm/${name}`;
  });
  h = h.replace('<div class="edition">LEVEL 2 · 展开框架</div>', '')
    .replace(/<a class="sub-link references-link"[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/<section class="section" id="references">[\s\S]*?<\/section>/g, '')
    .replace(/<section class="section"><h2>如何使用多级目录<\/h2>[\s\S]*?<\/section>/g, '')
    .replace(/<details><summary>JetBrains Mono 字体许可[\s\S]*?<\/details>/g, '')
    .replace(/<footer class="end">[\s\S]*?<\/footer>/g, '')
    .replaceAll('总目录与阅读约定', '总目录')
    .replaceAll('全部模块与阅读约定', '全部模块');
  if (file === 'index.html') {
    h = h.replace(/<div class="eyebrow">VLLM V1 \/ SOURCE READING COLLECTION<\/div>[\s\S]*?(?=<div class="meta">)/,
      `<div class="eyebrow">VLLM V1 · 源码精读</div><h1>跟随一次请求，读懂 vLLM<span>从输入处理到 token 输出，串起推理引擎的十个核心模块</span></h1><p class="intro">请求如何进入引擎？Scheduler 怎样决定下一轮计算，KV Cache 如何分配与复用，模型的输出又如何变成可见文本？这组源码笔记沿着请求的执行路径，结合<strong>源码片段、详细解析与逐步拆解</strong>，追踪模块之间的数据传递和关键状态变化。</p><div class="note"><strong>建议这样阅读：</strong>在 VS Code 中打开对应版本的 vLLM 源码，与本页对照阅读；沿函数定义和调用关系查看完整上下文。遇到不理解的代码，可以把相关片段、变量和具体疑问交给 AI 一起分析，再回到源码核对。有运行条件时，建议设置断点进行 Debug，观察变量的具体值、张量形状、调用栈以及请求状态如何变化。</div>`);
    h = h.replace('原教学网址本次此前连接失败，因此模块关系采用工作区配套教学页面与文档，未声称已核实线上内容完全一致。', '阅读时请切换到同一提交，避免版本差异影响理解。');
  }
  h = h.replace(/href="(index\.html|chapter-\d\d-[a-z]+\.html)([^"]*)"/g, (_, f, hash) => `href="${f === 'index.html' ? root : root + '/' + f}${hash}"`);
  h = h.replace('</head>', '<link rel="stylesheet" href="/reading/vllm/blog.css"><script src="/reading/vllm/theme.js"></script></head>')
    .replace('<body>', '<body>' + header + jumps)
    .replace('</body>', '<script src="/reading/vllm/controls.js"></script></body>');
  fs.writeFileSync(file === 'index.html' ? 'content/vllm-source-reading.html' : path.join(output, file), h);
}
fs.copyFileSync(path.join(source, 'JetBrainsMono-OFL.txt'), path.join(assets, 'JetBrainsMono-OFL.txt'));
console.log(`Imported ${files.length} pages with shared fonts.`);
