// ===== 상태 / 저장 =====
const NEED=[1,6,12,20,30,42];
const SAVE_KEY='wru_save_v1';
const $=s=>document.querySelector(s);
const now=()=>Date.now();
const todayKey=()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString('ko-KR');
const CH=Object.fromEntries(CHARS.map(c=>[c.id,c]));
const ENERGY_MAX=5, ENERGY_MS=3*60*1000;

let S=null;
function fresh(){
  return {vials:1500,iso:60,energy:5,energyAt:now(),owned:{classic:{lv:1,xp:0,dup:0,rk:0},mangaverse:{lv:1,xp:0,dup:0,rk:0}},team:['classic','mangaverse'],
    issue:0,mission:0,done:[0,0,0,0,0,0],mdone:{},unl:{date:'',best:0,claimed:[]},event:{key:-1,best:0,claimed:[]},ops:[null,null,null],daily:{date:'',runs:0,dist:0,vials:0,enemies:0,bosses:0,claimed:[]},continues:0,stats:{runs:0,best:0,bossKills:0}};
}
function load(){try{const j=localStorage.getItem(SAVE_KEY);if(j){S=Object.assign(fresh(),JSON.parse(j));}}catch(e){} if(!S)S=fresh(); tickEnergy();}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));}catch(e){}}
function tickEnergy(){ if(S.energy>=ENERGY_MAX){S.energyAt=now();return;} const el=now()-S.energyAt; const g=Math.floor(el/ENERGY_MS); if(g>0){S.energy=Math.min(ENERGY_MAX,S.energy+g);S.energyAt=S.energy>=ENERGY_MAX?now():S.energyAt+g*ENERGY_MS;} }
function dailyCheck(){const t=todayKey(); if(S.daily.date!==t){S.daily={date:t,runs:0,dist:0,vials:0,enemies:0,bosses:0,claimed:[]};} if(S.unl.date!==t){S.unl={date:t,best:0,claimed:[]};} const wk=Math.floor(now()/864e5/7); if(S.event.key!==wk){S.event={key:wk,best:0,claimed:[]};}}

// ===== 카드 계산 =====
const stars=id=>Math.min(8,RARITY[CH[id].r].stars+(S.owned[id]?.rk||0));
const cap=id=>RARITY[CH[id].r].cap+(S.owned[id]?.rk||0)*10;
const power=id=>{const o=S.owned[id];if(!o)return 0;return o.lv/10+(RARITY[CH[id].r].stars-1)/2+(o.rk||0)*0.5;};
const teamPower=()=>S.team.reduce((a,id)=>a+power(id),0);
const tierName=p=>{let n=TIERS[0][1];for(const [v,t] of TIERS)if(p>=v)n=t;return n;};
const xpNeed=lv=>100+lv*45;
function addXp(id,xp){const o=S.owned[id];if(!o)return;o.xp+=xp;while(o.lv<cap(id)&&o.xp>=xpNeed(o.lv)){o.xp-=xpNeed(o.lv);o.lv++;} if(o.lv>=cap(id))o.xp=Math.min(o.xp,xpNeed(o.lv)-1);}
const teamMult=i=>S.team.reduce((a,id)=>a+CH[id].m[i],0); // 가산 배율 (0=score,1=combo,2=dist,3=vials,4=enemies,5=bosses)
const inOps=id=>S.ops.some(o=>o&&o.chars.includes(id));
function leaderMods(){ const c=CH[S.team[0]]; const base={vialMul:1,scoreMul:1,comboHold:0,shields:0,revives:0,magnet:0,bombDmg:1,zipRange:1,telMul:1,sense:0,comboStart:0,xpMul:1,isoLuck:1,sturdy:0,killMul:1,killCombo:0,speedMul:1,distMul:1,tapTime:0,escTime:0,shieldRegen:0,noProj:0,slideFly:0};
  const add=m=>{ for(const k in m){ if(k==='vialMul'||k==='scoreMul'||k==='xpMul'||k==='killMul'||k==='speedMul'||k==='distMul'||k==='zipRange'||k==='telMul'||k==='isoLuck')base[k]=Math.max(base[k],1)*m[k]; else if(k==='bombDmg')base[k]+=m[k]-1; else if(k==='titan')base.titan=m[k]; else base[k]=(base[k]||0)+m[k]; } };
  add(RANK_TRAITS[c.r].mods); add(abilityOf(c).mods); return base; }

// ===== 미션 생성 =====
const missionCount=i=>ISSUES[i].bosses.length*5;
const halfNeed=i=>Math.ceil(missionCount(i)/2)+1; // 절반(최소 보스 2명 포함)
const issueUnlocked=i=>i===0||!!S.unlockAll||(S.mdone['i'+(i-1)]||0)>=halfNeed(i-1);
function genMission(i,m){
  if(m%5===4)return {t:'boss',label:`보스 격파 — ${ISSUES[i].bosses[Math.floor(m/5)]}`,n:1,bossIdx:Math.floor(m/5)};
  const k=m%4; const tt=MISSION_TYPES[k];
  const n=[400+110*m+300*i, 25+7*m+18*i, Math.ceil((6+2*m+5*i)/4), 4+m+2*i][k];
  return {t:tt.t,label:tt.label(n),n};
}

// ===== 아바타 (추상 실루엣) =====
function avatarSVG(c,w=56,h=66){
  const [a,b]=c.c; const r=RARITY[c.r].color;
  return `<svg class="ava" viewBox="0 0 56 66" width="${w}" height="${h}" aria-hidden="true"><rect x="1.5" y="1.5" width="53" height="63" fill="#fff" stroke="#0d0f1c" stroke-width="3"/><rect x="1.5" y="1.5" width="53" height="10" fill="${r}" stroke="#0d0f1c" stroke-width="3"/><g transform="translate(28 14)"><path d="M-22 6 L0 44 L22 6" fill="${r}" opacity=".18"/><path d="M-9 44 L-6 20 L6 20 L9 44" fill="${b}" stroke="#0d0f1c" stroke-width="2.5" stroke-linejoin="round"/><path d="M-10 20 L-8 4 L8 4 L10 20 Z" fill="${a}" stroke="#0d0f1c" stroke-width="2.5" stroke-linejoin="round"/><circle cx="0" cy="-2" r="7" fill="${a}" stroke="#0d0f1c" stroke-width="2.5"/><path d="M-8 6 L-17 16 M8 6 L17 16" stroke="#0d0f1c" stroke-width="6" stroke-linecap="round"/><path d="M-8 6 L-17 16 M8 6 L17 16" stroke="${a}" stroke-width="3" stroke-linecap="round"/></g></svg>`;
}
const starStr=n=>'★'.repeat(n)+'<span style="opacity:.25">'+'★'.repeat(Math.max(0,8-n))+'</span>';

// ===== 렌더: 상단 자원 =====
function renderRes(){tickEnergy();$('#rEnergy').textContent=`${S.energy}/${ENERGY_MAX}`;const rem=S.energy<ENERGY_MAX?Math.ceil((ENERGY_MS-(now()-S.energyAt))/1000):0;$('#rEnergyT').textContent=rem?`+1 in ${Math.floor(rem/60)}:${String(rem%60).padStart(2,'0')}`:'';$('#rVial').textContent=fmt(S.vials);$('#rIso').textContent=fmt(S.iso);}
setInterval(()=>{renderRes();renderOps(false);},1000);

