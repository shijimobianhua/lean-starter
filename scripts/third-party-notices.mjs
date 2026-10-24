import fs from 'node:fs';
import path from 'node:path';
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
const rows=[];const licenses=[];
for(const [location,entry] of Object.entries(lock.packages||{})){
 if(!location||entry.dev)continue;
 const pkgFile=path.join(location,'package.json');if(!fs.existsSync(pkgFile))throw Error(`Missing ${location}; run npm ci first`);
 const p=JSON.parse(fs.readFileSync(pkgFile,'utf8'));const name=p.name||location.split('node_modules/').at(-1);
 let license=typeof p.license==='string'?p.license:JSON.stringify(p.license||entry.license||'See upstream');
 rows.push(`| ${name} | ${p.version} | ${license.replaceAll('|',' / ')} |`);
 const found=fs.readdirSync(location).filter(f=>/^(?:license|licence|copying|notice)(?:\.|$)/i.test(f)&&fs.statSync(path.join(location,f)).isFile());
 licenses.push(`\n## ${name} ${p.version}\n\nLicense metadata: ${license}\n${p.repository ? 'Repository: '+(typeof p.repository==='string'?p.repository:p.repository.url)+'\n':''}`);
 for(const f of found)licenses.push(`\n### ${f}\n\n${fs.readFileSync(path.join(location,f),'utf8')}\n`);
 if(!found.length)licenses.push('\nNo top-level license file in installed package; see package metadata/upstream and nested licenses.\n');
}
fs.mkdirSync('docs',{recursive:true});
fs.writeFileSync('THIRD_PARTY_NOTICES.md','# Third-party notices\n\nThe project noncommercial license does not replace third-party licenses. These packages retain their own permissions, copyright and conditions. Generated from the locked production dependency graph, including transitive runtime packages. Development dependencies keep their own licenses too.\n\n| Package | Version | License |\n| --- | --- | --- |\n'+rows.sort().join('\n')+'\n\nFull available installed license texts: [docs/THIRD_PARTY_LICENSES.txt](docs/THIRD_PARTY_LICENSES.txt).\n');
fs.writeFileSync('docs/THIRD_PARTY_LICENSES.txt','Collected runtime dependency license and notice files. Paths refer to the locked npm installation; this is a notice collection, not a relicensing of any dependency.\n'+licenses.join('\n'));
console.log(`Collected ${rows.length} runtime package notices.`);
