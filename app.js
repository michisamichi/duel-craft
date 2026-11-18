import {CARDS,CARD,PRESETS,copyPreset,validDeck} from './cards.js';
import {PHASES,createRoom,joinRoom,createDemo,applyAction,normalizeRoom} from './engine.js';
import {firebaseConfig} from './firebase-config.js';

const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stored=(k,fallback)=>{try {const v=localStorage.getItem(k);return v?JSON.parse(v):fallback;}catch{return fallback;}};
const configReady=Object.values(firebaseConfig).every(v=>typeof v==='string'&&v.trim()!=='');
const ui={
  nickname:localStorage.getItem('duel-name')||'プレイヤー',
  counts:stored('duel-deck',copyPreset('red')),
  deckPreset:localStorage.getItem('duel-preset')||'red',
  game:null,roomCode:'',seat:0,demo:false,selected:null,targetMode:null,deckOpen:false,
  busy:false,sdk:null,db:null,uid:null,unsub:null,toastTimer:null,
};
if(!validDeck(ui.counts))ui.counts=copyPreset('red');
const effectNeedsTarget=id=>['destroy','boost500'].includes(CARD[id]?.effect);
const cardTypeName=c=>c.type==='monster'?'モンスター':c.type==='spell'?'魔法':'罠';
const isMine=()=>!!ui.game?.players?.[ui.seat];
const activePlayer=()=>ui.game?.players?.[ui.seat];
const myTurn=()=>ui.game?.turn===ui.seat&&ui.game?.status==='playing';
const inMain=()=>myTurn()&&!ui.game.pending&&['main1','main2'].includes(ui.game.phase);
const suffix=(c)=>c.type==='monster'?`★${c.level}　ATK ${c.atk} / DEF ${c.def}`:cardTypeName(c);
const sum=counts=>Object.values(counts).reduce((a,b)=>a+Number(b||0),0);
function toast(msg){const el=$('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(ui.toastTimer);ui.toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
function setNetwork(msg,status=''){const el=$('network');el.textContent=msg;el.className='network '+status;}
function setBusy(v){ui.busy=v;render();}
function makeCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code='';for(let i=0;i<8;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];return code;}
function btn(label,action,cls='btn',data='',disabled=false){return `<button type="button" class="${cls}" data-action="${action}" ${data} ${disabled?'disabled':''}>${label}</button>`;}
function cardHtml(id,{hidden=false,def=false,mini=false}={}){
  if(hidden)return '<div class="card back" aria-label="裏側のカード"></div>';
  const c=CARD[id];if(!c)return '<div class="card back"></div>';
  return `<div class="card ${esc(c.type)} ${def?'defense':''}">
   <div class="card-name">${esc(c.name)}</div>
   ${c.type==='monster'?`<div class="card-stars">${'★'.repeat(c.level)}</div>`:'<div class="card-stars">✦</div>'}
   <div class="card-emoji" aria-hidden="true">${esc(c.emoji)}</div>
   <div class="card-info">${c.type==='monster'?`⚔${c.atk}　🛡${c.def}`:esc(cardTypeName(c))}</div></div>`;
}
function renderHome(){
  const linkCode=new URLSearchParams(location.search).get('room')||'';
  return `<section class="hero"><div class="eyebrow">ORIGINAL CARD BATTLE</div>
    <h1>ふたりで遊ぶ<br><span>カードデュエル</span></h1><p>ライフ8000・デッキ40枚。モンスターを召喚し、魔法や罠を駆使して相手に勝とう。</p></section>
  <section class="panel"><h2>対戦の準備</h2><label class="field-label" for="playerName">プレイヤー名</label>
  <input class="input" id="playerName" maxlength="12" value="${esc(ui.nickname)}" placeholder="プレイヤー">
  <label class="field-label" for="preset">使うデッキ</label>
  <div class="row"><select class="input grow" id="preset"><option value="red" ${ui.deckPreset==='red'?'selected':''}>🔥 紅蓮デッキ</option><option value="blue" ${ui.deckPreset==='blue'?'selected':''}>🌊 蒼海デッキ</option><option value="custom" ${ui.deckPreset==='custom'?'selected':''}>🃏 カスタムデッキ</option></select>
  ${btn('デッキ編集','editDeck','btn sm')}</div>
  <div class="small muted mt8">40枚 / 同じカードは3枚まで。最初から2種類のデッキを収録。</div></section>
  <section class="panel"><h2>2台のiPhoneで対戦</h2>
   ${configReady?`<div class="stack">${btn('部屋を作る','createRoom','btn primary wide')}
     <div class="row"><input id="roomCode" class="input grow" maxlength="8" value="${esc(linkCode)}" placeholder="8文字の部屋コード" autocapitalize="characters">${btn('参加','joinRoom','btn secondary')}</div></div>
     <p class="small muted">部屋を作り、コードを相手に送ると対戦できます。</p>`:
    `<div class="notice">オンライン対戦にはFirebaseの無料初期設定が必要です。付属のREADMEに設定手順があります。</div>
     <div class="row">${btn('部屋を作る','createRoom','btn primary grow','',true)}${btn('部屋に参加','joinRoom','btn secondary grow','',true)}</div>`}
  </section><section class="panel"><h2>まずは操作を試す</h2><p class="small muted">設定不要。1台のiPhoneでプレイヤー1・2を切り替えて遊べます。</p>
  ${btn('1台でお試し対戦','demo','btn wide')}
  </section><p class="small muted center">簡易ルール：通常召喚は各ターン1回・先攻初ターンはドローと攻撃なし・罠は攻撃時に任意で発動します。</p>
  ${ui.deckOpen?deckModal():''}`;
}
function deckModal(){
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="デッキ編集"><div class="modal-box">
  <div class="modal-title-line"><h2>デッキ編集</h2>${btn('×','closeDeck','btn sm square')}</div>
  <div class="row between"><span class="muted small">40枚ちょうどにしてください</span><b style="color:${sum(ui.counts)===40?'#89dab2':'#ec8fa5'}">${sum(ui.counts)} / 40</b></div>
  <div class="row wrap mt8">${btn('🔥 紅蓮を読み込む','loadRed','btn sm')}${btn('🌊 蒼海を読み込む','loadBlue','btn sm')}</div>
  <div class="deck-list mt8">${CARDS.map(c=>`<div class="deck-item"><div class="grow"><div class="deck-item-title">${esc(c.emoji)} ${esc(c.name)}</div><div class="deck-item-detail">${esc(suffix(c))}</div></div>
  ${btn('−','deckMinus','btn sm square',`data-id="${c.id}"`,!ui.counts[c.id])}<span class="count">${ui.counts[c.id]||0}</span>
  ${btn('+','deckPlus','btn sm square',`data-id="${c.id}"`,(ui.counts[c.id]||0)>=3||sum(ui.counts)>=40)}</div>`).join('')}</div>
  ${btn('この40枚を保存','saveDeck','btn primary wide mt8','',!validDeck(ui.counts))}</div></div>`;
}
function slotHtml(player,owner,zone,i){
  const item=player?.[zone]?.[i]||null;
  const hide=owner==='opponent'&&(zone==='backrow'||item?.pos==='set');
  const selected=ui.selected?.owner===owner&&ui.selected?.zone===zone&&ui.selected?.index===i;
  const occupied=item?.id;
  let marker='';
  if(zone==='monsters'&&occupied&&(!hide||owner==='mine')) {
    const c=CARD[item.id];const attack=c.atk+(item.bonus||0);
    marker=`<span class="slot-tag">${item.pos==='atk'?'攻'+attack:item.pos==='set'?'裏守':'守'+c.def}</span>`;
  }
  return `<button type="button" aria-label="${owner==='mine'?'自分':'相手'}の${zone==='monsters'?'モンスター':'魔法・罠'}ゾーン${i+1}${occupied?' カードあり':' 空き'}" class="slot ${occupied?'':'empty'} ${selected?'selected':''}" data-select="1" data-owner="${owner}" data-zone="${zone}" data-index="${i}">
  ${occupied?cardHtml(item.id,{hidden:hide,def:item.pos==='def'}):''}${marker}</button>`;
}
function playerStatus(p,side){
  const isCurrent=ui.game.turn===side;
  const lp=p?.lp??8000;
  return `<div class="seat ${side!==ui.seat?'right':''}">
  <div class="avatar">${side===0?'🔥':'🌊'}</div><div><div class="seat-name">${esc(p?.name||'対戦相手')} ${isCurrent?'<span class="turn-chip">手番</span>':''}</div>
  <div class="lp ${lp<=2000?'danger':''}">${Number(lp).toLocaleString('ja-JP')} <span class="tiny">LP</span></div>
  <div class="mini-stats">山札 ${p?.deck?.length??40} / 手札 ${p?.hand?.length??0} / 墓地 ${p?.grave?.length??0}</div></div></div>`;
}
function renderPending(){
  const s=ui.game;if(!s.pending)return '';
  const attacking=s.pending.by===ui.seat;
  if(attacking)return `<div class="respond"><strong>⚔ 攻撃を宣言しました</strong>
   <div class="small">相手が罠カードを発動するか選んでいます。</div>
   ${ui.demo?btn('相手側に切り替える','switchSeat','btn secondary wide mt8'):''}</div>`;
  const p=activePlayer();
  const traps=p.backrow.map((v,i)=>({v,i})).filter(({v})=>v&&CARD[v.id]?.type==='trap'&&v.setTurn<s.turnNo);
  return `<div class="respond"><strong>⚠ 相手の攻撃！ 罠を使いますか？</strong><div class="small">セット済みの罠を選んで発動できます。使わずに攻撃を通してもOK。</div>
  <div class="row wrap mt8">${traps.map(({v,i})=>btn(`${esc(CARD[v.id].emoji)} ${esc(CARD[v.id].name)}`,'trap','btn sm secondary',`data-index="${i}"`)).join('')||'<span class="small muted">発動できる罠がありません。</span>'}</div>
  ${btn('罠を使わずに攻撃を通す','passAttack','btn wide mt8')}</div>`;
}
function renderTargetHint(){
  if(!ui.targetMode)return '';
  const m=ui.targetMode;
  return `<div class="hintbox">${m.type==='attack'?`⚔ 攻撃対象となる相手モンスターをタップしてください。${!ui.game.players[1-ui.seat].monsters.some(Boolean)?'「直接攻撃」もできます。':''}`:m.id==='s03'?'⚡ 破壊する相手のモンスターをタップしてください。':'💪 強化する自分の攻撃表示モンスターをタップしてください。'}
   <div class="row mt8">${m.type==='attack'&&!ui.game.players[1-ui.seat].monsters.some(Boolean)?btn('直接攻撃','directAttack','btn sm primary'):''}${btn('キャンセル','cancelTarget','btn sm ghost')}</div></div>`;
}
function renderSelection(){
  const s=ui.game,sel=ui.selected;if(!sel||!isMine())return '';
  const p=s.players[ui.seat],enemy=s.players[1-ui.seat];
  let id=null,item=null;
  if(sel.zone==='hand'){id=p.hand[sel.index];}
  if(sel.zone==='monsters'){
    item=(sel.owner==='mine'?p:enemy).monsters[sel.index];id=item?.id;
  }
  if(sel.zone==='backrow'){
    item=(sel.owner==='mine'?p:enemy).backrow[sel.index];id=item?.id;
  }
  if(!id)return '';
  if(sel.owner==='opponent'&&(sel.zone==='backrow'||item?.pos==='set'))return '<div class="card-detail"><b>裏側のカード</b><div class="small muted">内容はまだわかりません。</div></div>';
  const c=CARD[id];if(!c)return '';
  let options='';const canMain=inMain();
  if(sel.owner==='mine'&&sel.zone==='hand'&&canMain){
    if(c.type==='monster'){
      options=btn('攻撃表示で召喚','summonAtk','btn primary sm')+btn('裏側守備でセット','summonSet','btn sm');
    }else if(c.type==='spell'){
      options=btn('魔法を発動','spellHand','btn primary sm')+btn('伏せてセット','setHand','btn sm');
    }else options=btn('伏せてセット','setHand','btn primary sm');
  }
  if(sel.owner==='mine'&&sel.zone==='hand'&&myTurn()&&p.hand.length>6)
     options+=btn('手札から捨てる','discard','btn sm danger');
  if(sel.owner==='mine'&&sel.zone==='monsters'&&item){
    if(canMain){
      if(item.pos==='set')options+=btn('反転召喚','flip','btn primary sm');
      else options+=btn('表示形式変更','changePosition','btn sm');
    }
    if(myTurn()&&s.phase==='battle'&&!s.pending&&item.pos==='atk'&&!item.attacked&&s.turnNo>1)
      options+=btn('このモンスターで攻撃','attackSelect','btn primary sm');
  }
  if(sel.owner==='mine'&&sel.zone==='backrow'&&item){
    if(c.type==='spell'&&canMain)options=btn('魔法を発動','spellField','btn primary sm');
    if(c.type==='trap'&&s.pending?.kind==='attack'&&s.pending.by!==ui.seat&&item.setTurn<s.turnNo)
      options=btn('罠を発動','trap','btn primary sm',`data-index="${sel.index}"`);
  }
  return `<section class="card-detail"><div class="row between"><div class="detail-title">${esc(c.emoji)} ${esc(c.name)}</div><span class="detail-badge">${cardTypeName(c)}</span></div>
   <div class="small muted mt8">${esc(suffix(c))}${item?.bonus?` / 強化+${item.bonus}`:''}</div><p class="detail-text">${esc(c.desc)}</p>
   ${options?`<div class="actionbar">${options}</div>`:'<div class="small muted">このタイミングで使える操作はありません。</div>'}</section>`;
}
function renderGame(){
  const s=ui.game;if(!s)return renderHome();
  const roombar=ui.demo?`<div class="rooms">オフラインお試しモード</div>`:
    `<div class="row between rooms"><span>部屋コード：<b>${esc(ui.roomCode)}</b></span>${btn('招待リンクをコピー','copyInvite','btn sm')}</div>`;
  if(s.status==='waiting')return `${roombar}<section class="hero"><div class="eyebrow">WAITING ROOM</div><h1>対戦相手を待っています</h1>
    <p>次のコードか招待リンクを相手に送ってください。</p></section><section class="panel"><div class="code">${esc(ui.roomCode)}</div>
    ${btn('招待リンクをコピー','copyInvite','btn primary wide')}
    <p class="small muted center mt8">相手が入室すると自動的に始まります。</p></section>
    ${btn('ホームに戻る','goHome','btn ghost wide')}`;
  const me=s.players[ui.seat],enemy=s.players[1-ui.seat];
  if(!me)return '<div class="notice">この対戦に参加していません。</div>';
  const ready=!!s.pending;
  const myStatus=playerStatus(me,ui.seat),enemyStatus=playerStatus(enemy,1-ui.seat);
  const hand=me.hand.map((id,i)=>`<button type="button" class="hand-slot ${ui.selected?.zone==='hand'&&ui.selected?.index===i?'selected':''}" data-select="1" data-owner="mine" data-zone="hand" data-index="${i}">${cardHtml(id)}</button>`).join('');
  const phaseButton=!myTurn()||ready||s.status!=='playing'?'':s.phase==='main2'?btn('ターン終了','endTurn','btn primary'):btn(s.phase==='main1'?s.turnNo===1?'メイン2へ':'バトルへ':'メイン2へ','nextPhase','btn primary');
  const endButton=myTurn()&&!ready&&s.status==='playing'&&s.phase!=='main2'?btn('ターン終了','endTurn','btn ghost'):'';
  const winner=s.status==='finished'?`<section class="panel winner">🏆 ${s.winner==='draw'?'引き分け':`${esc(s.players[s.winner].name)} の勝利！`}</section>`:'';
  return `${roombar}<div class="statusbar">${enemyStatus}</div>
   <div class="battlefield">
     <div class="zone-caption">相手の魔法・罠</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(enemy,'opponent','backrow',i)).join('')}</div>
     <div class="zone-caption">相手のモンスター</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(enemy,'opponent','monsters',i)).join('')}</div>
     <div class="field-center"><div class="turnnote">ターン ${s.turnNo}</div><div class="phase">${esc(PHASES[s.phase]||'終了')}</div><div class="turnnote">${myTurn()?'あなたの手番':'相手の手番'}</div></div>
     <div class="zone-caption">自分のモンスター</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(me,'mine','monsters',i)).join('')}</div>
     <div class="zone-caption">自分の魔法・罠</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(me,'mine','backrow',i)).join('')}</div>
   </div>
   <div class="statusbar">${myStatus}<div class="row">${ui.demo?btn('操作側を交代','switchSeat','btn sm secondary'):''}</div></div>
   ${winner}
   ${renderPending()}
   ${renderTargetHint()}
   ${s.status==='playing'&&!s.pending&&myTurn()?`<div class="row wrap mt8">${phaseButton}${endButton}</div>`:''}
   <div class="hand-count">自分の手札 (${me.hand.length}枚)　${!myTurn()?'・相手のターン中':''}</div>
   <div class="hand-scroll">${hand||'<div class="muted small">手札がありません</div>'}</div>
   ${renderSelection()}
   <section class="panel"><div class="row between"><h3>対戦ログ</h3><span class="muted tiny">直近30件</span></div><div class="loglist">${s.log.map(x=>`<div>• ${esc(x)}</div>`).join('')}</div>
   <hr class="soft-divider"><div class="row between"><span class="small muted">自分の墓地 ${me.grave.length}枚</span>${btn('墓地を見る','showGrave','btn sm')}</div></section>
   <div class="footer-links">${s.status==='playing'?btn('降参する','surrender','btn ghost sm'):''}${btn('ホームへ','goHome','btn ghost sm')}</div>
   ${ui.graveOpen?graveModal():''}`;
}
function graveModal(){const me=activePlayer(),enemy=ui.game.players[1-ui.seat];
 return `<div class="modal"><div class="modal-box"><div class="modal-title-line"><h2>墓地</h2>${btn('×','closeGrave','btn sm square')}</div>
 <h3>自分 (${me.grave.length}枚)</h3><div class="grave-list">${me.grave.map(id=>`<span class="grave-chip">${esc(CARD[id]?.emoji||'')} ${esc(CARD[id]?.name||id)}</span>`).join('')||'なし'}</div>
 <hr class="soft-divider"><h3>相手 (${enemy.grave.length}枚)</h3><div class="grave-list">${enemy.grave.map(id=>`<span class="grave-chip">${esc(CARD[id]?.emoji||'')} ${esc(CARD[id]?.name||id)}</span>`).join('')||'なし'}</div></div></div>`;
}
function render(){ $('view').innerHTML=ui.game?renderGame():renderHome(); }
function readHomeValues(){
 const input=$('playerName');if(input){ui.nickname=(input.value.trim()||'プレイヤー').slice(0,12);localStorage.setItem('duel-name',ui.nickname);}
}
function saveDeck(){if(!validDeck(ui.counts))return toast('40枚ちょうどにしてください');localStorage.setItem('duel-deck',JSON.stringify(ui.counts));ui.deckOpen=false;render();toast('デッキを保存しました');}
function setPreset(id){if(id==='red'||id==='blue'){ui.counts=copyPreset(id);ui.deckPreset=id;localStorage.setItem('duel-preset',id);localStorage.setItem('duel-deck',JSON.stringify(ui.counts));}
 else{ui.deckPreset='custom';localStorage.setItem('duel-preset','custom');}render();}
function startDemo(){readHomeValues();if(!validDeck(ui.counts))return toast('先に40枚デッキを完成させてください');ui.demo=true;ui.seat=0;ui.roomCode='';ui.selected=null;ui.targetMode=null;
 ui.game=createDemo({counts1:ui.counts,counts2:copyPreset(ui.deckPreset==='red'?'blue':'red')});ui.seat=ui.game.turn;storeDemo();setNetwork('お試し対戦','ok');render();}
function storeDemo(){if(ui.demo&&ui.game){localStorage.setItem('duel-demo-state',JSON.stringify(ui.game));localStorage.setItem('duel-demo-seat',String(ui.seat));}}
async function remoteCreate(){
 if(!ui.sdk)return toast('Firebaseの設定が必要です');readHomeValues();if(!validDeck(ui.counts))return toast('先に40枚デッキを完成させてください');
 setBusy(true);
 try{
   for(let tries=0;tries<4;tries++){
     const code=makeCode(),r=ui.sdk.ref(ui.db,`rooms/${code}`);
     const result=await ui.sdk.runTransaction(r,old=>old?undefined:createRoom({uid:ui.uid,name:ui.nickname,counts:ui.counts}),{applyLocally:false});
     if(result.committed){await openRoom(code);return;}
   }
   throw Error('部屋コードを作れませんでした');
 }catch(e){toast('部屋の作成に失敗しました：'+e.message)}finally{setBusy(false);}
}
async function remoteJoin(){
 if(!ui.sdk)return toast('Firebaseの設定が必要です');readHomeValues();
 const code=($('roomCode')?.value||'').trim().toUpperCase().replace(/[^A-Z2-9]/g,'');
 if(code.length!==8)return toast('8文字の部屋コードを入力してください');
 setBusy(true);
 try{
   const r=ui.sdk.ref(ui.db,`rooms/${code}`);
   const result=await ui.sdk.runTransaction(r,old=>{
     if(!old)return;
     if(old.players?.some(p=>p?.uid===ui.uid))return old;
     if(old.status!=='waiting'||old.players?.[1])return;
     return joinRoom(old,{uid:ui.uid,name:ui.nickname,counts:ui.counts});
   },{applyLocally:false});
   if(!result.committed)return toast('部屋が見つからないか、すでに満員です');
   await openRoom(code);
 }catch(e){toast('参加できませんでした：'+e.message)}finally{setBusy(false);}
}
async function openRoom(code){
 if(ui.unsub){ui.unsub();ui.unsub=null;}
 ui.demo=false;ui.roomCode=code;ui.selected=null;ui.targetMode=null;
 history.replaceState({},'',`${location.pathname}?room=${code}`);
 ui.unsub=ui.sdk.onValue(ui.sdk.ref(ui.db,`rooms/${code}`),snap=>{
   const v=snap.val();if(!v){toast('部屋が見つかりません');return;}
   ui.game=normalizeRoom(v);ui.seat=v.players?.findIndex(p=>p?.uid===ui.uid)??0;
   if(ui.seat<0){ui.game=null;toast('この部屋に参加していません');}
   render();
 },err=>{toast('同期エラー：'+err.message);setNetwork('同期エラー','off')});
 render();
}
async function send(action){
 if(!ui.game||ui.busy)return;
 ui.targetMode=null;
 if(ui.demo){
   try {ui.game=applyAction(ui.game,`demo-${ui.seat===0?'a':'b'}`,action);ui.selected=null;storeDemo();render();}
   catch(e){toast(e.message);}return;
 }
 setBusy(true);let problem=null;
 try{
   const result=await ui.sdk.runTransaction(ui.sdk.ref(ui.db,`rooms/${ui.roomCode}`),old=>{
      if(!old){problem='部屋がありません';return;}
      try{return applyAction(old,ui.uid,action);}catch(e){problem=e.message;return;}
   },{applyLocally:false});
   if(!result.committed)toast(problem||'ほかの操作と重なりました。もう一度お試しください。');
   else ui.selected=null;
 }catch(e){toast('通信エラー：'+e.message)}finally{setBusy(false);}
}
function requestTributes(id){
 const c=CARD[id],need=c.level<=4?0:c.level<=6?1:2;if(!need)return [];
 const p=activePlayer();const occupied=p.monsters.map((m,i)=>m?i+1:null).filter(Boolean);
 if(occupied.length<need){toast(`レベル${c.level}の召喚には${need}体のリリースが必要です`);return null;}
 const raw=prompt(`召喚には${need}体のリリースが必要です。\n自分のモンスターゾーン番号(1〜5)を選択してください。\nカードがある位置: ${occupied.join(', ')}\n${need===2?'例: 1,3':'例: 2'}`);
 if(raw===null)return null;
 const indexes=raw.split(/[,、\s]+/).map(x=>Number(x)-1);
 if(indexes.length!==need||new Set(indexes).size!==need||!indexes.every(x=>Number.isInteger(x)&&p.monsters[x])){toast('正しいモンスターの位置番号を入力してください');return null;}
 return indexes;
}
function attemptSummon(faceDown){
 const i=ui.selected?.index;if(ui.selected?.zone!=='hand')return;
 const id=activePlayer().hand[i],c=CARD[id];if(!c||c.type!=='monster')return;
 const tributes=requestTributes(id);if(tributes===null)return;
 send({type:'summon',hand:i,faceDown,tributes});
}
function chooseSpell(source,index){
 const p=activePlayer(),id=source==='hand'?p.hand[index]:p.backrow[index]?.id;
 if(!id)return;
 if(effectNeedsTarget(id)){
   ui.targetMode={type:'spell',source,index,id};ui.selected=null;render();
   toast(CARD[id].effect==='destroy'?'破壊する相手のモンスターを選択':'強化する自分のモンスターを選択');
 }else send({type:source==='hand'?'spellFromHand':'spellFromField',[source==='hand'?'hand':'index']:index});
}
function chooseSlot(owner,zone,index){
 if(!ui.game||ui.game.status==='waiting')return;
 if(ui.targetMode){
   const mode=ui.targetMode;
   if(mode.type==='attack'&&owner==='opponent'&&zone==='monsters'&&ui.game.players[1-ui.seat].monsters[index])
     return send({type:'attack',index:mode.index,target:index});
   if(mode.type==='spell'){
     const correct=mode.id==='s03'?owner==='opponent':owner==='mine';
     const targetPlayer=ui.game.players[owner==='mine'?ui.seat:1-ui.seat];
     if(zone==='monsters'&&correct&&targetPlayer.monsters[index])
       return send({type:mode.source==='hand'?'spellFromHand':'spellFromField',[mode.source==='hand'?'hand':'index']:mode.index,target:index});
   }
   return toast('対象となるモンスターを選んでください');
 }
 if(zone==='hand'){
   if(owner!=='mine')return;
   ui.selected={owner,zone,index};return render();
 }
 if(zone==='monsters'||zone==='backrow'){
   if(!ui.game.players[owner==='mine'?ui.seat:1-ui.seat]?.[zone]?.[index])return;
   ui.selected={owner,zone,index};return render();
 }
}
async function copyInvite(){
 const link=`${location.origin}${location.pathname}?room=${encodeURIComponent(ui.roomCode)}`;
 try{await navigator.clipboard.writeText(link);toast('招待リンクをコピーしました');}
 catch{prompt('招待リンクをコピーしてください',link);}
}
function goHome(){if(ui.unsub){ui.unsub();ui.unsub=null;}ui.demo=false;ui.game=null;ui.roomCode='';ui.selected=null;ui.targetMode=null;ui.graveOpen=false;history.replaceState({},'',location.pathname);if(configReady&&ui.db)setNetwork('オンライン接続可能','ok');else setNetwork('お試し対戦可能');render();}
async function initFirebase(){
 if(!configReady){setNetwork('Firebase未設定','off');render();return;}
 try {
   const [{initializeApp},{getAuth,signInAnonymously},{getDatabase,ref,runTransaction,onValue}]=await Promise.all([
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js'),
   ]);
   const app=initializeApp(firebaseConfig);const auth=getAuth(app);
   await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);
   ui.uid=auth.currentUser.uid;ui.db=getDatabase(app);ui.sdk={ref,runTransaction,onValue};
   setNetwork('オンライン接続可能','ok');render();
 }catch(e){setNetwork('接続設定エラー','off');toast('Firebase接続エラー：'+e.message);render();}
}
$('view').addEventListener('click',async e=>{
 const selected=e.target.closest('[data-select]');if(selected){chooseSlot(selected.dataset.owner,selected.dataset.zone,Number(selected.dataset.index));return;}
 const el=e.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(ui.busy)return;
 if(action==='editDeck'){readHomeValues();ui.deckOpen=true;render();return;}
 if(action==='closeDeck'){ui.deckOpen=false;render();return;}
 if(action==='deckPlus'||action==='deckMinus'){
   const id=el.dataset.id,n=ui.counts[id]||0;if(action==='deckPlus'&&n<3&&sum(ui.counts)<40)ui.counts[id]=n+1;
   if(action==='deckMinus'&&n>0)ui.counts[id]=n-1;
   render();return;
 }
 if(action==='loadRed'||action==='loadBlue'){ui.counts=copyPreset(action==='loadRed'?'red':'blue');ui.deckPreset=action==='loadRed'?'red':'blue';render();return;}
 if(action==='saveDeck'){ui.deckPreset='custom';localStorage.setItem('duel-preset','custom');saveDeck();return;}
 if(action==='demo')return startDemo();
 if(action==='createRoom')return remoteCreate();
 if(action==='joinRoom')return remoteJoin();
 if(action==='copyInvite')return copyInvite();
 if(action==='goHome')return goHome();
 if(action==='switchSeat'){ui.seat=1-ui.seat;ui.selected=null;ui.targetMode=null;storeDemo();render();return;}
 if(action==='nextPhase')return send({type:'nextPhase'});
 if(action==='endTurn')return send({type:'endTurn'});
 if(action==='passAttack')return send({type:'passAttack'});
 if(action==='trap')return send({type:'activateTrap',index:Number(el.dataset.index??ui.selected?.index)});
 if(action==='summonAtk')return attemptSummon(false);
 if(action==='summonSet')return attemptSummon(true);
 if(action==='setHand')return send({type:'setBackrow',hand:ui.selected.index});
 if(action==='spellHand')return chooseSpell('hand',ui.selected.index);
 if(action==='spellField')return chooseSpell('field',ui.selected.index);
 if(action==='flip')return send({type:'flip',index:ui.selected.index});
 if(action==='changePosition')return send({type:'changePosition',index:ui.selected.index});
 if(action==='discard')return send({type:'discard',hand:ui.selected.index});
 if(action==='attackSelect'){ui.targetMode={type:'attack',index:ui.selected.index};ui.selected=null;render();return;}
 if(action==='directAttack')return send({type:'attack',index:ui.targetMode.index,target:null});
 if(action==='cancelTarget'){ui.targetMode=null;render();return;}
 if(action==='surrender'&&confirm('本当に降参しますか？'))return send({type:'surrender'});
 if(action==='showGrave'){ui.graveOpen=true;render();return;}
 if(action==='closeGrave'){ui.graveOpen=false;render();return;}
});
$('view').addEventListener('change',e=>{
 if(e.target.id==='preset'){readHomeValues();setPreset(e.target.value);}
});
// オンライン設定前は1台お試しのみ利用可能。
setNetwork(configReady?'オンライン準備中':'Firebase未設定',configReady?'':'off');render();initFirebase();
