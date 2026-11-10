/* Skjer lokalt – programside for én by.
   Byen styres av <body data-by="kristiansand">, og dataene hentes fra /data/<by>.json.
   Datafilen skrives hver morgen av den planlagte oppgaven. */
(function(){
const OSLO='Europe/Oslo';
const BY=document.body.dataset.by;
/* Ett filter kan dekke flere kategorier i dataene: Musikk = konsert + klassisk. */
const CATS=[['musikk','Musikk',['konsert','klassisk']],['scene','Teater og scene'],['humor','Humor'],['familie','Barn og familie'],['jul','Jul'],['marked','Marked'],['sport','Sport'],['annet','Annet']];
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
  if(S.q){const h=[e.tittel,e.beskrivelse,e.sted].join(' ').toLowerCase();if(!h.includes(S.q))return false}
  return true;
}
function render(){
  renderPeriods();renderCal();renderList();
  const dirty=S.period!=='alle'||S.day||S.cats.size||S.q||S.free||S.hideSold||S.onlyConf;
  $('reset').hidden=!dirty;
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
  return `<article class="row"><div class="times">${times}</div><div class="info"><h3>${title}</h3><p class="meta">${esc(e.sted||'Sted ikke oppgitt')}${e.beskrivelse?' · '+esc(e.beskrivelse):''}</p><div class="tags">${tags.join('')}</div></div></article>`;
}
function renderList(){
  if(!S.data)return;
  const [from,to]=periodRange();
  const groups={};let n=0;
  for(const e of S.data.arrangementer||[]){
    if(!passes(e)||endOf(e)<from||e.dato>to)continue;
    const d=e.dato<from?from:e.dato;(groups[d]=groups[d]||[]).push(e);n++;
  }
  $('count').textContent=n===1?'1 arrangement':`${n} arrangementer`;
  const days=Object.keys(groups).sort();
  if(!days.length){
    $('list').innerHTML='<p class="notice">Ingen arrangementer passer med disse filtrene. Velg en annen periode, eller nullstill filtrene.</p>';
    return;
  }
  const first=e=>e.tider?.[0]?.kl||'99';
  $('list').innerHTML=days.map(d=>`<section><h2 class="dayhead">${esc(longDay(d))}<small>uke ${isoWeek(d)}</small></h2>${groups[d].sort((a,b)=>first(a).localeCompare(first(b))).map(rowHtml).join('')}</section>`).join('');
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
function fail(msg){$('stamp').textContent='';$('count').textContent='';$('list').innerHTML=`<p class="notice">${esc(msg)}</p>`}

$('cats').innerHTML=CATS.map(([k,l])=>`<button type="button" class="chip" data-c="${k}" aria-pressed="false">${l}</button>`).join('');
$('periods').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;S.period=b.dataset.p;S.day=null;render()});
$('cal').addEventListener('click',e=>{const b=e.target.closest('[data-d]');if(!b||b.disabled)return;S.day=S.day===b.dataset.d?null:b.dataset.d;render()});
$('cats').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;const c=b.dataset.c;S.cats.has(c)?S.cats.delete(c):S.cats.add(c);b.setAttribute('aria-pressed',S.cats.has(c));render()});
$('q').addEventListener('input',e=>{S.q=e.target.value.trim().toLowerCase();render()});
$('f-free').addEventListener('change',e=>{S.free=e.target.checked;render()});
$('f-sold').addEventListener('change',e=>{S.hideSold=e.target.checked;render()});
$('f-conf').addEventListener('change',e=>{S.onlyConf=e.target.checked;render()});
$('more').addEventListener('click',e=>{const o=$('extra').classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',o)});
$('reset').addEventListener('click',()=>{Object.assign(S,{period:'alle',day:null,q:'',free:false,hideSold:false,onlyConf:false});S.cats.clear();
  $('q').value='';['f-free','f-sold','f-conf'].forEach(i=>$(i).checked=false);document.querySelectorAll('[data-c]').forEach(b=>b.setAttribute('aria-pressed','false'));render()});
render();

/* Datafilen hentes uten mellomlagring, slik at morgenens oppdatering vises med en gang. */
fetch(`../data/${encodeURIComponent(BY)}.json?v=${Date.now()}`,{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})
  .then(d=>{S.data=d;renderMeta();render()})
  .catch(()=>fail('Programmet kan ikke hentes akkurat nå. Prøv igjen om litt.'));
})();
