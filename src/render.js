// Patch 0.1: reuse computed font families instead of querying layout while drawing.
const renderFonts=Object.create(null);
function canvasFont(name){
  return renderFonts[name]||(renderFonts[name]=getComputedStyle(document.body).getPropertyValue(name).trim()||'sans-serif');
}
// ===== 렌더 모듈: 카툰 리그 · 보스 모델 · 환경 · 해저드 =====
const INK='#0d0f1c';
const lerp=(a,b,k)=>a+(b-a)*k;
const shade=(hex,k)=>{ // k<0 어둡게, >0 밝게
  const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255; const f=v=>Math.max(0,Math.min(255,Math.round(k<0?v*(1+k):v+(255-v)*k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };

// --- 프리미티브: 잉크 아웃라인 + 셀 셰이딩 ---
function inkPath(build,fill,lw=5,dark){ ctx.beginPath(); build(); ctx.closePath(); ctx.lineJoin='round'; ctx.lineCap='round'; ctx.strokeStyle=INK; ctx.lineWidth=lw; ctx.stroke(); ctx.fillStyle=fill; ctx.fill(); if(dark){ ctx.save(); ctx.clip(); ctx.fillStyle=dark; ctx.beginPath(); ctx.rect(-400,-400,400+dark_off,800); ctx.fill(); ctx.restore(); } }
let dark_off=0;
function limb(ax,ay,bx,by,cx,cy,w,col){ // 2세그먼트 팔다리 (잉크 → 색)
  for(const [c,lw] of [[INK,w+5],[col,w]]){ ctx.strokeStyle=c; ctx.lineWidth=lw; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.lineTo(cx,cy); ctx.stroke(); }
}
function blob(x,y,rx,ry,col,lw=5){ ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2); ctx.strokeStyle=INK; ctx.lineWidth=lw; ctx.stroke(); ctx.fillStyle=col; ctx.fill(); }

// --- 히어로 리그 ---
// pose: {bounce, lean, tilt(좌우 기울기), crouch(0..1), lLift,rLift (0..1), lSpread,rSpread, lArm,rArm (-1..1: 뒤~앞/위), armsUp(0..1), spread(0..1: 대자), face:'back'|'front'}
function poseFor(state,t,extra={}){
  const P={bounce:0,lean:0,tilt:0,crouch:0,lLift:0,rLift:0,lSpread:0,rSpread:0,lArm:0,rArm:0,armsUp:0,spread:0,face:'back',squash:1};
  const ph=t;
  switch(state){
    case 'run': { const s=Math.sin(ph); P.lLift=Math.max(0,s); P.rLift=Math.max(0,-s); P.bounce=Math.abs(Math.cos(ph))*5; P.lArm=-s*0.9; P.rArm=s*0.9; P.lean=0.08; break; }
    case 'jump': { const k=extra.k||0; /* 0=이륙,1=정점,2=착지 */ const tuck=Math.sin(Math.min(1,k)*Math.PI); P.lLift=0.9*tuck; P.rLift=0.9*tuck; P.lSpread=0.3; P.rSpread=0.3; P.armsUp=0.9; P.lArm=0.4; P.rArm=0.4; P.lean=-0.05; break; }
    case 'slide': P.crouch=1; P.lLift=0.1; P.rLift=0.6; P.lSpread=0.9; P.rSpread=0.2; P.lArm=-0.8; P.rArm=-0.8; P.lean=-0.35; break;
    case 'swing': P.armsUp=1; P.lArm=0.2; P.rArm=1; P.lLift=0.35; P.rLift=0.55; P.lSpread=0.4; P.rSpread=0.6; P.lean=-0.1; P.bounce=Math.sin(ph*0.5)*3; break;
    case 'wall': { const s=Math.sin(ph*0.8); P.face='back'; P.spread=1; P.lLift=0.5+0.3*s; P.rLift=0.5-0.3*s; P.lSpread=1; P.rSpread=1; P.lArm=0.8-0.3*s; P.rArm=0.8+0.3*s; P.armsUp=1; break; }
    case 'fall': { const s=Math.sin(ph*1.3); P.spread=1; P.lLift=0.3; P.rLift=0.3; P.lSpread=1; P.rSpread=1; P.armsUp=1; P.lArm=0.9+s*0.1; P.rArm=0.9-s*0.1; P.tilt=s*0.08; break; }
    case 'idle': { const s=Math.sin(ph); P.bounce=s*1.5; P.tilt=s*0.02; P.lArm=-0.1+s*0.05; P.rArm=-0.1-s*0.05; P.lSpread=0.2; P.rSpread=0.2; P.squash=1+s*0.01; break; }
    case 'punch': { const k=extra.k||0; P.face='back'; P.lean=0.2; P.rArm=1+k; P.armsUp=0.5; P.lArm=-0.6; P.lLift=0.2; P.rSpread=0.4; P.lSpread=0.5; break; }
    case 'kick': { const k=extra.k??1; P.lean=0.45; P.tilt=-0.12; P.lLift=0.6+0.6*k; P.lSpread=-0.15; P.rLift=0.25; P.rSpread=0.5; P.armsUp=1; P.rArm=1.35; P.lArm=-0.9; P.kick=k; break; }
    case 'beatpunch': { const k=extra.k||0; const alt=extra.alt; P.face='back'; P.lean=0.25; if(alt){ P.lLift=0.5+0.7*k; P.lSpread=-0.1; P.kick=k; P.rArm=-0.4; P.lArm=0.6; P.armsUp=0.6; } else { P.rArm=1+k*0.5; P.armsUp=0.6; P.lArm=-0.6; P.lLift=0.2; P.rSpread=0.4; P.lSpread=0.5; } P.bounce=k*6; break; }
    case 'hit': P.lean=-0.4; P.armsUp=1; P.lArm=1; P.rArm=1; P.lSpread=0.6; P.rSpread=0.6; P.lLift=0.5; break;
  }
  return Object.assign(P,extra.override||{});
}
function drawHero(x,y,s,c1,c2,P,opts={}){
  const face=P.face; const crouch=P.crouch; const sq=P.squash||1;
  ctx.save(); ctx.translate(x,y); ctx.scale(s*(2-sq),s*sq); ctx.rotate(P.tilt||0);
  ctx.translate(0,-P.bounce);
  const hipY=lerp(-58,-30,crouch), shY=lerp(-100,-58,crouch), headY=lerp(-118,-76,crouch);
  const leanX=(P.lean||0)*40; // 상체 x 이동
  const skin=c1, suit=c2, dark1=shade(c1,-0.35), dark2=shade(c2,-0.35);
  // 다리: lift에 따라 무릎 굽힘
  const leg=(side,lift,sprd,col)=>{ const hx=side*9; const kneeX=hx+side*(6+sprd*14)+(face==='back'?0:0); const kneeY=hipY+30-lift*22; const footX=hx+side*(2+sprd*22)+lift*side*8; const footY=lerp(0,-lift*26,1)+(crouch?-4:0); limb(hx,hipY,kneeX,kneeY,footX,footY,12,col); const big=(P.kick||0)>0&&lift>0.8; blob(footX,footY,big?7+10*P.kick:7,big?4+7*P.kick:4,big?shade(col,0.15):INK,big?4:0); if(big){ctx.strokeStyle='#ffffff88';ctx.lineWidth=3;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(footX-30-i*10,footY+10+i*8);ctx.lineTo(footX-8,footY+2);ctx.stroke();}} };
  // 팔: arm -1(뒤/아래) .. 1(앞/위), armsUp로 어깨 위로
  const arm=(side,v,up,col)=>{ const sx=side*15+leanX*0.4, sy=shY+2; const elX=sx+side*(14+ (1-up)*4), elY=sy+ (1-up)*22 - v*8 - up*18; const hx=elX+side*(8+v*4), hy=elY+ (1-up)*20 - v*22 - up*16; limb(sx,sy,elX,elY,hx,hy,9,col); blob(hx,hy,6,6,col,4); };
  // 순서: 뒤쪽 팔다리 → 몸통 → 앞쪽
  const backSide=face==='back'?1:-1;
  leg(backSide,backSide>0?P.rLift:P.lLift,backSide>0?P.rSpread:P.lSpread,dark2);
  arm(backSide,backSide>0?P.rArm:P.lArm,P.armsUp,dark1);
  // 몸통 (사다리꼴 + 벨트 + 셀 셰이드)
  ctx.beginPath(); ctx.moveTo(-15,hipY); ctx.lineTo(15,hipY); ctx.lineTo(13+leanX*0.5,shY-4); ctx.lineTo(-13+leanX*0.5,shY-4); ctx.closePath(); ctx.strokeStyle=INK; ctx.lineWidth=5; ctx.lineJoin='round'; ctx.stroke(); ctx.fillStyle=suit; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle=dark2; ctx.fillRect(2,hipY-60,30,80); ctx.fillStyle=skin; ctx.fillRect(-20,shY-6,44,lerp(22,10,crouch)); ctx.fillStyle=dark1; ctx.fillRect(2,shY-6,30,lerp(22,10,crouch)); ctx.fillStyle=INK; ctx.fillRect(-20,hipY-6,44,4); ctx.restore();
  // 등 웹 라인(추상): 상체 중앙 세로선
  ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(leanX*0.3,shY+16); ctx.lineTo(0,hipY-4); ctx.stroke();
  leg(-backSide,backSide>0?P.lLift:P.rLift,backSide>0?P.lSpread:P.rSpread,suit);
  arm(-backSide,backSide>0?P.lArm:P.rArm,P.armsUp,skin);
  // 목 + 머리
  ctx.strokeStyle=INK; ctx.lineWidth=8; ctx.beginPath(); ctx.moveTo(leanX*0.5,shY-2); ctx.lineTo(leanX*0.6,headY+10); ctx.stroke();
  blob(leanX*0.6,headY,16,17,skin,5); ctx.save(); ctx.beginPath(); ctx.ellipse(leanX*0.6,headY,16,17,0,0,7); ctx.clip(); ctx.fillStyle=dark1; ctx.fillRect(leanX*0.6+3,headY-20,30,40); ctx.fillStyle='#ffffff55'; ctx.beginPath(); ctx.ellipse(leanX*0.6-6,headY-7,5,3,-0.5,0,7); ctx.fill(); ctx.restore();
  if(face==='front'){ // 눈 (적/정면)
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(leanX*0.6-6,headY-1,5,7,0.2,0,7); ctx.ellipse(leanX*0.6+6,headY-1,5,7,-0.2,0,7); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.stroke();
  }
  if(opts.extra)opts.extra({hipY,shY,headY,leanX});
  ctx.restore();
}
// 상태 → 포즈 (플레이어)
function heroPose(){
  if(!R) return poseFor('idle',performance.now()/500);
  if(R.dead) return poseFor('hit',R.t);
  if(R.boss&&R.boss.phase==='beat') return poseFor('beatpunch',R.t,{k:Math.max(0,1-(R.t-(R.boss.lastTap||0))*5),alt:R.boss.taps%2===1});
  if(R.zip&&!R.zip.done) return poseFor('kick',R.t,{k:Math.min(1,R.zip.t/(R.zip.dur*0.6))});
  if(R.seg==='swing') return poseFor('swing',R.t*3);
  if(R.seg==='wall') return poseFor('wall',R.t*6);
  if(R.seg==='fall') return poseFor('fall',R.t*3);
  if(R.state==='jump'){ const k=R.vy>3?0:R.vy>-3?1:1.6; return poseFor('jump',R.t,{k:Math.min(1,Math.abs(R.py)/1.2)}); }
  if(R.state==='slide') return poseFor('slide',R.t);
  const P=poseFor('run',R.t*(10+R.speed*0.25)); P.tilt=(R.lane-1-R.px)*-0.5; return P;
}

// --- 적 모델 ---
function drawEnemy(o,s){
  const k=o.kind; const t=R.t*6+ (o.z||0);
  const bot=!!o.bot; // 울트론 센트리 — 규칙은 같고 외형만 기계
  const col=bot?({std:['#8ea6c4','#2a3446'],armed:['#c9821f','#3a2a12'],armor:['#aab6c6','#242c3a'],fly:['#2fd3e6','#123a44'],minion:['#8ea6c4','#2a3446'],sentry:['#8ea6c4','#2a3446']}[k]||['#8ea6c4','#2a3446'])
    :({std:['#ff5a5f','#5b2230'],armed:['#f6b32b','#5b3d10'],armor:['#9fb2cc','#33405a'],fly:['#a35ef2','#33184f'],minion:['#3fbf7a','#1f5a3a'],sentry:['#8ea6c4','#2a3446']}[k]||['#8ea6c4','#2a3446']);
  const P=k==='fly'?poseFor('fall',t,{override:{spread:1,armsUp:1,lLift:0.6,rLift:0.6}}):poseFor('idle',t,{override:{lArm:0.3,rArm:0.3}});
  P.face='front';
  const hy=k==='fly'?70+Math.sin(t)*8:(k==='sentry'?34+Math.sin(t*1.4)*7:0);
  ctx.save(); ctx.translate(0,-hy*s);
  if(k==='sentry'){ ctx.save(); ctx.scale(s,s); ctx.globalAlpha=0.75; for(let i=0;i<3;i++){ ctx.fillStyle=i?'#2fd3e6':'#fff'; const hgt=18+Math.random()*16; ctx.beginPath(); ctx.moveTo(-9+i*2,4); ctx.lineTo(0,4+hgt); ctx.lineTo(9-i*2,4); ctx.closePath(); ctx.fill(); } ctx.globalAlpha=1; ctx.restore(); }
  if(k==='fly'){ // 날개
    const w=Math.sin(t*2)*0.4; for(const side of[-1,1]){ ctx.save(); ctx.scale(s,s); ctx.translate(side*14,-95); ctx.rotate(side*(0.4+w)); ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(side*50,-40,side*80,-10); ctx.quadraticCurveTo(side*55,0,side*40,18); ctx.quadraticCurveTo(side*20,10,0,0); ctx.closePath(); ctx.strokeStyle=INK; ctx.lineWidth=5; ctx.stroke(); ctx.fillStyle=shade(col[0],0.2); ctx.fill(); ctx.restore(); } }
  drawHero(0,0,s*0.85,col[0],col[1],P,{extra:({shY,headY})=>{
    if(k==='armor'){ ctx.beginPath(); ctx.roundRect(-46,shY-30,34,72,6); ctx.strokeStyle=INK; ctx.lineWidth=5; ctx.stroke(); ctx.fillStyle='#d9dfef'; ctx.fill(); ctx.fillStyle='#8492b8'; ctx.fillRect(-40,shY-22,10,56); ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.strokeRect(-36,shY-14,14,40); }
    if(k==='armed'){ ctx.fillStyle='#2b2f45'; ctx.strokeStyle=INK; ctx.lineWidth=4; ctx.beginPath(); ctx.roundRect(10,shY+4,42,12,3); ctx.fill(); ctx.stroke(); ctx.fillRect(14,shY+14,8,14); ctx.fillStyle='#ffd23a'; ctx.beginPath(); ctx.arc(54,shY+10,4,0,7); ctx.fill(); }
    if(k==='minion'){ ctx.beginPath(); ctx.arc(0,headY,22,0,7); ctx.fillStyle='#cfe8ff88'; ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.stroke(); }
    if(k==='std'&&!bot){ ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-10,headY-12); ctx.lineTo(-3,headY-8); ctx.moveTo(10,headY-12); ctx.lineTo(3,headY-8); ctx.stroke(); }
    if(bot||k==='sentry'){ // 각진 두상 + 외눈 슬릿 + 가슴 코어
      inkPath(()=>{ctx.moveTo(-15,headY+11);ctx.lineTo(-17,headY-9);ctx.lineTo(-7,headY-19);ctx.lineTo(7,headY-19);ctx.lineTo(17,headY-9);ctx.lineTo(15,headY+11);ctx.lineTo(0,headY+18);},shade(col[0],0.18),4);
      ctx.fillStyle='#ff6a30'; ctx.beginPath(); ctx.ellipse(0,headY-3,11,3.5,0,0,7); ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(3,headY-3,2,0,7); ctx.fill();
      ctx.strokeStyle=INK; ctx.lineWidth=2.5; for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(i*6,headY+6); ctx.lineTo(i*6,headY+13); ctx.stroke(); }
      ctx.fillStyle='#ff6a30'; ctx.beginPath(); ctx.arc(0,shY+18,5,0,7); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=2.5; ctx.stroke(); }
  }});
  ctx.restore();
}

