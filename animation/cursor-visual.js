// Stored cursor names are a bounded CSS keyword set, never arbitrary markup or URLs.
export const CURSOR_MODES = new Set(['default','pointer','text','vertical-text','crosshair','cell','grab','grabbing','col-resize','row-resize','ew-resize','ns-resize','n-resize','s-resize','e-resize','w-resize','ne-resize','nw-resize','se-resize','sw-resize','nesw-resize','nwse-resize','move','all-scroll','copy','alias','not-allowed','no-drop','wait','progress','help','zoom-in','zoom-out','none']);
export const normalizeCursor = value => CURSOR_MODES.has(value) ? value : 'default';
const arrow='<path d="M1 1v22l5.4-5.5L11 27l3.5-1.8-4.6-9.1H18Z" fill="#111" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>';
const hand='<path d="M9 15V3a2 2 0 0 1 4 0v8-2a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v6c0 3-2 5-3 7H11c-2-3-4-5-6-8-2-3 0-5 2-3l2 2"/>';
const openHand='<path d="m7 16-3-5c-1-2 1-4 3-2l2 4-2-9c-.5-2 3-3 4-1l2 8V3c0-3 4-3 4 0v8l2-7c1-2 4-1 3 1l-1 8 2-4c1-2 4-1 3 1l-3 9c-1 3-3 5-5 7H9c-1-4-3-5-5-7-2-3 0-5 2-3l3 3"/>';
const closedHand='<path d="M7 15V9c0-3 4-3 4 0V7c0-3 4-3 4 0v2c0-3 4-3 4 0v2c0-3 4-2 4 1v7c0 3-2 5-4 7H9c-1-3-3-5-5-7-2-3 0-6 2-4l3 3M11 9v5m4-5v5m4-3v4"/>';
const outline=body=>`<g fill="#fff" stroke="#111" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
export function cursorVisual(value) {
  const mode=normalizeCursor(value);
  let body=arrow,hotspot=[1,1];
  if(mode==='pointer'){body=outline(hand);hotspot=[11,1];}
  else if(mode==='grab'||mode==='grabbing'){body=outline(mode==='grab'?openHand:closedHand);hotspot=[14,14];}
  else if(mode==='text'||mode==='vertical-text'){body='<path d="M8 3h12m-6 0v22m-6 0h12" fill="none" stroke="#fff" stroke-width="4"/><path d="M8 3h12m-6 0v22m-6 0h12" fill="none" stroke="#111" stroke-width="1.5"/>';if(mode==='vertical-text')body=`<g transform="rotate(90 14 14)">${body}</g>`;hotspot=[14,14];}
  else if(/resize$/.test(mode)){
    body=outline('<path d="M14 1 9 7h3v5H7v4h5v5H9l5 6 5-6h-3v-5h5v-4h-5V7h3Z"/>');
    const rotation=['col-resize','ew-resize','e-resize','w-resize'].includes(mode)?90:['ne-resize','sw-resize','nesw-resize'].includes(mode)?45:['nw-resize','se-resize','nwse-resize'].includes(mode)?-45:0;
    body=`<g transform="rotate(${rotation} 14 14)">${body}</g>`;hotspot=[14,14];
  }
  else if(mode==='crosshair'||mode==='cell'){body='<path d="M14 2v24M2 14h24" stroke="#fff" stroke-width="5"/><path d="M14 2v24M2 14h24" stroke="#111" stroke-width="'+(mode==='cell'?3:1.5)+'"/>';hotspot=[14,14];}
  else if(mode==='move'||mode==='all-scroll'){body=outline('<path d="m14 1-4 5h3v7H6v-3l-5 4 5 4v-3h7v7h-3l4 5 4-5h-3v-7h7v3l5-4-5-4v3h-7V6h3Z"/>');hotspot=[14,14];}
  else if(mode==='not-allowed'||mode==='no-drop'){body=outline('<circle cx="14" cy="14" r="10"/><path d="m7 7 14 14"/>');hotspot=[14,14];}
  else if(mode.startsWith('zoom-')){body=outline('<circle cx="11" cy="11" r="8"/><path d="m17 17 9 9M7 11h8'+(mode==='zoom-in'?'m-4-4v8':'')+'"/>');hotspot=[11,11];}
  else if(mode==='wait'||mode==='progress'){body=outline('<path d="M7 2h14M7 26h14M9 2v5c0 4 10 10 10 14v5M19 2v5c0 4-10 10-10 14v5M9 23h10"/>');hotspot=[14,14];}
  else if(mode==='copy')body+=outline('<rect x="13" y="15" width="14" height="12"/><path d="M20 17v8m-4-4h8"/>');
  else if(mode==='alias')body+=outline('<path d="M14 23v-5h11m-4-4 4 4-4 4"/>');
  else if(mode==='help')body+=outline('<path d="M19 8c0-5 8-5 8 0 0 3-4 2-4 6m0 3v1"/>');
  return {mode,hotspot,svg:`<svg viewBox="0 0 28 28" aria-hidden="true">${body}</svg>`};
}
