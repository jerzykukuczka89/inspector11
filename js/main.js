/* ============================================================
   조원 데이터 — data/members.json(명단) + data/members/<이름>.json(내용)에서 로드.
   팀원 각자 editor.html에서 본인 JSON을 수정해 담당자에게 전달하는 방식.
   ============================================================ */
let TEAM = [];
let KR_MAP = null;    // data/korea.json  — 한반도 시도 백지도 (path)
let OFFICES = {};     // data/offices.json — 지청별 province/pin/관할
let MUNIS = null;     // data/munis.json  — 시군구 경계(관할 팝업 벡터 지도, build_munis.py 생성)

function mdAccent(s){
  // **강조어** → <span class="accent">강조어</span> (편집자가 HTML 대신 마크다운 표기 사용)
  return s ? s.replace(/\*\*(.+?)\*\*/g,'<span class="accent">$1</span>') : s;
}

function embeddedFallback(){
  const el = document.getElementById("embedded-data");
  const all = JSON.parse(el.textContent);
  return all; // {order, members, korea, offices}
}

async function loadTeam(){
  let names, krmap, offices, membersMap;
  // file:// 로 더블클릭 실행하면 fetch()가 로컬 파일을 CORS로 막으므로 곧장 내장 데이터 사용
  let munis;
  if(location.protocol === "file:"){
    const all = embeddedFallback();
    names = all.order; krmap = all.korea; offices = all.offices; membersMap = all.members; munis = all.munis;
  } else {
    try{
      [names, krmap, offices, munis] = await Promise.all([
        fetch("data/members.json").then(r=>r.json()),
        fetch("data/korea.json").then(r=>r.json()),
        fetch("data/offices.json").then(r=>r.json()),
        fetch("data/munis.json").then(r=>r.json())
      ]);
      membersMap = {};
      await Promise.all(names.map(async n=>{
        membersMap[n] = await fetch("data/members/"+encodeURIComponent(n)+".json").then(r=>r.json());
      }));
    }catch(e){
      const all = embeddedFallback();
      names = all.order; krmap = all.korea; offices = all.offices; membersMap = all.members; munis = all.munis;
    }
  }
  KR_MAP = krmap; OFFICES = offices; MUNIS = munis || null;
  TEAM = names.map(n=>{
    const m = Object.assign({}, membersMap[n]);
    m.n = n;
    m.quote = mdAccent(m.quote);
    m.motto = mdAccent(m.motto);
    m.photo = "pic/cut/"+n+".png";
    m.mapinfo = OFFICES[m.office] || null;   // 소속 지청 지도 정보
    return m;
  });
}

/* ===== 한반도 지도(백지도, 제주·울릉도는 잘라내고 본토만 확대) + 소속 지청 핀 ===== */
/* 크롭 viewBox: korea.json 원본 좌표계(0~524 × 0~631) 안에서 본토만 담은 창.
   (제주는 provinces에서 제외, 울릉도는 이 창 밖에 있어 자동으로 잘려나감) */
const KR_CROP_VIEWBOX = "-12 -14 422 554";

function koreaMapHTML(m){
  if(!KR_MAP) return "";
  const info=m.mapinfo;
  const [vx,vy,vw,vh]=KR_CROP_VIEWBOX.split(/\s+/).map(Number);
  const paths=KR_MAP.provinces.filter(p=>p.id!=="jeju").map(p=>{
    const on = info && p.id===info.province;
    return `<path d="${p.path}" class="kp${on?' on':''}"/>`;
  }).join("");
  // 소속 도(道)가 다른 관할 구역(예: 의정부지청의 강원 철원군)을 함께 하이라이트
  const extraPath = (info && info.extra) ? `<path d="${info.extra.path}" class="kp on kp-extra"/>` : "";
  let pin="", label="", leader="";
  if(info && info.pin){
    const [px,py]=info.pin;
    pin=`<span class="kr-pin" style="left:${((px-vx)/vw*100).toFixed(2)}%;top:${((py-vy)/vh*100).toFixed(2)}%"></span>`;
    // 지청명은 지도 아래가 아니라, 핀에서 이어지는 지시선 끝(지도 여백)에 배치
    leader=`<svg class="kr-leader" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="0" x2="0" y2="0"/></svg>`;
    label=`<div class="kr-label">${m.office||""}</div>`;
  }
  const side=(info && info.labelSide) || "left";
  const labelYAttr=(info && info.labelY!=null) ? ` data-y="${info.labelY}"` : "";
  return `<div class="kr-slot" data-side="${side}"${labelYAttr}>
    <div class="kr-map">
      <div class="kr-inner">
        <svg viewBox="${KR_CROP_VIEWBOX}" preserveAspectRatio="xMidYMid meet"><defs>
          <linearGradient id="kgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#488BF8"/><stop offset="1" stop-color="#1E6FE0"/>
          </linearGradient></defs>${paths}${extraPath}</svg>
        ${pin}
      </div>
      ${leader}${label}
      ${koreaPopupHTML(m)}
    </div>
  </div>`;
}