// --- 보스 계열 판정 ---
const FAM=n=>/울트론 MK/.test(n)?'ultron1':/울트론\(코믹스\)/.test(n)?'ultron2':/울트론 프라임/.test(n)?'ultron3':/얼티밋 울트론/.test(n)?'ultron4':/고블린|메너스/.test(n)?'goblin':/벌처/.test(n)?'vulture':/일렉트로/.test(n)?'electro':/샌드맨/.test(n)?'sand':/옥토퍼스/.test(n)?'ock':/미스테리오|미스테리온/.test(n)?'mysterio':/칸|몰런|데이모스|제닉스|솔루스/.test(n)?'inheritor':'other';
const VARIANT_PAL={
 '골드 고블린':['#f2b33d','#5a3a00'],'메너스':['#c02030','#3a0a10'],'그레이 고블린':['#8a93a8','#2b2f45'],'그린 고블린':['#4fbf5a','#5b2d8e'],'하우스 오브 M 고블린':['#2fd3e6','#1a1a4a'],
 '벌처':['#3f9a4a','#c9d1e3'],'클래식 벌처':['#3fa34d','#eeeeee'],'얼티밋 벌처':['#6b7280','#b0b8c8'],'레드 벌처':['#e6202a','#7a1015'],'다크 벌처':['#2b2f45','#111'],
 '일렉트로':['#ffd23a','#2a6cf0'],'클래식 일렉트로':['#4fbf5a','#ffd23a'],'퓨어 에너지 일렉트로':['#ffffff','#2fd3e6'],'얼티밋 일렉트로':['#2a6cf0','#111'],'모던 일렉트로':['#ffd23a','#1a1a26'],
 '샌드맨':['#d9b47a','#3a7d4e'],'클래식 샌드맨':['#e8c9a0','#3a7d4e'],'퓨어 샌드맨':['#f2e2b8','#b8905a'],'얼티밋 샌드맨':['#b08050','#2b2f45'],'샌드맨 느와르':['#8a8a8a','#222'],'다크 샌드맨':['#5a4a30','#111'],
 '챕터 1 닥터 옥토퍼스':['#3d8a3d','#e0c48a'],'클래식 닥터 옥토퍼스':['#4a9a3a','#c9d1e3'],'닥터 옥토퍼스 느와르':['#5a5a5a','#222'],'얼티밋 닥터 옥토퍼스':['#2b2f45','#c9d1e3'],'닥터 옥토퍼스':['#2a6a2a','#ffd23a'],
 '울트론 MK.1':['#9aa0ac','#c9821f'],'울트론(코믹스)':['#d5dbe8','#c02030'],'울트론 프라임':['#5a6473','#2fd3e6'],'얼티밋 울트론':['#2b3140','#b26df0'],
 '클래식 미스테리오':['#3fbf7a','#6a3fd0'],'다크 미스테리오':['#1f5a3a','#2b1f45'],'미스테리온':['#2fd3e6','#111'],'슈페리어 미스테리온':['#e6202a','#6a3fd0'],'미스테리오':['#3fbf7a','#3f9a5a'],
};
const FAM_COL={goblin:['#4fbf5a','#5b2d8e'],vulture:['#3f9a4a','#c9d1e3'],electro:['#ffd23a','#2a6cf0'],sand:['#d9b47a','#3a7d4e'],ock:['#3d8a3d','#e0c48a'],mysterio:['#3fbf7a','#6a3fd0'],inheritor:['#c02030','#1a1a26'],ultron1:['#9aa0ac','#c9821f'],ultron2:['#d5dbe8','#c02030'],ultron3:['#5a6473','#2fd3e6'],ultron4:['#2b3140','#b26df0'],other:['#8492b8','#2b2f45']};
const FAM_INFO={goblin:'녹색 가스 구름과 펌킨 폭탄을 차선에 깐다 — 표시된 차선을 피하라',vulture:'칼날 날개 장애물(부딪히면 튕겨남·콤보 끊김)과 저공 급강하(슬라이드)',electro:'두 차선에 전류를 흘린다 — 안전한 한 차선으로',sand:'모래 주먹이 바닥을 쓸어온다 — 점프로 넘어라. 모래 기둥 차선은 피할 것',ock:'문어다리 장애물이 차선을 순서대로 내려찍는다(부딪히면 튕겨남). 저공 스윕은 점프',mysterio:'거대화한 미스테리오 — 쉴드를 점프/슬라이드로 공격해야 피해. 가짜 쉴드와 장갑·눈 장식 차선을 피하라',inheritor:'모든 패턴을 섞어 쓴다 — 예고 표시를 끝까지 보라',
 ultron1:'시제기 — 한 차선에 조준 레이저를 쏜다. 느리고 예고가 길다',
 ultron2:'양손 방사포로 두 차선을 동시에 지진다 — 남은 한 차선으로. 가끔 저공 돌진(점프)',
 ultron3:'등 뒤 아암으로 차선을 순서대로 내려찍고(튕겨남), 센트리 드론을 사출한다. 예고가 짧다',
 ultron4:'분해된 나노 조각이 차선을 훑고, 코어가 전 차선 충격파를 쏜다 — 점프와 슬라이드를 번갈아. 예고가 매우 짧다',
 other:'투사체와 차선 강타'};

