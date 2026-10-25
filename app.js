import {mergeAt,cellAnchor,expandMergedSelection,gridlineColor,intersects} from './sheet-structure.js';
import {WorkbookModel, STORAGE_KEY, DEFAULT_FORMAT, FONTS, restoreWorkbook, columnLabel, cellReference, parseReference, bounds, clamp, parseTSV, serializeTSV} from './spreadsheet-model.js';
import {SheetLayout} from './sheet-layout.js';
import {PopoverController} from './ui-popovers.js';
import {insertEmojiText} from './picker-data.js';
import {AnimationExperience} from './animation/controller.js';
import {capturePagePointer,resolvePagePointer,controlSelector,insideViewport} from './animation/pointer.js';
import {cursorVisual} from './animation/cursor-visual.js';
import {cursorKeyframes} from './animation/player.js';

const $ = id => document.getElementById(id);
const dom = Object.fromEntries(['document-title', 'save-status', 'menu-bar', 'toolbar', 'formula-input', 'cell-reference', 'grid', 'column-headers', 'row-headers', 'sheet-scroll', 'sheet-surface', 'cell-layer', 'range-outline', 'active-outline', 'cell-editor', 'sheet-tabs', 'selection-status', 'popup', 'workbook-dialog', 'toast'].map(id => [id.replaceAll('-', '_'), $(id)]));
const paths = {
  undo: '<path d="m8 4-5 5 5 5M3 9h10a6 6 0 0 1 0 12"/>', redo: '<path d="m16 4 5 5-5 5m5-5H11a6 6 0 0 0 0 12"/>',
  star: '<path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L2.9 9.6l6.3-.9Z"/>',
  saved: '<path d="m8 12 3 3 5-6"/><path d="M7 19a5 5 0 0 1-1-9.9 6 6 0 0 1 11.6-1.6A5.8 5.8 0 0 1 18 19Z"/>',
  device: '<rect x="3" y="4" width="18" height="13" rx="1"/><path d="M1 21h22M8 17v4m8-4v4"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M6 16h12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  list: '<path d="M5 6h15M5 12h15M5 18h15M2 6h.1M2 12h.1M2 18h.1"/>',
  emoji: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
  fill: '<path d="m9 3 8 8-7 7a2 2 0 0 1-2.8 0l-4.4-4.4a2 2 0 0 1 0-2.8l6.4-6.4M3 12h13M7 2l3 3"/><path d="M19 13c-.9 1.3-2 2.6-2 3.8a2 2 0 0 0 4 0c0-1.2-1.1-2.5-2-3.8Z" fill="currentColor" stroke="none"/>',
  borders: '<rect x="4" y="4" width="16" height="16"/><path d="M12 4v16M4 12h16"/>',
  left: '<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>', center: '<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>', right: '<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>',
  top: '<path d="M4 4h16M12 8v12m-4-8 4-4 4 4M6 17h2m8 0h2"/>', middle: '<path d="M4 12h16M12 3v6m-3-3 3 3 3-3M12 21v-6m-3 3 3-3 3 3"/>', bottom: '<path d="M4 20h16M12 4v12m-4-4 4 4 4-4M6 7h2m8 0h2"/>',
  merge: '<path d="M8 4H3v16h5m8-16h5v16h-5M8 7v2m0 6v2m8-10v2m0 6v2M3 12h7m-3-3 3 3-3 3m14-3h-7m3-3-3 3 3 3"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>', clear: '<path d="m5 4 14 16M4 7h5m5 0h6M12 7v13M8 20h8"/>',
};
function icon(name, extra = '') {return `<svg ${extra} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;}
function button(action, label, body, extra = '') {return `<button class="icon-button ${extra}" data-action="${action}" aria-label="${label}" title="${label}">${body}</button>`;}
const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
let experience = null, playbackBook = null;
let stored = null, storageAvailable = true;
try {stored = restoreWorkbook(localStorage.getItem(STORAGE_KEY));} catch {storageAvailable = false;}
const model = new WorkbookModel(stored || undefined, onModelChange);
model.canEdit=()=>!!experience?.isEditing;
const canEdit=()=>!!experience?.isEditing;
let selection = {anchor: {row: 0, col: 0}, focus: {row: 0, col: 0}};
let editing = null, formulaSession = null, clipboard = null, copiedText = '', drag = null, dragFrame = 0;
let renderFrame = 0, toastTimer, saveTimer, visibleSignature = '', tabsSignature = '';
let geometry = new SheetLayout(model.sheet, model.book.view.zoom), resizing = null, resizeFrame = 0, textBookmark = null;
const popovers = new PopoverController(dom.popup, {beforeOpen: preserve => {if (!preserve) finishEditing();}});
const sheetViews = new Map();
const isTextInput = element => element?.matches('input,textarea,[contenteditable="true"]');
const active = () => cellAnchor(displaySheet(),selection.anchor.row,selection.anchor.col);
const selectedRange=()=>bounds(expandMergedSelection(displaySheet(),selection));
const displaySheet = () => playbackBook?.sheets.find(sheet => sheet.id === model.book.activeId) || model.sheet;
const displayCell = (row, col) => displaySheet().cells[`${row}:${col}`] || {value:'',format:{}};
const formatAt = () => ({...DEFAULT_FORMAT, ...displayCell(active().row, active().col).format});

function persist() {
  clearTimeout(saveTimer);
  if(!experience?.ready||!canEdit()){dom.save_status.innerHTML=`${icon('saved')}<span class="save-label">Published website</span>`;return;}
  experience.persistWorkbook();
  dom.save_status.innerHTML=`${icon('saved')}<span class="save-label">Private draft · save to sync</span>`;
}
function onModelChange() {
  clampSelection();
  renderChrome(); renderGrid(true); renderSelection();
  dom.save_status.innerHTML = `${icon('saved')}<span class="save-label">Saving…</span>`;
  clearTimeout(saveTimer); saveTimer = setTimeout(persist, 180);
}
function clampSelection() {
  for (const cell of [selection.anchor, selection.focus]) {cell.row = clamp(cell.row, 0, model.sheet.rows - 1); cell.col = clamp(cell.col, 0, model.sheet.cols - 1);}
}
function renderHeader() {
  if (document.activeElement !== dom.document_title) dom.document_title.value = model.book.title;
  dom.document_title.style.width = `${Math.min(420, Math.max(145, model.book.title.length * 10 + 15))}px`;
  document.title = `${model.book.title} — Personal workbook`;
  const star = document.querySelector('[data-action="star"]');
  star.classList.toggle('is-active', model.book.starred); star.setAttribute('aria-pressed', model.book.starred);
  star.title = model.book.starred ? 'Unstar this workbook' : 'Star this workbook';
}
function renderToolbar() {
  const format = formatAt();
  for(const control of dom.toolbar.querySelectorAll('button[data-action]'))control.disabled=!canEdit()&&control.dataset.action!=='zoom';
  $('font-size').readOnly=!canEdit();
  for (const prop of ['bold', 'italic', 'underline']) {const el = dom.toolbar.querySelector(`[data-action="${prop}"]`); el.classList.toggle('is-active', format[prop]); el.setAttribute('aria-pressed', format[prop]);}
  $('font-family-label').textContent = format.font; if (document.activeElement !== $('font-size')) $('font-size').value = format.size; $('zoom-label').textContent = `${Math.round(model.book.view.zoom * 100)}%`;
  $('text-color').style.setProperty('--swatch', format.color); $('fill-color').style.setProperty('--swatch', format.fill);
  dom.toolbar.querySelector('[data-action="alignment"]').innerHTML = icon(format.align) + icon('chevron', 'class="chevron"');
  dom.toolbar.querySelector('[data-action="vertical-alignment"]').innerHTML=icon(format.valign)+icon('chevron','class="chevron"');
  dom.toolbar.querySelector('[data-action="merge-cells"]').setAttribute('aria-pressed',!!mergeAt(displaySheet(),active().row,active().col));
  dom.toolbar.querySelector('[data-action="undo"]').disabled = !canEdit() || !model.past.length;
  dom.toolbar.querySelector('[data-action="redo"]').disabled = !canEdit() || !model.future.length;
}
function renderTabs() {
  const signature = JSON.stringify(model.book.sheets.map(({id, name, color}) => [id, name, color]));
  if (signature === tabsSignature) {
    for (const tab of dom.sheet_tabs.children) tab.setAttribute('aria-selected', tab.dataset.sheet === model.book.activeId);
    return;
  }
  tabsSignature = signature;
  dom.sheet_tabs.replaceChildren();
  for (const sheet of model.book.sheets) {
    const tab = document.createElement('button'); tab.className = 'sheet-tab'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', sheet.id === model.book.activeId); tab.dataset.sheet = sheet.id;
    tab.title = `${sheet.name} — double-click to rename`;
    if (sheet.color) {tab.style.setProperty('--tab-color', sheet.color); tab.classList.add('has-color');}
    const label = document.createElement('span'); label.textContent = sheet.name;
    const arrow = document.createElement('span'); arrow.className = 'tab-arrow'; arrow.textContent = '▾'; arrow.dataset.sheetMenu = sheet.id;
    tab.append(label, arrow); dom.sheet_tabs.append(tab);
  }
}
function renderChrome() {
  renderHeader(); renderToolbar(); renderTabs();
  updateGeometry();
  dom.sheet_scroll.setAttribute('aria-label', `${model.sheet.name} sheet`); dom.sheet_scroll.setAttribute('aria-rowcount', model.sheet.rows); dom.sheet_scroll.setAttribute('aria-colcount', model.sheet.cols);
  dom.grid.classList.toggle('no-gridlines', !model.book.view.gridlines);
}
function styleCell(element, format = {}, range = null) {
  const style = {...DEFAULT_FORMAT, ...format}, zoom = model.book.view.zoom,lineHeight=Math.max(18,style.size*4/3*1.2)*zoom;
  element.style.fontFamily = `"${style.font}", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; element.style.fontSize = `${style.size * 4 / 3 * zoom}px`;
  element.style.fontWeight = style.bold ? '700' : '400'; element.style.fontStyle = style.italic ? 'italic' : 'normal';
  element.style.textDecoration = style.underline ? 'underline' : 'none'; element.style.color = style.color; element.style.backgroundColor = style.fill; element.style.textAlign = style.align;
  element.style.lineHeight = `${lineHeight}px`; element.style.padding = `${3 * zoom}px ${4 * zoom}px ${2 * zoom}px`;
  const height=parseFloat(element.style.height)||geometry.height(active().row);
  if(element.tagName==='TEXTAREA'){const lines=Math.max(1,element.value.split('\n').length),space=Math.max(0,height-lines*lineHeight-5*zoom);element.style.paddingTop=`${3*zoom+(style.valign==='middle'?space/2:style.valign==='bottom'?space:0)}px`;}
  else element.style.justifyContent={top:'flex-start',middle:'center',bottom:'flex-end'}[style.valign];
  if(range){
    const neighbor=(row,col)=>{if(row<0||col<0||row>=displaySheet().rows||col>=displaySheet().cols)return {};const point=cellAnchor(displaySheet(),row,col);return displayCell(point.row,point.col).format||{};};
    const right=neighbor(range.top,range.right+1),bottom=neighbor(range.bottom+1,range.left),visible=model.book.view.gridlines;
    element.style.borderRight=`1px solid ${style.borders?.right||right.borders?.left?'#3c4043':visible?gridlineColor(style.fill,right.fill):'transparent'}`;
    element.style.borderBottom=`1px solid ${style.borders?.bottom||bottom.borders?.top?'#3c4043':visible?gridlineColor(style.fill,bottom.fill):'transparent'}`;
    // Interior edges belong to the cell above/left, so shared borders draw once.
    element.style.borderLeft=range.left===0&&style.borders?.left?'1px solid #3c4043':'0';
    element.style.borderTop=range.top===0&&style.borders?.top?'1px solid #3c4043':'0';
  }else for (const [side, enabled] of Object.entries(style.borders || {})) if (enabled) element.style[`border${side[0].toUpperCase() + side.slice(1)}`] = '1px solid #3c4043';
}
function updateGeometry() {
  geometry = new SheetLayout(displaySheet(), model.book.view.zoom, resizing ? {axis: resizing.axis, index: resizing.index, size: resizing.size} : null);
  dom.sheet_surface.style.width = `${geometry.totalWidth}px`;
  dom.sheet_surface.style.height = `${geometry.totalHeight}px`;
}
function renderGrid(force = false) {
  const view = dom.sheet_scroll;
  const top = Math.max(0, geometry.rowAt(view.scrollTop) - 2), bottom = Math.min(model.sheet.rows - 1, geometry.rowAt(view.scrollTop + view.clientHeight) + 2);
  const left = Math.max(0, geometry.columnAt(view.scrollLeft) - 1), right = Math.min(model.sheet.cols - 1, geometry.columnAt(view.scrollLeft + view.clientWidth) + 1);
  const signature = `${model.book.activeId}:${top}:${bottom}:${left}:${right}:${model.book.view.zoom}`;
  if (force || signature !== visibleSignature) {
    visibleSignature = signature;
    const fragment = document.createDocumentFragment(), rendered=new Set(), sheet=displaySheet();
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const merge=mergeAt(sheet,row,col),r=merge?.top??row,c=merge?.left??col,key=`${r}:${c}`;if(rendered.has(key))continue;rendered.add(key);
      const cell=displayCell(r,c),element=document.createElement('div'),range=merge||{top:r,bottom:r,left:c,right:c};
      element.className=`cell${merge?' merged-cell':''}`; element.id = `cell-${r}-${c}`; element.setAttribute('role', 'gridcell'); element.setAttribute('aria-rowindex', r + 1); element.setAttribute('aria-colindex', c + 1);
      if(merge){element.setAttribute('aria-rowspan',merge.bottom-r+1);element.setAttribute('aria-colspan',merge.right-c+1);}
      element.setAttribute('aria-label', `${cellReference(r,c)}${cell.value ? `: ${cell.value}` : ''}`);
      place(element,r,c,range.bottom-r+1,range.right-c+1);
      const text=document.createElement('span');text.className='cell-text';text.textContent=cell.value;element.append(text);styleCell(element,cell.format,range);fragment.append(element);
    }
    dom.cell_layer.replaceChildren(fragment);
  }
  renderHeaders(top, bottom, left, right);
}
function resizeHandle(axis, index) {
  const handle = document.createElement('span'), isRow = axis === 'row';
  handle.className = `resize-handle ${isRow ? 'row' : 'column'}-resize-handle`;
  handle.dataset.resizeAxis = axis; handle.dataset.index = index;
  handle.setAttribute('role', 'separator'); handle.tabIndex = 0;
  handle.setAttribute('aria-orientation', isRow ? 'horizontal' : 'vertical');
  handle.setAttribute('aria-label', `Resize ${isRow ? `row ${index + 1}` : `column ${columnLabel(index)}`}`);
  handle.setAttribute('aria-valuemin', isRow ? 20 : 40); handle.setAttribute('aria-valuemax', isRow ? 500 : 1000);
  handle.setAttribute('aria-valuenow', Math.round((isRow ? geometry.height(index) : geometry.width(index)) / model.book.view.zoom));
  handle.title = 'Drag to resize · double-click to reset';
  return handle;
}
function renderHeaders(top, bottom, left, right) {
  const range = selectedRange();
  const update = (parent, axis, start, end) => {
    const isRow = axis === 'row', key = isRow ? 'row' : 'col';
    const existing = new Map([...parent.children].map(element => [Number(element.dataset[key]), element]));
    for (const [index, element] of existing) if (index < start || index > end) element.remove();
    for (let index = start; index <= end; index++) {
      let element = existing.get(index);
      if (!element) {
        element = document.createElement('div'); element.dataset[key] = index;
        const label = document.createElement('span'); label.textContent = isRow ? index + 1 : columnLabel(index);
        element.append(label, resizeHandle(axis, index)); parent.append(element);
      }
      const selected = isRow ? index >= range.top && index <= range.bottom : index >= range.left && index <= range.right;
      const isActive = index === (isRow ? active().row : active().col);
      element.className = `${isRow ? 'row' : 'column'}-header${selected ? ' selected' : ''}${isActive ? ' active' : ''}`;
      if (isRow) {element.style.top = `${geometry.y(index) - dom.sheet_scroll.scrollTop}px`; element.style.height = `${geometry.height(index)}px`;}
      else {element.style.left = `${geometry.x(index) - dom.sheet_scroll.scrollLeft}px`; element.style.width = `${geometry.width(index)}px`;}
      element.querySelector('.resize-handle').setAttribute('aria-valuenow', Math.round((isRow ? geometry.height(index) : geometry.width(index)) / model.book.view.zoom));
    }
  };
  update(dom.column_headers, 'col', left, right); update(dom.row_headers, 'row', top, bottom);
}
function place(element, row, col, rows = 1, cols = 1) {
  Object.assign(element.style, {left: `${geometry.x(col)}px`, top: `${geometry.y(row)}px`, width: `${geometry.x(col + cols) - geometry.x(col)}px`, height: `${geometry.y(row + rows) - geometry.y(row)}px`});
}
function renderSelection() {
  const range = selectedRange(), {row, col} = active(), merge=mergeAt(displaySheet(),row,col),single=range.top===range.bottom&&range.left===range.right||!!merge&&range.top===merge.top&&range.bottom===merge.bottom&&range.left===merge.left&&range.right===merge.right;
  place(dom.active_outline,row,col,merge?merge.bottom-row+1:1,merge?merge.right-col+1:1); place(dom.range_outline, range.top, range.left, range.bottom - range.top + 1, range.right - range.left + 1);
  dom.range_outline.hidden = single;
  dom.active_outline.querySelector('.fill-handle').hidden = !canEdit() || !single || !!editing || !!merge;
  if (document.activeElement !== dom.cell_reference) dom.cell_reference.value = single ? cellReference(row, col) : `${cellReference(range.top, range.left)}:${cellReference(range.bottom, range.right)}`;
  if (!formulaSession) dom.formula_input.value = editing ? dom.cell_editor.value : (canEdit()?model.getCell(row,col):displayCell(row,col)).value;
  dom.sheet_scroll.setAttribute('aria-activedescendant', `cell-${row}-${col}`);
  const count = (range.bottom - range.top + 1) * (range.right - range.left + 1);
  dom.selection_status.textContent = single ? `${model.sheet.rows.toLocaleString()} rows` : `${count.toLocaleString()} cells selected`;
  renderToolbar();
  experience?.recordSelection(expandMergedSelection(model.sheet,selection));
}
function ensureVisible() {
  const view = dom.sheet_scroll, {row, col} = selection.focus;
  if (geometry.y(row) < view.scrollTop) view.scrollTop = geometry.y(row);
  else if (geometry.y(row + 1) > view.scrollTop + view.clientHeight) view.scrollTop = geometry.y(row + 1) - view.clientHeight;
  if (geometry.x(col) < view.scrollLeft) view.scrollLeft = geometry.x(col);
  else if (geometry.x(col + 1) > view.scrollLeft + view.clientWidth) view.scrollLeft = geometry.x(col + 1) - view.clientWidth;
  renderGrid();
}
function selectCell(row, col, extend = false, reveal = false) {
  const point = {row: clamp(row, 0, model.sheet.rows - 1), col: clamp(col, 0, model.sheet.cols - 1)};
  if (!extend) {selection.anchor=cellAnchor(displaySheet(),point.row,point.col);selection.focus={...selection.anchor};}else selection.focus={...point};
  renderSelection(); renderGrid(); if (reveal) ensureVisible();
}
function move(rowDelta, colDelta, extend = false) {
  const base = extend ? selection.focus : active(),merge=!extend&&mergeAt(displaySheet(),base.row,base.col);selectCell(merge&&rowDelta>0?merge.bottom+rowDelta:base.row+rowDelta,merge&&colDelta>0?merge.right+colDelta:base.col+colDelta,extend,true);
}
function focusGrid() {dom.sheet_scroll.focus({preventScroll: true});}
function beginEdit(replacement) {
  if(!canEdit())return;
  closePopup();
  if (editing) return;
  const {row, col} = active(); selectCell(row, col);
  editing = {row, col, original: model.getCell(row, col).value};
  const editor = dom.cell_editor; editor.value = replacement === undefined ? editing.original : replacement;
  editor.removeAttribute('style');const merge=mergeAt(model.sheet,row,col);place(editor,row,col,merge?merge.bottom-row+1:1,merge?merge.right-col+1:1);styleCell(editor,formatAt());
  editor.style.minWidth=editor.style.width;
  editor.style.border = '2px solid #1a73e8'; editor.hidden = false; editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length);
  dom.formula_input.value = editor.value; renderSelection();
  experience?.recordInput(row, col, editor.value);
}
function commitEdit(cancel = false) {
  if (!editing) return;
  const session = editing, value = dom.cell_editor.value; editing = null; dom.cell_editor.hidden = true;
  if (!cancel) model.setCell(session.row, session.col, value);
  else experience?.recordInput(session.row, session.col, model.getCell(session.row, session.col).value);
  dom.formula_input.value = model.getCell(active().row, active().col).value; renderSelection();
}
function commitFormula(cancel = false) {
  if (!formulaSession) return;
  const session = formulaSession, value = dom.formula_input.value; formulaSession = null;
  if (!cancel) model.setCell(session.row, session.col, value);
  else experience?.recordInput(session.row, session.col, model.getCell(session.row, session.col).value);
  dom.formula_input.value = model.getCell(active().row, active().col).value;
}
function finishEditing() {commitEdit(); commitFormula();}
function applyFormat(patch) {if(!canEdit())return;finishEditing(); model.format(selection, patch); focusGrid();}
function mergeSelected(){
  if(!canEdit())return;finishEditing();const range=selectedRange(),target={anchor:{row:range.top,col:range.left},focus:{row:range.bottom,col:range.right}};
  let hidden=0;model.each(target,(row,col)=>{if((row!==range.top||col!==range.left)&&model.getCell(row,col).value)hidden++;});
  const apply=()=>{try{model.merge(target);selection={anchor:{...target.anchor},focus:{...target.anchor}};renderGrid(true);renderSelection();focusGrid();}catch(error){toast(error.message);}};
  if(!hidden){apply();return;}
  dom.workbook_dialog.innerHTML=`<h2>Merge cells</h2><p>The upper-left cell will be displayed. Contents in ${hidden} other cell${hidden===1?'':'s'} will be kept and will reappear when you unmerge.</p><div class="dialog-actions"><button data-dialog-close>Cancel</button><button id="confirm-merge">Merge and keep contents</button></div>`;
  dom.workbook_dialog.querySelector('#confirm-merge').onclick=()=>{dom.workbook_dialog.close();apply();};dom.workbook_dialog.showModal();
}
function toast(message) {clearTimeout(toastTimer); dom.toast.textContent = message; dom.toast.hidden = false; toastTimer = setTimeout(() => {dom.toast.hidden = true;}, 4200);}
function switchSheet(id, event) {
  if(!model.book.sheets.some(sheet=>sheet.id===id))return;
  experience?.beforeSheetSwitch();
  finishEditing(); closePopup();
  if (id === model.book.activeId) {focusGrid(); return;}
  sheetViews.set(model.book.activeId, {selection: structuredClone(selection), left: dom.sheet_scroll.scrollLeft, top: dom.sheet_scroll.scrollTop});
  model.book.activeId = id;
  const view = sheetViews.get(id); selection = view?.selection || {anchor: {row: 0, col: 0}, focus: {row: 0, col: 0}};
  clampSelection(); renderChrome(); dom.sheet_scroll.scrollTo(view?.left || 0, view?.top || 0); renderGrid(true); renderSelection(); persist(); focusGrid(); experience?.afterSheetSwitch();
  experience?.countSheetSwitch(event);
}
function addSheet() {
  if(!canEdit())return;
  experience?.beforeSheetSwitch();
  finishEditing();
  if (model.book.sheets.length >= 50) return toast('This workbook supports up to 50 sheets.');
  sheetViews.set(model.book.activeId, {selection: structuredClone(selection), left: dom.sheet_scroll.scrollLeft, top: dom.sheet_scroll.scrollTop});
  selection = {anchor: {row: 0, col: 0}, focus: {row: 0, col: 0}};
  model.addSheet(); dom.sheet_scroll.scrollTo(0, 0); renderGrid(true); renderSelection(); focusGrid();
  dom.sheet_tabs.lastElementChild?.scrollIntoView({block: 'nearest', inline: 'nearest'});
  experience?.afterSheetSwitch();
}
function renameSheet(id) {
  if(!canEdit())return;
  const sheet = model.book.sheets.find(sheet => sheet.id === id);
  showInputDialog('Rename sheet', 'Sheet name', sheet.name, 50, value => {
    if (model.book.sheets.some(other => other.id !== id && other.name.toLowerCase() === value.toLowerCase())) {toast('A sheet with that name already exists.'); return false;}
    model.mutate(book => {book.sheets.find(sheet => sheet.id === id).name = value;}); return true;
  });
}
function showInputDialog(title, label, value, maxLength, onSubmit) {
  closePopup(); finishEditing();
  dom.workbook_dialog.innerHTML = `<form><h2>${escapeHTML(title)}</h2><label for="dialog-value">${escapeHTML(label)}</label><div class="dialog-input-row"><input id="dialog-value" maxlength="${maxLength}" required autocomplete="off"><button type="button" class="icon-button" data-action="emoji" aria-label="Insert emoji in name" title="Insert emoji in name">${icon('emoji')}</button></div><div class="dialog-actions"><button type="button" data-dialog-close>Cancel</button><button type="submit">Save</button></div></form>`;
  const field = $('dialog-value'); field.value = value;
  dom.workbook_dialog.querySelector('form').onsubmit = event => {event.preventDefault(); const next = field.value.trim(); if (!next) {field.setCustomValidity('Please enter a name.'); field.reportValidity(); return;} if (onSubmit(next) !== false) dom.workbook_dialog.close();};
  field.oninput = () => field.setCustomValidity(''); dom.workbook_dialog.showModal(); field.focus(); field.select();
}
function showHelp(kind = 'shortcuts') {
  closePopup(); finishEditing();
  let content;
  if (kind === 'about') content = '<h2>A personal workbook</h2><p>A spreadsheet-shaped home for Noah Leventhal. This first edition is a blank canvas for the portfolio to come.</p><p>Visitors view the published spreadsheet. The administrator can edit private drafts and publish updates.</p><p class="dialog-note">An independent project inspired by familiar spreadsheet tools. Not affiliated with Google. Formula expressions are stored as text in this phase; calculations are planned for a later edition.</p>';
  else if (kind === 'summary') {
    const cells = model.copy(selection).flat(), values = cells.map(cell => cell.value).filter(value => value.trim() !== ''), numbers = values.filter(value => Number.isFinite(Number(value))).map(Number);
    content = `<h2>Selection summary</h2><p>${cells.length.toLocaleString()} cells selected · ${values.length.toLocaleString()} nonempty</p><p>Numeric cells: ${numbers.length.toLocaleString()}<br>Sum: ${numbers.reduce((sum, n) => sum + n, 0).toLocaleString()}<br>Average: ${numbers.length ? (numbers.reduce((sum, n) => sum + n, 0) / numbers.length).toLocaleString() : '—'}</p>`;
  } else content = '<h2>Keyboard shortcuts</h2>' + [['Move between cells', '↑ ↓ ← →'], ['Edit selected cell', 'Double-click / F2'], ['Save & move down', 'Enter'], ['Save & move right', 'Tab'], ['Cancel editing', 'Esc'], ['Extend a selection', 'Shift + arrows'], ['Copy / cut / paste', '⌘ / Ctrl + C / X / V'], ['Undo / redo', '⌘ / Ctrl + Z / Shift Z'], ['Bold / italic / underline', '⌘ / Ctrl + B / I / U'], ['Select all cells', '⌘ / Ctrl + A'], ['Clear cell contents', 'Delete / Backspace'], ['Insert emoji', '⌘ / Ctrl + Shift + E']].map(([label, key]) => `<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join('') + '<p class="dialog-note">Use the name box beside fx to jump to a cell or range, such as C12 or A1:D8. Double-click a sheet tab to rename it.</p>';
  dom.workbook_dialog.innerHTML = `${content}<div class="dialog-actions"><button data-dialog-close>Done</button></div>`; dom.workbook_dialog.showModal();
}
function closePopup() {popovers.close();}
function openPopup(owner, items, point) {
  if(!canEdit()){const menu=owner.dataset.menu;items=items.map(item=>{if(!item)return item;let edit=false;if(['Insert','Format'].includes(menu))edit=true;else if(menu==='Edit'||owner===dom.grid)edit=item.label!=='Copy';else if(menu==='Data')edit=item.label.startsWith('Sort');else if(menu==='File')edit=item.label.startsWith('Rename');else if(owner.dataset.sheet)edit=item.label!=='Open sheet';return {...item,disabled:item.disabled||edit};});}
  popovers.menu(owner,items.map(item=>item?{...item,run:(option,event)=>{try{item.run(option,event);}catch(error){toast(error.message);}}}:item),point);
}
function openColorPalette(owner, property, sheetId = null) {
  if(!canEdit())return;
  const target = structuredClone(selection);
  const sheet = model.book.sheets.find(sheet => sheet.id === sheetId);
  const value = sheet ? sheet.color : formatAt()[property];
  const label = sheet ? 'Tab color' : property === 'fill' ? 'Fill color' : 'Text color';
  popovers.colors(owner, {label, value, resetValue: sheet ? null : DEFAULT_FORMAT[property], resetLabel: sheet ? 'No color' : 'Reset', onSelect: color => {
    if (sheet) model.setSheetColor(sheetId, color);
    else model.format(target, {[property]: color});
    focusGrid();
  }});
}
function rememberTextTarget() {
  const field = document.activeElement;
  if (field?.matches('#cell-editor,#formula-input,#document-title,#dialog-value')) textBookmark = {field, caret: field.selectionEnd ?? field.value.length};
}
function openEmojiPicker(owner) {
  if(!canEdit())return;
  rememberTextTarget();
  const bookmark = textBookmark?.field?.isConnected ? {...textBookmark} : null;
  popovers.emojis(owner, {returnFocus: bookmark?.field || dom.sheet_scroll, onSelect: emoji => {
    if (bookmark) {
      const {field} = bookmark, result = insertEmojiText(field.value, emoji, bookmark.caret);
      field.value = result.value; field.focus(); field.setSelectionRange(result.caret, result.caret);
      field.dispatchEvent(new Event('input', {bubbles: true}));
      if (field === dom.document_title) field.dispatchEvent(new Event('change', {bubbles: true}));
      rememberTextTarget();
    } else {
      const {row, col} = active(), cell = model.getCell(row, col);
      model.setCell(row, col, cell.value + emoji); focusGrid();
    }
  }});
}
function sheetMenu(tab, point) {
  const id = tab.dataset.sheet;
  openPopup(tab, [{label: 'Rename sheet', run: () => renameSheet(id)}, {label: 'Change color', run: () => openColorPalette(tab, null, id)}, null, {label: 'Open sheet', run: (option,event) => switchSheet(id,event)}], point);
}
function startResize(event, handle) {
  if(!canEdit())return;
  if (event.button !== 0) return;
  event.preventDefault(); event.stopPropagation(); finishEditing(); closePopup();
  const axis = handle.dataset.resizeAxis, index = Number(handle.dataset.index), zoom = model.book.view.zoom;
  resizing = {axis, index, start: axis === 'row' ? event.clientY : event.clientX, size: (axis === 'row' ? geometry.height(index) : geometry.width(index)) / zoom};
  resizing.original = resizing.size;
  handle.setPointerCapture?.(event.pointerId);
  document.body.classList.add(axis === 'row' ? 'resizing-row' : 'resizing-column');
  showResizeGuide();
}
function showResizeGuide() {
  if (!resizing) return;
  const isRow = resizing.axis === 'row', gridRect = dom.grid.getBoundingClientRect(), viewport = dom.sheet_scroll.getBoundingClientRect();
  const position = isRow ? viewport.top - gridRect.top + geometry.y(resizing.index + 1) - dom.sheet_scroll.scrollTop : viewport.left - gridRect.left + geometry.x(resizing.index + 1) - dom.sheet_scroll.scrollLeft;
  const guide = $('resize-guide'), label = $('resize-label');
  guide.hidden = false; guide.className = `resize-guide ${isRow ? 'horizontal' : 'vertical'}`;
  guide.style.left = isRow ? '0' : `${position}px`; guide.style.top = isRow ? `${position}px` : '0';
  label.hidden = false; label.textContent = `${Math.round(resizing.size)} px`;
  label.style.left = `${isRow ? 52 : Math.min(position + 8, dom.grid.clientWidth - 64)}px`;
  label.style.top = `${isRow ? Math.min(position + 5, dom.grid.clientHeight - 28) : 4}px`;
}
function updateResize(event) {
  if (!resizing) return;
  const isRow = resizing.axis === 'row', coordinate = isRow ? event.clientY : event.clientX;
  resizing.size = clamp(Math.round(resizing.original + (coordinate - resizing.start) / model.book.view.zoom), isRow ? 20 : 40, isRow ? 500 : 1000);
  if (!resizeFrame) resizeFrame = requestAnimationFrame(() => {resizeFrame = 0; updateGeometry();experience?.recordResize(resizing.axis,resizing.index,resizing.size); renderGrid(true); renderSelection(); showResizeGuide();});
}
function finishResize(cancel = false) {
  if (!resizing) return;
  cancelAnimationFrame(resizeFrame); resizeFrame = 0;
  const change = resizing; resizing = null;
  document.body.classList.remove('resizing-row', 'resizing-column'); $('resize-guide').hidden = true; $('resize-label').hidden = true;
  const changed = change.size !== change.original;
  if (!cancel && changed) model.resizeAxis(change.axis, change.index, change.size);
  // Keep the original header mounted for a second click when resetting with a double-click.
  if (cancel || changed) {updateGeometry(); renderGrid(true); renderSelection();}
  focusGrid();
}
function exportFile(extension) {
  finishEditing(); let text, type;
  if (extension === 'json') {text = JSON.stringify(model.book, null, 2); type = 'application/json';}
  else {
    const entries = Object.entries(model.sheet.cells).filter(([, cell]) => cell.value !== '');
    let maxRow = 0, maxCol = 0; for (const [key] of entries) {const [row, col] = key.split(':').map(Number); maxRow = Math.max(row, maxRow); maxCol = Math.max(col, maxCol);}
    text = Array.from({length: maxRow + 1}, (_, row) => Array.from({length: maxCol + 1}, (_, col) => `"${model.getCell(row, col).value.replaceAll('"', '""')}"`).join(',')).join('\r\n'); type = 'text/csv';
  }
  const url = URL.createObjectURL(new Blob([text], {type})), link = document.createElement('a'); link.href = url; link.download = `${model.book.title}${extension === 'csv' ? ` - ${model.sheet.name}` : ''}.${extension}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function setZoom(value) {
  finishEditing(); model.book.view.zoom = Number(value); renderChrome(); renderGrid(true); renderSelection(); ensureVisible(); persist();
}
function selectAll() {selection = {anchor: {row: 0, col: 0}, focus: {row: model.sheet.rows - 1, col: model.sheet.cols - 1}}; renderSelection(); renderGrid(); focusGrid();}
const menuItems = {
  File: () => [{label: 'Rename workbook', run: () => showInputDialog('Rename workbook', 'Document title', model.book.title, 100, value => {model.mutate(book => {book.title = value;});})}, null, {label: 'Download current sheet (.csv)', run: () => exportFile('csv')}, {label: 'Download workbook backup (.json)', run: () => exportFile('json')}, null, {label: experience?.isEditing ? 'Animation studio' : 'Admin sign in…', run: () => experience?.isEditing ? experience.openStudio() : experience?.openLogin()}, ...(experience?.isEditing ? [{label: 'Leave admin / studio mode', run: () => experience.signOut()}] : [])],
  Edit: () => [{label: 'Undo', shortcut: '⌘Z', disabled: !model.past.length, run: () => {model.undo(); focusGrid();}}, {label: 'Redo', shortcut: '⌘⇧Z', disabled: !model.future.length, run: () => {model.redo(); focusGrid();}}, null, {label: 'Cut', shortcut: '⌘X', run: () => menuCopy(true)}, {label: 'Copy', shortcut: '⌘C', run: () => menuCopy()}, {label: 'Paste', shortcut: '⌘V', run: menuPaste}, null, {label: 'Clear values', shortcut: 'Delete', run: () => {model.clear(selection); focusGrid();}}],
  View: () => [{label: `${model.book.view.gridlines ? '✓ ' : ''}Gridlines`, run: () => {model.book.view.gridlines = !model.book.view.gridlines; renderChrome(); renderGrid(true); persist();}}, null, ...[.75, 1, 1.25, 1.5].map(zoom => ({label: `${model.book.view.zoom === zoom ? '✓ ' : ''}Zoom ${zoom * 100}%`, run: () => setZoom(zoom)}))],
  Insert: () => [{label: 'New sheet', run: addSheet}, null, {label: 'Row above', run: () => {if (!model.insertAxis('row', active().row)) toast('Maximum row count reached.');}}, {label: 'Row below', run: () => {if (!model.insertAxis('row', active().row + 1)) toast('Maximum row count reached.');}}, {label: 'Column left', run: () => {if (!model.insertAxis('col', active().col)) toast('Maximum column count reached.');}}, {label: 'Column right', run: () => {if (!model.insertAxis('col', active().col + 1)) toast('Maximum column count reached.');}}],
  Format: () => [{label: 'Bold', shortcut: '⌘B', run: () => applyFormat({bold: !formatAt().bold})}, {label: 'Italic', shortcut: '⌘I', run: () => applyFormat({italic: !formatAt().italic})}, {label: 'Underline', shortcut: '⌘U', run: () => applyFormat({underline: !formatAt().underline})}, null, ...['left', 'center', 'right'].map(align => ({label: `Align ${align}`, run: () => applyFormat({align})})), null, {label: 'Clear formatting', run: () => {model.clear(selection, true); focusGrid();}}],
  Data: () => [{label: 'Sort range A → Z (first column)', run: () => {model.sort(selection); focusGrid();}}, {label: 'Sort range Z → A (first column)', run: () => {model.sort(selection, true); focusGrid();}}, null, {label: 'Selection summary', run: () => showHelp('summary')}],
  Tools: () => [{label: 'Selection summary', run: () => showHelp('summary')}, {label: 'Keyboard shortcuts', run: () => showHelp()}, null, {label: 'Save a workbook backup', run: () => exportFile('json')}],
  Help: () => [{label: 'Keyboard shortcuts', run: () => showHelp()}, {label: 'About this workbook', run: () => showHelp('about')}],
};
async function menuCopy(cut = false) {
  finishEditing(); clipboard = model.copy(selection); copiedText = serializeTSV(clipboard.map(row => row.map(cell => cell.value)));
  try {await navigator.clipboard.writeText(copiedText); if (cut) model.clear(selection); toast(cut ? 'Cells cut' : 'Cells copied');}
  catch {toast('Use ⌘C / Ctrl+C to copy, or ⌘X / Ctrl+X to cut.');}
  focusGrid();
}
function pasteText(text) {
  if(!canEdit())return;
  const rich = clipboard && text === copiedText, matrix = rich ? clipboard : parseTSV(text), range = bounds(selection);
  const row = range.top, col = range.left;
  try{model.paste(row,col,matrix,rich);}catch(error){toast(error.message);return;}
  selection = {anchor: {row, col}, focus: {row: Math.min(model.sheet.rows - 1, row + matrix.length - 1), col: Math.min(model.sheet.cols - 1, col + Math.max(...matrix.map(line => line.length)) - 1)}};
  renderSelection(); renderGrid(); focusGrid();
}
async function menuPaste() {
  try {pasteText(await navigator.clipboard.readText());}
  catch {toast('Use ⌘V / Ctrl+V to paste into the selected cells.'); focusGrid();}
}
const actions = {
  star: () => model.mutate(book => {book.starred = !book.starred;}),
  undo: () => {finishEditing(); model.undo(); focusGrid();}, redo: () => {finishEditing(); model.redo(); focusGrid();},
  shortcuts: () => showHelp(), 'add-sheet': addSheet,
  'font-family': owner => popovers.list(owner, {label: 'Font family', options: FONTS.map(font => ({label: font, value: font})), value: formatAt().font, searchable: true, kind: 'font', onSelect: font => applyFormat({font})}),
  'font-sizes': owner => popovers.list(owner, {label: 'Font size', options: [6,7,8,9,10,11,12,14,16,18,20,24,28,32,36,48].map(size => ({label: String(size), value: size})), value: formatAt().size, kind: 'size', onSelect: size => applyFormat({size})}),
  zoom: owner => popovers.list(owner, {label: 'Zoom', options: [.5,.75,.9,1,1.1,1.25,1.5,2].map(value => ({label: `${Math.round(value * 100)}%`, value})), value: model.book.view.zoom, onSelect: zoom => {setZoom(zoom); focusGrid();}}),
  'text-color': owner => openColorPalette(owner, 'color'), 'fill-color': owner => openColorPalette(owner, 'fill'), emoji: openEmojiPicker,
  bold: () => applyFormat({bold: !formatAt().bold}), italic: () => applyFormat({italic: !formatAt().italic}), underline: () => applyFormat({underline: !formatAt().underline}),
  'size-down': () => applyFormat({size: clamp(formatAt().size - 1, 6, 48)}), 'size-up': () => applyFormat({size: clamp(formatAt().size + 1, 6, 48)}),
  'vertical-alignment':owner=>openPopup(owner,['top','middle','bottom'].map(valign=>({label:`${formatAt().valign===valign?'✓ ':''}${valign[0].toUpperCase()+valign.slice(1)} align`,run:()=>applyFormat({valign})}))),
  'merge-cells':owner=>{const range=selectedRange(),hasMerge=(model.sheet.merges||[]).some(merge=>intersects(merge,range));openPopup(owner,[{label:'Merge cells',disabled:range.top===range.bottom&&range.left===range.right,run:mergeSelected},{label:'Unmerge cells',disabled:!hasMerge,run:()=>{model.unmerge(selection);renderSelection();focusGrid();}}]);},
  'clear-format': () => {finishEditing(); model.clear(selection, true); focusGrid();},
  alignment: owner => openPopup(owner, ['left', 'center', 'right'].map(align => ({label: `${formatAt().align === align ? '✓ ' : ''}Align ${align}`, run: () => applyFormat({align})}))),
  borders: owner => openPopup(owner, [['All borders', 'all'], ['Outer border', 'outer'], ['Bottom border', 'bottom'], ['Clear borders', 'none']].map(([label, mode]) => ({label, run: () => {model.borders(selection, mode); focusGrid();}}))),
  'sheet-list': owner => openPopup(owner, model.book.sheets.map(sheet => ({label: `${sheet.id === model.book.activeId ? '✓ ' : ''}${sheet.name}`, run: (option,event) => switchSheet(sheet.id,event)}))),
};
function setupChrome() {
  document.querySelector('[data-action="star"]').innerHTML = icon('star'); document.querySelector('[data-action="shortcuts"]').innerHTML = icon('keyboard');
  document.querySelector('[data-action="add-sheet"]').innerHTML = icon('plus'); document.querySelector('[data-action="sheet-list"]').innerHTML = icon('list');
  document.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML = icon(el.dataset.icon);});
  dom.menu_bar.innerHTML = Object.keys(menuItems).map(name => `<button class="menu-button" data-menu="${name}" aria-haspopup="menu" aria-expanded="false">${name}</button>`).join('');
  dom.toolbar.innerHTML = [
    button('undo', 'Undo (⌘Z / Ctrl+Z)', icon('undo')), button('redo', 'Redo (⌘⇧Z / Ctrl+Shift+Z)', icon('redo')),
    '<button id="zoom" class="tool-select zoom-select" data-action="zoom" aria-label="Zoom" title="Zoom" aria-haspopup="listbox" aria-expanded="false"><span id="zoom-label">100%</span>' + icon('chevron', 'class="chevron"') + '</button><span class="tool-divider"></span>',
    '<button id="font-family" class="tool-select font-select" data-action="font-family" aria-label="Font family" title="Font family" aria-haspopup="listbox" aria-expanded="false"><span id="font-family-label">Arial</span>' + icon('chevron', 'class="chevron"') + '</button><span class="tool-divider"></span>',
    button('size-down', 'Decrease font size', icon('minus')), '<div class="font-size-control"><input id="font-size" class="font-size-input" type="text" inputmode="decimal" maxlength="4" value="10" aria-label="Font size" title="Font size"><button class="font-size-toggle" data-action="font-sizes" aria-label="Font size options" title="Font size options" aria-haspopup="listbox" aria-expanded="false">' + icon('chevron') + '</button></div>', button('size-up', 'Increase font size', icon('plus')), '<span class="tool-divider"></span>',
    button('bold', 'Bold (⌘B / Ctrl+B)', 'B', 'type-button bold'), button('italic', 'Italic (⌘I / Ctrl+I)', 'I', 'type-button italic'), button('underline', 'Underline (⌘U / Ctrl+U)', 'U', 'type-button underline'),
    '<button id="text-color" class="icon-button color-button text-color" data-action="text-color" aria-label="Text color" title="Text color" aria-haspopup="dialog" aria-expanded="false">A</button>', '<span class="tool-divider"></span>',
    `<button id="fill-color" class="icon-button color-button fill-color" data-action="fill-color" aria-label="Fill color" title="Fill color" aria-haspopup="dialog" aria-expanded="false">${icon('fill')}</button>`,
    button('borders', 'Cell borders', icon('borders') + icon('chevron', 'class="chevron"'), 'tool-dropdown'), '<span class="tool-divider"></span>',
    button('alignment', 'Horizontal alignment', icon('left') + icon('chevron', 'class="chevron"'), 'tool-dropdown'),button('vertical-alignment','Vertical alignment',icon('bottom')+icon('chevron','class="chevron"'),'tool-dropdown'),button('merge-cells','Merge cells',icon('merge')+icon('chevron','class="chevron"'),'tool-dropdown'), button('clear-format', 'Clear formatting', icon('clear')), '<span class="tool-divider"></span>', button('emoji', 'Insert emoji (⌘⇧E / Ctrl+Shift+E)', icon('emoji')),
  ].join('');
  const commitFontSize = () => {const size = Number($('font-size').value); applyFormat({size: Number.isFinite(size) && size ? clamp(size, 6, 48) : 10});};
  $('font-size').onchange = commitFontSize;
  $('font-size').onblur = () => {if (Number($('font-size').value) !== formatAt().size) commitFontSize();};
  $('font-size').onkeydown = event => {if (event.key === 'Enter') {event.preventDefault(); commitFontSize(); focusGrid();} else if (event.key === 'ArrowDown') {event.preventDefault(); actions['font-sizes'](document.querySelector('[data-action=font-sizes]'));}};
}
function pointFromEvent(event,raw=false) {
  const rect = dom.sheet_scroll.getBoundingClientRect();
  const point={row:geometry.rowAt(event.clientY-rect.top+dom.sheet_scroll.scrollTop),col:geometry.columnAt(event.clientX-rect.left+dom.sheet_scroll.scrollLeft)};return raw?point:cellAnchor(displaySheet(),point.row,point.col);
}
function extendDrag() {
  if (!drag) return;
  const rect = dom.sheet_scroll.getBoundingClientRect(), event = drag.event;
  let dx = 0, dy = 0;
  if (event.clientX < rect.left + 18) dx = -16; else if (event.clientX > rect.right - 18) dx = 16;
  if (event.clientY < rect.top + 18) dy = -12; else if (event.clientY > rect.bottom - 18) dy = 12;
  if (dx || dy) dom.sheet_scroll.scrollBy(dx, dy);
  const point = pointFromEvent(event); selectCell(point.row, point.col, true);
  dragFrame = requestAnimationFrame(extendDrag);
}
let lastPointer=null,cursorCaptureFrame=0;
function eventTime(event){return event.timeStamp>1e12?event.timeStamp-performance.timeOrigin:event.timeStamp;}
function capturePointer(event,force=false){
  lastPointer={clientX:event.clientX,clientY:event.clientY};
  const anchor=pointerAnchor(event);
  if(!insideViewport(event.clientX,event.clientY,innerWidth,innerHeight)){anchor.visible=false;anchor.visibilityReason='viewport';}
  experience?.recordPointer('pointer',anchor,eventTime(event),force);
}
function schedulePointerCapture(){
  if(!experience?.recorder.running||!lastPointer||cursorCaptureFrame)return;
  cursorCaptureFrame=requestAnimationFrame(()=>{cursorCaptureFrame=0;if(experience?.recorder.running&&lastPointer)capturePointer(lastPointer);});
}
function setupEvents() {
  // Count completed, physical clicks once, independently of selection, editing,
  // recording and playback. Cells are virtualized and pointer-transparent, so
  // hit-test the sheet surface rather than depending on a particular cell node.
  document.addEventListener('click',event=>{
    if(!event.isTrusted||event.button!==0||!dom.sheet_scroll.contains(event.target)||event.target.closest('.fill-handle,[data-resize-axis]'))return;
    const rect=dom.sheet_scroll.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    if(x<0||y<0||x>=dom.sheet_scroll.clientWidth||y>=dom.sheet_scroll.clientHeight||x+dom.sheet_scroll.scrollLeft>=geometry.totalWidth||y+dom.sheet_scroll.scrollTop>=geometry.totalHeight)return;
    const point=pointFromEvent(event);experience?.countCellClick(point.row,point.col,event);
  },true);
  document.addEventListener('pointerdown', event => {
    if(experience?.recorder.running){capturePointer(event,true);experience.recordPointer('click',pointerAnchor(event),eventTime(event),true);schedulePointerCapture();}
    const emojiAction = event.target.closest('[data-action="emoji"]');
    if (emojiAction) rememberTextTarget();
    if (dom.popup.contains(event.target) || emojiAction) return;
    if (editing && event.target !== dom.cell_editor) commitEdit();
    if (formulaSession && event.target !== dom.formula_input) commitFormula();
  }, true);
  document.addEventListener('focusin', event => {if (event.target === dom.sheet_scroll) textBookmark = null; else rememberTextTarget();});
  for (const name of ['select', 'keyup', 'input', 'pointerup']) document.addEventListener(name, rememberTextTarget);
  document.addEventListener('click', event => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton && !actionButton.disabled)try{actions[actionButton.dataset.action]?.(actionButton);}catch(error){toast(error.message);}
    const menu = event.target.closest('[data-menu]'); if (menu) openPopup(menu, menuItems[menu.dataset.menu]());
    if (event.target.closest('[data-dialog-close]')) dom.workbook_dialog.close();
  });
  dom.menu_bar.addEventListener('pointerover', event => {const menu = event.target.closest('[data-menu]'); if (menu && popovers.owner?.dataset?.menu && popovers.owner !== menu) openPopup(menu, menuItems[menu.dataset.menu]());});
  dom.toolbar.addEventListener('mousedown', event => {if (event.target.closest('button')) event.preventDefault();});
  const commitTitle = () => {if(!canEdit()){renderHeader();return;}const value = dom.document_title.value.trim() || 'Untitled workbook'; model.mutate(book => {book.title = value;}); renderHeader();};
  dom.document_title.addEventListener('change', commitTitle);
  dom.document_title.addEventListener('blur', commitTitle);
  dom.document_title.addEventListener('keydown', event => {if (event.key === 'Enter') {commitTitle(); focusGrid();} if (event.key === 'Escape') {dom.document_title.value = model.book.title; focusGrid();}});
  dom.sheet_scroll.addEventListener('scroll', () => {experience?.recordScroll(scrollAnchor());if(experience?.recorder.running&&lastPointer)experience.recordPointer('pointer',pointerAnchor(lastPointer));if (!renderFrame) renderFrame = requestAnimationFrame(() => {renderFrame = 0; renderGrid();});}, {passive: true});
  dom.sheet_scroll.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target === dom.cell_editor) return;
    // Leave the native scrollbar and touch panning to the browser.
    const rect = dom.sheet_scroll.getBoundingClientRect();
    if (event.clientX > rect.left + dom.sheet_scroll.clientWidth || event.clientY > rect.top + dom.sheet_scroll.clientHeight) return;
    finishEditing(); closePopup(); focusGrid();
    lastPointer={clientX:event.clientX,clientY:event.clientY};
    const isFill = canEdit()&&event.target.closest('.fill-handle'), point = pointFromEvent(event);
    if (!isFill) selectCell(point.row, point.col, event.shiftKey);
    if (event.pointerType !== 'touch') {event.preventDefault(); drag = {event, fill: !!isFill, source: isFill ? model.copy(selection) : null, anchor: {...active()}}; cancelAnimationFrame(dragFrame); dragFrame = requestAnimationFrame(extendDrag);}
  });
  // Pointer capture and DOM replacement can send boundary events while still inside
  // the page. Only a genuine viewport exit is a visibility change.
  document.addEventListener('pointerout',event=>{if(!event.relatedTarget&&!insideViewport(event.clientX,event.clientY,innerWidth,innerHeight)){if(experience?.recorder.running)capturePointer(event,true);lastPointer=null;}},true);
  document.addEventListener('pointerover',event=>{if(!event.relatedTarget&&experience?.recorder.running)capturePointer(event,true);},true);
  document.addEventListener('pointermove', event => {if(experience?.recorder.running){const samples=event.getCoalescedEvents?.();for(const sample of samples?.length?samples:[event])capturePointer(sample);}if (resizing) updateResize(event); else if (drag) drag.event = event;},true);
  document.addEventListener('pointerup', () => {
    schedulePointerCapture();
    if (resizing) {finishResize(); return;}
    cancelAnimationFrame(dragFrame);
    if (drag?.fill) {
      const range = bounds(selection), source = drag.source, rows = range.bottom - range.top + 1, cols = range.right - range.left + 1;
      const matrix = Array.from({length: rows}, (_, row) => Array.from({length: cols}, (_, col) => source[row % source.length][col % source[0].length]));
      model.paste(range.top, range.left, matrix, true);
    }
    drag = null;
    experience?.recordSelection(selection, true);
  });
  document.addEventListener('pointercancel', () => {schedulePointerCapture();finishResize(true); drag = null; cancelAnimationFrame(dragFrame);});
  dom.sheet_scroll.addEventListener('dblclick', event => {if (event.target !== dom.cell_editor) {const point = pointFromEvent(event); selectCell(point.row, point.col); beginEdit();}});
  dom.sheet_scroll.addEventListener('contextmenu', event => {if (event.target === dom.cell_editor) return; event.preventDefault(); const point = pointFromEvent(event), range = bounds(selection); if (point.row < range.top || point.row > range.bottom || point.col < range.left || point.col > range.right) selectCell(point.row, point.col); openPopup(dom.grid, menuItems.Edit(), {left: event.clientX, top: event.clientY});});
  dom.row_headers.addEventListener('pointerdown', event => {const handle = event.target.closest('[data-resize-axis]'); if (handle) {startResize(event, handle); return;} const header = event.target.closest('[data-row]'); if (!header) return; finishEditing(); const row = Number(header.dataset.row); selection = {anchor: {row, col: 0}, focus: {row, col: model.sheet.cols - 1}}; renderSelection(); renderGrid(); focusGrid(); event.preventDefault();});
  dom.column_headers.addEventListener('pointerdown', event => {const handle = event.target.closest('[data-resize-axis]'); if (handle) {startResize(event, handle); return;} const header = event.target.closest('[data-col]'); if (!header) return; finishEditing(); const col = Number(header.dataset.col); selection = {anchor: {row: 0, col}, focus: {row: model.sheet.rows - 1, col}}; renderSelection(); renderGrid(); focusGrid(); event.preventDefault();});
  for (const headers of [dom.row_headers, dom.column_headers]) {
    headers.addEventListener('dblclick', event => {const handle = event.target.closest('[data-resize-axis]'); if (handle) {finishResize(true); model.resizeAxis(handle.dataset.resizeAxis, Number(handle.dataset.index), handle.dataset.resizeAxis === 'row' ? 24 : 100);}});
    headers.addEventListener('keydown', event => {const handle = event.target.closest('[data-resize-axis]'); if (!handle || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); const axis = handle.dataset.resizeAxis, index = Number(handle.dataset.index), delta = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1; model.resizeAxis(axis, index, Number(handle.getAttribute('aria-valuenow')) + delta * (event.shiftKey ? 1 : 10)); const next = headers.querySelector(`[data-index="${index}"]`); next?.focus();});
  }
  $('select-all').onclick = selectAll;
  dom.sheet_scroll.addEventListener('keydown', handleGridKey);
  dom.cell_editor.addEventListener('input', () => {experience?.recordInput(active().row, active().col, dom.cell_editor.value);dom.formula_input.value = dom.cell_editor.value; styleCell(dom.cell_editor,formatAt());});
  dom.cell_editor.addEventListener('blur', () => {if (popovers.kind !== 'emoji') commitEdit();});
  dom.cell_editor.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); commitEdit(true); focusGrid();}
    else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {event.preventDefault(); const editor = dom.cell_editor; editor.setRangeText('\n', editor.selectionStart, editor.selectionEnd, 'end');}
    else if (event.key === 'Enter' || event.key === 'Tab') {event.preventDefault(); event.stopPropagation(); const direction = event.shiftKey ? -1 : 1; commitEdit(); move(event.key === 'Enter' ? direction : 0, event.key === 'Tab' ? direction : 0); focusGrid();}
  });
  dom.formula_input.addEventListener('input', () => {if (formulaSession) experience?.recordInput(formulaSession.row, formulaSession.col, dom.formula_input.value);});
  dom.formula_input.addEventListener('focus', () => {commitEdit(); formulaSession = {...active()};});
  dom.formula_input.addEventListener('blur', () => {if (popovers.kind !== 'emoji') commitFormula();});
  dom.formula_input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault(); commitFormula(true); focusGrid();}
    if (event.key === 'Enter' || event.key === 'Tab') {event.preventDefault(); commitFormula(); move(event.key === 'Enter' ? (event.shiftKey ? -1 : 1) : 0, event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0); focusGrid();}
  });
  dom.cell_reference.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault(); const parsed = parseReference(dom.cell_reference.value, model.sheet.rows, model.sheet.cols);
      if (parsed) {selection = parsed; ensureVisible(); focusGrid(); renderSelection();} else {toast(`Enter a cell or range between A1 and ${cellReference(model.sheet.rows - 1, model.sheet.cols - 1)}.`); dom.cell_reference.select();}
    }
    if (event.key === 'Escape') {focusGrid(); renderSelection();}
  });
  dom.cell_reference.addEventListener('blur', () => {requestAnimationFrame(renderSelection);});
  dom.sheet_tabs.addEventListener('click', event => {
    const tab = event.target.closest('[data-sheet]'); if (!tab) return;
    if (event.target.closest('[data-sheet-menu]')) sheetMenu(tab);
    else switchSheet(tab.dataset.sheet,event);
  });
  dom.sheet_tabs.addEventListener('contextmenu', event => {const tab = event.target.closest('[data-sheet]'); if (tab) {event.preventDefault(); sheetMenu(tab, {left: event.clientX, top: event.clientY});}});
  dom.sheet_tabs.addEventListener('dblclick', event => {const tab = event.target.closest('[data-sheet]'); if (tab) renameSheet(tab.dataset.sheet);});
  dom.sheet_tabs.addEventListener('keydown', event => {const tab = event.target.closest('[data-sheet]'); if (!tab) return; const index = model.book.sheets.findIndex(sheet => sheet.id === tab.dataset.sheet); if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + model.book.sheets.length) % model.book.sheets.length; switchSheet(model.book.sheets[next].id,event); dom.sheet_tabs.children[next].focus();}});
  document.addEventListener('copy', event => handleCopy(event, false)); document.addEventListener('cut', event => handleCopy(event, true));
  document.addEventListener('paste', event => {if (isTextInput(document.activeElement) || dom.workbook_dialog.open) return; if (!dom.sheet_scroll.contains(document.activeElement)) return; event.preventDefault(); pasteText(event.clipboardData.getData('text/plain'));});
  document.addEventListener('keydown', event => {
    const modifier = event.metaKey || event.ctrlKey;
    if (event.key === 'Escape' && resizing) {event.preventDefault(); finishResize(true); return;}
    if (modifier && event.shiftKey && event.key.toLowerCase() === 'e') {event.preventDefault(); openEmojiPicker(document.querySelector('[data-action=emoji]')); return;}
    if (event.key === 'Escape' && !dom.popup.hidden) {popovers.close(true); return;}
    if (dom.workbook_dialog.open || isTextInput(document.activeElement) || dom.popup.contains(document.activeElement)) return;
    if (modifier && event.key.toLowerCase() === 'z') {event.preventDefault(); finishEditing(); event.shiftKey ? model.redo() : model.undo(); focusGrid();}
    else if (modifier && event.key.toLowerCase() === 'y') {event.preventDefault(); model.redo(); focusGrid();}
    else if (modifier && ['b', 'i', 'u'].includes(event.key.toLowerCase())) {event.preventDefault(); const prop = {b: 'bold', i: 'italic', u: 'underline'}[event.key.toLowerCase()]; applyFormat({[prop]: !formatAt()[prop]});}
  });
  new ResizeObserver(() => {renderGrid(true);}).observe(dom.sheet_scroll);
  window.addEventListener('pagehide',()=>{if(canEdit()){finishEditing();clearTimeout(saveTimer);persist();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&canEdit()){experience?.pausePlayback();finishEditing();persist();}else if(!document.hidden)experience?.syncVisibility();});
  dom.workbook_dialog.addEventListener('close', () => {closePopup(); focusGrid();});
}
function handleCopy(event, cut) {
  if (isTextInput(document.activeElement) || dom.workbook_dialog.open || !dom.sheet_scroll.contains(document.activeElement)) return;
  cut=cut&&canEdit();event.preventDefault(); clipboard = model.copy(selection); copiedText = serializeTSV(clipboard.map(row => row.map(cell => cell.value)));
  event.clipboardData.setData('text/plain', copiedText); if (cut) model.clear(selection);
  toast(cut ? 'Cells cut' : 'Cells copied');
}
function handleGridKey(event) {
  if (event.target === dom.cell_editor || isTextInput(event.target) || event.isComposing) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'a') {event.preventDefault(); selectAll(); return;}
  if (modifier && event.key === 'Home') {event.preventDefault(); selectCell(0, 0, event.shiftKey, true); return;}
  if (modifier) return;
  const moves = {ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Enter: [event.shiftKey ? -1 : 1, 0], Tab: [0, event.shiftKey ? -1 : 1]};
  if (moves[event.key]) {event.preventDefault(); move(...moves[event.key], event.shiftKey && event.key.startsWith('Arrow'));}
  else if (event.key === 'Delete' || event.key === 'Backspace') {event.preventDefault(); model.clear(selection);}
  else if (event.key === 'Escape') {closePopup(); selectCell(active().row, active().col);}
  else if (event.key === 'F2') {event.preventDefault(); beginEdit();}
  else if (event.key === 'Home') {event.preventDefault(); selectCell(active().row, 0, event.shiftKey, true);}
  else if (event.key === 'PageDown' || event.key === 'PageUp') {event.preventDefault(); selectCell(geometry.rowAt(geometry.y(active().row) + dom.sheet_scroll.clientHeight * (event.key === 'PageDown' ? 1 : -1)), active().col, event.shiftKey, true);}
  else if (event.key.length === 1 && !event.altKey) {event.preventDefault(); beginEdit(event.key);}
}
setupChrome(); renderChrome(); renderGrid(true); renderSelection(); setupEvents();
if (storageAvailable) persist(); else dom.save_status.innerHTML=`<span class="save-label">Published website</span>`;
focusGrid();


// Animation rendering reads a separate workbook. Playback never mutates the saved draft.
function scrollAnchor() {
  const row=geometry.rowAt(dom.sheet_scroll.scrollTop),col=geometry.columnAt(dom.sheet_scroll.scrollLeft);
  return {row,col,fx:(dom.sheet_scroll.scrollLeft-geometry.x(col))/geometry.width(col),fy:(dom.sheet_scroll.scrollTop-geometry.y(row))/geometry.height(row)};
}
function pointerAnchor(event) {
  return capturePagePointer(event,{element:dom.sheet_scroll,geometry,viewport:scrollAnchor(),pageTarget:resizing?'#grid':undefined,cursor:resizing?(resizing.axis==='row'?'row-resize':'col-resize'):undefined});
}
function recordChrome() {
  if(!experience?.recorder.running)return;
  const popup=dom.popup,owner=popovers.owner,rect=popup.getBoundingClientRect(),base=owner?.getBoundingClientRect();
  const snapshot=popup.hidden||!base?null:{owner:controlSelector(owner),left:rect.left-base.left,top:rect.top-base.top,width:rect.width,height:rect.height,items:[...popup.querySelectorAll('button,input')].filter(item=>{const box=item.getBoundingClientRect();return box.bottom>rect.top&&box.top<rect.bottom;}).map(item=>{const box=item.getBoundingClientRect();return {text:item.tagName==='INPUT'?(item.value||item.placeholder):item.textContent.trim(),left:box.left-rect.left,top:box.top-rect.top,width:box.width,height:box.height,color:/^#[a-f0-9]{3,8}$/i.test(item.title)?item.title:null,selected:item.getAttribute('aria-selected')==='true'||item.getAttribute('aria-pressed')==='true'};})};
  experience.recordPointer('chrome',{popup:snapshot});
}
dom.popup.addEventListener('scroll',recordChrome,true);
new MutationObserver(recordChrome).observe(dom.popup,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style','aria-selected','aria-pressed']});
const cursorLayer=document.createElement('div');cursorLayer.id='animation-cursors';cursorLayer.className='animation-cursors';cursorLayer.setAttribute('aria-hidden','true');document.body.append(cursorLayer);
let cursorModal=null;
function raiseCursorLayer(){
  if(!cursorLayer.showPopover)return;
  const modal=document.querySelector('dialog[open]');
  if(modal!==cursorModal&&cursorLayer.matches(':popover-open'))cursorLayer.hidePopover();
  cursorModal=modal;
  if(!cursorLayer.matches(':popover-open'))cursorLayer.showPopover();
}
cursorLayer.setAttribute('popover','manual');raiseCursorLayer();
new MutationObserver(records=>{schedulePointerCapture();if(records.some(record=>record.attributeName==='open'))raiseCursorLayer();}).observe(document.body,{subtree:true,attributes:true,childList:true,attributeFilter:['class','style','hidden','open','disabled']});
function renderRecordedPopup(nodes,snapshot){
  if(!snapshot){nodes.popup?.remove();nodes.popup=null;nodes.popupSnapshot=null;return;}
  if(!nodes.popup||nodes.popupSnapshot!==snapshot){nodes.popup?.remove();const panel=document.createElement('div');panel.className='recorded-popup';
    for(const item of snapshot.items){const option=document.createElement('div');option.className='recorded-option';option.textContent=item.text;Object.assign(option.style,{left:item.left+'px',top:item.top+'px',width:item.width+'px',height:item.height+'px',background:item.color||(item.selected?'#f1f3f4':'')});panel.append(option);}
    cursorLayer.prepend(panel);nodes.popup=panel;nodes.popupSnapshot=snapshot;
  }
  let base;try{base=document.querySelector(snapshot.owner)?.getBoundingClientRect();}catch{}if(!base){nodes.popup.hidden=true;return;}
  nodes.popup.hidden=false;Object.assign(nodes.popup.style,{left:base.left+snapshot.left+'px',top:base.top+snapshot.top+'px',width:snapshot.width+'px',height:snapshot.height+'px'});
}
const animatedNodes=new Map();
function renderAnimatedFrame(frame,changed) {
  if(!frame.book||!frame.sequence)return;
  playbackBook=frame.book;
  if(changed){updateGeometry();renderGrid(true);renderSelection();}
  raiseCursorLayer();
  const layer=$('animation-overlay'),visible=new Set();
  for(const instance of frame.instances){
    const nodeId=frame.sequence.sheetId+':'+instance.id;let nodes=animatedNodes.get(nodeId);if(!nodes){nodes={};animatedNodes.set(nodeId,nodes);}visible.add(nodeId);
    const selected=frame.selections.get(instance.id);
    if(selected){const range=bounds(expandMergedSelection(displaySheet(),selected));if(!nodes.outline){nodes.outline=document.createElement('div');nodes.outline.className='animated-selection';layer.append(nodes.outline);}nodes.outline.style.borderColor=instance.clip.color;nodes.outline.style.backgroundColor=instance.clip.color+'0c';const top=clamp(range.top,0,model.sheet.rows-1),left=clamp(range.left,0,model.sheet.cols-1),bottom=clamp(range.bottom,0,model.sheet.rows-1),right=clamp(range.right,0,model.sheet.cols-1);place(nodes.outline,top,left,bottom-top+1,right-left+1);}
    if(!selected&&nodes.outline){nodes.outline.remove();nodes.outline=null;}
    const keyframes=cursorKeyframes(instance,frame.time);if(!keyframes||experience?.reducedMotion.matches){nodes.cursor?.remove();nodes.popup?.remove();nodes.popup=null;nodes.cursor=null;continue;}
    const anchorPosition=anchor=>{const row=clamp(anchor.row,0,model.sheet.rows-1),col=clamp(anchor.col,0,model.sheet.cols-1);return{x:geometry.x(col)+geometry.width(col)*(anchor.fx??.5),y:geometry.y(row)+geometry.height(row)*(anchor.fy??.5)};};
    const camera=keyframes.scroll?anchorPosition(keyframes.scroll):null;
    const resolve=anchor=>{if(anchor.surface==='grid'||anchor.surface==='chrome')return resolvePagePointer(anchor,{rect:dom.sheet_scroll.getBoundingClientRect(),geometry,scrollLeft:dom.sheet_scroll.scrollLeft,scrollTop:dom.sheet_scroll.scrollTop,camera,findControl:selector=>{try{return document.querySelector(selector)?.getBoundingClientRect();}catch{return null;}}});const position=anchorPosition(anchor);if(camera&&anchor.viewport){const viewport=anchorPosition(anchor.viewport);position.x+=camera.x-viewport.x;position.y+=camera.y-viewport.y;}const rect=dom.sheet_scroll.getBoundingClientRect();position.x+=rect.left-dom.sheet_scroll.scrollLeft;position.y+=rect.top-dom.sheet_scroll.scrollTop;return position;};
    const from=resolve(keyframes.from),to=resolve(keyframes.to),t=keyframes.progress;
    if(!nodes.cursor){nodes.cursor=document.createElement('div');nodes.cursor.className='simulated-cursor';cursorLayer.append(nodes.cursor);}
    const visual=cursorVisual(keyframes.cursor);
    if(nodes.cursor.dataset.mode!==visual.mode){nodes.cursor.innerHTML=visual.svg;nodes.cursor.dataset.mode=visual.mode;}
    nodes.cursor.hidden=visual.mode==='none';
    renderRecordedPopup(nodes,keyframes.popup);
    if(nodes.popup){const box=nodes.popup.getBoundingClientRect(),x=from.x+(to.x-from.x)*t-box.left,y=from.y+(to.y-from.y)*t-box.top;[...nodes.popup.children].forEach((option,index)=>{const item=keyframes.popup.items[index],hover=x>=item.left&&x<item.left+item.width&&y>=item.top&&y<item.top+item.height;option.style.background=item.color||(hover||item.selected?'#f1f3f4':'');});}
    nodes.cursor.style.transform=`translate3d(${from.x+(to.x-from.x)*t-visual.hotspot[0]}px,${from.y+(to.y-from.y)*t-visual.hotspot[1]}px,0)`;
  }
  for(const [id,nodes]of animatedNodes)if(!visible.has(id)){nodes.cursor?.remove();nodes.popup?.remove();nodes.outline?.remove();animatedNodes.delete(id);}
}
experience=new AnimationExperience({
 getWorkbook:()=>model.book, getSelection:()=>expandMergedSelection(model.sheet,selection),subscribe:listener=>model.subscribe(listener),finishEditing,focusGrid,toast,
 setWorkbook:book=>{finishEditing();clearTimeout(saveTimer);playbackBook=null;model.book=structuredClone(book);model.past=[];model.future=[];sheetViews.clear();selection={anchor:{row:0,col:0},focus:{row:0,col:0}};clampSelection();renderChrome();dom.sheet_scroll.scrollTo(0,0);renderGrid(true);renderSelection();},
 showPlayback:renderAnimatedFrame,
 clearPlayback:adopt=>{playbackBook=null;$('animation-overlay').replaceChildren();cursorLayer.replaceChildren();animatedNodes.clear();if(adopt){model.book=structuredClone(adopt);model.future=[];persist();}renderChrome();renderGrid(true);renderSelection();},
 scrollToAnchor:anchor=>{const row=clamp(anchor.row,0,model.sheet.rows-1),col=clamp(anchor.col,0,model.sheet.cols-1);dom.sheet_scroll.scrollTo(geometry.x(col)+geometry.width(col)*(anchor.fx||0),geometry.y(row)+geometry.height(row)*(anchor.fy||0));renderGrid();},
 modeChanged:(mode,dirty)=>{const badge=document.querySelector('.local-badge');badge.innerHTML=icon('device')+`<span>${mode==='admin'?'Admin · private draft':mode==='local'?'Local studio':'Published website'}</span>`;document.documentElement.dataset.workbookMode=mode;dom.save_status.innerHTML=icon('saved')+`<span class="save-label">${mode==='visitor'?'Published website':mode==='local'?'Local draft':'Private draft'}${mode!=='visitor'&&dirty?' · save to sync':''}</span>`;dom.document_title.readOnly=!canEdit();dom.formula_input.readOnly=!canEdit();document.querySelector('[data-action=add-sheet]').disabled=!canEdit();document.querySelector('[data-action=star]').disabled=!canEdit();renderToolbar();},
 nameDialog:(title,value,save)=>showInputDialog(title,'Name',value,100,name=>{save(name);return true;}),
});
for(const type of ['pointerdown','keydown'])document.addEventListener(type,event=>{if(event.target.closest?.('#grid,#toolbar,#formula-input,#cell-reference,#document-title,#sheet-tabs,#menu-bar')&&!event.target.closest?.('#animation-playback-controls'))experience.interrupt();},true);
dom.sheet_scroll.addEventListener('wheel',()=>experience.interrupt(),{passive:true});
dom.sheet_scroll.addEventListener('touchstart',()=>experience.interrupt(),{passive:true});
experience.init();