/* 마우스오버 시 뜨는 관할지역 팝업(화면 중앙 크게).
   data/munis.json의 실제 시군구 경계로 벡터 지도를 그리고, 관할 행정구역 전체가
   살짝 떠오른(입체) 뒤 파란색으로 3회 천천히 점멸. 데이터 없는 지청은 문구로 대체 */
function koreaPopupHTML(m){
  const info=m.mapinfo;
  if(!info) return "";
  const jm = MUNIS && MUNIS.offices && MUNIS.offices[m.office];
  if(jm){
    const [vx,vy,vw,vh]=jm.viewBox.split(" ").map(Number);
    const u=vw/588;                    // 화면 1px에 해당하는 viewBox 단위
    const J=new Set(jm.juris);
    const ctx=[], on=[];
    MUNIS.shapes.forEach(s=>{
      const b=s.bb;                    // viewBox 창에 걸치는 시군구만 포함
      if(b[0]>=vx+vw||b[0]+b[2]<=vx||b[1]>=vy+vh||b[1]+b[3]<=vy) return;
      (J.has(s.c)?on:ctx).push(`<path d="${s.d}"/>`);
    });
    const onPaths=on.join("");
    const lbCtx=[], lbOn=[];
    const fs=(u*12.5).toFixed(2), fso=(u*13.5).toFixed(2);
    jm.labels.forEach(l=>{
      if(l.on) lbOn.push(`<text x="${l.x}" y="${l.y}" font-size="${fso}" stroke-width="${(u*3).toFixed(2)}">${l.t}</text>`);
      else lbCtx.push(`<text x="${l.x}" y="${l.y}" font-size="${fs}" stroke-width="${(u*2.6).toFixed(2)}">${l.t}</text>`);
    });
    const vars=`--jm-rise:${(u*9).toFixed(3)}px;--jm-s1:${(u*10).toFixed(3)}px;--jm-s2:${(u*8).toFixed(3)}px`;
    return `<div class="kr-popup">
      <div class="kr-popup-title">${m.office} · 관할지역</div>
      <div class="kr-popup-inner"><svg class="kr-jmap" viewBox="${jm.viewBox}" style="${vars}" role="img" aria-label="${m.office} 관할지역 지도">
        <g class="jm-ctx">${ctx.join("")}</g>
        <g class="jm-ctxlb">${lbCtx.join("")}</g>
        <g class="jm-rise">
          <g class="jm-side" transform="translate(0 ${(u*6).toFixed(2)})">${onPaths}</g>
          <g class="jm-top">${onPaths}</g>
          <g class="jm-onlb">${lbOn.join("")}</g>
        </g>
      </svg></div>
      <div class="kr-popup-cap">관할 · <b>${info.jurisdiction||""}</b></div>
    </div>`;
  }
  return `<div class="kr-popup kr-popup-text">
    <div class="kr-popup-title">${m.office} · 관할지역</div>
    <div class="kr-popup-cap">관할 · <b>${info.jurisdiction||"관할지역 정보 준비중"}</b></div>
    <div class="kr-popup-note">관할지역 지도 준비 중</div>
  </div>`;
}

