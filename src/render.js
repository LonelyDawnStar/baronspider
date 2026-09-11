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
const FAM=n=>BND_NAMES.includes(n)?BND_FAMS[BND_NAMES.indexOf(n)]:NWH_NAMES.includes(n)?NWH_FAMS[NWH_NAMES.indexOf(n)]:FFH_NAMES.includes(n)?FFH_FAMS[FFH_NAMES.indexOf(n)]:endgameStage(n)?'thanosEnd':({'쇼커':'shocker','모던 벌쳐':'vultureModern','프록시마 미드나이트':'proxima','콜버스 글레이브':'corvus','컬 옵시디언':'cull','에보니 모':'maw','타노스(미완)':'thanos0'}[n])||(/울트론 MK/.test(n)?'ultron1':/울트론\(코믹스\)/.test(n)?'ultron2':/울트론 프라임/.test(n)?'ultron3':/얼티밋 울트론/.test(n)?'ultron4':/고블린|메너스/.test(n)?'goblin':/벌처/.test(n)?'vulture':/일렉트로/.test(n)?'electro':/샌드맨/.test(n)?'sand':/옥토퍼스/.test(n)?'ock':/미스테리오|미스테리온/.test(n)?'mysterio':/칸|몰런|데이모스|제닉스|솔루스/.test(n)?'inheritor':'other');
const VARIANT_PAL={
 '골드 고블린':['#f2b33d','#5a3a00'],'메너스':['#c02030','#3a0a10'],'그레이 고블린':['#8a93a8','#2b2f45'],'그린 고블린':['#4fbf5a','#5b2d8e'],'하우스 오브 M 고블린':['#2fd3e6','#1a1a4a'],
 '벌처':['#3f9a4a','#c9d1e3'],'클래식 벌처':['#3fa34d','#eeeeee'],'얼티밋 벌처':['#6b7280','#b0b8c8'],'레드 벌처':['#e6202a','#7a1015'],'다크 벌처':['#2b2f45','#111'],
 '일렉트로':['#ffd23a','#2a6cf0'],'클래식 일렉트로':['#4fbf5a','#ffd23a'],'퓨어 에너지 일렉트로':['#ffffff','#2fd3e6'],'얼티밋 일렉트로':['#2a6cf0','#111'],'모던 일렉트로':['#ffd23a','#1a1a26'],
 '샌드맨':['#d9b47a','#3a7d4e'],'클래식 샌드맨':['#e8c9a0','#3a7d4e'],'퓨어 샌드맨':['#f2e2b8','#b8905a'],'얼티밋 샌드맨':['#b08050','#2b2f45'],'샌드맨 느와르':['#8a8a8a','#222'],'다크 샌드맨':['#5a4a30','#111'],
 '챕터 1 닥터 옥토퍼스':['#3d8a3d','#e0c48a'],'클래식 닥터 옥토퍼스':['#4a9a3a','#c9d1e3'],'닥터 옥토퍼스 느와르':['#5a5a5a','#222'],'얼티밋 닥터 옥토퍼스':['#2b2f45','#c9d1e3'],'닥터 옥토퍼스':['#2a6a2a','#ffd23a'],
 '울트론 MK.1':['#9aa0ac','#c9821f'],'울트론(코믹스)':['#d5dbe8','#c02030'],'울트론 프라임':['#5a6473','#2fd3e6'],'얼티밋 울트론':['#2b3140','#b26df0'],
 '클래식 미스테리오':['#3fbf7a','#6a3fd0'],'다크 미스테리오':['#1f5a3a','#2b1f45'],'미스테리온':['#2fd3e6','#111'],'슈페리어 미스테리온':['#e6202a','#6a3fd0'],'미스테리오':['#3fbf7a','#3f9a5a'],
};
const FAM_COL={bndScorpion:['#465b4c','#a2b1a5'],bndTombstone:['#a38b74','#ddd2c2'],bndBoomerang:['#293944','#c4d9dc'],bndJean:['#bd9560','#dd9ed2'],nwhOck:['#44413b','#9dabae'],nwhGoblin:['#88a14d','#5d4c74'],nwhSand:['#b39b74','#8c775b'],nwhLizard:['#537758','#aab080'],nwhElectro:['#e3c666','#343841'],nwhAll:['#b7a3dc','#d8cb99'],ffhEarth:['#a69a7e','#584f43'],ffhWind:['#b0c7ca','#526876'],ffhWater:['#63afb9','#284f6b'],ffhFire:['#ec8b34','#473735'],ffhFusion:['#8db4b8','#d18340'],ffhMysterio:['#3c8879','#b49a68'],shocker:['#b0a75a','#293f54'],vultureModern:['#606e56','#3d3330'],thanosEnd:['#9272a2','#d5b265'],proxima:['#adb9c5','#b8a060'],corvus:['#a3a49b','#252629'],cull:['#737d56','#383940'],maw:['#b1bec5','#343b47'],thanos0:['#9475b4','#b8a060'],goblin:['#4fbf5a','#5b2d8e'],vulture:['#3f9a4a','#c9d1e3'],electro:['#ffd23a','#2a6cf0'],sand:['#d9b47a','#3a7d4e'],ock:['#3d8a3d','#e0c48a'],mysterio:['#3fbf7a','#6a3fd0'],inheritor:['#c02030','#1a1a26'],ultron1:['#9aa0ac','#c9821f'],ultron2:['#d5dbe8','#c02030'],ultron3:['#5a6473','#2fd3e6'],ultron4:['#2b3140','#b26df0'],other:['#8492b8','#2b2f45']};
const FAM_INFO={bndScorpion:'꼬리 찌르기는 차선 이동, 낮은 꼬리는 점프!',bndTombstone:'주먹은 차선 이동, 지면 충격파는 점프!',bndBoomerang:'던진 뒤 돌아오는 두 번째 궤적까지 확인!',bndJean:'헐크 충격파는 점프, 퍼니셔 사격과 염동력 잔해는 차선 이동!',nwhOck:'촉수 강타는 차선 이동, 낮은 촉수는 점프. 강타 피격 시 기절!',nwhGoblin:'펌킨 폭탄은 차선 이동, 글라이더는 슬라이드',nwhSand:'모래 주먹은 점프, 모래 기둥은 차선 이동',nwhLizard:'꼬리는 점프, 도약 강습은 차선 이동',nwhElectro:'번개가 예고된 두 차선을 피해 빈 차선으로',nwhAll:'다섯 명이 하나의 체력을 공유한다. 공격자와 예고 차선을 확인!',ffhEarth:'암석 주먹은 차선 이동, 지면 균열은 점프',ffhWind:'회오리는 차선 이동, 높은 바람은 슬라이드',ffhWater:'물기둥은 차선 이동, 파도는 점프',ffhFire:'용암 기둥은 차선 이동, 불길은 점프',ffhFusion:'네 원소가 번갈아 공격한다. 예고를 끝까지 확인!',ffhMysterio:'홀로그램보다 실제 조준선을 보라. 드론 포격은 차선 이동!',shocker:'진동 펀치는 차선 이동, 지면 충격파는 점프. 진동 펀치에 맞으면 기절!',vultureModern:'발톱은 차선 이동, 날개 급강하는 슬라이드, 에너지 포격은 표시 차선 회피!',thanosEnd:'스톤 기술은 누적된다. ▲ 점프 / ▼ 슬라이드 / 차선 이동. 핑거 스냅은 SAFE 차선으로!',proxima:'창 투척은 차선 이동, 낮은 창은 점프',corvus:'글레이브 연속 베기는 차선 이동, 높은 횡베기는 슬라이드',cull:'망치 강타는 차선 이동, 지면 충격파는 점프',maw:'공중 잔해가 지정 차선으로 떨어진다. 남은 차선으로 이동',thanos0:'스톤 없는 타노스 — 주먹은 차선 이동, 지면 강타는 점프, 높은 휘두르기는 슬라이드',goblin:'녹색 가스 구름과 펌킨 폭탄을 차선에 깐다 — 표시된 차선을 피하라',vulture:'칼날 날개 장애물(부딪히면 튕겨남·콤보 끊김)과 저공 급강하(슬라이드)',electro:'두 차선에 전류를 흘린다 — 안전한 한 차선으로',sand:'모래 주먹이 바닥을 쓸어온다 — 점프로 넘어라. 모래 기둥 차선은 피할 것',ock:'문어다리 장애물이 차선을 순서대로 내려찍는다(부딪히면 튕겨남). 저공 스윕은 점프',mysterio:'거대화한 미스테리오 — 쉴드를 점프/슬라이드로 공격해야 피해. 가짜 쉴드와 장갑·눈 장식 차선을 피하라',inheritor:'모든 패턴을 섞어 쓴다 — 예고 표시를 끝까지 보라',
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
const BOSS_TOP={bndScorpion:285,bndTombstone:245,bndBoomerang:250,bndJean:285,nwhOck:285,nwhGoblin:245,nwhSand:260,nwhLizard:250,nwhElectro:265,nwhAll:270,ffhEarth:290,ffhWind:290,ffhWater:290,ffhFire:290,ffhFusion:320,ffhMysterio:260,shocker:230,vultureModern:270,thanosEnd:265,proxima:250,corvus:270,cull:265,maw:230,thanos0:240,goblin:300,vulture:270,electro:270,sand:295,ock:260,mysterio:290,inheritor:180,ultron1:195,ultron2:195,ultron3:205,ultron4:215,other:165};
function bossModelScale(b,projectionScale){return projectionScale*3.1*(b.fam==='mysterio'?1.7:1);}
function bossHudAnchor(b){
  const p=proj(b.x,0.5,14);
  // Reserve 42px for the bottom-most beat label, then a 12px body gap.
  return {x:p.x,y:p.y-(BOSS_TOP[b.fam]||BOSS_TOP.other)*bossModelScale(b,p.s)-54};
}
// Issue 8: original Canvas silhouettes; no imported picture assets.
// Patch 0.7: articulated, individually proportioned figures; flat layered geometry only.
// Patch 0.8: derive pose from the live hazard clock; no extra timers or attack logic.
function infinityMotion(b){
 const pose={wind:0,strike:0,vis:''};
 if(!b||b.phase!=='fight'||typeof R==='undefined'||!R)return pose;
 const h=R.hazards.find(h=>h.fam===b.fam&&h.t>=h.tel-(h.vis==='snap'?3.2:.6)&&h.t<h.tel+0.5);
 if(!h)return pose;const d=h.t-h.tel;pose.vis=h.vis;
 if(d<0)pose.wind=Math.min(1,(d+(h.vis==='snap'?3.2:.6))/(h.vis==='snap'?3.2:.6));
 else {pose.wind=Math.max(0,1-d/0.13);pose.strike=d<0.13?d/0.13:Math.max(0,1-(d-0.13)/0.37);}
 return pose;
}
function drawInfinityBoss(fam,t,b){
 const motion=infinityMotion(b),wind=motion.wind,hit=motion.strike;
 const end=fam==='thanosEnd',stage=end?(b.stones||endgameStage(b.name)||1):0;
 const pro=fam==='proxima',cor=fam==='corvus',cull=fam==='cull',maw=fam==='maw',th=fam==='thanos0'||end;
 const skin=pro?'#afb7c7':cor?'#9eaaa3':cull?'#778064':maw?'#adbfc6':'#9b7db7';
 const armor=end?'#ac8848':pro?'#7d8c9c':cor?'#46494b':cull?'#454953':maw?'#586674':'#414659';
 const gold=cor?'#9d9677':cull?'#aa7c50':'#c2a35f',light='#d3e0e4',deep='#202832';
 const poly=(p,c=armor,w=2)=>inkPath(()=>p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),c,w);
 const line=(p,c=light,w=1.3)=>{ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();};
 const plate=(p,c=armor)=>{poly(p,c);line(p.slice(0,3),shade(c,.4));};
 const heavy=cull||th,sh=end?44:heavy?39:maw?20:25,hip=heavy?22:14,neck=-139,hy=heavy?-159:-158;
 ctx.save();ctx.rotate(Math.sin(t*1.4)*.008+(hit*.035-wind*.018));ctx.translate(hit*3,wind*2);if(maw)ctx.translate(0,-10+Math.sin(t*1.5)*3);
 // Back layers: long fabric panels and swept hair have distinct silhouettes.
 if(cor){poly([[-24,-132],[-36,-82],[-43,-3],[-25,-13],[-19,5],[-5,-11],[10,1],[25,-11],[37,-4],[26,-124]],'#242a30');for(let i=-2;i<=2;i++)line([[i*9,-110],[i*13,-22]],'#44494b',2);}
 if(maw){poly([[-23,-125],[-29,-45],[-23,-10],[-4,-29],[0,-80],[6,-25],[27,-8],[29,-49],[20,-125]],'#37424d');}
 if(pro){poly([[-15,-169],[9,-176],[20,-157],[40,-145],[58,-130],[37,-133],[46,-123],[21,-130],[-8,-145]],'#292d3c');for(let i=0;i<4;i++)line([[7,-162+i*5],[23,-146+i*3],[40+i*2,-134+i*3]],'#596173');}
 // Two-segment legs: muscle / trouser base, knee guard, layered greaves and boots.
 for(const side of[-1,1]){const k=side*(heavy?29:19),foot=side*(heavy?35:23),h=side*hip,w=heavy?13:8;
  poly([[h-w,-74],[h+w,-74],[k+w,-40],[k+w-2,-32],[k-w,-34]],deep);
  plate([[h-w+2,-72],[h+w-1,-73],[k+w-2,-47],[k,-40],[k-w+2,-48]],maw?'#39434c':armor);
  blob(k,-37,w-2,7,deep,2);plate([[k-w+1,-41],[k+2,-45],[k+w,-39],[k+4,-31],[k-w+2,-33]],heavy?gold:armor);
  poly([[k-w+2,-30],[k+w-1,-30],[foot+w-2,-7],[foot-w,-7]],deep);
  plate([[k-w+3,-29],[k+w-2,-28],[foot+w-4,-9],[foot-w+2,-7]],pro&&side<0?gold:armor);
  line([[k,-26],[foot,-11]],heavy?gold:light,1.6);
  plate([[foot-w,-9],[foot+w-2,-10],[foot+w+8,-2],[foot+w+9,3],[foot-w-4,3]],'#303946');
  if(heavy)for(let j=0;j<2;j++)line([[k-w+3,-24+j*7],[k+w-2,-22+j*7]],'#8994a0',1.3);
 }
 // Waist and torso have independent widths and layered plates.
 poly([[-hip,-78],[hip,-78],[hip+3,-64],[0,-58],[-hip-3,-64]],deep);
 plate([[-hip,-78],[0,-82],[hip,-78],[hip-2,-70],[0,-67],[-hip+2,-70]],gold);
 poly([[-sh,-128],[-14,-140],[14,-140],[sh,-128],[hip,-79],[-hip,-79]],deep);
 for(let i=0;i<3;i++){let w=(heavy?25:16)-i*2,y=-105+i*10;plate([[-w,y],[0,y+3],[w,y],[w-2,y+9],[0,y+12],[-w+2,y+9]],cor?'#535550':armor);}
 for(const side of[-1,1]){ctx.save();ctx.scale(side,1);
  plate([[2,-135],[sh-7,-135],[sh,-121],[sh-6,-106],[12,-105],[3,-113]],armor);
  line([[5,-130],[sh-9,-131],[sh-3,-122]],gold,heavy?3:2);
  if(cor)for(let j=0;j<4;j++)line([[5,-127+j*6],[sh-5,-131+j*7]],'#979a8b',2);
  if(pro){poly([[6,-127],[16,-128],[21,-119],[12,-113],[6,-116]],'#b6c4cc',1);}
  if(th)plate([[3,-139],[18,-140],[29,-130],[20,-125],[7,-132]],gold);
  ctx.restore();
 }
 if(maw){for(const side of[-1,1]){ctx.save();ctx.scale(side,1);plate([[7,-136],[19,-129],[22,-96],[26,-37],[11,-48],[5,-78]],'#8797a0');line([[11,-124],[13,-80],[19,-47]],'#c6d2d5',1.5);ctx.restore();}for(let i=0;i<7;i++)line([[-3,-129+i*7],[3,-129+i*7]],gold,2);}
 const armAngle=side=>{
   const idle=Math.sin(t*1.7+side)*.025;
   if(end){
     if(side<0)return idle+(motion.vis==='doubleblade'?wind*1.1-hit*2.2:motion.vis==='doublebladeThrow'?-wind*.8+hit*1.5:wind*.25-hit*.5);
     const v=motion.vis;
     if(v==='snap')return idle-.95-wind*.9+hit*.18;
     if(v==='stone0'||v==='stone4')return idle-.95-wind*1.15+hit*1.6;
     if(v==='stone1')return idle-.95+wind*.2-hit*.7;
     if(v==='stone2')return idle-.95-wind*.4+hit*.9;
     if(v==='stone3')return idle-.95+wind*.4-hit*.45;
     return idle-.95-wind*.6+hit*.2;
   }
   if(pro)return idle+(side>0?wind*.4-hit*.85:wind*.2-hit*.35);
   if(cor)return idle+(side<0?-wind*.35+hit*1.05:hit*.2);
   if(cull)return idle+(side>0?-wind*1.75+hit*.45:wind*.18);
   if(maw)return idle+(side>0?wind*.25-hit*.9:-wind*.3+hit*.35);
   return idle+(side<0?wind*.25+hit*1.4:-wind*.3-hit*.2);
 };
 const pivotArm=side=>{ctx.translate(side*sh,-128);ctx.rotate(armAngle(side));ctx.translate(-side*sh,128);};
 // Arms: angled upper arm, forearm, cuff and individually drawn fingers.
 for(const side of[-1,1]){let sx=side*sh,ex=side*(heavy?54:37),ey=maw&&side>0?-128:-105,hx=side*(heavy?60:44),handY=maw&&side>0?-151:-81,w=heavy?12:7;
  ctx.save();pivotArm(side);
  poly([[sx-w,-128],[sx+w,-125],[ex+w,ey],[ex-w,ey+5]],heavy?skin:deep);
  if(!th)plate([[sx-w,-128],[sx+w,-126],[ex+w-2,ey-3],[ex-w+2,ey]],armor);
  if(heavy){line([[sx+side*3,-118],[ex+side*4,ey-4]],shade(skin,.25),2);}
  blob(ex,ey,heavy?9:5,heavy?8:5,skin,2);
  poly([[ex-w+1,ey],[ex+w-1,ey],[hx+w,handY-3],[hx-w,handY+2]],skin);
  if(!th||side<0)plate([[ex-w,ey+2],[ex+w,ey+1],[hx+w+1,handY-3],[hx-w-1,handY+2]],th?gold:armor);
  if(heavy){plate([[hx-w,handY-4],[hx+w,handY-6],[hx+w+1,handY+7],[hx-w+1,handY+10]],th&&side<0?gold:skin);for(let j=-1;j<=1;j++)line([[hx+j*5,handY],[hx+j*5,handY+6]],shade(skin,-.35),1.3);}
  else {blob(hx,handY,5,6,skin,1.5);for(let j=0;j<4;j++){const x=hx-5+j*3,sg=maw&&side>0?-1:1;line([[x,handY],[x+side*2,handY+sg*(8+j%2*3)],[x+side,handY+sg*(12+j%2*3)]],skin,2);}}
  if(end&&side>0){
    plate([[hx-14,handY-25],[hx+14,handY-25],[hx+17,handY+10],[hx-14,handY+12]],'#c4a15b');
    line([[hx-9,handY-21],[hx-8,handY+6]],'#f0d591',2);
    const sockets=[[-8,-15],[0,-17],[8,-15],[-10,-4],[10,-4],[0,3]];
    sockets.forEach(([x,y],i)=>{blob(hx+x,handY+y, i===5?4.5:3.3,i===5?5.5:3.8,'#594624',1);if(i<stage){blob(hx+x,handY+y,i===5?3.5:2.5,i===5?4.5:3,ENDGAME_STONES[i].color,0);blob(hx+x-.7,handY+y-1,.8,1,'#fff',0);}});
    const snap=motion.vis==='snap';
    for(let j=0;j<4;j++){const x=hx-10+j*6;line([[x,handY+10],[x+(snap?j-1:0),handY+16],[x+(snap?5:0),handY+(snap?12:20)]],'#d6b570',3.4);}
  }
  // Asymmetric shoulder shells, strongest on Cull's left.
  if(!maw){ctx.save();ctx.translate(sx,-128);ctx.scale(side,1);const ww=cull&&side<0?27:heavy?21:16;
   plate([[-8,-7],[6,-14],[ww,-9],[ww+3,3],[13,9],[-8,4]],pro&&side>0?gold:armor);
   line([[-3,-8],[7,-10],[ww-3,-5]],heavy?gold:light,2);
   if(cull&&side<0)for(let j=0;j<2;j++)plate([[3,6+j*6],[22,3+j*6],[23,10+j*6],[6,13+j*6]],'#424651');ctx.restore();}
  ctx.restore();
 }
 // Sculpted heads, brows, nose and jaw: no rounded hero head underneath.
 poly([[-(end?12:7),-143],[-(end?11:6),-129],[(end?11:6),-129],[(end?12:7),-143]],skin);
 // Patch 0.9: individual facial planes and expressions, including attack tension.
 const hw=cull?23:th?21:maw?12:14;
 const jaw=cull?17:th?16:maw?6:cor?7:8, chin=maw?22:cor?22:18;
 plate([[-hw,hy-8],[-hw+4,hy-22],[-5,hy-27],[8,hy-25],[hw,hy-15],[hw,hy+5],[jaw,hy+15],[jaw-3,hy+chin],[-jaw+3,hy+chin],[-jaw,hy+13]],skin);
 poly([[3,hy-23],[hw-2,hy-14],[hw-1,hy+4],[jaw-1,hy+14],[3,hy+chin-1],[6,hy]],shade(skin,-.3),0);
 const faceDark=shade(skin,cor?-.62:-.53),eye= cull?'#cbb766':cor?'#dadbc5':pro?'#c3d1da':'#d6d6c8';
 for(const side of[-1,1]){ctx.save();ctx.translate(0,hy);ctx.scale(side,1);
  // Inner ends sit lower than outer ends: stern brows instead of worried arches.
  const inner=maw?-3:1+hit*.6,outer=maw?-5:cull?-8:th?-6:-7;
  poly([[3,inner-3],[hw-3,outer-3],[hw-2,outer+4],[5,inner+4]],faceDark,0);
  line([[5,inner+1],[hw-5,outer+3]],eye,maw?1:1.4);
  line([[3,inner-3],[hw-3,outer-3]],shade(skin,-.65),maw?1.4:cull?3.5:2.5);
  if(cor||maw){poly([[hw-3,3],[6,7],[7,14],[hw-4,8]],shade(skin,-.42),0);line([[hw-4,1],[6,6]],shade(skin,.12),1);}
  else line([[hw-4,4],[hw-7,8]],shade(skin,-.35),1.4);
  ctx.restore();
 }
 line([[0,hy-4],[-2,hy+5],[3,hy+5]],shade(skin,-.48),1.6);
 if(pro){line([[-7,hy+12],[-3,hy+10],[5,hy+10],[8,hy+12]],faceDark,1.8);line([[-4,hy+14],[4,hy+14]],shade(skin,.16),1);}
 if(cor){line([[-7,hy+14],[-4,hy+10],[4,hy+10],[7,hy+14]],faceDark,1.8);line([[0,hy+14],[0,hy+19]],shade(skin,-.32),1);}
 if(cull){poly([[-12,hy+13],[-9,hy+9],[9,hy+9],[12,hy+13],[7,hy+15],[-8,hy+15]],shade(skin,-.57),0);line([[-8,hy+12],[8,hy+12]],'#949b7c',1.4);for(const side of[-1,1])line([[side*3,hy-15],[side*2,hy-8]],faceDark,2);}
 if(maw){line([[-6,hy+13],[4,hy+13],[7,hy+14]],faceDark,1.6);line([[-5,hy+17],[3,hy+18]],shade(skin,-.27),1);}
 if(th){line([[-10,hy+12],[-7,hy+10],[7,hy+10],[11,hy+13]],faceDark,2.2);line([[-6,hy+14],[7,hy+14]],shade(skin,.18),1.1);for(let x=-10;x<=10;x+=4)line([[x,hy+15],[x,hy+18]],'#594169',1.3);for(const side of[-1,1])line([[side*4,hy-16],[side*2,hy-10]],'#654b7a',1.5);line([[-11,hy-20],[0,hy-21],[11,hy-19]],'#b99bd0',1.2);}
 if(cull){for(const side of[-1,1])plate([[side*13,hy-14],[side*19,hy-26],[side*23,hy-7],[side*15,hy+2]],'#5e684b');for(let j=0;j<3;j++)line([[-9+j*8,hy-18],[-5+j*7,hy-12]],'#adb396',2);}
 if(cor||pro){for(const side of[-1,1])plate([[side*10,hy-9],[side*16,hy-19],[side*20,hy-32],[side*23,hy-12],[side*14,hy+7]],cor?'#7e806b':'#363f4d');}
 if(maw){line([[-7,hy-18],[0,hy-21],[7,hy-18]],'#d5dfe1',2);line([[-9,hy+4],[-7,hy+12],[-3,hy+16]],'#6a7a85',1.5);}
 if(end){
   plate([[-23,hy-7],[-25,hy-24],[-15,hy-34],[0,hy-38],[16,hy-33],[25,hy-23],[22,hy-7],[15,hy-15],[8,hy-17],[0,hy-12],[-8,hy-17],[-16,hy-15]],'#b89652');
   plate([[-6,hy-36],[5,hy-36],[9,hy-20],[0,hy-15],[-8,hy-21]],'#e0bd73');
   for(const side of [-1,1]){plate([[side*22,hy-21],[side*26,hy-7],[side*20,hy+14],[side*15,hy+17],[side*18,hy-2]],'#99733d');line([[side*22,hy-15],[side*22,hy+2]],'#e3c57f',1.5);}
   plate([[-19,-69],[-3,-64],[-4,-27],[-20,-32],[-25,-51]],'#3b3540');
   plate([[3,-64],[19,-69],[25,-51],[20,-32],[4,-27]],'#3b3540');
   line([[-15,-61],[-13,-34]],'#cba75e',2);line([[15,-61],[13,-34]],'#cba75e',2);
   ctx.save();pivotArm(-1);line([[-59,-95],[-70,-50]],'#d2b26b',6);
   plate([[-68,-60],[-99,-105],[-102,-123],[-72,-95],[-56,-56],[-27,-7],[-27,8],[-56,-22]],'#9b926f');
   line([[-98,-115],[-70,-76],[-32,1]],'#dfc98d',2);ctx.restore();
 }
 // Weapons and loose details are drawn last with finite geometry.
 if(pro){ctx.save();pivotArm(1);line([[-64,-158],[70,-65]],'#161d28',6);line([[-64,-158],[70,-65]],gold,3);plate([[-64,-158],[-90,-187],[-78,-157],[-57,-149]],'#71c4d5');line([[-85,-179],[-64,-158]],'#d5ffff',1.5);ctx.restore();}
 if(cor){ctx.save();pivotArm(-1);line([[-48,0],[-54,-172]],'#393a34',7);line([[-48,0],[-54,-172]],gold,3);plate([[-55,-158],[-70,-213],[-48,-188],[-43,-168]],'#a9ab8b');poly([[-57,-185],[-62,-204],[-51,-187]],'#e0dfbd',1);plate([[-51,-174],[-33,-163],[-28,-176],[-27,-156],[-41,-151]],'#929777');ctx.restore();}
 if(cull){ctx.save();pivotArm(1);line([[58,-80],[77,-29]],gold,7);plate([[57,-49],[82,-63],[98,-39],[72,-21]],'#454c58');plate([[60,-49],[81,-59],[86,-49],[66,-39]],'#7c8691');line([[73,-48],[87,-38]],'#bdc7c7',2);ctx.restore();}
 if(maw)for(let i=0;i<4;i++){const x=(i<2?-1:1)*(48+i%2*11),y=-88-i%2*47+Math.sin(t*1.6+i)*5-wind*15+hit*28;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t+i)*.15);plate([[-7,-9],[6,-12],[11,3],[-3,10]],'#687887');poly([[1,-10],[6,-11],[10,3],[3,7]],'#475462',0);ctx.restore();}
 ctx.restore();
}

