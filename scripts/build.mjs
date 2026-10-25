import './vendor-client.mjs';
import {mkdir, copyFile, cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const assets = ['index.html', 'style.css', 'app.js', 'spreadsheet-model.js', 'workbook.svg', 'CNAME', 'sheet-layout.js', 'ui-popovers.js', 'picker-data.js', 'sheet-structure.js', 'site-config.json'];
await mkdir(output, {recursive: true});
await Promise.all(assets.map(file => copyFile(new URL(file, root), new URL(file, output))));
for(const directory of ['assets','animation','vendor'])await cp(new URL(directory+'/',root),new URL(directory+'/',output),{recursive:true});
console.log(`Built ${assets.length} static files in ${fileURLToPath(output)}`);