/* 핀 → 지청명 라벨 지시선 배치(레이아웃 후 실측). 라벨은 지도 여백(좌/우/좌하단/우하단)에 둠 */
function clampN(v,a,b){ return Math.max(a,Math.min(b,v)); }
function layoutLeader(slot){
  const map=slot.querySelector(".kr-map"),
        pin=slot.querySelector(".kr-pin"),
        leader=slot.querySelector(".kr-leader"),
        label=slot.querySelector(".kr-label");
  if(!map||!pin||!leader||!label) return;
  const mr=map.getBoundingClientRect();
  if(mr.width<4||mr.height<4) return;
  const pr=pin.getBoundingClientRect();
  const pinX=(pr.left+pr.width/2-mr.left)/mr.width*100;
  const pinY=(pr.top+pr.height/2-mr.top)/mr.height*100;
  const side=slot.dataset.side||"left";
  const horiz=(side==="left"||side==="bottomLeft") ? "left" : "right";
  const customY=slot.dataset.y!=null && slot.dataset.y!=="" ? parseFloat(slot.dataset.y) : null;
  label.style.left=label.style.right=label.style.top=label.style.bottom=label.style.transform="";
  if(customY!=null){
    // 라벨 높이를 지정된 위치(예: 특정 도(道) 높이)로 고정 — 지도 여백 좌/우에 부착
    label.style[horiz]="0"; label.style.top=clampN(customY,8,92)+"%"; label.style.transform="translateY(-50%)";
  } else if(side==="left"||side==="right"){
    label.style[horiz]="0"; label.style.top=clampN(pinY,15,85)+"%"; label.style.transform="translateY(-50%)";
  } else {
    label.style[horiz]="0"; label.style.bottom="0";
  }
  const lr=label.getBoundingClientRect();
  let ax,ay;
  if(customY!=null || side==="left" || side==="right"){
    ax = horiz==="left" ? lr.right : lr.left; ay=lr.top+lr.height/2;
  } else { ax=lr.left+lr.width/2; ay=lr.top; }   // 하단 라벨: 위쪽 가운데로 선 연결
  const line=leader.querySelector("line");
  line.setAttribute("x1",pinX.toFixed(2)); line.setAttribute("y1",pinY.toFixed(2));
  line.setAttribute("x2",((ax-mr.left)/mr.width*100).toFixed(2));
  line.setAttribute("y2",((ay-mr.top)/mr.height*100).toFixed(2));
}
function layoutLeaders(){ document.querySelectorAll(".kr-slot").forEach(layoutLeader); }

/* 2026년 7월 캘린더 (1일=수, 오늘=6일) */
function calHTML(){
  const sun=[5,12,19,26], sat=[4,11,18,25], today=6;
  const weeks=[[null,null,null,1,2,3,4],[5,6,7,8,9,10,11],[12,13,14,15,16,17,18],
    [19,20,21,22,23,24,25],[26,27,28,29,30,31,null]];
  let rows="";
  for(const w of weeks){
    rows+="<tr>";
    for(let i=0;i<7;i++){
      const d=w[i];
      if(d==null){rows+="<td></td>";continue;}
      let cls=[]; if(i===0||sun.includes(d))cls.push("sun"); if(i===6||sat.includes(d))cls.push("sat");
      if(d===today)cls.push("today");
      rows+=`<td class="${cls.join(' ')}">${d}</td>`;
    }
    rows+="</tr>";
  }
  return `<div class="cal">
    <div class="cal-head"><b>2026년 7월</b><span class="yr">월간 · 주간</span></div>
    <table><thead><tr><th style="color:var(--sun)">일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th style="color:var(--blue)">토</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="cal-foot"><span>07월 06일 (월)</span><span>일정편집</span></div>
  </div>`;
}

const RAIL_ITEMS=[["🔔","알림"],["🖊","결재"],["💬","SMS"],["🏢","사업장"],["⚖","법령"],
  ["📖","통합매뉴얼"],["💡","상담지식"],["🧮","계산기"],["📍","주소/관할"]];

/* 조원 슬라이드 렌더 */
function renderTabs(){
  const memberTabs=TEAM.map((m,i)=>{
    const cls=["d-tab"]; if(m.placeholder)cls.push("placeholder");
    return `<div class="${cls.join(' ')}" data-i="${i}" tabindex="0" role="button">${m.n}</div>`;
  }).join("");
  return memberTabs+`<div class="d-tab closer" data-i="closing" tabindex="0" role="button">마무리 →</div>`;
}
function renderRail(){
  return RAIL_ITEMS.map(([ic,tx])=>`<div class="r-item"><span class="ic">${ic}</span><span>${tx}</span></div>`).join("");
}
function photoCardHTML(m){
  return `<div class="member-photo">
    <div class="mp-frame"><img src="${m.photo}" alt="${m.n}"></div>
    <div class="photo-caption">
      <div class="photo-name">${m.n}</div>
      <div class="photo-office">(${m.office})</div>
    </div>
  </div>`;
}

