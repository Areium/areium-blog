import fs from 'node:fs';
import path from 'node:path';

// Run in the blog checkout; input is the standalone HTML exported by the lesson.
const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/import-vllm-communication.mjs <lesson.html>');
const out=process.argv[3]||'.';
let html=fs.readFileSync(input,'utf8');
const sourceImporter=fs.readFileSync('scripts/import-vllm-reading.mjs','utf8');
const header=sourceImporter.match(/const header = `([\s\S]*?)`;/)?.[1];
if(!header)throw Error('Existing blog header not found');
const palette={
 '0a121d':'f5f7fa','0b101a':'f6f7f9','0b1420':'f7f9fb','0d1420':'f5f6f8','0e1826':'f8fafc','0f1927':'f8fafc',
 '101925':'ffffff','101a27':'f4f7fa','101b2b':'ffffff','101c2c':'f5f8fa','102c29':'ffffff','111b2be8':'fffffff2',
 '111c29':'ffffff','121c2a':'ffffff','121c2b':'ffffff','121d2a':'ffffff','121f2c':'edf4f2','141f2e':'edf2f6',
 '142131':'eef3f7','152132':'edf2f6','152232':'edf3f7','162232':'edf2f6','172536':'edf3f7','172538':'ffffff',
 '173044':'e9eff5','17362f':'e1f0e8','173a32':'e1f0e8','1a2838':'edf2f7','1a293a':'f5f8fa','203a40':'e1eee9',
 '213b39':'e1eee9','233044':'d8e0e8','234039':'e1eee9','243249':'d1dce7','25364c':'c8d4df','28364b':'d2dce5',
 '2a374a':'cfd9e3','34465b':'bac9d6','35465e':'afbfce','385a50':'9cbdad','41536b':'a6b8c9','427263':'93b9a6',
 '477b69':'8cae9c','6b839e':'526b83','7086a0':'5c7187','74c9ff':'1766a1','76efca':'08775b','8295ae':'5c7087',
 '89bbaa':'256b53','8fa4be':'52677f','90a5be':'52677f','97abc3':'52677f','9aacbf':'53687d','9eafc7':'52667c',
 'a4d3c8':'256f5c','b4c5da':'465d77','bbd0e4':'405b73','c2a0ff':'7249ab','c4d2e2':'344b63','c5d4e5':'344b63',
 'c6d5e8':'344b63','e7eef9':'203044','fa92b1':'ad3e66','ffcc7e':'946012'
};
// CSS variables also work in dynamically generated SVG attributes and inline styles.
html=html.replace(/#([\da-f]{8}|[\da-f]{6})\b/gi,(full,key)=>palette[key.toLowerCase()]?'var(--c-'+key.toLowerCase()+')':full);
const dark=Object.keys(palette).map(k=>`--c-${k}:#${k}`).join(';');
const light=Object.entries(palette).map(([k,v])=>`--c-${k}:#${v}`).join(';');
const themeInit=fs.readFileSync('public/reading/vllm/theme.js','utf8');
const themeCSS=`
:root{${light};color-scheme:light}
html[data-theme=dark]{${dark};color-scheme:dark}
.blog-header{height:80px;position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:24px;margin:0;padding:0 32px;background:#faf8f3;border-bottom:1px solid #e1ddd3;color:#282c29}
.blog-header a{text-decoration:none;color:inherit}.blog-brand{display:flex;align-items:center;gap:12px;font-size:23px;font-weight:700;line-height:1.2;white-space:nowrap}.blog-brand small{display:block;font-size:9px;letter-spacing:1.7px;font-weight:400;margin-top:6px;color:#737870}
.blog-header nav{display:flex;flex-direction:row;gap:4px;padding:4px;border:1px solid #e1ddd3;border-radius:12px;background:#f0eee7;overflow:visible}.blog-header nav a{padding:8px 20px;font-size:14px;border-radius:8px}.blog-header nav a:hover,.blog-header nav a[aria-current]{background:#fff;color:#a85822}
.blog-actions{display:flex;align-items:center;gap:20px;font-size:13px}.blog-actions button{border:1px solid #dedbd1;border-radius:8px;padding:7px 12px;background:#fff;color:inherit;white-space:nowrap}
html[data-theme=dark] .blog-header{background:#131f2b;border-color:#334953;color:#e0e9ef}html[data-theme=dark] .blog-brand small{color:#9caebb}html[data-theme=dark] .blog-header nav{background:#182b3b;border-color:#334953}html[data-theme=dark] .blog-header nav a:hover,html[data-theme=dark] .blog-header nav a[aria-current]{background:#28405b;color:#ccb2ff}html[data-theme=dark] .blog-actions button{background:#233746;border-color:#405763}
.blog-header~main{padding-top:28px}html{scroll-padding-top:95px}
@media(max-width:1000px){.blog-header{gap:12px;padding:0 18px}.blog-header nav a{padding:8px 12px}.blog-actions>a{display:none}}
@media(max-width:760px){.blog-header{height:112px;flex-wrap:wrap;align-content:center;gap:10px;padding:10px 16px}.blog-brand{font-size:20px}.blog-header nav{order:3;width:100%;justify-content:space-around}.blog-header nav a{padding:4px 12px}.blog-actions{margin-left:auto}.blog-brand small{font-size:8px}}
@media print{.blog-header{display:none}}
`;
// Reuse the current brand's existing CSS, without importing article-specific rules.
const sharedCSS=fs.readFileSync('public/reading/vllm/blog.css','utf8');
const brandCSS=sharedCSS.slice(sharedCSS.indexOf('.black-hole-brand{'),sharedCSS.indexOf('\n.sidebar,.progress'));
const controls=`(() => {
 const root=document.documentElement,button=document.getElementById('reading-theme'),media=matchMedia('(prefers-color-scheme: dark)');
 function update(){const dark=root.dataset.theme==='dark';button.textContent=dark?'☀ 日间':'☾ 夜间';button.setAttribute('aria-label',dark?'切换为日间模式':'切换为夜间模式');button.setAttribute('aria-pressed',String(dark));}
 function sync(){let saved;try{saved=localStorage.getItem('areium-theme')}catch{}root.dataset.theme=['light','dark'].includes(saved)?saved:media.matches?'dark':'light';update();}
 button.addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('areium-theme',root.dataset.theme)}catch{}update();});
 media.addEventListener('change',sync);window.addEventListener('storage',sync);update();
 import('/header-hover.js').then(({setupHeaderHover})=>setupHeaderHover(document.querySelector('.blog-header'))).catch(()=>{});
})();`;
const title='vLLM 通信原理：动画与源码对照';
html=html.replace(/<title>.*?<\/title>/,`<title>${title} · Areium</title>`)
 .replace('<h1>看见 GPU 之间的数据流动</h1>',`<h1>${title}</h1>`)
 .replace('</head>',`<meta name="description" content="通过九种通信原语的交互动画，对照 vLLM 与 vLLM-Ascend 的真实源码，理解拼接、归约与数据重排。"><link rel="stylesheet" href="/header-hover.css"><style>${themeCSS}\n${brandCSS}</style><script>${themeInit}</script></head>`)
 .replace('<body>','<body>'+header)
 .replace('</body>',`<script>${controls}</script></body>`)
 .replace(/[\t ]+$/gm,'');
const dest=path.join(out,'content/vllm-communication.html');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,html);
console.log('Generated themed article:',dest);
