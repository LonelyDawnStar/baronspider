// ===== 효과음 (Web Audio 합성) =====
const SFX={ac:null,on:true,master:null,verb:null,
  init(){ if(this.ac)return; try{ this.ac=new (window.AudioContext||window.webkitAudioContext)(); const ac=this.ac;
      this.master=ac.createGain(); this.master.gain.value=0.5; const comp=ac.createDynamicsCompressor(); comp.threshold.value=-18; comp.knee.value=20; comp.ratio.value=4; comp.attack.value=0.003; comp.release.value=0.2; this.master.connect(comp); comp.connect(ac.destination);
      // 간이 리버브 (감쇠 노이즈 임펄스)
      const len=ac.sampleRate*1.4, ir=ac.createBuffer(2,len,ac.sampleRate); for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); for(let i=0;i<len;i++){ d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.8); } }
      const cv=ac.createConvolver(); cv.buffer=ir; const vg=ac.createGain(); vg.gain.value=0.35; cv.connect(vg); vg.connect(this.master); this.verb=cv; }catch(e){} },
  resume(){ if(document.hidden)return; this.init(); if(this.ac&&this.ac.state==='suspended')this.ac.resume(); },
  // 기본 톤: 필터·디튠 스택·리버브 전송
  tone(f,d,{type='sine',g=0.4,slide=0,att=0.008,delay=0,lp=8000,q=0.7,detune=0,voices=1,verb=0,rel=null}={}){ if(!this.on||!this.ac)return; const ac=this.ac,t=ac.currentTime+delay; const v=ac.createGain(); const flt=ac.createBiquadFilter(); flt.type='lowpass'; flt.frequency.setValueAtTime(lp,t); flt.Q.value=q; flt.frequency.exponentialRampToValueAtTime(Math.max(120,lp*0.35),t+d); v.gain.setValueAtTime(0.0001,t); v.gain.linearRampToValueAtTime(g/Math.sqrt(voices),t+att); v.gain.exponentialRampToValueAtTime(0.0001,t+(rel||d)); flt.connect(v); v.connect(this.master); if(verb&&this.verb){ const s=ac.createGain(); s.gain.value=verb; v.connect(s); s.connect(this.verb); }
    for(let i=0;i<voices;i++){ const o=ac.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t+d); o.detune.value=(i-(voices-1)/2)*detune; o.connect(flt); o.start(t); o.stop(t+d+0.1); } },
  noise(d,{g=0.3,type='bandpass',f0=1200,f1=300,q=0.8,att=0.003,delay=0,verb=0}={}){ if(!this.on||!this.ac)return; const ac=this.ac,t=ac.currentTime+delay; const n=Math.max(1,ac.sampleRate*d|0); const b=ac.createBuffer(1,n,ac.sampleRate); const ch=b.getChannelData(0); for(let i=0;i<n;i++)ch[i]=Math.random()*2-1; const s=ac.createBufferSource(); s.buffer=b; const flt=ac.createBiquadFilter(); flt.type=type; flt.Q.value=q; flt.frequency.setValueAtTime(f0,t); flt.frequency.exponentialRampToValueAtTime(Math.max(40,f1),t+d); const v=ac.createGain(); v.gain.setValueAtTime(0.0001,t); v.gain.linearRampToValueAtTime(g,t+att); v.gain.exponentialRampToValueAtTime(0.0001,t+d); s.connect(flt); flt.connect(v); v.connect(this.master); if(verb&&this.verb){ const sg=ac.createGain(); sg.gain.value=verb; v.connect(sg); sg.connect(this.verb); } s.start(t); },
  thump(g=0.8,f=110,d=0.25,delay=0){ this.tone(f,d,{type:'sine',g,slide:0.35,att:0.002,lp:400,delay}); this.noise(0.06,{g:g*0.5,type:'lowpass',f0:900,f1:200,delay}); },
  chord(freqs,d,{type='triangle',g=0.18,att=0.02,stagger=0,verb=0.6,lp=2600,detune=6,voices=2}={}){ freqs.forEach((f,i)=>this.tone(f,d,{type,g,att,delay:i*stagger,lp,detune,voices,verb})); },
  // --- 내장 샘플 (mp3) ---
  _sbuf:{},_sdec:{},
  sample(name,{g=1,rate=1,verb=0,delay=0,dur=0}={}){ if(!this.on)return false; this.init(); if(!this.ac)return false;
    const buf=this._sbuf[name];
    if(!buf){ if(!this._sdec[name]&&typeof BUILTIN_SFX!=='undefined'&&BUILTIN_SFX[name]){ this._sdec[name]=1;
        try{ const durl=BUILTIN_SFX[name], i=durl.indexOf(','), bin=atob(durl.slice(i+1)); const arr=new Uint8Array(bin.length); for(let j=0;j<bin.length;j++)arr[j]=bin.charCodeAt(j);
          this.ac.decodeAudioData(arr.buffer,b=>{this._sbuf[name]=b;},e=>console.warn('sfx decode fail',name,e)); }catch(e){ console.warn('sfx decode fail',name,e); } }
      return false; }
    const t=this.ac.currentTime+delay; const s=this.ac.createBufferSource(); s.buffer=buf; s.playbackRate.value=rate;
    const v=this.ac.createGain(); v.gain.setValueAtTime(g,t);
    if(dur){ v.gain.setValueAtTime(g,t+dur*0.55); v.gain.exponentialRampToValueAtTime(0.0001,t+dur); }
    s.connect(v); v.connect(this.master);
    if(verb&&this.verb){ const sg=this.ac.createGain(); sg.gain.value=verb; v.connect(sg); sg.connect(this.verb); }
    s.start(t); if(dur)try{ s.stop(t+dur+0.02); }catch(e){} return true; },
  warmSamples(){ ['web','vial','hit'].forEach(n=>this.sample(n,{g:0})); },
  play(name,arg){ if(!this.on)return; this.resume(); if(!this.ac)return; const T=(f,d,o)=>this.tone(f,d,o), N=(d,o)=>this.noise(d,o);
    switch(name){
      case 'click': N(0.03,{g:0.18,type:'highpass',f0:2500,f1:2500}); T(1800,0.04,{type:'sine',g:0.06,lp:4000}); break;
      case 'tab': N(0.05,{g:0.15,type:'lowpass',f0:1500,f1:600}); T(240,0.08,{type:'sine',g:0.12,slide:0.8,lp:800}); break;
      case 'vial': { const now=this.ac.currentTime;
        if(now-(this._vialT||0)<0.11)break;                 // 연달아 먹어도 소리는 최소 간격 유지
        if(now-(this._vialT||0)>0.7)this._vialN=0;          // 잠시 끊기면 음정 리셋
        const n=(this._vialN=((this._vialN||0)+1))%6; this._vialT=now;
        this.sample('vial',{g:0.3,rate:1+n*0.04,verb:0.18,dur:0.2}); break; }
      case 'ring': { const now=this.ac.currentTime;         // 링 통과 = 바이알 샘플을 높은 피치로
        if(now-(this._ringT||0)<0.08)break;
        if(now-(this._ringT||0)>0.9)this._ringN=0;
        const n=(this._ringN=((this._ringN||0)+1))%4; this._ringT=now;
        this.sample('vial',{g:0.42,rate:1.55+n*0.07,verb:0.4,dur:0.26}); break; }
      case 'iso': this.chord([523,659,784,1046],0.6,{type:'sine',g:0.16,stagger:0.05,verb:0.8}); N(0.4,{g:0.08,type:'highpass',f0:4000,f1:6000,verb:0.6}); break;
      case 'jump': N(0.18,{g:0.22,type:'bandpass',f0:500,f1:1800,q:1.2}); break;
      case 'slide': N(0.22,{g:0.22,type:'lowpass',f0:1200,f1:300}); break;
      case 'combo': { const n=Math.min(16,arg||1); const scale=[0,2,4,7,9,12,14,16,19,21,24,26,28,31,33,36]; const f=440*Math.pow(2,scale[n-1]/12); T(f,0.22,{type:'triangle',g:0.14,att:0.004,lp:3000,verb:0.5,detune:5,voices:2}); break; }
      case 'kill': this.sample('hit',{g:0.85,rate:0.94+Math.random()*0.12,verb:0.2}); this.thump(0.35,120,0.14); break;
      case 'hit': this.thump(1.0,90,0.4); N(0.35,{g:0.45,type:'lowpass',f0:2500,f1:150}); T(55,0.5,{type:'sine',g:0.5,slide:0.6,lp:300}); break;
      case 'boss': this.chord([55,82.4,110],1.6,{type:'sawtooth',g:0.22,att:0.15,verb:0.5,lp:900,detune:12,voices:3}); this.thump(0.9,70,0.6,0.05); N(1.2,{g:0.12,type:'bandpass',f0:300,f1:2400,q:1.5,att:0.4,delay:0.2,verb:0.5}); this.thump(0.8,60,0.7,0.9); break;
      case 'bomb': N(0.25,{g:0.25,type:'bandpass',f0:600,f1:2600,q:1}); this.thump(0.9,80,0.5,0.22); N(0.4,{g:0.3,type:'lowpass',f0:1800,f1:120,delay:0.22,verb:0.4}); break;
      case 'tap': this.sample('hit',{g:0.95,rate:0.88+Math.random()*0.2,verb:0.15}); this.thump(0.4,95+Math.random()*30,0.14); break;
      case 'clear': this.chord([392,494,587,784],1.2,{type:'triangle',g:0.15,att:0.03,stagger:0.07,verb:0.9,lp:3200}); this.chord([1175,1568],1.6,{type:'sine',g:0.08,att:0.4,verb:1,delay:0}); break;
      case 'fail': this.chord([196,233,277],0.9,{type:'sawtooth',g:0.12,att:0.02,stagger:0.12,lp:700,verb:0.5}); this.thump(0.5,70,0.5,0.3); break;
      case 'web': this.sample('web',{g:0.9,rate:0.96+Math.random()*0.1,verb:0.3}); break;
      case 'wipe': case 'whoosh': N(0.4,{g:0.28,type:'bandpass',f0:300,f1:3000,q:1.4,att:0.05}); break;
      case 'portal_open': T(40,1.8,{type:'sine',g:0.5,slide:1.8,att:0.4,lp:300}); this.chord([65.4,98,130.8],1.8,{type:'sawtooth',g:0.12,att:0.5,lp:600,detune:15,voices:3,verb:0.8}); N(1.6,{g:0.14,type:'highpass',f0:800,f1:5000,att:0.6,verb:0.8}); break;
      case 'flip': N(0.05,{g:0.3,type:'bandpass',f0:1500,f1:800,q:2}); N(0.12,{g:0.12,type:'highpass',f0:3000,f1:1000,delay:0.03}); break;
      case 'sting': { const r=arg||'C'; const ch={C:[[392,494,587]],U:[[440,554,659,880]],R:[[523,659,784],[587,740,880,1175]],E:[[466,587,698],[523,659,784,1046],[622,784,932,1245]],L:[[440,554,659],[494,622,740],[554,698,830,1108],[659,830,988,1318]],T:[[349,440,523],[392,494,587],[440,554,659],[523,659,784,1046],[659,830,988,1318,1568]]}[r];
        ch.forEach((c,i)=>this.chord(c,0.9+i*0.15,{type:i===ch.length-1?'triangle':'sine',g:0.14,att:0.02,verb:0.9,lp:3000,detune:7,voices:2,delay:i*0.22}));
        if(r==='L'||r==='T'){ this.thump(0.9,60,0.8,ch.length*0.22); N(0.8,{g:0.15,type:'highpass',f0:2000,f1:7000,att:0.3,delay:ch.length*0.22,verb:1}); } if(r==='T'){ this.chord([65.4,98],2.4,{type:'sawtooth',g:0.14,att:0.6,lp:500,detune:14,voices:3,verb:0.8,delay:0.4}); } break; }
      case 'levelup': this.chord([523,659,784],0.7,{type:'triangle',g:0.14,stagger:0.06,verb:0.8}); break;
      case 'rankup': this.chord([392,494,587,784,988],1.2,{type:'triangle',g:0.14,stagger:0.07,verb:0.9}); N(0.6,{g:0.1,type:'highpass',f0:3000,f1:8000,att:0.2,delay:0.3,verb:0.8}); break;
      case 'count': N(0.02,{g:0.08,type:'highpass',f0:3000,f1:3000}); break;
      case 'coin': T(1568,0.12,{type:'sine',g:0.1,lp:6000,verb:0.4}); T(2093,0.2,{type:'sine',g:0.1,lp:6000,delay:0.07,verb:0.5}); break;
    } }
};
try{ SFX.on=localStorage.getItem('wru_sfx')!=='0'; }catch(e){}
function renderMute(){ const b=document.getElementById('bMute'); b.classList.toggle('off',!SFX.on); b.querySelector('.w1').style.display=SFX.on?'':'none'; b.querySelector('.w2').style.display=SFX.on?'':'none'; }
document.getElementById('bMute').onclick=()=>{ SFX.on=!SFX.on; try{localStorage.setItem('wru_sfx',SFX.on?'1':'0');}catch(e){} renderMute(); if(SFX.on)SFX.play('tab'); };
renderMute();
// 전역 클릭음 + 오디오 컨텍스트 해제
document.addEventListener('pointerdown',e=>{ SFX.resume(); SFX.warmSamples(); const b=e.target.closest('button'); if(b&&!b.closest('#nav'))SFX.play('click'); },{capture:true});