function memberContentHTML(m,idx){
  let content;
  if(m.placeholder){
    content=`<div class="d-content"><div class="placeholder-body">
      <div class="pv">${m.n}</div>
      <div class="pt">${m.office} · 콘텐츠 추후 등록 예정</div>
      <div class="pt" style="font-size:13px;color:#aeb9c8">발표 자료 제출 시 이 탭에 자동으로 채워집니다.</div>
    </div></div>`;
  } else {
    // 히어로: 메트릭 or 부제
    let heroExtra="";
    if(m.metrics){
      heroExtra=`<div class="metrics">${m.metrics.map(x=>
        `<div class="metric"><span class="badge">${x.b}</span><span class="m-label">${x.l}</span></div>`).join("")}</div>`;
    }
    const notice=`
      <div class="card notice">
        <div class="c-title"><span class="dot"></span>내가 생각하는 노동감독관이란?<span class="more">더보기 +</span></div>
        <div class="list">${m.aspects.map(a=>`
          <div class="row" tabindex="0" role="button"><span class="no">${a.no}</span>
            <div class="tx"><div class="rt">${a.t}</div><div class="rd">${a.d}</div></div>
          </div>`).join("")}</div>
        ${m.img?`<div class="notice-img"><img src="${m.img}" alt="${m.value} 이미지"></div>`:""}
      </div>`;
    const aux=`
      <div class="card aux">
        <div class="c-title"><span class="dot"></span>앞으로의 다짐</div>
        <div class="chips">${m.chips.slice(0,3).map(c=>`<div class="chip" tabindex="0" role="button"><span class="ck">${c.k}</span><div class="chip-pop">${c.d}</div></div>`).join("")}</div>
        ${koreaMapHTML(m)}
      </div>`;
    const mlines=(m.motto||"").split(/<br\s*\/?>/i).map(s=>s.replace(/<[^>]*>/g,""));
    const mlen=Math.max(...mlines.map(s=>s.length));
    const mfs=mlen<=6?29:(mlen<=14?22:(mlen<=26?19:17));
    const side=`
      <div class="side">
        <div class="banner-flip" tabindex="0" role="button" title="마우스를 올리면 좌우명이 나타납니다"><div class="bf-inner">
          <div class="banner bf-front"><span class="trophy">🏆</span>
            <div class="b-label">나의 좌우명</div>
            <div class="b-hint">🖱 마우스를 올려보세요</div>
          </div>
          <div class="banner bf-back"><div class="b-motto" style="font-size:${mfs}px">${m.motto}</div></div>
        </div></div>
        ${m.photo?photoCardHTML(m):calHTML()}
      </div>`;
    const vlen=(m.value||"").length;
    const vfs=vlen<=6?46:(vlen<=9?38:(vlen<=13?32:27));
    const hero=`
      <div class="card hero">
        <div class="c-title"><span class="dot"></span>지원동기</div>
        <div class="kw-wrap" tabindex="0" role="button"><span class="kw" style="font-size:${vfs}px">${m.value}</span><span class="kw-hint">🖱 자세히</span>
          <div class="kw-pop">${m.quote}</div>
        </div>
        ${heroExtra}
      </div>`;
    content=`<div class="d-content">${hero}${side}${notice}${aux}</div>`;
  }
  return content;
}
function buildMemberSlide(m,idx){
  const s=document.createElement("section");
  s.className="slide"; s.id="m"+idx;
  s.innerHTML=`<div class="dash">${memberContentHTML(m,idx)}</div>`;
  return s;
}

