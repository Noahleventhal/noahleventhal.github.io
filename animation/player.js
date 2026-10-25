import {normalizeCursor} from './cursor-visual.js';
import {VisitStats,statText} from './visit-stats.js';
import {cleanMerges,intersects,cellAnchor} from '../sheet-structure.js';
import {clone} from './project.js';
import {TimelineScheduler} from './scheduler.js';

export function applyPlaybackEvent(book,sheetId,event,statBindings) {
  const sheet=book.sheets.find(sheet=>sheet.id===sheetId);if(!sheet)return;
  if(event.type==='stat'&&event.row<sheet.rows&&event.col<sheet.cols&&event.row>=0&&event.col>=0){const point=cellAnchor(sheet,event.row,event.col);statBindings?.set(`${sheetId}:${point.row}:${point.col}`,{sheetId,...point,stat:clone(event.stat)});}
  if(event.type==='cells')for(const change of event.changes){
    if(change.row>=sheet.rows||change.col>=sheet.cols)continue;
    // Recorded text edits must not detach a revealed live stat. Formatting still
    // applies; updateLiveStats projects the current visit value after this batch.
    const key=`${change.row}:${change.col}`;const old=sheet.cells[key]||{value:'',format:{}},next={value:change.value??old.value,format:{...old.format}};
    for(const [prop,value]of Object.entries(change.format||{})){if(value===null)delete next.format[prop];else next.format[prop]=clone(value);}
    if(next.value||Object.keys(next.format).length)sheet.cells[key]=next;else delete sheet.cells[key];
  }
  if(event.type==='merges'){
    if(event.ranges)sheet.merges=cleanMerges(event.ranges,sheet.rows,sheet.cols);
    else {const added=cleanMerges(event.add,sheet.rows,sheet.cols),removed=event.remove||[];sheet.merges=cleanMerges([...(sheet.merges||[]).filter(range=>!removed.some(item=>['top','bottom','left','right'].every(key=>item[key]===range[key]))&&!added.some(item=>intersects(range,item))),...added],sheet.rows,sheet.cols);}
  }
  if(event.type==='sizes'){
    const key=event.axis==='row'?'rowHeights':'columnWidths';sheet[key]||={};
    for(const change of event.changes){if(change.size===null)delete sheet[key][change.index];else sheet[key][change.index]=change.size;}
  }
}
const cursorCache=new WeakMap();
const upperBound=(items,time,limit=items.length)=>{let low=0,high=limit;while(low<high){const middle=(low+high)>>1;if(items[middle].at<=time)low=middle+1;else high=middle;}return low;};
export function cursorKeyframes(instance,time) {
  const local=(time-instance.start)*instance.clip.speed;
  let cached=cursorCache.get(instance.animation);
  if(!cached){const moves=instance.animation.events.filter(event=>event.type==='pointer'||event.type==='click');cached={moves,scrolls:instance.animation.events.filter(event=>event.type==='scroll'),clicks:instance.animation.events.filter(event=>event.type==='click'),chrome:instance.animation.events.filter(event=>event.type==='chrome')};if(!moves.length&&!(instance.animation.pointerVersion>=2)){const first=instance.animation.events.find(event=>event.type==='select');if(first)moves.push({...first,...first.focus,fx:.5,fy:.5});}cursorCache.set(instance.animation,cached);}
  const points=cached.moves,count=upperBound(points,instance.sourceDuration);if(!count||instance.animation.pointerVersion>=2&&local<points[0].at)return null;
  const index=upperBound(points,local,count),previous=points[Math.max(0,index-1)],next=points[Math.min(count-1,index)];
  // v2 wrote visible:false when leaving the GRID, not the browser viewport.
  // Never treat that legacy marker as a page exit. Its missing toolbar path
  // cannot be reconstructed; retain the recorded boundary position instead.
  if(previous.visible===false&&previous.visibilityReason==='viewport')return null;
  const span=next.at-previous.at,precise=instance.animation.pointerVersion>=2;
  const travel=precise&&span>120?Math.min(span,16):span;
  const progress=instance.animation.pointerVersion>=3&&span>120?0:travel>0?Math.max(0,Math.min(1,(local-(next.at-travel))/travel)):1;
  const click=cached.clicks[upperBound(cached.clicks,local)-1],scroll=cached.scrolls[upperBound(cached.scrolls,local)-1];
  return {from:previous,to:next,progress,cursor:normalizeCursor(previous.cursor),scroll:scroll||previous.viewport,popup:cached.chrome[upperBound(cached.chrome,local)-1]?.popup||null,click:!!click&&local-click.at<250};
}
export class TimelinePlayer {
  constructor({clock=()=>performance.now(),visitStats=new VisitStats({clock}),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),onFrame=()=>{},onEvents=()=>{},onState=()=>{},onError=()=>{}}={}) {
    this.visitStats=visitStats;this.statBindings=new Map();this.clock=clock;this.requestFrame=requestFrame;this.cancelFrame=cancelFrame;this.onFrame=onFrame;this.onEvents=onEvents;this.onState=onState;this.onError=onError;this.status='stopped';this.time=0;
  }
  load(project,sequence,baseBook=project.workbook){this.stop();this.statBindings.clear();this.project=project;this.sequence=sequence;this.scheduler=new TimelineScheduler(project,sequence);this.baseline=clone(baseBook);this.book=clone(baseBook);this.time=0;this.index=0;this.selections=new Map();this.horizon=Number.isFinite(this.scheduler.duration)?this.scheduler.duration:60000;this.events=this.scheduler.eventsThrough(this.horizon);this.onFrame(this.frame());}
  frame(){return{book:this.book,time:this.time,status:this.status,sequence:this.sequence,selections:this.selections,instances:this.scheduler?.activeInstances(this.time)||[]};}
  setStatus(status){this.status=status;this.onState(this.frame());}
  play(){if(!this.scheduler||this.status==='playing')return;if(this.status==='ended')this.seek(0);this.started=this.clock()-this.time;this.setStatus('playing');this.tick();}
  pause(){if(this.status!=='playing')return;this.advance(this.clock()-this.started);this.cancelFrame(this.raf);this.setStatus('paused');}
  stop(){if(this.raf)this.cancelFrame(this.raf);this.status='stopped';this.time=0;}
  advance(time){
    if(!this.scheduler)return;
    this.time=Math.min(Math.max(0,time),this.scheduler.duration);
    if(this.time>this.horizon){this.horizon=this.time+60000;this.events=this.scheduler.eventsThrough(this.horizon);}
    const applied=[];
    while(this.index<this.events.length&&this.events[this.index].at<=this.time){const item=this.events[this.index++];applyPlaybackEvent(this.book,this.sequence.sheetId,item.event,this.statBindings);if(item.event.type==='select')this.selections.set(item.instance.id,item.event);applied.push(item);}
    const statsChanged=this.updateLiveStats();
    if(applied.length||statsChanged)this.onEvents(applied,this.frame());
    this.onFrame(this.frame());
  }
  updateLiveStats(){
    const values=this.visitStats.snapshot();let changed=false;
    for(const binding of this.statBindings.values()){
      const sheet=this.book?.sheets.find(sheet=>sheet.id===binding.sheetId);if(!sheet)continue;
      const key=`${binding.row}:${binding.col}`,old=sheet.cells[key]||{value:'',format:{}},value=statText(binding.stat,values);
      if(old.value!==value){sheet.cells[key]={...old,value};changed=true;}
    }
    return changed;
  }
  refreshLiveStats(){if(this.updateLiveStats()){this.onEvents([],this.frame());this.onFrame(this.frame());}}
  tick(){if(this.status!=='playing')return;try{this.advance(this.clock()-this.started);if(this.time>=this.scheduler.duration){this.setStatus('ended');return;}this.raf=this.requestFrame(()=>this.tick());}catch(error){this.cancelFrame(this.raf);this.setStatus('paused');this.onError(error);}}
  seek(time){const wasPlaying=this.status==='playing';this.cancelFrame(this.raf);this.book=clone(this.baseline);this.statBindings.clear();this.index=0;this.selections.clear();this.time=0;this.advance(time);if(wasPlaying){this.started=this.clock()-this.time;this.raf=this.requestFrame(()=>this.tick());}}
  skip(){if(!this.scheduler)return;this.pause();this.seek(this.scheduler.completionTime);this.setStatus('ended');}
}