// ===== HUD / 스테이지 연출 =====
const FX={
  // 애니메이션이 끝나면 클래스를 떼어낸다. 남겨두면 #stage가 display:none <-> block 될 때
  // 브라우저가 애니메이션을 다시 처음부터 재생해 다음 러닝 시작에 유령처럼 다시 뜬다.
  retrig(el,cls){ if(!el)return; const t=(el._fxT=(el._fxT||0)+1);
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    const off=()=>{ if(el._fxT===t)el.classList.remove(cls); };
    el.addEventListener('animationend',off,{once:true}); el.addEventListener('animationcancel',off,{once:true}); },
  flash(){ this.retrig(document.getElementById('fxFlash'),'on'); },
  wipe(){ this.retrig(document.getElementById('fxWipe'),'on'); SFX.play('wipe'); },
  cutin(name){ document.getElementById('fxCutName').textContent=name; this.retrig(document.getElementById('fxCut'),'on'); SFX.play('boss'); },
  banner(text,color){ const b=document.getElementById('fxBanner'); b.textContent=text; b.style.background=color||'var(--paper)'; this.retrig(b,'on'); },
  comboBump(n){ const c=document.getElementById('hCombo'); this.retrig(c,'bump'); c.style.color=n>=20?'var(--red2)':n>=10?'var(--cyan)':'var(--yellow)'; SFX.play('combo',n); },
  countUp(el,to,{dur=900,suffix='',fmt=v=>Math.round(v).toLocaleString('ko-KR')}={}){ const t0=performance.now(); let lastTick=0; const step=t=>{ const k=Math.min(1,(t-t0)/dur); const e=1-Math.pow(1-k,3); el.textContent=fmt(to*e)+suffix; if(k<1){ if(t-lastTick>60){SFX.play('count');lastTick=t;} requestAnimationFrame(step);} }; requestAnimationFrame(step); },
  sparks(container,x,y,n=14,color){ for(let i=0;i<n;i++){ const s=document.createElement('i'); s.className='spark'; const a=Math.random()*Math.PI*2, d=40+Math.random()*90; s.style.cssText=`left:${x}px;top:${y}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;${color?'background:'+color:''};animation-delay:${Math.random()*0.1}s`; container.appendChild(s); setTimeout(()=>s.remove(),1000);} },
};