async function init(){
/* 슬라이드 목록 구성 */
const stage=document.getElementById("stage");
TEAM.forEach((m,i)=>stage.appendChild(buildMemberSlide(m,i)));

/* 마지막(마무리) 슬라이드 — 노사누리 배경 + 단체사진 + 마무리 멘트 */
const closing=document.createElement("section");
closing.className="slide"; closing.id="closing";
closing.innerHTML=`
  <div class="dash closing-dash">
    <div class="closing-duty-panel">
      <div class="closing-panel-head">
        <a href="board.html" class="closing-shortcut">노리터 ›</a>
        <button type="button" class="closing-shortcut" id="dutyShortcutBtn">업무분장 바로가기 ›</button>
      </div>
    </div>
    <div class="closing-wrap">
      <div class="closing-label"><span class="dot"></span>11조 · 함께하조 &nbsp;|&nbsp; 노동감독관의 의미</div>
      <div class="group-photo" id="groupPhoto" title="클릭하면 다음 사진으로 전환됩니다 (5초마다 자동 전환)">
        <img class="gp-img active" src="pic/danche/group1.jpg" alt="11조(함께하조) 단체사진 1">
        <img class="gp-img" src="pic/danche/group2.jpg" alt="11조(함께하조) 단체사진 2">
        <img class="gp-img" src="pic/danche/group3.jpg" alt="11조(함께하조) 단체사진 3">
        <span class="gp-hint">📷 클릭 · 5초마다 자동 전환</span>
        <div class="gp-dots" id="gpDots"></div>
      </div>
      <div class="closing-tagline">
        땅의 가치보다 <span class="accent">땀의 가치</span>를 인정하는 사회,<br>
        <span class="big">우리가 만들어 가겠습니다!</span>
      </div>
      <div class="closing-sign">신규 노동감독관 수사학교 11조 · 함께하조</div>
    </div>
  </div>
  <div class="duty-modal" id="dutyModal" aria-hidden="true">
    <div class="duty-modal-box" role="dialog" aria-labelledby="dutyModalTitle">
      <div class="duty-modal-head" id="dutyModalTitle"><span class="sq"></span>11조 업무 분장</div>
      <table class="duty-table" id="dutyTable"></table>
      <div class="duty-modal-foot">
        <button type="button" class="duty-modal-close" id="dutyModalClose">닫기</button>
      </div>
    </div>
  </div>`;
stage.appendChild(closing);

/* 업무분장 표 — 11조(함께하조) */
const DUTY_ROWS=[
  ["강민우","개그 담당"],
  ["강재귀","엉뚱함 담당"],
  ["김재원","회식 담당"],
  ["신원주","자랑 담당"],
  ["박재홍","존엄 담당"],
  ["오승진","행운·전문성 담당"],
  ["우자경","도전 담당"],
  ["이선하","번역 담당"],
  ["이정훈","상식 회복 담당"]
];
const dutyTable=document.getElementById("dutyTable");
dutyTable.innerHTML=DUTY_ROWS.map(([n,r])=>`<tr><td>${n}</td><td>${r}</td></tr>`).join("");
const dutyModal=document.getElementById("dutyModal");
document.getElementById("dutyShortcutBtn").addEventListener("click",()=>{
  dutyModal.classList.add("open");
  dutyModal.setAttribute("aria-hidden","false");
});
function closeDutyModal(){
  dutyModal.classList.remove("open");
  dutyModal.setAttribute("aria-hidden","true");
}
document.getElementById("dutyModalClose").addEventListener("click",closeDutyModal);
dutyModal.addEventListener("click",e=>{ if(e.target===dutyModal) closeDutyModal(); });

/* GPKI 인증서 로그인 — '구현중입니다' 안내 모달 */
const wipModal=document.getElementById("wipModal");
function closeWipModal(){
  wipModal.classList.remove("open");
  wipModal.setAttribute("aria-hidden","true");
}
document.getElementById("gpkiBtn").addEventListener("click",()=>{
  wipModal.classList.add("open");
  wipModal.setAttribute("aria-hidden","false");
});
document.getElementById("wipModalClose").addEventListener("click",closeWipModal);
wipModal.addEventListener("click",e=>{ if(e.target===wipModal) closeWipModal(); });

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&dutyModal.classList.contains("open")) closeDutyModal();
  if(e.key==="Escape"&&wipModal.classList.contains("open")) closeWipModal();
});

/* 마무리 단체사진 — 클릭 시 다음 컷 + 5초마다 자동 순환(마무리 슬라이드 활성 동안만) */
const groupPhoto=document.getElementById("groupPhoto");
const gpImgs=Array.from(groupPhoto.querySelectorAll(".gp-img"));
const gpDots=document.getElementById("gpDots");
let gpIdx=0, gpTimer=null;
gpImgs.forEach((_,k)=>{
  const d=document.createElement("i");
  d.addEventListener("click",e=>{ e.stopPropagation(); gpGo(k); gpStart(); });
  gpDots.appendChild(d);
});
const gpDotEls=Array.from(gpDots.children);
function gpGo(i){
  gpIdx=(i+gpImgs.length)%gpImgs.length;
  gpImgs.forEach((im,k)=>im.classList.toggle("active",k===gpIdx));
  gpDotEls.forEach((d,k)=>d.classList.toggle("on",k===gpIdx));
}
function gpNext(){ gpGo(gpIdx+1); }
function gpStart(){ gpStop(); gpTimer=setInterval(gpNext,5000); }
function gpStop(){ if(gpTimer){ clearInterval(gpTimer); gpTimer=null; } }
groupPhoto.addEventListener("click",()=>{ gpNext(); gpStart(); });
gpGo(0);

const slides=Array.from(document.querySelectorAll(".slide"));
const N=slides.length;

/* 공용(고정) 헤더 — 조원 슬라이드 공통. 조원 전환 시 탭 스트립이 가로로 슬라이드 */
const mheader=document.createElement("div");
mheader.className="d-header hidden";
mheader.id="mheader";
mheader.innerHTML=`
  <div class="d-logo"><img src="assets_emblem_only.svg" alt="정부상징"><b>노사누리</b></div>
  <div class="d-tabs"><div class="d-tabs-inner" id="tabsInner">${renderTabs()}</div></div>
  <div class="d-arrows">‹ ›</div>
  <div class="d-toggle"><span class="tg on" tabindex="0" role="button">근로감독</span><span class="tg off" tabindex="0" role="button" id="sanupBtn">산업안전</span></div>
  <div class="d-user">
    <span class="u-name"><svg class="u-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="4.2"/><path d="M4.5 20c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8z"/></svg>11조 함께하조</span>
    <span>⚙</span><span class="timer">10 : 00</span>
    <span class="ext" id="extBtn">연장</span><span class="out" id="logoutBtn">로그아웃</span>
  </div>`;
