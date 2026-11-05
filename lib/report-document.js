// Embedded HTML remains isolated. Only theme, height and anchor messages cross the frame boundary.
export function reportDocument(html) {
  const additions = `<style>
@font-face{font-family:"OPPO Sans";src:url("/fonts/OPlusSans3-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}
body,button,input,select,textarea,.filelinks b{font-family:"OPPO Sans","Microsoft YaHei",system-ui,sans-serif}pre,code{font-family:Consolas,"Cascadia Code",monospace}
:root{color-scheme:light}body{background:#faf9f6}main{max-width:100%;padding-left:0;padding-right:0}body>header{position:relative;background:#faf9f6}body>.intro{background:#faf9f6}.screen .diagram{max-height:none}.chapter,.overview-chart{box-shadow:none}
html[data-theme=dark]{color-scheme:dark;--bg:#0c1422;--surface:#142034;--surface-2:#1b2c45;--line:#30435f;--text:#e0e9f5;--ink:#e0e9f5;--muted:#a3b1c7;--blue:#91bdf7;--green:#83b8eb;--red:#e8a492}
html[data-theme=dark] body,html[data-theme=dark] main,html[data-theme=dark] body>header,html[data-theme=dark] .toolbar{background:#0c1422!important;color:#e0e9f5!important}
html[data-theme=dark] :is(article,.chapter,.overview-chart,.calc,.results>div,.secondary-card,.report-select-list,.chip,.scope,.narrative,.tools,.takeaway,.chart-detail,.comparison-note){background:#142034!important;border-color:#30435f!important;color:#c9d7eb!important}
html[data-theme=dark] :is(h1,h2,h3,b,strong,td,td:first-child,summary,.toolbar a,.report-select-trigger,.report-select-option,.results strong,.node .label){color:#e0eafa!important}
html[data-theme=dark] :is(p,.sub,.note,.key-note,.intro,.methods,.hero-meta,.source,.explain,.mapping-relation,.filelinks b,.line-tag,label,small,.results span,footer){color:#a4b5cd!important}
html[data-theme=dark] a{color:#99c2ff!important}html[data-theme=dark] :is(button,input,select,th,nav a,.payload){background:#1e304d!important;color:#e2edff!important;border-color:#405a7d!important}
html[data-theme=dark] :is(td,.table-scroll,.chart-options,.chart-data,.chart-notes,.card-evidence,.source-details){border-color:#30435f!important}
html[data-theme=dark] :is(.toolbar a:hover,.report-select-option:hover,.report-select-option[data-active=true],tbody tr:hover,button:hover){background:#294366!important}
html[data-theme=dark] .primary,html[data-theme=dark] .stepdots .current{background:#8cb9f5!important;color:#101c2e!important}
html[data-theme=dark] svg,html[data-theme=dark] .chart-scroll svg{background:#101b2c!important}
html[data-theme=dark] svg text{fill:#cadbf1!important;stroke:none!important}
html[data-theme=dark] .group rect{fill:#182a40!important;stroke:#3e5879!important}
html[data-theme=dark] .node rect{fill:#1d314d!important;stroke:#577ca8!important}
html[data-theme=dark] .node.active rect{fill:#294b75!important;stroke:#a2cbff!important}
html[data-theme=dark] .node.visited rect{fill:#233d5e!important}
html[data-theme=dark] .edge path{stroke:#6484ad!important}html[data-theme=dark] .edge.hot path{stroke:#a2cbff!important}
html[data-theme=dark] .payload pre{color:#dbeaff!important}html[data-theme=dark] .progress{background:#253b59!important}
/* Hardware report: override its original fixed light palette, including SVG data labels. */
html[data-theme=dark]{background:#0c1422;scrollbar-color:#456080 #101b2c}
html[data-theme=dark] :is(.eyebrow,.edition,.hero-cross,.hero-subtitle,.card-refs,.secondary-section em,.method-strip>div,.source-details>summary span,#chart-scope-note){color:#afc0d9!important}
html[data-theme=dark] :is(.toolbar,.chart-scroll,.method-strip>div,.secondary-section em,.source-details>summary span,footer,.hero-subtitle){border-color:#30435f!important}
html[data-theme=dark] :is(.summary div,.callout){background:#17263d!important;border-color:#456a9d!important}
html[data-theme=dark] :is(#chart-status,.chart-tooltip){color:#d1e3fa!important}
html[data-theme=dark] .era:after{background:#30435f}
html[data-theme=dark] .chart-heading .eyebrow{color:#afc0d9}
html[data-theme=dark] .chart-legend{color:#efa18f}
html[data-theme=dark] .chart-legend span{color:#9bd3a5}
html[data-theme=dark] .chart-legend span[style]{color:#b4caf5!important}
html[data-theme=dark] .columns-head div{border-color:#efa18f}
html[data-theme=dark] .columns-head div:last-child{border-color:#9bd3a5}
html[data-theme=dark] .pair>div:first-child:before{color:#efa18f}
html[data-theme=dark] .pair>div:last-child:before{color:#9bd3a5}
html[data-theme=dark] .chart-grid{stroke:#2c405c}
html[data-theme=dark] .chart-link{stroke:#7188a8}
html[data-theme=dark] .chart-scroll svg :is(text,tspan){fill:#c9d9ed!important}
html[data-theme=dark] .chart-scroll svg [fill="#b76250"]{fill:#efa18f!important}
html[data-theme=dark] .chart-scroll svg [fill="#5a803e"]{fill:#9bd3a5!important}
html[data-theme=dark] .chart-scroll svg .point-shape[fill="#354b39"]{fill:#b4caf5!important}
html[data-theme=dark] .chart-scroll svg text[fill="#faf9f6"]{fill:#0c1422!important}
html[data-theme=dark] :is(.chart-selected,.chart-point:hover .point-shape,.chart-point:focus .point-shape){stroke:#e2edff;stroke-width:3}
html[data-theme=dark] .report-select-list{background:#192a43!important;color:#e0e9f5;box-shadow:0 12px 32px #0006}
html[data-theme=dark] .report-select-option[aria-selected=true]{background:#253f63;color:#dceaff!important}
html[data-theme=dark] .report-select-trigger::after,html[data-theme=dark] .report-select-option[aria-selected=true]::after,html[data-theme=dark] details>summary::before{color:#91bdf7}
html[data-theme=dark] :is(input,.report-select-trigger,summary):focus-visible{outline:2px solid #91bdf7;outline-offset:3px}
html[data-theme=dark] input::placeholder{color:#90a3bf;opacity:1}
html[data-theme=dark] .chart-label-toggle input{accent-color:#91bdf7}
html[data-theme=dark] .sources li::marker{color:#91bdf7}
html[data-theme=dark] .sources li:target{background:#203a60;outline-color:#203a60}
@media print{html[data-theme=dark] body{background:white!important;color:#101c2e!important}}
</style><script>(()=>{
const send=()=>parent.postMessage({type:'areium-report-height',height:Math.ceil(document.body.getBoundingClientRect().height)+8},'*');
new ResizeObserver(send).observe(document.body);
window.addEventListener('load',send);
window.addEventListener('message',event=>{if(event.source!==parent)return;if(event.data?.type==='areium-theme'&&['light','dark'].includes(event.data.theme)){document.documentElement.dataset.theme=event.data.theme;send()}if(event.data?.type==='areium-report-measure')send()});
document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(!link)return;let target;try{target=document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)))}catch{}if(!target)return;event.preventDefault();let p=target.parentElement;while(p){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement}send();parent.postMessage({type:'areium-report-anchor',top:target.getBoundingClientRect().top+window.scrollY},'*')});send();
})();</script>`;
  // Replace the previous import bridge to avoid duplicate scroll/resize listeners.
  const withoutLegacyBridge = html.replace(/<script>\(\(\)=>\{const measure=\(\)=>parent\.postMessage[\s\S]*?<\/script>/, '');
  return withoutLegacyBridge
    .replace("style-src 'unsafe-inline';", "style-src 'unsafe-inline'; font-src http: https:;")
    .replace(/<\/body>/i, additions + '</body>');
}
