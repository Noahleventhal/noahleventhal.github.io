import {controlSelector} from './animation/pointer.js';
import {COLOR_ROWS, normalizeColor, readableInk, EMOJIS, EMOJI_CATEGORIES} from './picker-data.js';

const make = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const limit = (value, min, max) => Math.max(min, Math.min(max, value));

// One popup surface for menus, dropdowns, palettes and emoji. It can join a modal's top layer.
export class PopoverController {
  constructor(element, {beforeOpen = () => {}, onClose = () => {}} = {}) {
    this.element = element;
    this.beforeOpen = beforeOpen;
    this.onClose = onClose;
    this.owner = null;
    this.kind = null;
    this.columns = 1;
    this.element.addEventListener('keydown', event => this.onKeyDown(event));
    document.addEventListener('pointerdown', event => {
      if (!this.element.hidden && !this.element.contains(event.target) && !this.owner?.contains?.(event.target)) this.close();
    });
    window.addEventListener('resize', () => {if (!this.element.hidden) this.position();});
  }
  close(restoreFocus = false) {
    if (this.element.hidden) return;
    const target = this.returnFocus || this.owner;
    this.owner?.setAttribute?.('aria-expanded', 'false');
    this.element.hidden = true;
    const kind = this.kind;
    this.owner = null; this.kind = null; this.returnFocus = null;
    if (restoreFocus && target?.isConnected) target.focus({preventScroll: true});
    this.onClose(kind);
    if (!document.querySelector('dialog[open]')) document.body.append(this.element);
  }
  open(owner, {kind = 'menu', role = 'menu', label = '', point, preserveEditing = false, returnFocus} = {}) {
    if (this.owner === owner && this.kind === kind && !this.element.hidden) {this.close(true); return false;}
    // Measure the owner before replacing an existing menu that may contain it.
    const rect = point || owner.getBoundingClientRect();
    this.close();
    this.beforeOpen(preserveEditing);
    this.owner = owner; this.element.dataset.pointerOwner=controlSelector(owner)||''; this.kind = kind; this.returnFocus = returnFocus;
    this.anchor = {left: rect.left, top: point ? rect.top : rect.bottom + 3};
    this.columns = 1;
    this.element.replaceChildren();
    this.element.className = `popup ${kind}-popup`;
    this.element.setAttribute('role', role); this.element.setAttribute('aria-label', label);
    (document.querySelector('dialog[open]') || document.body).append(this.element);
    owner?.setAttribute?.('aria-expanded', 'true');
    this.element.hidden = false;
    return true;
  }
  position() {
    const el = this.element;
    el.style.left = `${limit(this.anchor.left, 8, innerWidth - el.offsetWidth - 8)}px`;
    el.style.top = `${limit(this.anchor.top, 8, innerHeight - el.offsetHeight - 8)}px`;
  }
  menu(owner, items, point) {
    if (!this.open(owner, {point})) return;
    for (const item of items) {
      if (!item) {this.element.append(make('hr')); continue;}
      const option = make('button', 'menu-option'); option.type = 'button'; option.setAttribute('role', 'menuitem'); option.disabled = !!item.disabled;
      option.append(make('span', '', item.label));
      if (item.shortcut) option.append(make('span', 'menu-shortcut', item.shortcut));
      option.onclick = event => {this.close(); item.run(option,event);};
      this.element.append(option);
    }
    this.position();this.element.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  }
  list(owner, {label, options, value, onSelect, searchable = false, kind = 'list'}) {
    if (!this.open(owner, {kind, role: 'listbox', label})) return;
    let search;
    const list = make('div', 'option-list');
    const render = () => {
      const query = search?.value.trim().toLowerCase() || '';
      list.replaceChildren();
      options.filter(option => option.label.toLowerCase().includes(query)).forEach(option => {
        const button = make('button', 'list-option'); button.type = 'button'; button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', option.value === value);
        button.append(make('span', 'option-check', option.value === value ? '✓' : ''), make('span', '', option.label));
        button.onclick = () => {this.close(); onSelect(option.value);}; list.append(button);
      });
      if (!list.children.length) list.append(make('p', 'picker-empty', 'No matching fonts'));
      this.position();
    };
    if (searchable) {
      search = make('input', 'picker-search'); search.type = 'search'; search.placeholder = 'Search fonts'; search.setAttribute('aria-label', 'Search fonts'); search.oninput = render;
      this.element.append(search);
    }
    this.element.append(list); render(); this.position();
    if (search) search.focus(); else {const current = list.querySelector('[aria-selected=true]') || list.querySelector('button'); current?.focus(); current?.scrollIntoView({block: 'nearest'});}
  }
  colors(owner, {label, value, onSelect, resetValue = null, resetLabel = 'Reset', returnFocus}) {
    if (!this.open(owner, {kind: 'color', role: 'dialog', label, returnFocus})) return;
    this.columns = 10;
    const header = make('div', 'picker-heading'); header.append(make('span', '', label));
    const reset = make('button', 'picker-reset', resetLabel); reset.type = 'button'; reset.setAttribute('aria-pressed', value === resetValue); reset.onclick = () => {this.close(); onSelect(resetValue);}; header.append(reset);
    const grid = make('div', 'color-grid'); grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Preset colors');
    for (const color of COLOR_ROWS.flat()) {
      const swatch = make('button', 'palette-swatch'); swatch.type = 'button'; swatch.style.backgroundColor = color; swatch.style.color = readableInk(color);
      swatch.title = color; swatch.setAttribute('aria-label', `${label} ${color}`); swatch.setAttribute('aria-pressed', value?.toLowerCase() === color);
      if (value?.toLowerCase() === color) swatch.textContent = '✓';
      swatch.onclick = () => {this.close(); onSelect(color);}; grid.append(swatch);
    }
    const form = make('form', 'custom-color-form');
    const customLabel = make('label', 'custom-color-label', 'Custom color'); customLabel.htmlFor = 'custom-color';
    const row = make('div', 'custom-color-row'); const preview = make('span', 'custom-color-preview'); preview.style.backgroundColor = value || '#ffffff'; preview.classList.toggle('is-selected', !!value && !COLOR_ROWS.flat().includes(value.toLowerCase())); preview.title = value ? `Current color: ${value}` : 'No color';
    const input = make('input', 'custom-color-input'); input.id = 'custom-color'; input.type = 'text'; input.value = value || '#ffffff'; input.maxLength = 7; input.spellcheck = false; input.setAttribute('aria-label', 'Custom color hex');
    const apply = make('button', 'custom-color-apply', 'Apply'); apply.type = 'submit';
    const error = make('span', 'color-error'); error.setAttribute('role', 'status');
    input.oninput = () => {const color = normalizeColor(input.value); preview.classList.toggle('is-selected', !!color && color === value && !COLOR_ROWS.flat().includes(color)); if (color) preview.style.backgroundColor = color; error.textContent = ''; input.removeAttribute('aria-invalid');};
    form.onsubmit = event => {event.preventDefault(); const color = normalizeColor(input.value); if (!color) {error.textContent = 'Enter a hex color, like #1a73e8.'; input.setAttribute('aria-invalid', 'true'); input.focus(); return;} this.close(); onSelect(color);};
    row.append(preview, input, apply); form.append(customLabel, row, error); this.element.append(header, grid, form); this.position();
    (grid.querySelector('[aria-pressed=true]') || grid.firstElementChild)?.focus();
  }
  emojis(owner, {onSelect, returnFocus}) {
    if (!this.open(owner, {kind: 'emoji', role: 'dialog', label: 'Insert emoji', preserveEditing: true, returnFocus})) return;
    this.columns = 8;
    const heading = make('div', 'picker-heading'); heading.append(make('span', '', 'Emoji'), make('span', 'picker-hint', 'Insert at cursor'));
    const search = make('input', 'picker-search'); search.type = 'search'; search.placeholder = 'Search emojis'; search.setAttribute('aria-label', 'Search emojis');
    const categories = make('div', 'emoji-categories'); categories.setAttribute('role', 'tablist'); categories.setAttribute('aria-label', 'Emoji categories');
    let category = 'All'; const categoryIcons = ['◷', '☺', '☝', '❀', '☕', '✈', '⚑', '♡'];
    ['All', ...EMOJI_CATEGORIES].forEach((name, index) => {const button = make('button', 'emoji-category', categoryIcons[index]); button.type = 'button'; button.title = name; button.setAttribute('role', 'tab'); button.setAttribute('aria-label', name); button.setAttribute('aria-selected', name === category); button.onclick = () => {category = name; search.value = ''; for (const sibling of categories.children) sibling.setAttribute('aria-selected', sibling === button); render();}; categories.append(button);});
    const grid = make('div', 'emoji-grid'); grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Emojis');
    const render = () => {
      const query = search.value.trim().toLowerCase(); grid.replaceChildren();
      const results = EMOJIS.filter(item => (query || category === 'All' || item.category === category) && query.split(/\s+/).every(word => `${item.keywords} ${item.category}`.toLowerCase().includes(word) || item.emoji.includes(word)));
      for (const item of results) {const button = make('button', 'emoji-option', item.emoji); button.type = 'button'; button.title = item.keywords; button.setAttribute('aria-label', `${item.emoji} ${item.keywords}`); button.onclick = () => {this.close(); onSelect(item.emoji);}; grid.append(button);}
      if (!results.length) grid.append(make('p', 'picker-empty', 'No emojis found. Try another word.')); this.position();
    };
    search.oninput = render; this.element.append(heading, search, categories, grid); render(); this.position(); search.focus();
  }
  onKeyDown(event) {
    if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); this.close(true); return;}
    const isInput = event.target.matches('input');
    if (isInput && event.key === 'Enter' && ['font', 'emoji'].includes(this.kind)) {
      const first = this.element.querySelector(this.kind === 'emoji' ? '.emoji-option' : '.list-option');
      if (first) {event.preventDefault(); first.click();} return;
    }
    if (isInput && !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    let buttons;
    if (this.kind === 'color') buttons = [...this.element.querySelectorAll('.palette-swatch')];
    else if (this.kind === 'emoji') buttons = [...this.element.querySelectorAll('.emoji-option')];
    else buttons = [...this.element.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return;
    const index = buttons.indexOf(document.activeElement);
    const deltas = {ArrowDown: this.columns, ArrowUp: -this.columns, ArrowRight: 1, ArrowLeft: -1};
    let next;
    if (event.key in deltas) next = index < 0 ? 0 : (index + deltas[event.key] + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    if (next !== undefined) {event.preventDefault(); event.stopPropagation(); buttons[next].focus(); buttons[next].scrollIntoView({block: 'nearest'});}
  }
}
