/* skjerlokalt.no – programside for én by.
   Byen styres av <body data-by="kristiansand">, og dataene hentes fra /data/<by>.json.
   Datafilen skrives hver morgen av den planlagte oppgaven. */
(function(){
const OSLO='Europe/Oslo';
const BY=document.body.dataset.by;
const ROOT=document.body.dataset.root||'../';
const NY=document.body.dataset.visning==='ny';
/* Ett filter kan dekke flere kategorier i dataene: Musikk = konsert + klassisk. */
const CATS=[['musikk','Musikk',['konsert','klassisk']],['scene','Teater og scene'],['humor','Humor'],['foredrag','Foredrag og debatt'],['kunst','Utstilling og kunst'],['film','Film'],['familie','Barn og familie'],['ungdom','Ungdom'],['moteplass','Møteplass'],['tur','Tur og friluft'],['jul','Jul'],['marked','Marked'],['mat','Mat og drikke'],['sport','Sport'],['spill','Spill og gaming'],['kirke','Kirke'],['annet','Annet']];
const CATMAP=Object.fromEntries(CATS.map(([k,,m])=>[k,m||[k]]));
const WD=['M','T','O','T','F','L','S'];
const TICKET={'få':'få billetter','utsolgt':'utsolgt','ved_døra':'billett ved døra','gratis':'gratis'};
const STATUS={ok:'OK',delvis:'Delvis',feilet:'Ikke lest'};
const S={data:null,period:'alle',day:null,cats:new Set(),q:'',free:false,hideSold:false,onlyConf:false};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:null;

/* Datoer regnes som rene kalenderdager i UTC, slik at sommertid ikke flytter dem. */
const toD=s=>new Date(s+'T00:00:00Z');
const toS=d=>d.toISOString().slice(0,10);
const add=(s,n)=>{const d=toD(s);d.setUTCDate(d.getUTCDate()+n);return toS(d)};
const todayS=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:OSLO}).format(new Date());
const dow=s=>(toD(s).getUTCDay()+6)%7; /* mandag = 0 */
function isoWeek(s){const d=toD(s);d.setUTCDate(d.getUTCDate()+3-dow(s));const y=new Date(Date.UTC(d.getUTCFullYear(),0,4));
  return 1+Math.round(((d-y)/864e5-3+((y.getUTCDay()+6)%7))/7)}
const fmt=(s,o)=>new Intl.DateTimeFormat('nb-NO',{timeZone:'UTC',...o}).format(toD(s));
const longDay=s=>{const t=fmt(s,{weekday:'long',day:'numeric',month:'long'});return t[0].toUpperCase()+t.slice(1)};
const shortDay=s=>fmt(s,{day:'numeric',month:'short'}).replace('.','');
const endOf=e=>e.slutt_dato||e.dato;