// ===== 대기 화면 (리더 캐릭터 대형 스탠딩) =====
let idleRAF=0, idleT=0;
function idleLoop(t){
  if(R||SUM.active){idleRAF=0;return;}
  idleT=t/1000; const col=ISSUE_ENV_COLORS[S.issue];
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,col[0]); g.addColorStop(0.5,col[1]); g.addColorStop(1,'#05070f'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  // 하프톤 광선
  ctx.save(); ctx.translate(W*0.5,H*0.62); ctx.rotate(idleT*0.05); for(let i=0;i<18;i++){ ctx.fillStyle=i%2?col[2]+'14':'#ffffff08'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,W,i*Math.PI/9,(i+1)*Math.PI/9); ctx.closePath(); ctx.fill(); } ctx.restore();
  ctx.fillStyle='#0a0f22'; for(let i=0;i<26;i++){const bw=60+((i*37)%70),bh=60+((i*91)%160),x=(i*97)%(W+120)-60; ctx.fillRect(x,HOR-bh,bw,bh+8);}
  const gg=ctx.createLinearGradient(0,HOR,0,H); gg.addColorStop(0,'#141b3a'); gg.addColorStop(1,'#1c2447'); ctx.fillStyle=gg; const l=proj(-1.7,0,0),r=proj(1.7,0,0),lf=proj(-1.7,0,ZF),rf=proj(1.7,0,ZF); ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(lf.x,lf.y);ctx.lineTo(rf.x,rf.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.fill();
  ctx.strokeStyle=col[2]+'88'; ctx.lineWidth=4; for(const lx of[-1.7,1.7]){const a=proj(lx,0,0),b=proj(lx,0,ZF);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  // 리더: 대형 + 호흡 + 아웃라인
  const lead=CH[S.team[0]]; const bob=Math.sin(idleT*2)*4; const px=W*0.85, py=H*0.95+bob;
  ctx.save(); ctx.translate(px,py); ctx.scale(2.4,2.4); ctx.fillStyle='#00000066'; ctx.beginPath(); ctx.ellipse(0,2,40,7,0,0,7); ctx.fill(); ctx.restore();
  drawHero(px,py,2.4,lead.c[0],lead.c[1],poseFor('idle',idleT*2));
  // 이름표
  ctx.save(); ctx.font=`900 30px ${getComputedStyle(document.body).getPropertyValue('--disp')}`; const nw=ctx.measureText(lead.name).width+40; ctx.translate(W*0.85-nw/2,H*0.12); ctx.transform(1,0,-0.14,1,0,0); ctx.fillStyle='#0d0f1c'; ctx.fillRect(4,4,nw,44); ctx.fillStyle=RARITY[lead.r].color; ctx.fillRect(0,0,nw,44); ctx.strokeStyle='#0d0f1c'; ctx.lineWidth=3; ctx.strokeRect(0,0,nw,44); ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillStyle='#0d0f1c'; ctx.fillText(lead.name,20,23); ctx.restore();
  idleRAF=requestAnimationFrame(idleLoop);
}
function startIdle(){ if(!idleRAF)idleRAF=requestAnimationFrame(idleLoop); }
function drawFigureOutlined(x,y,s,c1,c2,ph,kind,state){ // 두꺼운 잉크 아웃라인 → 본체
  ctx.save(); ctx.globalCompositeOperation='source-over'; for(const [dx,dy] of [[-3,0],[3,0],[0,-3],[0,3],[-2,-2],[2,2],[-2,2],[2,-2]]){ drawFigure(x+dx*s*0.9,y+dy*s*0.9,s,'#0d0f1c','#0d0f1c',ph,kind,state);} ctx.restore(); drawFigure(x,y,s,c1,c2,ph,kind,state);
}

// ===== 포털 소환 시네마틱 =====
const SUM={active:false,list:[],i:0,t:0,phase:'open',parts:[],raf:0,done:null,auto:true,skip:false,ring:0};
function summon(got,onDone){ // got: [[char,isNew],...]
  SUM.active=true; SUM.list=got; SUM.i=0; SUM.t=0; SUM.phase='open'; SUM.parts=[]; SUM.done=onDone; SUM.skip=false; SUM.ring=0;
  cancelAnimationFrame(idleRAF); idleRAF=0;
  enterPlayMode(); document.getElementById('ovTitle').classList.add('hidden'); document.getElementById('ovSummon').classList.remove('hidden'); document.getElementById('bSumDone').classList.add('hidden'); document.getElementById('bSkip').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'}); SFX.play('portal_open');
  let last=performance.now(); const loop=t=>{ if(!SUM.active)return; const dt=Math.max(0,Math.min(0.05,(t-last)/1000)); last=t; sumUpdate(dt); sumDraw(); SUM.raf=requestAnimationFrame(loop); }; SUM.raf=requestAnimationFrame(loop);
}
function sumEnd(){ SUM.active=false; cancelAnimationFrame(SUM.raf); document.getElementById('ovSummon').classList.add('hidden'); exitPlayMode(); if(SUM.done)SUM.done(); }
document.getElementById('bSkip').onclick=()=>{ SUM.skip=true; SUM.phase='all'; SUM.t=0; document.getElementById('bSkip').classList.add('hidden'); document.getElementById('bSumDone').classList.remove('hidden'); };
document.getElementById('bSumDone').onclick=sumEnd;
const RAR_LABEL={C:'COMMON',U:'UNCOMMON',R:'RARE!',E:'EPIC!!',L:'LEGENDARY!!!',T:'TITAN!!!'};
const RAR_RANK={C:0,U:1,R:2,E:3,L:4,T:5};
function sumUpdate(dt){
  SUM.t+=dt; const ph=SUM.phase;
  // 파티클: 포털로 빨려드는 점
  if(ph==='open'||ph==='burst'){ for(let k=0;k<4;k++){ const a=Math.random()*Math.PI*2; SUM.parts.push({a,r:W*0.55,v:-(300+Math.random()*400),life:1,c:Math.random()<0.5?'#21c6de':'#ffffff'}); } }
  SUM.parts.forEach(p=>{p.r+=p.v*dt; p.life-=dt*0.7; if(p.vy!==undefined){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=900*dt;}}); SUM.parts=SUM.parts.filter(p=>p.life>0&&(p.r===undefined||p.r>10));
  if(ph==='open'&&SUM.t>1.4){SUM.phase='burst';SUM.t=0;SFX.play('whoosh');}
  else if(ph==='burst'&&SUM.t>0.55){SUM.phase='reveal';SUM.t=0;const [c]=SUM.list[SUM.i];SFX.play('flip');setTimeout(()=>SFX.play('sting',c.r),220); for(let k=0;k<(RAR_RANK[c.r]+1)*10;k++){const a=Math.random()*Math.PI*2,sp=200+Math.random()*500;SUM.parts.push({x:W/2,y:H*0.5,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-200,life:1+Math.random(),c:RARITY[c.r].color});} if(RAR_RANK[c.r]>=2)SUM.shake=0.5+RAR_RANK[c.r]*0.15;}
  else if(ph==='reveal'){ const [c]=SUM.list[SUM.i]; const hold=1.6+RAR_RANK[c.r]*0.35; if(SUM.t>hold){ SUM.i++; if(SUM.i>=SUM.list.length){SUM.phase='all';SUM.t=0;document.getElementById('bSkip').classList.add('hidden');document.getElementById('bSumDone').classList.remove('hidden');} else {SUM.phase='burst';SUM.t=0;SFX.play('whoosh');} } }
  SUM.shake=Math.max(0,(SUM.shake||0)-dt);
}
function sumDraw(){
  const t=SUM.t, ph=SUM.phase; const sh=SUM.shake||0; ctx.save(); if(sh)ctx.translate((Math.random()-0.5)*20*sh,(Math.random()-0.5)*20*sh);
  // 배경: 어두운 우주 + 하프톤 방사선
  const g=ctx.createRadialGradient(W/2,H/2,20,W/2,H/2,W*0.7); g.addColorStop(0,'#1b2050'); g.addColorStop(1,'#05060f'); ctx.fillStyle=g; ctx.fillRect(-20,-20,W+40,H+40);
  ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(performance.now()/4000); for(let i=0;i<24;i++){ctx.fillStyle=i%2?'#ffffff0a':'#21c6de10';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,W,i*Math.PI/12,(i+1)*Math.PI/12);ctx.closePath();ctx.fill();} ctx.restore();
  // 포털 링
  const open=ph==='open'?Math.max(0,Math.min(1,t/1.2)):1; const ease=1-Math.pow(1-open,3); const R0=H*0.34*ease; const cur=ph==='reveal'||ph==='all'?SUM.list[Math.min(SUM.i,SUM.list.length-1)][0]:null; const rc=cur?RARITY[cur.r].color:'#21c6de';
  ctx.save(); ctx.translate(W/2,H*0.5); if(ph==='all')ctx.globalAlpha=0.22; const spin=performance.now()/600;
  for(let k=0;k<3;k++){ ctx.save(); ctx.rotate(spin*(k%2?-1:1)*(0.6+k*0.3)); ctx.strokeStyle=k===1?rc:'#ffffff'; ctx.globalAlpha=0.9-k*0.25; ctx.lineWidth=10-k*2; ctx.setLineDash([40-k*10,22]); ctx.beginPath(); ctx.arc(0,0,R0*(1+k*0.16),0,Math.PI*2); ctx.stroke(); ctx.restore(); }
  if(ph!=='all')ctx.globalAlpha=1; const gi=ctx.createRadialGradient(0,0,0,0,0,Math.max(0.01,R0)); gi.addColorStop(0,'#ffffff'); gi.addColorStop(0.25,rc); gi.addColorStop(1,'#0d0f1c'); ctx.fillStyle=gi; ctx.beginPath(); ctx.arc(0,0,R0*0.96,0,Math.PI*2); ctx.fill();
  // 균열
  ctx.strokeStyle='#ffffffcc'; ctx.lineWidth=3; for(let i=0;i<7;i++){ const a=i*0.9+Math.sin(performance.now()/300+i); ctx.beginPath(); ctx.moveTo(Math.cos(a)*R0*0.3,Math.sin(a)*R0*0.3); ctx.lineTo(Math.cos(a+0.2)*R0*0.7,Math.sin(a+0.2)*R0*0.7); ctx.lineTo(Math.cos(a)*R0*0.95,Math.sin(a)*R0*0.95); ctx.stroke(); }
  ctx.restore();
  // 흡입 파티클
  for(const p of SUM.parts){ ctx.globalAlpha=Math.max(0,Math.min(1,p.life)); ctx.fillStyle=p.c; if(p.r!==undefined){ctx.beginPath();ctx.arc(W/2+Math.cos(p.a)*p.r,H*0.5+Math.sin(p.a)*p.r,3,0,7);ctx.fill();} else {ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.life*6);ctx.fillRect(-5,-5,10,10);ctx.strokeStyle='#0d0f1c';ctx.lineWidth=2;ctx.strokeRect(-5,-5,10,10);ctx.restore();} } ctx.globalAlpha=1;
  // 카드
  if(ph==='burst'){ const k=t/0.55; const [c]=SUM.list[SUM.i]; drawCard(W/2,H*0.5,0.2+k*0.9,Math.PI*k*3,c,false,0); }
  else if(ph==='reveal'){ const [c,isNew]=SUM.list[SUM.i]; const k=Math.min(1,t/0.35); const e=1-Math.pow(1-k,4); const sc=1.35-0.35*e; drawCard(W/2,H*0.5,sc,0,c,true,t,isNew);
    // 희귀도 슬램
    const rr=RAR_RANK[c.r]; const s2=t<0.5?1.8-1.6*(t/0.5):1; ctx.save(); ctx.translate(W/2,H*0.13); ctx.transform(1,0,-0.16,1,0,0); ctx.scale(s2,s2); ctx.font=`900 ${52+rr*8}px ${getComputedStyle(document.body).getPropertyValue('--disp')}`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.lineWidth=10; ctx.strokeStyle='#0d0f1c'; ctx.lineJoin='round'; ctx.strokeText(RAR_LABEL[c.r],0,0); const gt=ctx.createLinearGradient(0,-30,0,30); gt.addColorStop(0,'#fff'); gt.addColorStop(0.5,RARITY[c.r].color); gt.addColorStop(1,'#fff'); ctx.fillStyle=gt; ctx.fillText(RAR_LABEL[c.r],0,0); ctx.restore();
    // 카운터
    ctx.font=`700 22px ${getComputedStyle(document.body).getPropertyValue('--mono')}`; ctx.fillStyle='#fff'; ctx.textAlign='right'; ctx.fillText(`${SUM.i+1} / ${SUM.list.length}`,W-30,40);
  } else if(ph==='all'){ // 전체 나열
    const n=SUM.list.length; const cols=Math.min(n,5); const rows=Math.ceil(n/cols); const cw=Math.min(190,(W-80)/cols), chh=cw*1.3; const sc=cw/210;
    SUM.list.forEach(([c,isNew],i)=>{ const col=i%cols,row=Math.floor(i/cols); const x=W/2+(col-(cols-1)/2)*(cw+14), y=H/2+(row-(rows-1)/2)*(chh+14); const k=Math.min(1,Math.max(0,(t-i*0.06)/0.3)); if(k>0)drawCard(x,y,sc*(0.7+0.3*k),(1-k)*Math.PI/2,c,true,1,isNew); });
    ctx.font=`900 40px ${getComputedStyle(document.body).getPropertyValue('--disp')}`; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.lineWidth=8; ctx.strokeStyle='#0d0f1c'; ctx.strokeText('SUMMON RESULT',W/2,48); ctx.fillText('SUMMON RESULT',W/2,48);
  } else { ctx.font=`900 46px ${getComputedStyle(document.body).getPropertyValue('--disp')}`; ctx.textAlign='center'; ctx.lineWidth=8; ctx.strokeStyle='#0d0f1c'; ctx.fillStyle='#fff'; const tt='DIMENSIONAL PORTAL OPENING'+'.'.repeat(1+Math.floor(t*3)%3); ctx.strokeText(tt,W/2,H*0.88); ctx.fillText(tt,W/2,H*0.88); }
  ctx.restore();
}
function drawCard(x,y,sc,rotY,c,face,t,isNew){
  const w=210,h=290; const cos=Math.cos(rotY); const showFace=face&&cos>0; ctx.save(); ctx.translate(x,y); ctx.scale(sc*Math.abs(cos)||0.02,sc);
  const rc=RARITY[c.r].color; const disp=getComputedStyle(document.body).getPropertyValue('--disp');
  ctx.fillStyle='#0d0f1c'; ctx.fillRect(-w/2-8,-h/2+8,w,h); // 하드 섀도
  ctx.lineWidth=6; ctx.strokeStyle='#0d0f1c';
  if(!showFace){ const gb=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2); gb.addColorStop(0,'#1b2050'); gb.addColorStop(1,'#0d0f1c'); ctx.fillStyle=gb; ctx.fillRect(-w/2,-h/2,w,h); ctx.strokeRect(-w/2,-h/2,w,h);
    ctx.strokeStyle='#21c6de'; ctx.lineWidth=4; for(let i=1;i<4;i++){ctx.beginPath();ctx.arc(0,0,i*26,0,7);ctx.stroke();} for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(i*Math.PI/4)*100,Math.sin(i*Math.PI/4)*100);ctx.stroke();} }
  else { ctx.fillStyle='#f6f2ea'; ctx.fillRect(-w/2,-h/2,w,h);
    // 헤더 색띠 + 하프톤
    ctx.fillStyle=rc; ctx.fillRect(-w/2,-h/2,w,44); ctx.fillStyle='#0d0f1c'; ctx.fillRect(-w/2,-h/2+44,w,4);
    ctx.fillStyle='#0d0f1c22'; for(let yy=-h/2+4;yy<-h/2+44;yy+=6)for(let xx=-w/2+4;xx<w/2;xx+=6)if((xx+yy)%12===0){ctx.beginPath();ctx.arc(xx,yy,1.2,0,7);ctx.fill();}
    ctx.fillStyle='#0d0f1c'; ctx.font=`900 20px ${disp}`; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(RARITY[c.r].name.toUpperCase(),-w/2+10,-h/2+22); ctx.textAlign='right'; ctx.fillText('★'.repeat(RARITY[c.r].stars),w/2-10,-h/2+22);
    // 인물 배경 광선
    ctx.save(); ctx.beginPath(); ctx.rect(-w/2,-h/2+48,w,h-110); ctx.clip(); ctx.translate(0,40); ctx.rotate(t*0.6); for(let i=0;i<16;i++){ctx.fillStyle=i%2?rc+'55':'#ffffff00';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,400,i*Math.PI/8,(i+1)*Math.PI/8);ctx.closePath();ctx.fill();} ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-w/2,-h/2+48,w,h-110); ctx.clip(); const pop=Math.min(1,t/0.4); drawHero(0,h/2-64+(1-pop)*40,1.0,c.c[0],c.c[1],poseFor('idle',t*2)); ctx.restore();
    // 이름 밴드
    ctx.fillStyle='#0d0f1c'; ctx.fillRect(-w/2,h/2-62,w,62); ctx.fillStyle='#fff'; ctx.textAlign='center'; { let fs=16; const bf=getComputedStyle(document.body).getPropertyValue('--body'); do{ ctx.font=`700 ${fs}px ${bf}`; fs--; }while(ctx.measureText(c.name).width>w-16&&fs>9); ctx.fillText(c.name,0,h/2-38); } ctx.fillStyle='#9aa3c4'; ctx.font=`600 11px ${getComputedStyle(document.body).getPropertyValue('--body')}`; ctx.fillText(c.g,0,h/2-12);
    ctx.strokeStyle='#0d0f1c'; ctx.lineWidth=6; ctx.strokeRect(-w/2,-h/2,w,h);
    if(isNew){ ctx.save(); ctx.translate(-w/2+28,-h/2+70); ctx.rotate(-0.5); ctx.fillStyle='#e6202a'; ctx.fillRect(-50,-12,100,24); ctx.strokeStyle='#0d0f1c'; ctx.lineWidth=3; ctx.strokeRect(-50,-12,100,24); ctx.fillStyle='#fff'; ctx.font=`900 16px ${disp}`; ctx.textAlign='center'; ctx.fillText('NEW',0,1); ctx.restore(); }
    else { ctx.fillStyle='#ffd23a'; ctx.fillRect(w/2-60,-h/2+56,52,22); ctx.strokeStyle='#0d0f1c'; ctx.lineWidth=3; ctx.strokeRect(w/2-60,-h/2+56,52,22); ctx.fillStyle='#0d0f1c'; ctx.font=`700 12px ${getComputedStyle(document.body).getPropertyValue('--mono')}`; ctx.textAlign='center'; ctx.fillText('DUP +1',w/2-34,-h/2+68); }
    // 홀로 시트 (레어 이상)
    if(RAR_RANK[c.r]>=2){ const k=(t*0.8)%1.6-0.3; const gs=ctx.createLinearGradient(-w/2+k*w*1.6-60,0,-w/2+k*w*1.6+60,0); gs.addColorStop(0,'#ffffff00'); gs.addColorStop(0.5,'#ffffff77'); gs.addColorStop(1,'#ffffff00'); ctx.fillStyle=gs; ctx.fillRect(-w/2,-h/2,w,h); }
  }
  ctx.restore();
}
function wrapText(text,x,y,maxW,lh){ const words=text.split(' '); let line='',yy=y; for(const w of words){ const test=line?line+' '+w:w; if(ctx.measureText(test).width>maxW&&line){ctx.fillText(line,x,yy);line=w;yy+=lh;} else line=test; } ctx.fillText(line,x,yy); }

