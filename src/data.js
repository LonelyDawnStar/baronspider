// ===== 게임 데이터 (자료 기반 재구성) =====
// 희귀도: C=Common(3★) U=Uncommon(4★) R=Rare(5★) E=Epic(6★) L=Legendary(7★) T=Titan(8★)
// mult: [score, combo, distance, vials, enemies, bosses] 이벤트 배율 (가산)
const RARITY = {
  C:{name:'커먼',stars:3,color:'#8fa3bf',cap:30},
  U:{name:'언커먼',stars:4,color:'#4fc47a',cap:40},
  R:{name:'레어',stars:5,color:'#2fd3e6',cap:50},
  E:{name:'에픽',stars:6,color:'#b26df0',cap:60},
  L:{name:'레전더리',stars:7,color:'#f2b33d',cap:70},
  T:{name:'타이탄',stars:8,color:'#ff5a5f',cap:120},
};
// src: 'gl'=Gameloft 보도자료/블로그, 'w'=Wikipedia, 'sf'=Spider-Man Wiki, 'k'=일반 지식 보충(원작 로스터)
const CHARS = [
 // --- 스타터 / 커먼 ---
 {id:'classic',name:'스파이더맨 (클래식)',r:'C',g:'피터 파커',src:'gl',m:[1,0,0,0,0,0],c:['#c9202b','#1a3fa8']},
 {id:'mangaverse',name:'망가버스 스파이더맨',r:'C',g:'차원 변종',src:'sf',m:[0,0,1,0,0,0],c:['#d1222d','#111']},
 {id:'bagman',name:'봄바스틱 백맨',r:'C',g:'피터 파커',src:'sf',m:[0,0,0,1,0,0],c:['#2b5cc9','#f2e6c8']},
 {id:'battledmg',name:'배틀 대미지 스파이더맨',r:'C',g:'피터 파커',src:'sf',m:[0,0,0,0,1,0],c:['#a51c25','#1a2f7a']},
 {id:'bulletproof',name:'불릿프루프 스파이더맨',r:'C',g:'피터 파커',src:'sf',m:[0,1,0,0,0,0],c:['#d43a3a','#222a3f']},
 {id:'bigtime',name:'빅 타임 스파이더맨',r:'C',g:'피터 파커',src:'sf',m:[0,0,0,0,0,1],c:['#1c1c24','#39ff7a']},
 {id:'ben_reilly_sm',name:'벤 라일리 스파이더맨',r:'C',g:'클론',src:'gl',m:[1,0,0,1,0,0],c:['#d6252e','#2144b5']},
 {id:'ultimate',name:'얼티밋 스파이더맨',r:'C',g:'차원 변종',src:'k',m:[0,0,1,1,0,0],c:['#c92434','#233f9e']},
 {id:'secretwar',name:'시크릿 워 스파이더맨',r:'C',g:'피터 파커',src:'sf',m:[0,1,1,0,0,0],c:['#0f1a3a','#d33'] },
 {id:'webman',name:'웹맨',r:'C',g:'차원 변종',src:'k',m:[0,0,0,0,1,1],c:['#2a4ab8','#d0212b']},
 // --- 언커먼 ---
 {id:'armor_mk3',name:'스파이더 아머 MK III',r:'U',g:'아머',src:'sf',m:[0,0,0,0,2,0],c:['#b52028','#b9c4d6']},
 {id:'ff',name:'퓨처 파운데이션 스파이더맨',r:'U',g:'피터 파커',src:'gl',m:[2,0,0,0,0,0],c:['#f4f6fb','#111']},
 {id:'noir',name:'스파이더맨 느와르',r:'U',g:'차원 변종',src:'gl',m:[0,2,0,0,0,0],c:['#111','#6b6b6b']},
 {id:'scarlet_ben',name:'스칼렛 스파이더 (벤 라일리)',r:'U',g:'클론',src:'sf',m:[0,0,2,0,0,0],c:['#d1212b','#2a6cd6']},
 {id:'kaine',name:'스칼렛 스파이더 (케인)',r:'U',g:'클론',src:'sf',m:[0,0,0,0,2,0],c:['#a4131c','#111']},
 {id:'mayday',name:'스파이더걸 (메이데이 파커)',r:'U',g:'스파이더우먼',src:'w',m:[0,0,0,2,0,0],c:['#1c3fa5','#d0212b']},
 {id:'anya',name:'아냐 코라존',r:'U',g:'스파이더우먼',src:'sf',m:[0,2,0,0,0,0],c:['#111','#f2f2f2']},
 {id:'spider1602',name:'스파이더맨 1602',r:'U',g:'차원 변종',src:'sf',m:[0,0,2,0,0,0],c:['#7a1f1f','#c9a24a']},
 {id:'india',name:'스파이더맨 인디아',r:'U',g:'차원 변종',src:'k',m:[2,0,0,0,0,0],c:['#d12b2b','#f2c14e']},
 {id:'symbiote',name:'심비오트 스파이더맨',r:'U',g:'피터 파커',src:'k',m:[0,0,0,0,0,2],c:['#111','#e6e6e6']},
 {id:'armor_mk1',name:'스파이더 아머 MK I',r:'U',g:'아머',src:'k',m:[0,0,0,0,2,0],c:['#b9c4d6','#3a4a66']},
 {id:'ends',name:'엔즈 오브 디 어스 스파이더맨',r:'U',g:'아머',src:'k',m:[0,0,2,0,0,0],c:['#c72029','#d9d9d9']},
 {id:'spiderham',name:'스파이더햄',r:'U',g:'차원 변종',src:'gl',m:[0,0,0,2,0,0],c:['#f3a7b8','#c9202b']},
 {id:'steel',name:'스틸 스파이더',r:'U',g:'기타',src:'sf',m:[0,0,0,0,2,0],c:['#7f8fa6','#2b2b2b']},
 {id:'blood',name:'블러드 스파이더',r:'U',g:'기타',src:'sf',m:[0,0,0,0,0,2],c:['#8a0c14','#111']},
 // --- 레어 ---
 {id:'iron',name:'아이언 스파이더',r:'R',g:'아머',src:'gl',m:[0,0,0,0,3,0],c:['#c9202b','#f2b33d']},
 {id:'sm2099',name:'스파이더맨 2099',r:'R',g:'차원 변종',src:'w',m:[0,0,3,0,0,0],c:['#1a2b6d','#d0212b']},
 {id:'superior',name:'슈피리어 스파이더맨',r:'R',g:'피터 파커',src:'gl',m:[0,0,0,0,0,3],c:['#c9202b','#111']},
 {id:'miles',name:'마일스 모랄레스',r:'R',g:'차원 변종',src:'sf',m:[3,0,0,0,0,0],c:['#111','#d0212b']},
 {id:'jessica',name:'스파이더우먼 (제시카 드루)',r:'R',g:'스파이더우먼',src:'sf',m:[0,3,0,0,0,0],c:['#c9202b','#f2d33d']},
 {id:'julia',name:'스파이더우먼 (줄리아 카펜터)',r:'R',g:'스파이더우먼',src:'k',m:[0,0,0,3,0,0],c:['#111','#f4f6fb']},
 {id:'punk',name:'스파이더펑크',r:'R',g:'차원 변종',src:'w',m:[0,3,0,0,0,0],c:['#1a1a1a','#2fd3e6']},
 {id:'sm2211',name:'스파이더맨 2211',r:'R',g:'차원 변종',src:'sf',m:[0,0,3,0,0,0],c:['#2b3d8f','#c9d1e3']},
 {id:'cosmic',name:'코스믹 스파이더맨',r:'R',g:'피터 파커',src:'k',m:[3,0,0,0,0,0],c:['#f2b33d','#2b2b6d']},
 {id:'hobgoblin_pp',name:'홉고블린 (피터 파커)',r:'R',g:'기타',src:'sf',m:[0,0,0,0,3,0],c:['#e07b1f','#2a3a8a']},
 {id:'spiderben',name:'스파이더벤',r:'R',g:'클론',src:'sf',m:[0,0,0,3,0,0],c:['#3b4bb5','#d0212b']},
 {id:'tarantula',name:'타란툴라',r:'R',g:'몬스터 스파이더',src:'sf',m:[0,0,0,0,3,0],c:['#5a2f1a','#c9202b']},
 {id:'spiderx',name:'스파이더-X',r:'R',g:'몬스터 스파이더',src:'w',m:[0,0,0,0,0,3],c:['#111','#8a0c14']},
 {id:'spideruk',name:'스파이더-UK',r:'R',g:'차원 변종',src:'k',m:[0,0,3,0,0,0],c:['#1a3fa8','#d0212b']},
 {id:'lady',name:'레이디 스파이더',r:'R',g:'스파이더우먼',src:'k',m:[0,3,0,0,0,0],c:['#6b3f1f','#c9a24a']},
 {id:'spiderwolf',name:'스파이더울프',r:'R',g:'몬스터 스파이더',src:'k',m:[0,0,0,0,3,0],c:['#4a4a4a','#c9202b']},
 {id:'sixarm',name:'식스암 스파이더맨',r:'R',g:'몬스터 스파이더',src:'k',m:[0,0,0,3,0,0],c:['#c9202b','#1a3fa8']},
 // --- 에픽 ---
 {id:'gwen',name:'스파이더그웬',r:'E',g:'스파이더우먼',src:'w',m:[0,0,0,0,0,4],c:['#f4f6fb','#e93a86']},
 {id:'silk',name:'실크',r:'E',g:'스파이더우먼',src:'w',m:[0,4,0,0,0,0],c:['#f4f6fb','#111']},
 {id:'sup_venom',name:'슈피리어 베놈',r:'E',g:'심비오트',src:'sf',m:[0,0,0,0,4,0],c:['#111','#c9202b']},
 {id:'assassin',name:'어쌔신 스파이더맨',r:'E',g:'차원 변종',src:'k',m:[0,0,0,0,4,0],c:['#222','#8a0c14']},
 {id:'laststand',name:'라스트 스탠드 스파이더맨',r:'E',g:'차원 변종',src:'k',m:[4,0,0,0,0,0],c:['#7a1f1f','#2a2a2a']},
 {id:'aracnido',name:'아라크니도 Jr.',r:'E',g:'차원 변종',src:'w',m:[0,0,4,0,0,0],c:['#d6252e','#f2b33d']},
 {id:'annie',name:'애니 파커 (스파이더링)',r:'E',g:'스파이더우먼',src:'w',m:[0,0,0,4,0,0],c:['#f4f6fb','#d0212b']},
 {id:'spidercarnage',name:'스파이더카니지',r:'E',g:'심비오트',src:'k',m:[0,0,0,0,4,0],c:['#c9202b','#111']},
 {id:'agentvenom',name:'에이전트 베놈',r:'E',g:'심비오트',src:'k',m:[0,0,0,0,0,4],c:['#111','#f4f6fb']},
 {id:'spidermonkey',name:'스파이더몽키',r:'E',g:'차원 변종',src:'k',m:[0,4,0,0,0,0],c:['#6b3f1f','#c9202b']},
 {id:'armor_mk4',name:'스파이더 아머 MK IV',r:'E',g:'아머',src:'k',m:[0,0,4,0,0,0],c:['#d0212b','#f4f6fb']},
 {id:'antivenom',name:'안티베놈',r:'E',g:'심비오트',src:'k',m:[0,0,0,4,0,0],c:['#f4f6fb','#111']},
 // --- 레전더리 ---
 {id:'nickfury',name:'닉 퓨리',r:'L',g:'S.H.I.E.L.D.',src:'gl',m:[0,0,0,0,5,5],c:['#1f2a3d','#c9d1e3']},
 {id:'blackcat',name:'블랙 캣',r:'L',g:'연합',src:'gl',m:[0,5,0,5,0,0],c:['#111','#f4f6fb']},
 {id:'mj',name:'메리 제인 (스피너렛)',r:'L',g:'연합',src:'gl',m:[5,0,5,0,0,0],c:['#c9202b','#f4f6fb']},
 {id:'ironspider_mcu',name:'아이언 스파이더 (인피니티 워)',r:'L',g:'아머',src:'w',m:[0,0,0,0,5,5],c:['#c9202b','#f2b33d']},
 {id:'venom',name:'베놈',r:'L',g:'심비오트',src:'w',m:[5,0,0,0,5,0],c:['#111','#f4f6fb']},
 {id:'spiderzombie',name:'스파이더 좀비',r:'L',g:'몬스터 스파이더',src:'k',m:[0,0,5,0,0,5],c:['#4a6b3a','#8a0c14']},
 {id:'manspider',name:'맨스파이더',r:'L',g:'몬스터 스파이더',src:'k',m:[0,5,0,0,5,0],c:['#3a2a1a','#c9202b']},
 {id:'spiderhulk',name:'스파이더헐크',r:'L',g:'몬스터 스파이더',src:'k',m:[5,0,0,0,0,5],c:['#3fa34d','#c9202b']},
 // --- 타이탄 ---
 {id:'titan_cosmic',name:'캡틴 유니버스 스파이더맨',r:'T',g:'타이탄',src:'k',m:[6,6,0,0,0,0],c:['#f2b33d','#1a1a4a']},
 {id:'titan_spiderverse',name:'스파이더버스 스파이더맨 (타이탄)',r:'T',g:'타이탄',src:'k',m:[0,0,6,6,0,0],c:['#2fd3e6','#c9202b']},
 {id:'titan_superior',name:'슈피리어 옥토퍼스 (타이탄)',r:'T',g:'타이탄',src:'k',m:[0,0,0,0,6,6],c:['#3a8a3a','#111']},
];

