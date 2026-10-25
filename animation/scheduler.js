import {intersects} from '../sheet-structure.js';
export function clipTiming(clip, animation) {
  const sourceDuration = Math.min(animation.duration, clip.duration ?? animation.duration), speed = clip.speed || 1;
  const duration = sourceDuration / speed;
  return {sourceDuration, duration, period: clip.interval > 0 ? Math.max(100,clip.interval) : duration + Math.max(0,clip.repeatDelay || 0)};
}
export class TimelineScheduler {
  constructor(project, sequence) {this.project=project;this.sequence=sequence;this.assets=new Map(project.animations.map(asset=>[asset.id,asset]));}
  get duration() {
    let end=this.sequence.startDelay || 0;
    for (const clip of this.sequence.clips) {const asset=this.assets.get(clip.animationId);if(!asset)continue;if(clip.repeatCount===0)return Infinity;const timing=clipTiming(clip,asset);end=Math.max(end,(this.sequence.startDelay||0)+clip.start+(Math.max(1,clip.repeatCount)-1)*timing.period+timing.duration);}
    return end;
  }
  get completionTime() {
    return Math.max(0,...this.sequence.clips.map(clip=>{const asset=this.assets.get(clip.animationId);if(!asset)return 0;const timing=clipTiming(clip,asset);return(this.sequence.startDelay||0)+clip.start+(Math.max(1,clip.repeatCount)-1)*timing.period+timing.duration;}));
  }
  instances(until) {
    const result=[];
    this.sequence.clips.forEach((clip,track)=>{
      const animation=this.assets.get(clip.animationId);if(!animation)return;
      const timing=clipTiming(clip,animation),base=(this.sequence.startDelay||0)+clip.start;
      const count=Math.max(0,Math.min(clip.repeatCount===0?Infinity:Math.max(1,clip.repeatCount),Math.floor((until-base)/timing.period)+1));
      if(count+result.length>20000)throw new Error('This repeat interval creates too many animation instances. Increase the interval.');
      for(let iteration=0;iteration<count;iteration++){const start=base+iteration*timing.period;result.push({id:`${clip.id}:${iteration}`,clip,animation,track,iteration,start,end:start+timing.duration,...timing});}
    });
    return result;
  }
  eventsThrough(until) {
    const result=[];
    for(const instance of this.instances(until)) instance.animation.events.forEach((event,eventIndex)=>{
      if(event.at>instance.sourceDuration)return;const at=instance.start+event.at/instance.clip.speed;
      if(at<=until){if(result.length>=250000)throw new Error('This timeline has too many events. Shorten the sequence or increase repeat intervals.');result.push({at,event,eventIndex,instance});}
    });
    if(result.length>250000)throw new Error('This timeline has too many events. Shorten the sequence or increase repeat intervals.');
    return result.sort((a,b)=>a.at-b.at||a.instance.track-b.instance.track||a.instance.iteration-b.instance.iteration||a.eventIndex-b.eventIndex);
  }
  activeInstances(time) {
    const result=[];
    this.sequence.clips.forEach((clip,track)=>{
      const animation=this.assets.get(clip.animationId);if(!animation)return;
      const timing=clipTiming(clip,animation),base=(this.sequence.startDelay||0)+clip.start;
      const first=Math.max(0,Math.ceil((time-base-timing.duration)/timing.period));
      const last=Math.min(clip.repeatCount===0?Infinity:Math.max(1,clip.repeatCount)-1,Math.floor((time-base)/timing.period));
      if(last-first>2000)throw new Error('Too many overlapping cursors. Increase the repeat interval.');
      for(let iteration=first;iteration<=last;iteration++){const start=base+iteration*timing.period;result.push({id:`${clip.id}:${iteration}`,clip,animation,track,iteration,start,end:start+timing.duration,...timing});}
    });return result;
  }
  conflicts() {
    const warnings=[],clips=this.sequence.clips.filter(clip=>this.assets.has(clip.animationId));
    const touched=new Map(this.project.animations.map(animation=>[animation.id,{cells:new Set(animation.events.filter(event=>event.type==='cells'||event.type==='stat').flatMap(event=>(event.type==='stat'?[event]:event.changes).map(change=>`${change.row}:${change.col}`))),merges:animation.events.filter(event=>event.type==='merges').flatMap(event=>event.ranges||[...(event.add||[]),...(event.remove||[])])}]));
    const conflictCell=(first,second)=>{
      for(const key of first.cells){if(second.cells.has(key))return key;const [row,col]=key.split(':').map(Number);if(second.merges.some(range=>row>=range.top&&row<=range.bottom&&col>=range.left&&col<=range.right))return key;}
      for(const key of second.cells){const [row,col]=key.split(':').map(Number);if(first.merges.some(range=>row>=range.top&&row<=range.bottom&&col>=range.left&&col<=range.right))return key;}
      for(const a of first.merges)for(const b of second.merges)if(intersects(a,b))return `${Math.max(a.top,b.top)}:${Math.max(a.left,b.left)}`;
      return null;
    };
    const range=clip=>{const t=clipTiming(clip,this.assets.get(clip.animationId));return {...t,start:(this.sequence.startDelay||0)+clip.start,count:clip.repeatCount===0?Infinity:Math.max(1,clip.repeatCount)};};
    for(let i=0;i<clips.length;i++)for(let j=i;j<clips.length;j++){
      const a=clips[i],b=clips[j],cell=conflictCell(touched.get(a.animationId),touched.get(b.animationId));if(!cell)continue;
      const x=range(a),y=range(b);let overlap=false;
      if(i===j)overlap=x.count>1&&x.period<=x.duration;
      else {
        // Walk intervals in time order, skipping directly past disjoint repetitions.
        let ai=0,bi=0,steps=0;
        while(ai<x.count&&bi<y.count&&steps++<20000){const as=x.start+ai*x.period,bs=y.start+bi*y.period;if(as+x.duration>=bs&&bs+y.duration>=as){overlap=true;break;}if(as+x.duration<bs)ai=Math.max(ai+1,Math.ceil((bs-x.duration-x.start)/x.period));else bi=Math.max(bi+1,Math.ceil((as-y.duration-y.start)/y.period));}
      }
      if(!overlap)continue;
      const [row,col]=cell.split(':').map(Number);let n=col+1,label='';while(n){label=String.fromCharCode(65+(n-1)%26)+label;n=Math.floor((n-1)/26);}label+=row+1;
      const first=this.assets.get(a.animationId).name,second=this.assets.get(b.animationId).name;
      warnings.push({first,second,cell,message:`${first} and ${second} overlap at ${label}. Later timestamps win; at equal times, the lower track wins.`});
      if(warnings.length>=20)return warnings;
    }return warnings;
  }
}
export function arrangeSequentially(project,sequence) {
  let next=0;
  sequence.clips.forEach(clip=>{const asset=project.animations.find(item=>item.id===clip.animationId);if(!asset)return;clip.start=next;const t=clipTiming(clip,asset);next+=(Math.max(1,clip.repeatCount)-1)*t.period+t.duration+(sequence.gap||0);});
}
