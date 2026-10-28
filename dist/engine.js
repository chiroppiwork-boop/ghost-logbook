/* Ghost Logbook. Original MIT code. Isolation path-length formula follows
 * scikit-learn's BSD-3-Clause implementation; see THIRD_PARTY_NOTICES.txt. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GhostEngine=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const headers=['timestamp','source','event','duration_ms','payload_kb','status'];
 function parseCsv(text){
  if(new TextEncoder().encode(text).length>1024*1024)throw Error('CSV is larger than 1 MB.');
  text=text.replace(/^\uFEFF/,'');let grid=[],row=[],field='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
   else if(c==='"'){if(field||closed)throw Error('Unexpected quote in CSV.');quoted=true;}
   else if(c===','){row.push(field);field='';closed=false;}
   else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(z=>z!==''))grid.push(row);row=[];field='';closed=false;}
   else{if(closed)throw Error('Unexpected text after a closing quote.');field+=c;}
  }
  if(quoted)throw Error('Unclosed quoted field.');
  row.push(field);if(row.some(z=>z!==''))grid.push(row);
  if(grid.length<2)throw Error('Add a header and at least one record.');
  const head=grid.shift();if(head.length!==6||head.some((z,i)=>z!==headers[i]))throw Error('Use the six required columns in the documented order.');
  if(grid.length>2000)throw Error('Use at most 2,000 records.');
  return grid.map((values,i)=>{
   if(values.length!==6)throw Error('Record '+(i+1)+' has the wrong number of columns.');
   const r=Object.fromEntries(headers.map((k,j)=>[k,values[j]]));
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(r.timestamp)||!Number.isFinite(Date.parse(r.timestamp)))throw Error('Record '+(i+1)+': use an ISO timestamp with timezone.');
   // Reject impossible dates instead of accepting Date's calendar rollover.
   const day=Number(r.timestamp.slice(8,10)),month=Number(r.timestamp.slice(5,7)),year=Number(r.timestamp.slice(0,4));
   const leap=year%4===0&&(year%100!==0||year%400===0),days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
   if(month<1||month>12||day<1||day>days[month-1]||Number(r.timestamp.slice(11,13))>23||Number(r.timestamp.slice(14,16))>59||Number(r.timestamp.slice(17,19))>59)throw Error('Record '+(i+1)+': invalid calendar date or time.');
   if(!r.source||!r.event||r.source.length>120||r.event.length>120)throw Error('Record '+(i+1)+': source/event must be 1–120 characters.');
   for(const k of ['duration_ms','payload_kb']){if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(r[k])||!Number.isFinite(Number(r[k]))||Number(r[k])>1e9)throw Error('Record '+(i+1)+': '+k+' must be a non-negative number up to 1e9.');r[k]=Number(r[k]);}
   if(!['ok','error'].includes(r.status))throw Error('Record '+(i+1)+': status must be ok or error.');
   return r;
  });
 }
 function features(r,m){const d=new Date(r.timestamp),hour=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600;
  const p=(map,key)=>Object.prototype.hasOwnProperty.call(map,key)?map[key]:m.unknownFrequency;
  return [Math.log1p(r.duration_ms),Math.log1p(r.payload_kb),Math.sin(hour*Math.PI*2/24),Math.cos(hour*Math.PI*2/24),-Math.log(p(m.sourceProbabilities,r.source)),-Math.log(p(m.eventProbabilities,r.event)),r.status==='error'?1:0].map(Math.fround);
 }
 function averagePath(n){return n<=1?0:n===2?1:2*(Math.log(n-1)+0.5772156649015329)-2*(n-1)/n;}
 function scoreVector(v,m){let total=0;for(const t of m.trees){let node=0,depth=0;while(t.left[node]!==-1){node=v[t.feature[node]]<=t.threshold[node]?t.left[node]:t.right[node];depth++;}total+=depth+averagePath(t.samples[node]);}return Math.pow(2,-total/(m.trees.length*averagePath(m.maxSamples)));}
 function reasons(r,m,v){
  const out=[];
  if(r.duration_ms>Math.expm1(m.featureMedian[0]))out.push({weight:Math.abs(v[0]-m.featureMedian[0])/Math.max(m.featureIqr[0],.01),text:'Duration '+r.duration_ms.toLocaleString('en-US')+' ms; fictional training median '+Math.round(Math.expm1(m.featureMedian[0]))+' ms.'});
  if(r.payload_kb>Math.expm1(m.featureMedian[1]))out.push({weight:Math.abs(v[1]-m.featureMedian[1])/Math.max(m.featureIqr[1],.01),text:'Payload '+r.payload_kb.toLocaleString('en-US')+' KB; fictional training median '+Math.round(Math.expm1(m.featureMedian[1]))+' KB.'});
  if(!Object.prototype.hasOwnProperty.call(m.sourceProbabilities,r.source))out.push({weight:5,text:'Source is absent from the fictional training vocabulary.'});
  if(!Object.prototype.hasOwnProperty.call(m.eventProbabilities,r.event))out.push({weight:5,text:'Event is absent from the fictional training vocabulary.'});
  const d=new Date(r.timestamp),h=d.getUTCHours()+d.getUTCMinutes()/60;
  if(h<8.5||h>17.5)out.push({weight:4,text:'UTC time is outside the fictional baseline\'s 08:30–17:30 range.'});
  if(r.status==='error')out.push({weight:3,text:'Status differs from the fictional baseline, which contains only ok events.'});
  out.sort((a,b)=>b.weight-a.weight);return out.length?out.slice(0,3).map(z=>z.text):['No large named departure. The score also reflects combinations of learned features.'];
 }
 function analyze(text,m){return parseCsv(text).map((record,index)=>{const v=features(record,m),score=scoreVector(v,m);return {index,record,score,flagged:score>m.flagThreshold,reasons:reasons(record,m,v)};});}
 function safeCell(v){let s=String(v);if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 function reportCsv(rows){return ['record,timestamp,source,event,duration_ms,payload_kb,status,anomaly_score,flagged,notes',...rows.map(r=>[r.index+1,r.record.timestamp,r.record.source,r.record.event,r.record.duration_ms,r.record.payload_kb,r.record.status,r.score.toFixed(8),r.flagged?'review':'not_flagged',r.reasons.join(' | ')].map(safeCell).join(','))].join('\r\n');}
 return {parseCsv,features,averagePath,scoreVector,analyze,reportCsv,safeCell,headers};
});