// 이슈별 보스 (자료: 이슈당 보스 5회 · 미션 25개, 보스 가족 변종)
const ISSUES = [
 {n:1,title:'고블린 나이트',env:'맨해튼 옥상',need:1,bosses:['골드 고블린','메너스','그레이 고블린','그린 고블린','하우스 오브 M 고블린'],gimmick:'녹색 가스 장애물을 설치한다',
  intro:'닉 퓨리가 접선한다. 골드 고블린이 차원 포털을 열어 다중우주의 시니스터 식스를 불러들이고 ISO-8을 노린다. S.H.I.E.L.D.는 같은 포털로 다른 차원의 스파이더들을 소환하기로 한다.'},
 {n:2,title:'하늘의 약탈자',env:'하이라인·오스코프 타워',need:10,bosses:['벌처','클래식 벌처','얼티밋 벌처','레드 벌처','다크 벌처'],gimmick:'칼날 날개 장애물 — 부딪히면 빙글 돌며 튕겨난다(즉사 아님)',
  intro:'벌처의 차원 변종들이 뉴욕 상공을 장악한다. 스윙과 자유낙하로 추격하라.'},
 {n:3,title:'과부하',env:'전력망·지하철',env2:'전력망',need:20,bosses:['일렉트로','클래식 일렉트로','퓨어 에너지 일렉트로','얼티밋 일렉트로','모던 일렉트로'],gimmick:'푸른 번개 장애물을 설치한다',
  intro:'일렉트로 변종들이 도시 전력을 흡수한다. 무장병의 사격을 피하며 SHIELD 폭탄을 던져라.'},
 {n:4,title:'모래폭풍',env:'공사장·해변',need:30,bosses:['샌드맨','클래식 샌드맨','퓨어 샌드맨','얼티밋 샌드맨','샌드맨 느와르','다크 샌드맨'],gimmick:'모래기둥에 둘러싸여 있고, 불투명한 모래 장애물이 시야를 가린다',
  intro:'샌드맨 변종들이 도시를 모래로 삼킨다. 벽타기 구간에 주의.'},
 {n:5,title:'여덟 개의 팔',env:'옥토퍼스 거대 기계',need:40,bosses:['챕터 1 닥터 옥토퍼스','클래식 닥터 옥토퍼스','닥터 옥토퍼스 느와르','얼티밋 닥터 옥토퍼스','닥터 옥토퍼스'],gimmick:'문어다리 장애물 — 부딪히면 빙글 돌며 튕겨난다(즉사 아님)',
  intro:'닥터 옥토퍼스의 거대 기계 위를 달린다. 장갑병은 슬라이드로만 쓰러뜨릴 수 있다.'},
 {n:6,title:'환영의 마스터',env:'시니스터 식스 우주선',need:50,bosses:['클래식 미스테리오','다크 미스테리오','미스테리온','슈페리어 미스테리온','미스테리오'],gimmick:'장갑·눈 장식 장애물. 자기 공간에서 거대화하며, 폭탄 대신 미니언을 때려야 데미지가 들어간다',
  intro:'시니스터 식스의 우주선. 미스테리오의 환영이 차선을 뒤흔든다. 최종 결전.'},
];
const EVENT_BOSSES = ['잭 오랜턴','하이드로맨','데모고블린','실버 세이블','칸','몰런','데이모스','제닉스','솔루스','타노스'];
const ISSUE_ENV_COLORS = [
 ['#0b1226','#1c2a55','#d8262c'],['#0a1a2e','#1f4a6e','#2fd3e6'],['#0f0f24','#3a2a7a','#ffd23d'],
 ['#241a0f','#6e4a1f','#f2b33d'],['#141414','#3a3a4a','#4fc47a'],['#1a0f24','#4a1f6e','#b26df0']];