// Canvas-built robot armor. All four variants share joints, but have distinct silhouettes.
function drawUltronRevision(fam,t){
  const mk=fam==='ultron1', comic=fam==='ultron2', prime=fam==='ultron3', ultimate=fam==='ultron4';
  const metal=mk?'#909da8':comic?'#c0cbd5':prime?'#899daa':'#b5c5d2';
  const dark='#263440', light='#e7f2f6', red=mk?'#fa694a':'#ff3549';
  const poly=(points,fill=metal,width=2)=>inkPath(()=>points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),fill,width);
  const line=(points,col,width=2)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=col;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();};
  const plate=(points,base=metal)=>{poly(points,base);line(points.slice(0,3),light,1.2);};
  const joint=(x,y,r)=>{blob(x,y,r,r,dark,2);blob(x,y,r*.5,r*.5,'#637886',1);};
  const glow=(points,col=red,width=2.5)=>{line(points,col,width+3);line(points,'#ffced0',width*.4);};
  const bone=(a,b,w)=>{line([a,b],INK,w+3);line([a,b],dark,w);line([[a[0]-1,a[1]],[b[0]-1,b[1]]],'#9bb1bd',2);};
  ctx.save();
  // Preserve the compact game footprint: feet sit at the same origin as other humanoids.
  if(prime)ctx.translate(0,-8+Math.sin(t*1.6)*3);
  if(ultimate)ctx.scale(1.12,1.12);
  if(mk)ctx.rotate(Math.sin(t*2)*.025);
  // Final form: a split cape, independent of attack particles.
  if(ultimate){
    const wave=Math.sin(t*1.7)*7;
    poly([[-30,-126],[-47,-110],[-64,9],[-38,1],[-17,23],[-8,-88]],'#862237',3);
    poly([[30,-126],[48,-108],[72+wave,12],[44,2],[22,22],[9,-88]],'#b72f43',3);
    line([[34,-110],[43,-35],[57+wave,5]],'#ec6570',2);
    line([[-35,-112],[-44,-38],[-55,2]],'#4d1829',4);
  }
  // Six articulated back arms retain the Prime's visual attack identity.
  if(prime)for(let i=0;i<6;i++){
    const side=i<3?-1:1,j=i%3, sway=Math.sin(t*1.3+i)*6;
    const a=[side*22,-109],b=[side*(58+j*6),-132+j*31],c=[side*(91+j*9),-155+j*47+sway];
    bone(a,b,8);bone(b,c,7);joint(b[0],b[1],5);
    for(let k=1;k<5;k++){const q=k/5;line([[b[0]+(c[0]-b[0])*q-2,b[1]+(c[1]-b[1])*q-2],[b[0]+(c[0]-b[0])*q+2,b[1]+(c[1]-b[1])*q+2]],'#b1c9d6',1);}
    poly([[c[0]-5,c[1]+4],[c[0]-7,c[1]-8],[c[0],c[1]-13],[c[0]+7,c[1]-8],[c[0]+5,c[1]+4]],dark);
    glow([[c[0],c[1]-6],[c[0],c[1]]],'#68d9ee',2);
  }
  if(ultimate)for(let i=0;i<8;i++){
    const a=t*.6+i*Math.PI/4,x=Math.cos(a)*85,y=-68+Math.sin(a)*48;
    ctx.save();ctx.translate(x,y);ctx.rotate(a);poly([[-3,-5],[4,-3],[3,5],[-4,2]],i%3?dark:red,1);ctx.restore();
  }
  // Legs: exposed knee pivots, inset pistons, separate shin and thigh armor.
  for(const side of[-1,1]){
    const hx=side*12,kx=side*(mk?17:22),fx=side*(mk?20:27);
    bone([hx,-67],[kx,-35],mk?7:11);bone([kx,-35],[fx,-5],mk?6:10);
    joint(hx,-66,6);joint(kx,-34,5);
    if(!mk||side===1){
      plate([[hx-7,-64],[hx+8,-63],[kx+7,-42],[kx,-38],[kx-7,-43]]);
      plate([[kx-6,-27],[kx+7,-29],[fx+7,-8],[fx-7,-6]]);
      line([[kx,-24],[fx+1,-11]],dark,3);
    }else{for(let y=-59;y<-40;y+=6)line([[hx-4,y],[hx+5,y+1]],'#b6c3cb',2);}
    plate([[fx-7,-7],[fx+6,-7],[fx+11,1],[fx-9,1]],mk?dark:metal);
    if(!mk)glow([[hx+side*3,-57],[kx+side*3,-45]],red,1.4);
  }
  // Mechanical waist, spine and overlapping abdominal plates.
  bone([0,-112],[0,-62],12);
  for(let y=-103;y<-65;y+=7)line([[-9,y],[9,y]],'#8799a4',2);
  for(const side of[-1,1]){bone([side*20,-109],[side*10,-65],4);joint(side*10,-66,5);}
  plate([[-16,-69],[0,-74],[16,-69],[10,-57],[0,-54],[-10,-57]],dark);
  if(mk){
    plate([[-25,-121],[-4,-119],[-6,-105],[-18,-97],[-28,-107]]);
    plate([[5,-121],[23,-122],[28,-109],[16,-98],[6,-105]],'#7f929e');
    for(let i=0;i<4;i++)line([[-17,-99+i*6],[-7,-96+i*6],[7,-98+i*6],[17,-102+i*6]],'#768c97',2);
    for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(side*20,-107);ctx.bezierCurveTo(side*41,-95,side*34,-73,side*13,-69);ctx.strokeStyle='#566d79';ctx.lineWidth=2;ctx.stroke();}
    plate([[-24,-121],[-15,-122],[-18,-111],[-26,-108]],'#913c42');
  }else{
    for(let i=0;i<3;i++){const y=-98+i*10,w=17-i*2;
      plate([[-w,y],[0,y+3],[w,y],[w-2,y+9],[0,y+13],[-w+2,y+9]],i%2?shade(metal,-.18):metal);
    }
    for(const side of[-1,1]){
      ctx.save();ctx.scale(side,1);
      plate([[2,-123],[20,-130],[32,-119],[27,-104],[10,-99],[3,-106]]);
      poly([[7,-120],[20,-125],[27,-118],[21,-115]],'#eef8fa',1);
      line([[8,-106],[22,-111],[28,-119]],dark,2);
      glow([[10,-113],[23,-119]],red,1.5);
      ctx.restore();
    }
    poly([[0,-113],[7,-104],[0,-96],[-7,-104]],dark,2);
    glow([[0,-108],[0,-101]],red,2);
  }
  // Arms use their own mechanical silhouette instead of the rounded hero rig.
  for(const side of[-1,1]){
    const sy=-119,ex=side*(mk?37:44),ey=-95+Math.sin(t*1.5+side)*2;
    const hx=side*(mk?37:53),hy=mk?-72:-80+Math.sin(t*1.5+side)*2;
    bone([side*26,sy],[ex,ey],mk?7:11);bone([ex,ey],[hx,hy],mk?6:10);
    joint(side*27,sy,7);joint(ex,ey,5);
    ctx.save();ctx.translate(side*27,sy);ctx.scale(side,1);
    if(!mk||side===-1)plate([[-5,-7],[9,-11],[19,-2],[16,10],[5,12],[-6,4]],mk?'#98444b':metal);
    if(!mk){line([[1,-5],[8,-7],[15,-1]],light,1.5);line([[4,6],[13,5]],dark,2);}
    ctx.restore();
    if(!mk||side===1)plate([[ex-5,ey+3],[ex+6,ey+1],[hx+7,hy-4],[hx-7,hy-2]],mk?'#81454c':metal);
    joint(hx,hy,5);
    // Three segmented digits remain readable at gameplay size.
    for(let f=0;f<3;f++){
      const x=hx+(f-1)*4,dy=hy+5+f%2*2;
      line([[x,hy+2],[x+side*2,dy],[x+side,dy+5]],metal,2.4);
    }
    if(!mk)blob(hx,hy,2,2,red,1);
    if(mk){ctx.beginPath();ctx.moveTo(ex,ey-8);ctx.quadraticCurveTo(ex+side*13,ey+8,hx+side*5,hy+6);ctx.strokeStyle='#60717c';ctx.lineWidth=1.5;ctx.stroke();}
  }
  // Neck with visible stacked servo rings.
  bone([0,-122],[0,-139],9);for(let y=-136;y<-124;y+=4)line([[-5,y],[5,y]],'#b5c8d2',1.3);
  ctx.save();ctx.translate(mk?-2:0,-149);ctx.rotate(mk?-.09:Math.sin(t*.8)*.015);
  plate([[-15,3],[-16,-11],[-9,-23],[5,-25],[15,-16],[17,-1],[10,13],[0,18],[-11,12]]);
  poly([[-13,-7],[-5,-10],[0,-5],[6,-11],[14,-8],[11,7],[0,12],[-10,7]],dark,1.5);
  plate([[-5,-22],[3,-23],[7,-12],[1,-6],[-4,-11]],shade(metal,.12));
  glow([[-11,-5],[-6,-3],[-3,-2]],red,2.4);
  glow([[4,-2],[7,-4],[12,-6]],red,2.4);
  plate([[-13,0],[-8,3],[-6,9],[-1,12],[-2,16],[-10,11]],shade(metal,-.08));
  plate([[13,-1],[9,3],[7,9],[2,12],[2,16],[10,11]],shade(metal,-.22));
  line([[-5,7],[0,5],[5,7]],mk?'#526876':red,1.6);
  for(let x=-3;x<=3;x+=3)line([[x,8],[x,10]],'#8da0ab',1);
  if(comic||ultimate)for(const side of[-1,1]){
    plate([[side*14,-7],[side*20,-15],[side*20,-23],[side*25,-10],[side*20,3],[side*15,7]],shade(metal,-.12));
  }
  if(prime)for(const side of[-1,1])line([[side*10,-19],[side*13,-10],[side*15,-1]],light,1);
  if(mk){line([[-9,-18],[-5,-13],[-8,-9]],dark,1.8);line([[8,-20],[10,-28],[14,-27]],'#6b7f8b',2);}
  ctx.restore();ctx.restore();
}

