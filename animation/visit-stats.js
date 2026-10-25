export const STAT_OPTIONS = [
  ['timer','Time on website'],['tabs','Sheet switches'],['clicks','Cell clicks'],
  ['unique','Different cells clicked'],['equation','Live equation'],
];
export const STAT_VARIABLES = ['SECONDS','MINUTES','TAB_SWITCHES','CELL_CLICKS','UNIQUE_CELLS','EDITS'];
const functions={ROUND:(n,d=0)=>{const scale=10**Math.max(-6,Math.min(6,d));return Math.round(n*scale)/scale;},FLOOR:Math.floor,CEIL:Math.ceil,ABS:Math.abs,MIN:Math.min,MAX:Math.max};

// A small arithmetic parser: no eval, JavaScript execution, or external data access.
export function evaluateStatEquation(expression,values={}) {
  const source=String(expression).trim().replace(/^=/,'').toUpperCase();
  if(!source||source.length>200)throw new Error('Enter an equation of up to 200 characters.');
  const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|[A-Z_]+|[()+\-*/%^,]/g)||[];
  if(tokens.join('')!==source.replace(/\s+/g,'')||tokens.length>128)throw new Error('Use numbers, visit variables, and arithmetic operators.');
  let index=0,depth=0;
  const take=token=>tokens[index]===token?(index++,true):false;
  const expect=token=>{if(!take(token))throw new Error(`Expected ${token}.`);};
  const atom=()=>{
    if(++depth>32)throw new Error('The equation is nested too deeply.');
    let result,token=tokens[index++];
    if(token==='('){result=sum();expect(')');}
    else if(/^\d|^\./.test(token||''))result=Number(token);
    else if(STAT_VARIABLES.includes(token))result=values[token]??0;
    else if(Object.hasOwn(functions,token||'')){
      expect('(');const args=[sum()];while(take(','))args.push(sum());expect(')');
      if(args.length>10)throw new Error('Use no more than 10 function arguments.');
      if(token==='ROUND'&&args.length>2||['FLOOR','CEIL','ABS'].includes(token)&&args.length!==1)throw new Error('Check the function arguments.');
      result=functions[token](...args);
    }else throw new Error(`Unknown value: ${token||'end of equation'}.`);
    depth--;return result;
  };
  const power=()=>{const value=atom();return take('^')?value**unary():value;};
  const unary=()=>take('+')?unary():take('-')?-unary():power();
  const product=()=>{let value=unary();while(['*','/','%'].includes(tokens[index])){const op=tokens[index++],next=unary();value=op==='*'?value*next:op==='/'?value/next:value%next;}return value;};
  const sum=()=>{let value=product();while(['+','-'].includes(tokens[index])){const op=tokens[index++],next=product();value=op==='+'?value+next:value-next;}return value;};
  const result=sum();if(index!==tokens.length)throw new Error('Check the equation syntax.');
  return result;
}
export function cleanStat(raw={}) {
  raw=raw&&typeof raw==='object'?raw:{};
  const metric=STAT_OPTIONS.some(([key])=>key===raw.metric)?raw.metric:'timer';
  return {metric,prefix:String(raw.prefix||'').slice(0,80),suffix:String(raw.suffix||'').slice(0,80),
    expression:String(raw.expression||'ROUND(SECONDS / 60, 1)').slice(0,200),
    display:['clock','seconds','number'].includes(raw.display)?raw.display:'clock',
    decimals:Math.max(0,Math.min(3,Math.floor(Number(raw.decimals)||0)))};
}
export class VisitStats {
  // This store belongs to the current page only. Never restore it from a workbook
  // or browser storage; all sheet players share the controller's one instance.
  constructor({clock=()=>performance.now(),startedAt=0}={}){this.clock=clock;this.startedAt=startedAt;this.switches=0;this.clicks=0;this.cells=new Set();this.edits=0;this.listeners=new Set();}
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  notify(){for(const listener of this.listeners)listener();}
  switchSheet(){this.switches++;this.notify();}
  clickCell(sheetId,row,col){this.clicks++;this.cells.add(`${sheetId}:${row}:${col}`);this.notify();}
  recordEdits(before,after){const previous=this.edits;for(const sheet of after.sheets){const old=before.sheets.find(item=>item.id===sheet.id);if(!old)continue;for(const key of new Set([...Object.keys(old.cells),...Object.keys(sheet.cells)]))if((old.cells[key]?.value||'')!==(sheet.cells[key]?.value||''))this.edits++;}if(this.edits!==previous)this.notify();}
  snapshot(){const seconds=Math.max(0,(this.clock()-this.startedAt)/1000);return {SECONDS:seconds,MINUTES:seconds/60,TAB_SWITCHES:this.switches,CELL_CLICKS:this.clicks,UNIQUE_CELLS:this.cells.size,EDITS:this.edits};}
}
export function statText(config,values) {
  const stat=cleanStat(config);let value;
  if(stat.metric==='timer'&&stat.display==='clock'){
    const seconds=Math.floor(values.SECONDS),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds/60)%60;
    value=hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }else{
    let number;
    try{number=stat.metric==='equation'?evaluateStatEquation(stat.expression,values):values[{timer:'SECONDS',tabs:'TAB_SWITCHES',clicks:'CELL_CLICKS',unique:'UNIQUE_CELLS'}[stat.metric]];}catch{return stat.prefix+'—'+stat.suffix;}
    value=Number.isFinite(number)?stat.metric==='timer'&&stat.decimals===0?String(Math.floor(number)):number.toFixed(stat.metric==='equation'||stat.metric==='timer'?stat.decimals:0):'—';
  }
  return stat.prefix+value+stat.suffix;
}
export const isStatAnimation=asset=>asset?.events?.length===1&&asset.events[0].type==='stat';
