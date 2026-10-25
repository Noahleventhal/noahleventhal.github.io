import {uid, clone} from './project.js';
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export class SpreadsheetRecorder {
  constructor({clock = () => performance.now()} = {}) {this.clock = clock; this.running = false; this.events = []; this.lastAt = new Map();}
  start(sheetId, name = 'New recording') {this.sheetId = sheetId; this.name = name; this.started = this.clock(); this.events = []; this.running = true; this.lastAt.clear();}
  record(type, data, {throttle = 0, force = false, timestamp = this.clock()} = {}) {
    if (!this.running) return;
    if (this.events.length >= 20000) throw new Error('Recording limit reached. Stop and save this recording.');
    const at = Math.max(0, timestamp - this.started), previous = this.lastAt.get(type);
    if(at>600000)throw new Error('Ten-minute recording limit reached. Save this recording and start another.');
    if (!force && previous !== undefined && at - previous < throttle) return;
    const last = this.events.at(-1);
    if (!force && last?.type === type && equal({...last, at:0, id:''}, {...data, type, at:0, id:''})) return;
    this.events.push({id:uid(), at, type, ...clone(data)}); this.lastAt.set(type,at);
  }
  captureMutation(before, after) {
    if (!this.running) return;
    const oldSheet = before.sheets.find(sheet => sheet.id === this.sheetId), sheet = after.sheets.find(sheet => sheet.id === this.sheetId);
    if (!oldSheet || !sheet) return;
    const changes = [];
    for (const key of new Set([...Object.keys(oldSheet.cells), ...Object.keys(sheet.cells)])) {
      const old = oldSheet.cells[key] || {value:'',format:{}}, cell = sheet.cells[key] || {value:'',format:{}};
      if (equal(old,cell)) continue;
      const [row,col] = key.split(':').map(Number), patch = {row,col};
      if (old.value !== cell.value) patch.value = cell.value;
      const format = {};
      for (const prop of new Set([...Object.keys(old.format), ...Object.keys(cell.format)])) if (!equal(old.format[prop],cell.format[prop])) format[prop] = cell.format[prop] ?? null;
      if (Object.keys(format).length) patch.format = format;
      changes.push(patch);
    }
    if (changes.length) this.record('cells',{changes});
    if(!equal(oldSheet.merges||[],sheet.merges||[])){const before=oldSheet.merges||[],after=sheet.merges||[];this.record('merges',{add:after.filter(range=>!before.some(item=>equal(item,range))),remove:before.filter(range=>!after.some(item=>equal(item,range)))});}
    for (const [axis,key] of [['col','columnWidths'],['row','rowHeights']]) {
      const changes = [];
      for (const index of new Set([...Object.keys(oldSheet[key] || {}),...Object.keys(sheet[key] || {})])) if (oldSheet[key]?.[index] !== sheet[key]?.[index]) changes.push({index:Number(index),size:sheet[key]?.[index] ?? null});
      if (changes.length) this.record('sizes',{axis,changes});
    }
  }
  stop() {if (!this.running) return null; this.running = false; return {id:uid(), name:this.name, sourceSheetId:this.sheetId, pointerVersion:3, duration:Math.max(100,Math.min(600000,Math.round(this.clock()-this.started))),events:clone(this.events).sort((a,b)=>a.at-b.at)};}
}
