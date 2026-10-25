import {normalizeCursor} from './cursor-visual.js';
// Coordinates are resolved independently for sheet cells and page controls.
// Never clamp a page control to the first or last cell in the sheet.
export function controlSelector(element) {
  const target=element?.closest?.('[id], [data-action], [data-menu]');
  if(!target)return null;
  if(target.id)return '#'+CSS.escape(target.id);
  const attribute=target.hasAttribute('data-action')?'data-action':'data-menu';
  return `[${attribute}="${CSS.escape(target.getAttribute(attribute))}"]`;
}
export const insideViewport=(x,y,width,height)=>x>=0&&y>=0&&x<width&&y<height;
export function cursorRecordingWarning(animation) {
  return animation.events.some(event=>event.type==='pointer'&&event.visible===false&&!event.surface&&!event.screen)
    ? 'This recording only captured the cell grid. Its toolbar path is missing; record it again to capture the full interface.'
    : null;
}
export function capturePagePointer(event,{element,geometry,viewport,cursor,pageTarget,document:doc=globalThis.document}) {
  const rect=element.getBoundingClientRect(),x=event.clientX,y=event.clientY;
  const screen={x,y},hit=doc?.elementFromPoint(x,y);
  const popup=hit?.closest?.('#popup');
  const style=hit&&doc?.defaultView?.getComputedStyle(hit);
  const editable=hit?.matches?.('input,textarea,[contenteditable=true]');
  const mode=normalizeCursor(cursor||(style?.cursor&&style.cursor!=='auto'?style.cursor:editable?'text':'default'));
  const common={screen,cursor:mode,visible:true};
  // Floating menus and dialogs can cover the grid. Hit testing must win over its rectangle.
  const overSheet=!pageTarget&&(!hit||!!hit.closest?.('#sheet-scroll'));
  if(overSheet&&!popup&&x>=rect.left&&x<rect.left+element.clientWidth&&y>=rect.top&&y<rect.top+element.clientHeight){
    const px=x-rect.left+element.scrollLeft,py=y-rect.top+element.scrollTop;
    const row=geometry.rowAt(py),col=geometry.columnAt(px);
    return {surface:'grid',row,col,fx:(px-geometry.x(col))/geometry.width(col),fy:(py-geometry.y(row))/geometry.height(row),viewport,...common};
  }
  let target=pageTarget?doc?.querySelector(pageTarget):hit;
  if(popup)target=doc.querySelector(popup.dataset.pointerOwner||':not(*)')||popup;
  const selector=controlSelector(target),control=selector?doc.querySelector(selector):null;
  const box=control?.getBoundingClientRect();
  return {surface:'chrome',...common,...(box?{target:selector,dx:x-box.left,dy:y-box.top}:{})};
}
export function resolvePagePointer(anchor,{rect,geometry,scrollLeft=0,scrollTop=0,camera,findControl=()=>null}) {
  if(anchor.surface==='chrome'){
    const box=anchor.target&&findControl(anchor.target);
    return box?{x:box.left+anchor.dx,y:box.top+anchor.dy}:{...anchor.screen};
  }
  const row=Math.max(0,Math.min(geometry.rows.length-2,anchor.row||0));
  const col=Math.max(0,Math.min(geometry.columns.length-2,anchor.col||0));
  const position={x:rect.left+geometry.x(col)+geometry.width(col)*(anchor.fx??.5)-scrollLeft,y:rect.top+geometry.y(row)+geometry.height(row)*(anchor.fy??.5)-scrollTop};
  if(camera&&anchor.viewport){
    const view=anchor.viewport;
    position.x+=camera.x-geometry.x(view.col)-geometry.width(view.col)*(view.fx??0);
    position.y+=camera.y-geometry.y(view.row)-geometry.height(view.row)*(view.fy??0);
  }
  return position;
}
