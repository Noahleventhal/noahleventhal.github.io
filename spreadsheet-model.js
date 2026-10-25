import {cleanMerges,mergeAt,cellAnchor,expandMergedSelection,intersects} from './sheet-structure.js';
// Workbook data and history have no dependency on the page or browser DOM.
export const STORAGE_KEY = 'noah-personal-workbook-v1';
export const DEFAULT_FORMAT = Object.freeze({font: 'Arial', size: 10, bold: false, italic: false, underline: false, color: '#202124', fill: '#ffffff', align: 'left', valign: 'bottom'});
export const FONTS = ['Arial', 'Helvetica Neue', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Palatino', 'Courier New', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Work Sans', 'DM Sans', 'Manrope', 'Raleway', 'Oswald', 'Merriweather', 'Lora', 'Playfair Display', 'Libre Baskerville', 'Roboto Slab', 'Roboto Mono', 'Space Mono'];
const clone = value => JSON.parse(JSON.stringify(value));
export const keyOf = (row, col) => `${row}:${col}`;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function columnLabel(index) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}
export const cellReference = (row, col) => `${columnLabel(col)}${row + 1}`;
export function parseReference(text, rows, cols) {
  const match = /^\$?([A-Z]+)\$?([1-9]\d*)(?::\$?([A-Z]+)\$?([1-9]\d*))?$/i.exec(text.trim());
  if (!match) return null;
  const column = name => [...name.toUpperCase()].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0) - 1;
  const anchor = {row: Number(match[2]) - 1, col: column(match[1])};
  const focus = match[3] ? {row: Number(match[4]) - 1, col: column(match[3])} : {...anchor};
  if ([anchor, focus].some(cell => cell.row >= rows || cell.col >= cols)) return null;
  return {anchor, focus};
}
export function bounds(selection) {
  return {top: Math.min(selection.anchor.row, selection.focus.row), bottom: Math.max(selection.anchor.row, selection.focus.row), left: Math.min(selection.anchor.col, selection.focus.col), right: Math.max(selection.anchor.col, selection.focus.col)};
}
export function createWorkbook() {
  return {version: 1, title: 'Noah Leventhal', starred: false, activeId: 'sheet-1', view: {zoom: 1, gridlines: true}, sheets: ['Home', 'Experience', 'Projects', 'About', 'Contact'].map((name, index) => ({id: `sheet-${index + 1}`, name, rows: 1000, cols: 52, cells: {}, columnWidths: {}, rowHeights: {}, color: null, merges: []}))};
}
function cleanSizes(source, count, min, max) {
  return Object.fromEntries(Object.entries(source || {}).filter(([index, size]) => /^\d+$/.test(index) && Number(index) < count && Number.isFinite(size)).map(([index, size]) => [index, clamp(Math.round(size), min, max)]));
}
export function cleanFormat(source = {}) {
  const format = {};
  if (FONTS.includes(source.font)) format.font = source.font;
  if (Number.isFinite(source.size)) format.size = clamp(source.size, 6, 48);
  for (const name of ['bold', 'italic', 'underline']) if (typeof source[name] === 'boolean') format[name] = source[name];
  for (const name of ['color', 'fill']) if (/^#[0-9a-f]{6}$/i.test(source[name])) format[name] = source[name];
  if (['left', 'center', 'right'].includes(source.align)) format.align = source.align;
  if (['top', 'middle', 'bottom'].includes(source.valign)) format.valign = source.valign;
  if (source.borders && typeof source.borders === 'object') format.borders = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [side, !!source.borders[side]]));
  return format;
}
export function restoreWorkbook(raw) {
  try {
    const source = JSON.parse(raw);
    if (source.version !== 1 || !Array.isArray(source.sheets) || !source.sheets.length) return null;
    const book = createWorkbook();
    book.title = String(source.title || 'Untitled workbook').slice(0, 100);
    book.starred = !!source.starred;
    book.view = {zoom: [.5, .75, .9, 1, 1.1, 1.25, 1.5, 2].includes(source.view?.zoom) ? source.view.zoom : 1, gridlines: source.view?.gridlines !== false};
    book.sheets = source.sheets.slice(0, 50).map((sheet, index) => {
      const result = {id: typeof sheet.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(sheet.id) && source.sheets.findIndex(other => other.id === sheet.id) === index ? sheet.id : `sheet-${index + 1}`, name: String(sheet.name || `Sheet ${index + 1}`).slice(0, 50), rows: clamp(Math.trunc(Number(sheet.rows)) || 1000, 20, 5000), cols: clamp(Math.trunc(Number(sheet.cols)) || 52, 10, 100), cells: {}};
      result.columnWidths = cleanSizes(sheet.columnWidths, result.cols, 40, 1000);
      result.rowHeights = cleanSizes(sheet.rowHeights, result.rows, 20, 500);
      result.merges = cleanMerges(sheet.merges, result.rows, result.cols);
      result.color = /^#[0-9a-f]{6}$/i.test(sheet.color) ? sheet.color : null;
      for (const [key, cell] of Object.entries(sheet.cells || {})) {
        const match = /^(\d+):(\d+)$/.exec(key);
        if (match && Number(match[1]) < result.rows && Number(match[2]) < result.cols && cell && typeof cell === 'object') result.cells[key] = {value: String(cell.value ?? '').slice(0, 100000), format: cleanFormat(cell.format)};
      }
      return result;
    });
    const index = source.sheets.findIndex(sheet => sheet.id === source.activeId);
    book.activeId = book.sheets[Math.max(0, index)]?.id || book.sheets[0].id;
    return book;
  } catch { return null; }
}
export function serializeTSV(matrix) {
  return matrix.map(row => row.map(value => {
    const text = String(value ?? '');
    return /[\t\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join('\t')).join('\n');
}
export function parseTSV(text) {
  const rows = [[]]; let value = '', quoted = false;
  const push = () => {rows.at(-1).push(value); value = '';};
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && (quoted || value === '')) {
      if (quoted && text[i + 1] === '"') {value += '"'; i++;} else quoted = !quoted;
    } else if (!quoted && char === '\t') push();
    else if (!quoted && (char === '\n' || char === '\r')) {if (char === '\r' && text[i + 1] === '\n') i++; push(); rows.push([]);}
    else value += char;
  }
  push();
  if (rows.length > 1 && rows.at(-1).length === 1 && rows.at(-1)[0] === '' && /[\r\n]$/.test(text)) rows.pop();
  return rows;
}
export class WorkbookModel {
  constructor(book = createWorkbook(), onChange = () => {}) {this.book = book; this.onChange = onChange; this.past = []; this.future = []; this.listeners = new Set(); this.canEdit = () => true;}
  subscribe(listener) {this.listeners.add(listener); return () => this.listeners.delete(listener);}
  notify(before, kind = 'mutation') {this.onChange(); for (const listener of this.listeners) listener({before: JSON.parse(before), after: this.book, kind});}
  get sheet() {return this.book.sheets.find(sheet => sheet.id === this.book.activeId) || this.book.sheets[0];}
  getCell(row, col) {return this.sheet.cells[keyOf(row, col)] || {value: '', format: {}};}
  mutate(action) {
    if (!this.canEdit()) return false;
    const before = JSON.stringify(this.book);
    action(this.book);
    if (JSON.stringify(this.book) === before) return false;
    this.past.push(before); if (this.past.length > 80) this.past.shift();
    this.future = []; this.notify(before); return true;
  }
  undo() {if (!this.canEdit() || !this.past.length) return false; const before = JSON.stringify(this.book); this.future.push(before); this.book = JSON.parse(this.past.pop()); this.notify(before, 'undo'); return true;}
  redo() {if (!this.canEdit() || !this.future.length) return false; const before = JSON.stringify(this.book); this.past.push(before); this.book = JSON.parse(this.future.pop()); this.notify(before, 'redo'); return true;}
  each(selection, action) {
    const range = bounds(expandMergedSelection(this.sheet, selection));
    for (let row = range.top; row <= range.bottom; row++) for (let col = range.left; col <= range.right; col++) action(row, col, keyOf(row, col));
  }
  setCell(row, col, value) {
    ({row,col}=cellAnchor(this.sheet,row,col));
    return this.mutate(() => {
      const key = keyOf(row, col), old = this.getCell(row, col);
      if (!value && !Object.keys(old.format).length) delete this.sheet.cells[key];
      else this.sheet.cells[key] = {value: String(value), format: {...old.format}};
    });
  }
  format(selection, patch) {
    this.mutate(() => this.each(selection, (row, col, key) => {const cell = this.getCell(row, col); this.sheet.cells[key] = {value: cell.value, format: {...cell.format, ...patch}};}));
  }
  borders(selection, mode) {
    selection=expandMergedSelection(this.sheet,selection);
    const range = bounds(selection);
    this.mutate(() => this.each(selection, (row, col, key) => {
      const cell = this.getCell(row, col);
      const borders = {top: mode === 'all' || mode === 'outer' && row === range.top, bottom: mode === 'all' || mode === 'outer' && row === range.bottom || mode === 'bottom' && row === range.bottom, left: mode === 'all' || mode === 'outer' && col === range.left, right: mode === 'all' || mode === 'outer' && col === range.right};
      const merge=mergeAt(this.sheet,row,col);if(merge&&row===merge.top&&col===merge.left){borders.bottom=mode==='all'||mode==='outer'&&merge.bottom===range.bottom||mode==='bottom'&&merge.bottom===range.bottom;borders.right=mode==='all'||mode==='outer'&&merge.right===range.right;}
      this.sheet.cells[key] = {value: cell.value, format: {...cell.format, borders}};
    }));
  }
  clear(selection, formatting = false) {
    this.mutate(() => this.each(selection, (row, col, key) => {
      const merge=mergeAt(this.sheet,row,col);if(!formatting&&merge&&(row!==merge.top||col!==merge.left))return;
      const cell = this.getCell(row, col);
      if (formatting) {if (cell.value) this.sheet.cells[key] = {value: cell.value, format: {}}; else delete this.sheet.cells[key];}
      else if (Object.keys(cell.format).length) this.sheet.cells[key] = {value: '', format: {...cell.format}};
      else delete this.sheet.cells[key];
    }));
  }
  copy(selection) {
    const range = bounds(expandMergedSelection(this.sheet,selection)), result = [];
    for (let row = range.top; row <= range.bottom; row++) {
      const line = []; for (let col = range.left; col <= range.right; col++) line.push(clone(this.getCell(row, col)));
      result.push(line);
    }
    result.merges=(this.sheet.merges||[]).filter(merge=>merge.top>=range.top&&merge.bottom<=range.bottom&&merge.left>=range.left&&merge.right<=range.right).map(merge=>({top:merge.top-range.top,bottom:merge.bottom-range.top,left:merge.left-range.left,right:merge.right-range.left}));
    return result;
  }
  paste(row, col, matrix, rich = false) {
    if(matrix.length===1&&matrix[0].length===1)({row,col}=cellAnchor(this.sheet,row,col));
    const target={top:row,left:col,bottom:Math.min(this.sheet.rows-1,row+matrix.length-1),right:Math.min(this.sheet.cols-1,col+Math.max(...matrix.map(line=>line.length))-1)};
    if((matrix.length>1||matrix[0].length>1)&&(this.sheet.merges||[]).some(merge=>intersects(merge,target)))throw new Error('Unmerge the destination before pasting multiple cells.');
    return this.mutate(() => {
      matrix.forEach((line, dr) => line.forEach((value, dc) => {
        if (row + dr >= this.sheet.rows || col + dc >= this.sheet.cols) return;
        const key = keyOf(row + dr, col + dc), old = this.getCell(row + dr, col + dc);
        this.sheet.cells[key] = rich ? {value: String(value.value ?? ''), format: cleanFormat(value.format)} : {value: String(value), format: {...old.format}};
      }));
      if(rich&&matrix.merges?.length)this.sheet.merges=cleanMerges([...(this.sheet.merges||[]),...matrix.merges.map(merge=>({top:merge.top+row,bottom:merge.bottom+row,left:merge.left+col,right:merge.right+col}))],this.sheet.rows,this.sheet.cols);
    });
  }
  merge(selection) {
    const range=bounds(expandMergedSelection(this.sheet,selection));
    if(range.top===range.bottom&&range.left===range.right)return false;
    if((this.sheet.merges||[]).length>=2000)throw new Error('This sheet has reached its merged-cell limit.');
    return this.mutate(()=>{this.sheet.merges=[...(this.sheet.merges||[]).filter(merge=>!intersects(merge,range)),range];});
  }
  unmerge(selection) {
    const range=bounds(expandMergedSelection(this.sheet,selection));
    return this.mutate(()=>{this.sheet.merges=(this.sheet.merges||[]).filter(merge=>!intersects(merge,range));});
  }
  sort(selection, reverse = false) {
    const range = bounds(expandMergedSelection(this.sheet,selection));
    if((this.sheet.merges||[]).some(merge=>intersects(merge,range)))throw new Error('Unmerge cells before sorting this range.');
    const matrix = this.copy(selection);
    matrix.sort((a, b) => a[0].value.localeCompare(b[0].value, undefined, {numeric: true}) * (reverse ? -1 : 1));
    this.paste(range.top, range.left, matrix, true);
  }
  insertAxis(axis, at) {
    const dimension = axis === 'row' ? 'rows' : 'cols', coordinate = axis === 'row' ? 0 : 1;
    if (this.sheet[dimension] >= (axis === 'row' ? 5000 : 100)) return false;
    return this.mutate(() => {
      const next = {};
      for (const [key, cell] of Object.entries(this.sheet.cells)) {const coords = key.split(':').map(Number); if (coords[coordinate] >= at) coords[coordinate]++; next[coords.join(':')] = cell;}
      const sizeKey = axis === 'row' ? 'rowHeights' : 'columnWidths';
      this.sheet[sizeKey] = Object.fromEntries(Object.entries(this.sheet[sizeKey] || {}).map(([index, size]) => [Number(index) >= at ? Number(index) + 1 : Number(index), size]));
      for(const merge of this.sheet.merges||[]){const start=axis==='row'?'top':'left',end=axis==='row'?'bottom':'right';if(at<=merge[start]){merge[start]++;merge[end]++;}else if(at<=merge[end])merge[end]++;}
      this.sheet.cells = next; this.sheet[dimension]++;
    });
  }
  resizeAxis(axis, index, size) {
    const isRow = axis === 'row', count = isRow ? this.sheet.rows : this.sheet.cols;
    if (!Number.isInteger(index) || index < 0 || index >= count || !Number.isFinite(size)) return false;
    const key = isRow ? 'rowHeights' : 'columnWidths', fallback = isRow ? 24 : 100;
    const next = clamp(Math.round(size), isRow ? 20 : 40, isRow ? 500 : 1000);
    return this.mutate(() => {
      this.sheet[key] ||= {};
      if (next === fallback) delete this.sheet[key][index]; else this.sheet[key][index] = next;
    });
  }
  setSheetColor(id, color) {
    if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) return false;
    return this.mutate(book => {const sheet = book.sheets.find(sheet => sheet.id === id); if (sheet) sheet.color = color;});
  }
  addSheet() {
    if (this.book.sheets.length >= 50) return false;
    return this.mutate(book => {
      let number = 1; while (book.sheets.some(sheet => sheet.name === `Sheet ${number}`)) number++;
      const id = `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      book.sheets.push({id, name: `Sheet ${number}`, rows: 1000, cols: 52, cells: {}, columnWidths: {}, rowHeights: {}, color: null, merges: []}); book.activeId = id;
    });
  }
}