function periodRange(){
  const t=todayS();
  if(S.day) return [S.day,S.day];
  switch(S.period){
    case 'idag': return [t,t];
    case 'imorgen': return [add(t,1),add(t,1)];
    case 'helg':{const w=dow(t);return w===6?[t,t]:[add(t,Math.max(0,4-w)),add(t,6-w)]}
    case 'uke': return [t,add(t,6-dow(t))];
    default: return [t,add(t,S.data?.periode_dager||30)];
  }
}
const allSold=e=>e.tider?.length>0&&e.tider.every(x=>x.billett==='utsolgt');
function passes(e){
  if(S.cats.size){const want=[...S.cats].flatMap(k=>CATMAP[k]||[k]);if(!(e.kategorier||[]).some(c=>want.includes(c)))return false}
  if(S.free&&!e.gratis)return false;
  if(S.hideSold&&allSold(e))return false;
  if(S.onlyConf&&e.status==='må_sjekkes')return false;
  if(S.place){const p=placeOf(e);if(!p||p.navn!==S.place)return false}
  if(S.q){const h=[e.tittel,e.beskrivelse,e.sted].join(' ').toLowerCase();if(!h.includes(S.q))return false}
  return true;
}
function render(){
  renderPeriods();renderCal();renderList();renderPicks();if(S.view==='kart')renderMap();
  const dirty=S.period!=='alle'||S.day||S.cats.size||S.q||S.free||S.hideSold||S.onlyConf||S.place;
  $('reset').hidden=!dirty;
  $('placechip').hidden=!S.place;if(S.place)$('placechip').innerHTML=`Sted: ${esc(S.place)} <span aria-hidden="true">×</span>`;
}
function renderPeriods(){
  const P=[['alle','Alle'],['idag','I dag'],['imorgen','I morgen'],['helg','I helgen'],['uke','Denne uken']];
  $('periods').innerHTML=P.map(([k,l])=>`<button type="button" class="chip" data-p="${k}" aria-pressed="${!S.day&&S.period===k}">${l}</button>`).join('');
}
function renderCal(){
  const t=todayS(),span=S.data?.periode_dager||30,end=add(t,span);
  const evs=(S.data?.arrangementer||[]).filter(passes);
  const count={};
  for(const e of evs){let d=e.dato<t?t:e.dato;const stop=endOf(e);while(d<=stop&&d<=end){count[d]=(count[d]||0)+1;d=add(d,1)}}
  const max=Math.max(1,...Object.values(count));
  let html='<span></span>'+WD.map(w=>`<span class="hd">${w}</span>`).join('');
  let d=add(t,-dow(t));const last=add(end,6-dow(end));
  while(d<=last){
    if(dow(d)===0)html+=`<span class="wk" title="Uke ${isoWeek(d)}">${isoWeek(d)}</span>`;
    const n=count[d]||0,out=d<t||d>end;
    html+=`<button type="button" class="day${d===t?' today':''}" data-d="${d}" data-n="${n}" ${out?'disabled':''} aria-pressed="${S.day===d}" aria-label="${esc(longDay(d))}, ${n} arrangementer">${toD(d).getUTCDate()}<span class="bar"><i style="width:${Math.round(n/max*100)}%"></i></span></button>`;
    d=add(d,1);
  }
  $('cal').innerHTML=html;
}