// ===== 렌더: 스토리 =====
function renderStory(){
  const tp=teamPower();
  $('#issues').innerHTML=ISSUES.map((is,i)=>{const locked=!issueUnlocked(i); const done=S.done[i]; const total=missionCount(i); const prog=S.mdone['i'+i]||0;
    return `<button class="issue ${locked?'locked':''} ${i===S.issue?'on':''}" style="--c:${ISSUE_ENV_COLORS[i][2]}" data-i="${i}" ${locked?'disabled':''}>
      <div class="no"><small>ISSUE</small>#${is.n}</div><h3>${is.title}</h3><div class="env">${is.env} · ${is.bosses.length}회 보스</div>
      <div class="prog"><div class="bar"><i style="width:${prog/total*100}%"></i></div><span class="num">${prog}/${total}</span></div>
      ${locked?`<div class="env">이슈 #${i} 절반 클리어 필요 (${S.mdone['i'+(i-1)]||0}/${halfNeed(i-1)} · 보스 2명 포함)</div>`:done?'<div class="env" style="color:var(--green)">완료 · 재도전 가능</div>':''}</button>`;}).join('');
  $('#issues').querySelectorAll('.issue').forEach(b=>b.onclick=()=>{S.issue=+b.dataset.i;if(S.issue<S.done.length&&S.done[S.issue])S.mission=S.mdone['i'+S.issue]??0;else S.mission=S.mdone['i'+S.issue]??0;save();renderStory();});
  const is=ISSUES[S.issue]; const total=missionCount(S.issue); const progI=Math.min(S.mdone['i'+S.issue]||0,total-1); if(S.mission>progI)S.mission=progI; const m=Math.min(S.mission,total-1); const ms=genMission(S.issue,m); const replay=m<(S.mdone['i'+S.issue]||0);
  $('#missionBox').innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><h3 style="font-size:20px;color:#fff">이슈 #${is.n} · ${is.title}</h3><span style="color:var(--dim);font-size:12px">${is.env}</span></div>
   <p class="lead" style="font-size:13px">${is.intro}</p><p class="lead" style="font-size:12px"><b>보스 기믹</b> — ${is.gimmick} · 보스는 <b>B</b> 미션에서만 등장 · 다음 이슈는 이 이슈를 절반(${halfNeed(S.issue)}개) 클리어하면 열림</p>
   <div class="ms">${Array.from({length:total},(_,k)=>{const pr=S.mdone['i'+S.issue]||0; const cls=(k<pr?'done':'')+(k===m?' cur':'')+(k%5===4?' b':'')+(k<=pr?' pick':''); return `<span class="${cls}" data-m="${k}" title="${k<pr?'클리어 — 다시 플레이':k===pr?'현재 미션':'잠김'}">${k%5===4?'B':k+1}</span>`;}).join('')}</div>
   <div class="obj">미션 ${m+1}/${total} — <b>${ms.label}</b>${replay?' <span style="color:var(--muted);font-size:12px">(재도전 — 진행도에 영향 없음)</span>':''}${S.mission>=total?' <span style="color:var(--green)">(이슈 완료 · 재도전)</span>':''}</div>`;
  $('#missionBox').querySelectorAll('.ms span.pick').forEach(sp=>{ sp.style.cursor='pointer'; sp.onclick=()=>{ S.mission=+sp.dataset.m; save(); renderStory(); }; });
  { const lead=CH[S.team[0]]; const o=S.owned[S.team[0]]; const tier=tierName(tp); const v={dist:'거리',vials:'바이알',enemies:'적 처치',combo:'콤보',boss:'보스'}[ms.t];
    $('#heroCard').innerHTML=`<div class="hero">
      <div class="por">${avatarSVG(lead,84,100)}<div class="rar" style="color:${RARITY[lead.r].color}">${RARITY[lead.r].name}</div></div>
      <div class="info">
        <div class="eyebrow">ISSUE #${is.n} · ${is.title}</div>
        <h3>미션 ${m+1} <span style="font-size:14px;color:var(--dim)">/ ${total}</span></h3>
        <div class="goal">${ms.t==='boss'?'BOSS':v} — <b>${ms.label.replace(/^보스 격파 — /,'')}</b></div>
        <div class="pbar"><i style="width:${(S.mdone['i'+S.issue]||0)/total*100}%"></i></div>
        <div class="meta">챕터 진행 ${S.mdone['i'+S.issue]||0}/${total}${replay?' · 재도전 중':''} · 에너지 ${S.energy}/${ENERGY_MAX}</div>
        <div class="crew">${S.team.map(id=>`<div class="m">${avatarSVG(CH[id],22,26)}<span>${CH[id].name}</span></div>`).join('')}<div class="pw2">P ${tp.toFixed(1)} · ${tier}</div></div>
        <div class="lead2">${RANK_TRAITS[lead.r].label} · ${abilityOf(lead).name}</div>
      </div></div>`; }
  $('#bRun').disabled=S.energy<1; $('#bUnl2').disabled=S.energy<1;
  $('#bRun').querySelector('span').textContent=S.energy<1?'에너지 부족':(ms.t==='boss'?'▶ 보스전 시작':'▶ 미션 시작');
  renderDaily();
}
function renderDaily(){
  const d=S.daily; const cats=[['runs','러닝 횟수',[1,3,6]],['enemies','적 처치',[20,80,200]],['vials','바이알 수집',[100,400,1000]],['bosses','보스 격파',[1,3,6]]];
  const rw=[['bronze','브론즈',[300,0]],['silver','실버',[800,3]],['gold','골드',[2000,8]]];
  $('#daily').innerHTML=`<div style="grid-column:1/-1;font-size:12px;color:var(--dim)">오늘의 데일리 보상 (${d.date}) — 24시간 누적 성과로 브론즈/실버/골드</div>`+cats.map(([k,l,th])=>{
    const v=d[k]; const got=th.filter(t=>v>=t).length; const claimedN=(d.claimed.filter(c=>c.startsWith(k+':')).length);
    const canClaim=got>claimedN; const ri=rw[Math.min(2,claimedN)];
    return `<div><b>${l} <span class="num" style="color:var(--dim)">${v}</span></b>${th.map((t,j)=>`<span class="${rw[j][0]}">${rw[j][1]} ${t}</span>${j<2?' · ':''}`).join('')}<br>${canClaim?`<button class="btn sm cyan" style="margin-top:6px" data-claim="${k}">${ri[1]} 수령 (+${ri[2][0]} 바이알${ri[2][1]?` +${ri[2][1]} ISO`:''})</button>`:''}</div>`;}).join('');
  $('#daily').querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>{const k=b.dataset.claim;const n=d.claimed.filter(c=>c.startsWith(k+':')).length;const r=rw[n];S.vials+=r[2][0];S.iso+=r[2][1];d.claimed.push(k+':'+n);save();renderAll();});
}

// ===== 렌더: 팀 =====
function renderTeam(){
  const tp=teamPower(); $('#teamPower').textContent=tp.toFixed(1); $('#teamTier').textContent=tierName(tp);
  $('#team').innerHTML=[0,1,2].map(i=>{const id=S.team[i]; if(!id)return `<button class="slot">빈 슬롯 — 컬렉션에서 카드를 선택하세요 (클릭하면 컬렉션으로)</button>`; const c=CH[id],o=S.owned[id];
    return `<button class="slot filled" data-id="${id}">${avatarSVG(c,44,52)}<div><div class="name">${i===0?'▶ ':''}${c.name}</div><div class="meta">${RARITY[c.r].name} · Lv.${o.lv}/${cap(id)} · P ${power(id).toFixed(1)}</div><div class="meta" style="color:var(--amber)">${multStr(c)}</div>${i===0?`<div class="meta" style="color:var(--redink);font-weight:700">${RANK_TRAITS[c.r].label} · ${abilityOf(c).name}</div>`:''}</div></button>`;}).join('');
  $('#team').querySelectorAll('.slot.filled').forEach(b=>b.onclick=()=>openCard(b.dataset.id));
  $('#team').querySelectorAll('.slot:not(.filled)').forEach(b=>b.onclick=()=>{ $('#nav [data-p="collection"]').click(); });
}
const multStr=c=>EVENT_CATS.map((e,i)=>c.m[i]?`${e[1]} +${c.m[i]}×`:'').filter(Boolean).join(' · ');

// ===== 렌더: 컬렉션 =====
let filter='all';
function renderCards(){
  const own=Object.keys(S.owned).length; $('#colCount').textContent=`${own} / ${CHARS.length} 보유`;
  const fs=[['all','전체'],['own','보유'],['C','커먼'],['U','언커먼'],['R','레어'],['E','에픽'],['L','레전더리'],['T','타이탄']];
  $('#filters').innerHTML=fs.map(([k,l])=>`<button class="${filter===k?'on':''}" data-f="${k}">${l}</button>`).join('');
  $('#filters').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;renderCards();});
  const list=CHARS.filter(c=>filter==='all'||(filter==='own'?S.owned[c.id]:c.r===filter)).sort((a,b)=>(S.owned[b.id]?1:0)-(S.owned[a.id]?1:0)||RARITY[b.r].stars-RARITY[a.r].stars);
  $('#cards').innerHTML=list.map(c=>{const o=S.owned[c.id]; return `<button class="card ${o?'':'locked'} ${S.team.includes(c.id)?'inteam':''}" data-id="${c.id}" style="border-color:${o?RARITY[c.r].color+'88':''}">${o&&o.dup?`<span class="dup">+${o.dup}</span>`:''}${avatarSVG(c)}<div class="nm">${c.name}</div><div class="stars" style="color:${RARITY[c.r].color}">${starStr(o?stars(c.id):RARITY[c.r].stars)}</div><div class="lv">${o?`Lv.${o.lv}`:RARITY[c.r].name}</div></button>`;}).join('');
  $('#cards').querySelectorAll('.card').forEach(b=>b.onclick=()=>openCard(b.dataset.id));
}
function openCard(id){
  const c=CH[id],o=S.owned[id]; const dlg=$('#dlg'); const inTeam=S.team.includes(id); const st=o?stars(id):RARITY[c.r].stars;
  const rkCost={vials:500*st,iso:(c.r==='C'||c.r==='U')?5:0}; const canRk=o&&o.dup>0&&st<8&&S.vials>=rkCost.vials&&S.iso>=rkCost.iso;
  dlg.innerHTML=`<div class="dlg" style="--rc:${RARITY[c.r].color}"><div class="hdr">${avatarSVG(c,78,92)}<div><div class="rar">${RARITY[c.r].name} · ${starStr(st)}</div><h3>${c.name}</h3><div class="src">${c.g} · 출처 ${({gl:'Gameloft 발표',w:'Wikipedia',sf:'Spider-Man Wiki',k:'원작 로스터 보충'})[c.src]}</div></div></div><div class="lvup" id="dLvup"></div>
   ${o?`<div class="kv"><span>레벨</span><b>${o.lv} / ${cap(id)}</b><span>경험치</span><b>${o.xp} / ${xpNeed(o.lv)}</b><span>스파이디 파워</span><b>${power(id).toFixed(2)}</b><span>중복 카드</span><b>${o.dup}</b></div><div class="bar xpbar"><i style="width:${o.xp/xpNeed(o.lv)*100}%"></i></div>`:'<p class="lead">아직 소환하지 않은 스파이더입니다. 포털 또는 이벤트 보상으로 획득.</p>'}
   <div class="kv" style="margin-top:2px"><span>등급 특성</span><b style="font-family:var(--body)">${RANK_TRAITS[c.r].label} — ${RANK_TRAITS[c.r].desc}</b><span>고유 능력</span><b style="font-family:var(--body);color:var(--redink)">${abilityOf(c).name} — ${abilityOf(c).desc}</b></div><p class="lead" style="font-size:11px">특성·능력은 이 카드가 팀 리더(1번)일 때 발동합니다.</p>
   <div class="mults">${EVENT_CATS.map((e,i)=>`<span class="${c.m[i]?'on':''}">${e[1]} ${c.m[i]?'+'+c.m[i]+'×':'—'}</span>`).join('')}</div>
   <div class="actions">
    ${o?(inTeam?`<button class="btn sm ghost" id="dTeam">팀에서 제외</button>`:`<button class="btn sm cyan" id="dTeam" ${S.team.length>=3||inOps(id)?'disabled':''}>${inOps(id)?'옵스 임무 중':'팀에 추가'}</button>`):''}
    ${o&&inTeam&&S.team[0]!==id?`<button class="btn sm ghost" id="dLead">리더로</button>`:''}
    ${o?`<button class="btn sm ghost" id="dLv" ${S.vials<200*o.lv||o.lv>=cap(id)?'disabled':''}>바이알로 레벨업 (${fmt(200*o.lv)})</button>`:''}
    ${o?`<button class="btn sm amber" id="dRk" ${canRk?'':'disabled'}>랭크업 (중복 1 + ${fmt(rkCost.vials)} 바이알${rkCost.iso?` + ${rkCost.iso} ISO`:''})</button>`:''}
    <button class="btn sm ghost" id="dClose">닫기</button>
   </div>
   ${o&&o.dup>0&&st>=8?'<p class="lead" style="font-size:12px">최대 랭크입니다. 중복 카드는 보관됩니다.</p>':''}
  </div>`;
  dlg.showModal();
  $('#dClose').onclick=()=>dlg.close();
  const T=$('#dTeam'); if(T)T.onclick=()=>{if(inTeam){S.team=S.team.filter(x=>x!==id);}else S.team.push(id); if(!S.team.length){S.team=[id];} save();dlg.close();renderAll();};
  const L=$('#dLead'); if(L)L.onclick=()=>{S.team=[id,...S.team.filter(x=>x!==id)];save();dlg.close();renderAll();};
  const V=$('#dLv'); if(V)V.onclick=()=>{ const bar=dlg.querySelector('.xpbar i'); bar.style.width='100%'; SFX.play('levelup'); const lu=$('#dLvup'); lu.innerHTML='<span class="chrome gold">Level Up!</span>'; FX.retrig(lu,'on'); FX.sparks(dlg.querySelector('.dlg'),dlg.clientWidth/2,dlg.clientHeight*0.45,16); setTimeout(()=>{S.vials-=200*o.lv;o.lv++;o.xp=0;save();openCard(id);renderAll();},650); };
  const RK=$('#dRk'); if(RK)RK.onclick=()=>{ SFX.play('rankup'); const lu=$('#dLvup'); lu.innerHTML='<span class="chrome red">Rank Up!</span>'; FX.retrig(lu,'on'); FX.sparks(dlg.querySelector('.dlg'),dlg.clientWidth/2,dlg.clientHeight*0.3,28,RARITY[c.r].color); setTimeout(()=>{o.dup--;S.vials-=rkCost.vials;S.iso-=rkCost.iso;o.rk=(o.rk||0)+1;save();openCard(id);renderAll();},900); };
}

// ===== 포털 =====
function roll(kind){
  const r=Math.random()*100; let rar;
  if(kind==='std'){rar=r<70?'C':r<95?'U':'R';} else {rar=r<52?'U':r<85?'R':r<96?'E':r<99?'L':'T';}
  const pool=CHARS.filter(c=>c.r===rar); return pool[Math.floor(Math.random()*pool.length)];
}
function gain(c){ if(S.owned[c.id]){S.owned[c.id].dup++;return false;} S.owned[c.id]={lv:1,xp:0,dup:0,rk:0}; return true; }
document.querySelectorAll('[data-portal]').forEach(b=>b.onclick=()=>{
  const k=b.dataset.portal,n=+b.dataset.n; const cost=k==='std'?(n===1?1000:9000):(n===1?30:270);
  if(k==='std'&&S.vials<cost)return toast('바이알 부족'); if(k==='prem'&&S.iso<cost)return toast('ISO-8 부족');
  if(k==='std')S.vials-=cost;else S.iso-=cost;
  if(R||SUM.active)return toast('지금은 소환 불가');
  const got=[]; for(let i=0;i<n;i++){const c=roll(k);got.push([c,gain(c)]);} save(); renderRes();
  summon(got,()=>{ $('#pull').innerHTML=got.map(([c,isNew],i)=>`<div class="card ${isNew?'NEW':''}" style="animation-delay:${i*70}ms;border-color:${RARITY[c.r].color}">${avatarSVG(c)}<div class="nm">${c.name}</div><div class="stars" style="color:${RARITY[c.r].color}">${starStr(RARITY[c.r].stars)}</div><div class="lv">${isNew?'<span style="color:var(--green)">NEW</span>':'중복 +1'}</div></div>`).join(''); renderAll(); });
});

// ===== 이벤트 =====
function eventInfo(){const k=S.event.key;const cat=EVENT_CATS[k%6];const boss=EVENT_BOSSES[k%EVENT_BOSSES.length];const pool=CHARS.filter(c=>c.r==='R'||c.r==='E');const reward=pool[k%pool.length];
  const base=[['score',20000],['combo',30],['dist',2500],['vials',250],['enemies',60],['bosses',3]].find(x=>x[0]===cat[0])[1];
  return {cat,boss,reward,tiers:[[base*.5,'바이알 800'],[base,'ISO-8 15'],[base*2,`${reward.name} 카드`]]};}
function renderEvent(){
  const e=eventInfo(); const mi=EVENT_CATS.findIndex(c=>c[0]===e.cat[0]); const m=teamMult(mi);
  $('#evt').innerHTML=`<div><div style="font-size:11px;letter-spacing:.14em;color:var(--dim)">WEEKLY EVENT · #${S.event.key}</div><h3>${e.boss} 침공</h3><p class="lead" style="font-size:13px">카테고리 <b class="cat">${e.cat[1]}</b> · 이벤트 보스 <b>${e.boss}</b>가 러닝에 난입합니다. 현재 팀 배율 <b class="cat">×${1+m}</b> (가산: ${S.team.map(id=>CH[id].m[mi]?CH[id].name+' +'+CH[id].m[mi]:'').filter(Boolean).join(', ')||'없음'})</p><p class="lead" style="font-size:13px">내 기록 <b class="num" style="color:#fff">${fmt(S.event.best)}</b> — 스토리·언리미티드 어느 러닝이든 이벤트 점수로 집계됩니다.</p></div>
   <div class="tiers">${e.tiers.map((t,i)=>{const got=S.event.best>=t[0];const cl=S.event.claimed.includes(i);return `<div class="${cl?'got':''}"><span class="num">${fmt(t[0])}</span><span>${t[1]}</span>${got&&!cl?`<button class="btn sm cyan" data-ec="${i}">수령</button>`:cl?'<span>✓</span>':''}</div>`;}).join('')}</div>`;
  $('#evt').querySelectorAll('[data-ec]').forEach(b=>b.onclick=()=>{const i=+b.dataset.ec;if(i===0)S.vials+=800;else if(i===1)S.iso+=15;else{gain(e.reward);toast(e.reward.name+' 획득!');}S.event.claimed.push(i);save();renderAll();});
  const ut=[[5000,5],[15000,12],[40000,30],[100000,80]];
  $('#unlTiers').innerHTML=`<div style="border:0;color:var(--dim)">오늘 최고 <b class="num" style="color:#fff">${fmt(S.unl.best)}</b></div>`+ut.map(([s,iso],i)=>{const got=S.unl.best>=s,cl=S.unl.claimed.includes(i);return `<div class="${cl?'got':''}"><span class="num">${fmt(s)}점</span><span>ISO-8 ${iso}</span>${got&&!cl?`<button class="btn sm cyan" data-uc="${i}">수령</button>`:cl?'<span>✓</span>':''}</div>`;}).join('');
  $('#unlTiers').querySelectorAll('[data-uc]').forEach(b=>b.onclick=()=>{const i=+b.dataset.uc;S.iso+=ut[i][1];S.unl.claimed.push(i);save();renderAll();});
}

// ===== 스파이디 옵스 =====
const OPS=[{n:'ISO-8 호송 차단',dur:1,v:400,xp:120,min:1},{n:'오스코프 잠입',dur:3,v:1400,xp:400,min:2},{n:'시니스터 솔저 소탕',dur:6,v:3500,xp:1000,min:3}];
function renderOps(full=true){
  const el=$('#ops'); if(!el)return;
  el.innerHTML=OPS.map((op,i)=>{const cur=S.ops[i];
    if(cur){const rem=cur.end-now(); if(rem<=0){return `<div class="op"><h3>${op.n}</h3><div>임무 귀환! 성공 확률 ${cur.p}%</div><button class="btn sm cyan" data-opc="${i}">결과 확인</button></div>`;}
      return `<div class="op"><h3>${op.n}</h3><div>진행 중 — ${cur.chars.map(id=>CH[id].name).join(', ')}</div><div class="time">${Math.floor(rem/60000)}:${String(Math.floor(rem/1000)%60).padStart(2,'0')} 남음 · 성공 ${cur.p}%</div></div>`;}
    const avail=Object.keys(S.owned).filter(id=>!S.team.includes(id)&&!inOps(id));
    return `<div class="op"><h3>${op.n}</h3><div>${op.dur}분 · 보상 바이알 ${fmt(op.v)} · 경험치 ${op.xp} · 최소 ${op.min}명</div><div style="color:var(--dim)">팀에 없는 대기 카드 ${avail.length}장 중 상위 ${Math.min(6,avail.length)}장 파견</div><button class="btn sm ghost" data-ops="${i}" ${avail.length<op.min?'disabled':''}>파견</button></div>`;}).join('');
  el.querySelectorAll('[data-ops]').forEach(b=>b.onclick=()=>{const i=+b.dataset.ops;const avail=Object.keys(S.owned).filter(id=>!S.team.includes(id)&&!inOps(id)).sort((a,b)=>S.owned[b].lv-S.owned[a].lv).slice(0,6);const avg=avail.reduce((a,id)=>a+S.owned[id].lv,0)/avail.length;S.ops[i]={chars:avail,end:now()+OPS[i].dur*60000,p:Math.min(95,Math.round(40+avg*2+avail.length*3))};save();renderOps();});
  el.querySelectorAll('[data-opc]').forEach(b=>b.onclick=()=>{const i=+b.dataset.opc;const cur=S.ops[i];const ok=Math.random()*100<cur.p;cur.chars.forEach(id=>addXp(id,ok?OPS[i].xp:Math.floor(OPS[i].xp/3)));if(ok)S.vials+=OPS[i].v;toast(ok?`임무 성공! +${fmt(OPS[i].v)} 바이알`:'임무 실패… 경험치 일부만 획득');S.ops[i]=null;save();renderAll();});
}

// ===== 코덱스 =====
function renderCodex(){
  $('#codex').innerHTML=`
  <p class="lead">Gameloft가 2014년 E3에서 "최초의 3D 웹 러너"로 발표. 출시 시 23종 이상의 스파이더맨 변종, 이후 100종 이상으로 확장. 스토리는 골드 고블린이 다중우주 시니스터 식스를 소환하고 S.H.I.E.L.D.가 다른 차원의 스파이더들을 불러 맞서는 구조. 이 재구성은 자료에서 확인된 시스템(에너지 5·10분 회복, 바이알/ISO-8, 희귀도 3★~8★, 스파이디 파워 공식, 티어, 이벤트 가산 배율, 4종 적 유형, SHIELD 폭탄 보스전, 스파이디 옵스, 데일리 보상)을 그대로 옮기되 실시간 대기 시간만 짧게 줄였습니다.</p>
  <h3>이슈 & 보스 <span class="tag">Gameloft 블로그 · Spider-Man Wiki</span></h3>
  <div class="tbl"><table><tr><th>이슈</th><th>주역 빌런</th><th>변종 (자료 확인)</th><th>환경</th></tr>${ISSUES.map(i=>`<tr><td class="num">#${i.n}</td><td>${i.bosses[0]}</td><td>${i.bosses.slice(1).join(', ')}</td><td>${i.env}</td></tr>`).join('')}<tr><td>이벤트</td><td>인헤리터스 / 기타</td><td>${EVENT_BOSSES.join(', ')}</td><td>그레이트 헌트 · 스파이더 아일랜드 · 인피니티 워 연동</td></tr></table></div>
  <h3>보스 계열별 패턴 <span class="tag">이 재구성의 해석</span></h3>
  <div class="tbl"><table><tr><th>계열</th><th>패턴</th></tr>${Object.entries(FAM_INFO).filter(([k])=>k!=='other').map(([k,v])=>`<tr><td>${({goblin:'고블린',vulture:'벌처',electro:'일렉트로',sand:'샌드맨',ock:'닥터 옥토퍼스',mysterio:'미스테리오',inheritor:'인헤리터스'})[k]}</td><td>${v}</td></tr>`).join('')}</table></div>
  <h3>등급 고유 특성 <span class="tag">리더 카드 기준</span></h3>
  <div class="tbl"><table><tr><th>등급</th><th>특성</th><th>효과</th></tr>${Object.entries(RANK_TRAITS).map(([k,v])=>`<tr><td style="color:${RARITY[k].color}">${RARITY[k].name}</td><td>${v.label}</td><td>${v.desc}</td></tr>`).join('')}</table></div>
  <h3>캐릭터 고유 능력 <span class="tag">${Object.keys(ABILITIES).length}종</span></h3>
  <div class="tbl"><table><tr><th>능력</th><th>효과</th><th>보유 캐릭터</th></tr>${Object.entries(ABILITIES).map(([k,v])=>`<tr><td>${v.name}</td><td>${v.desc}</td><td>${CHARS.filter(c=>abilityOf(c)===v).map(c=>c.name).join(', ')}</td></tr>`).join('')}</table></div>
  <h3>적 유형 <span class="tag">GameFAQs 공략</span></h3>
  <div class="tbl"><table><tr><th>유형</th><th>행동</th><th>대처</th></tr><tr><td>일반</td><td>근접</td><td>점프 또는 슬라이드 공격</td></tr><tr><td>무장</td><td>투사체 발사</td><td>차선 변경/슬라이드로 회피 후 공격</td></tr><tr><td>장갑</td><td>방패</td><td>슬라이드 공격만</td></tr><tr><td>비행</td><td>공중</td><td>점프 공격만</td></tr></table></div>
  <h3>진행 시스템 <span class="tag">GameFAQs · Wikipedia</span></h3>
  <div class="tbl"><table><tr><th>항목</th><th>원작</th><th>이 재구성</th></tr>
  <tr><td>에너지</td><td>최대 5, 10분당 1 회복, ISO-8/영상으로 충전</td><td>최대 5, 3분당 1, ISO-8 20으로 충전</td></tr>
  <tr><td>희귀도</td><td>커먼 3★ → 언커먼 4★ → 레어 5★ → 에픽 6★ → 레전더리 7★ → 타이탄 8★(레벨 캡 100 초과)</td><td>동일 (타이탄 캡 120)</td></tr>
  <tr><td>스파이디 파워</td><td>P = L/10 + (S−1)/2</td><td>동일 + 랭크업당 0.5</td></tr>
  <tr><td>티어</td><td>${TIERS.map(t=>`${t[1]} ${t[0]}+`).join(' → ')}</td><td>동일 (이슈 잠금 파워 ${NEED.join('/')})</td></tr>
  <tr><td>랭크업</td><td>동일 카드 합성 또는 랭크업 아이템, 저희귀도는 ISO-8 필요</td><td>중복 카드 + 바이알 (+커먼/언커먼은 ISO 5)</td></tr>
  <tr><td>이벤트 배율</td><td>팀원 배율 가산 (4× + 3× = 7×)</td><td>동일</td></tr>
  <tr><td>스파이디 옵스</td><td>1~6명 파견, 1~18시간</td><td>최대 6명, 1/3/6분</td></tr>
  <tr><td>러닝 종료</td><td>7번째 보스 이후 종료</td><td>스토리는 7번째 보스 후 종료, 언리미티드는 무한</td></tr></table></div>
  <h3>로스터 <span class="tag">${CHARS.length}종 · gl=Gameloft, w=Wikipedia, sf=Spider-Man Wiki, k=원작 로스터 보충</span></h3>
  <div class="tbl"><table><tr><th>이름</th><th>희귀도</th><th>계열</th><th>배율</th><th>출처</th></tr>${CHARS.map(c=>`<tr><td>${c.name}</td><td style="color:${RARITY[c.r].color}">${RARITY[c.r].name}</td><td>${c.g}</td><td>${multStr(c)}</td><td class="num">${c.src}</td></tr>`).join('')}</table></div>`;
}

// ===== 네비 / 전체 렌더 =====
$('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>{SFX.play('tab');$('#nav .on').classList.remove('on');b.classList.add('on');document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on',p.id==='p-'+b.dataset.p));});
function renderAll(){dailyCheck();renderRes();renderStory();renderTeam();renderCards();renderEvent();renderOps();}
function toast(t){const el=$('#toast');$('#toastT').textContent=t;el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');}

// ===== 러너 엔진 =====
const cv=$('#cv'),ctx=cv.getContext('2d'); let W=1280,H=720,LW=W*0.27; const FOV=6,ZF=42,OS=1.35;
// 화면 방향에 맞춰 캔버스 해상도 전환 (세로 폰: 720×1280)
function fitCanvas(){ const st=$('#stage'); const r=st.getBoundingClientRect(); const portrait=r.height>r.width*1.05; const nw=portrait?720:1280, nh=portrait?1280:720; if(cv.width!==nw){ cv.width=nw; cv.height=nh; if(typeof pv!=='undefined'){pv.width=nw;pv.height=nh;pvValid=false;} } W=nw; H=nh; LW=W*(portrait?0.31:0.27); if(!R){HOR=H*0.42;G=H*0.47;} }
const isMobile=matchMedia('(pointer:coarse)').matches||innerWidth<700;
function enterPlayMode(){ document.body.classList.add('ingame'); fitCanvas(); if(isMobile){ try{ if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('portrait').catch(()=>{}); }catch(e){} } }
function exitPlayMode(){ document.body.classList.remove('ingame'); }
window.addEventListener('resize',()=>fitCanvas());
// 시점(카메라) 파라미터 — 구간별로 부드럽게 보간
const VIEWS={run:{hor:0.42,g:0.47},boss:{hor:0.42,g:0.47},swing:{hor:0.40,g:0.47},wall:{hor:0.15,g:0.80},fall:{hor:0.52,g:0.40}};
let HOR=H*0.42,G=H*0.47,ROLL=0;
const FREE=()=>R&&(R.seg==='wall'||R.seg==='fall'); // 연속(자이로/마우스) 조작 구간
let freeTarget=0, gyroOK=false, mouseInside=false;
// 자이로/드래그 조작 상태
const GYRO={mode:'auto',sens:22,granted:false,gotEvent:false,lastEvt:0,lastDrag:0,status:'미확인',bound:false};
try{ const s=JSON.parse(localStorage.getItem('wru_ctrl')||'{}'); if(s.mode)GYRO.mode=s.mode; if(s.sens)GYRO.sens=s.sens; }catch(e){}
const gyroSave=()=>{ try{localStorage.setItem('wru_ctrl',JSON.stringify({mode:GYRO.mode,sens:GYRO.sens}));}catch(e){} };
const proj=(x,y,z)=>{const s=FOV/(FOV+z);return {x:W/2+x*s*LW,y:HOR+s*G*(1-0.5*y),s};};
let R=null,raf=0,keys={},holding=false,lastT=0;
const rnd=(a,b)=>a+Math.random()*(b-a);

function startRun(mode){
  tickEnergy(); if(S.energy<1){toast('에너지 부족');return;}
  S.energy--; if(S.energy===ENERGY_MAX-1)S.energyAt=now(); dailyCheck(); S.daily.runs++; S.stats.runs++; save();
  const issue=mode==='story'?S.issue:Math.floor(Math.random()*6);
  const ms=mode==='story'?genMission(S.issue,Math.min(S.mission,missionCount(S.issue)-1)):null;
  const lead=CH[S.team[0]]; const mods=leaderMods();
  R={mode,issue,ms,lead,mods,shields:mods.shields,revives:mods.revives,regenT:mods.shieldRegen||0,uniGauge:0,uniT:0,clones:[{alive:true,t:0},{alive:true,t:0}],tentCD:0,tentFx:null,t:0,dist:0,score:0,vials:0,iso:0,enemies:0,combo:0,maxCombo:0,comboT:0,bosses:0,bossSeen:0,
     speed:13,seg:'run',segLeft:70,segIdx:0,segEndZ:100,nextSeg:'swing',nextBoss:false,transT:0,prevSeg:'run',objs:[],spawnZ:ZF,lane:1,px:0,py:0,vy:0,state:'run',slideT:0,lastLaneT:0,prevLane:1,
     boss:null,dead:false,over:false,paused:false,inv:0,continues:0,objDone:false,shake:0,parts:[],bgOff:0,msg:'',msgT:0,fallSide:0,hazards:[],landT:0,wasJump:false};
  MUSIC.play('main',{fade:0.8}); if(isTouch&&GYRO.mode!=='drag'&&!GYRO.granted)requestGyro(false); enterPlayMode(); cancelAnimationFrame(idleRAF); idleRAF=0; $('#stage').classList.add('playing'); $('#ovTitle').classList.add('hidden'); $('#ovResult').classList.add('hidden'); $('#ovPause').classList.add('hidden');
  $('#hObj').innerHTML=mode==='story'?`이슈 #${ISSUES[issue].n} 미션 ${Math.min(S.mission,missionCount(S.issue)-1)+1} — <b>${ms.label}</b>`:`<b>언리미티드</b> — 최대한 멀리, 7번째 보스도 없다`;
  $('#hBoss').classList.remove('on'); setHint(ISSUES[issue].env+' · 달리기',1.6);
  planNext(); HOR=H*0.42; G=H*0.47; ROLL=0; freeTarget=0; lastT=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
  cv.focus();
}
function setHint(t,sec){const h=$('#hHint');h.textContent=t;h.classList.add('on');clearTimeout(h._t);h._t=setTimeout(()=>h.classList.remove('on'),sec*1000);}
const SEG_ORDER=['run','swing','run','wall','run','fall','run'];
const segLen=t=>(t==='run'?rnd(95,135):t==='swing'?rnd(75,105):rnd(55,75))*1.2; // 길이 +20% (진입 후 3초 클리어존 보상)
const CLEAR_SEC=3;
function planNext(){ // 다음 구간 타입 미리 결정 (스폰·경계 표시용)
  const idx=R.segIdx+1; if(R.mode==='story'){ R.nextBoss=R.ms.t==='boss'&&R.bosses===0&&!R.boss&&idx>=2; } else R.nextBoss=idx%4===0; R.nextSeg=R.nextBoss?'run':SEG_ORDER[idx%SEG_ORDER.length]; }
function segAt(z){ return z<R.segEndZ?R.seg:R.nextSeg; } // 보스 폭탄은 보스 등장 후에만 (경계 너머 'boss' 스폰 금지)
function nextSeg(){ // 경계 통과 시 호출 — 순간이동 없이 지형이 이어짐
  const prev=R.seg; R.segIdx++; R.transT=0.8; R.prevSeg=prev; R.clearUntil=R.dist/2.2+R.speed*CLEAR_SEC;
  R.objs=R.objs.filter(o=>o.type==='vial'||o.type==='iso'||(o.z-R.dist/2.2)>R.speed*CLEAR_SEC); // 이미 스폰된 앞 장애물 정리
  if(R.nextBoss&&!R.boss){startBoss();R.segEndZ=R.dist/2.2+1e9;return;}
  R.seg=R.nextSeg; R.segEndZ=R.dist/2.2+segLen(R.seg); planNext();
  freeTarget=R.lane-1; if(R.seg==='wall'||R.seg==='fall'){ if(isTouch&&GYRO.mode!=='drag'&&!GYRO.granted)requestGyro(false); if(isTouch)setHint(gyroLive()?'기울여서 이동':'화면을 좌우로 드래그해 이동',2.5); }
  if(R.seg==='swing'){R.py=Math.max(R.py,0.9);R.vy=3.5;SFX.play('web');} else if(R.seg==='fall'){R.py=0;R.vy=0;} else if(prev==='swing'||prev==='fall'){R.py=0;R.vy=0;R.landT=0.2;R.state='run';for(let i=0;i<8;i++)R.parts.push({x:proj(R.px,0,0).x+rnd(-40,40),y:proj(0,0,0).y+rnd(-4,4),t:0.4,c:'#c9d1e3',dust:true,vx:rnd(-80,80)});} else {R.state='run';}
  setHint({run:'옥상 달리기',swing:'스윙 — 길게 눌러 상승',wall:'벽 타기 — 좌우로 창문 회피',fall:'자유 낙하 — 좌우로 회피'}[R.seg],1.4); SFX.play('whoosh');
}
function startBoss(){
  R.seg='boss'; R.segEndZ=R.dist/2.2+1e9; R.py=0; R.vy=0; R.state='run';
  const list=R.mode==='story'?ISSUES[R.issue].bosses:[...ISSUES.flatMap(i=>i.bosses),...EVENT_BOSSES];
  let name; if(R.mode==='story')name=ISSUES[R.issue].bosses[R.ms.bossIdx??0]; else name=list[Math.floor(Math.random()*list.length)];
  if(Math.random()<0.2&&R.mode==='unl')name=eventInfo().boss;
  R.bossSeen++;
  const hp=R.mode==='story'?8+R.issue*2+(R.ms.bossIdx||0)*2:8+R.issue+R.bossSeen;
  MUSIC.play('boss',{fade:0.8}); const fam=FAM(name); R.boss={name,fam,hp,max:hp,t:40+R.mods.escTime,x:0,tx:0,phase:'intro',introT:2.4,taps:0,needTaps:10+R.issue*2,tapT:0,shot:0,bob:0,atk:2.8,hurtT:0,decoyT:0,lastTap:-9};
  $('#hBossName').textContent=name; $('#hBoss').classList.add('on'); FX.cutin(name); setTimeout(()=>{ if(R&&R.boss){ const b=R.boss; VOICE.boss(b.fam,'in').then(dur=>{ if(R&&R.boss===b&&dur>0)b.introT=Math.max(b.introT,0.35+dur+0.3); }); } },350); setHint('보스 등장…',2); R.hazards=[]; R.objs=R.objs.filter(o=>o.type==='vial'||o.type==='iso');
  R.objs=R.objs.filter(o=>o.type==='vial');
}
function endBoss(win){
  const b=R.boss; if(win){R.bosses++;R.score+=2500*(1+teamMult(5)*0.25);R.vials+=60+R.issue*20;R.iso+=1;S.stats.bossKills++;S.daily.bosses++;toast(b.name+' 격파!');SFX.play('clear');addCombo(5);}
  else {toast(b.name+' 도주…');SFX.play('fail');}
  MUSIC.play('main',{fade:1.2}); R.bubble=null; R.boss=null; R.beat=null; R.inv=Math.max(R.inv,1.2); $('#hBoss').classList.remove('on');
  if(R.mode==='story'){ const last=R.ms.bossIdx===ISSUES[R.issue].bosses.length-1; if(win&&last)FX.banner('ISSUE COMPLETE','var(--yellow)'); R.inv=9; setTimeout(()=>{ if(R&&!R.over)finish(true,win?(last?'이슈 최종 보스 격파':'보스 격파 — 러닝 종료'):'보스 도주 — 미션 실패'); },win?1400:800); return; }
  R.seg='run'; R.segEndZ=R.dist/2.2+segLen('run'); R.segIdx++; planNext(); R.clearUntil=R.dist/2.2+R.speed*CLEAR_SEC; R.objs=R.objs.filter(o=>o.type==='vial'||o.type==='iso');
}
function addCombo(n=1){ if(R.mods.titan==='uni'&&R.uniT<=0){ R.uniGauge+=n; if(R.uniGauge>=25){ R.uniGauge=0; R.uniT=6; toast('UNI-POWER!'); FX.banner('ENIGMA FORCE','var(--yellow)'); SFX.play('sting','T'); impact(0.8,proj(R.px,0.8,0).x,proj(0,0.8,0).y,'#ffd23a'); } } if(R.combo===0&&R.mods.comboStart)R.combo=R.mods.comboStart-1; R.combo+=n;R.maxCombo=Math.max(R.maxCombo,R.combo);R.comboT=7+R.mods.comboHold;R.score+=R.combo*8*(1+teamMult(1)*0.1);FX.comboBump(R.combo);}
function spawn(){
  const d=R.dist; const density=clamp(0.55+d/4000,0.55,1.3);
  const gap=rnd(6,10)/density; R.spawnZ+=gap; const z=R.spawnZ; const seg=segAt(z); if(Math.abs(z-R.segEndZ)<5)return; // 경계 근처는 비움
  const clearLen=R.speed*CLEAR_SEC; const inClear=(z<(R.clearUntil||0))||(z>=R.segEndZ&&z<R.segEndZ+clearLen*1.2+4)||(R.boss&&R.boss.phase==='intro'); // 구간 진입 후 3초는 장애물 없음
  if(inClear){ const lanes=[0,1,2].sort(()=>Math.random()-0.5); const y=seg==='swing'?rnd(0.6,2.4):0; for(let i=0;i<4;i++)R.objs.push({type:'vial',lane:lanes[0],y,z:z+i*1.4,hit:false}); return; }
  const lanes=[0,1,2].sort(()=>Math.random()-0.5);
  const push=o=>R.objs.push(Object.assign({z,hit:false,passed:false},o));
  if(seg==='run'||seg==='boss'){
    const r=Math.random(); const l=lanes[0];
    if(seg==='boss'&&R.boss&&R.boss.phase==='intro'){ /* 등장 중: 장애물 없음 */ }
    else if(seg==='boss'&&R.boss&&R.boss.fam==='mysterio'){ if(Math.random()<0.55)push({type:'enemy',kind:'minion',lane:l,shot:false}); }
    else if(seg==='boss'&&Math.random()<0.45){push({type:'bomb',lane:l});}
    else if(r<0.42){const kinds=['std','std','armed','armor','fly']; const k=kinds[Math.floor(Math.random()*Math.min(kinds.length,2+Math.floor(R.issue/1.5)+Math.floor(d/1200)))]; push({type:'enemy',kind:k,lane:l,shot:false});}
    else if(r<0.66){const ks=['low','high','wall']; push({type:'obs',kind:ks[Math.floor(Math.random()*3)],lane:l});}
    else if(r<0.86){ const chain=Math.random()<0.6?3:1; for(let i=0;i<chain;i++)R.objs.push({type:'ring',lane:l,z:z+i*2.2,hit:false,passed:false}); if(Math.random()<0.5)push({type:'ring',lane:lanes[1]}); }
    if(Math.random()<0.75){for(let i=0;i<4;i++)R.objs.push({type:'vial',lane:lanes[1],z:z+i*1.4,hit:false});}
    if(Math.random()<0.02*R.mods.isoLuck)push({type:'iso',lane:lanes[2]});
  } else if(seg==='swing'){
    const l=lanes[0]; const hi=Math.random()<0.5; if(Math.random()<0.35){ const l2=Math.min(2,l+1); push({type:'sign',kind:'crane',lane:l,lanes:[l,l2],band:hi?[1.7,3.2]:[0,1.4]}); } else push({type:'sign',kind:'board',lane:l,band:hi?[1.6,3.2]:[0,1.5]});
    if(Math.random()<0.6){const y=hi?0.6:2.4;for(let i=0;i<4;i++)R.objs.push({type:'vial',lane:lanes[1],y,z:z+i*1.4,hit:false});}
    if(Math.random()<0.5)push({type:'ring',lane:lanes[2],y:rnd(0.5,2.5)}); if(Math.random()<0.3)push({type:'ring',lane:lanes[1],y:rnd(0.5,2.5)});
  } else { // wall / fall
    push({type:'obs',kind:'wall',lane:lanes[0]}); if(Math.random()<0.5)push({type:'obs',kind:'wall',lane:lanes[1]});
    for(let i=0;i<3;i++)R.objs.push({type:'vial',lane:lanes[2],z:z+i*1.5,hit:false});
  }
}
function softHit(){ if(R.inv>0||R.dead||S.god)return; if(R.mods.sturdy){R.msg='STURDY';R.msgT=0.5;R.inv=0.6;addCombo(1);return;} R.combo=0; R.spin=1.0; R.inv=1.2; impact(0.5,proj(R.px,0.8,0).x,proj(0,0.8,0).y,'#c9d1e3'); R.rgbSplit=0.3; R.vy=5; if(R.state!=='jump'){R.state='jump';R.py=Math.max(R.py,0.1);} R.msg='BOUNCED!'; R.msgT=0.8; FX.flash(); SFX.play('hit'); }
function hitPlayer(){
  if(R.inv>0||R.dead||S.god)return; if(R.shields>0){ R.shields--; R.inv=1.5; R.combo=Math.floor(R.combo/2); impact(0.5,proj(R.px,0.8,0).x,proj(0,0.8,0).y,'#21c6de'); R.msg='SHIELD!'; R.msgT=0.8; SFX.play('bomb'); return; }
  R.zip=null; R.combo=0; R.dead=true; impact(1.0,proj(R.px,0.8,0).x,proj(0,0.8,0).y,'#e6202a'); R.rgbSplit=0.5; FX.flash(); SFX.play('hit');
  setTimeout(()=>{ if(!R)return; if(R.revives>0){ R.revives--; R.dead=false; R.inv=2.5; R.objs=R.objs.filter(o=>o.z-R.dist/2.2>4||o.type==='vial'); R.hazards=[]; toast('FREE REVIVE!'); SFX.play('clear'); FX.banner(`무료 부활 (남은 ${R.revives})`,'var(--cyan)'); return; } if(S.iso>=5&&R.continues<2){showResult(true);} else finish(false,'피격 — 러닝 종료'); },500);
}
function finish(ok,why){
  R.over=true; cancelAnimationFrame(raf);
  // 보상 정산
  const mult=(1+teamPower()/50)*R.mods.scoreMul; R.score=Math.round(R.score*mult);
  S.vials+=Math.round(R.vials*(1+teamMult(3)*0.15)*R.mods.vialMul); S.iso+=R.iso; S.daily.dist+=R.dist; S.daily.vials+=R.vials; S.daily.enemies+=R.enemies;
  S.stats.best=Math.max(S.stats.best,R.score);
  const xp=Math.floor((R.dist/8+R.enemies*6+R.bosses*80)*R.mods.xpMul); S.team.forEach(id=>addXp(id,xp));
  if(R.mode==='unl')S.unl.best=Math.max(S.unl.best,R.score);
  // 이벤트 집계
  const e=eventInfo(); const mi=EVENT_CATS.findIndex(c=>c[0]===e.cat[0]); const val={score:R.score,combo:R.maxCombo,dist:R.dist,vials:R.vials,enemies:R.enemies,bosses:R.bosses}[e.cat[0]]*(1+teamMult(mi)); S.event.best=Math.max(S.event.best,Math.round(val));
  let msg=why||''; let cleared=false;
  if(R.mode==='story'){ cleared=R.objDone; const total=missionCount(S.issue); const prog=S.mdone['i'+S.issue]||0; if(cleared){ if(S.mission>=prog&&S.mission<total){ S.mission++; S.mdone['i'+S.issue]=S.mission; if(S.mission>=total){S.done[S.issue]=1;msg+=' · 이슈 완료!';} else if(S.mission===halfNeed(S.issue)&&S.issue<5){msg+=` · 이슈 #${S.issue+2} 해금!`;} } else { msg+=' · 재도전 클리어'; } } }
  save(); showResult(false,cleared,xp,msg);
}
function showResult(canContinue,cleared,xp,msg){
  $('#ovResult').classList.remove('hidden'); $('#stage').classList.remove('playing');
  $('#resTitle').innerHTML=canContinue?'<span class="chrome">Knocked</span> <span class="chrome red">Out</span>':cleared?'<span class="chrome">Mission</span> <span class="chrome gold">Clear</span>':'<span class="chrome">Run</span> <span class="chrome red">Over</span>'; if(!canContinue)SFX.play(cleared?'clear':'fail');
  $('#resMsg').textContent=canContinue?`계속하시겠습니까? ISO-8 5개로 그 자리에서 재개 (남은 횟수 ${2-R.continues})`:(msg||'')+(R.mode==='story'&&!cleared?' · 미션 목표 미달성':'');
  $('#resStat').innerHTML=`<div><b data-c="${Math.round(R.score)}">0</b><small>점수</small></div><div><b data-c="${Math.round(R.dist)}" data-s="m">0</b><small>거리</small></div><div><b data-c="${R.vials}">0</b><small>바이알</small></div><div><b data-c="${R.enemies}">0</b><small>적 처치</small></div><div><b data-c="${R.maxCombo}">0</b><small>최대 콤보</small></div><div><b data-c="${R.bosses}">0</b><small>보스</small></div>${xp!=null?`<div><b data-c="${xp}" data-p="+">0</b><small>팀 XP</small></div>`:''}`; $('#resStat').querySelectorAll('[data-c]').forEach((el,i)=>setTimeout(()=>FX.countUp(el,+el.dataset.c,{suffix:el.dataset.s||'',fmt:v=>(el.dataset.p||'')+Math.round(v).toLocaleString('ko-KR')}),i*120));
  const again=$('#bAgain'); again.textContent=canContinue?'계속하기 (ISO-8 5)':'다시 달리기';
  again.onclick=()=>{ if(canContinue){S.iso-=5;R.continues++;R.dead=false;R.inv=2.5;R.objs=R.objs.filter(o=>o.z>4||o.type==='vial');$('#ovResult').classList.add('hidden');$('#stage').classList.add('playing');lastT=performance.now();raf=requestAnimationFrame(loop);renderRes();} else {const m=R.mode; R=null; startRun(m);} };
  $('#bBack').textContent=canContinue?'포기':'허브로';
  $('#bBack').onclick=()=>{ if(canContinue){finish(false,'피격 — 러닝 종료');} else {R=null;$('#stage').classList.remove('playing');$('#ovResult').classList.add('hidden');$('#ovTitle').classList.remove('hidden');exitPlayMode();renderAll();startIdle();} };
  renderAll();
}

// 입력
function laneMove(d){if(!R||R.dead||R.paused)return; if(FREE()){freeTarget=clamp(freeTarget+d*0.65,-1.3,1.3);return;} R.prevLane=R.lane;R.lane=clamp(R.lane+d,0,2);if(R.lane!==R.prevLane)R.lastLaneT=R.t;}
function doJump(){if(!R||R.dead||R.paused)return;if(R.seg==='swing'||R.seg==='wall'||R.seg==='fall')return;
  if(R.state==='run'){ R.state='jump'; R.vy=7.2; SFX.play('jump');
    // 웹 집(Web-Zip): 같은 차선 전방 2~11 유닛 안의 점프 처치 가능 적에게 거미줄을 쏘고 돌진
    const pz=R.dist/2.2; let best=null,bd=99; for(const o of R.objs){ if(o.type!=='enemy'||o.hit||o.lane!==R.lane)continue; const dz=o.z-pz; if(dz>1.5&&dz<11*R.mods.zipRange&&dz<bd&&(o.kind==='std'||o.kind==='armed'||o.kind==='fly'||o.kind==='minion')){best=o;bd=dz;} }
    if(best){ R.zip={o:best,t:0,dur:0.36,back:0.3,z0:0,z1:bd-0.6,done:false}; R.vy=3.5; SFX.play('web'); } } }
function killObj(o,dz,txt,col){ o.hit=true; if(o.type==='enemy'){R.enemies++; R.score+=100*R.mods.killMul; addCombo(1);} else {R.score+=50; addCombo(1);} const ip=proj(o.lane-1,0.8,Math.max(0,dz)); impact(0.3,ip.x,ip.y,col||'#ffd23a'); if(o.type==='enemy')ragdoll(o,dz); if(txt)R.parts.push({x:ip.x,y:ip.y-30,t:0.4,c:col||'#ffd23a',txt,rot:rnd(-0.3,0.3)}); }
function updateTitan(dt){ const T=R.mods.titan; if(!T)return; const pz=R.dist/2.2;
  if(T==='uni'){ if(R.uniT>0){ R.uniT-=dt; R.inv=Math.max(R.inv,0.2); if(Math.random()<0.5)R.parts.push({x:proj(R.px,0,0).x+rnd(-50,50),y:proj(0,0.6,0).y+rnd(-60,60),t:0.4,c:'#ffd23a',dust:true,vx:rnd(-40,40)});
      for(const o of R.objs){ if(o.hit)continue; const dz=o.z-pz; if(dz<0.8&&dz>-0.5&&Math.abs(R.px-(o.lane-1))<0.6&&(o.type==='obs'||o.type==='enemy'||o.type==='sign'||o.type==='proj'))killObj(o,dz,'SMASH','#ffd23a'); } } }
  else if(T==='clones'){ const lanes=[0,1,2].filter(l=>l!==R.lane); R.clones.forEach((c,i)=>{ if(!c.alive){c.t-=dt; if(c.t<=0){c.alive=true;toast('분신 재소환');} return;} const L=lanes[i];
      for(const o of R.objs){ if(o.hit||o.passed)continue; const dz=o.z-pz; if(dz>=0.7||dz<-0.5||o.lane!==L)continue;
        if(o.type==='vial'){o.hit=true;R.vials++;R.score+=10;} else if(o.type==='ring'){o.hit=true;addCombo(1);} else if(o.type==='enemy'){ const k=o.kind; const kill=(k==='armor')?R.state==='slide':(k==='fly')?R.state==='jump':(R.state==='jump'||R.state==='slide'); if(kill)killObj(o,dz,'CLONE!','#21c6de'); else {c.alive=false;c.t=15;o.hit=true;R.msg='분신 소멸';R.msgT=0.7;} }
        else if(o.type==='obs'){ const ok=(o.kind==='low'&&R.state==='jump'&&R.py>0.5)||(o.kind==='high'&&R.state==='slide'); if(!ok){c.alive=false;c.t=15;o.hit=true;R.msg='분신 소멸';R.msgT=0.7;} } } }); }
  else if(T==='tentacle'){ R.tentCD-=dt; if(R.tentFx){R.tentFx.t-=dt; if(R.tentFx.t<=0)R.tentFx=null;}
      if(R.tentCD<=0){ let best=null,bd=99; for(const o of R.objs){ if(o.hit||o.type!=='enemy')continue; const dz=o.z-pz; if(dz>1&&dz<7&&dz<bd){best=o;bd=dz;} } if(best){ R.tentCD=2.5; R.tentFx={lane:best.lane,dz:bd,t:0.35}; killObj(best,bd,'GRAB!','#c9d1e3'); SFX.play('whoosh'); } }
      for(const o of R.objs){ if(o.hit||o.type!=='bomb')continue; const dz=o.z-pz; if(dz<2.5&&dz>-0.3&&o.lane!==R.lane&&Math.abs(o.lane-R.lane)===1){ o.lane=R.lane; R.tentFx={lane:o.lane,dz,t:0.25}; } } }
}
function updateZip(dt){ const z=R.zip; if(!z)return; z.t+=dt; const pz=R.dist/2.2; const o=z.o; const dzNow=o.z-pz;
  if(!z.done){ const k=Math.min(1,z.t/z.dur); z.cur=lerp(0,Math.max(0.3,dzNow),1-Math.pow(1-k,3)); R.py=Math.max(R.py,0.9+Math.sin(k*Math.PI)*0.6); R.vy=Math.max(R.vy,0);
    if(k>=1||dzNow<1.0){ z.done=true; z.t=0; if(!o.hit){ o.hit=true; R.enemies++; R.score+=140*(1+teamMult(4)*0.1); addCombo(2); { const ip=proj(o.lane-1,0.9,Math.max(0,dzNow)); impact(0.55,ip.x,ip.y,'#fff'); ragdoll(o,dzNow); } if(o.kind==='minion'&&R.boss&&R.boss.phase==='fight'){R.boss.hp--;R.boss.hurtT=0.35;SFX.play('bomb');if(R.boss.hp<=0){R.boss.phase='beat';R.boss.tapT=6+R.mods.tapTime;R.boss.taps=0;R.beat={t:0,cur:0,x:R.px};R.hazards=[];R.objs=R.objs.filter(x=>x.type==='vial');setHint('연타! ×10 — 무적 상태',4);toast('FINISH HIM!');}} SFX.play('kill'); R.shake=0.25; const p=proj(o.lane-1,0.9,Math.max(0,dzNow)); R.parts.push({x:p.x,y:p.y-40,t:0.5,c:'#ffd23a',txt:'KICK!',rot:rnd(-0.3,0.3)}); for(let i=0;i<8;i++)R.parts.push({x:p.x+rnd(-20,20),y:p.y+rnd(-20,20),t:0.35,c:'#ff5a5f',dust:true,vx:rnd(-120,120)}); } } }
  else { const k=Math.min(1,z.t/z.back); z.cur=lerp(z.cur,0,k*0.5+dt*6); if(k>=1){R.zip=null;} } }
function doSlide(){if(!R||R.dead||R.paused)return;if(R.seg==='swing'||R.seg==='wall'||R.seg==='fall')return;if(R.state!=='jump'){R.state='slide';R.slideT=0.55;SFX.play('slide');}}
function tapAction(){ if(!R)return; if(R.boss&&R.boss.phase==='beat'){R.boss.taps+=(R.mods.titan==='tentacle'?2:1); if(R.boss.taps%4===0&&VOICE.on)VPACK.play(R.boss.fam,'hurt');R.boss.lastTap=R.t;SFX.play('tap');const bp=proj(R.boss.x,1.2,14); impact(0.45+(R.boss.taps%4===0?0.3:0),bp.x,bp.y,'#ffd23a');R.boss.hurtT=0.12;R.boss.x+=rnd(-0.08,0.08);R.parts.push({x:bp.x+rnd(-60,60),y:bp.y+rnd(-50,30),t:0.45,c:R.boss.taps%2?'#2fd3e6':'#ffd23a',txt:['POW!','KICK!','WHAM!','THWIP!','KRAK!'][R.boss.taps%5],rot:rnd(-0.4,0.4)}); for(let i=0;i<5;i++)R.parts.push({x:bp.x+rnd(-30,30),y:bp.y+rnd(-30,30),t:0.3,c:'#fff',dust:true,vx:rnd(-200,200)});} }
function togglePause(){ if(!R||R.over||R.dead)return; R.paused=!R.paused; $('#ovPause').classList.toggle('hidden',!R.paused); if(!R.paused){lastT=performance.now();raf=requestAnimationFrame(loop);} else cancelAnimationFrame(raf); }
window.addEventListener('keydown',e=>{ if(!R)return; const k=e.key;
  if(['ArrowLeft','a','A'].includes(k)){laneMove(-1);e.preventDefault();}
  else if(['ArrowRight','d','D'].includes(k)){laneMove(1);e.preventDefault();}
  else if(['ArrowUp','w','W'].includes(k)){ if(!e.repeat){doJump();tapAction();if(R.seg==='swing')SFX.play('web');} holding=true; e.preventDefault(); }
  else if(['ArrowDown','s','S'].includes(k)){doSlide();e.preventDefault();}
  else if(k===' '||k==='Enter'){ if(!e.repeat){doJump();tapAction();if(R.seg==='swing')SFX.play('web');} holding=true; e.preventDefault(); }
  else if(k==='Escape'||k==='p'||k==='P'){togglePause();}
});
window.addEventListener('keyup',e=>{ if(e.key===' '||e.key==='Enter'||e.key==='ArrowUp'||e.key==='w'||e.key==='W')holding=false; });
let tS=null;
cv.addEventListener('pointerdown',e=>{tS={x:e.clientX,y:e.clientY,t:performance.now(),moved:false};holding=true;if(R&&R.seg==='swing')SFX.play('web');cv.setPointerCapture(e.pointerId); if(isTouch&&R&&!gyroOK)requestGyro();});
const isTouch=matchMedia('(pointer:coarse)').matches;
cv.addEventListener('mousemove',e=>{ if(isTouch||!R)return; const r=cv.getBoundingClientRect(); freeTarget=((e.clientX-r.left)/r.width-0.5)*2*1.45; });
// 화면 방향에 맞춰 좌우 기울기를 뽑아낸다 (폰 세로 / 패드 가로 모두 대응)
function tiltOf(e){ const b=e.beta||0, gm=e.gamma||0;
  let a=0; try{ a=(screen.orientation&&screen.orientation.angle!=null)?screen.orientation.angle:(window.orientation||0); }catch(_){ a=window.orientation||0; }
  a=((a%360)+360)%360;
  if(a===90)return -b; if(a===270)return b; if(a===180)return -gm; return gm; }
function bindGyro(){ if(GYRO.bound)return; GYRO.bound=true;
  const h=e=>{ GYRO.gotEvent=true; GYRO.lastEvt=performance.now(); if(!R||!FREE())return; if(GYRO.mode==='drag')return;
    if(performance.now()-GYRO.lastDrag<1200)return; // 방금 드래그했으면 잠시 양보
    freeTarget=clamp(tiltOf(e)/Math.max(6,GYRO.sens),-1,1)*1.3; };
  window.addEventListener('deviceorientation',h,true); window.addEventListener('deviceorientationabsolute',h,true); }
function requestGyro(explicit){ if(GYRO.mode==='drag'){GYRO.status='드래그 전용';return;}
  const D=window.DeviceOrientationEvent;
  if(!D){ GYRO.status='이 브라우저는 자이로 미지원'; if(explicit)setHint('자이로를 지원하지 않는 기기입니다 — 드래그로 조작',3); return; }
  const ok=()=>{ GYRO.granted=true; gyroOK=true; bindGyro(); GYRO.status='허용됨 — 신호 확인 중';
    setTimeout(()=>{ if(GYRO.gotEvent){ GYRO.status='작동 중'; if(explicit)setHint('자이로 조작 ON — 기울여서 이동',2); }
      else { GYRO.status='허용됐지만 신호 없음 (iframe 제한) — 드래그 사용'; if(explicit)setHint('자이로 신호가 오지 않습니다 — 화면을 드래그해 이동하세요',4); } },1800); };
  if(typeof D.requestPermission==='function'){
    D.requestPermission().then(s=>{ if(s==='granted')ok(); else { GYRO.status='권한 거부됨 — 드래그 사용'; if(explicit)setHint('자이로 권한이 거부됨 — 드래그로 이동',3); } })
      .catch(err=>{ GYRO.status='권한 요청 실패 (HTTPS·iframe 제한) — 드래그 사용'; if(explicit)setHint('자이로를 쓸 수 없는 환경 — 드래그로 이동',3.5); });
  } else ok(); }
// 자이로 신호가 실제로 오는지
const gyroLive=()=>GYRO.gotEvent&&performance.now()-GYRO.lastEvt<1500;
cv.addEventListener('pointermove',e=>{ if(R&&FREE()&&tS&&isTouch){ const r=cv.getBoundingClientRect(); freeTarget=((e.clientX-r.left)/r.width-0.5)*2*1.45; GYRO.lastDrag=performance.now(); tS.moved=true; return; } if(!tS||tS.moved)return; const dx=e.clientX-tS.x,dy=e.clientY-tS.y; if(Math.hypot(dx,dy)<28)return; tS.moved=true; if(Math.abs(dx)>Math.abs(dy))laneMove(dx>0?1:-1); else if(dy<0)doJump(); else doSlide(); });
cv.addEventListener('pointerup',e=>{ if(tS&&!tS.moved){ if(!isTouch)doJump(); tapAction(); } tS=null; holding=false; });
cv.addEventListener('pointercancel',()=>{tS=null;holding=false;});
$('#bResume').onclick=togglePause; $('#bQuit').onclick=()=>{R.paused=false;$('#ovPause').classList.add('hidden');finish(false,'러닝 포기');};

// 업데이트
function update(dt){
  R.t+=dt; if(R.dead)return;
  R.speed=Math.min(28*R.mods.speedMul,(13+R.dist/880)*R.mods.speedMul)*(R.uniT>0?1.3:1); if(R.mods.shieldRegen){ R.regenT-=dt; if(R.regenT<=0){R.regenT=R.mods.shieldRegen;R.shields++;toast('SHIELD +1');SFX.play('coin');} } const vz=R.speed*dt; R.dist+=vz*2.2; R.score+=vz*2.2*5*(1+teamMult(0)*0.1)*R.mods.distMul;
  R.inv=Math.max(0,R.inv-dt); R.shake=Math.max(0,R.shake-dt); R.comboT-=dt; if(R.comboT<=0&&R.combo>0){R.combo=Math.floor(R.combo/2);R.comboT=3;}
  R.bgOff+=vz*3;
  // 플레이어 위치
  if(FREE()){ const tx=clamp(freeTarget,-1.3,1.3); R.px+=(tx-R.px)*Math.min(1,dt*10); const nl=clamp(Math.round(R.px)+1,0,2); if(nl!==R.lane){R.prevLane=R.lane;R.lane=nl;R.lastLaneT=R.t;} }
  else { const tx=(R.lane-1); R.px+=(tx-R.px)*Math.min(1,dt*14); }
  if(R.seg==='swing'){ R.vy+= (holding?14:-11)*dt; R.vy=clamp(R.vy,-6,6); R.py=clamp(R.py+R.vy*dt,0,3.2); if(R.py<=0||R.py>=3.2)R.vy=0; }
  else if(R.seg==='wall'||R.seg==='fall'){ R.py=0; R.state='run'; }
  else { if(R.state==='jump'){R.vy-=22*dt;R.py+=R.vy*dt;if(R.py<=0){R.py=0;R.state='run';}} else if(R.state==='slide'){R.slideT-=dt;if(R.slideT<=0)R.state='run';} }
  // 구간
  R.transT=Math.max(0,R.transT-dt); if(R.dist/2.2>=R.segEndZ&&!R.boss)nextSeg();
  // 스폰
  while(R.spawnZ<R.dist/2.2+ZF)spawn();
  // 보스
  if(R.boss){ const b=R.boss; b.bob+=dt; b.hurtT=Math.max(0,b.hurtT-dt); b.decoyT=Math.max(0,b.decoyT-dt); b.x+=(b.tx-b.x)*dt*2.2;
    if(b.phase==='intro'){ R.inv=Math.max(R.inv,0.5); b.introT-=dt; if(b.introT<=0){ b.phase='fight'; b.atk=1.2; setHint(FAM_INFO[b.fam],4); SFX.play('whoosh'); } }
    else if(b.phase==='fight'){ b.t-=dt; $('#hBossT').style.width=(b.t/(40+R.mods.escTime)*100)+'%'; $('#hBossLbl2').textContent='도주 타이머'; $('#hBossT3').style.width='0%'; b.atk-=dt; if(b.atk<=0){ bossPattern(b); if(b.rng()<0.6)VOICE.boss(b.fam,'attack'); b.tx=(Math.floor(b.rng()*3)-1)*0.7; b.atk=2.4+b.rng()*1.4-Math.min(1.2,R.issue*0.18); }
      if(b.fam==='other'||b.fam==='inheritor'){ b.shot+=dt; if(b.shot>3.2){b.shot=0;R.objs.push({type:'proj',lane:R.lane,z:12,hit:false,fast:true});} }
      if(b.t<=0)endBoss(false); }
    else if(b.phase==='beat'){ R.inv=Math.max(R.inv,0.6); $('#hBossT').style.width=(Math.max(0,1-b.taps/b.needTaps)*100)+'%'; $('#hBossLbl2').textContent=`연타 게이지 ${b.taps}/${b.needTaps}`; $('#hBossT3').style.width=(Math.max(0,b.tapT/6)*100)+'%'; if(R.beat){ R.beat.t+=dt; const k=Math.min(1,R.beat.t/0.45); const e=1-Math.pow(1-k,3); R.beat.cur=e*9.6; R.beat.x=lerp(R.beat.x,b.x-0.55,dt*8); R.py=Math.max(0,0.5*Math.sin(k*Math.PI)); } b.tapT-=dt; if(b.taps>=b.needTaps&&b.phase==='beat'){ b.phase='finish'; b.finT=0; b.finT0=performance.now(); VOICE.boss(b.fam,'out'); impact(1.2,proj(b.x,1.4,14).x,proj(b.x,1.4,14).y,'#fff'); R.rgbSplit=0.4; SFX.play('boss'); SFX.play('clear'); const bp=proj(b.x,1.4,14); R.parts.push({x:bp.x,y:bp.y-60,t:0.9,c:'#fff',txt:'FINISH!',rot:-0.15}); for(let i=0;i<14;i++)R.parts.push({x:bp.x+rnd(-40,40),y:bp.y+rnd(-40,40),t:0.6,c:i%2?'#ffd23a':'#fff',dust:true,vx:rnd(-300,300)}); } else if(b.tapT<=0){ b.phase='fight'; b.hp=b.max; b.hurtT=0.3; b.atk=2.5; R.beat=null; R.inv=Math.max(R.inv,1.5); toast('RECOVERED!'); setHint('보스가 회복했다 — 다시 SHIELD 폭탄을!',3); SFX.play('fail'); VOICE.boss(b.fam,'rec'); } }
    else if(b.phase==='finish'){ b.finT+=dt; R.inv=Math.max(R.inv,0.6); if(b.finT>1.3||performance.now()-(b.finT0||0)>2200)endBoss(true); }
  }
  updateZip(dt); updateTitan(dt);
  if(R.boss)updateHazards(dt);
  // 착지/점프 추적
  if(R.wasJump&&R.state!=='jump'){R.landT=0.18; R.shake=Math.max(R.shake,0.12); for(let i=0;i<6;i++)R.parts.push({x:proj(R.px,0,0).x+rnd(-30,30),y:proj(0,0,0).y+rnd(-4,4),t:0.35,c:'#c9d1e3',dust:true,vx:rnd(-60,60)});} R.wasJump=R.state==='jump'; R.landT=Math.max(0,R.landT-dt);
  // 오브젝트 이동/충돌
  const pz=R.dist/2.2;
  for(const o of R.objs){
    if(o.type==='proj'){o.z-=(o.fast?vz*2.2:vz*1.6);} else o.z-=vz;
    const dz=o.type==='proj'?o.z:o.z-pz;
    if(o.type==='enemy'&&o.kind==='armed'&&!o.shot&&dz<14&&dz>0&&!R.mods.noProj){o.shot=true;R.objs.push({type:'proj',lane:o.lane,z:dz,hit:false});}
    if(o.hit||o.passed)continue;
    const same=FREE()?Math.abs(R.px-(o.lane-1))<0.55:((o.lanes?o.lanes.includes(R.lane):o.lane===R.lane)&&Math.abs(R.px-(R.lane-1))<0.5);
    if(dz<0.7&&dz>-0.5){
      if(o.type==='vial'){ const near=same||(R.mods.magnet&&Math.abs(R.px-(o.lane-1))<1.3)||R.uniT>0; if(near&&(R.seg!=='swing'||Math.abs((o.y||0)-R.py)<1.2)){o.hit=true;R.vials++;R.score+=10;SFX.play('vial',R.vials); if(R.vials%5===0){addCombo(1);R.msg='VIAL STREAK';R.msgT=0.4;} } }
      else if(o.type==='iso'){ if(same){o.hit=true;R.iso++;toast('ISO-8!');SFX.play('iso');} }
      else if(o.type==='fakebomb'){ if(same){o.hit=true;R.combo=0;R.msg='FAKE!';R.msgT=0.7;SFX.play('fail');R.parts.push({x:W/2,y:H*0.4,t:0.5,c:'#3fbf7a',big:true});} }
      else if(o.type==='bomb'){ if(same&&R.boss&&R.boss.phase==='fight'){o.hit=true;R.boss.hp-=R.mods.bombDmg;R.boss.hurtT=0.35;R.score+=300;SFX.play('bomb');VOICE.boss(R.boss.fam,R.boss.hp<=0?'beat':'hurt');{ const bp=proj(R.boss.x,1.2,14); impact(0.6,bp.x,bp.y,'#2fd3e6'); R.parts.push({x:bp.x,y:bp.y,t:0.5,c:'#2fd3e6',big:true}); }addCombo(1);if(R.boss.hp<=0){R.boss.phase='beat';R.boss.tapT=6;R.boss.taps=0;R.beat={t:0,cur:0,x:R.px};R.zip=null;R.hazards=[];R.objs=R.objs.filter(o=>o.type==='vial');SFX.play('web');setHint(`연타! (탭 / 스페이스 / ↑) ×${R.boss.needTaps} — 파란 게이지를 비워라`,4);toast('FINISH HIM!');}} }
      else if(o.type==='ring'){ if(same&&(R.seg!=='swing'||Math.abs((o.y||1)-R.py)<1)){o.hit=true;SFX.play('ring');addCombo(1);R.score+=50;} }
      else if(o.type==='sign'){ if(same&&R.py>=o.band[0]&&R.py<=o.band[1]){o.hit=true;hitPlayer();} }
      else if(o.type==='proj'){ if(same&&R.state!=='slide'&&R.state!=='jump'){o.hit=true;hitPlayer();} else if(same){o.hit=true;addCombo(1);} }
      else if(o.type==='enemy'){ if(same){ const k=o.kind; let kill=false,block=false;
          if(k==='std'||k==='armed'||k==='minion')kill=R.state==='jump'||R.state==='slide'; else if(k==='armor'){kill=R.state==='slide';block=R.state==='jump';} else if(k==='fly'){kill=R.state==='jump'||(R.mods.slideFly&&R.state==='slide');}
          if(kill){SFX.play('kill');o.hit=true;R.enemies++; if(R.mods.killCombo)addCombo(R.mods.killCombo); { const ip=proj(o.lane-1,0.8,Math.max(0,dz)); impact(0.35,ip.x,ip.y,'#ffd23a'); ragdoll(o,dz); } if(k==='minion'&&R.boss&&R.boss.phase==='fight'){R.boss.hp--;R.boss.hurtT=0.35;R.score+=300;SFX.play('bomb');VOICE.boss(R.boss.fam,R.boss.hp<=0?'beat':'hurt');if(R.boss.hp<=0){R.boss.phase='beat';R.boss.tapT=6;R.boss.taps=0;R.beat={t:0,cur:0,x:R.px};R.zip=null;R.hazards=[];R.objs=R.objs.filter(x=>x.type==='vial');setHint('연타! ×10 — 무적 상태',4);toast('FINISH HIM!');}}R.score+=100*(1+teamMult(4)*0.1)*R.mods.killMul;addCombo(1);R.parts.push({x:proj((o.lane-1),0.8,0).x,y:proj(0,0.8,0).y,t:0.4,c:'#ff5a5f'});} else {o.hit=true;hitPlayer();} } }
      else if(o.type==='obs'){ if(same){ const ok=(o.kind==='low'&&R.state==='jump'&&R.py>0.5)||(o.kind==='high'&&R.state==='slide'); if(!ok){o.hit=true;hitPlayer();} } }
    }
    if(dz<-0.5&&!o.passed){o.passed=true; if((o.type==='obs'||o.type==='enemy'||o.type==='sign')&&!o.hit){ let nm=null;
        if(o.lane!==R.lane&&Math.abs(R.px-(o.lane-1))<(R.mods.sense?1.2:0.95))nm='NEAR MISS'; // 차선 전환 중 스침
        else if(o.lane===R.prevLane&&R.t-R.lastLaneT<0.5&&R.lane!==o.lane)nm='NEAR MISS';
        else if(o.type==='obs'&&o.kind==='low'&&same&&R.state==='jump'&&R.py<0.95)nm='CLOSE CALL'; // 아슬아슬 점프
        else if(o.type==='obs'&&o.kind==='high'&&same&&R.state==='slide'&&R.slideT<0.2)nm='CLOSE CALL'; // 아슬아슬 슬라이드
        else if(o.type==='sign'&&same&&(Math.abs(R.py-o.band[0])<0.35||Math.abs(R.py-o.band[1])<0.35))nm='CLOSE CALL'; // 스윙 간판 스침
        if(nm){addCombo(1);R.msg=nm;R.msgT=0.6;R.score+=30;} } }
  }
  R.objs=R.objs.filter(o=>(o.type==='proj'?o.z:o.z-pz)>-3);
  R.parts.forEach(p=>{p.t-=dt; if(p.dust){p.x+=p.vx*dt;p.y-=30*dt;} if(p.rag){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=1500*dt;p.rot+=p.vr*dt;}}); R.parts=R.parts.filter(p=>p.t>0); R.msgT-=dt;
  // 미션 체크
  if(R.mode==='story'&&!R.objDone){const m=R.ms; const v={dist:R.dist,vials:R.vials,enemies:R.enemies,combo:R.maxCombo,boss:R.bosses}[m.t]; if(v>=m.n){R.objDone=true;FX.banner('MISSION CLEAR','var(--yellow)');SFX.play('clear');$('#hObj').innerHTML=`<b style="color:var(--green)">✓ 미션 완료</b>`; if(m.t!=='boss'){R.inv=9;setTimeout(()=>{ if(R&&!R.over)finish(true,'미션 목표 달성 — 러닝 종료'); },1300);} }}
  // HUD
  $('#hScore').textContent=fmt(R.score); $('#hBuff').textContent=(R.shields?'🛡'.repeat(Math.min(3,R.shields))+' ':'')+(R.revives?'♥'.repeat(Math.min(3,R.revives))+' ':'')+(R.mods.titan==='uni'?(R.uniT>0?`★ UNI ${R.uniT.toFixed(1)}s `:`★ ${R.uniGauge}/25 `):R.mods.titan==='clones'?`분신 ${R.clones.filter(c=>c.alive).length}/2 `:R.mods.titan==='tentacle'?`촉수 ${R.tentCD>0?R.tentCD.toFixed(1)+'s':'READY'} `:''); $('#hDist').textContent=Math.floor(R.dist); $('#hVial').textContent=R.vials; $('#hEnemy').textContent=R.enemies;
  const c=$('#hCombo'); c.textContent='×'+R.combo; c.classList.toggle('on',R.combo>1);
  { let v,n,lbl; if(R.mode==='story'){ const m=R.ms; v={dist:R.dist,vials:R.vials,enemies:R.enemies,combo:R.maxCombo,boss:R.bosses}[m.t]; n=m.n; lbl=m.t==='boss'?(R.boss?`체력 ${R.boss.hp}/${R.boss.max}`:(R.bosses?'격파!':'보스 대기')):`${fmt(Math.min(v,n))} / ${fmt(n)}`; if(m.t==='boss'&&R.boss){v=R.boss.max-R.boss.hp;n=R.boss.max;} }
    else { v=R.dist; n=Math.max(1000,Math.ceil(R.dist/1000)*1000); lbl=`${fmt(R.dist)}m · 최고 ${fmt(S.stats.best)}`; }
    $('#hObjBar').style.width=(clamp(v/n,0,1)*100)+'%'; $('#hObjNum').textContent=lbl; }
  if(R.boss)$('#hBossHp').style.width=(R.boss.hp/R.boss.max*100)+'%';
}

// 그리기
function draw(){
  const col=ISSUE_ENV_COLORS[R.issue]; const sx=R.shake?rnd(-8,8)*R.shake:0, sy=R.shake?rnd(-8,8)*R.shake:0;
  ctx.save(); ctx.translate(sx,sy); R.zoomPunch=Math.max(0,(R.zoomPunch||0)-dtLast*0.5); R.zoom=lerp(R.zoom||1,(R.boss&&R.boss.phase==='beat')?1.6:1,0.1)+(R.zoomPunch||0); if(R.shake>0&&R.shakeRot){ ctx.translate(W/2,H/2); ctx.rotate(R.shakeRot*R.shake*Math.sin(R.t*60)); ctx.translate(-W/2,-H/2); } if(R.zoom>1.001){ const bp=proj(R.boss?R.boss.x:0,0.9,14); const cx=lerp(W/2,bp.x,0.6), cy=lerp(H*0.62,bp.y,0.7); ctx.translate(cx,cy); ctx.scale(R.zoom,R.zoom); ctx.translate(-cx,-cy); }
  { const v=VIEWS[R.seg]||VIEWS.run; const k=Math.min(1,dtLast*3.2); HOR=lerp(HOR,H*v.hor,k); G=lerp(G,H*v.g,k); ROLL=lerp(ROLL,FREE()?-R.px*0.07:0,k); }
  if(ROLL){ ctx.translate(W/2,H*0.7); ctx.rotate(ROLL); ctx.translate(-W/2,-H*0.7); }
  drawEnv(R.issue,R.bgOff,R.seg);
  if(R.seg==='fall'){ // 낙하: 아래로 보이는 거리(소실점) + 중심에서 퍼지는 바람 선
    { const sg=ctx.createRadialGradient(W/2,HOR,0,W/2,HOR,W*0.6); sg.addColorStop(0,'#2a2a3a'); sg.addColorStop(0.25,'#0d0f1c'); sg.addColorStop(1,'#0a0c22'); ctx.fillStyle=sg; ctx.fillRect(0,0,W,HOR+G*0.35);
      ctx.strokeStyle='#ffffff10'; ctx.lineWidth=1; for(let i=0;i<12;i++){ const a=i*Math.PI/6; ctx.beginPath(); ctx.moveTo(W/2,HOR); ctx.lineTo(W/2+Math.cos(a)*W,HOR+Math.sin(a)*W*0.5); ctx.stroke(); }
      ctx.fillStyle='#ffd23a'; for(let i=0;i<40;i++){ const a=i*2.4; const r=8+((i*37)%120); ctx.fillRect(W/2+Math.cos(a)*r,HOR+Math.sin(a)*r*0.5,2,2); } }
    ctx.save(); ctx.translate(W/2,HOR); ctx.strokeStyle='#ffffff33'; ctx.lineWidth=2; for(let i=0;i<16;i++){ const a=i*Math.PI/8+R.t*0.3; const r0=(R.bgOff*4+i*70)%500+40; ctx.beginPath(); ctx.moveTo(Math.cos(a)*r0,Math.sin(a)*r0*0.7); ctx.lineTo(Math.cos(a)*(r0+140),Math.sin(a)*(r0+140)*0.7); ctx.stroke(); } ctx.restore(); }
  if(R.seg==='wall'){ // 벽타기: 빌딩 꼭대기 하늘 + 옥상 실루엣
    const sg=ctx.createRadialGradient(W/2,HOR,10,W/2,HOR,W*0.5); sg.addColorStop(0,'#5a7cc9'); sg.addColorStop(1,'rgba(90,124,201,0)'); ctx.fillStyle=sg; ctx.fillRect(0,0,W,HOR+40);
    const tp=proj(0,0,ZF); ctx.fillStyle='#0d0f1c'; ctx.fillRect(tp.x-LW*0.62*tp.s,tp.y-8,LW*1.24*tp.s,8); }
  // 지면: 경계 앞뒤로 구간 지형을 이어서 그림
  { const pz=R.dist/2.2; const b=R.segEndZ-pz; const cur=R.seg; const nxt=R.nextBoss?'boss':R.nextSeg;
    if(b>0&&b<ZF){ drawGroundRange(nxt,b,ZF,col); drawGroundRange(cur,0,b,col); drawBoundary(cur,nxt,b); } else drawGroundRange(cur,0,ZF,col); }
  // 보스 (+ 미스테리오 분신)
  if(R.boss){ const b=R.boss; const draws=[[b.x,1]]; if(b.fam==='mysterio'&&b.decoyT>0){draws.push([b.x-1.3,0.45],[b.x+1.3,0.45]);}
    for(const [bx,al] of draws){ const p=proj(bx,0.5,14); ctx.save(); ctx.globalAlpha=al; ctx.translate(p.x,p.y); if(b.phase==='finish'){ const k=Math.min(1,b.finT/1.1); const e=k*k; ctx.translate(0,-e*H*0.9); ctx.rotate(e*Math.PI*4); ctx.scale(1-e*0.8,1-e*0.8); if(b.finT<0.1){ctx.filter='brightness(3)';} } ctx.fillStyle='#00000066'; ctx.beginPath(); ctx.ellipse(0,6,70*p.s*2,10*p.s*2,0,0,7); ctx.fill(); drawBossModel(b,p.s*3.1*(b.fam==='mysterio'?1.7:1),R.t); ctx.restore(); }
    if(b.phase!=='finish'){ // 컴팩트 게이지: 보스 머리 위
      const p=proj(b.x,3.35*(b.fam==='mysterio'?1.6:1),14); const w=150, hh=6; ctx.save(); ctx.translate(p.x,p.y); const disp=getComputedStyle(document.body).getPropertyValue('--disp');
      ctx.font=`900 15px ${disp}`; ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.lineWidth=4; ctx.strokeStyle=INK; ctx.fillStyle='#fff'; ctx.strokeText(b.name,0,-10); ctx.fillText(b.name,0,-10);
      const bar=(y,frac,col)=>{ ctx.fillStyle=INK; ctx.fillRect(-w/2-2,y-2,w+4,hh+4); ctx.fillStyle='#2b2f45'; ctx.fillRect(-w/2,y,w,hh); ctx.fillStyle=col; ctx.fillRect(-w/2,y,w*clamp(frac,0,1),hh); };
      bar(0,b.hp/b.max,'#e6202a');
      if(b.phase==='beat'){ bar(hh+5,1-b.taps/b.needTaps,'#21c6de'); ctx.fillStyle='#ffd23a'; ctx.fillRect(-w/2,hh*2+10,w*clamp(b.tapT/6,0,1),2); ctx.font=`700 11px ${getComputedStyle(document.body).getPropertyValue('--mono')}`; ctx.fillStyle='#fff'; ctx.strokeText(`연타 ${b.taps}/${b.needTaps}`,0,hh*2+26); ctx.fillText(`연타 ${b.taps}/${b.needTaps}`,0,hh*2+26); }
      else if(b.phase==='intro'){ ctx.fillStyle='#fff'; ctx.font=`700 11px ${getComputedStyle(document.body).getPropertyValue('--mono')}`; ctx.strokeText('등장 중 — 무적',0,hh+18); ctx.fillText('등장 중 — 무적',0,hh+18); }
      else { bar(hh+5,b.t/(40+R.mods.escTime),'#21c6de'); }
      ctx.restore(); }
    if(R.bubble&&R.bubble.t>0){ R.bubble.t-=dtLast; const bb=R.bubble; const p=proj(b.x+1.0,4.4*(b.fam==='mysterio'?1.5:1),14); const k=Math.min(1,(2.4-bb.t)/0.15); ctx.save(); ctx.translate(p.x,p.y); ctx.scale(k,k); ctx.font=`700 15px ${getComputedStyle(document.body).getPropertyValue('--body')}`; const tw=Math.min(300,ctx.measureText(bb.txt).width+26); const lines=[]; { let s=bb.txt,cur=''; for(const ch of s){ if(ctx.measureText(cur+ch).width>tw-24){lines.push(cur);cur=ch;} else cur+=ch; } lines.push(cur); } const th=lines.length*20+14; const spiky=bb.kind==='out'||bb.kind==='beat';
      ctx.fillStyle='#fff'; ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.beginPath(); if(spiky){ const n=18; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; const r=(i%2?1.0:1.18); ctx.lineTo(Math.cos(a)*(tw/2+10)*r,-th/2-8+Math.sin(a)*(th/2+10)*r); } ctx.closePath(); } else { ctx.roundRect(-tw/2,-th-8,tw,th,10); ctx.moveTo(-tw/2+18,-8); ctx.lineTo(-tw/2+6,14); ctx.lineTo(-tw/2+38,-8); } ctx.fill(); ctx.stroke();
      ctx.fillStyle=INK; ctx.textAlign='center'; ctx.textBaseline='middle'; lines.forEach((ln,i)=>ctx.fillText(ln,0,-th-8+th/2+(i-(lines.length-1)/2)*20)); ctx.restore(); }
    if(b.phase==='finish'&&b.finT<0.12){ ctx.fillStyle=`rgba(255,255,255,${1-b.finT/0.12})`; ctx.fillRect(-W*0.2,-H*0.2,W*1.4,H*1.4); }
    }
  drawHazards();
  if(R.boss&&R.boss.fam==='sand'&&R.boss.phase==='fight'){ const fg=ctx.createLinearGradient(0,HOR-40,0,H); fg.addColorStop(0,'rgba(217,180,122,0.05)'); fg.addColorStop(0.35,'rgba(217,180,122,0.42)'); fg.addColorStop(1,'rgba(217,180,122,0.15)'); ctx.fillStyle=fg; ctx.fillRect(0,0,W,H); }
  // 오브젝트 (먼 것부터)
  const pz=R.dist/2.2; const list=R.objs.map(o=>({o,dz:o.type==='proj'?o.z:o.z-pz})).filter(x=>x.dz>-1&&x.dz<ZF&&!x.o.hit).sort((a,b)=>b.dz-a.dz);
  for(const {o,dz} of list){const lx=o.lane-1; const y=o.y||0; const p=proj(lx,y,dz); const s=p.s*(o.type==='sign'?1:OS); ctx.save(); ctx.translate(p.x,p.y); ctx.globalAlpha=clamp((ZF-dz)/8,0,1);
    switch(o.type){
      case 'vial': ctx.fillStyle='#b26df0'; ctx.shadowColor='#b26df0'; ctx.shadowBlur=12*s; ctx.beginPath(); ctx.ellipse(0,-14*s,7*s,11*s,0,0,7); ctx.fill(); ctx.fillStyle='#fff'; ctx.fillRect(-3*s,-30*s,6*s,6*s); break;
      case 'iso': ctx.fillStyle='#f2b33d'; ctx.shadowColor='#f2b33d'; ctx.shadowBlur=18*s; ctx.rotate(R.t*2); ctx.fillRect(-12*s,-12*s,24*s,24*s); break;
      case 'bomb': case 'fakebomb': { const fake=o.type==='fakebomb'; const c=fake?'#3fbf7a':'#2fd3e6'; const rr=44*s; const bobY=Math.sin(R.t*5+o.z)*6*s; ctx.translate(0,bobY); ctx.fillStyle=c; ctx.shadowColor=c; ctx.shadowBlur=30*s; ctx.beginPath(); ctx.arc(0,-rr-6*s,rr,0,7); ctx.fill(); ctx.shadowBlur=0; ctx.strokeStyle=INK; ctx.lineWidth=5*s; ctx.stroke(); ctx.strokeStyle='#ffffffcc'; ctx.lineWidth=4*s; ctx.beginPath(); ctx.arc(0,-rr-6*s,rr*0.7,0,7); ctx.stroke(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(-rr*0.35,-rr-6*s-rr*0.4,rr*0.22,rr*0.12,-0.6,0,7); ctx.fill(); ctx.fillStyle=INK; ctx.font=`900 ${rr*0.9}px ${getComputedStyle(document.body).getPropertyValue('--disp')}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(fake?'?':'S',0,-rr-4*s); ctx.textBaseline='alphabetic'; ctx.fillStyle='#ffd23a'; ctx.strokeStyle=INK; ctx.lineWidth=3*s; ctx.beginPath(); ctx.roundRect(-30*s,-rr*2-22*s,60*s,16*s,3*s); ctx.fill(); ctx.stroke(); ctx.fillStyle=INK; ctx.font=`700 ${11*s}px ${getComputedStyle(document.body).getPropertyValue('--body')}`; ctx.fillText(fake?'FAKE?':'S.H.I.E.L.D.',0,-rr*2-10*s); break; }
      case 'ring': ctx.strokeStyle='#f2b33d'; ctx.lineWidth=6*s; ctx.shadowColor='#f2b33d'; ctx.shadowBlur=14*s; ctx.beginPath(); ctx.arc(0,-(o.y?0:60)*s,52*s,0,7); ctx.stroke(); break;
      case 'proj': ctx.fillStyle='#ffd23d'; ctx.shadowColor='#ffd23d'; ctx.shadowBlur=16*s; ctx.beginPath(); ctx.arc(0,-26*s,9*s,0,7); ctx.fill(); break;
      case 'sign': drawSwingObstacle(o,lx,dz,p); break;
      case 'obs': ctx.fillStyle='#7c8299'; if(o.kind==='low'){ctx.fillRect(-60*s,-40*s,120*s,40*s);ctx.fillStyle='#f2b33d';for(let i=0;i<4;i++)ctx.fillRect((-60+i*30)*s,-40*s,15*s,40*s);} else if(o.kind==='high'){ctx.fillRect(-64*s,-150*s,128*s,55*s);ctx.fillStyle='#3a4160';ctx.fillRect(-64*s,-95*s,10*s,95*s);ctx.fillRect(54*s,-95*s,10*s,95*s);} else {const wh=R.seg==='wall'||R.seg==='fall'?110:170;ctx.fillStyle=R.seg==='wall'||R.seg==='fall'?'#2fd3e688':'#5c6180';ctx.fillRect(-62*s,-wh*s,124*s,wh*s);ctx.strokeStyle='#d8262c';ctx.lineWidth=5*s;ctx.strokeRect(-62*s,-wh*s,124*s,wh*s);ctx.beginPath();ctx.moveTo(-50*s,-wh*s+12*s);ctx.lineTo(50*s,-12*s);ctx.moveTo(50*s,-wh*s+12*s);ctx.lineTo(-50*s,-12*s);ctx.stroke();} break;
      case 'enemy': { const k=o.kind; const c1=k==='armor'?'#8fa3bf':k==='fly'?'#b26df0':k==='armed'?'#f2b33d':'#ff5a5f'; const hy=k==='fly'?70:0; drawEnemy(o,s); ctx.fillStyle='#000a'; ctx.font=`600 ${14*s}px ${getComputedStyle(document.body).getPropertyValue('--body')}`; ctx.textAlign='center'; const lab={std:'일반',armed:'무장 ▲▼',armor:'장갑 ▼',fly:'비행 ▲',minion:'미니언 ▲▼ (보스 피해)'}[k]; ctx.lineWidth=3*s; ctx.strokeStyle=INK; ctx.strokeText(lab,0,-(hy+135)*s); ctx.fillStyle='#fff'; ctx.fillText(lab,0,-(hy+135)*s); break; }
    }
    ctx.restore(); }
  // 스피드라인
  if(R.speed>19&&!R.boss){ ctx.strokeStyle='#ffffff33'; ctx.lineWidth=2; for(let i=0;i<10;i++){ const yy=(i*97+R.bgOff*3)%H; const xx=i%2?rnd(0,W*0.25):rnd(W*0.75,W); ctx.beginPath(); ctx.moveTo(xx,yy); ctx.lineTo(xx+(i%2?-1:1)*rnd(40,140),yy); ctx.stroke(); } }
  // 타이탄 비주얼: 분신
  if(R.mods.titan==='clones'&&!R.dead){ const lanes=[0,1,2].filter(l=>l!==R.lane); R.clones.forEach((c,i)=>{ if(!c.alive)return; const cp=proj(lanes[i]-1,R.py,0); ctx.save(); ctx.translate(cp.x,cp.y); ctx.globalAlpha=0.55; ctx.scale(cp.s,cp.s); const P=heroPose(); drawHero(0,0,1.18,i?'#e93a86':'#21c6de',i?'#5b1240':'#0c6f7e',P); ctx.restore(); }); }
  // 플레이어
  { const beat=R.beat&&R.boss&&R.boss.phase==='beat'; const zc=beat?R.beat.cur:(R.zip?R.zip.cur||0:0); const bx=beat?R.beat.x:R.px; const p=proj(bx,R.py,zc); const a=R.lead.c; const P=heroPose(); const land=R.landT>0?1-R.landT/0.18:1; const sq=R.landT>0?0.82+0.18*land:1;
    if(beat&&R.beat.t<0.5){ const bp=proj(R.boss.x,1.1,14); ctx.strokeStyle=INK; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(p.x+26*p.s,p.y-118*p.s); ctx.lineTo(bp.x,bp.y); ctx.stroke(); ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.stroke(); }
    if(R.zip){ // 잔상 + 거미줄
      if(!R.zip.done){ const tz=R.zip.o.z-R.dist/2.2; const tp=proj(R.zip.o.lane-1,(R.zip.o.kind==='fly'?1.4:0.75),Math.max(0,tz)); ctx.strokeStyle=INK; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(p.x+26*p.s,p.y-118*p.s); ctx.lineTo(tp.x,tp.y); ctx.stroke(); ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.stroke(); ctx.fillStyle='#fff'; ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(tp.x,tp.y,7,0,7); ctx.fill(); ctx.stroke(); for(let i=0;i<4;i++){ const a=i*Math.PI/2+R.t*3; ctx.beginPath(); ctx.moveTo(tp.x,tp.y); ctx.lineTo(tp.x+Math.cos(a)*16,tp.y+Math.sin(a)*12); ctx.stroke(); } }
      for(let i=1;i<=3;i++){ const gp=proj(R.px,R.py,Math.max(0,zc-i*0.9)); ctx.save(); ctx.globalAlpha=0.18-i*0.04; ctx.translate(gp.x,gp.y); drawHero(0,0,gp.s,a[0],a[1],poseFor('kick',R.t,{k:1})); ctx.restore(); } }
    ctx.save(); ctx.translate(p.x,p.y); ctx.scale(p.s,p.s); if(R.inv>0&&Math.floor(R.t*12)%2)ctx.globalAlpha=0.35;
    if(R.seg==='swing'){ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-118);ctx.lineTo((holding?70:-50)+Math.sin(R.t*3)*20,-H);ctx.stroke();}
    if(R.seg==='wall'||R.seg==='fall'){ ctx.strokeStyle='#ffffff22'; ctx.lineWidth=3; for(let i=0;i<6;i++){ const yy=((i*130+R.bgOff*6)%(H+200))-200; ctx.beginPath(); ctx.moveTo(-90+i*36,yy); ctx.lineTo(-90+i*36,yy+90); ctx.stroke(); } }
    ctx.fillStyle='#00000055'; ctx.beginPath(); ctx.ellipse(0,4,46*(1+R.py*0.1),10,0,0,7); ctx.fill();
    if(R.state==='slide'){ ctx.fillStyle='#c9d1e366'; for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(-40-i*18,-6,10-i*2,0,7);ctx.fill();} }
    if(R.uniT>0){ const gr=ctx.createRadialGradient(0,-70,10,0,-70,170); gr.addColorStop(0,'rgba(255,210,58,0.55)'); gr.addColorStop(1,'rgba(255,210,58,0)'); ctx.fillStyle=gr; ctx.fillRect(-200,-260,400,320); ctx.strokeStyle='#ffd23a'; ctx.lineWidth=3; for(let i=0;i<6;i++){ const a=R.t*5+i; ctx.beginPath(); ctx.moveTo(Math.cos(a)*60,-70+Math.sin(a)*30); ctx.lineTo(Math.cos(a)*120,-70+Math.sin(a)*60); ctx.stroke(); } }
    if(R.mods.titan==='tentacle'){ for(let i=0;i<4;i++){ const side=i<2?-1:1, j=i%2; const w=Math.sin(R.t*3+i)*12; let ex=side*(60+j*30)+w, ey=-40-j*50+Math.sin(R.t*2+i)*10; if(R.tentFx&&i===(R.tentFx.lane<R.lane?0:R.tentFx.lane>R.lane?3:1)){ const tp=proj(R.tentFx.lane-1,0.6,R.tentFx.dz); const pp=proj(R.px,R.py,0); ex=(tp.x-pp.x)/1.18; ey=(tp.y-pp.y)/1.18; } ctx.strokeStyle=INK; ctx.lineWidth=13; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(side*10,-80); ctx.quadraticCurveTo(side*40,-110+j*20,ex,ey); ctx.stroke(); ctx.strokeStyle='#9aa3b8'; ctx.lineWidth=8; ctx.stroke(); ctx.strokeStyle='#e8eef8'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='#e6202a'; ctx.beginPath(); ctx.arc(ex,ey,4,0,7); ctx.fill(); } }
    if(R.spin>0){ R.spin-=dtLast; ctx.rotate(R.spin*Math.PI*4); }
    if(R.boss&&R.boss.phase==='finish'){ const k=Math.min(1,R.boss.finT/0.4); P.lLift=0.2; P.rLift=0.9; P.rSpread=-0.2; P.kick=1; P.armsUp=1; P.lArm=1.4; P.rArm=-0.5; P.lean=0.5; P.bounce=k*40; }
    P.squash=sq; drawHero(0,0,1.18,a[0],a[1],P); ctx.restore(); }
  // 파티클
  for(const p of R.parts){ ctx.globalAlpha=Math.min(1,p.t*2);
    if(p.burst){ const k=1-p.t/0.22; ctx.strokeStyle=p.c; ctx.lineWidth=4*(1-k)+1; ctx.beginPath(); ctx.moveTo(p.x+Math.cos(p.a)*p.len*k*0.6,p.y+Math.sin(p.a)*p.len*k*0.6); ctx.lineTo(p.x+Math.cos(p.a)*p.len*(0.3+k),p.y+Math.sin(p.a)*p.len*(0.3+k)); ctx.stroke(); continue; }
    if(p.rag){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.globalAlpha=Math.min(1,p.t*3); const rs=p.s*(0.55+0.45*(p.t/0.6)); drawEnemy({kind:p.kind,z:0},rs); ctx.restore(); continue; }
    if(p.txt){ ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); const k=1+(0.45-p.t)*1.2; ctx.scale(k,k); ctx.font=`900 44px ${getComputedStyle(document.body).getPropertyValue('--disp')}`; ctx.textAlign='center'; ctx.lineWidth=8; ctx.strokeStyle=INK; ctx.strokeText(p.txt,0,0); ctx.fillStyle=p.c; ctx.fillText(p.txt,0,0); ctx.restore(); } else if(p.dust){ ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,8*(p.t/0.35)+3,0,7); ctx.fill(); } else if(p.big){ const k=1-p.t/0.5; ctx.strokeStyle=p.c; ctx.lineWidth=14*(1-k)+2; ctx.beginPath(); ctx.arc(p.x,p.y,30+k*140,0,7); ctx.stroke(); } else { ctx.fillStyle=p.c; ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(1,24*(1-p.t*1.5+0.5)),0,7); ctx.fill(); } } ctx.globalAlpha=1;
  if(R.msgT>0){ctx.fillStyle='#fff';ctx.font=`900 42px ${getComputedStyle(document.body).getPropertyValue('--disp')}`;ctx.textAlign='center';ctx.fillText(R.msg,W/2,H*0.3);}
  ctx.restore();
  // --- 포스트 프로세스: 방사형 모션 블러(이전 프레임 합성) · RGB 스플릿 · 화이트 프레임 ---
  { const speedBlur=clamp((R.speed-17)/14,0,0.4); const zipBlur=(R.zip&&!R.zip.done)?0.55:0; const beatBlur=R.beat&&R.boss&&R.boss.phase==='beat'&&R.beat.t<0.5?0.5:0; const fallBlur=R.seg==='fall'?0.3:0; const blur=Math.max(speedBlur,zipBlur,beatBlur,fallBlur);
    if(blur>0&&pvValid){ ctx.save(); ctx.globalAlpha=blur; const cx=W/2, cy=HOR; const sc=1+0.035*(0.5+blur); ctx.translate(cx,cy); ctx.scale(sc,sc); ctx.translate(-cx,-cy); ctx.drawImage(pv,0,0); ctx.restore(); }
    R.rgbSplit=Math.max(0,(R.rgbSplit||0)-dtLast*1.6);
    if(R.rgbSplit>0&&pvValid){ const o=R.rgbSplit*14; ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=R.rgbSplit*0.55; ctx.drawImage(pv,-o,0); ctx.drawImage(pv,o,0); ctx.restore(); }
    if((R.whiteFrame||0)>0){ R.whiteFrame-=dtLast; ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H); }
    pvx.clearRect(0,0,W,H); pvx.drawImage(cv,0,0); pvValid=true; }
}
function drawFigure(x,y,s,c1,c2,ph,kind,state){
  ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  const sw=Math.sin(ph)*(state==='idle'?4:18); const jump=state==='jump';
  ctx.lineCap='round'; ctx.lineWidth=11;
  // 다리
  ctx.strokeStyle=c2; ctx.beginPath(); ctx.moveTo(0,-52); ctx.lineTo(-8+sw*0.6,jump?-30:-14); ctx.lineTo(-10+sw,jump?-40:0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,-52); ctx.lineTo(8-sw*0.6,jump?-30:-14); ctx.lineTo(10-sw,jump?-40:0); ctx.stroke();
  // 몸통
  ctx.fillStyle=c1; ctx.beginPath(); ctx.moveTo(-16,-52); ctx.lineTo(16,-52); ctx.lineTo(13,-100); ctx.lineTo(-13,-100); ctx.closePath(); ctx.fill();
  ctx.fillStyle=c2; ctx.fillRect(-16,-70,32,8);
  // 팔
  ctx.strokeStyle=c1; ctx.lineWidth=9; ctx.beginPath(); ctx.moveTo(-13,-96); ctx.lineTo(-24-sw*0.5,jump?-120:-74); ctx.stroke(); ctx.beginPath(); ctx.moveTo(13,-96); ctx.lineTo(24+sw*0.5,jump?-120:-74); ctx.stroke();
  // 머리
  ctx.fillStyle=c1; ctx.beginPath(); ctx.arc(0,-116,15,0,7); ctx.fill();
  if(kind==='armor'){ctx.fillStyle='#c9d1e3';ctx.fillRect(-30,-100,14,60);} if(kind==='armed'){ctx.fillStyle='#333';ctx.fillRect(14,-90,30,8);} if(kind==='fly'){ctx.strokeStyle=c1+'88';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-14,-100);ctx.lineTo(-60,-130+sw);ctx.moveTo(14,-100);ctx.lineTo(60,-130+sw);ctx.stroke();}
  ctx.restore();
}
let dtLast=0.016;
let pvValid=false; const pv=document.createElement('canvas'); pv.width=W; pv.height=H; const pvx=pv.getContext('2d'); fitCanvas();
function impact(str,x,y,col='#fff'){ // 타격감 패키지: 히트스톱 + 화면 흔들림 + 줌 펀치 + 임팩트 라인
  R.hitstop=Math.max(R.hitstop||0,0.03+str*0.09); R.shake=Math.max(R.shake,0.15+str*0.5); R.zoomPunch=Math.max(R.zoomPunch||0,0.02+str*0.06); R.shakeRot=(Math.random()-0.5)*str*0.06;
  if(x!=null){ const n=6+Math.round(str*10); for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2; R.parts.push({burst:true,x,y,a,len:40+Math.random()*90*(0.5+str),t:0.22,c:col}); } }
  if(str>=0.6)R.whiteFrame=0.06;
}
function ragdoll(o,dz){ const p=proj(o.lane-1,0,Math.max(0,dz)); R.parts.push({rag:true,kind:o.kind,x:p.x,y:p.y,s:p.s*OS,vx:(o.lane-1-R.px)*260+rnd(-160,160),vy:-rnd(420,640),rot:0,vr:rnd(-14,14),t:0.6}); }
function loop(t){ if(!R||R.over||R.paused)return; const dt=Math.max(0,Math.min(0.05,(t-lastT)/1000)); lastT=t; dtLast=dt; if((R.hitstop||0)>0){ R.hitstop-=dt; R.shake=Math.max(0,R.shake-dt*0.5); } else update(dt); draw(); if(!R||R.over)return; raf=requestAnimationFrame(loop); }

// 시작 버튼
$('#bStart').onclick=()=>{startRun('story');};
$('#bUnl').onclick=()=>{startRun('unl');};
$('#bRun').onclick=()=>{startRun('story');window.scrollTo({top:0,behavior:'smooth'});};
$('#bUnl2').onclick=()=>{startRun('unl');window.scrollTo({top:0,behavior:'smooth'});};
// 에너지 충전 (칩 클릭)
$('.chip.energy').style.cursor='pointer'; $('.chip.energy').onclick=()=>{tickEnergy(); if(S.energy>=ENERGY_MAX)return toast('에너지 가득'); if(S.iso<20)return toast('ISO-8 20 필요'); S.iso-=20;S.energy=ENERGY_MAX;S.energyAt=now();save();renderAll();toast('에너지 충전');};


// ===== 치트 / 쿠폰 코드 =====
const CODES={
  // 치트 (테스트용, 반복 사용 가능)
  WEBHEAD:{kind:'cheat',desc:'테스트용 전 재화 지급: 바이알 999,999 · ISO-8 9,999 · 에너지 풀',run(){S.vials+=999999;S.iso+=9999;S.energy=ENERGY_MAX;S.energyAt=now();}},
  MULTIVERSE:{kind:'cheat',desc:'모든 스파이더 카드 해금 (+중복 3장)',run(){CHARS.forEach(c=>{if(!S.owned[c.id])S.owned[c.id]={lv:1,xp:0,dup:3,rk:0};else S.owned[c.id].dup+=3;});}},
  TITANUP:{kind:'cheat',desc:'팀 전원 최대 레벨',run(){S.team.forEach(id=>{S.owned[id].lv=cap(id);S.owned[id].xp=0;});}},
  ALLSTAGES:{kind:'cheat',desc:'모든 이슈·모든 미션(보스전 포함) 즉시 개방 — 미션 칩을 눌러 바로 도전',run(){S.unlockAll=true; ISSUES.forEach((is,i)=>{ S.mdone['i'+i]=missionCount(i); S.done[i]=1; }); S.mission=Math.min(S.mission,missionCount(S.issue)-1);}},
  SINISTER6:{kind:'cheat',desc:'ALLSTAGES와 동일 (별칭)',run(){return CODES.ALLSTAGES.run();}},
  IMMORTAL:{kind:'cheat',desc:'무적 토글 (러닝 중 피격 무시)',run(){S.god=!S.god;return S.god?'무적 ON':'무적 OFF';}},
  ENERGYMAX:{kind:'cheat',desc:'에너지 즉시 충전',run(){S.energy=ENERGY_MAX;S.energyAt=now();}},
  WIPESAVE:{kind:'cheat',desc:'완전 초기화 (진행도 + 설정 전부)',run(){hardReset(true);}},
  // 쿠폰 (1회)
  SPIDEY2014:{kind:'coupon',desc:'출시 기념 쿠폰: ISO-8 300 · 바이알 20,000',run(){S.iso+=300;S.vials+=20000;}},
  GREATHUNT:{kind:'coupon',desc:'그레이트 헌트 쿠폰: 프리미엄 포털 10연차 분량 ISO-8 270',run(){S.iso+=270;}},
  THWIP:{kind:'coupon',desc:'거미줄 쿠폰: 언커먼 이상 랜덤 카드 1장',run(){const pool=CHARS.filter(c=>c.r==='U'||c.r==='R');const c=pool[Math.floor(Math.random()*pool.length)];gain(c);return c.name+' 획득';}},
  ISO8:{kind:'coupon',desc:'ISO-8 50',run(){S.iso+=50;}},
};
function redeem(raw){
  const code=(raw||'').trim().toUpperCase().replace(/[\s-]/g,''); const c=CODES[code]; const out=$('#codeMsg');
  if(!c){out.textContent='알 수 없는 코드입니다.';out.style.color='var(--red)';SFX.play('fail');return;}
  S.redeemed=S.redeemed||[]; if(c.kind==='coupon'&&S.redeemed.includes(code)){out.textContent='이미 사용한 쿠폰입니다.';out.style.color='var(--red)';SFX.play('fail');return;}
  const r=c.run(); if(c.kind==='coupon')S.redeemed.push(code); save(); renderAll();
  out.textContent=(c.kind==='cheat'?'[치트] ':'[쿠폰] ')+(r||c.desc)+' — 적용됨'; out.style.color='var(--green)'; SFX.play('coin'); toast(c.kind==='cheat'?'CHEAT ON':'COUPON!');
}
$('#bCode').onclick=()=>{ const d=$('#dlg'); d.innerHTML=`<div class="dlg"><div class="hdr" style="--rc:var(--yellow)"><div><div class="rar" style="color:var(--ink);text-shadow:none">Codes</div><h3 style="color:var(--ink);text-shadow:none">치트 · 쿠폰 코드</h3></div></div>
  <form id="codeForm" style="display:flex;gap:8px"><input id="codeIn" autocomplete="off" spellcheck="false" placeholder="코드 입력 (예: WEBHEAD)" style="flex:1;font:inherit;font-family:var(--mono);font-weight:700;text-transform:uppercase;padding:8px 10px;border:3px solid var(--ink);background:#fff;color:var(--ink);outline:none"><button class="btn sm amber" type="submit">적용</button></form>
  <div id="codeMsg" style="font-size:13px;font-weight:700;min-height:1.4em"></div>
  <label style="display:flex;gap:8px;align-items:center;font-size:12px"><input type="checkbox" id="ttsChk" ${VOICE.tts?'checked':''}> 보스 음성 대사(브라우저 TTS) 사용 — 기기에 <b>남성 한국어 음성</b>이 있을 때만 재생됩니다 (현재: ${VOICE.maleVoice()?'감지됨: '+VOICE.maleVoice().name:'남성 음성 없음 → 말풍선만 표시'})</label>
  <div id="ctrlbox"></div>
  <details class="fold" id="cheatFold"><summary>테스트용 치트 · 쿠폰 코드</summary><div class="foldbody">
  <div class="sub-h" style="font-size:16px;margin-top:0">테스트용 치트</div>
  <div class="tbl"><table>${Object.entries(CODES).filter(([k,v])=>v.kind==='cheat').map(([k,v])=>`<tr><td class="num" style="font-weight:700;white-space:nowrap"><button class="codebtn" data-code="${k}" style="text-decoration:underline;font-weight:700;font-family:var(--mono)">${k}</button></td><td>${v.desc}</td></tr>`).join('')}</table></div>
  <div class="sub-h" style="font-size:16px">쿠폰 (1회용)</div>
  <div class="tbl"><table>${Object.entries(CODES).filter(([k,v])=>v.kind==='coupon').map(([k,v])=>`<tr><td class="num" style="font-weight:700;white-space:nowrap"><button class="codebtn" data-code="${k}" style="text-decoration:underline;font-weight:700;font-family:var(--mono)">${k}</button>${(S.redeemed||[]).includes(k)?' <span class="tag">사용됨</span>':''}</td><td>${v.desc}</td></tr>`).join('')}</table></div>
  </div></details>
  <div class="sub-h" style="font-size:16px;color:var(--redink)">데이터</div>
  <p class="lead" style="font-size:12px">진행도(카드·재화·스토리)와 설정(사운드·보이스·조작)을 모두 지우고 처음 상태로 되돌립니다. 되돌릴 수 없습니다.</p>
  <div class="actions"><button class="btn sm" id="dReset" style="background:var(--red)">완전 초기화</button><button class="btn sm ghost" id="dClose">닫기</button></div></div>`;
  d.showModal(); renderCtrlUI(); $('#codeIn').focus(); $('#dReset').onclick=()=>hardReset(); $('#dClose').onclick=()=>d.close(); $('#ttsChk').onchange=e=>{VOICE.tts=e.target.checked; try{localStorage.setItem('wru_tts',VOICE.tts?'1':'0');}catch(_){} };
  $('#codeForm').onsubmit=e=>{e.preventDefault();redeem($('#codeIn').value);};
  d.querySelectorAll('.codebtn').forEach(b=>b.onclick=()=>{$('#codeIn').value=b.dataset.code;redeem(b.dataset.code);});
};

// ===== 조작 설정 UI =====
function renderCtrlUI(){ const el=$('#ctrlbox'); if(!el)return;
  const modes=[['auto','자동 (자이로 우선, 드래그 병행)'],['gyro','자이로만'],['drag','드래그/마우스만']];
  el.innerHTML=`<div class="sub-h" style="font-size:16px">조작 — 벽타기 · 자유낙하</div>
   <p class="lead" style="font-size:12px">이 두 구간은 3차선 스냅이 아니라 좌우로 연속 이동합니다. PC는 마우스, 모바일·태블릿은 기울이기 또는 드래그.</p>
   <div class="actions">${modes.map(([k,n])=>`<button class="btn sm ${GYRO.mode===k?'cyan':'ghost'}" data-cm="${k}">${n}</button>`).join('')}</div>
   <div class="actions" style="align-items:center"><span style="font-size:12px;font-weight:700">자이로 감도</span><input type="range" min="8" max="45" step="1" value="${GYRO.sens}" id="cmSens" style="flex:1;min-width:140px"><span class="num" id="cmSensV" style="font-size:12px">${GYRO.sens}°</span></div>
   <div class="tbl"><table><tr><th>항목</th><th>상태</th></tr>
     <tr><td>터치 기기</td><td>${isTouch?'예':'아니오 (마우스 조작)'}</td></tr>
     <tr><td>DeviceOrientation API</td><td>${window.DeviceOrientationEvent?'있음':'없음'}</td></tr>
     <tr><td>권한 요청 방식</td><td>${(window.DeviceOrientationEvent&&typeof DeviceOrientationEvent.requestPermission==='function')?'명시적 허용 필요 (iOS/iPadOS)':'자동'}</td></tr>
     <tr><td>보안 컨텍스트</td><td>${window.isSecureContext?'HTTPS ✓':'HTTP/file — 자이로 차단됨'}</td></tr>
     <tr><td>프레임</td><td>${window.self!==window.top?'iframe 내부 — 자이로가 막힐 수 있음':'최상위 창 ✓'}</td></tr>
     <tr><td>자이로 상태</td><td id="cmStat">${GYRO.status}${gyroLive()?' (신호 수신 중)':''}</td></tr></table></div>
   <div class="actions"><button class="btn sm amber" id="cmReq">자이로 권한 요청 / 다시 시도</button></div>
   <p class="lead" style="font-size:11px">자이로가 막히는 가장 흔한 원인은 페이지가 iframe 안에서 열리는 경우입니다. 이럴 땐 게임을 새 탭(최상위 창)에서 열거나, 저장한 HTML 파일을 직접 열면 됩니다. 어느 경우에도 드래그 조작은 항상 동작합니다.</p>`;
  el.querySelectorAll('[data-cm]').forEach(b=>b.onclick=()=>{ GYRO.mode=b.dataset.cm; gyroSave(); if(GYRO.mode!=='drag')requestGyro(true); renderCtrlUI(); });
  const s=el.querySelector('#cmSens'); s.oninput=()=>{ GYRO.sens=+s.value; el.querySelector('#cmSensV').textContent=GYRO.sens+'°'; gyroSave(); };
  el.querySelector('#cmReq').onclick=()=>{ GYRO.gotEvent=false; GYRO.granted=false; GYRO.bound=false; requestGyro(true); setTimeout(renderCtrlUI,2100); };
}

// ===== 완전 초기화 =====
const WRU_KEYS=[SAVE_KEY,'wru_sfx','wru_voice','wru_tts','wru_bgm','wru_ctrl','wru_vpitch','wru_vpack_url'];
function doReset(){
  try{ WRU_KEYS.forEach(k=>localStorage.removeItem(k)); }catch(e){}
  try{ localStorage.clear(); }catch(e){}
  try{ if(window.indexedDB&&indexedDB.deleteDatabase)indexedDB.deleteDatabase('wru_voicepack'); }catch(e){}
  try{ MUSIC.stop(0.2); }catch(e){}
  try{ if(R){R.over=true; R=null;} cancelAnimationFrame(raf); }catch(e){}
  try{ location.reload(); }catch(e){ location.href=location.href; }
}
// 2단계 확인 (iframe에서 confirm()이 막히는 경우 대비)
let resetArm=-1e9;
function hardReset(skipConfirm){ const b=$('#dReset'); if(skipConfirm||!b){ doReset(); return; }
  if(performance.now()-resetArm<6000){ doReset(); return; }
  resetArm=performance.now(); b.querySelector('span')?.remove();
  b.textContent='한 번 더 누르면 초기화'; b.style.background='var(--yellow)'; b.style.color='var(--ink)';
  toast('한 번 더 누르면 초기화'); SFX.play('fail');
  setTimeout(()=>{ if(document.body.contains(b)&&performance.now()-resetArm>=5900){ b.textContent='완전 초기화'; b.style.background='var(--red)'; b.style.color='#fff'; } },6000); }