// ===== 초기화 =====
load(); dailyCheck(); renderAll(); renderCodex();

// ===== 보스 보이스: 합성 웃음/신음 + (선택) 음성 합성 대사 =====
const VOICE={on:true,tts:true,
  // 계열별 성대 파라미터: f0, 속도, 거칠기, 리버브, 음성합성 pitch/rate
  PROF:{goblin:{f0:230,rate:0.13,rasp:0.5,verb:0.5,sp:1.6,sr:1.25,ha:[1,0.9,1.1,0.85,1.2,0.8]},vulture:{f0:150,rate:0.19,rasp:0.9,verb:0.4,sp:0.7,sr:1.05,ha:[1,1,0.9,0.95]},electro:{f0:190,rate:0.11,rasp:0.3,verb:0.6,sp:1.2,sr:1.35,ha:[1,1.1,1.2,1.3,1.4]},sand:{f0:85,rate:0.24,rasp:1.0,verb:0.5,sp:0.4,sr:0.85,ha:[1,0.95,0.9]},ock:{f0:115,rate:0.22,rasp:0.4,verb:0.6,sp:0.5,sr:0.9,ha:[1,0.96,0.92,0.88,0.84]},mysterio:{f0:170,rate:0.17,rasp:0.2,verb:1.2,sp:0.9,sr:0.95,ha:[1,1,1,1,1,1]},inheritor:{f0:100,rate:0.2,rasp:0.7,verb:0.9,sp:0.3,sr:0.8,ha:[1,0.9,0.8]},other:{f0:140,rate:0.16,rasp:0.5,verb:0.5,sp:1,sr:1,ha:[1,1,1]}},
  LINES:{goblin:{attack:['받아라!','호박 선물이다!'],in:['하하하하! 스파이더맨, 또 만났군!','이 도시는 곧 내 것이 된다!'],hurt:['크윽!','건방진 거미 녀석!'],beat:['이럴 수가… 이럴 수는 없어!'],out:['다음엔… 반드시…!'],rec:['하하! 아직 끝나지 않았다!']},
         vulture:{attack:['급강하!','칼날을 조심해라!'],in:['하늘은 내 영역이다, 꼬마야!','날개 소리가 들리나?'],hurt:['끄아악!','내 날개!'],beat:['안 돼, 떨어진다!'],out:['내… 날개가…!'],rec:['다시 날아오른다!']},
         electro:{attack:['방전!','타 버려라!'],in:['찌릿하게 해주지!','전력 최대! 하하하!'],hurt:['크아악!','합선이다!'],beat:['에너지가… 빠져나간다!'],out:['정전이다…!'],rec:['재충전 완료!']},
         sand:{attack:['모래 폭풍!','으깨주마!'],in:['모래 속에 파묻어주마.','바람이 분다, 스파이더맨.'],hurt:['으윽!','흩어진다!'],beat:['형태가… 유지되지 않아!'],out:['모래로… 돌아간다…'],rec:['다시 뭉친다!']},
         ock:{attack:['촉수, 전개.','피할 수 없다.'],in:['과학의 힘 앞에 무릎 꿇어라.','촉수는 네 개, 너는 하나.'],hurt:['크흑!','계산 밖이다!'],beat:['불가능해… 내 계산은 완벽했는데!'],out:['실험은… 실패다…'],rec:['시스템 복구.']},
         mysterio:{attack:['환영이여, 나타나라!','속아 넘어가라!'],in:['환영의 무대에 온 것을 환영한다!','무엇이 진짜인지 알겠나?'],hurt:['커헉!','연기가 새어나간다!'],beat:['막이 내린다… 벌써?'],out:['커튼콜은… 없다…'],rec:['앙코르다!']},
         inheritor:{attack:['도망쳐 봐라.'],in:['토템의 냄새가 난다…','사냥을 시작하지.'],hurt:['흠!','재밌군.'],beat:['이 토템은… 강하다.'],out:['다른 세계에서… 다시…'],rec:['사냥은 계속된다.']},
         other:{attack:['받아라!'],in:['덤벼라, 스파이더맨!'],hurt:['윽!'],beat:['이럴 수가!'],out:['크아악!'],rec:['아직이다!']}},
  // 합성 음절: 성대(톱니+펄스) → 두 개의 포먼트 밴드패스(A 모음 700/1200Hz) → 리버브
  syllable(f0,d,{g=0.35,delay=0,glide=0.7,rasp=0.5,verb=0.5,formant=[700,1200],vib=6}={}){ const S=SFX; if(!S.on||!S.ac||!this.on)return; const ac=S.ac,t=ac.currentTime+delay;
    const src=ac.createOscillator(); src.type='sawtooth'; src.frequency.setValueAtTime(f0,t); src.frequency.exponentialRampToValueAtTime(Math.max(30,f0*glide),t+d);
    const lfo=ac.createOscillator(); lfo.frequency.value=vib; const lg=ac.createGain(); lg.gain.value=f0*0.04; lfo.connect(lg); lg.connect(src.frequency);
    const mix=ac.createGain(); src.connect(mix);
    if(rasp>0){ const n=ac.createBufferSource(); const len=Math.max(1,ac.sampleRate*d|0); const b=ac.createBuffer(1,len,ac.sampleRate); const ch=b.getChannelData(0); for(let i=0;i<len;i++)ch[i]=Math.random()*2-1; n.buffer=b; const ng=ac.createGain(); ng.gain.value=rasp*0.35; n.connect(ng); ng.connect(mix); n.start(t); }
    const out=ac.createGain(); out.gain.setValueAtTime(0.0001,t); out.gain.linearRampToValueAtTime(g,t+0.02); out.gain.setValueAtTime(g,t+d*0.5); out.gain.exponentialRampToValueAtTime(0.0001,t+d);
    formant.forEach((fq,i)=>{ const bp=ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=fq; bp.Q.value=i?6:4; const fg=ac.createGain(); fg.gain.value=i?0.7:1; mix.connect(bp); bp.connect(fg); fg.connect(out); });
    out.connect(S.master); if(S.verb&&verb){ const vg=ac.createGain(); vg.gain.value=verb; out.connect(vg); vg.connect(S.verb); }
    src.start(t); lfo.start(t); src.stop(t+d+0.05); lfo.stop(t+d+0.05); },
  laugh(fam){ const p=this.PROF[fam]||this.PROF.other; let t=0; p.ha.forEach((m,i)=>{ const d=p.rate*(0.8+Math.random()*0.4); this.syllable(p.f0*m*(1+ (i===0?0.08:0)),d,{g:0.32,delay:t,glide:0.82,rasp:p.rasp,verb:p.verb,formant:i%2?[650,1100]:[750,1250]}); t+=d+p.rate*0.55; }); },
  grunt(fam){ const p=this.PROF[fam]||this.PROF.other; this.syllable(p.f0*1.3,0.22,{g:0.4,glide:0.6,rasp:p.rasp+0.3,verb:p.verb*0.6,formant:[500,900],vib:0}); },
  scream(fam){ const p=this.PROF[fam]||this.PROF.other; this.syllable(p.f0*1.8,1.1,{g:0.45,glide:0.35,rasp:p.rasp+0.4,verb:p.verb+0.4,formant:[600,1500],vib:9}); },
  maleVoice(){ if(!('speechSynthesis' in window))return null; const vs=speechSynthesis.getVoices().filter(v=>/^ko/i.test(v.lang)); return vs.find(v=>/InJoon|Hyunsu|GookMin|BongJin|인준|현수|국민|봉진|male(?!.*female)|남성/i.test(v.name))||null; }, // 남성 한국어 음성이 있을 때만 말함
  say(fam,kind,delay=0){ const lines=(this.LINES[fam]||this.LINES.other)[kind]; if(!lines)return; const p=this.PROF[fam]||this.PROF.other; const txt=lines[Math.floor(Math.random()*lines.length)];
    setTimeout(()=>{ if(R&&R.boss){ R.bubble={txt,t:2.4,kind}; } // 말풍선은 항상 표시
      if(!this.on||!this.tts)return; const ko=this.maleVoice(); if(!ko)return; try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(txt); u.lang='ko-KR'; u.voice=ko; u.pitch=Math.max(0.1,Math.min(2,p.sp)); u.rate=p.sr; u.volume=0.9; speechSynthesis.speak(u); }catch(e){} },delay*1000); },
  boss(fam,ev){ if(!this.on)return; SFX.resume(); switch(ev){ case 'attack': { const p=this.PROF[fam]||this.PROF.other; this.syllable(p.f0*1.15,0.16,{g:0.3,glide:0.75,rasp:p.rasp,verb:p.verb*0.5,formant:[600,1100]}); this.syllable(p.f0*1.0,0.14,{g:0.28,delay:0.17,glide:0.8,rasp:p.rasp,verb:p.verb*0.5}); break; } case 'in': this.laugh(fam); this.say(fam,'in',0.9); break; case 'hurt': this.grunt(fam); if(Math.random()<0.35)this.say(fam,'hurt',0.15); break; case 'beat': this.grunt(fam); this.say(fam,'beat',0.2); break; case 'out': this.scream(fam); this.say(fam,'out',0.5); break; case 'rec': this.laugh(fam); this.say(fam,'rec',0.6); break; } },
};
try{ VOICE.on=localStorage.getItem('wru_voice')!=='0'; VOICE.tts=localStorage.getItem('wru_tts')!=='0'; }catch(e){}
if('speechSynthesis' in window){ try{ speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices(); }catch(e){} }
function renderVoiceBtn(){ const b=document.getElementById('bVoice'); if(b)b.classList.toggle('off',!VOICE.on); }
{ const b=document.getElementById('bVoice'); if(b)b.onclick=()=>{ VOICE.on=!VOICE.on; try{localStorage.setItem('wru_voice',VOICE.on?'1':'0');}catch(e){} renderVoiceBtn(); if(VOICE.on){ VOICE.laugh('goblin'); } else { try{speechSynthesis.cancel();}catch(e){} } }; renderVoiceBtn(); }