/* «Legg i kalender»: Google-lenke og .ics-fil (Apple, Outlook m.fl.). Ingen data lagres. */
const BYNAVN={kristiansand:'Kristiansand'};
function osloToUtc(dato,kl){
  const [y,m,d]=dato.split('-').map(Number),[h,mi]=kl.split(':').map(Number);
  const guess=Date.UTC(y,m-1,d,h,mi);
  const pt=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:OSLO,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(guess)).map(x=>[x.type,x.value]));
  const asOslo=Date.UTC(+pt.year,+pt.month-1,+pt.day,+pt.hour,+pt.minute);
  return new Date(guess-(asOslo-guess));
}
const stamp=dt=>dt.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const ymd=s=>s.replace(/-/g,'');
/* Ett kalenderoppslag per klokkeslett; uten klokkeslett eller over flere dager blir det heldagsoppslag. */
function calSlots(e){
  const multi=e.slutt_dato&&e.slutt_dato!==e.dato;
  const kls=multi?[]:(e.tider||[]).map(x=>x.kl).filter(k=>/^\d\d:\d\d$/.test(k||''));
  if(!kls.length)return [{label:null,allDay:true,start:ymd(e.dato),end:ymd(add(endOf(e),1))}];
  return kls.map(kl=>{const st=osloToUtc(e.dato,kl);return {label:kl,allDay:false,start:stamp(st),end:stamp(new Date(st.getTime()+2*36e5))}});
}
function calText(e){
  const u=safeUrl(e.kilde_url),parts=[];
  if(e.beskrivelse)parts.push(e.beskrivelse);
  if(e.tider?.length>1)parts.push('Tider: '+e.tider.map(x=>x.kl).join(', '));
  if(e.pris)parts.push('Pris: '+e.pris);
  parts.push('Sluttid er ikke oppgitt. Sjekk alltid hos arrangøren før du drar.');
  if(u)parts.push('Mer info: '+u);
  parts.push('Fra skjerlokalt.no');
  return parts.join('\n');
}
const calLoc=e=>e.sted?`${e.sted}, ${BYNAVN[BY]||''}`.replace(/, $/,''):(BYNAVN[BY]||'');
function googleUrl(e,sl){
  const q=new URLSearchParams({action:'TEMPLATE',text:e.tittel,dates:`${sl.start}/${sl.end}`,details:calText(e),location:calLoc(e),ctz:OSLO});
  return 'https://calendar.google.com/calendar/render?'+q.toString();
}
const icsEsc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
function icsFold(line){const out=[];let l=line;while(l.length>73){out.push(l.slice(0,73));l=' '+l.slice(73)}out.push(l);return out.join('\r\n')}
function icsFile(e,sl){
  const u=safeUrl(e.kilde_url);
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//skjerlokalt.no//NO','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${e.id}${sl.label?'-'+sl.label.replace(':',''):''}@skjerlokalt.no`,`DTSTAMP:${stamp(new Date())}`,
    sl.allDay?`DTSTART;VALUE=DATE:${sl.start}`:`DTSTART:${sl.start}`,sl.allDay?`DTEND;VALUE=DATE:${sl.end}`:`DTEND:${sl.end}`,
    `SUMMARY:${icsEsc(e.tittel)}`,`LOCATION:${icsEsc(calLoc(e))}`,`DESCRIPTION:${icsEsc(calText(e))}`];
  if(u)L.push(`URL:${u}`);
  L.push('BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEsc(e.tittel)}`,'TRIGGER:-P1D','END:VALARM','END:VEVENT','END:VCALENDAR');
  return L.map(icsFold).join('\r\n')+'\r\n';
}
function calMenu(e){
  if(e.status==='avlyst')return '';
  const slots=calSlots(e),many=slots.length>1;
  const items=slots.map((sl,i)=>{const lbl=many?` kl. ${esc(sl.label)}`:'';
    return `<a href="${esc(googleUrl(e,sl))}" target="_blank" rel="noopener">Google Kalender${lbl}</a><button type="button" data-ics="${esc(e.id)}" data-slot="${i}">Apple, Outlook og andre${lbl}</button>`}).join('');
  return `<details class="addcal"><summary>Legg i kalender</summary><div class="calmenu">${items}<small>Apple og Outlook gir påminnelse dagen før.</small></div></details>`;
}
function downloadIcs(id,slot){
  const e=(S.data?.arrangementer||[]).find(x=>x.id===id);if(!e)return;
  const sl=calSlots(e)[+slot||0];
  const blob=new Blob([icsFile(e,sl)],{type:'text/calendar;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=(e.tittel||'arrangement').toLowerCase().normalize('NFKD').replace(/[^\w]+/g,'-').replace(/^-|-$/g,'').slice(0,50)+'.ics';
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
}
/* Ny visning: farge og ikon per kategori, datolapp og «Ikke gå glipp av». Styres av <body data-visning="ny">. */
const CATKEY={};CATS.forEach(([k,,m])=>(m||[k]).forEach(c=>CATKEY[c]=k));
const ORDER=['jul','kirke','mat','spill','ungdom','familie','sport','film','kunst','foredrag','tur','moteplass','marked','humor','scene','musikk','annet'];
function catOf(e){const ks=(e.kategorier||[]).map(c=>CATKEY[c]||'annet');for(const k of ['musikk','scene','humor','foredrag','kunst','film','sport','mat','spill','tur','moteplass','marked','familie','ungdom','kirke','jul'])if(ks.includes(k))return k;return ks[0]||'annet'}
const CATLABEL=Object.fromEntries(CATS.map(([k,l])=>[k,l]));
const IC={
 musikk:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
 scene:'<path d="M4 4h16v6a8 8 0 0 1-16 0z"/><path d="M9 9h.01M15 9h.01M9 13c1.5 1.5 4.5 1.5 6 0"/>',
 humor:'<circle cx="12" cy="12" r="9"/><path d="M8 14c2 2.5 6 2.5 8 0M9 9h.01M15 9h.01"/>',
 foredrag:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 kunst:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>',
 film:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
 familie:'<circle cx="8" cy="6" r="2.5"/><circle cx="16.5" cy="9" r="2"/><path d="M4 21v-6a4 4 0 0 1 8 0v6M13.5 21v-4a3 3 0 0 1 6 0v4"/>',
 ungdom:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
 moteplass:'<path d="M4 5h11v8H8l-4 3z"/><path d="M15 9h5v8l-3-2h-6v-2"/>',
 tur:'<path d="m3 20 6-11 4 7 2-3 6 7z"/><circle cx="17" cy="6" r="2"/>',
 jul:'<path d="m12 2 2.5 5 5.5.8-4 3.9.9 5.5L12 14.6 7.1 17.2l.9-5.5-4-3.9 5.5-.8z"/>',
 marked:'<path d="M3 9h18l-2-5H5zM5 9v11h14V9M9 20v-6h6v6"/>',
 mat:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6v3h3v9"/>',
 sport:'<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/>',
 spill:'<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5M15 11h.01M18 13h.01"/>',
 kirke:'<path d="M12 2v6M9 5h6M5 22V12l7-4 7 4v10M10 22v-5h4v5"/>',
 annet:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>'};
const icon=k=>`<svg class="cic" viewBox="0 0 24 24" aria-hidden="true">${IC[k]||IC.annet}</svg>`;
function pickReason(e,t){
  if(e.tider?.some(x=>x.billett==='få'))return 'Få billetter igjen';
  const w=dow(e.dato);if(w>=4&&e.dato<=add(t,7))return w===4?'Fredag':w===5?'Lørdag':'Søndag';
  if(e.gratis&&(e.kategorier||[]).includes('familie'))return 'Gratis for familien';
  return null;
}
function renderPicks(){
  const box=$('picks');if(!NY||!box||!S.data)return;
  const t=todayS(),A=S.data.arrangementer||[],count={};A.forEach(e=>{count[e.tittel]=(count[e.tittel]||0)+1});
  const cand=A.filter(e=>e.dato>=t&&e.dato<=add(t,10)&&e.status==='bekreftet'&&!allSold(e)&&count[e.tittel]<=2)
    .map(e=>({e,r:pickReason(e,t),s:(e.tider?.some(x=>x.billett==='få')?3:0)+(dow(e.dato)>=4?2:0)+(e.gratis&&(e.kategorier||[]).includes('familie')?2:0)}))
    .filter(x=>x.r).sort((a,b)=>b.s-a.s||sortKey(a.e).localeCompare(sortKey(b.e)));
  const seen=new Set(),out=[];for(const x of cand){const k=catOf(x.e);if(seen.has(k)&&out.length<4)continue;seen.add(k);out.push(x);if(out.length>=6)break}
  if(!out.length){box.hidden=true;return}
  box.hidden=false;
  box.innerHTML=`<h2 class="lbl">Ikke gå glipp av</h2><div class="picks">${out.map(({e,r})=>{const k=catOf(e),u=safeUrl(e.kilde_url);
    return `<a class="pick" data-cat="${k}" ${u?`href="${esc(u)}" target="_blank" rel="noopener"`:''}><span class="pband">${icon(k)}<span>${esc(CATLABEL[k]||'')}</span></span>
      <span class="pwhy">${esc(r)}</span><strong>${esc(e.tittel)}</strong><span class="pmeta">${esc(fmt(e.dato,{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,''))}${firstKl(e)?' · '+esc(firstKl(e)):''}</span><span class="pmeta">${esc((e.sted||'').split(' · ')[0])}</span></a>`}).join('')}</div>
    <p class="calnote">Valgt automatisk etter faste regler: få billetter igjen, helg og gratis for familien.</p>`;
}
function dayHead(d){
  if(!NY)return `<h2 class="dayhead">${esc(longDay(d))}<small>uke ${isoWeek(d)}</small></h2>`;
  const wd=fmt(d,{weekday:'short'}).replace('.',''),mo=fmt(d,{month:'short'}).replace('.','');
  return `<h2 class="dayhead tile"><span class="dt"><small>${esc(wd)}</small><b>${toD(d).getUTCDate()}</b><small>${esc(mo)}</small></span><span>${esc(longDay(d))}<small>uke ${isoWeek(d)}</small></span></h2>`;
}
function rowHtml(e){
  const url=safeUrl(e.kilde_url),off=e.status==='avlyst',unconf=e.status==='må_sjekkes';
  let times;
  if(e.slutt_dato&&e.slutt_dato!==e.dato) times=`<span class="na">${esc(shortDay(e.dato))}–${esc(shortDay(e.slutt_dato))}</span>`;
  else if(e.tider?.length) times=e.tider.map(x=>`<span class="t ${esc(x.billett||'')}"><b>${esc(x.kl)}</b>${TICKET[x.billett]&&x.billett!=='gratis'?`<small>${esc(TICKET[x.billett])}</small>`:''}</span>`).join('');
  else times='<span class="na">Tid ikke oppgitt</span>';
  const tags=[];
  if(off)tags.push('<span class="pill off">Avlyst</span>');
  if(unconf)tags.push('<span class="pill check-it" title="Funnet på en samleside, ikke hos arrangøren">Sjekk hos arrangør</span>');
  if(e.gratis)tags.push('<span class="pill free">Gratis</span>');
  if(e.pris)tags.push(`<span>${esc(e.pris)}</span>`);
  if(e.aldersgruppe==='senior')tags.push('<span>For seniorer</span>');
  if(e.aldersgruppe==='baby')tags.push('<span>For babyer</span>');
  if(unconf&&url)tags.push(`<a class="srclink" href="${esc(url)}" target="_blank" rel="noopener">Ikke bekreftet – se kilde (${esc(e.kilde_navn||'ukjent')})</a>`);
  else tags.push(`<span>Kilde: ${esc(e.kilde_navn||'ukjent')}</span>`);
  const title=url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(e.tittel)}</a>`:esc(e.tittel);
  const ck=catOf(e);
  return `<article class="row" data-cat="${ck}"><div class="times">${times}</div><div class="info">${NY?`<span class="ctag">${icon(ck)}${esc(CATLABEL[ck]||'')}</span>`:''}<h3>${title}</h3><p class="meta">${esc(e.sted||'Sted ikke oppgitt')}${e.beskrivelse?' · '+esc(e.beskrivelse):''}</p><div class="tags">${tags.join('')}${calMenu(e)}</div></div></article>`;
}
function renderList(){
  if(!S.data)return;
  const [from,to]=periodRange();
  const groups={};let n=0;S.shown=[];
  for(const e of S.data.arrangementer||[]){
    if(!passes(e)||endOf(e)<from||e.dato>to)continue;
    const d=e.dato<from?from:e.dato;(groups[d]=groups[d]||[]).push(e);n++;S.shown.push(e);
  }
  $('count').textContent=n===1?'1 arrangement':`${n} arrangementer`;
  const days=Object.keys(groups).sort();
  if(!days.length){
    $('list').innerHTML='<p class="notice">Ingen arrangementer passer med disse filtrene. Velg en annen periode, eller nullstill filtrene.</p>';
    return;
  }
  const first=e=>e.tider?.[0]?.kl||'99';
  $('list').innerHTML=days.map(d=>`<section>${dayHead(d)}${groups[d].sort((a,b)=>first(a).localeCompare(first(b))).map(rowHtml).join('')}</section>`).join('');
}
function renderMeta(){
  const D=S.data,up=D.oppdatert?new Date(D.oppdatert):null;
  if(up&&!isNaN(up)){
    const txt=new Intl.DateTimeFormat('nb-NO',{timeZone:OSLO,day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(up);
    const stale=Date.now()-up>36*36e5;
    $('stamp').innerHTML=`Program for de neste ${D.periode_dager||30} dagene. Oppdatert ${esc(txt)}.`+(stale?' <span class="stale">Oversikten kan være utdatert.</span>':'');
  }
  const r=D.rapport||{};
  $('report').textContent=`Siste oppdatering: ${r.nye??0} nye, ${r.endrede??0} endrede og ${r.avlyste??0} avlyste. ${r.sammendrag||''}`;
  $('srcs').innerHTML=(D.kilder||[]).map(k=>{const u=safeUrl(k.url);return `<tr><td>${u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k.navn)}</a>`:esc(k.navn)}</td><td class="st-${esc(k.status)}">${esc(STATUS[k.status]||k.status)}</td><td class="n">${esc(k.antall??'')}</td><td>${esc(k.merknad||'')}</td></tr>`}).join('');
  $('about').hidden=false;
}
/* ---- Kart ----
   Stedene slås opp i data/steder-<by>.json: {"Kilden":{"lat":..,"lon":..}, ...}.
   Et sted som «Kilden · Konsertsalen» eller «Blå Kors, Posebyen» faller tilbake på navnet før skilletegnet.
   Kartgrunnlag: Kartverket (fargekart). Merker som ligger tett, samles (Leaflet.markercluster). */