stage.appendChild(mheader);
const tabsInner=mheader.querySelector("#tabsInner");
const dtabs=mheader.querySelector(".d-tabs");
const tabEls=Array.from(tabsInner.children);

/* 조원 이름(탭)을 누르면 해당 조원 화면으로 바로 이동. 마지막 '마무리' 탭은 마무리 슬라이드로 */

/* 산업안전 팝업 모달 */
const sanupModal=document.getElementById("sanupModal");
function closeSanupModal(){
  sanupModal.classList.remove("open");
  sanupModal.setAttribute("aria-hidden","true");
}
mheader.querySelector("#sanupBtn").addEventListener("click", ()=>{
  sanupModal.classList.add("open");
  sanupModal.setAttribute("aria-hidden","false");
});
document.getElementById("sanupModalClose").addEventListener("click", closeSanupModal);
sanupModal.addEventListener("click",e=>{ if(e.target===sanupModal) closeSanupModal(); });
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&sanupModal.classList.contains("open")) closeSanupModal();
});


tabsInner.addEventListener("click",e=>{
  const t=e.target.closest(".d-tab"); if(!t) return;
  const di=t.dataset.i;
  show(di==="closing" ? N-1 : parseInt(di,10)+1);
});

/* 핵심 관점 항목을 누르면(터치 대응) 상세 문구를 펼침/접음. 마우스오버는 CSS로 처리 */
document.addEventListener("click",e=>{
  const row=e.target.closest(".notice .row"); if(!row) return;
  row.classList.toggle("open");
});

/* 활성 탭 표시 + 스트립을 활성 탭이 가운데 오도록 슬라이드(양끝 클램프) */
function setActiveTab(mi, animate){
  tabEls.forEach((t,k)=>t.classList.toggle("active",k===mi));
  if(mi<0) return; // 마지막장: 활성 표시만 해제, 스트립 위치는 유지
  tabsInner.style.transition = animate ? "" : "none";
  const tab=tabEls[mi];
  const W=dtabs.clientWidth;
  const max=Math.max(0, tabsInner.scrollWidth - W);
  const off=Math.max(0, Math.min(tab.offsetLeft + tab.offsetWidth/2 - W/2, max));
  tabsInner.style.transform="translateX("+(-off)+"px)";
  if(!animate){ void tabsInner.offsetWidth; tabsInner.style.transition=""; }
}

/* 진행 점 */
const prog=document.getElementById("progress");
slides.forEach(()=>{const d=document.createElement("div");d.className="p-dot";prog.appendChild(d);});
const dots=Array.from(prog.children);

/* ===== 네비게이션 ===== */
let cur=0, loginTimers=[];
function show(i){
  i=Math.max(0,Math.min(N-1,i));
  const from=cur;
  cur=i;
  slides.forEach((s,k)=>s.classList.toggle("active",k===i));
  dots.forEach((d,k)=>d.classList.toggle("on",k===i));
  if(i===0){
    stopCountdown();
    resetCountdown();
  } else if(from===0){
    startCountdown();
  }
  clearLogin();
  if(i===0){
    mheader.classList.add("hidden");
    runLogin();
  } else {
    const firstShow = mheader.classList.contains("hidden"); // 로그인→조원 진입 시엔 순간이동
    mheader.classList.remove("hidden");
    const mi = slides[i].id==="closing" ? -1 : i-1; // 마지막장은 활성 탭 없음
    setActiveTab(mi, !firstShow);
  }
  // 마무리 단체사진 자동 순환은 마무리 슬라이드가 보일 때만
  if(slides[i].id==="closing") gpStart(); else gpStop();
  history.replaceState(null, "", "#" + slides[i].id);
}
function next(){ show(cur+1); }
function prev(){ show(cur-1); }

/* ===== 카운트다운 타이머 ===== */
const COUNTDOWN_DURATION = 600; // 10분
let countdownTime = COUNTDOWN_DURATION;
let countdownInterval = null;
const timerEl = mheader.querySelector(".timer");

function formatCountdown(s){
  const mm = Math.floor(s/60), ss = s%60;
  return String(mm).padStart(2,"0")+" : "+String(ss).padStart(2,"0");
}
function tickCountdown(){
  if(cur===0) return;
  countdownTime--;
  timerEl.textContent = formatCountdown(countdownTime);
  if(countdownTime<=0) show(0);
}
function startCountdown(){
  if(countdownInterval!==null) return;
  countdownInterval = setInterval(tickCountdown, 1000);
}
function stopCountdown(){
  clearInterval(countdownInterval);
  countdownInterval = null;
}
function resetCountdown(){
  countdownTime = COUNTDOWN_DURATION;
  timerEl.textContent = formatCountdown(countdownTime);
}
mheader.querySelector("#extBtn").addEventListener("click", ()=>{
  resetCountdown();
  startCountdown();
});
mheader.querySelector("#logoutBtn").addEventListener("click", ()=>{ show(0); });

