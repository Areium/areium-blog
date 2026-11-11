// Separate routing corridors keep forward and return paths clear of nodes and labels.
export function frameworkDiagram(prefix = 'framework') {
  const root = '/blog/vllm-source-reading';
  const node = (x, y, w, h, num, id, name, desc, extra = '') => `<a href="${root}/chapter-${num}-${id}.html" aria-label="第 ${num} 章 ${name}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#fff" stroke="#c7d9d7"/><text x="${x + 16}" y="${y + 24}" class="diagram-num">${num}</text><text x="${x + 16}" y="${y + 49}" class="diagram-name">${name}</text><text x="${x + 16}" y="${y + 71}" class="diagram-desc">${desc}</text>${extra ? `<text x="${x + 16}" y="${y + 92}" class="diagram-desc">${extra}</text>` : ''}</a>`;
  const arrow = (d, kind = 'forward', both = false) => `<path d="${d}"${both ? ` marker-start="url(#${prefix}-${kind})"` : ''} marker-end="url(#${prefix}-${kind})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 750" role="group" aria-labelledby="${prefix}-title ${prefix}-desc"><title id="${prefix}-title">vLLM V1 模块结构：请求、调度、执行与回写</title><desc id="${prefix}-desc">输入经核心客户端进入 Scheduler，Scheduler 协调 KVCacheManager，并由 Executor 派发至 Worker、GPUModelRunner 和采样器。执行结果沿底部返回核心更新状态，随后交给输出处理。请求与执行使用绿色实线，结果返回使用蓝色虚线。点击模块可打开对应章节。</desc>
  <defs>${['forward', 'return'].map(kind => `<marker id="${prefix}-${kind}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="${kind === 'forward' ? '#158474' : '#627ca6'}"/></marker>`).join('')}</defs>
  <style>.diagram-name{font-size:17px;font-weight:600}.diagram-desc{font-size:13px;fill:#637c80}.diagram-num{font-family:'JetBrains Mono Embedded',monospace;font-size:11px;fill:#138171}.diagram-zone{font-size:19px;font-weight:600}.diagram-link-label{font-size:12px;fill:#527a75}.framework-figure svg text,.diagram-dialog svg text{font-family:'OPPO Sans Embedded','OPPO Sans',sans-serif;fill:#183a43}.framework-figure svg a:hover rect,.diagram-dialog svg a:hover rect{stroke:#168775;stroke-width:2}svg a:focus-visible rect{stroke:#d29a2e;stroke-width:3}</style>
  <rect width="1240" height="750" fill="#fff"/>
  <text x="32" y="39" font-size="22" font-weight="600">一个请求，经过哪些模块？</text>
  <path d="M840 33H883" stroke="#158474" stroke-width="2.4" marker-end="url(#${prefix}-forward)"/><text x="895" y="38" class="diagram-desc">请求 / 执行</text>
  <path d="M1050 33H1093" stroke="#627ca6" stroke-width="2.4" stroke-dasharray="6 5" marker-end="url(#${prefix}-return)"/><text x="1105" y="38" class="diagram-desc">结果返回</text>
  <rect x="24" y="90" width="274" height="560" rx="18" fill="#f5f8fa" stroke="#e1e9ec"/>
  <rect x="334" y="90" width="530" height="560" rx="18" fill="#f1f8f5" stroke="#d7e8df"/>
  <rect x="904" y="90" width="312" height="560" rx="18" fill="#f5f7fb" stroke="#e0e5f0"/>
  <text x="50" y="124" class="diagram-zone">前端服务</text><text x="50" y="149" class="diagram-desc">整理输入 · 通信 · 解码输出</text>
  <a href="${root}/chapter-03-core.html"><text x="358" y="124" class="diagram-zone">03 · EngineCore</text><text x="358" y="149" class="diagram-desc">核心主循环：调度 → 执行 → 回写</text></a>
  <text x="930" y="124" class="diagram-zone">设备执行</text><text x="930" y="149" class="diagram-desc">设备资源 · 模型前向 · 采样</text>
  <g fill="none" stroke="#158474" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  ${arrow('M162 282V360')}
  ${arrow('M274 403H312Q324 403 324 391V308Q324 296 336 296H374')}
  ${arrow('M564 296H634', 'forward', true)}
  ${arrow('M469 347V410')}
  ${arrow('M728 453H880Q892 453 892 441V253Q892 241 904 241H934')}
  ${arrow('M1059 282V360')}
  ${arrow('M1059 442V520')}
  </g>
  <g fill="none" stroke="#627ca6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 5">
  ${arrow('M1059 602V678Q1059 690 1047 690H613Q601 690 601 678V620', 'return')}
  ${arrow('M374 585H274', 'return')}
  </g>
  ${node(50, 200, 224, 82, '01', 'input', 'InputProcessor', '输入校验与请求整理')}
  ${node(50, 360, 224, 86, '02', 'client', 'EngineCoreClient', '把请求交给核心')}
  ${node(50, 550, 224, 82, '10', 'output', 'OutputProcessor', 'token → 可见文本')}
  ${node(374, 245, 190, 102, '04', 'scheduler', 'Scheduler', '选择请求与 token 数', 'waiting / running')}
  ${node(634, 245, 194, 102, '05', 'kv', 'KVCacheManager', '复用与分配 KV 块')}
  ${node(454, 410, 274, 86, '06', 'executor', 'Executor', '向执行后端派发计划')}
  ${node(934, 200, 250, 82, '07', 'worker', 'Worker', '管理设备与运行资源')}
  ${node(934, 360, 250, 82, '08', 'runner', 'GPUModelRunner', '组批次 · 模型前向')}
  ${node(934, 520, 250, 82, '09', 'sampling', 'Sampler / 结果', 'logits → token ID')}
  <rect x="374" y="550" width="454" height="70" rx="11" fill="#e6f0ed"/><text x="601" y="578" text-anchor="middle" font-size="16" font-weight="600">执行结果 → Scheduler 回写</text><text x="601" y="602" text-anchor="middle" class="diagram-desc">更新进度与停止状态 · 未结束则继续下一轮</text>
  <g class="diagram-link-label"><text x="177" y="326">核心请求</text><text x="338" y="379">请求</text><text x="599" y="279" text-anchor="middle">KV 块</text><text x="484" y="384">执行计划</text><text x="800" y="440" text-anchor="middle">派发</text><text x="1074" y="326">调用 Runner</text><text x="1074" y="485">logits</text><text x="324" y="571" text-anchor="middle">回传</text><text x="830" y="678" text-anchor="middle">ModelRunnerOutput</text></g>
  <text x="32" y="730" class="diagram-desc">点击模块进入章节。分区表示职责；结果回传折叠了 EngineCoreClient 接收路径。</text></svg>`;
}