// --- 보스 모델 ---
// 0.11: one geometric model per family, driven exclusively by its existing two-color palette.
// 0.12: choose the attack nearest impact, including overlapping telegraphs.
function classicMotion(b){
 const idle={wind:0,strike:0,vis:'',lane:1,release:false};
 if(b.phase!=='fight'||typeof R==='undefined'||!R)return idle;
 const candidates=R.hazards.filter(h=>h.fam===b.fam&&h.t>=h.tel-.6&&h.t<h.tel+.5);
 candidates.sort((a,b)=>Math.abs(a.t-a.tel)-Math.abs(b.t-b.tel));
 const h=candidates[0];if(!h)return idle;const d=h.t-h.tel;
 return {vis:h.vis,lane:h.lanes?.[0]??1,release:d>=0,wind:d<0?(d+.6)/.6:Math.max(0,1-d/.12),strike:d<0?0:d<.12?d/.12:Math.max(0,1-(d-.12)/.38)};
}
function drawClassicBoss(b,t,c1,c2){
 const f=b.fam,gob=f==='goblin',vul=f==='vulture',ele=f==='electro',sand=f==='sand',ock=f==='ock',mys=f==='mysterio';
 const motion=classicMotion(b),w=motion.wind,hit=motion.strike,vis=motion.vis;
 const poly=(p,c,w=2)=>inkPath(()=>p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),c,w);
 const ln=(p,c,w=1.5)=>{ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();};
 const plate=(p,c)=>{poly(p,c);ln(p.slice(0,3),shade(c,.4));};
 const dark=shade(c2,-.4),hi=shade(c1,.45),skin=(vul||ock)?'#c0a695':c1;
 ctx.save();ctx.rotate(Math.sin(t*1.4)*.014+hit*.025);
 if(vul&&vis==='swoop'){ctx.translate(hit*18,hit*28-w*8);ctx.rotate(hit*.22);}
 if(sand&&vis==='fist'){ctx.translate(0,hit*9);ctx.scale(1+hit*.05,1-hit*.05);}
 if(gob)ctx.rotate(vis==='pumpkin'?-w*.05+hit*.08:hit*.035);
 if(mys)ctx.translate(0,-w*7+hit*3);
 if(mys){poly([[-25,-130],[-47,-76],[-62,0],[-31,-8],[0,13],[34,-8],[61,0],[44,-78],[24,-130]],c2,3);for(const side of[-1,1])ln([[side*26,-117],[side*36,-56],[side*48,-4]],shade(c2,.24),3);}
 if(vul)for(const side of[-1,1]){ctx.save();ctx.translate(side*23,-113);ctx.rotate(side*(Math.sin(t*2)*.08+(vis==='swoop'?w*.3-hit*.85:-w*.2+hit*.5)));
  poly([[0,0],[side*38,-30],[side*133,-48],[side*112,-8],[side*59,21],[side*7,18]],dark,3);
  for(let j=0;j<7;j++){const x=side*(22+j*14),y=-18-j*3;plate([[x,y],[x+side*24,y-17],[x+side*13,y+25-j*2],[x-side*1,y+32-j*2]],j%2?c2:shade(c2,-.17));}ln([[0,0],[side*46,-23],[side*119,-39]],c1,5);ctx.restore();}
 if(ock)for(let i=0;i<4;i++){const side=i<2?-1:1,j=i%2,root=[side*18,-98],el=[side*(68+j*9),-133+j*53],end=[side*(107+j*17),-156+j*107+Math.sin(t*1.7+i)*9+hit*24];
  const active=vis==='sweep'||i===(motion.lane%3);
  if(active&&vis==='slam'){el[1]-=w*32;end[1]-=w*36;end[1]+=hit*95;end[0]+=side*hit*12;}
  if(vis==='sweep'){end[0]+=Math.sin(hit*Math.PI)*side*34;end[1]+=hit*48;el[1]+=hit*25;}
  ln([root,el,end],INK,14);ln([root,el,end],c2,10);
  for(let k=1;k<9;k++){const q=k/9,x=el[0]+(end[0]-el[0])*q,y=el[1]+(end[1]-el[1])*q;ln([[x-3,y-3],[x+3,y+3]],shade(c2,-.35),2);}
  blob(el[0],el[1],7,7,shade(c2,-.2),2);blob(end[0],end[1],7,7,dark,2);
  for(const s of[-1,1])ln([[end[0]+s*5,end[1]],[end[0]+s*13,end[1]-12],[end[0]+s*5,end[1]-21]],c2,4);
 }
 if(gob){ctx.save();ctx.translate(0,6);ctx.rotate(Math.sin(t*2)*.04);poly([[-114,1],[-72,-24],[-31,-11],[0,-20],[31,-11],[72,-24],[114,1],[68,10],[28,5],[0,19],[-28,5],[-68,10]],c2,3);for(const side of[-1,1]){plate([[side*22,-8],[side*67,-19],[side*99,-1],[side*36,0]],shade(c2,.22));ln([[side*34,3],[side*72,4]],c1,3);}poly([[-10,16],[0,30+Math.sin(t*12)*4],[10,16]],'#eaa452',1);ctx.restore();}
 // Tailored torso and segmented limbs, without the rounded hero scaffold.
 const broad=sand?34:ock?27:23;
 for(const side of[-1,1]){const x=side*13,k=side*(sand?23:18),ft=side*22;
  poly([[x-8,-69],[x+8,-69],[k+8,-37],[k-8,-35]],dark);
  plate([[x-6,-66],[x+6,-67],[k+6,-43],[k-5,-39]],c2);
  blob(k,-35,6,6,shade(c2,-.2),2);plate([[k-6,-29],[k+6,-31],[ft+7,-8],[ft-7,-8]],gob||ele?c1:c2);
  plate([[ft-7,-9],[ft+6,-9],[ft+12,-1],[ft+10,3],[ft-9,3]],shade(c2,-.18));
 }
 poly([[-broad,-125],[-12,-138],[12,-138],[broad,-125],[18,-70],[-18,-70]],c2,3);
 for(let i=0;i<3;i++){const y=-101+i*10,ww=17-i;plate([[-ww,y],[0,y+3],[ww,y],[ww-2,y+9],[0,y+12],[-ww+2,y+9]],shade(c2,-.12));}
 for(const side of[-1,1]){ctx.save();ctx.scale(side,1);plate([[2,-131],[broad-4,-131],[broad,-118],[19,-106],[4,-111]],gob||ele?c1:c2);ctx.restore();}
 if(sand)for(let j=0;j<4;j++)ln([[-25+j,-123+j*8],[24-j,-123+j*8]],shade(c2,-.48),3);
 if(mys){for(const side of[-1,1])plate([[side*3,-129],[side*26,-140],[side*30,-125],[side*12,-116]],c2);}
 plate([[-19,-77],[19,-77],[18,-68],[-18,-68]],gob?'#746454':shade(c2,.25));blob(0,-72,4,4,c1,1);
 const armPose=side=>{
 const idle=Math.sin(t*1.6+side)*.025;
 if(gob)return idle+(vis==='pumpkin'?(side>0?w*1.7-hit*1.0:w*.15):side*(-w*.3+hit*.6));
 if(vul)return idle+side*(vis==='swoop'?hit*.6:-w*.4+hit*.9);
 if(ele)return idle+side*(-w*1.1-hit*.55);
 if(sand)return idle+(vis==='fist'?(side>0?-w*2+hit*.6:hit*.15):side*(-w*.15-hit*1.25));
 if(ock)return idle+side*(-w*.45+hit*.4);
 if(mys)return idle+side*(vis==='glove'?-w*.6-hit*1.5:vis==='eye'?-w*1.65+hit*.2:-w*.6-hit*.75);
 return idle;
 };
 for(const side of[-1,1]){ctx.save();ctx.translate(side*broad,-123);ctx.rotate(armPose(side));ctx.translate(-side*broad,123);
 const sx=side*broad,el=side*(sand?48:37),hx=side*(sand?55:43),hh=-81;
 poly([[sx-7,-126],[sx+7,-126],[el+7,-103],[el-7,-99]],sand?c1:c2);
 blob(el,-101,6,6,skin,2);plate([[el-7,-98],[el+7,-99],[hx+8,hh-3],[hx-8,hh+3]],sand?c1:shade(c2,.1));
 if(sand){blob(hx,hh,14,13,c1,3);for(let j=0;j<3;j++)ln([[hx-8+j*7,hh-6],[hx-8+j*7,hh+2]],shade(c1,-.3),2);}
 else{blob(hx,hh,7,8,gob||ele||mys?c1:skin,2);for(let j=0;j<3;j++)ln([[hx-4+j*4,hh+1],[hx-4+j*4,hh+6]],shade(skin,-.4),1);}
 if(gob&&side>0&&!(vis==='pumpkin'&&motion.release)){blob(hx,hh-3,10,10,'#d59a48',2);ln([[hx-5,hh-7],[hx,hh-4],[hx+5,hh-7]],INK,2);}
 plate([[sx-10,-130],[sx+4,-139],[sx+12,-129],[sx+8,-116],[sx-9,-118]],sand?c1:shade(c2,.18));ctx.restore();}
 // Distinct head construction for each family.
 poly([[-6,-145],[-6,-133],[6,-133],[6,-145]],skin);
 if(mys){
  blob(0,-157,23,26,shade(c1,-.42),3);poly([[-16,-171],[-3,-180],[13,-174],[18,-157],[7,-143],[-8,-147]],shade(c1,.2),0);
  ctx.save();ctx.globalAlpha=.5;ln([[-15,-149],[-7,-156],[2,-151],[12,-160]],shade(c1,.65),3);ctx.restore();ln([[-15,-169],[-10,-177],[0,-180]],'#e9f5f7',3);plate([[-20,-137],[20,-137],[19,-131],[-19,-131]],c2);
 }else{
 const hw=sand?17:13;
 plate([[-hw,-159],[-hw+3,-175],[0,-181],[hw-1,-174],[hw,-154],[8,-141],[-8,-141]],skin);
 poly([[3,-175],[hw-1,-167],[hw-1,-154],[6,-143],[2,-146]],shade(skin,-.23),0);
 if(gob){for(const side of[-1,1])poly([[side*11,-168],[side*29,-178],[side*20,-161],[side*12,-155]],c1);poly([[-14,-173],[-10,-190],[7,-197],[20,-184],[8,-184],[12,-173]],c2);}
 if(ele){for(let i=0;i<7;i++){const a=-Math.PI+(i/6)*Math.PI;poly([[Math.cos(a)*12,-164+Math.sin(a)*13],[Math.cos(a)*36,-164+Math.sin(a)*38],[Math.cos(a+.18)*12,-164+Math.sin(a+.18)*13]],c1);}}
 if(vul){for(let i=-2;i<=2;i++)blob(i*8,-136,6,7,shade(c2,.3),1);ln([[-8,-173],[1,-175],[8,-173]],shade(skin,-.25),1.4);}
 if(ock){poly([[-13,-166],[-15,-178],[-5,-185],[10,-181],[15,-171],[5,-175],[-5,-173]],shade(c2,-.6));for(const side of[-1,1]){poly([[side*2,-165],[side*12,-167],[side*12,-159],[side*3,-158]],INK,1);ln([[side*4,-164],[side*10,-165]],c1,2);}ln([[-2,-163],[2,-163]],c2,2);}
 else for(const side of[-1,1]){ln([[side*3,-161],[side*10,-166]],shade(skin,-.6),3);ln([[side*4,-159],[side*9,-162]],gob||ele?'#f1df89':'#dedbd0',1.5);}
 ln([[0,-161],[-2,-153],[3,-153]],shade(skin,-.45),1.4);ln([[-6,-147],[-3,-149],[4,-149],[7,-147]],shade(skin,-.55),1.8);
 if(sand){poly([[-14,-175],[-10,-184],[10,-183],[15,-174]],shade(c1,-.55));for(let i=0;i<7;i++){const x=(i*11)%24-12,y=-170+(i*7)%27;ln([[x,y],[x+2,y+2]],shade(c1,-.22),1);}}
 }
 if(ele)for(const side of[-1,1]){const pulse=Math.sin(t*9+side)*3;ln([[side*38,-111],[side*53,-118],[side*46,-132],[side*64,-140+pulse]],c1,2.5);}
 if(sand)for(let i=0;i<8;i++){const x=Math.sin(i*7+t)*40,y=-12-((i*9+t*22)%45);blob(x,y,2,2,shade(c1,-.12),0);}
 if(gob&&vis==='gas'&&(w||hit)){ctx.save();ctx.globalAlpha=.25*(w+hit);for(let i=0;i<3;i++)blob(-24+i*24,-2-i%2*7,12+hit*10,5,c1,0);ctx.restore();}
 if(ele&&(w||hit)){ctx.strokeStyle=hi;ctx.lineWidth=hit?3:1.5;for(const side of[-1,1]){ctx.beginPath();ctx.moveTo(side*17,-120);ctx.lineTo(side*32,-140-w*10);ctx.lineTo(side*26,-151);ctx.lineTo(side*(50+hit*20),-169);ctx.stroke();}}
 if(mys&&(w||hit)){ctx.save();ctx.globalAlpha=.5;ctx.strokeStyle=c1;ctx.lineWidth=2;const cy=vis==='eye'?-157:-91,rad=vis==='glove'?18:vis==='eye'?33:40;ctx.beginPath();ctx.ellipse(0,cy,rad+(w+hit)*12,vis==='smoke'?8:rad,0,0,7);ctx.stroke();ctx.restore();}
 ctx.restore();
}

