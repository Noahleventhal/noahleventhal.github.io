import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const files=(await readdir(root)).filter(file=>file.endsWith('.js'));
files.push(...(await readdir(new URL('animation/',root))).filter(file=>file.endsWith('.js')).map(file=>'animation/'+file));
for(const file of files){const result=spawnSync(process.execPath,['--check',new URL(file,root).pathname],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log(`Checked ${files.length} JavaScript modules`);