// ===== 보스 보이스 재생 (내장 클립) =====
const VPACK={cache:{},
  b64buf(durl){ const i=durl.indexOf(','); const bin=atob(durl.slice(i+1)); const arr=new Uint8Array(bin.length); for(let j=0;j<bin.length;j++)arr[j]=bin.charCodeAt(j); return arr.buffer; },
  async buffers(fam,ev){ const ck=`${fam}:${ev}`; if(this.cache[ck])return this.cache[ck];
    const list=(typeof BUILTIN_VOICES!=='undefined'&&BUILTIN_VOICES[ck])||[]; const bufs=[]; SFX.init(); if(!SFX.ac)return bufs;
    for(const durl of list){ try{ bufs.push(await new Promise((res,rej)=>SFX.ac.decodeAudioData(this.b64buf(durl),res,rej))); }catch(e){ console.warn('voice decode fail',ck,e); } }
    if(bufs.length)this.cache[ck]=bufs; return bufs; },
  // 재생 성공 시 클립 길이(초) 반환
  async play(fam,ev){ if(!SFX.on||!VOICE.on)return false; SFX.resume(); let bufs=await this.buffers(fam,ev); if(!bufs.length&&fam!=='inheritor')bufs=await this.buffers('inheritor',ev); if(!bufs.length)return false;
    const ac=SFX.ac; const buf=bufs[Math.floor(Math.random()*bufs.length)]; const s=ac.createBufferSource(); s.buffer=buf;
    const p=VOICE.PROF[fam]||VOICE.PROF.other; s.playbackRate.value=(VOICE.pitch&&VOICE.pitch[fam])||1;
    const g=ac.createGain(); g.gain.value=0.9; s.connect(g); g.connect(SFX.master);
    if(SFX.verb){ const vg=ac.createGain(); vg.gain.value=Math.min(1,p.verb*0.5); g.connect(vg); vg.connect(SFX.verb); }
    s.start(); return buf.duration/(s.playbackRate.value||1); },
};
try{ VOICE.pitch=JSON.parse(localStorage.getItem('wru_vpitch')||'{}'); }catch(e){ VOICE.pitch={}; }
// 클립이 있으면 그것을, 없으면 합성 보이스
VOICE._synthBoss=VOICE.boss;
VOICE.boss=function(fam,ev){ if(!this.on)return Promise.resolve(0); SFX.resume(); const slot=ev==='beat'?'hurt':ev==='rec'?'in':ev;
  return VPACK.play(fam,slot).then(dur=>{ if(dur){ if(R&&R.boss){ const lines=(this.LINES[fam]||this.LINES.other)[ev]; if(lines)R.bubble={txt:lines[Math.floor(Math.random()*lines.length)],t:Math.max(2.4,dur),kind:ev}; } return dur; } this._synthBoss(fam,ev); return 0; }); };

