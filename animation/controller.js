import {VisitStats} from './visit-stats.js';
import {createProject,normalizeProject,publishableProject,newSequence,clone,uid} from './project.js';
import {SpreadsheetRecorder} from './recorder.js';
import {PublishedPlayback} from './published-playback.js';
import {TimelinePlayer} from './player.js';
import {CloudRepository} from './cloud.js';
import {AnimationStudio} from './studio.js';
const LOCAL_KEY='noah-animation-studio-local-v1',ADMIN_CACHE='noah-admin-unsaved-v1';
const isLoopback=()=>['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
export class AnimationExperience {
 constructor(bridge){
  this.bridge=bridge;this.mode='visitor';this.project=createProject(bridge.getWorkbook());this.publication=null;this.recordingName='New recording';this.pendingRecording=null;this.message='';this.dirty=false;this.ready=false;this.initialized=new Promise(resolve=>{this.finishInit=resolve;});
  this.visitStats=new VisitStats();this.statTimer=setInterval(()=>this.refreshStats(),250);this.recorder=new SpreadsheetRecorder();this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  this.previewPlayer=this.player=new TimelinePlayer({visitStats:this.visitStats,onEvents:(events,frame)=>{if(!this.isEditing)return;this.bridge.showPlayback(frame,true);const scroll=events.filter(item=>item.event.type==='scroll').at(-1);if(scroll)this.bridge.scrollToAnchor(scroll.event);},onFrame:frame=>{if(!this.isEditing)return;this.bridge.showPlayback(frame,false);this.view?.updateClock();this.updatePlaybackControls();},onState:()=>this.updatePlaybackControls(),onError:error=>this.tell(error.message)});
  this.visitStats.subscribe(()=>this.refreshStats());
  this.view=new AnimationStudio(this,document.getElementById('animation-studio'));
  this.bridge.subscribe(({before,after})=>{if(this.isEditing&&!this.restoring)this.visitStats.recordEdits(before,after);if(this.recorder.running)this.safeRecord(()=>this.recorder.captureMutation(before,after));if(this.isEditing&&!this.restoring&&!this.recorder.running){this.project.workbook=clone(after);this.dirty=true;this.cacheDraft();}});
  this.buildPlaybackControls();
  this.reducedMotion.addEventListener('change',()=>{if(this.reducedMotion.matches){if(this.isEditing)this.player.pause();else for(const id of this.visitors?.players.keys()||[])this.visitors.pause(id);}});
 }
 get isEditing(){return this.mode==='admin'||this.mode==='local';}
 activeSheetId(){return this.bridge.getWorkbook().activeId;}
 activeSheetName(){return this.bridge.getWorkbook().sheets.find(sheet=>sheet.id===this.activeSheetId())?.name||'Sheet';}
 async init(){
  try{const response=await fetch('./site-config.json',{cache:'no-store'});if(!response.ok)throw new Error('Connection settings are unavailable.');this.cloud=new CloudRepository(await response.json());await this.cloud.connect();
   const publication=await this.cloud.publication();if(publication){this.publication=publication;this.project=publication.project;this.bridge.setWorkbook(publication.project.workbook);}
   this.visitorBook=clone(this.bridge.getWorkbook());
   if(this.cloud.configured&&await this.cloud.verifyAdmin()){await this.enterAdmin(false);}else this.startVisitors();
  }catch(error){this.bridge.toast('Published content is currently unavailable. Please try refreshing.');this.connectionError=error.message;this.visitorBook=clone(this.bridge.getWorkbook());}
  this.ready=true;this.updateMode();this.finishInit();
 }
 persistWorkbook(){
  if(!this.isEditing||this.restoring||this.recorder.running)return;
  try{if(this.isEditing){this.project.workbook=clone(this.bridge.getWorkbook());this.dirty=true;this.cacheDraft();}}catch{this.bridge.toast('Browser storage is full. Save a draft or download a backup.');}
 }
 cacheDraft(){try{const value=JSON.stringify({project:this.project,revision:this.cloud?.revision||0});if(this.mode==='local')localStorage.setItem(LOCAL_KEY,value);else if(this.mode==='admin')sessionStorage.setItem(ADMIN_CACHE,value);}catch{this.message='Local recovery storage is full. Save your draft to Supabase.';}}
 updateMode(){this.bridge.modeChanged(this.mode,this.dirty);this.view.render();this.updatePlaybackControls();}
 tell(message){this.message=message;this.bridge.toast(message);this.view.render();}
 currentSequence(){const sequences=this.project.sequences.filter(sequence=>sequence.sheetId===this.activeSheetId());return sequences.find(sequence=>sequence.id===this.selectedSequenceId)||sequences[0]||null;}
 ensureSequence(){if(!this.currentSequence()){const sequence=newSequence(this.activeSheetId(),'Sequence 1');this.project.sequences.push(sequence);this.selectedSequenceId=sequence.id;}}
 change(action){if(!this.isEditing||this.recorder.running)return;this.stopPlayback();this.project.workbook=clone(this.bridge.getWorkbook());action(this.project);this.project=normalizeProject(this.project);this.dirty=true;this.cacheDraft();this.updateMode();}
 async enterAdmin(open=true){
  this.suspendVisitors();this.stopPlayback();this.visitorBook=clone(this.bridge.getWorkbook());const draft=await this.cloud.draft();
  this.mode='admin';this.player=this.previewPlayer;this.project=draft||createProject(this.bridge.getWorkbook());
  try{const cache=JSON.parse(sessionStorage.getItem(ADMIN_CACHE));if(cache?.revision===this.cloud.revision)this.project=normalizeProject(cache.project);}catch{}
  this.bridge.setWorkbook(this.project.workbook);this.ensureSequence();this.message='Private draft. Save draft keeps it private; Publish updates visitors.';this.updateMode();if(open)this.openStudio();
 }
 openLocal(){
  if(!isLoopback())return;
  this.suspendVisitors();this.stopPlayback();this.visitorBook=clone(this.bridge.getWorkbook());this.mode='local';this.player=this.previewPlayer;
  try{const saved=JSON.parse(localStorage.getItem(LOCAL_KEY));this.project=saved?normalizeProject(saved.project):createProject(this.bridge.getWorkbook());}catch{this.project=createProject(this.bridge.getWorkbook());}
  this.bridge.setWorkbook(this.project.workbook);this.ensureSequence();this.message='Local development preview. Cloud publishing requires admin sign-in.';this.openStudio();this.updateMode();
 }
 openStudio(){if(!this.isEditing)return this.openLogin();document.getElementById('animation-studio').hidden=false;this.ensureSequence();this.view.render();}
 async openLogin(){
  if(!this.ready)await this.initialized;
  if(this.mode==='admin')return this.openStudio();
  const dialog=document.getElementById('admin-auth-dialog');dialog.replaceChildren();
  const form=make('form');form.append(make('h2','','Administrator sign in'),make('p','dialog-note','Sign in to edit the spreadsheet, manage recordings, and publish changes.'));
  const emailLabel=make('label','','Email'),email=make('input');email.type='email';email.name='email';email.autocomplete='username';email.required=true;email.setAttribute('aria-label','Admin email');emailLabel.append(email);
  const passwordLabel=make('label','','Password'),password=make('input');password.type='password';password.name='password';password.autocomplete='current-password';password.required=true;password.setAttribute('aria-label','Admin password');passwordLabel.append(password);
  const error=make('p','auth-error');error.setAttribute('role','status');const actions=make('div','dialog-actions');
  const cancel=make('button','','Cancel');cancel.type='button';cancel.onclick=()=>dialog.close();const submit=make('button','','Sign in');submit.type='submit';submit.disabled=!this.cloud?.configured;actions.append(cancel,submit);
  form.append(emailLabel,passwordLabel,error,actions);
  if(this.connectionError)error.textContent=this.connectionError;
  if(isLoopback()){const local=make('button','local-studio-button','Open local studio preview');local.type='button';local.onclick=()=>{dialog.close();this.openLocal();};form.append(local);}
  form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;error.textContent='Signing in…';try{await this.cloud.signIn(email.value.trim(),password.value);password.value='';dialog.close();await this.enterAdmin();}catch(failure){error.textContent=failure.message;}finally{password.value='';submit.disabled=false;}};
  dialog.append(form);dialog.showModal();email.focus();
 }
 async signOut(){if(this.recorder.running)this.stopRecording();this.stopPlayback();await this.cloud?.signOut();this.mode='visitor';sessionStorage.removeItem(ADMIN_CACHE);this.project=this.publication?.project||createProject(this.visitorBook);document.getElementById('animation-studio').hidden=true;this.bridge.setWorkbook(this.project.workbook);this.updateMode();if(this.visitors?.project===this.project){this.visitors.resumeAll();this.showVisitorSheet();}else this.startVisitors();}
 async saveDraft(){
  if(!this.isEditing||this.busy||this.recorder.running)return;
  this.bridge.finishEditing();this.stopPlayback();this.project.workbook=clone(this.bridge.getWorkbook());this.project=normalizeProject(this.project);
  if(this.mode==='local'){this.cacheDraft();this.dirty=false;this.tell('Local draft saved on this browser. Sign in to save across devices.');this.updateMode();return;}
  const snapshot=clone(this.project);this.busy=true;this.view.render();try{await this.cloud.save(snapshot);this.dirty=JSON.stringify(this.project)!==JSON.stringify(snapshot);this.cacheDraft();this.tell(this.dirty?'Draft saved. Your newer edits are still unsaved.':'Private draft saved to Supabase.');}catch(error){this.tell(error.message);}finally{this.busy=false;this.updateMode();}
 }
 async publish(){
  if(this.mode!=='admin'||this.busy||this.recorder.running)return;
  this.bridge.finishEditing();this.stopPlayback();this.project.workbook=clone(this.bridge.getWorkbook());this.project=normalizeProject(this.project);
  const snapshot=clone(this.project);this.busy=true;this.view.render();try{await this.cloud.save(snapshot);const revision=await this.cloud.publish();this.publication={project:publishableProject(snapshot),revision};this.dirty=JSON.stringify(this.project)!==JSON.stringify(snapshot);this.cacheDraft();this.tell(this.dirty?'Published the saved snapshot. Your newer edits remain private.':'Published. Visitors will see this workbook and its selected timelines.');}catch(error){this.tell(error.message);}finally{this.busy=false;this.updateMode();}
 }
 safeRecord(action){try{action();}catch(error){if(!this.stoppingRecording)this.stopRecording();this.tell(error.message);}}
 startRecording(name){if(!this.isEditing||this.pendingRecording||this.recorder.running)return;this.bridge.finishEditing();this.stopPlayback();document.getElementById('animation-studio').classList.remove('expanded');this.recordingName=name.trim()||'New recording';this.recordingBaseline=clone(this.bridge.getWorkbook());this.recorder.start(this.activeSheetId(),this.recordingName);this.recorder.record('select',this.bridge.getSelection());this.message='Recording spreadsheet actions. Stop when finished.';this.view.render();this.bridge.focusGrid();}
 stopRecording(){if(!this.recorder.running||this.stoppingRecording)return;this.stoppingRecording=true;this.bridge.finishEditing();this.pendingRecording=this.recorder.stop();this.stoppingRecording=false;this.restoring=true;this.bridge.setWorkbook(this.recordingBaseline);this.project.workbook=clone(this.recordingBaseline);this.restoring=false;this.message='Recording stopped. Preview it, then save it to your library.';this.view.render();}
 saveRecording(){if(!this.pendingRecording)return;const asset=this.pendingRecording;this.pendingRecording=null;this.change(project=>project.animations.push(asset));this.tell('Recording saved to the library. Save draft to sync it.');}
 recordInput(row,col,value){this.safeRecord(()=>this.recorder.record('cells',{changes:[{row,col,value}]}));}
 recordSelection(selection,force=false){this.safeRecord(()=>this.recorder.record('select',selection,{throttle:20,force}));}
 recordPointer(type,anchor,timestamp,force=false){this.safeRecord(()=>this.recorder.record(type,anchor,{force,throttle:0,...(Number.isFinite(timestamp)?{timestamp}:{})}));}
 recordResize(axis,index,size){this.safeRecord(()=>this.recorder.record('sizes',{axis,changes:[{index,size}]},{throttle:16}));}
 recordScroll(anchor){this.safeRecord(()=>this.recorder.record('scroll',anchor,{throttle:16}));}
 beforeSheetSwitch(){if(!this.isEditing)return;if(this.recorder.running)this.stopRecording();this.stopPlayback();}
 afterSheetSwitch(){this.selectedSequenceId=null;this.selectedClipId=null;if(this.isEditing){this.ensureSequence();this.view.render();}else this.showVisitorSheet();}
 previewAsset(asset){if(!asset)return;const sequence={id:'preview',name:asset.name,sheetId:this.activeSheetId(),startDelay:0,gap:0,clips:[{id:'preview-clip',animationId:asset.id,start:0,speed:1,repeatCount:1,repeatDelay:0,interval:0,color:'#1a73e8'}]};this.startPlayback({...this.project,animations:[...this.project.animations.filter(item=>item.id!==asset.id),asset]},sequence);}
 previewSequence(){const sequence=this.currentSequence();if(sequence)this.startPlayback(this.project,sequence);}
 play(){if(!this.isEditing){this.visitors?.play(this.activeSheetId());this.showVisitorSheet();return;}if(this.player.sequence&&this.player.status==='paused'){this.player.play();return;}if(this.isEditing)this.previewSequence();else this.startVisitors();}
 startPlayback(project,sequence,play=true){
  if(this.recorder.running)return;
  this.stopPlayback();this.bridge.finishEditing();this.playingPreview=this.isEditing;this.player.load(project,sequence,this.bridge.getWorkbook());if(play)this.player.play();else this.player.setStatus('paused');this.updatePlaybackControls();
 }
 stopPlayback(){if(!this.isEditing)return;const active=this.player.sequence&&this.player.status!=='stopped';if(active){this.bridge.clearPlayback();this.player.stop();this.player.sequence=null;}this.updatePlaybackControls();}
 interrupt(){if(!this.isEditing)return;if(this.player.sequence&&this.player.status!=='stopped'){this.player.pause();this.stopPlayback();}}
 suspendVisitors(){this.visitors?.pauseAll();this.bridge.clearPlayback();}
 startVisitors(){
  if(this.isEditing)return;
  if(!this.visitors||this.visitors.project!==this.project){this.visitors?.dispose();this.visitors=new PublishedPlayback(this.project,{visitStats:this.visitStats,onEvents:(sheetId,events,frame)=>{if(this.isEditing||sheetId!==this.activeSheetId())return;this.bridge.showPlayback(frame,true);const scroll=events.filter(item=>item.event.type==='scroll').at(-1);if(scroll)this.bridge.scrollToAnchor(scroll.event);},onFrame:(sheetId,frame)=>{if(!this.isEditing&&sheetId===this.activeSheetId()){this.player=this.visitors?.get(sheetId)||this.previewPlayer;this.bridge.showPlayback(frame,false);this.updatePlaybackControls();}},onState:()=>this.updatePlaybackControls(),onError:error=>this.bridge.toast(error.message)});}
  this.visitors.start({paused:this.reducedMotion.matches});this.showVisitorSheet();
 }
 showVisitorSheet(){if(this.isEditing)return;this.visitors?.sync();this.player=this.visitors?.get(this.activeSheetId())||this.previewPlayer;this.playingPreview=false;const frame=this.visitors?.get(this.activeSheetId())?.frame();if(frame)this.bridge.showPlayback(frame,true);else this.bridge.clearPlayback();this.updatePlaybackControls();}
 pausePlayback(){if(this.isEditing)this.player.pause();else this.visitors?.pause(this.activeSheetId());}
 skipPlayback(){if(this.isEditing)this.player.skip();else this.visitors?.skip(this.activeSheetId());}
 replayPlayback(){if(this.isEditing)this.previewSequence();else{this.visitors?.replay(this.activeSheetId());this.showVisitorSheet();}}
 refreshStats(){
  if(this.isEditing){if(this.playingPreview&&this.previewPlayer.sequence)this.previewPlayer.refreshLiveStats();}
  else for(const player of this.visitors?.players.values()||[])player.refreshLiveStats();
 }
 countCellClick(row,col,event){if(event?.isTrusted)this.visitStats.clickCell(this.activeSheetId(),row,col);}
 countSheetSwitch(event){if(event?.isTrusted)this.visitStats.switchSheet();}
 syncVisibility(){this.refreshStats();if(!this.isEditing)this.visitors?.sync();}
 buildPlaybackControls(){
  const bar=document.getElementById('animation-playback-controls');
  const label=make('span','playback-label','Animation');label.id='visitor-animation-label';bar.append(label);
  for(const[key,text,title]of[['play','▷','Play or resume animation'],['pause','Ⅱ','Pause animation'],['skip','⇥','Skip animation'],['replay','↻','Replay animation']]){const button=make('button','icon-button',text);button.type='button';button.setAttribute('aria-label',title);button.title=title;button.onclick=()=>{if(key==='play')this.play();if(key==='pause')this.pausePlayback();if(key==='skip')this.skipPlayback();if(key==='replay')this.replayPlayback();};bar.append(button);}
 }
 updatePlaybackControls(){const bar=document.getElementById('animation-playback-controls');if(!bar)return;bar.hidden=!this.player.sequence||!this.isEditing&&!this.visitors?.get(this.activeSheetId());const label=document.getElementById('visitor-animation-label');if(label)label.textContent=this.player.status==='paused'&&this.reducedMotion.matches?'Motion paused':`${this.playingPreview?'Preview':'Animation'} · ${Math.floor((this.player.time||0)/1000)}s`;}
 nameDialog(title,value,save){this.bridge.nameDialog(title,value,save);}
}
