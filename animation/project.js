import {cleanStat} from './visit-stats.js';
import {normalizeCursor} from './cursor-visual.js';
import {cleanMerges} from '../sheet-structure.js';
import {createWorkbook, restoreWorkbook, cleanFormat, clamp} from '../spreadsheet-model.js';
export const clone = value => structuredClone(value);
export const uid = () => crypto.randomUUID();
export const finite = (value, fallback = 0, min = 0, max = 3600000) => Number.isFinite(Number(value)) ? clamp(Number(value), min, max) : fallback;
const safeId = value => typeof value === 'string' && /^[\w-]{1,100}$/.test(value);
export function createProject(workbook = createWorkbook()) {
  return {schemaVersion: 1, workbook: clone(workbook), animations: [], sequences: [], assignments: {}};
}
export function normalizeEvent(raw, index = 0) {
  const event = {id: safeId(raw.id) ? raw.id : `event-${index}`, at: finite(raw.at), type: raw.type};
  const anchor = source => ({row: Math.floor(finite(source.row, 0, 0, 4999)), col: Math.floor(finite(source.col, 0, 0, 99)), fx: finite(source.fx, .5, 0, 1), fy: finite(source.fy, .5, 0, 1)});
  if(raw.type==='stat')return {...event,...anchor(raw),stat:cleanStat(raw.stat)};
  if(raw.type==='chrome')return {...event,popup:raw.popup?{owner:String(raw.popup.owner||'').slice(0,300),left:finite(raw.popup.left,0,-10000,10000),top:finite(raw.popup.top,0,-10000,10000),width:finite(raw.popup.width,250,0,2000),height:finite(raw.popup.height,300,0,2000),items:(raw.popup.items||[]).slice(0,150).map(item=>({text:String(item.text||'').slice(0,200),left:finite(item.left),top:finite(item.top),width:finite(item.width,0,0,2000),height:finite(item.height,0,0,2000),color:/^#[a-f0-9]{3,8}$/i.test(item.color||'')?item.color:null,selected:!!item.selected}))}:null};
  const page=raw.surface?{surface:raw.surface==='chrome'?'chrome':'grid',screen:{x:finite(raw.screen?.x,0,-10000,10000),y:finite(raw.screen?.y,0,-10000,10000)},...(typeof raw.target==='string'?{target:raw.target.slice(0,300),dx:finite(raw.dx,0,-10000,10000),dy:finite(raw.dy,0,-10000,10000)}:{})}:{};
  if (['pointer', 'click', 'scroll'].includes(raw.type)) return {...event, ...anchor(raw), ...page, cursor:normalizeCursor(raw.cursor), ...(raw.type==='pointer'?{visible:raw.visible!==false,...(raw.visibilityReason==='viewport'?{visibilityReason:'viewport'}:{})}:{}), ...(raw.viewport?{viewport:anchor(raw.viewport)}:{})};
  if(raw.type==='merges')return raw.ranges?{...event,ranges:cleanMerges(raw.ranges,5000,100)}:{...event,add:cleanMerges(raw.add,5000,100),remove:cleanMerges(raw.remove,5000,100)};
  if (raw.type === 'select') return {...event, anchor: anchor(raw.anchor || {}), focus: anchor(raw.focus || {})};
  if (raw.type === 'cells') return {...event, changes: (raw.changes || []).slice(0, 50000).map(change => {
    const result = {...anchor(change)};
    if (typeof change.value === 'string') result.value = change.value.slice(0, 100000);
    if (change.format) {
      result.format = cleanFormat(change.format);
      for (const key of ['font','size','bold','italic','underline','color','fill','align','valign','borders']) if (change.format[key] === null) result.format[key] = null;
    }
    return result;
  })};
  if (raw.type === 'sizes') return {...event, axis: raw.axis === 'row' ? 'row' : 'col', changes: (raw.changes || []).slice(0, 5000).map(change => ({index: Math.floor(finite(change.index, 0, 0, raw.axis === 'row' ? 4999 : 99)), size: change.size === null ? null : finite(change.size, 100, raw.axis === 'row' ? 20 : 40, raw.axis === 'row' ? 500 : 1000)}))};
  return null;
}
export function normalizeProject(raw) {
  if (!raw || raw.schemaVersion !== 1) throw new Error('Unsupported animation project.');
  const workbook = restoreWorkbook(JSON.stringify(raw.workbook));
  if (!workbook) throw new Error('The workbook data is invalid.');
  const project = createProject(workbook);
  project.animations = (raw.animations || []).slice(0, 200).filter(item => safeId(item.id)).map(item => ({
    id: item.id, name: String(item.name || 'Untitled animation').slice(0, 100), duration: finite(item.duration, 1000, 100, 600000),
    sourceSheetId: String(item.sourceSheetId || ''), pointerVersion:[2,3].includes(item.pointerVersion)?item.pointerVersion:1, events: (item.events || []).slice(0, 20000).map(normalizeEvent).filter(Boolean).sort((a,b) => a.at-b.at),
  }));
  const animationIds = new Set(project.animations.map(item => item.id));
  project.sequences = (raw.sequences || []).slice(0, 200).filter(item => safeId(item.id)).map(item => ({
    id: item.id, name: String(item.name || 'Untitled sequence').slice(0, 100), sheetId: String(item.sheetId || workbook.activeId),
    startDelay: finite(item.startDelay), gap: finite(item.gap, 500), viewDuration: finite(item.viewDuration, 60000, 10000, 3600000),
    clips: (item.clips || []).slice(0, 100).filter(clip => safeId(clip.id) && animationIds.has(clip.animationId)).map(clip => ({id: clip.id, animationId: clip.animationId, start: finite(clip.start), duration: clip.duration == null ? null : finite(clip.duration, 1000, 100, 600000), speed: finite(clip.speed, 1, .25, 4), repeatCount: Math.floor(finite(clip.repeatCount, 1, 0, 100)), repeatDelay: finite(clip.repeatDelay), interval: finite(clip.interval), color: /^#[\da-f]{6}$/i.test(clip.color) ? clip.color : '#1a73e8'})),
  }));
  for (const [sheetId, sequenceId] of Object.entries(raw.assignments || {})) if (workbook.sheets.some(sheet => sheet.id === sheetId) && project.sequences.some(sequence => sequence.id === sequenceId && sequence.sheetId === sheetId)) project.assignments[sheetId] = sequenceId;
  return project;
}
export function publishableProject(project) {
  const clean = normalizeProject(project), assigned = new Set(Object.values(clean.assignments));
  clean.sequences = clean.sequences.filter(sequence => assigned.has(sequence.id));
  const used = new Set(clean.sequences.flatMap(sequence => sequence.clips.map(clip => clip.animationId)));
  clean.animations = clean.animations.filter(animation => used.has(animation.id));
  return clean;
}
export function newSequence(sheetId, name = 'New sequence') {return {id: uid(), name, sheetId, startDelay: 0, gap: 500, viewDuration: 60000, clips: []};}
export function newClip(animationId, start = 0, color = '#1a73e8') {return {id: uid(), animationId, start, duration: null, speed: 1, repeatCount: 1, repeatDelay: 0, interval: 0, color};}