// ===== 배경음악 (크로스페이드 루프 + 보이스 더킹) =====
const MUSIC={on:true,vol:0.5,cur:null,bufs:{},nodes:{},duckT:0,started:false,
  async buffer(k){ if(this.bufs[k])return this.bufs[k]; const durl=(typeof BUILTIN_BGM!=='undefined')&&BUILTIN_BGM[k]; if(!durl)return null; SFX.init(); if(!SFX.ac)return null;
    try{ const i=durl.indexOf(','); const bin=atob(durl.slice(i+1)); const arr=new Uint8Array(bin.length); for(let j=0;j<bin.length;j++)arr[j]=bin.charCodeAt(j);
      this.bufs[k]=await new Promise((res,rej)=>SFX.ac.decodeAudioData(arr.buffer,res,rej)); return this.bufs[k]; }catch(e){ console.warn('bgm decode fail',k,e); return null; } },
  bus(){ if(!this.out){ this.out=SFX.ac.createGain(); this.out.gain.value=this.on?this.vol:0; this.out.connect(SFX.ac.destination); } return this.out; },
  async play(k,{fade=1.0}={}){ if(!SFX.on)return; SFX.resume(); if(!SFX.ac)return; if(this.cur===k&&this.nodes[k])return; const buf=await this.buffer(k); if(!buf)return;
    const ac=SFX.ac, t=ac.currentTime, prev=this.cur; this.cur=k; this.started=true;
    // 이전 트랙 페이드아웃
    if(prev&&this.nodes[prev]){ const n=this.nodes[prev]; delete this.nodes[prev]; try{ n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value,t); n.g.gain.linearRampToValueAtTime(0.0001,t+fade); n.s.stop(t+fade+0.05); }catch(e){} }
    if(this.nodes[k])return;
    const s=ac.createBufferSource(); s.buffer=buf; s.loop=true; const g=ac.createGain();
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(1,t+fade);
    s.connect(g); g.connect(this.bus()); s.start(0); this.nodes[k]={s,g}; },
  stop(fade=0.6){ const ac=SFX.ac; if(!ac)return; const t=ac.currentTime; for(const k in this.nodes){ const n=this.nodes[k]; try{ n.g.gain.cancelScheduledValues(t); n.g.gain.setValueAtTime(n.g.gain.value,t); n.g.gain.linearRampToValueAtTime(0.0001,t+fade); n.s.stop(t+fade+0.05);}catch(e){} delete this.nodes[k]; } this.cur=null; },
  // 보스 보이스가 나오는 동안 음악을 낮춤
  duck(sec=1.2,to=0.32){ if(!SFX.ac||!this.on)return; const g=this.bus().gain, t=SFX.ac.currentTime; const end=t+sec;
    if(end<=this.duckT)return; this.duckT=end;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(this.vol*to,t+0.12); g.setValueAtTime(this.vol*to,end-0.3); g.linearRampToValueAtTime(this.vol,end); },
  setOn(v){ this.on=v; try{localStorage.setItem('wru_bgm',v?'1':'0');}catch(e){}
    if(SFX.ac){ const g=this.bus().gain,t=SFX.ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(v?this.vol:0.0001,t+0.3); }
    if(v&&!this.started)this.play(R&&R.boss?'boss':'main'); },
};
try{ MUSIC.on=localStorage.getItem('wru_bgm')!=='0'; }catch(e){}
function renderBgmBtn(){ const b=document.getElementById('bBgm'); if(b)b.classList.toggle('off',!MUSIC.on); }
{ const b=document.getElementById('bBgm'); if(b)b.onclick=()=>{ MUSIC.setOn(!MUSIC.on); renderBgmBtn(); }; renderBgmBtn(); }
// 첫 사용자 제스처에 음악 시작
document.addEventListener('pointerdown',()=>{ if(MUSIC.on&&!MUSIC.started)MUSIC.play(R&&R.boss?'boss':'main',{fade:1.6}); },{capture:true,once:false});
document.addEventListener('keydown',()=>{ if(MUSIC.on&&!MUSIC.started)MUSIC.play(R&&R.boss?'boss':'main',{fade:1.6}); },{capture:true});
// 보이스 재생 시 자동 더킹
const _vpackPlay=VPACK.play.bind(VPACK);
VPACK.play=async function(fam,ev){ const d=await _vpackPlay(fam,ev); if(d)MUSIC.duck(d+0.4); return d; };

