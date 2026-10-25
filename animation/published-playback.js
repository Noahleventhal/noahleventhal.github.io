import {TimelinePlayer} from './player.js';

// One page clock owns all published sheets. Changing the visible tab only changes
// which frame is painted; it never loads or restarts a recording.
export class PublishedPlayback {
  constructor(project,{clock=()=>performance.now(),visitStats,requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),onFrame=()=>{},onEvents=()=>{},onState=()=>{},onError=()=>{}}={}){
    Object.assign(this,{project,clock,requestFrame,cancelFrame,onFrame,onEvents,onState,onError});this.players=new Map();this.started=false;this.raf=null;
    for(const [sheetId,sequenceId]of Object.entries(project.assignments)){
      const sequence=project.sequences.find(item=>item.id===sequenceId&&item.sheetId===sheetId);if(!sequence)continue;
      const player=new TimelinePlayer({clock,visitStats,requestFrame:()=>0,cancelFrame:()=>{},onFrame:frame=>onFrame(sheetId,frame),onEvents:(events,frame)=>onEvents(sheetId,events,frame),onState:frame=>onState(sheetId,frame),onError});
      player.load(project,sequence,project.workbook);this.players.set(sheetId,player);
    }
  }
  get(sheetId){return this.players.get(sheetId);}
  start({paused=false}={}){if(this.started)return;this.started=true;const origin=this.clock();for(const player of this.players.values()){player.started=origin;player.setStatus(paused?'paused':'playing');}this.sync();}
  tick(){this.raf=null;const now=this.clock();for(const player of this.players.values())if(player.status==='playing'){try{player.advance(now-player.started);if(player.time>=player.scheduler.duration)player.setStatus('ended');}catch(error){player.setStatus('paused');this.onError(error);}}if([...this.players.values()].some(player=>player.status==='playing'))this.raf=this.requestFrame(()=>this.tick());}
  sync(){if(this.raf!==null)this.cancelFrame(this.raf);this.tick();}
  pause(sheetId){this.get(sheetId)?.pause();this.sync();}
  play(sheetId){const player=this.get(sheetId);if(!player||player.status==='ended'||player.status==='playing')return;player.started=this.clock()-player.time;player.setStatus('playing');this.sync();}
  skip(sheetId){this.get(sheetId)?.skip();this.sync();}
  replay(sheetId){const player=this.get(sheetId);if(!player)return;player.status='paused';player.seek(0);player.started=this.clock();player.setStatus('playing');this.sync();}
  pauseAll(){this.suspended=new Set([...this.players].filter(([,player])=>player.status==='playing').map(([id])=>id));for(const id of this.suspended)this.get(id).pause();if(this.raf!==null)this.cancelFrame(this.raf);this.raf=null;}
  resumeAll(){for(const id of this.suspended||[]){const player=this.get(id);player.started=this.clock()-player.time;player.setStatus('playing');}this.suspended=null;this.sync();}
  dispose(){if(this.raf!==null)this.cancelFrame(this.raf);this.raf=null;for(const player of this.players.values())player.stop();}
}
