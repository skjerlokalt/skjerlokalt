/* skjerlokalt.no – bydelsside: katalog over lag og møteplasser, arrangementer i bydelen og innmelding.
   Bydelen styres av <body data-bydel="randesund">. Katalogen ligger i /data/katalog-<bydel>.json. */
(function(){
const BYDEL=document.body.dataset.bydel;
const MOTTAKER='skjerlokalt@gmail.com';
/* Steder som regnes til bydelen når arrangementer fra bykalenderen plukkes ut. */
const STEDER={randesund:/\b(Søm|Randesund|Strømme|Dvergsnes|Frikstad|Holte|Sukkevann|Korsvik|Tømmerstø|Rona|Odderhei|Kvarenes|Rabbersvik|Midgard)\b/i};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u||'')?u:null;
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(new Date());
const dayTxt=s=>{const t=new Intl.DateTimeFormat('nb-NO',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'}).format(new Date(s+'T00:00:00Z'));return t.replace(/\./g,'')};
let K=null,cat='alle';

/* Arrangementer i bydelen, hentet fra bykalenderen */
fetch('../../data/kristiansand.json?v='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(D=>{
  const re=STEDER[BYDEL];
  const ev=(D.arrangementer||[]).filter(e=>(e.slutt_dato||e.dato)>=today&&e.status!=='avlyst'&&re&&re.test(e.sted||''))
    .sort((a,b)=>(a.dato+(a.tider?.[0]?.kl||'99')).localeCompare(b.dato+(b.tider?.[0]?.kl||'99')));
  if(!ev.length){$('events').innerHTML='<p class="calnote">Ingen arrangementer i bydelen de neste 30 dagene akkurat nå. Se <a href="../">hele kalenderen for Kristiansand</a>.</p>';return}
  const shown=ev.slice(0,8);
  $('events').innerHTML='<ul class="evlist">'+shown.map(e=>{const u=safeUrl(e.kilde_url),kl=e.tider?.[0]?.kl;
    return `<li><span class="evday">${esc(dayTxt(e.dato))}${kl?` · ${esc(kl)}`:''}</span><span class="evname">${u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(e.tittel)}</a>`:esc(e.tittel)}</span><span class="evplace">${esc(e.sted||'')}${e.status==='må_sjekkes'?' · <em>sjekk hos arrangør</em>':''}</span></li>`}).join('')+'</ul>'
    +`<p class="calnote">${ev.length>shown.length?`${ev.length} arrangementer i bydelen. `:''}<a href="../">Se hele kalenderen for Kristiansand</a>.</p>`;
}).catch(()=>{$('events').innerHTML='<p class="calnote">Klarte ikke å hente arrangementene akkurat nå. <a href="../">Se kalenderen for Kristiansand</a>.</p>'});

/* Katalogen */
fetch(`../../data/katalog-${BYDEL}.json?v=`+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(d=>{K=d;
  $('kf-kat').innerHTML=Object.values(K.kategorier).map(c=>`<option>${esc(c)}</option>`).join('');
  chips();draw();
}).catch(()=>{$('kgrid').innerHTML='<p class="notice">Klarte ikke å hente katalogen akkurat nå.</p>'});

function chips(){
  const all=[['alle','Alle'],...Object.entries(K.kategorier)];
  $('kchips').innerHTML=all.map(([k,l])=>{const n=k==='alle'?K.aktorer.length:K.aktorer.filter(a=>a.k===k).length;
    return `<button type="button" class="chip" data-k="${k}" aria-pressed="${cat===k}">${esc(l)} <span class="n">${n}</span></button>`}).join('');
}
function draw(){
  const q=$('kq').value.trim().toLowerCase();
  const list=K.aktorer.filter(a=>(cat==='alle'||a.k===cat)&&[a.n,a.d,a.o,K.kategorier[a.k]].join(' ').toLowerCase().includes(q))
    .sort((a,b)=>a.n.localeCompare(b.n,'nb'));
  $('kcount').textContent=list.length===1?'1 aktør':`${list.length} aktører`;
  if(!list.length){
    $('kgrid').innerHTML=cat==='firma'&&!q
      ?'<p class="notice">Ingen lokale firmaer er meldt inn ennå. Firmaer med virksomhet i Randesund kan <a href="#meld-inn">melde seg inn gratis</a>, og alle vurderes etter de samme kriteriene.</p>'
      :'<p class="notice">Ingen treff. Kjenner du noen som burde stå her? <a href="#meld-inn">Meld dem inn</a>.</p>';
    return;
  }
  $('kgrid').innerHTML=list.map(a=>{const u=safeUrl(a.u);
    const links=[u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(a.ul||'Nettside')} ↗</a>`:'',a.e?`<a href="mailto:${esc(a.e)}">E-post</a>`:''].filter(Boolean).join('');
    return `<article class="kcard"><div class="kmeta"><span class="tag">${esc(K.kategorier[a.k]||'')}</span><span class="karea">${esc(a.o||'')}</span></div>
      <h3>${esc(a.n)}</h3><p>${esc(a.d)}</p>
      <div class="klinks">${links||`<span class="missing">Lenke mangler. <button type="button" data-claim="${esc(a.n)}">Er dette ditt lag?</button></span>`}</div></article>`}).join('');
}
$('kchips').addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;cat=b.dataset.k;chips();draw()});
$('kq').addEventListener('input',()=>K&&draw());
$('kgrid').addEventListener('click',e=>{const b=e.target.closest('[data-claim]');if(!b)return;
  const a=K.aktorer.find(x=>x.n===b.dataset.claim),f=$('kf');if(!a)return;
  f.elements.navn.value=a.n;f.elements.kategori.value=K.kategorier[a.k];f.elements.omrade.value=a.o||'';f.elements.beskrivelse.value=a.d||'';
  $('meld-inn').scrollIntoView({behavior:'smooth'});setTimeout(()=>f.elements.lenke.focus({preventScroll:true}),400)});

/* Innmelding: lager en ferdig utfylt e-post. Ingenting lagres på siden. */
$('kf').addEventListener('input',()=>{$('kf-err').textContent=''});
$('kf').addEventListener('submit',e=>{
  e.preventDefault();
  const f=e.target,v=k=>f.elements[k].value.trim();
  if(!v('navn'))return $('kf-err').textContent='Skriv inn navnet på laget eller firmaet.';
  if(!/^\S+@\S+\.\S+$/.test(v('epost')))return $('kf-err').textContent='Skriv inn en gyldig e-postadresse.';
  if(v('lenke')&&!/^https?:\/\//i.test(v('lenke')))return $('kf-err').textContent='Lenken må starte med https://';
  if(!f.elements.ok.checked)return $('kf-err').textContent='Bekreft at du representerer aktøren.';
  const body=[`Bydel: ${BYDEL[0].toUpperCase()+BYDEL.slice(1)}`,`Navn: ${v('navn')}`,`Type: ${v('type')}`,`Kategori: ${v('kategori')}`,`Område: ${v('omrade')}`,`Lenke: ${v('lenke')}`,`Beskrivelse: ${v('beskrivelse')}`,`Kontakt: ${v('epost')}`,'','Jeg representerer aktøren eller har avtalt å melde den inn.'].join('\n');
  const subject=`Innmelding ${BYDEL[0].toUpperCase()+BYDEL.slice(1)}: ${v('navn')}`;
  location.href=`mailto:${MOTTAKER}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  $('kf-ok').hidden=false;
  $('kf-ok').innerHTML=`<p><strong>E-posten med innmeldingen skal nå åpnes.</strong> Trykk send i e-postprogrammet ditt.</p><p>Åpnet ingenting seg? Kopier teksten under og send den til <a href="mailto:${MOTTAKER}">${MOTTAKER}</a>.</p><pre>${esc(subject+'\n\n'+body)}</pre>`;
});
})();
