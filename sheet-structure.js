// Ranges are inclusive and use zero-based cell coordinates.
export const intersects = (a,b) => a.top<=b.bottom&&a.bottom>=b.top&&a.left<=b.right&&a.right>=b.left;
export const mergeAt = (sheet,row,col) => (sheet.merges||[]).find(range=>row>=range.top&&row<=range.bottom&&col>=range.left&&col<=range.right) || null;
export function cellAnchor(sheet,row,col) {const merge=mergeAt(sheet,row,col);return merge?{row:merge.top,col:merge.left}:{row,col};}
export function cleanMerges(source,rows,cols) {
  const result=[];
  for(const raw of Array.isArray(source)?source.slice(0,2000):[]){if(!raw||!['top','bottom','left','right'].every(key=>Number.isInteger(raw[key])))continue;const {top,bottom,left,right}=raw;if(top<0||left<0||bottom<top||right<left||bottom>=rows||right>=cols||top===bottom&&left===right)continue;const range={top,bottom,left,right};if(!result.some(other=>intersects(other,range)))result.push(range);}
  return result;
}
export function expandMergedSelection(sheet,selection) {
  const range={top:Math.min(selection.anchor.row,selection.focus.row),bottom:Math.max(selection.anchor.row,selection.focus.row),left:Math.min(selection.anchor.col,selection.focus.col),right:Math.max(selection.anchor.col,selection.focus.col)};
  let changed=true;while(changed){changed=false;for(const merge of sheet.merges||[]){if(!intersects(range,merge))continue;const next={top:Math.min(range.top,merge.top),bottom:Math.max(range.bottom,merge.bottom),left:Math.min(range.left,merge.left),right:Math.max(range.right,merge.right)};if(Object.keys(range).some(key=>range[key]!==next[key])){Object.assign(range,next);changed=true;}}}
  return {anchor:{row:range.top,col:range.left},focus:{row:range.bottom,col:range.right}};
}
export function gridlineColor(first,second='#ffffff') {
  const color=value=>/^#[\da-f]{6}$/i.test(value||'')?value.toLowerCase():'#ffffff';
  first=color(first);second=color(second);
  if(first==='#ffffff'&&second==='#ffffff')return '#e2e3e3';
  const rgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
  const a=rgb(first==='#ffffff'?second:first),b=rgb(second==='#ffffff'?first:second);
  return '#'+a.map((channel,i)=>Math.round((channel+b[i])/2*.92).toString(16).padStart(2,'0')).join('');
}