let MAP=null,LAYER=null;
function placeOf(e){
  const P=S.steder||{},s=(e.sted||'').trim();if(!s)return null;
  for(const k of [s,s.split(' · ')[0],s.split(',')[0],s.replace(/\s*\(.*?\)\s*/g,' ').split(',')[0]]){const v=P[k.trim()];if(v&&typeof v.lat==='number')return {navn:k.trim(),...v}}
  return null;
}
const firstKl=e=>e.tider?.[0]?.kl||'';
const sortKey=e=>e.dato+(firstKl(e)||'99');
function popupHtml(p,ev){
  const t=todayS();
  const up=ev.filter(e=>endOf(e)>=t&&e.status!=='avlyst');
  const next=up[0]||ev[0];
  const line=e=>{const u=safeUrl(e.kilde_url);const kl=firstKl(e)?` kl. ${esc(firstKl(e))}`:'';
    const ti=u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(e.tittel)}</a>`:esc(e.tittel);
    return `<span class="pd">${esc(longDay(e.dato<t?t:e.dato))}${kl}</span>${ti}${e.status==='avlyst'?' <em>(avlyst)</em>':''}`};
  const rest=ev.filter(e=>e!==next);
  const rows=rest.slice(0,5).map(e=>`<li>${line(e)}</li>`).join('');
  const more=rest.length>5?`<p class="pmore">+ ${rest.length-5} til</p>`:'';
  const dir=`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
  return `<div class="pop"><strong class="pname">${esc(p.navn)}</strong>
    <p class="pcount">${ev.length===1?'1 arrangement':ev.length+' arrangementer'} i valgt periode</p>
    <div class="pnext"><span class="plbl">Neste</span>${line(next)}</div>
    ${rows?`<ul>${rows}</ul>`:''}${more}
    <div class="pbtns"><button type="button" class="pbtn" data-place="${esc(p.navn)}">Vis i listen</button>
    <a class="pbtn ghost" href="${esc(dir)}" target="_blank" rel="noopener">Vis vei ↗</a></div></div>`;
}
function renderMap(){
  if(!window.L||!S.data)return;
  if(!MAP){
    MAP=L.map('map',{scrollWheelZoom:false,zoomControl:true}).setView([58.146,7.995],13);
    L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
      {maxZoom:18,attribution:'&copy; <a href="https://www.kartverket.no/" target="_blank" rel="noopener">Kartverket</a>'}).addTo(MAP);
    LAYER=(L.markerClusterGroup?L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:42,spiderfyOnMaxZoom:true,
      iconCreateFunction:c=>{const n=c.getAllChildMarkers().reduce((a,m)=>a+(m.options.count||1),0);
        return L.divIcon({className:'pin cluster',html:`<span>${n}</span>`,iconSize:[38,38],iconAnchor:[19,19]})}}):L.layerGroup()).addTo(MAP);
    MAP.on('dragstart',()=>{S.mapMoved=true});
    const All=L.Control.extend({options:{position:'topright'},onAdd(){const b=L.DomUtil.create('button','mapbtn');b.type='button';b.textContent='Hele kommunen';
      L.DomEvent.on(b,'click',ev=>{L.DomEvent.stop(ev);if(S.mapPts?.length){S.mapMoved=true;MAP.fitBounds(S.mapPts,{padding:[30,30],maxZoom:15})}});return b}});
    new All().addTo(MAP);
  }
  LAYER.clearLayers();
  const byPlace={};let missing=0;
  for(const e of S.shown||[]){const p=placeOf(e);if(!p){missing++;continue}(byPlace[p.navn]=byPlace[p.navn]||{p,ev:[]}).ev.push(e)}
  const pts=[];
  for(const {p,ev} of Object.values(byPlace)){
    ev.sort((a,b)=>sortKey(a).localeCompare(sortKey(b)));
    const icon=L.divIcon({className:'pin',html:`<span>${ev.length}</span>`,iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-14]});
    L.marker([p.lat,p.lon],{icon,count:ev.length,title:`${p.navn}: ${ev.length} arrangementer`,keyboard:true})
      .bindPopup(popupHtml(p,ev),{maxWidth:300,minWidth:240}).addTo(LAYER);
    pts.push([p.lat,p.lon]);
  }
  $('mapnote').textContent=missing?`${missing} ${missing===1?'arrangement':'arrangementer'} mangler kartposisjon og vises bare i listen.`:'';
  S.mapPts=pts;
  /* Først vises sentrum, der det meste skjer. «Hele kommunen» zoomer ut til alle stedene. */
  if(!S.mapMoved){const near=pts.filter(([a,b])=>Math.abs(a-58.146)<.012&&Math.abs(b-7.996)<.02);
    if(S.place&&pts.length)MAP.setView(pts[0],16);
    else if(near.length)MAP.fitBounds(near,{padding:[40,40],maxZoom:16});else if(pts.length)MAP.fitBounds(pts,{padding:[30,30],maxZoom:15})}
  setTimeout(()=>MAP.invalidateSize(),0);
}
function setView(v){
  S.view=v;const map=v==='kart';
  $('list').hidden=map;$('mapwrap').hidden=!map;
  $('v-list').setAttribute('aria-selected',!map);$('v-map').setAttribute('aria-selected',map);
  try{history.replaceState(null,'',map?'#kart':location.pathname)}catch(e){}
  if(map)renderMap();
}
function fail(msg){$('stamp').textContent='';$('count').textContent='';$('list').innerHTML=`<p class="notice">${esc(msg)}</p>`}