/* ===== 로그인 애니메이션 ===== */
const idField=document.getElementById("idField");
const pwField=document.getElementById("pwField");
const loginBtn=document.getElementById("loginBtn");
const cursor=document.getElementById("cursor");
const loginBtnDefaultHTML=loginBtn.innerHTML;
let loginBusy=false;
function clearLogin(){
  loginTimers.forEach(t=>clearTimeout(t)); loginTimers=[];
  idField.innerHTML=""; pwField.innerHTML="";
  loginBtn.innerHTML=loginBtnDefaultHTML;
  loginBtn.classList.remove("clicked","pulse","loading");
  loginBtn.classList.add("disabled");
  loginBusy=false;
  cursor.style.opacity=0; cursor.style.transform="translate(430px,470px)";
}
function T(fn,ms){ loginTimers.push(setTimeout(fn,ms)); }
function runLogin(){
  const ID="inspector11", PW="********";
  const caret='<span class="lg-caret"></span>';
  let t=600;
  // 아이디 타이핑 (0.1초 간격)
  for(let k=1;k<=ID.length;k++){
    T(()=>{ idField.innerHTML=ID.slice(0,k)+caret; }, t);
    t+=100;
  }
  T(()=>{ idField.innerHTML=ID; }, t); t+=350;
  // 비밀번호 타이핑 (0.1초 간격)
  for(let k=1;k<=PW.length;k++){
    T(()=>{ pwField.innerHTML=PW.slice(0,k)+caret; }, t);
    t+=100;
  }
  T(()=>{ pwField.innerHTML=PW; }, t); t+=350;
  // 타이핑 완료 → 로그인 버튼 활성화 + 펄스(깜빡임)로 클릭 유도
  T(()=>{
    loginBtn.classList.remove("disabled");
    loginBtn.classList.add("pulse");
  }, t);
}
// 사용자가 직접 로그인 버튼을 클릭했을 때만 진행 (자동 클릭 없음)
loginBtn.addEventListener("click", ()=>{
  if(loginBtn.classList.contains("disabled") || loginBusy) return;
  loginBusy=true;
  loginBtn.classList.remove("pulse");
  loginBtn.classList.add("loading");
  loginBtn.innerHTML='<span class="lg-loading"><span class="lg-spinner"></span>인증 중...</span>';
  // 1.5초 로딩 연출 후 다음 화면(발표 메인 화면)으로 부드럽게 전환
  T(()=>{ next(); }, 1500);
});

/* ===== 키보드 / 스케일 ===== */
document.addEventListener("keydown",e=>{
  if(e.key==="ArrowRight"||e.key===" "||e.key==="PageDown"){e.preventDefault();next();}
  else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();prev();}
  else if(e.key==="Home"){show(0);}
  else if(e.key==="End"){show(N-1);}
  else if(e.key.toLowerCase()==="r"){show(0);}
  else if(e.key.toLowerCase()==="f"){toggleFull();}
});
function toggleFull(){ if(!document.fullscreenElement)document.documentElement.requestFullscreen(); else document.exitFullscreen(); }

function fit(){
  const pad=0;
    if (window.innerWidth <= 768) {
    stage.style.transform = "scale(1)";
    document.body.classList.add("is-mobile");
  } else {
    document.body.classList.remove("is-mobile");
    const sc=Math.min((window.innerWidth-pad)/1280,(window.innerHeight-pad)/720);
    stage.style.transform="scale("+sc+")";
  }
  layoutLeaders();
}
window.addEventListener("resize",fit);
fit();
const initHash = location.hash.substring(1);
let startIdx = 0;
if (initHash) {
  const target = slides.findIndex(s => s.id === initHash);
  if (target >= 0) startIdx = target;
}
show(startIdx);
/* 지시선 최초 배치(레이아웃/웹폰트 안정화 후 한 번 더) */
layoutLeaders();
requestAnimationFrame(layoutLeaders);
setTimeout(layoutLeaders,300);