// ===== 백그라운드 전환 시 소리 정지 =====
// 탭을 가리거나 폰 화면을 끄면 requestAnimationFrame은 멈추지만 Web Audio는 계속 돈다.
// 루프 중인 BGM이 그대로 흘러나오므로 컨텍스트째 suspend 한다. (돌아오면 이어서 재생)
const AUDIOHOLD={held:false};
function audioHold(){
  if(AUDIOHOLD.held)return; AUDIOHOLD.held=true;
  // 자리를 비운 사이에 죽지 않도록 진행 중인 러닝은 일시정지
  try{ if(typeof R!=='undefined'&&R&&!R.over&&!R.dead&&!R.paused&&typeof togglePause==='function')togglePause(); }catch(e){}
  try{ if(window.speechSynthesis)speechSynthesis.cancel(); }catch(e){}
  try{ if(SFX.ac&&SFX.ac.state==='running')SFX.ac.suspend(); }catch(e){}
}
function audioRelease(){
  if(!AUDIOHOLD.held)return; AUDIOHOLD.held=false;
  try{ if(SFX.on&&SFX.ac&&SFX.ac.state==='suspended')SFX.ac.resume(); }catch(e){}
}
document.addEventListener('visibilitychange',()=>{ document.hidden?audioHold():audioRelease(); });
window.addEventListener('pagehide',audioHold);
window.addEventListener('freeze',audioHold);
window.addEventListener('resume',audioRelease);