try{const k=new URLSearchParams(location.search).get('kat');if(k&&CATMAP[k])S.cats.add(k)}catch(e){}
$('cats').innerHTML=CATS.map(([k,l])=>`<button type="button" class="chip" data-c="${k}" aria-pressed="${S.cats.has(k)}">${l}</button>`).join('');
$('periods').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;S.period=b.dataset.p;S.day=null;render()});
$('cal').addEventListener('click',e=>{const b=e.target.closest('[data-d]');if(!b||b.disabled)return;S.day=S.day===b.dataset.d?null:b.dataset.d;render()});
$('cats').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;const c=b.dataset.c;S.cats.has(c)?S.cats.delete(c):S.cats.add(c);b.setAttribute('aria-pressed',S.cats.has(c));render()});
$('q').addEventListener('input',e=>{S.q=e.target.value.trim().toLowerCase();render()});
$('f-free').addEventListener('change',e=>{S.free=e.target.checked;render()});
$('f-sold').addEventListener('change',e=>{S.hideSold=e.target.checked;render()});
$('f-conf').addEventListener('change',e=>{S.onlyConf=e.target.checked;render()});
$('more').addEventListener('click',e=>{const o=$('extra').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o)});
$('reset').addEventListener('click',()=>{Object.assign(S,{period:'alle',day:null,q:'',free:false,hideSold:false,onlyConf:false,place:null,mapMoved:false});S.cats.clear();
  $('q').value='';['f-free','f-sold','f-conf'].forEach(i=>$(i).checked=false);document.querySelectorAll('[data-c]').forEach(b=>b.setAttribute('aria-pressed','false'));render()});