/* ===== 인쇄 모드: 슬라이드를 페이지별로 나열 (?print) ===== */
function pageHeaderHTML(mi){
  const tabs=TEAM.map((m,i)=>{
    const cls=["d-tab"]; if(i===mi)cls.push("active"); if(m.placeholder)cls.push("placeholder");
    return `<div class="${cls.join(' ')}" tabindex="0" role="button">${m.n}</div>`;
  }).join("");
  return `<div class="d-header ph-header">
    <div class="d-logo"><img src="assets_emblem_only.svg" alt="정부상징"><b>노사누리</b></div>
    <div class="d-tabs"><div class="d-tabs-inner">${tabs}</div></div>
    <div class="d-arrows">‹ ›</div>
    <div class="d-toggle"><span class="tg on" tabindex="0" role="button">근로감독</span><span class="tg off" tabindex="0" role="button" id="sanupBtn">산업안전</span></div>
    <div class="d-user"><span class="u-name"><svg class="u-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="4.2"/><path d="M4.5 20c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8z"/></svg>11조 함께하조</span><span>⚙</span>
      <span class="timer">10 : 00</span><span>연장</span><span class="out">로그아웃</span></div>
  </div>`;
}
function enterPrintMode(){
  loginTimers.forEach(t=>clearTimeout(t)); loginTimers=[];
  document.body.classList.add("print-mode");
  const root=document.createElement("div"); root.id="printroot";

  // 1) 로그인 페이지 (정적 입력 완료 상태)
  const lg=document.getElementById("login").cloneNode(true);
  const c=lg.querySelector("#cursor"); if(c)c.remove();
  lg.querySelector("#idField").textContent="inspector11";
  lg.querySelector("#pwField").textContent="********";
  const lgBtn=lg.querySelector("#loginBtn");
  if(lgBtn){ lgBtn.innerHTML=loginBtnDefaultHTML; lgBtn.classList.remove("disabled","pulse","loading","clicked"); }
  const p1=document.createElement("div"); p1.className="ph-page login";
  p1.innerHTML=lg.innerHTML; root.appendChild(p1);

  // 2) 조원 페이지
  TEAM.forEach((m,i)=>{
    const pg=document.createElement("div"); pg.className="ph-page";
    pg.innerHTML=pageHeaderHTML(i)+`<div class="dash">${memberContentHTML(m,i)}</div>`;
    root.appendChild(pg);
  });

  // 3) 마무리 페이지
  const pc=document.createElement("div"); pc.className="ph-page";
  pc.innerHTML=pageHeaderHTML(-1)+document.getElementById("closing").querySelector(".dash").outerHTML;
  root.appendChild(pc);

  document.body.appendChild(root);

  // 헤더 탭 스트립을 활성 탭이 보이도록 위치
  root.querySelectorAll(".ph-header").forEach(h=>{
    const active=h.querySelector(".d-tab.active"); if(!active)return;
    const dt=h.querySelector(".d-tabs"), inner=h.querySelector(".d-tabs-inner");
    const W=dt.clientWidth, max=Math.max(0, inner.scrollWidth - W);
    const off=Math.max(0, Math.min(active.offsetLeft + active.offsetWidth/2 - W/2, max));
    inner.style.transform="translateX("+(-off)+"px)";
  });
}
if(new URLSearchParams(location.search).has("print")) enterPrintMode();
}
loadTeam().then(init).catch(e=>{ console.error(e); alert("데이터 로드 실패: "+e.message); });


document.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") {
    const el = e.target;
    if (el.getAttribute("role") === "button") {
      e.preventDefault();
      el.click();
    }
  }
});


/* 모바일 스와이프 제스처 (좌우 넘기기) */
let touchStartX = 0;
let touchEndX = 0;
document.addEventListener("touchstart", e => {
  touchStartX = e.changedTouches[0].screenX;
}, {passive: true});

document.addEventListener("touchend", e => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, {passive: true});

function handleSwipe() {
  if (window.innerWidth > 768) return; // 모바일에서만 동작
  const diff = touchStartX - touchEndX;
  if (Math.abs(diff) > 50) { // 최소 50px 이상 스와이프 시 동작
    if (diff > 0) {
      next(); // 왼쪽으로 쓸어넘김 -> 다음
    } else {
      prev(); // 오른쪽으로 쓸어넘김 -> 이전
    }
  }
}


/* 터치 디바이스 호환을 위한 툴팁/플립카드 토글 */
document.addEventListener("click", e => {
  // 열려있는 모든 팝업 닫기 (클릭된 요소 제외)
  const isKw = e.target.closest(".kw-wrap");
  const isChip = e.target.closest(".chip");
  const isBanner = e.target.closest(".banner-flip");
  
  if (!isKw) document.querySelectorAll(".kw-wrap.open").forEach(el => el.classList.remove("open"));
  if (!isChip) document.querySelectorAll(".chip.open").forEach(el => el.classList.remove("open"));
  if (!isBanner) document.querySelectorAll(".banner-flip.open").forEach(el => el.classList.remove("open"));

  // 클릭된 요소 토글
  if (isKw) isKw.classList.toggle("open");
  if (isChip) isChip.classList.toggle("open");
  if (isBanner) isBanner.classList.toggle("open");
});