function drawBossModel(b,s,t){
  const fam=b.fam; const [c1,c2]=VARIANT_PAL[b.name]||FAM_COL[fam]; const c2d=shade(c2,-0.3); const bob=Math.sin(t*2.2)*6; const hurt=b.hurtT>0; const flash=hurt&&Math.floor(t*30)%2===0;
  ctx.save(); ctx.scale(s,s); ctx.translate(0,bob); const shieldPulse=Math.max(0,1-(t-(b.shieldHitAt??-99))/0.22); if(shieldPulse)ctx.translate(0,-3*Math.sin(shieldPulse*Math.PI)); if(flash){ctx.globalAlpha*=0.7;}
  const P=poseFor('idle',t*1.3,{override:{lArm:0.6,rArm:0.6,armsUp:0.3,lSpread:0.4,rSpread:0.4}}); P.face='front';
  switch(fam){
    case 'bndScorpion':case 'bndTombstone':case 'bndBoomerang':case 'bndJean':drawBrandNewDayBoss(b,t);break;
    case 'nwhOck':case 'nwhGoblin':case 'nwhSand':case 'nwhLizard':case 'nwhElectro':case 'nwhAll':drawNoWayHomeBoss(b,t);break;
    case 'ffhEarth':case 'ffhWind':case 'ffhWater':case 'ffhFire':case 'ffhFusion':case 'ffhMysterio':drawFarFromHomeBoss(b,t);break;
    case 'shocker':case 'vultureModern':drawHomecomingBoss(b,t);break;
    case 'thanosEnd': case 'proxima': case 'corvus': case 'cull': case 'maw': case 'thanos0': drawInfinityBoss(fam,t,b);break;
    case 'goblin': case 'vulture': case 'electro': case 'sand': case 'ock': case 'mysterio': drawClassicBoss(b,t,c1,c2);break;
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
const FAM_IDX={bndScorpion:33,bndTombstone:34,bndBoomerang:35,bndJean:36,nwhOck:27,nwhGoblin:28,nwhSand:29,nwhLizard:30,nwhElectro:31,nwhAll:32,ffhEarth:21,ffhWind:22,ffhWater:23,ffhFire:24,ffhFusion:25,ffhMysterio:26,shocker:19,vultureModern:20,thanosEnd:18,proxima:13,corvus:14,cull:15,maw:16,thanos0:17,goblin:1,vulture:2,electro:3,sand:4,ock:5,mysterio:6,inheritor:7,ultron1:9,ultron2:10,ultron3:11,ultron4:12,other:8};
let PR=Math.random; // 패턴용 RNG (보스 시작 시 시드 고정)
function seedBossPattern(b){ b.rng=mulberry32((R.mode==='story'?R.issue:R.issue+10)*97+FAM_IDX[b.fam]*13+1); }
const PATTERNS={
 bndScorpion(b){return bndPattern(b,0);},bndTombstone(b){return bndPattern(b,1);},bndBoomerang(b){return bndPattern(b,2);},bndJean(b){return bndPattern(b,3);},
 nwhOck(b){return nwhPattern(b,0);},nwhGoblin(b){return nwhPattern(b,1);},nwhSand(b){return nwhPattern(b,2);},nwhLizard(b){return nwhPattern(b,3);},nwhElectro(b){return nwhPattern(b,4);},nwhAll(b){const k=(b.nwhTurn||0)%5;b.nwhTurn=(b.nwhTurn||0)+1;return nwhPattern(b,k);},
 ffhEarth(b){return ffhPattern(b,0);},ffhWind(b){return ffhPattern(b,1);},ffhWater(b){return ffhPattern(b,2);},ffhFire(b){return ffhPattern(b,3);},ffhFusion(b){return ffhPattern(b,4);},ffhMysterio(b){return ffhPattern(b,5);},
 shocker(b){const l=Math.floor(PR()*3),n=(b.homeTurn||0)%3;b.homeTurn=(b.homeTurn||0)+1;
  if(n===0)return [{kind:'strike',lanes:[l],tel:1.3,dur:.3,vis:'vibropunch',soft:true,label:'진동 펀치 · 차선 이동'}];
  if(n===1)return [{kind:'low',lanes:[0,1,2],tel:1.5,dur:.3,vis:'vibrowave',label:'지면 진동파 · JUMP'}];
  return [{kind:'strike',lanes:[l],tel:1.35,dur:.3,vis:'vibropunch',soft:true,label:'건틀릿 연격 · 차선 이동'},{kind:'strike',lanes:[(l+1)%3],tel:2.6,dur:.3,vis:'vibropunch',soft:true}];
 },
 vultureModern(b){const safe=Math.floor(PR()*3),n=(b.homeTurn||0)%3;b.homeTurn=(b.homeTurn||0)+1;
  if(n===0)return [{kind:'high',lanes:[0,1,2],tel:1.5,dur:.3,vis:'wingDive',label:'날개 급강하 · SLIDE'}];
  if(n===1)return [{kind:'strike',lanes:[safe],tel:1.45,dur:.3,vis:'talon',soft:true,label:'발톱 강습 · 차선 이동'}];
  return [{kind:'strike',lanes:[0,1,2].filter(l=>l!==safe),tel:1.7,dur:.35,vis:'salvageBeam',label:'에너지 포격 · 빈 차선 이동'}];
 },
 thanosEnd(b){
   const n=Math.max(1,Math.min(6,b.stones||endgameStage(b.name)||1));
   b.casts=b.casts||0;
   if(n===6&&!b.snapUsed&&(b.hp<=b.max*.5||b.casts>=6)){
     b.snapUsed=true;const safe=Math.floor(PR()*3);
     return [{kind:'strike',lanes:[0,1,2].filter(l=>l!==safe),tel:3.2,minTel:3.2,dur:.4,vis:'snap',safe,label:'핑거 스냅 · SAFE로 이동',instant:true}];
   }
   b.turns=(b.turns||0)+1;
   if(b.turns%3===0){const l=Math.floor(PR()*3);return [
     {kind:'high',lanes:[0,1,2],tel:1.5,dur:.3,vis:'doubleblade',label:'쌍날검 · 횡베기 — SLIDE'},
     {kind:'strike',lanes:[l],tel:2.9,dur:.3,vis:'doublebladeThrow',label:'쌍날검 · 회전 투척 — 차선 이동'}];}
   // Newest stone first, then every acquired stone; no unlocked skill is starved by RNG.
   const stone=(n-1-(b.casts++%n)+n)%n,l=Math.floor(PR()*3);
   const h=(kind,lanes,tel,extra={})=>({kind,lanes,tel,dur:.3,vis:'stone'+stone,stone,label:ENDGAME_STONES[stone].skill,...extra});
   if(stone===0)return [h('low',[0,1,2],1.45)];
   if(stone===1)return [h('strike',[l],1.4),h('strike',[(l+1)%3],2.6),h('strike',[(l+2)%3],3.8)];
   if(stone===2)return [h('high',[0,1,2],1.5),h('low',[0,1,2],2.8)];
   if(stone===3){const target=R.lane;return [h('strike',[target],1.65),h('strike',[(target+1)%3],3),h('strike',[target],4.35)];}
   if(stone===4)return [h('low',[0,1,2],1.5),h('low',[0,1,2],3.3,{reverse:true})];
   return [h('high',[0,1,2],1.6,{dur:.38})];
 },
 proxima(){const l=Math.floor(PR()*3);return [{kind:'strike',lanes:[l],tel:1.15,dur:.3,vis:'spear'},{kind:'low',lanes:[0,1,2],tel:2.1,dur:.25,vis:'spear'}];},
 corvus(){const l=Math.floor(PR()*3);return [{kind:'strike',lanes:[l],tel:1.05,dur:.3,vis:'glaive'},{kind:'strike',lanes:[(l+1)%3],tel:1.95,dur:.3,vis:'glaive'},{kind:'high',lanes:[0,1,2],tel:2.9,dur:.25,vis:'glaive'}];},
 cull(){return [{kind:'strike',lanes:[Math.floor(PR()*3)],tel:1.3,dur:.4,vis:'hammer'},{kind:'low',lanes:[0,1,2],tel:2.4,dur:.3,vis:'groundwave'}];},
 maw(){const safe=Math.floor(PR()*3);return [{kind:'strike',lanes:[0,1,2].filter(l=>l!==safe),tel:1.2,dur:.35,vis:'rubble'},{kind:'strike',lanes:[safe],tel:2.2,dur:.35,vis:'rubble'}];},
 thanos0(){const l=Math.floor(PR()*3);return [{kind:'strike',lanes:[l],tel:1.05,dur:.3,vis:'gauntlet'},{kind:PR()<.5?'low':'high',lanes:[0,1,2],tel:2.05,dur:.3,vis:'groundwave'},{kind:'strike',lanes:[(l+1)%3],tel:3.05,dur:.3,vis:'gauntlet'}];},

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
const isInfinityBoss=b=>!!b&&[...BND_FAMS,...NWH_FAMS,...FFH_FAMS,'shocker','vultureModern','proxima','corvus','cull','maw','thanos0','thanosEnd'].includes(b.fam);
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
    if(isUltronBoss(b)||isInfinityBoss(b)){
      // Apply recovery AFTER difficulty modifiers. Allow landing / a full slide.
      h.tel=Math.max(h.tel,h.minTel||0,previousEnd?previousEnd+(b.fam==='thanosEnd'?.65:.45):.9);
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
      else if(h.t>=h.tel){ h.done=true; if(h.soft)softHit(); else hitPlayer(h.damage||1,!!h.instant); } }
    if(h.t>=h.tel&&!h.sfx){h.sfx=true;SFX.play(h.kind==='strike'?'bomb':'whoosh');R.shake=Math.max(R.shake,0.25);} }
  R.hazards=R.hazards.filter(h=>h.t<h.tel+h.dur+0.4);
}
// Patch 0.10: elapsed warning time changes blue to red; pulse never hides the lane.
function hazardWarning(h){
 const k=Math.max(0,Math.min(1,h.t/Math.max(0.001,h.tel)));
 const r=Math.round(40+200*k),g=Math.round(145-100*k),b=Math.round(245-195*k);
 const alpha=0.36+0.2*(0.5+0.5*Math.sin(h.t*Math.PI*4));
 return {fill:`rgba(${r},${g},${b},${alpha})`,edge:`rgb(${r},${g},${b})`};
}
function drawHazards(){
  const activeLabel=R.hazards.find(h=>h.label&&h.t<h.tel+h.dur);
  if(activeLabel){ctx.save();ctx.fillStyle='#121521dd';ctx.fillRect(W*.15,H*.18,W*.7,48);ctx.fillStyle=activeLabel.vis==='snap'?'#ffe5a1':(ENDGAME_STONES[activeLabel.stone]?.color||'#dfc98d');ctx.textAlign='center';ctx.font=`900 ${Math.min(24,W/28)}px sans-serif`;ctx.fillText(activeLabel.label,W/2,H*.18+31);ctx.restore();}
  for(const h of R.hazards){ const k=h.t/h.tel; const act=h.t>=h.tel; const fade=act?Math.max(0,1-(h.t-h.tel)/(h.dur+0.4)):1;
    if(h.vis==='snap'&&!act){const p=proj(h.safe-1,0,4);ctx.save();ctx.fillStyle='#4eeac8';ctx.font='900 30px sans-serif';ctx.textAlign='center';ctx.fillText('SAFE',p.x,p.y-70*p.s);ctx.strokeStyle='#4eeac8';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(p.x,p.y,55*p.s,18*p.s,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    for(const l of h.lanes){ const lx=l-1;
      if(!act){ // 텔레그래프: 바닥 스트라이프 + 깜빡임
        const a=proj(lx-0.45,0,1.5),b=proj(lx+0.45,0,1.5),c=proj(lx+0.45,0,9),d=proj(lx-0.45,0,9); const warning=hazardWarning(h); ctx.fillStyle=warning.fill; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle=warning.edge; ctx.lineWidth=4; ctx.setLineDash([12,8]); ctx.stroke(); ctx.setLineDash([]);
        const p=proj(lx,0,4); ctx.fillStyle='#fff'; ctx.font=`900 ${34*p.s}px ${canvasFont('--disp')}`; ctx.textAlign='center'; ctx.lineWidth=5; ctx.strokeStyle=INK; const lab=h.kind==='low'?'▲ JUMP':h.kind==='high'?'▼ SLIDE':h.soft?'⟳':'!'; ctx.strokeText(lab,p.x,p.y-40*p.s); ctx.fillText(lab,p.x,p.y-40*p.s);
        if(h.vis==='pumpkin'){ const fy=lerp(-3.5,0.4,k*k); const pp=proj(lx,Math.max(0,fy)+0.2,4); ctx.save(); ctx.translate(pp.x,pp.y); ctx.scale(pp.s,pp.s); ctx.rotate(h.t*6); blob(0,0,22,20,'#ff9a2b',5); ctx.fillStyle=INK; ctx.beginPath(); ctx.moveTo(-10,-6);ctx.lineTo(-3,-1);ctx.lineTo(-11,1);ctx.moveTo(10,-6);ctx.lineTo(3,-1);ctx.lineTo(11,1);ctx.fill(); ctx.fillRect(-9,7,18,4); ctx.restore(); }
        if(h.vis==='laser'){ const bp=proj(R.boss?R.boss.x:0,1.6,14); const tp=proj(lx,0.05,4); ctx.save(); ctx.setLineDash([10,10]); ctx.lineDashOffset=-h.t*40; ctx.strokeStyle=`rgba(201,130,31,${0.45+0.45*k})`; ctx.lineWidth=3+3*k; ctx.beginPath(); ctx.moveTo(bp.x,bp.y); ctx.lineTo(tp.x,tp.y); ctx.stroke(); ctx.restore(); ctx.strokeStyle='#c9821f'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(tp.x,tp.y,(26+10*Math.sin(h.t*10))*tp.s,0,7); ctx.stroke(); }
        if(h.vis==='nano'){ const tp=proj(lx,0.1,4); for(let i=0;i<10;i++){ const a=i*0.63+h.t*5; const rr=(90-70*k)*tp.s; ctx.fillStyle=i%2?'#b26df0':'#d7c2f5'; ctx.fillRect(tp.x+Math.cos(a)*rr-3,tp.y+Math.sin(a)*rr*0.4-3,6,6); } }
        if(h.vis==='armslam'||h.vis==='slam'){ const bp=proj(R.boss?R.boss.x:0,2.2,14); const tp=proj(lx,0.6+ (1-k)*2.5,5); ctx.strokeStyle=INK; ctx.lineWidth=18*tp.s+6; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(bp.x,bp.y); ctx.quadraticCurveTo((bp.x+tp.x)/2,tp.y-120,tp.x,tp.y); ctx.stroke(); ctx.strokeStyle='#9aa3b8'; ctx.lineWidth=18*tp.s; ctx.stroke(); }
      } else { // 발동 비주얼
        ctx.globalAlpha=fade; const p=proj(lx,0,4); ctx.save(); ctx.translate(p.x,p.y); ctx.scale(p.s,p.s);
        switch(h.vis){
          case 'bndBoom':{ctx.rotate(h.t*14);ctx.strokeStyle='#d6e8ec';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-55,0);ctx.lineTo(0,-35);ctx.lineTo(55,0);ctx.stroke();break;}
          case 'bndPsi':{ctx.strokeStyle='#ecb2e4';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,-65,55,80,0,0,7);ctx.stroke();ctx.fillStyle='#716f7c';ctx.fillRect(-24,-95,48,48);break;}
          case 'nwhTail':{ctx.strokeStyle='#6e9469';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(-115,-8);ctx.quadraticCurveTo(0,-60,115,-8);ctx.stroke();break;}
          case 'nwhClaw':{ctx.strokeStyle='#dfdfb4';ctx.lineWidth=6;for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(-40+j*25,-170);ctx.lineTo(-10+j*25,-15);ctx.stroke();}break;}

          case 'ffhRock':case 'ffhStorm':case 'ffhWave':case 'ffhLava':case 'ffhDrone':{
            const colors={ffhRock:'#b6a17d',ffhStorm:'#c0d8dc',ffhWave:'#8bdee5',ffhLava:'#ffb449',ffhDrone:'#8ee6b6'},col=colors[h.vis];ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=6;
            if(h.vis==='ffhDrone'){ctx.beginPath();ctx.moveTo(-35,-330);ctx.lineTo(0,-10);ctx.stroke();ctx.fillRect(-45,-350,28,12);}
            else if(h.vis==='ffhRock'){for(let j=0;j<4;j++){ctx.save();ctx.translate(-50+j*32,-10-(j%2)*22);ctx.rotate(j);ctx.fillRect(-15,-15,30,30);ctx.restore();}}
            else if(h.kind==='low'||h.kind==='high'){ctx.beginPath();ctx.ellipse(0,h.kind==='high'?-160:-8,45+(1-fade)*130,20,0,0,Math.PI*2);ctx.stroke();}
            else for(let j=0;j<5;j++){ctx.beginPath();ctx.ellipse(Math.sin(h.t*4+j)*10,-20-j*32,20+j*6,12,0,0,Math.PI*2);ctx.stroke();}
            break;
          }

          case 'vibropunch':case 'vibrowave':{ctx.strokeStyle='#eac86d';ctx.lineWidth=5;for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(0,h.vis==='vibrowave'?-8:-75,20+j*15+(1-fade)*90,h.vis==='vibrowave'?12:25+j*10,0,0,Math.PI*2);ctx.stroke();}break;}
          case 'wingDive':{ctx.strokeStyle='#abbba9';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-130,-145);ctx.lineTo(0,-170);ctx.lineTo(130,-145);ctx.stroke();break;}
          case 'talon':{ctx.strokeStyle='#bfccc3';ctx.lineWidth=8;for(let j=-1;j<=1;j++){ctx.beginPath();ctx.moveTo(j*26,-145);ctx.lineTo(j*36,-40);ctx.lineTo(j*36-15,-18);ctx.stroke();}break;}
          case 'salvageBeam':{ctx.fillStyle='#b66cda';ctx.fillRect(-24,-400,48,400);ctx.fillStyle='#f8d7ff';ctx.fillRect(-7,-400,14,400);break;}

          case 'doubleblade':case 'doublebladeThrow':{
            ctx.translate(0,h.kind==='high'?-160:-85);ctx.rotate(h.vis==='doublebladeThrow'?h.t*16:(1-fade)*2-1);
            ctx.fillStyle='#b9a66c';ctx.strokeStyle=INK;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-105,-24);ctx.lineTo(-35,-8);ctx.lineTo(105,16);ctx.lineTo(105,34);ctx.lineTo(30,8);ctx.lineTo(-105,-8);ctx.closePath();ctx.fill();ctx.stroke();
            ctx.strokeStyle='#fff0b1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-98,-20);ctx.lineTo(98,20);ctx.stroke();break;
          }
          case 'stone0':case 'stone1':case 'stone2':case 'stone3':case 'stone4':case 'stone5':case 'snap':{
            const stone=h.stone??5,col=ENDGAME_STONES[stone].color,age=Math.min(1,(h.t-h.tel)/Math.max(.01,h.dur));
            ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=7;
            if(h.vis==='snap'){for(let i=0;i<6;i++){ctx.strokeStyle=ENDGAME_STONES[i].color;ctx.beginPath();ctx.ellipse(0,-60,35+age*150+i*8,18+age*45+i*4,0,0,Math.PI*2);ctx.stroke();}}
            else if(stone===1){ctx.beginPath();ctx.ellipse(0,-70,42,80,0,0,Math.PI*2);ctx.stroke();ctx.fillRect(-16,-120+age*80,32,60);}
            else if(stone===2){for(let i=0;i<5;i++){ctx.save();ctx.translate(-70+i*35,h.kind==='high'?-150:-15);ctx.rotate(age*1.4);ctx.fillRect(-12,-12,24,24);ctx.restore();}}
            else if(stone===3){for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse((i-1)*28,-80+age*60,10,35,0,0,Math.PI*2);ctx.stroke();}}
            else if(stone===5){ctx.globalAlpha=fade*.7;ctx.fillRect(-110,-185,220,40);ctx.fillStyle='#fff5be';ctx.fillRect(-110,-170,220,10);}
            else{const r=35+(h.reverse?1-age:age)*130;ctx.beginPath();ctx.ellipse(0,-8,r,20,0,0,Math.PI*2);ctx.stroke();if(stone===4){ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(Math.cos(age*6)*r,-8+Math.sin(age*6)*20);ctx.stroke();}}
            break;
          }
          case 'spear':case 'glaive':{const yy=h.kind==='low'?-12:-150;ctx.strokeStyle=h.vis==='spear'?'#7fd8df':'#c1ad76';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-85,yy-20);ctx.lineTo(85,yy+20);ctx.stroke();inkPath(()=>{ctx.moveTo(85,yy+20);ctx.lineTo(112,yy+9);ctx.lineTo(101,yy+35);},'#e1d8b1',3);break;}
          case 'hammer':case 'gauntlet':{const yy=-110+Math.min(1,(h.t-h.tel)/.2)*80;ctx.fillStyle=h.vis==='hammer'?'#626878':'#b8a060';ctx.strokeStyle=INK;ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(-42,yy,84,58,9);ctx.fill();ctx.stroke();break;}
          case 'groundwave':{ctx.strokeStyle='#d4b58d';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(0,h.kind==='high'?-160:-8,45+(1-fade)*150,18,0,0,7);ctx.stroke();break;}
          case 'rubble':{for(let j=0;j<5;j++){const yy=-160+Math.min(1,(h.t-h.tel)/.25)*140;ctx.fillStyle=j%2?'#71818c':'#9a9291';ctx.fillRect(-60+j*24,yy-j%2*22,18,24);}break;}

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
    case 12:{
      const hy=HOR,t=off*.015;
      ctx.fillStyle='#242a30';for(let j=0;j<10;j++){const x=j*W/9;const ht=70+(j*37)%100;ctx.fillRect(x,hy-ht,W/11,ht);ctx.fillStyle='#c5a579';for(let q=0;q<4;q++)ctx.fillRect(x+8,hy-ht+14+q*22,7,10);ctx.fillStyle='#242a30';}
      ctx.strokeStyle='#b186ac';ctx.lineWidth=2;for(let j=0;j<6;j++){let x=W*(j+1)/7,y=hy-90+Math.sin(t+j)*12;ctx.strokeRect(x,y,15,22);}break;
    }
    case 11:{
      ctx.strokeStyle='#ae92d8';ctx.lineWidth=3;for(let i=0;i<4;i++){const x=W*(.15+i*.23);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+30,HOR*.3);ctx.lineTo(x-10,HOR*.5);ctx.lineTo(x+45,HOR*.8);ctx.stroke();}
      ctx.fillStyle='#3e555b';ctx.beginPath();ctx.moveTo(W*.45,HOR);ctx.lineTo(W*.46,HOR-120);ctx.lineTo(W*.4,HOR-185);ctx.lineTo(W*.415,HOR-205);ctx.lineTo(W*.49,HOR-145);ctx.lineTo(W*.54,HOR-142);ctx.lineTo(W*.57,HOR);ctx.fill();
      ctx.fillRect(W*.475,HOR-176,32,40);ctx.fillStyle='#526674';ctx.fillRect(W*.41,HOR-12,W*.2,18);
      ctx.strokeStyle='#7d7889';ctx.lineWidth=3;for(let i=0;i<7;i++){const x=W*(.08+i*.14);ctx.beginPath();ctx.moveTo(x,HOR+15);ctx.lineTo(x,HOR-90);ctx.lineTo(x+60,HOR-45);ctx.lineTo(x,HOR);ctx.stroke();}break;
    }

    case 10:{
      par(.12,(x,i)=>{ctx.fillStyle='#354d56';ctx.fillRect(x,HOR-80,100,90);ctx.fillStyle='#819398';for(let j=0;j<3;j++){ctx.beginPath();ctx.arc(x+18+j*30,HOR-50,10,Math.PI,0);ctx.fill();}});
      for(const x of [W*.25,W*.75]){ctx.fillStyle='#41545e';ctx.fillRect(x-22,HOR-210,44,220);ctx.beginPath();ctx.moveTo(x-30,HOR-210);ctx.lineTo(x,HOR-250);ctx.lineTo(x+30,HOR-210);ctx.fill();}
      ctx.strokeStyle='#97afb3';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(W*.25,HOR-200);ctx.quadraticCurveTo(W*.5,HOR-35,W*.75,HOR-200);ctx.stroke();ctx.fillStyle='#4b6974';ctx.fillRect(0,HOR-15,W,15);break;
    }

    case 7:{
      par(.14,(x,i)=>{const h=40+(i*37)%100;ctx.fillStyle='#263b40';ctx.fillRect(x,HOR-h,115,h+10);ctx.fillStyle='#dfc485';for(let j=0;j<4;j++)ctx.fillRect(x+12+j*24,HOR-h+12,10,15);});
      par(.3,(x,i)=>{ctx.fillStyle=i%2?'#4d625e':'#5c5043';ctx.fillRect(x,HOR-35,100,40);ctx.strokeStyle='#273837';ctx.lineWidth=3;for(let j=0;j<6;j++){ctx.beginPath();ctx.moveTo(x+j*16,HOR-33);ctx.lineTo(x+j*16,HOR+4);ctx.stroke();}});break;
    }
    case 9:{
      ctx.fillStyle='#f1c88b';ctx.beginPath();ctx.arc(W*.72,HOR-145,65,0,Math.PI*2);ctx.fill();
      par(.12,(x,i)=>{const h=70+i*31%140;ctx.fillStyle='#45353d';ctx.beginPath();ctx.moveTo(x,HOR+10);ctx.lineTo(x+25,HOR-h);ctx.lineTo(x+55,HOR-h+38);ctx.lineTo(x+120,HOR+10);ctx.closePath();ctx.fill();});
      par(.3,(x,i)=>{ctx.fillStyle='#332c36';ctx.fillRect(x,HOR-35,74,45);ctx.save();ctx.translate(x+20,HOR-30);ctx.rotate(i%2?.4:-.3);ctx.fillRect(0,-65,12,85);ctx.restore();});break;
    }
    case 8:{ // 외계 침공: 거대 링과 기울어진 첨탑
      const sky=ctx.createLinearGradient(0,0,0,HOR);sky.addColorStop(0,'#20152f');sky.addColorStop(1,'#705365');ctx.fillStyle=sky;ctx.fillRect(0,0,W,HOR);
      ctx.strokeStyle='#332738';ctx.lineWidth=34;ctx.beginPath();ctx.ellipse(W*.72,HOR-145,105,155,-.3,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#bd9565';ctx.lineWidth=5;ctx.stroke();
      par(.12,(x,i)=>{const bh=90+(i*67)%190;ctx.fillStyle='#30283d';ctx.beginPath();ctx.moveTo(x,HOR);ctx.lineTo(x+22,HOR-bh);ctx.lineTo(x+57,HOR-bh-35);ctx.lineTo(x+100,HOR);ctx.closePath();ctx.fill();ctx.strokeStyle='#826550';ctx.lineWidth=3;ctx.stroke();});
      par(.3,(x,i)=>{const bh=30+(i*29)%90;ctx.fillStyle='#493b48';ctx.beginPath();ctx.moveTo(x,HOR+20);ctx.lineTo(x+15,HOR-bh);ctx.lineTo(x+58,HOR-bh+12);ctx.lineTo(x+85,HOR+20);ctx.closePath();ctx.fill();ctx.fillStyle='#d2a16c';ctx.fillRect(x+25,HOR-bh+20,5,Math.max(5,bh-20));});
      break;
    }

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
      // 부서진 고가 철골과 산업용 굴뚝
      par(.24,(x,i)=>{if(i%3)return;ctx.fillStyle='#26343d';ctx.fillRect(x,HOR-175,15,195);ctx.fillRect(x+90,HOR-120,12,140);ctx.save();ctx.translate(x,HOR-153);ctx.rotate(.24);ctx.fillRect(0,0,125,12);ctx.restore();ctx.fillStyle='#a66745';ctx.fillRect(x+2,HOR-174,11,5);});
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
  if(type==='swing'&&(R.issue===6||R.issue===8||R.issue===9)){
    const alien=R.issue>=8;
    const poly=(points,fill,stroke)=>{ctx.beginPath();points.forEach(([x,y,z],i)=>{const p=proj(x,y,z);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    q(-1.9,1.9,z0,z1,alien?'#24102e':'#07151d');
    for(let z=Math.ceil(z0/4)*4;z<z1;z+=4){const end=Math.min(z+2,z1);q(-1.7,1.7,z,end,alien?'#582841':'#142c36');if(alien){q(-.45,.15,z,end,'#d88b4155');}else{q(-1.8,-1.65,z,end,'#42bdd6');q(1.65,1.8,z,end,'#42bdd6');}}
    for(const side of [-1,1]){
      poly([[side*1.9,0,z0],[side*1.9,0,z1],[side*1.9,5,z1],[side*1.9,5,z0]],alien?'#34203e':'#17262d');
      for(let z=Math.ceil(z0/4)*4;z<z1;z+=4){const e=Math.min(z+3.4,z1);
        if(alien){
          poly([[side*1.89,.2,z],[side*1.89,2.1,z+.6],[side*1.89,4.7,e],[side*1.89,1,e]],'#573652','#a17b54');
          poly([[side*1.88,.4,z],[side*1.88,2.3,z+.6],[side*1.88,4.7,e],[side*1.88,4.1,e]],'#936946');
        }else{
          poly([[side*1.89,.2,z],[side*1.89,4.8,z],[side*1.89,4.8,e],[side*1.89,.2,e]],'#233842','#43616a');
          for(const y of [.65,2,3.4])poly([[side*1.88,y,z+.2],[side*1.88,y+.12,z+.2],[side*1.88,y+.12,e-.2],[side*1.88,y,e-.2]],y===2?'#ef534c':'#52c3d4');
          poly([[side*1.87,.2,z],[side*1.87,.4,z],[side*1.87,4.8,e],[side*1.87,4.6,e]],'#101b23');
        }
      }
    }
    for(let z=Math.ceil(z0/10)*10;z<z1;z+=10){
      if(alien){poly([[-1.9,3.5,z],[-.7,5.1,z],[.7,5.1,z],[1.9,3.5,z],[.65,4.7,z],[-.65,4.7,z]],'#a68157','#402c44');}
      else{poly([[-1.9,3.8,z],[1.9,3.8,z],[1.9,4.05,z],[-1.9,4.05,z]],'#344e58','#73a1ac');}
    }
    return;
  }
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
  if((type==='run'||type==='boss')&&(R.issue===6||R.issue===8||R.issue===9)){
    const alien=R.issue>=8,travel=(R.dist/2.2)%6;
    const poly=(pts,fill,stroke)=>{ctx.beginPath();pts.forEach(([x,y,z],i)=>{const p=proj(x,y,z);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}};
    q(-1.7,1.7,z0,z1,alien?'#332538':'#26363d');
    for(let z=-travel;z<z1;z+=6){const lo=Math.max(z0,z),hi=Math.min(z1,z+5.75);if(hi<=lo)continue;
      if(alien){
        for(const lane of [-1,0,1])poly([[lane-.47,0,lo],[lane+.47,0,lo],[lane+.44,0,hi],[lane,0,hi],[lane-.44,0,hi]],lane===0?'#514053':'#443348','#735a62');
        for(const side of [-1,1]){q(side<0?-1.68:1.48,side<0?-1.48:1.68,lo,hi,'#ac8556');}
      }else{
        for(const lane of [-1,0,1])q(lane-.47,lane+.47,lo,hi,((Math.floor((z+travel)/6)+lane)%2)?'#31434a':'#293a43');
        for(const side of [-1,1])q(side<0?-1.68:1.52,side<0?-1.52:1.68,lo,Math.min(hi,lo+.7),'#b29352');
        if(hi-lo>2){poly([[-1.4,0,lo+.5],[-.95,0,lo+1],[-1.15,0,lo+1.4],[-.7,0,lo+2],[-1.22,0,lo+1.48],[-1.04,0,lo+1.05]],'#19272f');}
      }
    }
    for(const x of [-.5,.5]){const a=proj(x,0,z0),b=proj(x,0,z1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=alien?'#c2a17766':'#a4bdc566';ctx.lineWidth=2;ctx.stroke();}
    for(const side of [-1,1]){
      poly([[side*1.7,0,z0],[side*1.7,0,z1],[side*1.8,.22,z1],[side*1.8,.22,z0]],alien?'#806448':'#49616a');
      for(let z=6-travel;z<z1;z+=6){if(z<z0)continue;
        if(alien)poly([[side*1.9,0,z],[side*2.05,.9,z],[side*1.88,1.3,z],[side*1.76,.15,z]],'#604553','#be9766');
        else poly([[side*1.85,0,z],[side*1.85,.48,z],[side*1.91,.48,z],[side*1.91,0,z]],'#68818a');
      }
    }
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

// 0.18: movie-reference geometry, articulated by the active gameplay hazard.
function drawHomecomingBoss(b,t){
 const v=b.fam==='vultureModern',m=infinityMotion(b),w=m.wind,h=m.strike;
 const poly=(p,c)=>inkPath(()=>p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),c,2);
 const ln=(p,c,ww=2)=>{ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=ww;ctx.stroke();};
 ctx.save();ctx.translate(h*(v?0:6),v?-15+Math.sin(t*2)*4-w*12+h*22:Math.sin(t*2)*1.5);ctx.rotate(v?(m.vis==='wingDive'?-w*.12+h*.2:0):-w*.03+h*.06);
 if(v)for(const side of [-1,1]){ctx.save();ctx.scale(side,1);ctx.translate(18,-133);ctx.rotate(-.12+Math.sin(t*2)*.025-w*.23+h*.35);
  poly([[0,0],[48,-30],[135,-36],[172,-20],[137,17],[62,26],[20,15]],'#303d3e');
  poly([[8,-3],[49,-24],[158,-25],[140,-13],[49,-12]],'#839078');
  for(let j=0;j<6;j++){let x=35+j*20;poly([[x,-10],[x+18,-15],[x+10,24-j*3],[x-5,29-j*2]],j%2?'#485653':'#253234');ln([[x+1,-7],[x+6,17-j*2]],'#70847b',1);}
  blob(68,1,23,23,'#1b2b31',3);ctx.strokeStyle='#73dbe6';ctx.lineWidth=3;ctx.beginPath();ctx.arc(68,1,19,0,Math.PI*2);ctx.stroke();for(let j=0;j<8;j++){const a=j*Math.PI/4+t*7;ln([[68+Math.cos(a)*7,Math.sin(a)*7],[68+Math.cos(a+.4)*16,Math.sin(a+.4)*16]],'#719398',2);}
  ln([[15,7],[46,12],[69,1]],'#a0aaa0',3);ctx.restore();}
 for(const side of [-1,1]){const knee=side*22,foot=side*28;poly([[side*7,-77],[side*23,-76],[knee+10,-39],[knee-9,-36]],v?'#45504d':'#202d3b');poly([[knee-9,-38],[knee+10,-37],[foot+10,-7],[foot-9,-6]],'#293438');if(v){poly([[knee-10,-40],[knee+10,-41],[foot+8,-14],[foot-7,-10]],'#87928a');ln([[knee,-35],[foot,-16]],'#c4d0c4');}poly([[foot-10,-8],[foot+10,-8],[foot+17,1],[foot-13,3]],'#1c262e');if(v)for(let j=0;j<3;j++)ln([[foot-7+j*7,0],[foot-11+j*8,8],[foot-16+j*8,9]],'#c7d1c6',2);}
 poly([[-29,-133],[-13,-142],[13,-142],[29,-133],[23,-78],[-23,-78]],v?'#493c34':'#293d51');
 if(v){for(const side of [-1,1]){poly([[side*5,-137],[side*26,-130],[side*19,-88],[side*4,-86]],'#594b3e');ln([[side*7,-131],[side*22,-120],[side*16,-94]],'#948771',1.5);}for(let j=0;j<11;j++)blob(-25+j*5,-139+Math.abs(j-5)*1.2,4,5,j%2?'#a9a58e':'#d1c9a9',1);}
 else {poly([[-10,-139],[0,-130],[10,-139],[16,-126],[13,-83],[-13,-83],[-16,-126]],'#26303f');for(const side of [-1,1]){ln([[side*15,-133],[side*21,-105],[side*20,-82]],'#6b8293',1.5);poly([[side*16,-118],[side*27,-117],[side*26,-105],[side*16,-105]],'#3c5263');}}
 ln([[0,-126],[0,-82]],'#b8aa86',1);poly([[-24,-82],[24,-82],[23,-74],[-23,-74]],'#151f28');poly([[-5,-82],[5,-82],[5,-74],[-5,-74]],'#98a19b');
 for(const side of [-1,1]){ctx.save();ctx.translate(side*27,-128);ctx.rotate(side<0?(v?w*.4-h*.6:w*.8-h*1.6):v?-w*.5+h*.4:.08);ctx.translate(-side*27,128);
  poly([[side*22,-134],[side*35,-130],[side*46,-102],[side*32,-99]],v?'#504537':'#a19d53');poly([[side*32,-102],[side*46,-102],[side*48,-75],[side*36,-72]],v?'#5b5141':'#a3a05a');blob(side*42,-71,8,9,'#1c282f',2);
  if(!v&&side<0){poly([[-51,-109],[-31,-111],[-27,-69],[-34,-58],[-56,-61],[-59,-80]],'#717e85');poly([[-49,-103],[-37,-105],[-35,-75],[-50,-73]],'#253949');for(let j=0;j<4;j++)ln([[-54,-99+j*9],[-31,-100+j*9]],'#b9c2bd',3);ln([[-57,-99],[-60,-68],[-51,-57]],'#cad3cf',3);blob(-42,-66,7,6,'#d0b85c',2);if(w||h){ctx.strokeStyle='#f3d77b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-42,-66,9+w*7+h*9,0,Math.PI*2);ctx.stroke();}}
  if(v){poly([[side*31,-109],[side*45,-108],[side*49,-82],[side*35,-81]],'#79887c');if(side<0&&m.vis==='salvageBeam'){poly([[-60,-94],[-27,-94],[-15,-81],[-60,-77]],'#384d51');ln([[-56,-85],[-18,-85]],'#df9cf0',4);}}
  ctx.restore();}
 poly([[-8,-147],[8,-147],[8,-137],[-8,-137]],v?'#28393a':'#785846');
 if(v){poly([[-19,-160],[-19,-178],[-11,-190],[7,-192],[19,-180],[20,-157],[11,-148],[-9,-148]],'#40504e');poly([[-16,-177],[0,-180],[17,-176],[14,-163],[0,-158],[-14,-164]],'#111e25');for(const side of [-1,1]){blob(side*9,-171,4,4,'#74e797',1);blob(side*9-1,-172,1.2,1.2,'#e2ffe9',0);}poly([[-6,-163],[6,-163],[9,-151],[-8,-151]],'#283c3f');ln([[-7,-156],[-18,-144],[-29,-137]],'#87938a',5);ln([[-17,-182],[-8,-188],[7,-188],[15,-180]],'#a6b3a9',2);}
 else {poly([[-17,-161],[-18,-178],[-12,-187],[0,-191],[12,-187],[18,-178],[16,-159],[8,-150],[-8,-150]],'#886649');poly([[4,-185],[15,-176],[14,-159],[7,-152],[1,-157]],'#644c3c');for(const side of [-1,1]){ln([[side*3,-173],[side*13,-176]],'#302d2a',3);ln([[side*4,-170],[side*11,-172]],'#d1bd9c',1);}ln([[0,-171],[-2,-163],[3,-162]],'#49382e',1.5);ln([[-7,-157],[6,-157]],'#352c28',2);}
 ctx.restore();
}

// Elemental effects use bounded geometry and explicit, non-overlapping telegraphs.
function ffhPattern(b,kind){
 const turn=b.ffhTurn||0;b.ffhTurn=turn+1;
 const k=kind===4?turn%4:kind,l=Math.floor(PR()*3),all=[0,1,2];
 const names=['암석 분쇄','폭풍 회오리','물기둥 · 파도','용암 분출','원소 융합','드론 환영 포격'];
 const vis=['ffhRock','ffhStorm','ffhWave','ffhLava','ffhRock','ffhDrone'][k];
 const h=(type,lanes,tel,more={})=>({kind:type,lanes,tel,dur:.3,vis,label:names[k],...more});
 if(k===0)return [h('strike',[l],1.45),h('low',all,2.9)];
 if(k===1)return [h('strike',[l],1.5,{soft:true}),h('high',all,3)];
 if(k===2)return [h('strike',[l],1.4),h('low',all,2.9)];
 if(k===3)return [h('strike',all.filter(x=>x!==l),1.6),h('low',all,3.1)];
 return [h('strike',all.filter(x=>x!==l),1.7),h('strike',[l],3.2)];
}
// 0.19: six reference-driven silhouettes, animated from the live hazard clock.
function drawFarFromHomeBoss(b,t){
 const kind=FFH_FAMS.indexOf(b.fam),m=infinityMotion(b),w=m.wind,hit=m.strike;
 const poly=(p,c,width=2)=>inkPath(()=>p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),c,width);
 const line=(p,c,width=2)=>{ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();};
 ctx.save();
 if(kind===5){
  ctx.translate(0,-10+Math.sin(t*1.7)*4);
  poly([[-30,-144],[-48,-112],[-65,7],[-29,-5],[0,7],[35,-7],[66,1],[43,-116],[27,-146]],'#492637');
  for(let i=-2;i<=2;i++)line([[i*12,-124],[i*24,-6]],'#6d3b50',2);
  for(const side of [-1,1]){ctx.save();ctx.scale(side,1);
   poly([[5,-77],[21,-77],[29,-39],[21,-32],[9,-40]],'#225950');poly([[20,-38],[30,-38],[35,-9],[20,-5]],'#28675d');
   poly([[20,-37],[29,-37],[30,-12],[23,-7]],'#a99a68');poly([[20,-9],[35,-8],[43,0],[17,2]],'#344f4c');
   poly([[4,-135],[25,-137],[30,-118],[21,-83],[4,-82]],'#366e5e');
   ctx.save();ctx.translate(25,-129);ctx.rotate(-.15-w*.65+hit*.95);ctx.translate(-25,129);
   poly([[23,-138],[34,-130],[44,-103],[32,-99]],'#286653');poly([[33,-105],[46,-106],[52,-81],[40,-78]],'#b8a46b');blob(47,-76,6,7,'#327866',2);
   if(w||hit){ctx.strokeStyle='#81e9b4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(47,-77,12+w*10+hit*8,0,Math.PI*2);ctx.stroke();}ctx.restore();ctx.restore();
  }
  for(let j=0;j<5;j++){const y=-133+j*11,ww=25-j*2;poly([[-ww,y],[-3,y+4],[ww,y],[ww-3,y+8],[0,y+12],[-ww+3,y+8]],'#ad9a67');line([[-ww+3,y+2],[0,y+8],[ww-3,y+2]],'#e2d3a3',1);}
  blob(0,-165,25,27,'#497b91',3);ctx.save();ctx.beginPath();ctx.ellipse(0,-165,24,26,0,0,Math.PI*2);ctx.clip();for(let j=0;j<5;j++){ctx.strokeStyle=['#9ebbd0','#76b8bd','#827eb8'][j%3];ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(Math.sin(t+j)*8,-179+j*8,28,8,Math.sin(t*.4+j),0,Math.PI*2);ctx.stroke();}ctx.restore();line([[-14,-184],[-6,-188],[5,-188]],'#d8edef',2);poly([[-16,-140],[16,-140],[13,-135],[-12,-135]],'#c7b87f');
  for(const side of [-1,1]){const x=side*(64+Math.sin(t)*5),y=-100+Math.sin(t*2+side)*12;poly([[x-13,y-4],[x-7,y-9],[x+9,y-9],[x+14,y-3],[x+8,y+5],[x-8,y+5]],'#3b535d');blob(x,y-1,3,3,'#92edc1',0);line([[x-22,y],[x+22,y]],'#93a6a8',2);}
 }else if(kind===1){
  for(let j=0;j<16;j++){const y=-8-j*12,rr=12+j*3.6+Math.sin(t*3+j)*4;ctx.strokeStyle=j%2?'#7e9fa9':'#bdd3d5';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(Math.sin(t*2+j*.3)*(6+w*8),y,rr,7+j*.35,t*.2,0,Math.PI*2);ctx.stroke();}
  for(let j=0;j<12;j++){const a=t*3+j*2.3,x=Math.sin(a)*(25+j*3),y=-15-j*15;poly([[x-4,y-3],[x+5,y-4],[x+6,y+3],[x-3,y+4]],'#536873',1);}
  for(const side of [-1,1])line([[side*6,-169],[side*22,-173]],'#e4f8f6',3);
 }else{
  const fusion=kind===4,water=kind===2,fire=kind===3;
  const body=water?'#367d91':fire?'#493d39':fusion?'#41565d':'#938571';
  ctx.scale(fusion?1.15:1,fusion?1.08:1);ctx.translate(hit*4,Math.sin(t*1.4)*2+hit*5);
  const rock=(x,y,rx,ry,c,n=7)=>{poly(Array.from({length:n},(_,j)=>{const a=j*Math.PI*2/n;return [x+Math.cos(a)*rx*(j%2?.88:1),y+Math.sin(a)*ry*(j%2?.9:1)];}),c,water?1:2);};
  for(const side of [-1,1]){rock(side*24,-54,19,40,body);rock(side*29,-17,17,25,body);rock(side*34,1,26,10,body);}
  rock(0,-112,48,59,body,9);rock(0,-166,27,31,body,8);
  for(const side of [-1,1]){ctx.save();ctx.translate(side*41,-137);ctx.rotate(side*(w*.8-hit*1.3));ctx.translate(-side*41,137);rock(side*45,-133,23,25,body);rock(side*62,-104,20,31,body);rock(side*67,-76,24,21,body);ctx.restore();}
  for(let j=0;j<26;j++){const x=Math.sin(j*13.7)*38,y=-160+(j*23)%105;
   if(water){ctx.strokeStyle=j%2?'#a2dce0':'#62b4c7';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x+Math.sin(t*2+j)*2,y,8,3,0,0,Math.PI*2);ctx.stroke();}
   else if(fire||fusion){line([[x,y],[x+4,y+8],[x-3,y+14]],j%3?'#e88534':'#f7cc71',2.4);}
   else rock(x,y,7+j%4,5+j%3,j%2?'#b7a78c':'#776c5b',5);
  }
  for(const side of [-1,1]){line([[side*5,-169],[side*17,-174]],fire?'#ffe29a':water?'#bedee0':'#d9cbb0',3);}
  if(fire||fusion)for(let j=0;j<10;j++){const x=Math.sin(j*8.7)*50,y=-115-j*7;poly([[x-5,y],[x-2,y-12-Math.sin(t*5+j)*6],[x+2,y-5],[x+6,y]],j%2?'#eaa14e':'#ed7431',0);}
  if(water||fusion)for(let j=0;j<6;j++){ctx.strokeStyle=j%2?'#81bfc8':'#527f91';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,-j*5,35+j*7+Math.sin(t*2+j)*4,7,0,0,Math.PI*2);ctx.stroke();}
  if(fusion)for(let j=0;j<4;j++){ctx.strokeStyle='#acbfc6';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,-110+j*18,60,10,Math.sin(t+j)*.1,0,Math.PI*2);ctx.stroke();}
 }
 ctx.restore();
}

function nwhPattern(b,k){
 const l=Math.floor(PR()*3),all=[0,1,2];
 const make=(kind,lanes,tel,vis,soft=false)=>({kind,lanes,tel,dur:.3,vis,soft,actor:k,label:NWH_NAMES[k].replace('(노 웨이 홈)','')+' · '+(kind==='low'?'JUMP':kind==='high'?'SLIDE':'차선 이동')});
 if(k===0)return [make('strike',[l],1.4,'slam',true),make('low',all,2.9,'sweep')];
 if(k===1)return [make('strike',[l],1.5,'pumpkin'),make('high',all,3,'swoop')];
 if(k===2)return [make('low',all,1.5,'fist'),make('strike',[l],3,'pillar')];
 if(k===3)return [make('low',all,1.45,'nwhTail'),make('strike',[l],3,'nwhClaw',true)];
 return [make('strike',all.filter(x=>x!==l),1.65,'arc')];
}
function drawNoWayHomeBoss(b,t){
 if(b.fam==='nwhAll'){
  // One combat entity and one HP pool; members below are rendering poses only.
  const slots=[[-125,-75],[0,-105],[125,-75],[-70,0],[70,0]];
  slots.forEach(([x,y],k)=>{ctx.save();ctx.translate(x,y);ctx.scale(.48,.48);drawNwhMember(b,t,k);ctx.restore();});
 }else drawNwhMember(b,t,NWH_FAMS.indexOf(b.fam));
}
function drawNwhMember(b,t,k){
 const active=R&&R.hazards?.find(h=>h.fam===b.fam&&h.actor===k&&h.t>=h.tel-.6&&h.t<h.tel+.5);
 const d=active?active.t-active.tel:-9,w=active&&d<0?(d+.6)/.6:0,hit=active&&d>=0?Math.max(0,1-d/.5):0;
 const skin=['#baa386','#b9a181','#b39b74','#58765a','#95724f'][k],cloth=['#393b35','#688644','#b39b74','#58765a','#303640'][k];
 const poly=(p,c)=>inkPath(()=>p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),c,2);
 const ln=(p,c,n=2)=>{ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=n;ctx.lineCap='round';ctx.stroke();};
 ctx.save();ctx.translate(hit*5,k===1?-12+Math.sin(t*2)*3:k===3?-w*8+hit*6:Math.sin(t*1.5)*2);
 if(k===0)for(let j=0;j<4;j++){const side=j<2?-1:1,yy=j%2?-55:-168,tip=[side*(85+j%2*15),yy-w*25+hit*40];ln([[side*18,-108],[side*55,yy+18],tip],'#252b30',13);ln([[side*18,-108],[side*55,yy+18],tip],'#849094',9);for(let i=0;i<7;i++){const q=i/7,x=side*55+(tip[0]-side*55)*q,y=yy+18+(tip[1]-yy-18)*q;ln([[x-4,y-2],[x+4,y+2]],'#c7cccc',1.5);}blob(tip[0],tip[1],7,7,'#303b43',2);blob(tip[0],tip[1],3,3,'#e77b4f',0);for(const ss of [-1,1])ln([[tip[0],tip[1]],[tip[0]+ss*15,tip[1]-12],[tip[0]+ss*8,tip[1]-23]],'#9ca9ad',4);}
 if(k===3){ctx.strokeStyle='#45634b';ctx.lineWidth=17;ctx.beginPath();ctx.moveTo(10,-64);ctx.quadraticCurveTo(110,-5,100+hit*20,-65+Math.sin(t*2)*10);ctx.stroke();}
 if(k===0)poly([[-29,-134],[-40,-9],[-15,-20],[0,-50],[17,-20],[42,-9],[29,-134]],'#343933');
 if(k===1)poly([[-22,-142],[-37,-103],[-41,-75],[-28,-90],[29,-85],[33,-115],[24,-146]],'#51445e');
 for(const side of [-1,1]){poly([[side*6,-77],[side*23,-76],[side*29,-36],[side*12,-35]],k===4?'#a89c80':cloth);poly([[side*13,-36],[side*29,-35],[side*32,-7],[side*17,-5]],cloth);poly([[side*16,-8],[side*33,-8],[side*40,2],[side*13,2]],k===2||k===3?skin:'#272f32');}
 poly([[-30,-136],[-13,-147],[13,-147],[30,-136],[23,-79],[-23,-79]],cloth);
 if(k===2||k===3){for(let j=0;j<4;j++){const yy=-129+j*12;ln([[-20,yy],[-3,yy+5],[20,yy]],k===2?'#dac4a0':'#93a37b',3);}}
 if(k===0){for(const side of [-1,1])poly([[side*6,-140],[side*29,-135],[side*22,-86],[side*9,-95]],'#494b40');for(let j=0;j<3;j++)ln([[-20,-93+j*5],[20,-93+j*5]],'#89908a',2);}
 if(k===1){for(const side of [-1,1])poly([[side*3,-133],[side*24,-133],[side*22,-111],[side*5,-108]],'#95ac56');ln([[-22,-125],[20,-91]],'#756956',4);}
 if(k===4){for(const side of [-1,1]){ln([[side*25,-134],[side*5,-113],[side*18,-91]],'#d7bb64',5);ln([[side*28,-137],[side*37,-122],[side*34,-88]],'#bcb791',3);}blob(0,-122,9,9,'#98cbd0',2);blob(0,-122,5,5,'#e1f9e1',0);}
 for(const side of [-1,1]){ctx.save();ctx.translate(side*28,-132);ctx.rotate(side*(w*.7-hit*1.1));ctx.translate(-side*28,132);poly([[side*25,-137],[side*38,-129],[side*46,-104],[side*32,-99]],cloth);poly([[side*32,-104],[side*46,-104],[side*49,-76],[side*36,-74]],k===0?cloth:skin);blob(side*42,-70,k===2?13:8,10,k===0?'#393731':skin,2);if(k===3)for(let j=0;j<3;j++)ln([[side*42+j*4,-66],[side*47+j*4,-57]],'#d7d9ad',2);if(k===1&&side<0)blob(-43,-72,8,8,'#dc9c42',2);ctx.restore();}
 poly([[-8,-148],[8,-148],[8,-137],[-8,-137]],skin);
 poly([[-18,-166],[-17,-182],[-7,-190],[8,-190],[18,-179],[17,-160],[8,-149],[-7,-149]],skin);
 if(k===0){poly([[-18,-175],[-21,-185],[-9,-197],[10,-194],[20,-184],[17,-173],[8,-184],[-9,-180]],'#413d33');for(const side of [-1,1])blob(side*9,-174,7,6,'#14212a',2);ln([[-3,-174],[3,-174]],'#888d88',2);}
 else for(const side of [-1,1]){ln([[side*3,-173],[side*13,-177]],'#343b32',3);ln([[side*5,-171],[side*11,-173]],k===3?'#d8d68e':'#dad1b7',1.5);}
 ln([[0,-172],[-2,-163],[3,-163]],'#595445',1.5);ln([[-7,-157],[7,-157]],'#454637',2);
 if(k===1){poly([[-20,-162],[-26,-178],[0,-207],[25,-178],[20,-159],[15,-181],[0,-190],[-15,-181]],'#635471');for(const side of [-1,1])blob(side*9,-174,6,6,'#20242b',2);poly([[-19,-147],[23,-153],[32,-140],[2,-135],[-29,-138]],'#56425f');}
 if(k===2||k===3)for(let j=0;j<24;j++){let x=Math.sin(j*9)*24,y=-125+(j*13)%45;ln([[x,y],[x+3,y+2]],k===2?'#d5bf99':'#91a077',1.3);}
 if(k===3){poly([[-11,-163],[11,-163],[13,-155],[0,-146],[-12,-155]],'#344639');for(let j=0;j<5;j++)poly([[-8+j*4,-160],[-6+j*4,-155],[-4+j*4,-160]],'#e0dab4');}
 if(k===4)for(let j=0;j<5;j++){const a=-Math.PI+j*Math.PI/4,x=Math.cos(a),y=Math.sin(a);ln([[x*8,-172+y*8],[x*26,-172+y*24],[x*21,-172+y*30],[x*(40+w*10),-172+y*43]],'#f9dc77',2);}
 if(k===1){poly([[-76,8],[-37,-8],[0,0],[37,-8],[76,8],[35,15],[0,9],[-35,15]],'#5d6b5d');ln([[-64,8],[0,4],[64,8]],'#a5b091',2);}
 ctx.restore();
}

function bndPattern(b,k){
 const l=Math.floor(PR()*3),all=[0,1,2];
 const h=(kind,lanes,tel,vis,label,actor=k)=>({kind,lanes,tel,dur:.35,vis,label,actor});
 if(k===0)return [h('strike',[l],1.5,'slam','스콜피온 · 꼬리 찌르기 / 차선 이동'),h('low',all,3.2,'nwhTail','스콜피온 · 꼬리 휩쓸기 / JUMP')];
 if(k===1)return [h('strike',[l],1.6,'fist','툼스톤 · 강철 주먹 / 차선 이동'),h('low',all,3.3,'fist','툼스톤 · 지면 강타 / JUMP')];
 if(k===2)return [h('strike',[l],1.5,'bndBoom','부메랑 · 투척 / 차선 이동'),h('strike',[(l+1)%3],3.2,'bndBoom','부메랑 · 돌아오는 궤적 / 차선 이동')];
 const turn=(b.bndTurn||0)%3;b.bndTurn=(b.bndTurn||0)+1;
 if(turn===0)return [h('low',all,1.8,'fist','정신 지배 · 헐크 강타 / JUMP',4)];
 if(turn===1)return [h('strike',all.filter(x=>x!==l),1.9,'laser','정신 지배 · 퍼니셔 사격 / 빈 차선',5)];
 return [h('strike',[l],1.8,'bndPsi','진 그레이 · 염동력 잔해 / 차선 이동'),h('high',all,3.6,'bndPsi','진 그레이 · 공중 잔해 / SLIDE')];
}
function drawBrandNewDayBoss(b,t){
 const k=BND_FAMS.indexOf(b.fam);
 if(k===3){
  for(const [j,x] of [[4,-105],[5,105]]){ctx.save();ctx.translate(x,0);ctx.scale(.7,.7);drawBndMember(b,t,j);ctx.restore();}
  ctx.strokeStyle='#d997ce';ctx.lineWidth=2;for(const x of [-105,105]){ctx.beginPath();ctx.moveTo(0,-135);ctx.quadraticCurveTo(x,-210,x,-135);ctx.stroke();}
 }
 drawBndMember(b,t,k);
}
function drawBndMember(b,t,k){
 if(k===3){drawJeanGrey(b,t);return;}
 const active=R?.hazards?.find(h=>h.fam===b.fam&&h.actor===k&&h.t>h.tel-.65&&h.t<h.tel+.4);
 const d=active?active.t-active.tel:-10,w=active?d<0?(d+.65)/.65:Math.max(0,1-d/.4):0;
 const p=(a,c)=>inkPath(()=>a.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),c,2);
 const line=(a,c,n=3)=>{ctx.beginPath();a.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=n;ctx.lineCap='round';ctx.stroke();};
 const skin=['#b99579','#b7afa5','#a98c76','#e0b99b','#6f8d59','#bc9b83'][k],suit=['#303d39','#80634d','#273842','#8e7850','#63834f','#30373b'][k];
 ctx.save();ctx.translate(0,k===3?-20+Math.sin(t*2)*5:Math.sin(t*2)*1.5);if(k===1||k===4)ctx.scale(1.25,1.1);
 if(k===0){
  const pts=[];for(let j=0;j<=16;j++){const a=j/16*Math.PI*1.35;pts.push([25+65*Math.sin(a),-68-100*(1-Math.cos(a))*.7+w*38*j/16]);}
  line(pts,'#172324',17);line(pts,'#69796d',11);for(let j=1;j<pts.length;j++)blob(pts[j][0],pts[j][1],6,4,'#829184',1);
  const [x,y]=pts.at(-1);p([[x-10,y],[x+10,y],[x+7,y+20],[x-5,y+32]],'#c5d0bf');
 }
 for(const s of [-1,1]){
  p([[s*5,-72],[s*24,-72],[s*28,-35],[s*12,-30]],k===4?'#4a4850':suit);
  p([[s*12,-33],[s*28,-35],[s*30,-4],[s*14,-3]],suit);
  p([[s*12,-7],[s*30,-7],[s*38,3],[s*11,3]],'#24292c');
 }
 p([[-29,-137],[-13,-146],[13,-146],[29,-137],[25,-74],[-25,-74]],suit);
 for(const s of [-1,1]){
  p([[s*2,-135],[s*25,-132],[s*22,-109],[s*3,-106]],k===0?'#596a5f':k===2?'#c0cccd':k===5?'#4e5c5c':suit);
  line([[s*4,-105],[s*23,-100]],'#1c272b',2);
 }
 if(k===1){p([[-13,-143],[0,-121],[13,-143],[6,-105],[-6,-105]],'#d0c6b5');p([[-3,-130],[4,-130],[6,-104],[0,-98],[-5,-106]],'#413b34');}
 if(k===3)p([[-29,-140],[-37,-37],[-18,-47],[0,-72],[18,-47],[37,-37],[29,-140]],'#8c784f');
 for(const s of [-1,1]){
  ctx.save();ctx.translate(s*29,-133);ctx.rotate(s*(k===3?-.8-w*.4:-w*1.15));
  p([[-9,0],[9,0],[13,30],[-10,34]],suit);p([[-10,30],[13,30],[12,56],[-8,58]],k===4?skin:suit);blob(2,62,k===4?15:9,10,skin,2);
  if(k===2){line([[0,60],[24,32],[40,68]],'#d0dcde',9);}
  if(k===5&&s===1){p([[-9,43],[65,43],[65,53],[20,55],[14,70],[4,68]],'#20282d');line([[60,48],[80,48]],'#7d8887',4);if(active&&d>=0)blob(83,48,10,5,'#f5d79a',0);}
  if(k===3){ctx.strokeStyle='#e5a7d7';ctx.lineWidth=2;ctx.beginPath();ctx.arc(2,62,16+Math.sin(t*4)*3,0,7);ctx.stroke();}
  ctx.restore();
 }
 p([[-8,-146],[8,-146],[8,-138],[-8,-138]],skin);
 p([[-17,-182],[-8,-192],[9,-191],[18,-180],[16,-158],[7,-148],[-8,-150],[-17,-162]],skin);
 if(k===3){p([[-18,-161],[-25,-187],[0,-210],[25,-186],[18,-160],[13,-185],[0,-192],[-14,-184]],'#aa905e');line([[-13,-182],[-8,-159]],'#a55f39',5);line([[13,-182],[10,-157]],'#a55f39',5);}
 if(k===4||k===5)p([[-18,-177],[-19,-189],[-8,-198],[12,-194],[20,-184],[13,-180],[5,-188],[-8,-184]],'#303a30');
 for(const s of [-1,1]){line([[s*3,-175],[s*13,-179]],'#3a3632',3);line([[s*5,-172],[s*11,-174]],k>=4?'#e6a1e1':'#343c39',2);}
 line([[0,-174],[-2,-165],[3,-165]],'#796b59',2);line([[-7,-158],[7,-158]],'#51463e',2);
 if(k===2){p([[-21,-182],[21,-182],[18,-169],[-18,-169]],'#bacfd3');line([[-15,-179],[13,-179]],'#eff9f9',2);}
 if(k===5){p([[-11,-125],[11,-125],[14,-111],[7,-105],[7,-98],[-7,-98],[-7,-105],[-14,-111]],'#b6beb7');blob(-5,-115,3,3,'#30373b',0);blob(5,-115,3,3,'#30373b',0);}
 if(k===3)for(let j=0;j<4;j++){ctx.save();ctx.translate(Math.cos(t+j*1.57)*63,-130+Math.sin(t+j*1.57)*47);ctx.rotate(t+j);p([[-9,-8],[8,-10],[12,8],[-8,10]],'#8f8895');ctx.restore();}
 ctx.restore();
}

// 0.23: Jean-specific face, wavy hair and jacket, animated from combat cues.
function drawJeanGrey(b,t){
 const h=R?.hazards?.find(h=>h.fam===b.fam&&h.t>h.tel-.65&&h.t<h.tel+.4);
 const d=h?h.t-h.tel:-10,a=h?d<0?(d+.65)/.65:Math.max(0,1-d/.4):0;
 const p=(v,c)=>inkPath(()=>v.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)),c,1.6);
 const line=(v,c,n=1.5)=>{ctx.beginPath();v.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=c;ctx.lineWidth=n;ctx.lineCap='round';ctx.stroke();};
 const curve=(fn,c,n=1.5)=>{ctx.beginPath();fn();ctx.strokeStyle=c;ctx.lineWidth=n;ctx.stroke();};
 ctx.save();ctx.translate(0,-20+Math.sin(t*2)*4);
 // Hair behind shoulders.
 inkPath(()=>{ctx.moveTo(-19,-184);ctx.bezierCurveTo(-40,-172,-24,-145,-38,-115);ctx.quadraticCurveTo(-17,-119,-11,-134);ctx.lineTo(17,-134);ctx.quadraticCurveTo(36,-115,38,-128);ctx.bezierCurveTo(20,-151,38,-181,18,-195);ctx.quadraticCurveTo(-5,-207,-19,-184);},'#663c2b',1.6);
 for(const s of [-1,1]){
  p([[s*3,-78],[s*20,-78],[s*21,-37],[s*8,-35]],'#2b3038');
  p([[s*8,-38],[s*21,-38],[s*23,-6],[s*10,-5]],'#30363d');
  p([[s*9,-9],[s*24,-9],[s*31,2],[s*8,2]],'#1c252e');
  line([[s*16,-30],[s*18,-10]],'#67717b',1);
 }
 p([[-21,-139],[-10,-145],[10,-145],[23,-137],[19,-98],[23,-73],[-23,-73],[-18,-98]],'#252f38');
 p([[-8,-141],[8,-141],[9,-82],[-9,-82]],'#161e29');
 // Ochre lining of the lowered hood and jacket lapels.
 for(const s of [-1,1]){
  p([[s*9,-144],[s*25,-140],[s*29,-127],[s*18,-130],[s*10,-112]],'#ad9059');
  p([[s*21,-130],[s*11,-110],[s*13,-80],[s*22,-75],[s*18,-101]],'#3f4547');
  line([[s*12,-109],[s*14,-82]],'#7d817d',1);
  ctx.save();ctx.translate(s*23,-134);ctx.rotate(s*(-.32-a*.85));
  p([[-7,0],[7,0],[10,28],[6,48],[-5,48],[-9,28]],'#2a333c');
  line([[-3,7],[-5,28],[-2,41]],'#667075',2);
  blob(0,51,5,7,'#e1b8a0',1);
  for(let j=0;j<4;j++)line([[-4+j*2.6,52],[-6+j*3.6,60+(j%2)*2]],'#e1b8a0',2);
  ctx.strokeStyle='#e8b3e2';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,54,14+a*6,10+a*6,t,0,7);ctx.stroke();
  ctx.restore();
 }
 p([[-6,-151],[6,-151],[7,-140],[0,-136],[-7,-140]],'#ddb299');
 // Curved jaw and cheeks, independent of the common boss head.
 inkPath(()=>{ctx.moveTo(-15,-181);ctx.bezierCurveTo(-18,-170,-13,-156,-6,-152);ctx.quadraticCurveTo(0,-148,6,-152);ctx.bezierCurveTo(14,-156,17,-172,14,-183);ctx.quadraticCurveTo(0,-195,-15,-181);},'#edc4ab',1.3);
 for(const s of [-1,1]){
  curve(()=>{ctx.moveTo(s*3,-174);ctx.quadraticCurveTo(s*8,-177,s*13,-173);},'#805440',1.2);
  inkPath(()=>{ctx.moveTo(s*3,-170);ctx.quadraticCurveTo(s*8,-174,s*13,-170);ctx.quadraticCurveTo(s*8,-167,s*3,-170);},'#f1eee1',.65);
  blob(s*8,-170,2.2,2.5,'#639a9d',0);blob(s*8,-170,1,1.7,'#213b46',0);blob(s*8-.6,-171,.65,.65,'#fff',0);
  line([[s*3,-171],[s*8,-173],[s*13,-171]],'#563e35',.8);
 }
 curve(()=>{ctx.moveTo(0,-170);ctx.quadraticCurveTo(-2,-164,1,-163);},'#b88774',.8);
 curve(()=>{ctx.moveTo(-5,-158);ctx.quadraticCurveTo(0,-160,5,-158);ctx.quadraticCurveTo(0,-155,-5,-158);},'#b97672',1);
 // Swept bangs and moving side locks.
 inkPath(()=>{ctx.moveTo(-18,-170);ctx.bezierCurveTo(-26,-190,-9,-200,5,-194);ctx.bezierCurveTo(24,-196,24,-180,17,-168);ctx.lineTo(12,-184);ctx.quadraticCurveTo(4,-181,1,-177);ctx.lineTo(4,-189);ctx.quadraticCurveTo(-7,-179,-18,-170);},'#814830',1.2);
 for(const s of [-1,1]){
  const wind=Math.sin(t*2+s)*3;
  curve(()=>{ctx.moveTo(s*17,-180);ctx.bezierCurveTo(s*27,-167,s*13,-153,s*24+wind,-141);ctx.quadraticCurveTo(s*33+wind,-131,s*24,-125);},'#95573a',8);
  curve(()=>{ctx.moveTo(s*18,-179);ctx.bezierCurveTo(s*25,-163,s*15,-150,s*25+wind,-137);},'#c18450',1.6);
 }
 curve(()=>{ctx.moveTo(-17,-182);ctx.quadraticCurveTo(-8,-194,3,-192);},'#b47749',1.5);
 for(let j=0;j<4;j++){ctx.save();ctx.translate(Math.cos(t+j*1.57)*64,-115+Math.sin(t+j*1.57)*35);ctx.rotate(t+j);p([[-7,-6],[7,-8],[10,6],[-6,8]],'#918b9c');ctx.restore();}
 ctx.restore();
}