$('v-list').addEventListener('click',()=>setView('liste'));
/* Kalendermenyen: .ics-nedlasting, og lukk åpne menyer ved klikk utenfor. */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ics]');if(b){downloadIcs(b.dataset.ics,b.dataset.slot);b.closest('details').open=false;return}
  document.querySelectorAll('details.addcal[open]').forEach(d=>{if(!d.contains(e.target))d.open=false});
});
/* «Vis i listen» i et kartmerke filtrerer listen på det stedet. */
document.addEventListener('click',e=>{const b=e.target.closest('[data-place]');if(!b)return;S.place=b.dataset.place;MAP&&MAP.closePopup();setView('liste');render();scrollTo({top:$('list').getBoundingClientRect().top+scrollY-80,behavior:'smooth'})});
$('placechip').addEventListener('click',()=>{S.place=null;S.mapMoved=false;render()});
$('v-map').addEventListener('click',()=>setView('kart'));
addEventListener('hashchange',()=>setView(location.hash==='#kart'?'kart':'liste'));
render();
if(location.hash==='#kart')setView('kart');

fetch(`${ROOT}data/steder-${encodeURIComponent(BY)}.json?v=${Date.now()}`,{cache:'no-store'})
  .then(r=>r.ok?r.json():{}).then(p=>{S.steder=p;if(S.view==='kart')renderMap()}).catch(()=>{S.steder={}});

/* Datafilen hentes uten mellomlagring, slik at morgenens oppdatering vises med en gang. */
fetch(`${ROOT}data/${encodeURIComponent(BY)}.json?v=${Date.now()}`,{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})
  .then(d=>{S.data=d;renderMeta();render()})
  .catch(()=>fail('Programmet kan ikke hentes akkurat nå. Prøv igjen om litt.'));
})();