// Patch 0.3: conservative animated silhouette bounds in model coordinates.
const BOSS_TOP={goblin:185,vulture:215,electro:210,sand:180,ock:180,mysterio:165,inheritor:180,ultron1:195,ultron2:195,ultron3:205,ultron4:215,other:165};
function bossModelScale(b,projectionScale){return projectionScale*3.1*(b.fam==='mysterio'?1.7:1);}
function bossHudAnchor(b){
  const p=proj(b.x,0.5,14);
  // Reserve 42px for the bottom-most beat label, then a 12px body gap.
  return {x:p.x,y:p.y-(BOSS_TOP[b.fam]||BOSS_TOP.other)*bossModelScale(b,p.s)-54};
}
// --- 보스 모델 ---
function drawBossModel(b,s,t){
  const fam=b.fam; const [c1,c2]=VARIANT_PAL[b.name]||FAM_COL[fam]; const c2d=shade(c2,-0.3); const bob=Math.sin(t*2.2)*6; const hurt=b.hurtT>0; const flash=hurt&&Math.floor(t*30)%2===0;
  ctx.save(); ctx.scale(s,s); ctx.translate(0,bob); const shieldPulse=Math.max(0,1-(t-(b.shieldHitAt??-99))/0.22); if(shieldPulse)ctx.translate(0,-3*Math.sin(shieldPulse*Math.PI)); if(flash){ctx.globalAlpha*=0.7;}
  const P=poseFor('idle',t*1.3,{override:{lArm:0.6,rArm:0.6,armsUp:0.3,lSpread:0.4,rSpread:0.4}}); P.face='front';
  switch(fam){
    case 'goblin': { // 글라이더
      ctx.save(); ctx.translate(0,8); ctx.rotate(Math.sin(t*2)*0.06); inkPath(()=>{ctx.moveTo(-130,0);ctx.quadraticCurveTo(-90,-40,-30,-10);ctx.lineTo(30,-10);ctx.quadraticCurveTo(90,-40,130,0);ctx.lineTo(90,18);ctx.lineTo(40,6);ctx.lineTo(0,26);ctx.lineTo(-40,6);ctx.lineTo(-90,18);},c2,6); ctx.fillStyle=c1; ctx.beginPath(); ctx.arc(-110,4,5,0,7); ctx.arc(110,4,5,0,7); ctx.fill(); ctx.fillStyle='#ff9a2b'; ctx.beginPath(); ctx.moveTo(-20,26); ctx.lineTo(0,50+Math.random()*14); ctx.lineTo(20,26); ctx.fill(); ctx.restore();
      drawHero(0,0,1,c1,c2,P,{extra:({headY})=>{ inkPath(()=>{ctx.moveTo(-18,headY-6);ctx.lineTo(-6,headY-46);ctx.lineTo(0,headY-14);ctx.lineTo(6,headY-46);ctx.lineTo(18,headY-6);},c2,4); ctx.fillStyle=c1==='#ffd23a'?'#fff':'#ffd23a'; ctx.beginPath(); ctx.ellipse(-7,headY-2,4,6,0,0,7); ctx.ellipse(7,headY-2,4,6,0,0,7); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,headY+6,8,0.2,Math.PI-0.2); ctx.stroke(); }}); break; }
    case 'vulture': { const flap=Math.sin(t*3)*0.35; for(const side of[-1,1]){ ctx.save(); ctx.translate(side*16,-96); ctx.rotate(side*(-0.15+flap)); for(let i=3;i>=0;i--){ const a=i*0.28; ctx.save(); ctx.rotate(side*a); inkPath(()=>{ ctx.moveTo(0,0); ctx.quadraticCurveTo(side*70,-50+i*6,side*(150-i*10),-20+i*8); ctx.quadraticCurveTo(side*100,10+i*6,0,22); },i%2?c2:shade(c2,-0.25),5); ctx.restore(); } ctx.restore(); }
      drawHero(0,0,1,c1,shade(c1,-0.3),P,{extra:({headY})=>{ blob(0,headY,16,17,'#e8c9a0',5); ctx.fillStyle=INK; ctx.beginPath(); ctx.moveTo(-6,headY+4); ctx.lineTo(0,headY+16); ctx.lineTo(6,headY+4); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-12,headY-6); ctx.lineTo(-3,headY-2); ctx.moveTo(12,headY-6); ctx.lineTo(3,headY-2); ctx.stroke(); ctx.fillStyle='#ffd23a'; ctx.fillRect(-20,headY+22,40,6); }}); break; }
    case 'electro': { for(let i=0;i<6;i++){ const a=t*4+i; ctx.strokeStyle=i%2?c1:'#fff'; ctx.lineWidth=3; ctx.beginPath(); let px=Math.cos(a)*30,py=-80+Math.sin(a)*20; ctx.moveTo(px,py); for(let k=0;k<5;k++){px+=(Math.random()-0.5)*40;py+=(Math.random()-0.5)*40;ctx.lineTo(px,py);} ctx.stroke(); }
      drawHero(0,0,1,c1,c2,P,{extra:({headY})=>{ inkPath(()=>{ for(let i=0;i<8;i++){ const a=-Math.PI/2+(i-3.5)*0.32; ctx.lineTo(Math.cos(a)*18,headY+Math.sin(a)*18); ctx.lineTo(Math.cos(a+0.16)*42,headY+Math.sin(a+0.16)*42);} },c1,4); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(-6,headY,4,5,0,0,7); ctx.ellipse(6,headY,4,5,0,0,7); ctx.fill(); }}); break; }
    case 'sand': { const w=Math.sin(t*1.5); inkPath(()=>{ ctx.moveTo(-70,0); ctx.quadraticCurveTo(-90,-40,-50-w*10,-70); ctx.quadraticCurveTo(-30,-90,0,-80); ctx.quadraticCurveTo(30,-90,50+w*10,-70); ctx.quadraticCurveTo(90,-40,70,0);},c1,6); for(let i=0;i<14;i++){ ctx.fillStyle=shade(c1,-0.25); ctx.beginPath(); ctx.arc(Math.sin(i*7+t)*50,-20-((i*13+t*40)%60),3,0,7); ctx.fill(); }
      drawHero(0,-30,0.95,shade(c1,0.15),c2,P,{extra:({shY,hipY})=>{ ctx.fillStyle='#111'; for(let y=shY+2;y<hipY;y+=10)ctx.fillRect(-14,y,28,4); }}); break; }
    case 'ock': { for(let i=0;i<4;i++){ const side=i<2?-1:1; const j=i%2; const a=t*1.6+i*1.5; const ex=side*(70+j*60)+Math.cos(a)*25, ey=-60-j*40+Math.sin(a)*30; ctx.strokeStyle=INK; ctx.lineWidth=16; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(side*10,-70); ctx.quadraticCurveTo(side*60,-120+j*30,ex,ey); ctx.stroke(); ctx.strokeStyle=c2; ctx.lineWidth=10; ctx.stroke(); ctx.strokeStyle=shade(c2,0.4); ctx.lineWidth=3; ctx.stroke(); inkPath(()=>{ctx.moveTo(ex-14,ey-10);ctx.lineTo(ex+2,ey-22);ctx.lineTo(ex+14,ey-6);ctx.lineTo(ex+4,ey+16);ctx.lineTo(ex-12,ey+8);},c2,4); ctx.fillStyle='#e6202a'; ctx.beginPath(); ctx.arc(ex,ey,4,0,7); ctx.fill(); }
      drawHero(0,0,1,'#e8c9a0',c1,P,{extra:({headY})=>{ ctx.fillStyle='#4b3a2a'; ctx.beginPath(); ctx.arc(0,headY-6,17,Math.PI,0); ctx.fill(); ctx.fillStyle='#3fbf7a'; ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(-16,headY-6,14,10,2); ctx.roundRect(2,headY-6,14,10,2); ctx.fill(); ctx.stroke(); }}); break; }
    case 'mysterio': { for(let i=0;i<3;i++){ const r=40+i*22+ (t*30)%22; ctx.strokeStyle=c1+Math.round((0.5-i*0.15)*255).toString(16).padStart(2,'0'); ctx.lineWidth=8; ctx.beginPath(); ctx.ellipse(0,-30,r*1.4,r*0.5,0,0,7); ctx.stroke(); }
      inkPath(()=>{ctx.moveTo(-40,-60);ctx.quadraticCurveTo(-70,20,-60,20);ctx.lineTo(60,20);ctx.quadraticCurveTo(70,20,40,-60);},c2,5);
      drawHero(0,0,1,c1,shade(c1,-0.3),P,{extra:({headY})=>{ ctx.beginPath(); ctx.arc(0,headY,26,0,7); ctx.fillStyle=shade(c1,0.6)+'cc'; ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=5; ctx.stroke(); ctx.fillStyle='#ffffffaa'; ctx.beginPath(); ctx.ellipse(-9,headY-10,7,4,-0.6,0,7); ctx.fill(); ctx.fillStyle='#ffd23a'; ctx.fillRect(-30,headY+22,60,8); }}); break; }
    case 'inheritor': { drawHero(0,0,1.15,'#c02030','#1a1a26',P,{extra:({shY,headY})=>{ ctx.strokeStyle='#ffd23a'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-10,shY+4); ctx.lineTo(0,shY+30); ctx.lineTo(10,shY+4); ctx.stroke(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(-6,headY-2,4,6,0,0,7); ctx.ellipse(6,headY-2,4,6,0,0,7); ctx.fill(); inkPath(()=>{ctx.moveTo(-40,shY-4);ctx.lineTo(-16,shY-26);ctx.lineTo(16,shY-26);ctx.lineTo(40,shY-4);ctx.lineTo(30,shY+8);ctx.lineTo(-30,shY+8);},'#c02030',5); }}); break; }
    // ── 울트론 MK.1 : 시제기. 작고 웅크린 몸, 노출 배선, 외눈 ──
    case 'ultron1': case 'ultron2': case 'ultron3': case 'ultron4':
      drawUltronRevision(fam,t); break;

    default: drawHero(0,0,1.05,c1,c2,P);
  }
  // Local impact glint: a single path, no full-screen flash or blur.
  if(shieldPulse>0){
    ctx.save();ctx.globalAlpha=shieldPulse;ctx.translate(0,-105);
    ctx.strokeStyle='#e5ffff';ctx.lineWidth=2;ctx.beginPath();
    for(let i=0;i<6;i++){const a=i*Math.PI/3;const r=9+(1-shieldPulse)*19;ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.stroke();ctx.restore();
  }
  ctx.restore();
}

