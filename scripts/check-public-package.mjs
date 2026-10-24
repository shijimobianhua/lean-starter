import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const shipping = process.argv.includes('--shipping');
const skip = new Set(['.git','node_modules','dist','artifacts','test-results','playwright-report']);
const problems=[];
const tokenPattern = /(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{35,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const protectedHosts = ["a7c731baf0a07b7c0d18450d402e53b6c4bff9ba11649ed90e648e094c3141dd","07dff79ab37a5164cc90fd25bc2f9b8994925b2e8f8a0c57e5cc7f19b87e942d","417a642ebd5b8571816d15317b9f00a9167f991dd518b3864877ef6536d53215"];
// No publishing authority is shipped. This guard audits accidental credentials and host bindings.
function walk(dir='.') {
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(skip.has(entry.name))continue; const file=path.join(dir,entry.name), rel=file.replaceAll('\\','/').replace(/^\.\//,'');
  if(entry.isSymbolicLink()){problems.push(`${rel}: unexpected symlink`);continue;}
  if(entry.isDirectory()){walk(file);continue;}
  if(/^\.env(?:\.|$)/.test(entry.name)&&entry.name!=='.env.example') {if(shipping)problems.push(`${rel}: environment file must not be published`);continue;}
  if(shipping && (/\.(?:bundle|zip|tar\.gz)$/i.test(rel)||rel==='.openai/hosting.json'))problems.push(`${rel}: private/deployment archive or active hosting identity`);
  if(!/\.(?:tsx?|m?js|cjs|json|md|txt|yml|yaml|html|css)$/.test(rel)&&!['LICENSE','NOTICE','AGENTS.md'].includes(entry.name))continue;
  const data=fs.readFileSync(file,'utf8');if(tokenPattern.test(data))problems.push(`${rel}: possible credential; inspect locally`);
  for(const raw of data.matchAll(/https?:\/\/[^\s"'<>`)]+/g))try{const host=new URL(raw[0]).hostname;const hash=createHash('sha256').update(host).digest('hex');if(protectedHosts.includes(hash))problems.push(`${rel}: protected original deployment host`);}catch{}
 }
}
walk();
if(shipping && !fs.existsSync('LICENSE'))problems.push('LICENSE: missing noncommercial terms');
if(problems.length){console.error([...new Set(problems)].join('\n'));process.exit(1);}
console.log(`Independent starter check passed${shipping?' (shipping audit)':''}. No deploy command or production authority is included.`);