const MISSION_TYPES = [
 {t:'dist',label:m=>`${m}m 달리기`},
 {t:'vials',label:m=>`바이알 ${m}개 수집`},
 {t:'enemies',label:m=>`적 ${m}명 처치`},
 {t:'combo',label:m=>`콤보 ${m} 달성`},
 {t:'boss',label:m=>`보스 격파`},
];
const TIERS = [[1,'루키'],[10,'인터미디어트'],[20,'익스피리언스드'],[30,'히로익'],[40,'챔피언'],[50,'레전더리'],[60,'웹 워리어']];
const EVENT_CATS = [['score','점수'],['combo','최대 콤보'],['dist','거리'],['vials','바이알'],['enemies','적 처치'],['bosses','보스 격파']];

// ===== 등급 고유 특성 (리더 카드 등급 기준) =====
const RANK_TRAITS={
 C:{label:'루키 감각',desc:'바이알 획득 +10%',mods:{vialMul:1.10}},
 U:{label:'웹 슈터 개량',desc:'바이알 +25% · 콤보 유지 +1초',mods:{vialMul:1.25,comboHold:1}},
 R:{label:'스파이더 센스',desc:'바이알 +25% · 점수 +10% · 실드 1회(피격 1회 무시)',mods:{vialMul:1.25,scoreMul:1.10,shields:1}},
 E:{label:'다중우주 공명',desc:'바이알 +40% · 점수 +15% · 실드 1회 · 무료 부활 1회 · 콤보 유지 +2초',mods:{vialMul:1.40,scoreMul:1.15,shields:1,revives:1,comboHold:2}},
 L:{label:'토템의 가호',desc:'바이알 +50% · 점수 +20% · 실드 1회 · 무료 부활 2회 · 바이알 자석',mods:{vialMul:1.50,scoreMul:1.20,shields:1,revives:2,magnet:1}},
 T:{label:'타이탄의 심장',desc:'바이알 +75% · 점수 +30% · 실드 2회 · 무료 부활 3회 · 바이알 자석 · 폭탄 데미지 2',mods:{vialMul:1.75,scoreMul:1.30,shields:2,revives:3,magnet:1,bombDmg:2}},
};
// ===== 캐릭터 고유 능력 (리더일 때 발동) =====
const ABILITIES={
 magnet:{name:'웹 자석',desc:'옆 차선의 바이알도 끌어당긴다',mods:{magnet:1}},
 shield:{name:'아머 플레이트',desc:'추가 실드 +1',mods:{shields:1}},
 revive:{name:'불굴',desc:'무료 부활 +1',mods:{revives:1}},
 zip:{name:'롱 웹라인',desc:'웹 킥 사거리 +60%',mods:{zipRange:1.6}},
 sense:{name:'예지 감각',desc:'보스 예고 시간 +40% · 니어미스 판정 확대',mods:{telMul:1.4,sense:1}},
 combo:{name:'쇼맨십',desc:'콤보가 3부터 시작하고 유지 +1.5초',mods:{comboStart:3,comboHold:1.5}},
 bomb:{name:'강화 투척',desc:'SHIELD 폭탄 데미지 +1',mods:{bombDmg:1}},
 xp:{name:'멘토',desc:'팀 경험치 +40%',mods:{xpMul:1.4}},
 lucky:{name:'행운의 거미',desc:'ISO-8 드롭 확률 3배',mods:{isoLuck:3}},
 sturdy:{name:'강철 몸',desc:'칼날·촉수 튕김을 무시한다',mods:{sturdy:1}},
 killer:{name:'포식자',desc:'적 처치 점수 2배 · 처치 시 콤보 +2',mods:{killMul:2,killCombo:2}},
 speed:{name:'가속 본능',desc:'시작 속도 +20% · 거리 점수 +25%',mods:{speedMul:1.2,distMul:1.25}},
 slow:{name:'시간 감각',desc:'보스 연타 제한시간 +3초 · 도주 타이머 +10초',mods:{tapTime:3,escTime:10}},
 heal:{name:'재생 실드',desc:'25초마다 실드 1 재생',mods:{shieldRegen:25}},
 stealth:{name:'그림자 걸음',desc:'무장병이 투사체를 쏘지 않는다',mods:{noProj:1}},
 venom:{name:'심비오트 촉수',desc:'슬라이드로 비행 적도 처치',mods:{slideFly:1}},
 iron:{name:'리펄서',desc:'폭탄을 줍는 즉시 2개로 분열(데미지 +1) · 실드 +1',mods:{bombDmg:1,shields:1}},
 cosmic:{name:'유니 파워',desc:'실드 2 · 점수 +25% · 자석',mods:{shields:2,scoreMul:1.25,magnet:1}},
 // --- 타이탄 전용 고유 능력 (다른 카드와 완전히 다른 메커니즘) ---
 uni:{name:'★ 에니그마 포스',titan:true,desc:'콤보로 코스믹 게이지를 채우면(25) 6초간 유니 파워 폭주: 무적 · 닿는 장애물과 적을 전부 분쇄(처치 인정) · 전 차선 바이알 흡수 · 속도 +30%',mods:{scoreMul:1.25,titan:'uni'}},
 clones:{name:'★ 다중우주 분신',titan:true,desc:'다른 두 차선에 분신이 함께 달린다. 분신은 내 동작을 따라 해 적을 처치하고 바이알을 줍는다. 분신이 장애물에 부딪히면 15초 뒤 재소환',mods:{titan:'clones'}},
 tentacle:{name:'★ 기계 촉수',titan:true,desc:'4개의 촉수가 2.5초마다 전방 적을 자동으로 붙잡아 처치하고, 옆 차선의 SHIELD 폭탄을 끌어온다. 보스 연타는 1탭당 2회',mods:{titan:'tentacle',shields:1}},
};
// 계열 기본 능력 + 개별 지정
const GROUP_AB={'피터 파커':'combo','차원 변종':'zip','클론':'killer','스파이더우먼':'sense','아머':'shield','몬스터 스파이더':'sturdy','심비오트':'venom','기타':'lucky','S.H.I.E.L.D.':'bomb','연합':'xp','타이탄':'cosmic'};
const CHAR_AB={classic:'combo',mangaverse:'speed',bagman:'lucky',battledmg:'revive',bulletproof:'shield',bigtime:'stealth',ultimate:'zip',secretwar:'bomb',webman:'magnet',
 armor_mk3:'shield',ff:'heal',noir:'stealth',scarlet_ben:'zip',kaine:'killer',mayday:'sense',anya:'combo',spider1602:'slow',india:'magnet',symbiote:'venom',armor_mk1:'shield',ends:'bomb',spiderham:'lucky',steel:'sturdy',blood:'killer',
 iron:'iron',sm2099:'speed',superior:'bomb',miles:'zip',jessica:'sense',julia:'heal',punk:'combo',sm2211:'slow',cosmic:'cosmic',hobgoblin_pp:'bomb',spiderben:'revive',tarantula:'sturdy',spiderx:'killer',spideruk:'magnet',lady:'sense',spiderwolf:'killer',sixarm:'zip',
 gwen:'sense',silk:'zip',sup_venom:'venom',assassin:'stealth',laststand:'revive',aracnido:'speed',annie:'lucky',spidercarnage:'killer',agentvenom:'bomb',spidermonkey:'combo',armor_mk4:'iron',antivenom:'heal',
 nickfury:'bomb',blackcat:'lucky',mj:'xp',ironspider_mcu:'iron',venom:'venom',spiderzombie:'sturdy',manspider:'killer',spiderhulk:'sturdy',
 titan_cosmic:'uni',titan_spiderverse:'clones',titan_superior:'tentacle'};
const abilityOf=c=>ABILITIES[CHAR_AB[c.id]||GROUP_AB[c.g]||'combo'];