// --- 보스 패턴 정의 ---
// hazard: {kind:'strike'|'low'|'high', lanes:[..], tel, dur, fam, t:0, vis}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const FAM_IDX={goblin:1,vulture:2,electro:3,sand:4,ock:5,mysterio:6,inheritor:7,ultron1:9,ultron2:10,ultron3:11,ultron4:12,other:8};
let PR=Math.random; // 패턴용 RNG (보스 시작 시 시드 고정)
function seedBossPattern(b){ b.rng=mulberry32((R.mode==='story'?R.issue:R.issue+10)*97+FAM_IDX[b.fam]*13+1); }
const PATTERNS={
  goblin(b){ const l=Math.floor(PR()*3); return [{kind:'strike',lanes:[l],tel:1.2,dur:1.6,vis:'gas'},{kind:'strike',lanes:[(l+1+Math.floor(PR()*2))%3],tel:1.9,dur:0.45,vis:'pumpkin'}]; },
  vulture(b){ return PR()<0.5?[{kind:'high',lanes:[0,1,2],tel:1.3,dur:0.5,vis:'swoop'}]:[{kind:'strike',lanes:[Math.floor(PR()*3)],tel:1.0,dur:1.4,vis:'blade',soft:true},{kind:'strike',lanes:[Math.floor(PR()*3)],tel:1.6,dur:1.4,vis:'blade',soft:true}]; },
  electro(b){ const safe=Math.floor(PR()*3); return [{kind:'strike',lanes:[0,1,2].filter(x=>x!==safe),tel:1.4,dur:0.7,vis:'arc'}]; },
  sand(b){ return PR()<0.55?[{kind:'low',lanes:[0,1,2],tel:1.2,dur:0.5,vis:'fist'}]:[{kind:'strike',lanes:[Math.floor(PR()*3)],tel:1.0,dur:1.2,vis:'pillar'}]; },
  ock(b){ if(PR()<0.35)return [{kind:'low',lanes:[0,1,2],tel:1.3,dur:0.45,vis:'sweep',soft:true}]; const order=[0,1,2].sort(()=>PR()-0.5); return order.map((l,i)=>({kind:'strike',lanes:[l],tel:0.9+i*0.45,dur:0.9,vis:'slam',soft:true})); },
  mysterio(b){ b.decoyT=3; const l=Math.floor(PR()*3); return [{kind:'strike',lanes:[l],tel:1.3,dur:0.6,vis:'smoke'},{kind:'strike',lanes:[(l+1)%3],tel:2.0,dur:1.2,vis:PR()<0.5?'glove':'eye'}]; },
  inheritor(b){ const r=PR(); return r<0.33?PATTERNS.electro(b):r<0.66?PATTERNS.ock(b):PATTERNS.sand(b); },
  // 울트론 MK.1 — 시제기: 한 차선 조준 레이저. 느리고 예고가 길다
  ultron1(b){ const l=Math.floor(PR()*3);
    const hz=[{kind:'strike',lanes:[l],tel:1.55,dur:0.8,vis:'laser'}];
    if(PR()<0.3)hz.push({kind:'strike',lanes:[(l+1+Math.floor(PR()*2))%3],tel:2.6,dur:0.7,vis:'laser'});
    return hz; },
  // 울트론(코믹스) — 양손 방사포로 두 차선 동시. 가끔 저공 돌진
  ultron2(b){ if(PR()<0.28)return [{kind:'low',lanes:[0,1,2],tel:1.15,dur:0.5,vis:'dash'}];
    const safe=Math.floor(PR()*3);
    const hz=[{kind:'strike',lanes:[0,1,2].filter(x=>x!==safe),tel:1.3,dur:0.75,vis:'barrage'}];
    if(PR()<0.4)hz.push({kind:'strike',lanes:[safe],tel:2.35,dur:0.6,vis:'barrage'});
    return hz; },
  // 울트론 프라임 — 아암 연속 강타(튕겨남) + 센트리 사출. 예고가 짧다
  ultron3(b){ b.droneT=1;
    if(PR()<0.3)return [{kind:'high',lanes:[0,1,2],tel:1.0,dur:0.5,vis:'armsweep'},{kind:'strike',lanes:[Math.floor(PR()*3)],tel:2.0,dur:0.7,vis:'armslam',soft:true}];
    const order=[0,1,2].sort(()=>PR()-0.5);
    return order.map((l,i)=>({kind:'strike',lanes:[l],tel:0.85+i*0.4,dur:0.75,vis:'armslam',soft:true})); },
  // 얼티밋 울트론 — 나노 조각이 차선을 훑고, 코어가 점프/슬라이드 충격파를 번갈아 쏜다
  ultron4(b){ b.droneT=1; const r=PR();
    if(r<0.34){ const up=PR()<0.5; return [{kind:up?'low':'high',lanes:[0,1,2],tel:0.95,dur:0.45,vis:up?'shockL':'shockH'},
                                           {kind:up?'high':'low',lanes:[0,1,2],tel:1.95,dur:0.45,vis:up?'shockH':'shockL'}]; }
    if(r<0.7){ const safe=Math.floor(PR()*3); return [{kind:'strike',lanes:[0,1,2].filter(x=>x!==safe),tel:0.95,dur:0.7,vis:'nano'},
                                                      {kind:'strike',lanes:[safe],tel:1.9,dur:0.6,vis:'nano'}]; }
    const order=[0,1,2].sort(()=>PR()-0.5);
    return [{kind:'low',lanes:[0,1,2],tel:0.9,dur:0.45,vis:'shockL'},...order.slice(0,2).map((l,i)=>({kind:'strike',lanes:[l],tel:1.8+i*0.45,dur:0.6,vis:'nano'}))]; },
  other(b){ return [{kind:'strike',lanes:[Math.floor(PR()*3)],tel:1.1,dur:0.5,vis:'debris'}]; },
};
// Finish each attack before scheduling another; particles may continue fading.
const isUltronBoss=b=>!!b&&/^ultron[1-4]$/.test(b.fam);
function bossPatternBusy(b){
  return R.hazards.some(h=>h.t<h.tel+h.dur+0.4)||
    (isUltronBoss(b)&&R.objs.some(o=>o.type==='enemy'&&o.kind==='sentry'&&!o.hit&&!o.passed&&o.z-R.dist/2.2>-.5));
}
function bossPattern(b){
  if(bossPatternBusy(b))return;
  if(!b.rng)seedBossPattern(b);
  // Drones occupy a separate recovery wave, never the only safe attack lane.
  if(isUltronBoss(b)&&b.pendingDrones){
    const n=b.pendingDrones;b.pendingDrones=0;
    for(let i=0;i<n;i++)R.objs.push({type:'enemy',kind:'sentry',lane:Math.floor(b.rng()*3),shot:false,z:R.dist/2.2+ZF*(0.75+i*0.12),hit:false,passed:false});
    return;
  }
  PR=b.rng;let hz;try{hz=PATTERNS[b.fam](b);}finally{PR=Math.random;}
  let previousEnd=0;
  hz.sort((a,b)=>a.tel-b.tel).forEach(h=>{
    h.t=0;h.fam=b.fam;h.done=false;
    h.tel*=(b.telK||1)*R.mods.telMul;h.telAdj=true;
    if(isUltronBoss(b)){
      // Apply recovery AFTER difficulty modifiers. Allow landing / a full slide.
      h.tel=Math.max(h.tel,previousEnd?previousEnd+0.45:0.9);
      previousEnd=h.tel+h.dur;
    }
    R.hazards.push(h);
  });
  if(b.droneT){b.droneT=0;b.pendingDrones=b.fam==='ultron4'?2:1;}
  if(b.fam==='mysterio'&&b.rng()<0.7){const l=Math.floor(b.rng()*3);R.objs.push({type:'fakebomb',lane:l,z:R.dist/2.2+ZF*0.8,hit:false});}
}
function updateHazards(dt){
  for(const h of R.hazards){ if(!h.telAdj){h.telAdj=true;h.tel*=R.mods.telMul;} h.t+=dt; const act=h.t>=h.tel&&h.t<h.tel+h.dur;
    // 회피 판정: 활성 직전 0.16초부터 받아주고, 한 번 피하면 그 해저드는 끝(래치).
    // 예전에는 활성 구간 내내 공중/슬라이드를 유지해야 해서 사실상 피할 수 없었다.
    const inWin=h.t>=h.tel-0.16&&h.t<h.tel+h.dur;
    if(inWin&&!h.done&&h.lanes.includes(R.lane)&&Math.abs(R.px-(R.lane-1))<0.5){
      const evade=h.kind==='low'?(R.state==='jump'&&R.py>0.25):h.kind==='high'?R.state==='slide':false;
      if(evade){ h.done=true; if(!h.evaded){h.evaded=true;addCombo(1);R.msg='NICE DODGE';R.msgT=0.6;} }
      else if(h.t>=h.tel){ h.done=true; if(h.soft)softHit(); else hitPlayer(); } }
    if(h.t>=h.tel&&!h.sfx){h.sfx=true;SFX.play(h.kind==='strike'?'bomb':'whoosh');R.shake=Math.max(R.shake,0.25);} }
  R.hazards=R.hazards.filter(h=>h.t<h.tel+h.dur+0.4);
}
function drawHazards(){
  for(const h of R.hazards){ const k=h.t/h.tel; const act=h.t>=h.tel; const fade=act?Math.max(0,1-(h.t-h.tel)/(h.dur+0.4)):1;
    for(const l of h.lanes){ const lx=l-1;
      if(!act){ // 텔레그래프: 바닥 스트라이프 + 깜빡임
        const a=proj(lx-0.45,0,1.5),b=proj(lx+0.45,0,1.5),c=proj(lx+0.45,0,9),d=proj(lx-0.45,0,9); const blink=(Math.floor(h.t*(6+k*14))%2)?0.55:0.25; ctx.fillStyle=`rgba(230,32,42,${blink*k+0.1})`; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle='#ffd23a'; ctx.lineWidth=3; ctx.setLineDash([12,8]); ctx.stroke(); ctx.setLineDash([]);
        const p=proj(lx,0,4); ctx.fillStyle='#fff'; ctx.font=`900 ${34*p.s}px ${canvasFont('--disp')}`; ctx.textAlign='center'; ctx.lineWidth=5; ctx.strokeStyle=INK; const lab=h.kind==='low'?'▲ JUMP':h.kind==='high'?'▼ SLIDE':h.soft?'⟳':'!'; ctx.strokeText(lab,p.x,p.y-40*p.s); ctx.fillText(lab,p.x,p.y-40*p.s);
        if(h.vis==='pumpkin'){ const fy=lerp(-3.5,0.4,k*k); const pp=proj(lx,Math.max(0,fy)+0.2,4); ctx.save(); ctx.translate(pp.x,pp.y); ctx.scale(pp.s,pp.s); ctx.rotate(h.t*6); blob(0,0,22,20,'#ff9a2b',5); ctx.fillStyle=INK; ctx.beginPath(); ctx.moveTo(-10,-6);ctx.lineTo(-3,-1);ctx.lineTo(-11,1);ctx.moveTo(10,-6);ctx.lineTo(3,-1);ctx.lineTo(11,1);ctx.fill(); ctx.fillRect(-9,7,18,4); ctx.restore(); }
        if(h.vis==='laser'){ const bp=proj(R.boss?R.boss.x:0,1.6,14); const tp=proj(lx,0.05,4); ctx.save(); ctx.setLineDash([10,10]); ctx.lineDashOffset=-h.t*40; ctx.strokeStyle=`rgba(201,130,31,${0.45+0.45*k})`; ctx.lineWidth=3+3*k; ctx.beginPath(); ctx.moveTo(bp.x,bp.y); ctx.lineTo(tp.x,tp.y); ctx.stroke(); ctx.restore(); ctx.strokeStyle='#c9821f'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(tp.x,tp.y,(26+10*Math.sin(h.t*10))*tp.s,0,7); ctx.stroke(); }
        if(h.vis==='nano'){ const tp=proj(lx,0.1,4); for(let i=0;i<10;i++){ const a=i*0.63+h.t*5; const rr=(90-70*k)*tp.s; ctx.fillStyle=i%2?'#b26df0':'#d7c2f5'; ctx.fillRect(tp.x+Math.cos(a)*rr-3,tp.y+Math.sin(a)*rr*0.4-3,6,6); } }
        if(h.vis==='armslam'||h.vis==='slam'){ const bp=proj(R.boss?R.boss.x:0,2.2,14); const tp=proj(lx,0.6+ (1-k)*2.5,5); ctx.strokeStyle=INK; ctx.lineWidth=18*tp.s+6; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(bp.x,bp.y); ctx.quadraticCurveTo((bp.x+tp.x)/2,tp.y-120,tp.x,tp.y); ctx.stroke(); ctx.strokeStyle='#9aa3b8'; ctx.lineWidth=18*tp.s; ctx.stroke(); }
      } else { // 발동 비주얼
        ctx.globalAlpha=fade; const p=proj(lx,0,4); ctx.save(); ctx.translate(p.x,p.y); ctx.scale(p.s,p.s);
        switch(h.vis){
          case 'pumpkin': case 'debris': case 'smoke': { const col=h.vis==='smoke'?'#3fbf7a':h.vis==='pumpkin'?'#ff9a2b':'#9aa3b8'; const r=(1-fade)*160+40; for(let i=0;i<8;i++){ const a=i*Math.PI/4+h.t; blob(Math.cos(a)*r*0.6,-20+Math.sin(a)*r*0.35,26,26,col,4); } inkPath(()=>{ for(let i=0;i<12;i++){ const a=i*Math.PI/6; const rr=i%2?r*0.5:r; ctx.lineTo(Math.cos(a)*rr,-30+Math.sin(a)*rr*0.6);} },h.vis==='smoke'?'#a8f0c8':'#ffd23a',5); break; }
          case 'gas': { const r=(1-fade)*20+70; for(let i=0;i<7;i++){ const a=i*0.9+h.t*1.5; blob(Math.cos(a)*r*0.7,-40+Math.sin(a)*r*0.35-i*4,34,30,i%2?'#4fbf5a':'#2f8a3a',4); } ctx.fillStyle='#0d0f1c'; ctx.font='900 26px sans-serif'; ctx.textAlign='center'; ctx.fillText('☠',0,-40); break; }
          case 'blade': { ctx.save(); ctx.rotate(h.t*10); for(let i=0;i<4;i++){ ctx.rotate(Math.PI/2); inkPath(()=>{ctx.moveTo(0,0);ctx.lineTo(90,-18);ctx.lineTo(110,0);ctx.lineTo(90,18);},'#c9d1e3',4); } blob(0,0,16,16,'#3f9a4a',4); ctx.restore(); break; }
          case 'glove': { inkPath(()=>{ctx.moveTo(-40,0);ctx.lineTo(-40,-70);ctx.lineTo(-25,-70);ctx.lineTo(-25,-110);ctx.lineTo(-8,-110);ctx.lineTo(-8,-75);ctx.lineTo(8,-75);ctx.lineTo(8,-120);ctx.lineTo(26,-120);ctx.lineTo(26,-75);ctx.lineTo(40,-75);ctx.lineTo(40,0);},'#3fbf7a',5); ctx.fillStyle='#ffd23a'; ctx.fillRect(-40,-12,80,12); break; }
          case 'eye': { blob(0,-60,70,40,'#6a3fd0',5); blob(0,-60,30,30,'#3fbf7a',4); blob(6,-62,12,12,INK,0); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-6,-70,6,0,7); ctx.fill(); break; }
          case 'arc': { for(let j=0;j<3;j++){ ctx.strokeStyle=j?'#ffd23a':'#fff'; ctx.lineWidth=j?6:12; ctx.beginPath(); let x=0,y=-420; ctx.moveTo(x,y); while(y<0){ x+=(Math.random()-0.5)*60; y+=40; ctx.lineTo(x,y);} ctx.stroke(); } blob(0,0,60,16,'#ffd23a',4); break; }
          case 'fist': { const ry=(1-fade)*40; inkPath(()=>{ctx.moveTo(-70,10);ctx.quadraticCurveTo(-60,-60-ry,0,-70-ry);ctx.quadraticCurveTo(60,-60-ry,70,10);},'#d9b47a',6); for(let i=0;i<3;i++){ctx.strokeStyle=INK;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-30+i*30,-60-ry);ctx.lineTo(-30+i*30,-20);ctx.stroke();} break; }
          case 'pillar': { const hh=Math.min(1,(h.t-h.tel)/0.25)*380; inkPath(()=>{ctx.moveTo(-60,10);ctx.lineTo(-50,-hh);ctx.quadraticCurveTo(0,-hh-40,50,-hh);ctx.lineTo(60,10);},'#d9b47a',6); break; }
          case 'swoop': { ctx.strokeStyle='#fff'; ctx.lineWidth=14; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.moveTo(-700+i*40,-150-i*30); ctx.quadraticCurveTo(0,-140+i*10,700-i*40,-150-i*30); ctx.stroke(); } break; }
          case 'sweep': { ctx.strokeStyle=INK; ctx.lineWidth=40; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-800,-40); ctx.lineTo(800,-40); ctx.stroke(); ctx.strokeStyle='#9aa3b8'; ctx.lineWidth=30; ctx.stroke(); break; }
          case 'laser': { const w=(1-fade)*10+16; ctx.fillStyle='#c9821f'; ctx.globalAlpha=fade*0.85; ctx.fillRect(-w/2,-460,w,470); ctx.fillStyle='#fff6d8'; ctx.fillRect(-w/6,-460,w/3,470); ctx.globalAlpha=fade; blob(0,0,w*2.2,w*0.6,'#ffd9a0',4); for(let i=0;i<7;i++){ const a=i*0.9+h.t*3; ctx.fillStyle='#ffd23a'; ctx.fillRect(Math.cos(a)*w*2.4-3,-Math.abs(Math.sin(a))*70-4,5,5); } break; }
          case 'barrage': { for(let j=0;j<3;j++){ const yy=-70-j*70; ctx.strokeStyle=j?'#c02030':'#fff'; ctx.lineWidth=j?9:16; ctx.beginPath(); ctx.moveTo(-60,yy-140); ctx.lineTo(0,yy); ctx.lineTo(60,yy-140); ctx.stroke(); } inkPath(()=>{ for(let i=0;i<10;i++){ const a=i*Math.PI/5; const rr=i%2?34:78; ctx.lineTo(Math.cos(a)*rr,-16+Math.sin(a)*rr*0.55);} },'#e6202a',5); blob(0,-16,22,16,'#ffd9dc',4); break; }
          case 'dash': { ctx.strokeStyle='#d5dbe8'; ctx.lineWidth=16; ctx.lineCap='round'; for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(-820+i*30,-58-i*16); ctx.lineTo(820-i*30,-58-i*16); ctx.stroke(); } inkPath(()=>{ctx.moveTo(-70,-30);ctx.lineTo(30,-64);ctx.lineTo(96,-30);ctx.lineTo(30,4);},'#d5dbe8',5); blob(46,-30,10,10,'#c02030',3); break; }
          case 'armsweep': { ctx.strokeStyle=INK; ctx.lineWidth=46; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-820,-120); ctx.lineTo(820,-120); ctx.stroke(); ctx.strokeStyle='#5a6473'; ctx.lineWidth=34; ctx.stroke(); ctx.strokeStyle='#2fd3e6'; ctx.lineWidth=6; ctx.stroke(); break; }
          case 'shockL': case 'shockH': { const hi=h.vis==='shockH'; const yy=hi?-190:-10; const r=(1-fade)*300+60; for(let j=0;j<3;j++){ ctx.strokeStyle=j?'#b26df0':'#fff'; ctx.lineWidth=j?10:18; ctx.globalAlpha=fade*(j?0.7:1); ctx.beginPath(); ctx.ellipse(0,yy,r-j*26,(r-j*26)*0.26,0,0,7); ctx.stroke(); } ctx.globalAlpha=fade; ctx.fillStyle='#fff'; ctx.font='900 30px sans-serif'; ctx.textAlign='center'; ctx.fillText(hi?'▼':'▲',0,yy+10); break; }
          case 'nano': { const r=(1-fade)*140+50; for(let i=0;i<16;i++){ const a=i*0.4+h.t*6; const rr=r*(0.5+((i*7)%5)/8); ctx.save(); ctx.translate(Math.cos(a)*rr,-40+Math.sin(a)*rr*0.5); ctx.rotate(a*2); const sz=5+((i*3)%7); inkPath(()=>{ctx.moveTo(-sz,-sz*0.6);ctx.lineTo(sz,-sz);ctx.lineTo(sz*0.7,sz);ctx.lineTo(-sz*0.8,sz*0.7);},i%3?'#b26df0':'#e2d4f7',3); ctx.restore(); } break; }
          case 'armslam': { inkPath(()=>{ for(let i=0;i<10;i++){ const a=i*Math.PI/5; const rr=i%2?44:96; ctx.lineTo(Math.cos(a)*rr,-20+Math.sin(a)*rr*0.5);} },'#2fd3e6',5); const bp2=proj(R.boss?R.boss.x:0,2.4,14); ctx.restore(); ctx.save(); ctx.strokeStyle=INK; ctx.lineWidth=20*p.s+6; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(bp2.x,bp2.y); ctx.quadraticCurveTo((bp2.x+p.x)/2,p.y-170,p.x,p.y-20); ctx.stroke(); ctx.strokeStyle='#5a6473'; ctx.lineWidth=20*p.s; ctx.stroke(); ctx.strokeStyle='#2fd3e6'; ctx.lineWidth=4*p.s; ctx.stroke(); break; }
          case 'slam': { inkPath(()=>{ for(let i=0;i<10;i++){ const a=i*Math.PI/5; const rr=i%2?40:90; ctx.lineTo(Math.cos(a)*rr,-20+Math.sin(a)*rr*0.5);} },'#fff',5); const bp=proj(R.boss?R.boss.x:0,2.2,14); ctx.restore(); ctx.save(); ctx.strokeStyle=INK; ctx.lineWidth=18*p.s+6; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(bp.x,bp.y); ctx.quadraticCurveTo((bp.x+p.x)/2,p.y-160,p.x,p.y-20); ctx.stroke(); ctx.strokeStyle='#9aa3b8'; ctx.lineWidth=18*p.s; ctx.stroke(); break; }
        }
        ctx.restore(); ctx.globalAlpha=1;
      }
    }
  }
}

