import fs from 'node:fs';
import path from 'node:path';
const file='content/inside-vllm-zh.md';
let text=fs.readFileSync(file,'utf8');
const urls=[...new Set([...text.matchAll(/!\[[^\]]*\]\((https:\/\/vllm\.ai\/blog-assets\/[^)]+)\)/g)].map(match=>match[1]))];
const results=[];
fs.mkdirSync('public/images/inside-vllm',{recursive:true});
let index=0;
await Promise.all(Array.from({length:4},async()=>{
  while(index<urls.length){const url=urls[index++];const name=path.basename(new URL(url).pathname);const target='public/images/inside-vllm/'+name;
    try{if(!fs.existsSync(target)){const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('HTTP '+response.status);const data=Buffer.from(await response.arrayBuffer());if(!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Not a PNG');fs.writeFileSync(target,data)}results.push({url,local:'/images/inside-vllm/'+name});}
    catch(error){console.log(name+': '+error.message)}
  }
}));
for(const result of results)text=text.replaceAll(result.url,result.local);
fs.writeFileSync(file,text);
console.log(`Cached ${results.length}/${urls.length} article images.`);
if(results.length!==urls.length)process.exitCode=1;