// --- 환경 (이슈별) ---
function drawEnv(issue,off,seg){
  const col=ISSUE_ENV_COLORS[issue]; const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,col[0]); g.addColorStop(0.45,col[1]); g.addColorStop(1,'#05070f'); ctx.fillStyle=g; ctx.fillRect(-10,-10,W+20,H+20);
  const par=(k,fn)=>{ const span=W+300; for(let i=0;i<14;i++){ const x=((i*211-off*k)%span+span)%span-150; fn(x,i); } };
  switch(issue){
    case 0: // 옥상: 물탱크·안테나
      ctx.fillStyle='#0a0f22'; par(0.12,(x,i)=>{const bh=80+((i*91)%150);ctx.fillRect(x,HOR-bh,90+((i*37)%60),bh+8);});
      ctx.fillStyle='#141b3a'; par(0.3,(x,i)=>{ if(i%2)return; const bh=30+((i*53)%50);ctx.fillRect(x,HOR-bh,110,bh+8); if(i%4===0){ctx.fillRect(x+30,HOR-bh-40,34,40);ctx.fillRect(x+26,HOR-bh-44,42,6);ctx.fillRect(x+34,HOR-bh-58,26,14);} if(i%4===2){ctx.fillRect(x+80,HOR-bh-60,3,60);ctx.fillRect(x+70,HOR-bh-50,23,2);}});
      break;
    case 1: // 하이라인·오스코프 타워
      ctx.fillStyle='#0a1a2e'; par(0.1,(x,i)=>{const bh=120+((i*91)%200);ctx.fillRect(x,HOR-bh,70,bh+8);});
      ctx.fillStyle='#0f2a44'; ctx.fillRect(W*0.62-((off*0.05)%40),HOR-330,150,340); ctx.fillStyle='#21c6de'; for(let y=0;y<14;y++)ctx.fillRect(W*0.62-((off*0.05)%40)+10,HOR-320+y*22,130,3);
      ctx.fillStyle='#1c3a5a'; par(0.35,(x,i)=>{ctx.fillRect(x,HOR-30,180,38); for(let k=0;k<5;k++)ctx.fillRect(x+k*36,HOR-60,6,30);});
      ctx.fillStyle='#fff'; par(0.6,(x,i)=>{ if(i%3===0){const y=HOR-200-((i*47)%120)+Math.sin(off/200+i)*10; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+8,y-4); ctx.lineTo(x+16,y); ctx.lineTo(x+8,y+2); ctx.fill(); } });
      break;
    case 2: // 전력망: 철탑·전선·스파크
      ctx.fillStyle='#0f0f24'; par(0.1,(x,i)=>{const bh=60+((i*91)%120);ctx.fillRect(x,HOR-bh,80,bh+8);});
      ctx.strokeStyle='#2a2a5a'; ctx.lineWidth=6; par(0.3,(x,i)=>{ ctx.beginPath(); ctx.moveTo(x,HOR+10); ctx.lineTo(x+30,HOR-220); ctx.lineTo(x+60,HOR+10); ctx.moveTo(x-20,HOR-160); ctx.lineTo(x+80,HOR-160); ctx.moveTo(x-10,HOR-100); ctx.lineTo(x+70,HOR-100); ctx.stroke(); });
      ctx.strokeStyle='#4a4a8a'; ctx.lineWidth=2; par(0.3,(x,i)=>{ ctx.beginPath(); ctx.moveTo(x-20,HOR-160); ctx.quadraticCurveTo(x+85,HOR-120,x+191,HOR-160); ctx.stroke(); });
      if(Math.random()<0.15){ctx.fillStyle='#ffd23a';const sx=Math.random()*W;ctx.fillRect(sx,HOR-160+Math.random()*40,4,4);}
      break;
    case 3: // 공사장·모래 안개
      ctx.fillStyle='#241a0f'; par(0.1,(x,i)=>{const bh=70+((i*91)%140);ctx.fillRect(x,HOR-bh,90,bh+8);});
      ctx.strokeStyle='#f6b32b'; ctx.lineWidth=5; par(0.28,(x,i)=>{ if(i%2)return; ctx.beginPath(); ctx.moveTo(x,HOR+10); ctx.lineTo(x,HOR-260); ctx.lineTo(x+220,HOR-260); ctx.moveTo(x+160,HOR-260); ctx.lineTo(x+160,HOR-200); ctx.stroke(); ctx.fillStyle='#3a2a1a'; ctx.fillRect(x+150,HOR-200,20,30); });
      const fog=ctx.createLinearGradient(0,HOR-80,0,H); fog.addColorStop(0,'rgba(217,180,122,0)'); fog.addColorStop(0.5,'rgba(217,180,122,0.25)'); fog.addColorStop(1,'rgba(217,180,122,0)'); ctx.fillStyle=fog; ctx.fillRect(0,HOR-80,W,H);
      break;
    case 4: // 옥토퍼스 거대 기계: 회전 기어
      ctx.fillStyle='#101014'; ctx.fillRect(0,0,W,HOR+10);
      const gear=(x,y,r,teeth,rot,col)=>{ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); ctx.fillStyle=col; ctx.beginPath(); for(let i=0;i<teeth*2;i++){ const a=i*Math.PI/teeth; const rr=i%2?r:r*1.18; ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);} ctx.closePath(); ctx.fill(); ctx.fillStyle='#101014'; ctx.beginPath(); ctx.arc(0,0,r*0.35,0,7); ctx.fill(); ctx.restore(); };
      par(0.15,(x,i)=>{ gear(x,HOR-120-((i*67)%160),50+((i*31)%60),10,off/400*(i%2?1:-1)+i,'#2a2a3a'); });
      par(0.3,(x,i)=>{ if(i%2)gear(x,HOR-40,70,12,off/250*(i%3?1:-1),'#3a3a4a'); });
      ctx.fillStyle='#3fbf7a'; par(0.3,(x,i)=>{ if(i%2)ctx.fillRect(x-2,HOR-40-2,4,4); });
      break;
    case 5: // 우주선 내부: 아치 리브 + 녹색 조명
      ctx.fillStyle='#1a0f24'; ctx.fillRect(0,0,W,HOR+10);
      for(let i=0;i<10;i++){ const z=((i*4.2-(off/22)%4.2)+0.5); if(z<0.3)continue; const p=proj(0,0,z); const s=p.s; ctx.strokeStyle='#4a1f6e'; ctx.lineWidth=22*s+2; ctx.beginPath(); ctx.moveTo(W/2-W*0.75*s,HOR+G*s); ctx.lineTo(W/2-W*0.75*s,HOR-H*0.5*s); ctx.quadraticCurveTo(W/2,HOR-H*0.9*s,W/2+W*0.75*s,HOR-H*0.5*s); ctx.lineTo(W/2+W*0.75*s,HOR+G*s); ctx.stroke(); ctx.strokeStyle='#b26df0'; ctx.lineWidth=4*s+1; ctx.stroke(); ctx.fillStyle='#3fbf7a'; ctx.fillRect(W/2-6*s,HOR-H*0.9*s+8*s,12*s,12*s); }
      break;
    case 6: { // 울트론 점령 도시: 부서진 스카이라인 + 센트리 편대 + 탐조등
      ctx.fillStyle='#080b12'; par(0.09,(x,i)=>{ const bh=110+((i*91)%210); ctx.fillRect(x,HOR-bh,74+((i*29)%40),bh+8);
        if(i%3===0){ ctx.save(); ctx.translate(x+20,HOR-bh); ctx.rotate(-0.25); ctx.fillRect(0,-40,52,44); ctx.restore(); } });
      ctx.fillStyle='#141c2c'; par(0.2,(x,i)=>{ if(i%2)return; const bh=60+((i*53)%110); ctx.fillRect(x,HOR-bh,96,bh+8);
        ctx.fillStyle='#ff6a3033'; for(let y=0;y<Math.floor(bh/26);y++)if((i+y)%3===0)ctx.fillRect(x+12,HOR-bh+10+y*26,70,8); ctx.fillStyle='#141c2c'; });
      // 탐조등
      ctx.save(); ctx.globalAlpha=0.13; for(let i=0;i<3;i++){ const a=Math.sin(off/900+i*2)*0.5; const bx=W*(0.2+i*0.3); ctx.fillStyle='#8ea6c4'; ctx.beginPath(); ctx.moveTo(bx,HOR); ctx.lineTo(bx+Math.sin(a)*300-120,-40); ctx.lineTo(bx+Math.sin(a)*300+120,-40); ctx.closePath(); ctx.fill(); } ctx.restore();
      // 센트리 편대 실루엣
      par(0.5,(x,i)=>{ if(i%2)return; const y=HOR-220-((i*61)%170)+Math.sin(off/150+i)*12; const sc=0.5+((i*7)%4)*0.16;
        ctx.save(); ctx.translate(x,y); ctx.scale(sc,sc); ctx.fillStyle='#2a3446';
        ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(-6,-13); ctx.lineTo(6,-13); ctx.lineTo(16,0); ctx.lineTo(6,9); ctx.lineTo(-6,9); ctx.closePath(); ctx.fill();
        ctx.fillRect(-30,-3,14,5); ctx.fillRect(16,-3,14,5);
        ctx.fillStyle='#ff6a30'; ctx.fillRect(-4,-6,8,3); ctx.restore(); });
      const haze=ctx.createLinearGradient(0,HOR-140,0,H); haze.addColorStop(0,'rgba(142,166,196,0)'); haze.addColorStop(0.45,'rgba(142,166,196,0.16)'); haze.addColorStop(1,'rgba(142,166,196,0)'); ctx.fillStyle=haze; ctx.fillRect(0,HOR-140,W,H);
      break; }
  }
}

// --- 지면/협곡 구간 렌더 (z 범위) ---
function drawGroundRange(type,z0,z1,col){
  const q=(xl,xr,zz0,zz1,fill)=>{ const a=proj(xl,0,zz0),b=proj(xr,0,zz0),c=proj(xr,0,zz1),d=proj(xl,0,zz1); ctx.fillStyle=fill; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); ctx.fill(); };
  if(type==='swing'){
    q(-1.9,1.9,z0,z1,'#04060f'); // 협곡 바닥(어둠)
    for(const side of[-1,1]){ // 빌딩 벽면: 바닥에서 위로
      const a=proj(side*1.9,0,z0),b=proj(side*1.9,0,z1),c=proj(side*1.9,4.2,z1),d=proj(side*1.9,4.2,z0);
      ctx.fillStyle='#101736'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.stroke();
      // 창문 격자 (원근)
      const zs=Math.ceil(z0/3)*3; for(let zz=zs;zz<z1;zz+=3){ for(let yy=0.4;yy<4;yy+=0.8){ const p1=proj(side*1.9,yy,zz),p2=proj(side*1.9,yy+0.45,zz),p3=proj(side*1.9,yy+0.45,zz+1.6),p4=proj(side*1.9,yy,zz+1.6); ctx.fillStyle=((zz*7+Math.floor(yy*3))%5===0)?'#ffd23a55':'#1c2a5a'; ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y); ctx.closePath(); ctx.fill(); } }
      // 돌출 선반
      for(let zz=Math.ceil(z0/12)*12;zz<z1;zz+=12){ const p1=proj(side*1.9,2.0,zz),p2=proj(side*1.6,2.0,zz),p3=proj(side*1.6,2.0,zz+2),p4=proj(side*1.9,2.0,zz+2); ctx.fillStyle='#2a3768'; ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.stroke(); }
    }
    // 가로지르는 케이블
    for(let zz=Math.ceil(z0/9)*9;zz<z1;zz+=9){ const p1=proj(-1.9,3.6,zz),p2=proj(1.9,3.6,zz); ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.quadraticCurveTo((p1.x+p2.x)/2,p1.y+40*p1.s,p2.x,p2.y); ctx.stroke(); }
    return;
  }
  const base=type==='wall'?'#26305a':type==='fall'?'#0a0d1d':'#1c2447';
  q(-1.7,1.7,z0,z1,base);
  if(type==='wall'){ // 벽면(창문 격자가 아래로 흐름)
    for(let zz=Math.ceil(z0/3)*3;zz<z1;zz+=3){ for(const lx of[-1.6,-1,-0.4,0.4,1,1.6]){ const p1=proj(lx-0.3,0,zz),p2=proj(lx+0.3,0,zz),p3=proj(lx+0.3,0,zz+1.5),p4=proj(lx-0.3,0,zz+1.5); ctx.fillStyle=((zz+lx)%4===0)?'#ffd23a44':'#141b3a'; ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y); ctx.closePath(); ctx.fill(); } } }
  // 차선 & 스트라이프
  ctx.strokeStyle='#ffffff22'; ctx.lineWidth=2; for(const lx of[-0.5,0.5]){const a=proj(lx,0,z0),b=proj(lx,0,z1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  ctx.strokeStyle=col[2]+'88'; ctx.lineWidth=4; for(const lx of[-1.7,1.7]){const a=proj(lx,0,z0),b=proj(lx,0,z1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  ctx.strokeStyle='#ffffff10'; ctx.lineWidth=1; const off=(R.dist/2.2)%4; for(let z=4-off;z<z1;z+=4){ if(z<z0)continue; const a=proj(-1.7,0,z),b=proj(1.7,0,z);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  if(type==='run'||type==='boss'){ // 옥상 가장자리 난간
    for(const side of[-1,1]){ const a=proj(side*1.75,0,z0),b=proj(side*1.75,0,z1),c=proj(side*1.75,0.18,z1),d=proj(side*1.75,0.18,z0); ctx.fillStyle='#2a3768'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=2; ctx.stroke(); }
  }
}
// 구간 경계 구조물
function drawBoundary(cur,nxt,b){
  const p=proj(0,0,b); const s=p.s;
  const stripeBar=(y0,y1)=>{ const a=proj(-1.75,y0,b),c=proj(1.75,y0,b),d=proj(1.75,y1,b),e=proj(-1.75,y1,b); ctx.fillStyle='#ffd23a'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.lineTo(e.x,e.y); ctx.closePath(); ctx.fill(); ctx.save(); ctx.clip(); ctx.fillStyle=INK; const w=(c.x-a.x); for(let x=0;x<w;x+=40*s+8){ ctx.beginPath(); ctx.moveTo(a.x+x,e.y); ctx.lineTo(a.x+x+18*s+4,e.y); ctx.lineTo(a.x+x+8*s+2,a.y); ctx.lineTo(a.x+x-10*s-2,a.y); ctx.closePath(); ctx.fill(); } ctx.restore(); ctx.strokeStyle=INK; ctx.lineWidth=3; ctx.stroke(); };
  if(nxt==='swing'||nxt==='fall'){ stripeBar(0,0.28); // 옥상 끝 난간
    ctx.font=`900 ${40*s+6}px ${canvasFont('--disp')}`; ctx.textAlign='center'; ctx.lineWidth=5; ctx.strokeStyle=INK; ctx.fillStyle='#fff'; const t=nxt==='swing'?'↑ WEB-SWING':'↓ FREE FALL'; ctx.strokeText(t,p.x,p.y-60*s-10); ctx.fillText(t,p.x,p.y-60*s-10); }
  else if(nxt==='wall'){ // 다가오는 빌딩 외벽
    const a=proj(-2.6,0,b),c=proj(2.6,0,b),d=proj(2.6,7,b),e=proj(-2.6,7,b); ctx.fillStyle='#26305a'; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.lineTo(e.x,e.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle=INK; ctx.lineWidth=4; ctx.stroke();
    for(let yy=0.5;yy<7;yy+=1){ for(let xx=-2.2;xx<2.6;xx+=0.8){ const p1=proj(xx,yy,b),p2=proj(xx+0.5,yy+0.6,b); ctx.fillStyle=((xx*3+yy*5)|0)%3===0?'#ffd23a44':'#141b3a'; ctx.fillRect(p1.x,p2.y,p2.x-p1.x,p1.y-p2.y); } }
    ctx.font=`900 ${40*s+6}px ${canvasFont('--disp')}`; ctx.textAlign='center'; ctx.lineWidth=5; ctx.strokeStyle=INK; ctx.fillStyle='#fff'; ctx.strokeText('↑ WALL-CRAWL',p.x,p.y-200*s-10); ctx.fillText('↑ WALL-CRAWL',p.x,p.y-200*s-10); }
  else if(cur==='swing'||cur==='fall'||cur==='wall'){ stripeBar(0,0.22); // 착지 옥상 시작
    ctx.font=`900 ${34*s+6}px ${canvasFont('--disp')}`; ctx.textAlign='center'; ctx.lineWidth=5; ctx.strokeStyle=INK; ctx.fillStyle='#fff'; ctx.strokeText('ROOFTOP',p.x,p.y-50*s-8); ctx.fillText('ROOFTOP',p.x,p.y-50*s-8); }
}
// 스윙 구간 장애물 모델 (빌보드 / 크레인 빔)
function drawSwingObstacle(o,lx,dz,p){
  const [a,b]=o.band; const s=p.s;
  if(o.kind==='crane'){ const x0=o.lanes[0]-1,x1=o.lanes[1]-1; const yb=(a+b)/2; const p1=proj(x0-0.45,yb,dz),p2=proj(x1+0.45,yb,dz); const th=Math.max(6,(proj(0,b,dz).y-proj(0,a,dz).y)*-0.5);
    ctx.save(); ctx.translate(-p.x,-p.y); // 절대 좌표로
    ctx.strokeStyle=INK; ctx.lineWidth=th+8; ctx.lineCap='butt'; ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke(); ctx.strokeStyle='#f6b32b'; ctx.lineWidth=th; ctx.stroke();
    ctx.strokeStyle=INK; ctx.lineWidth=3; const n=8; for(let i=0;i<=n;i++){ const x=p1.x+(p2.x-p1.x)*i/n; ctx.beginPath(); ctx.moveTo(x,p1.y-th/2); ctx.lineTo(x+(i%2?th:-th)*0.6,p1.y+th/2); ctx.stroke(); }
    const hookX=(p1.x+p2.x)/2; ctx.beginPath(); ctx.moveTo(hookX,p1.y+th/2); ctx.lineTo(hookX,p1.y+th/2+40*s); ctx.stroke(); ctx.strokeStyle=INK; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(hookX,p1.y+th/2+52*s,12*s,-Math.PI/2,Math.PI*0.9); ctx.stroke();
    ctx.font=`900 ${Math.max(10,22*s)}px sans-serif`; ctx.fillStyle=INK; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b>3?'↓ 아래로':'↑ 위로',hookX,p1.y); ctx.restore(); return; }
  const top=proj(lx,b,dz).y-p.y, bot=proj(lx,a,dz).y-p.y; const w=150*s;
  // 기둥
  ctx.strokeStyle=INK; ctx.lineWidth=10*s+2; ctx.beginPath(); ctx.moveTo(-w*0.35,bot); ctx.lineTo(-w*0.35,bot+60*s); ctx.moveTo(w*0.35,bot); ctx.lineTo(w*0.35,bot+60*s); ctx.stroke(); ctx.strokeStyle='#7c8299'; ctx.lineWidth=6*s; ctx.stroke();
  // 보드
  ctx.fillStyle=INK; ctx.fillRect(-w/2-6*s,top-6*s+8*s,w+12*s,(bot-top)+12*s); ctx.fillStyle='#d8262c'; ctx.fillRect(-w/2,top,w,bot-top); ctx.fillStyle='#fff'; ctx.fillRect(-w/2+10*s,top+10*s,w-20*s,(bot-top)-20*s);
  ctx.fillStyle='#d8262c'; ctx.font=`900 ${Math.max(9,Math.min(30*s,(bot-top)*0.4))}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(b>3?'↓ 아래로':'↑ 위로',0,(top+bot)/2);
  // 조명
  ctx.fillStyle='#ffd23a'; ctx.strokeStyle=INK; ctx.lineWidth=2; for(const x of[-w*0.3,0,w*0.3]){ ctx.beginPath(); ctx.arc(x,top-4*s,6*s,0,7); ctx.fill(); ctx.stroke(); }
}
