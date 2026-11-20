import {makeRoomCode,normalizeRoomCode,isRoomCode} from './room-code.js?v=1911';
import {CARDS,CARD,PRESETS,copyPreset,validDeck,validExtraDeck,replaceCustomCards,isSafeCustomCard,effectText,MONSTER_EFFECTS,ORIGINAL_IDS,RARITIES,SPELL_KINDS,spellKind,persistentSpell,summonKind,SUMMON_KINDS} from './cards.js?v=1919';
import {readDeckStore,writeDeckStore,newDeck,encodeDeckShare,decodeDeckShare,MAX_SAVED_DECKS,totalCards} from './decks.js?v=196';
import {makeBackup,parseBackup,applyBackup} from './backup.js?v=196';
import {PHASES,createRoom,joinRoom,createDemo,applyAction,normalizeRoom,effectiveAtk,effectiveDef} from './engine.js?v=1919';
import {LIMITS,cardLimit,cardCost,deckCost,TRIGGERS,TARGETS,OPERATIONS,ABILITY_META,abilityTargets,abilityText,normalizeRuleSettings,readRuleSettings,writeRuleSettings} from './rules.js?v=1919';
import {createDraftRoom,joinDraftRoom,applyDraftPick,normalizeDraftRoom} from './draft.js?v=1913';
import {readPackStore,savePackStore,newPack,normalizePack,openPack,collect} from './packs.js?v=1910';
import {SEALED_STORAGE_KEY,sealedPoolFromPacks,normalizeSealedSession,allowedSealedCopies,sealedCapacity} from './sealed.js?v=1910';
import {VISUAL_CHOICES,SOUND_CHOICES,readFxSettings,writeFxSettings,unlockAudio,playCue,setBgmPlaying} from './fx.js?v=1922';
import {playBoardCue,clearBoardCue} from './board-effects.js?v=1923';

const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Start the UI independently from Firebase. In-app iPhone browsers may deny storage.
const tempStorage=new Map();
let storageAvailable=true;
try {const k='duel-storage-probe';window.localStorage.setItem(k,'1');window.localStorage.removeItem(k);}
catch {storageAvailable=false;}
const storage={
  getItem(k){if(tempStorage.has(k))return tempStorage.get(k);try{return window.localStorage.getItem(k);}catch{return null;}},
  setItem(k,v){try{window.localStorage.setItem(k,String(v));tempStorage.delete(k);}catch{tempStorage.set(k,String(v));}},
  removeItem(k){tempStorage.delete(k);try{window.localStorage.removeItem(k);}catch{}},
};
const stored=(k,fallback)=>{try {const v=storage.getItem(k);return v?JSON.parse(v):fallback;}catch{return fallback;}};
const CARD_DRAFT_KEY='saho-card-draft-v1',DECK_DRAFT_KEY='saho-deck-draft-v1',LAST_ROOM_KEY='saho-last-room-v1';
const draftSaveTimers=new Map();
function scheduleSave(key,data){clearTimeout(draftSaveTimers.get(key));draftSaveTimers.set(key,setTimeout(()=>{try{storage.setItem(key,JSON.stringify(data));}catch{}},350));}
function saveCardDraft(){if(ui.cardDraft)scheduleSave(CARD_DRAFT_KEY,ui.cardDraft);}
function saveDeckDraft(){if(ui.deckDraft&&!ui.sealedOnly)scheduleSave(DECK_DRAFT_KEY,ui.deckDraft);}
function flushDraft(){for(const t of draftSaveTimers.values())clearTimeout(t);draftSaveTimers.clear();if(ui.cardDraft)storage.setItem(CARD_DRAFT_KEY,JSON.stringify(ui.cardDraft));if(ui.deckDraft&&!ui.sealedOnly)storage.setItem(DECK_DRAFT_KEY,JSON.stringify(ui.deckDraft));}
function clearCardDraft(){clearTimeout(draftSaveTimers.get(CARD_DRAFT_KEY));draftSaveTimers.delete(CARD_DRAFT_KEY);storage.removeItem(CARD_DRAFT_KEY);}
function clearDeckDraft(){clearTimeout(draftSaveTimers.get(DECK_DRAFT_KEY));draftSaveTimers.delete(DECK_DRAFT_KEY);storage.removeItem(DECK_DRAFT_KEY);}
function existingDraft(key){const d=stored(key,null);return d&&typeof d==='object'&&!Array.isArray(d)?d:null;}

let firebaseConfig=null;
let configReady=false;

const storedDecks=readDeckStore(storage);
const selectedStoredDeck=storedDecks.decks.find(d=>d.id===storedDecks.activeId)||storedDecks.decks[0];
// Snapshot key for avoiding repeated localStorage writes and full UI rebuilds
// when Firebase sends an identical card library (including the first snapshot).
let lastCardLibraryJSON='';
const ui={
  nickname:storage.getItem('duel-name')||'プレイヤー',
  counts:{...selectedStoredDeck.counts},
  decks:storedDecks,deckDraft:null,deckFilterType:'all',deckFilterRarity:'all',deckSearch:'',deckOnly:false,
  duelCompact:storage.getItem('duel-compact')!=='0',
  duelOpen:!!new URLSearchParams(location.search).get('room'),draftOpen:!!new URLSearchParams(location.search).get('draft'),draftFormat:'two',settingsOpen:false,
  galleryOpen:false,gallerySelected:null,galleryFilterType:'all',galleryFilterRarity:'all',
  pendingShare:null,shareError:'',
  game:null,roomCode:'',draftRoom:null,draftCode:'',demoDraft:false,seat:0,demo:false,selected:null,targetMode:null,specialDraft:null,deckOpen:false,
  busy:false,sdk:null,db:null,uid:null,unsub:null,cardUnsub:null,toastTimer:null,
  cardsOpen:false,cardDraft:null,cardManageType:'all',cardManageRarity:'all',cardManageQuery:'',customCards:stored('duel-custom-cards',{}),cardBusy:false,adminUnlocked:false,adminBusy:false,
  fxOpen:false,fxSettings:readFxSettings(),lastFxRevision:null,pendingDrawEvent:null,
  rules:readRuleSettings(storage),rulesOpen:false,appearanceOpen:false,appearance:stored('duel-appearance-v5',{mat:'nebula',back:'crest'}),
  packOpen:false,packDraft:null,packResults:null,packs:readPackStore(storage),collectionOnly:false,previewCardId:null,
  sealedOpen:false,sealedOnly:false,sealedSession:normalizeSealedSession(stored(SEALED_STORAGE_KEY,null)),
  duelToolsOpen:false,duelLogOpen:false,
  lastRoom:existingDraft(LAST_ROOM_KEY),networkConnected:null,connectionUnsub:null,cardLibraryReady:false,
};
replaceCustomCards(ui.customCards);
lastCardLibraryJSON=JSON.stringify(ui.customCards);
try{
  const shared=new URLSearchParams(location.search).get('deck');
  if(shared)ui.pendingShare=decodeDeckShare(shared);
}catch(e){ui.shareError=e.message||'共有リンクを読めません';}

const effectTarget=id=>{
 const c=CARD[id];if(!c)return 'none';
 if(c.ability)return c.ability.target;
 if(c.effect==='destroy'||c.monsterEffect?.code==='destroy1')return 'enemyMonster';
 if(c.effect==='boost500')return 'ownMonster';
 return 'none';
};
const manualTarget=t=>['ownMonster','enemyMonster','ownBackrow','enemyBackrow'].includes(t);
const isGraveRevive=id=>CARD[id]?.ability?.operation==='reviveSelected'&&CARD[id]?.ability?.target==='eitherGraveMonster';
const effectNeedsTarget=id=>manualTarget(effectTarget(id));
const targetSpot=t=>({owner:t.startsWith('enemy')?'opponent':'mine',zone:t.endsWith('Backrow')?'backrow':'monsters'});
const cardTypeName=c=>c.type==='monster'?(summonKind(c)!=='normal'?SUMMON_KINDS[summonKind(c)]:'通常')+(c.subtype==='effect'?'・効果モンスター':'モンスター'):c.type==='spell'?SPELL_KINDS[spellKind(c)]:'罠';
const isMine=()=>!!ui.game?.players?.[ui.seat];
const activePlayer=()=>ui.game?.players?.[ui.seat];
const myTurn=()=>ui.game?.turn===ui.seat&&ui.game?.status==='playing';
const inMain=()=>myTurn()&&!ui.game.pending&&['main1','main2'].includes(ui.game.phase);
const suffix=(c)=>c.type==='monster'?`★${c.level}　ATK ${c.atk} / DEF ${c.def}`:cardTypeName(c);
const sum=totalCards;
const activeSavedDeck=()=>ui.decks.decks.find(d=>d.id===ui.decks.activeId)||ui.decks.decks[0];
const missingCards=counts=>Object.keys(counts||{}).filter(id=>!CARD[id]);
function persistDecks(){ui.decks=writeDeckStore(storage,ui.decks);ui.counts={...activeSavedDeck().counts};storage.setItem('duel-deck',JSON.stringify(ui.counts));}
function toast(msg){const el=$('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(ui.toastTimer);ui.toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
function setNetwork(msg,status=''){const el=$('network');if(!el)return;el.title=msg;el.textContent=msg.includes('オンライン接続')?'オンライン':msg.includes('お試し')?'練習中':status==='off'?'オフライン':'準備中';el.className='network '+status;}
function setBusy(v){ui.busy=v;const view=$('view');if(view)view.setAttribute('aria-busy',String(v));}
// Never queue an interactive duel action while RTDB is disconnected, and don't
// resolve a custom card against an incomplete library on a newly joined device.
function onlineReady(){
 if(!ui.sdk||!ui.uid||!ui.db){toast('オンラインの初期化が終わっていません');return false;}
 if(ui.networkConnected!==true){toast('Firebaseへの接続が切れています。接続後にもう一度操作してください');return false;}
 if(!ui.cardLibraryReady){toast('共有カードの読み込み中です。完了後にもう一度操作してください');return false;}
 return true;
}
// Newly created rooms use a four-digit numerical passcode.
// Existing 8-character rooms remain joinable until they are closed.
const makeCode=()=>makeRoomCode();
function btn(label,action,cls='btn',data='',disabled=false){return `<button type="button" class="${cls}" data-action="${action}" ${data} ${disabled?'disabled':''}>${label}</button>`;}
const cardMarkupCache=new WeakMap();
function cardHtml(id,{hidden=false,def=false,card:previewCard=null}={}){
  if(hidden)return '<div class="card back" aria-label="裏側のカード"><div class="back-emblem">✦</div></div>';
  const c=previewCard||CARD[id];if(!c)return '<div class="card back"><div class="back-emblem">✦</div></div>';
  // WeakMap invalidates automatically when the shared card library replaces its objects.
  // Exclude base64 artwork to avoid retaining a second large copy of every uploaded image.
  const cacheable=!previewCard&&!c.image,cacheKey=def?'defense':'face';
  const oldMarkup=cacheable?cardMarkupCache.get(c)?.[cacheKey]:null;
  if(oldMarkup)return oldMarkup;
  const face=c.type==='monster'?(summonKind(c)!=='normal'?summonKind(c)+'-monster':c.subtype==='effect'?'effect-monster':'normal-monster'):c.type;
  const rarity=Object.hasOwn(RARITIES,c.rarity)?c.rarity:'N';
  const category=c.type==='monster'?'MONSTER':c.type==='spell'?'SPELL':'TRAP';
  const categoryLabel=cardTypeName(c);
  const art=c.image?.startsWith('data:image/jpeg;base64,')||c.image?.startsWith('data:image/webp;base64,')
    ?`<img class="card-art-image" src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">`
    :`<div class="card-emoji" aria-hidden="true">${esc(c.emoji||'✦')}</div>`;
  const detail=effectText(c)||c.desc||'';
  const markup=`<div class="card ${esc(face)} rarity-${rarity} ${def?'defense':''}" data-card-kind="${category}" aria-label="${esc(c.name)} ${esc(categoryLabel)}">
    <div class="card-head"><div class="card-name">${esc(c.name)}</div><span class="card-symbol" aria-hidden="true">${c.type==='monster'?'✹':c.type==='spell'?'✦':'✧'}</span></div>
    <span class="card-rarity">${rarity}</span>
    <div class="card-stars" aria-label="${c.type==='monster'?'レベル '+Number(c.level):categoryLabel}">${c.type==='monster'?'★'.repeat(Math.max(1,Math.min(Number(c.level)||1,12))):category}</div>
    <div class="card-art">${art}<span class="sv-art-corner" aria-hidden="true"></span></div>
    <div class="card-lore"><b>${esc(categoryLabel)}</b><span>${esc(detail)}</span></div>
    <div class="card-info">${c.type==='monster'?`<span><span class="sv-stat-label">ATK</span><strong>${Number(c.atk)}</strong></span><span><span class="sv-stat-label">DEF</span><strong>${Number(c.def)}</strong></span>`:`<span>${category}</span><span>SAHOVERSE</span>`}</div>
  </div>`;
  if(cacheable){const cache=cardMarkupCache.get(c)||{};cache[cacheKey]=markup;cardMarkupCache.set(c,cache);}
  return markup;
}

/** Compact image preview: avoids building a full card DOM for every row. */
function cardThumb(c){
  const tone=c.type==='monster'?(summonKind(c)==='fusion'?'fusion':summonKind(c)==='ritual'?'ritual':'monster'):c.type;
  const safeImage=typeof c.image==='string'&&/^data:image\/(?:jpeg|webp);base64,/.test(c.image)&&c.image.length<=90000;
  return `<span class="sv-mini-thumb sv-mini-${tone}" aria-hidden="true">${safeImage
    ?`<img src="${esc(c.image)}" alt="" loading="lazy" decoding="async">`
    :`<span class="sv-mini-mark">${esc(c.emoji||'✦')}</span>`}<i></i></span>`;
}

function renderHome(){
  const linkCode=new URLSearchParams(location.search).get('room')||'';
  return `<section class="sv-home" aria-label="ホーム">
    <div class="sv-hero">
      <img src="./sahoverse-icon-192.png?v=196" width="98" height="98" alt="" class="sv-crest">
      <div class="sv-hero-text"><div class="sv-hero-title">SAHOVERSE</div><div class="sv-hero-sub">CARD DUEL</div></div>
    </div>
    ${btn('<span class="sv-duel-icon" aria-hidden="true">⚔</span><span>デュエル</span><span class="sv-chevron" aria-hidden="true">›</span>','openDuel','sv-duel-button')}
    ${ui.lastRoom?.code?btn('↻ 前回の対戦に戻る','resumeRoom','sv-resume-button'):''}
    <div class="sv-draft-modes">${btn('✦ 2択ドラフト','openDraft','sv-draft-launch')}${btn('◇ 通常ドラフト','openOpenDraft','sv-draft-launch sv-draft-open-launch')}</div>
    ${btn('◇ パック限定戦','openSealed','sv-draft-launch sv-sealed-launch')}
    <div class="sv-home-grid">
      ${btn('<span class="sv-menu-icon" aria-hidden="true">◇</span>カード図鑑','openGallery','sv-menu-tile')}
      ${btn('<span class="sv-menu-icon" aria-hidden="true">✦</span>カード管理','openCards','sv-menu-tile')}
      ${btn('<span class="sv-menu-icon" aria-hidden="true">▱</span>デッキ','editDeck','sv-menu-tile')}
      ${btn('<span class="sv-menu-icon" aria-hidden="true">✧</span>パック','openPacks','sv-menu-tile')}
    </div>
    <div class="sv-home-footer">
      ${btn('ルール','openRules','sv-footer-tile')}
      ${btn('設定','openSettings','sv-footer-tile')}
    </div>
  </section>
  ${ui.duelOpen?`<section class="panel sv-duel-setup" id="duel-setup">
    <div class="row between"><h2>デュエル</h2>${btn('×','closeDuel','btn sm square')}</div>
    <div class="form-duo"><div><label class="field-label" for="playerName">プレイヤー名</label>
    <input class="input" id="playerName" maxlength="12" value="${esc(ui.nickname)}" placeholder="プレイヤー"></div>
    <div><label class="field-label" for="activeDeck">デッキ</label>
    <select class="input" id="activeDeck">${ui.decks.decks.map(d=>`<option value="${esc(d.id)}" ${d.id===ui.decks.activeId?'selected':''}>${esc(d.name)} (${sum(d.counts)}枚)</option>`).join('')}</select></div></div>
    ${missingCards(ui.counts).length?`<div class="notice">未登録のカードがあります。カード共有を確認してください。</div>`:''}
    <h3 class="sv-section-title">オンライン対戦</h3>
    ${configReady?`<div class="stack">${btn('部屋を作る','createRoom','btn primary wide')}
    <div class="row"><input id="roomCode" class="input grow" inputmode="numeric" autocomplete="one-time-code" maxlength="8" value="${esc(linkCode)}" placeholder="部屋の合言葉（数字4桁）" autocapitalize="characters">${btn('参加','joinRoom','btn secondary')}</div></div>`:
    `<div class="notice">オンライン接続の準備ができていません。</div>`}
    <div class="sv-try">${btn('1台で練習','demo','btn secondary wide')}</div>
    ${!storageAvailable?`<div class="notice">端末への保存が制限されています。Safariで開いてください。</div>`:''}
  </section>`:''}
  ${ui.draftOpen?draftSetupModal():''}${ui.sealedOpen?sealedModal():''}
  ${ui.settingsOpen?settingsModal():''}
  ${ui.deckOpen?deckModal():''}${ui.cardsOpen?cardsModal():''}${ui.galleryOpen?galleryModal():''}${ui.fxOpen?fxModal():''}
  ${ui.rulesOpen?ruleModal():''}${ui.appearanceOpen?appearanceModal():''}${ui.packOpen?packModal():''}
  ${ui.pendingShare||ui.shareError?shareImportModal():''}${ui.previewCardId?detailOverlay():''}`;
}
function draftSetupModal(){
 const invite=new URLSearchParams(location.search).get('draft')||'';
 const open=ui.draftFormat==='open',title=open?'通常ドラフト':'2択ドラフト';
 return `<div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-box sv-draft-setup">
 <div class="modal-title-line"><h2>${title}</h2>${btn('×','closeDraft','btn sm square')}</div>
 <div class="draft-brief">${open?'5枚の候補から交互に1枚選ぶ。各40枚でデッキ完成。':'2枚から1枚を選び、残りを相手へ。選ぶ順番は交互。'}</div>
 <div class="draft-probabilities"><span>モンスター 50%</span><span>魔法 25%</span><span>罠 25%</span></div>
 <label class="field-label" for="draftName">プレイヤー名</label><input id="draftName" class="input" maxlength="12" value="${esc(ui.nickname)}">
 <div class="draft-setup-actions">
 <h3>オンライン（iPhone 2台）</h3>
 ${configReady?`${btn('ドラフト部屋を作る','createDraftRoom','btn primary wide')}
 <div class="row"><input class="input grow" id="draftCodeInput" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="部屋の合言葉（数字4桁）" value="${esc(invite)}" autocapitalize="characters">${btn('参加','joinDraftRoom','btn secondary')}</div>`:'<div class="notice">オンライン接続が必要です</div>'}
 <h3>1台で練習</h3>${btn('2人分を交互に選ぶ','draftDemo','btn secondary wide')}
 </div></div></div>`;
}
function renderDraftRoom(){
 const s=ui.draftRoom;if(!s)return '';
 const mine=s.players?.[ui.seat]||null;
 const open=s.draft?.format==='open',max=(s.rules?.deckSize||40)*(open?2:1);
 if(s.status==='waiting')return `<section class="panel draft-waiting"><h2>ドラフト待機中</h2>
 <div class="code">${esc(ui.draftCode)}</div><p class="muted small">数字4桁の合言葉を相手に送ってください。</p>
 ${btn('招待リンクをコピー','copyDraftInvite','btn primary wide')}
 ${btn('ホームへ','goHome','btn ghost wide mt8')}</section>`;
 const d=s.draft,turn=d.round%2,isPicker=ui.demoDraft||turn===ui.seat;
 return `<section class="sv-draft-screen">
 <div class="row between draft-topline"><h2>${open?'通常ドラフト':'2択ドラフト'}</h2>${btn('退出','goHome','btn sm ghost')}</div>
 <div class="draft-progress"><b>${d.round} / ${max}</b><span>${isPicker?'カードを選ぶ番です':`${esc(s.players[turn]?.name||'相手')}の選択待ち`}</span></div>
 <div class="draft-progress-track"><div style="width:${Math.min(100,Math.round(d.round/max*100))}%"></div></div>
 <div class="draft-scoreboard">${s.players.map((p,i)=>`<div class="draft-seat ${turn===i?'draft-active':''}"><span>${esc(p?.name||'プレイヤー')}</span><b>${Object.values(d.counts[i]||{}).reduce((n,v)=>n+Number(v||0),0)}枚</b></div>`).join('')}</div>
 <div class="draft-subtitle">${isPicker?'欲しいカードをタップ':'相手が選んでいます'}</div>
 <div class="draft-offers ${open?'draft-offers-open':''}">${(d.options||[]).map((id,i)=>`<button class="draft-offer" data-action="draftPick" data-index="${i}" ${isPicker?'':'disabled'}>
 <div class="draft-card-art">${cardHtml(id)}</div><b class="draft-card-name">${esc(CARD[id]?.name||id)}</b><span class="draft-card-cost">${esc(CARD[id]?.type==='monster'?'モンスター':CARD[id]?.type==='spell'?'魔法':'罠')}・C${cardCost(CARD[id])}</span>
 <span class="draft-offer-select">${isPicker?'選択する':'待機中'}</span></button>`).join('')}</div>
 <p class="draft-help">${open?'選んだカードだけ自分のデッキに追加されます':'選ばなかったカードは相手に渡ります'}</p>
 ${ui.demoDraft?`<div class="notice">1台練習：選択するプレイヤーが交代します。</div>`:''}
 </section>`;
}
function exportBackup(){
  flushDraft();
  try{
    if(!storageAvailable)throw Error('端末保存が制限されています。Safariから開いてください');
    const data=makeBackup(storage);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    const d=new Date();a.download=`SAHOVERSE-backup-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
    a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('バックアップを保存しました');
  }catch(e){toast('バックアップに失敗しました：'+e.message);}
}
async function importBackup(file){
  if(!file)return;
  if(file.size>8*1024*1024)return toast('8MB以下のバックアップを選んでください');
  try{
    const imported=parseBackup(await file.text());
    if(!confirm('このiPhoneに保存されたデッキ・カード・パック・設定をバックアップの内容に置き換えます。よろしいですか？'))return;
    if(!storageAvailable)throw Error('端末保存が制限されています。Safariから開いてください');
    applyBackup(window.localStorage,imported);
    toast('復元しました。画面を再読み込みします');
    location.href=location.pathname+'?v=197';
  }catch(e){toast('復元できません：'+e.message);}
}
async function reconnectLastRoom(code,fromInvite=false){
  if(!ui.sdk||!ui.db||!ui.uid)return toast('オンライン接続を確認してください');
  if(!isRoomCode(code))return toast('部屋の合言葉を確認してください（数字4桁）');
  try{
    // One-time read: do not create a second permanent listener.
    const snap=await ui.sdk.get(ui.sdk.ref(ui.db,`rooms/${code}`));
    const room=snap.val();
    if(!room)return toast('対戦部屋が見つかりません');
    const people=Array.isArray(room.players)?room.players:[room.players?.[0],room.players?.[1]];
    if(!people.some(p=>p?.uid===ui.uid)){
      // Invitation URLs are also opened by users who are not yet participants.
      // Show the room code in the join form rather than trying to resume their session.
      if(fromInvite){ui.duelOpen=true;render();return;}
      return toast('この端末はその部屋の参加者ではありません');
    }
    ui.duelOpen=false;ui.settingsOpen=false;
    await openRoom(code,!!room.draft&&['waiting','drafting'].includes(room.status));
    toast('対戦部屋に再接続しました');
  }catch(e){toast('再接続に失敗しました：'+e.message);}
}
function settingsModal(){
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="設定"><div class="modal-box sv-settings">
    <div class="modal-title-line"><h2>設定</h2>${btn('×','closeSettings','btn sm square')}</div>
    <div class="sv-settings-options">
      ${btn('カード裏面・プレイマット','settingsAppearance','btn secondary wide')}
      ${btn('演出・音量','settingsFx','btn secondary wide')}
      ${btn('ルール設定','settingsRules','btn secondary wide')}
      <div class="sv-backup-group">
        ${btn('バックアップを保存','exportBackup','btn secondary wide')}
        <label class="btn secondary wide sv-import-label">バックアップから復元<input id="backupFile" type="file" accept=".json,application/json" hidden></label>
        <p class="tiny muted">デッキ・カード・パック・設定を復元。共有カードはFirebase側のデータが優先されます。</p>
      </div>
    </div>
  </div></div>`;
}
function fxModal(){
  const f=ui.fxSettings;
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="演出・音量の設定"><div class="modal-box fx-settings">
    <div class="modal-title-line"><h2>✧ 演出・音量</h2>${btn('×','closeFx','btn sm square')}</div>
    <p class="small muted">iPhoneごとに保存されます。対戦中でも変更できます。</p>
    <label class="fx-check"><input id="fxVisualToggle" type="checkbox" ${f.visuals?'checked':''}> アニメーションを表示</label>
    <label class="fx-check"><input id="fxSoundToggle" type="checkbox" ${f.sound?'checked':''}> 効果音を鳴らす</label>
    <label class="fx-check"><input id="fxBgmToggle" type="checkbox" ${f.bgm?'checked':''}> オリジナルBGMを再生</label>
    <label class="field-label" for="fxVolume">音量 <b id="fxVolumeValue">${f.volume}%</b></label>
    <input id="fxVolume" class="fx-slider" type="range" min="0" max="100" step="5" value="${f.volume}">
    <div class="row wrap mt8">${btn('▶ 炎を試す','previewFlame','btn sm secondary')}${btn('▶ 攻撃を試す','previewSlash','btn sm secondary')}${btn('▶ 罠を試す','previewShadow','btn sm secondary')}${btn('▶ 儀式','previewRitual','btn sm secondary')}${btn('▶ 融合','previewFusion','btn sm secondary')}${btn('▶ 勝利','previewVictory','btn sm secondary')}</div>
    <p class="tiny muted mt8">iPhoneは最初のタップで音声を有効にします。端末の音量設定も確認してください。</p>
    ${btn('閉じる','closeFx','btn primary wide mt8')}
  </div></div>`;
}
/** Show a large full card only on the drawing player's iPhone. */
function revealDrawnCard(room,event){
  if(event?.type!=='draw'||event.actor!==ui.seat||!room?.players?.[ui.seat])return false;
  const hand=room.players[ui.seat].hand||[];
  const id=hand[hand.length-1],card=CARD[id];
  if(!card)return false;
  const overlay=$('draw-reveal');if(!overlay)return false;
  overlay.innerHTML=`<section class="draw-reveal-dialog" role="dialog" aria-modal="true" aria-label="ドローしたカード">
    <div class="draw-reveal-kicker">DRAW</div><h2>ドローしたカード</h2>
    <div class="draw-reveal-card">${cardHtml(id)}</div>
    <div class="draw-reveal-name">${esc(card.name)}</div>
    <div class="draw-reveal-summary">${esc(suffix(card))}</div>
    <button class="btn primary draw-reveal-close" type="button">確認して続ける</button></section>`;
  overlay.classList.add('visible');overlay.setAttribute('aria-hidden','false');
  return true;
}
function closeDrawReveal(){const overlay=$('draw-reveal');if(overlay){overlay.classList.remove('visible');overlay.setAttribute('aria-hidden','true');overlay.replaceChildren();}}
$('draw-reveal')?.addEventListener('click',closeDrawReveal);
function showPendingDraw(room){
  const event=ui.pendingDrawEvent;
  if(event?.actor===ui.seat&&revealDrawnCard(room,event))ui.pendingDrawEvent=null;
}
function announceCue(event,room,previousRoom=null){
  if(!event||!document.getElementById('fx-overlay'))return;
  if(event.type==='draw'){
    ui.pendingDrawEvent=event;
    showPendingDraw(room);
    return;
  }
  // Win/loss display is local to the viewer; no private information is written to Firebase.
  playCue({...event,winner:room?.winner,viewerSeat:ui.seat},CARD[event.cardId],ui.fxSettings);
  playBoardCue(event,room,ui.seat,ui.fxSettings,previousRoom);
}
function handleRoomCue(room,previousRoom=null){
  const ev=room?.lastEvent;
  if(ui.lastFxRevision===null){ui.lastFxRevision=ev?.id??room?.revision??0;if(ev?.type==='draw'&&ev.actor===ui.seat)announceCue(ev,room);return;}
  if(ev&&ev.id>ui.lastFxRevision){ui.lastFxRevision=ev.id;ui.pendingDrawEvent=null;announceCue(ev,room,previousRoom);}
}
function deckPool(){return ui.sealedOnly?ui.sealedSession?.pool||{}:ui.packs.collection;}
function storeSealed(){if(ui.sealedSession)storage.setItem(SEALED_STORAGE_KEY,JSON.stringify(ui.sealedSession));else storage.removeItem(SEALED_STORAGE_KEY);}
function saveSealedDraft(){
  if(!ui.sealedOnly||!ui.sealedSession||!ui.deckDraft)return;
  ui.sealedSession.draftCounts={...ui.deckDraft.counts};
  ui.sealedSession.draftExtraCounts={...ui.deckDraft.extraCounts||{}};
  ui.sealedSession.draftName=($('deckName')?.value||ui.deckDraft.name).slice(0,28);
  storeSealed();
}
function sealedModal(){
  const session=ui.sealedSession;
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="パック限定戦"><div class="modal-box deck-manager">
    <div class="modal-title-line"><h2>パック限定戦</h2>${btn('×','closeSealed','btn sm square')}</div>
    ${session?`<div class="sealed-session"><b>${esc(session.packName)}</b><div class="small muted">${session.packCount}パック・${session.drawn.length}枚獲得 / 使用可能 ${sealedCapacity(session.pool)}枚</div>
      <div class="row wrap mt8">${btn('デッキ構築を続ける','sealedResume','btn primary wide')}</div></div>`:''}
    <label for="sealedPack" class="field-label">開封するパック</label>
    <select class="input" id="sealedPack">${ui.packs.packs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}（${p.size}枚入り）</option>`).join('')}</select>
    <p class="small muted">選んだパックをまとめて開封し、そのカードだけで${ui.rules.deckSize}枚デッキを作ります。</p>
    ${btn(session?'新しいパック戦を始める':'開封してデッキを作る','sealedDraw','btn primary wide')}
    ${btn('戻る','closeSealed','btn ghost wide mt8')}
  </div></div>`;
}
function resumeSealed(){
  if(!ui.sealedSession)return toast('パック戦のデータがありません');
  if(ui.decks.decks.length>=MAX_SAVED_DECKS)return toast('保存できるデッキは最大30組です');
  ui.sealedOpen=false;ui.sealedOnly=true;ui.collectionOnly=true;ui.deckOpen=true;
  ui.deckDraft={...newDeck(ui.sealedSession.draftName,ui.sealedSession.draftCounts,ui.sealedSession.draftExtraCounts),isNew:true};
  ui.deckFilterType='all';ui.deckFilterRarity='all';render();
}
function deckModal(){
  if(!ui.deckDraft)return `<div class="modal" role="dialog" aria-modal="true" aria-label="デッキ管理"><div class="modal-box deck-manager">
    <div class="modal-title-line"><h2>▤ マイデッキ</h2>${btn('×','closeDeck','btn sm square')}</div>
    <p class="tiny muted">このiPhoneに保存・最大${MAX_SAVED_DECKS}組</p>
    ${existingDraft(DECK_DRAFT_KEY)?`<div class="sv-draft-reminder">編集中のデッキがあります ${btn('再開','resumeDeckDraft','btn sm primary')}${btn('破棄','discardDeckDraft','btn sm ghost')}</div>`:''}
    <div class="row wrap mt8">${btn('＋ 空から作る','deckNew','btn primary sm','',ui.decks.decks.length>=MAX_SAVED_DECKS)}${btn('🔥 紅蓮で作る','deckNewRed','btn sm','',ui.decks.decks.length>=MAX_SAVED_DECKS)}${btn('🌊 蒼海で作る','deckNewBlue','btn sm','',ui.decks.decks.length>=MAX_SAVED_DECKS)}</div>
    <div class="deck-saved-list">${ui.decks.decks.map(d=>`<section class="saved-deck ${d.id===ui.decks.activeId?'active':''}">
       <div class="row between"><b>${esc(d.name)}</b><span class="pill">${sum(d.counts)} / ${ui.rules.deckSize}枚 + EX ${sum(d.extraCounts||{})}</span></div>
       <div class="small muted">モンスター ${deckCountType(d.counts,'monster')}・魔法 ${deckCountType(d.counts,'spell')}・罠 ${deckCountType(d.counts,'trap')}・コスト ${deckCost(d.counts,CARD)}${ui.rules.costLimit?'/'+ui.rules.costLimit:''}</div>
       <div class="deck-controls">
         ${btn(d.id===ui.decks.activeId?'✓ 使用中':'使う','deckSelect','btn sm primary',`data-id="${esc(d.id)}"`,d.id===ui.decks.activeId||!validDeck(d.counts,ui.rules,d.extraCounts||{}))}
         ${btn('編集','deckEdit','btn sm',`data-id="${esc(d.id)}"`)}
         ${btn('共有','deckShare','btn sm secondary',`data-id="${esc(d.id)}"`,!validDeck(d.counts,ui.rules,d.extraCounts||{}))}
         ${btn('複製','deckClone','btn sm',`data-id="${esc(d.id)}"`,ui.decks.decks.length>=MAX_SAVED_DECKS)}
         ${btn('削除','deckDelete','btn sm ghost',`data-id="${esc(d.id)}"`,ui.decks.decks.length<=1)}
       </div></section>`).join('')}</div>

  </div></div>`;
  const d=ui.deckDraft,counts=d.counts,extra=d.extraCounts||{};
  const pool=deckPool();
  const usable=validDeck(counts,ui.rules,extra)&&(!ui.collectionOnly||[...Object.entries(counts),...Object.entries(extra)].every(([id,n])=>n<=(pool[id]||0)));
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="デッキを作成・編集"><div class="modal-box deck-manager">
    <div class="modal-title-line"><h2>${ui.sealedOnly?'パック戦':'デッキ編集'}</h2>${btn('×','deckBack','btn sm square')}</div>
    <label for="deckName" class="field-label">デッキ名</label><input id="deckName" class="input" maxlength="28" value="${esc(d.name)}">
    <div class="sv-deck-stats"><span>メイン <b class="deck-total ${usable?'good':''}">${sum(counts)} / ${ui.rules.deckSize}</b></span><span class="sv-deck-types">M ${deckCountType(counts,'monster')} ・ S ${deckCountType(counts,'spell')} ・ T ${deckCountType(counts,'trap')}</span></div>
    <div class="deck-cost-summary">合計コスト <b class="deck-cost-total">${deckCost(counts,CARD)}</b>${ui.rules.costLimit?` / ${ui.rules.costLimit} まで`:'（制限なし）'}</div>
    ${ui.sealedOnly?`<div class="notice">今回の開封分だけで構築（${ui.sealedSession?.drawn.length||0}枚）</div>`:`<label class="fx-check small"><input id="collectionOnly" type="checkbox" ${ui.collectionOnly?'checked':''}> パックで獲得したカードだけでデッキを作る</label>`}
    <div class="row wrap mt8">${ui.sealedOnly?'':`${btn('🔥 紅蓮を読み込む','loadRed','btn sm')}${btn('🌊 蒼海を読み込む','loadBlue','btn sm')}`}${btn('空にする','deckClear','btn sm ghost')}</div>
    <div class="form-duo mt8"><div><label for="deckType" class="field-label">種類</label><select class="input" id="deckType"><option value="all">すべて</option>${['monster','spell','trap'].map(t=>`<option value="${t}" ${ui.deckFilterType===t?'selected':''}>${t==='monster'?'モンスター':t==='spell'?'魔法':'罠'}</option>`).join('')}</select></div>
    <div><label for="deckRarity" class="field-label">レアリティ</label><select class="input" id="deckRarity"><option value="all">すべて</option>${Object.entries(RARITIES).map(([v,n])=>`<option value="${v}" ${ui.deckFilterRarity===v?'selected':''}>${v} ${n}</option>`).join('')}</select></div></div>
    <div class="sv-filter-strip"><input id="deckSearch" class="input" placeholder="カード検索" autocomplete="off" value="${esc(ui.deckSearch)}"><label class="sv-check-chip"><input id="deckOnly" type="checkbox" ${ui.deckOnly?'checked':''}> 収録中</label></div>
    <div class="sv-list-caption"><span id="deckMatchCount"></span><span>− / ＋ で枚数変更</span></div>
    <div class="deck-list mt8">${CARDS.filter(c=>summonKind(c)!=='fusion'&&(!ui.sealedOnly||pool[c.id]>0)).map(c=>`<div class="deck-item" data-cardtype="${esc(c.type)}" data-rarity="${esc(c.rarity||'N')}" data-cardname="${esc(c.name)}" data-cardsearch="${esc(c.name.toLocaleLowerCase('ja'))}">
      ${cardThumb(c)}<div class="grow"><div class="deck-item-title">${esc(c.name)} <span class="rarity-label rarity-text-${esc(c.rarity||'N')}">${esc(c.rarity||'N')}</span></div><div class="deck-item-detail">${esc(suffix(c))} · C${cardCost(c)} ${ui.collectionOnly?'· 所持'+(pool[c.id]||0):''}</div></div>
      ${btn('−','deckMinus','btn sm square',`data-id="${esc(c.id)}" aria-label="${esc(c.name)}を1枚減らす"`,!counts[c.id])}<span class="count">${counts[c.id]||0}</span>
      ${btn('＋','deckPlus','btn sm square',`data-id="${esc(c.id)}" aria-label="${esc(c.name)}を1枚増やす"`,(counts[c.id]||0)>=Math.min(cardLimit(c),ui.collectionOnly?(pool[c.id]||0):3)||sum(counts)>=ui.rules.deckSize)}</div>`).join('')}</div>
    <h3 class="mt8">EXデッキ <span class="pill ex-total">${sum(extra)} / 15</span></h3>
    <div class="small muted">融合モンスターはここに入れます（最大15枚）。</div>
    <div class="deck-list ex-deck-list">${CARDS.filter(c=>summonKind(c)==='fusion'&&(!ui.sealedOnly||pool[c.id]>0)).map(c=>`<div class="deck-item ex-deck-item">
     ${cardThumb(c)}<div class="grow"><b>${esc(c.name)}</b><div class="tiny muted">${esc(suffix(c))}</div></div>
     ${btn('−','extraMinus','btn sm square',`data-id="${esc(c.id)}"`,!extra[c.id])}<span class="ex-count">${extra[c.id]||0}</span>${btn('＋','extraPlus','btn sm square',`data-id="${esc(c.id)}"`,(extra[c.id]||0)>=Math.min(cardLimit(c),ui.collectionOnly?(pool[c.id]||0):3)||sum(extra)>=15)}
    </div>`).join('')}</div>
    <div class="sv-sticky-actions sv-deck-save">
      <div class="sv-save-total">メイン <strong class="sv-save-count">${sum(counts)} / ${ui.rules.deckSize}</strong>　 EX <strong class="sv-save-ex">${sum(extra)} / 15</strong></div>
      ${btn(d.isNew?'デッキを保存':'変更を保存','saveDeck','btn primary wide','',!usable)}
    </div>
  </div></div>`;
}
function deckCountType(counts,type){return Object.entries(counts).reduce((n,[id,count])=>n+(CARD[id]?.type===type?count:0),0);}
function cardDetailContent(c){
 const text=effectText(c)||c.desc||'効果なし';
 const detailFacts=c.type==='monster'
   ?`<div class="sv-detail-stats"><div><span>LEVEL</span><b>★ ${Number(c.level)||0}</b></div><div><span>ATK</span><b>${Number(c.atk)||0}</b></div><div><span>DEF</span><b>${Number(c.def)||0}</b></div></div>`
   :`<div class="sv-detail-stats sv-detail-spell"><div><span>CATEGORY</span><b>${esc(cardTypeName(c))}</b></div><div><span>RARITY</span><b>${esc(c.rarity||'N')}</b></div></div>`;
 return `<div class="sv-detail-layout"><div class="gallery-detail-card card-demo">${cardHtml(c.id)}</div>
  <div class="sv-detail-information"><div class="sv-detail-overline">${esc(cardTypeName(c))} ・ ${esc(RARITIES[c.rarity]||'ノーマル')}</div>
  <h3>${esc(c.name)}</h3>${detailFacts}<div class="sv-detail-copy"><div class="sv-detail-copy-label">${c.type==='monster'?'カードテキスト':'効果・説明'}</div><p>${esc(text)}</p></div>
  <div class="sv-detail-foot">コスト ${cardCost(c)}　・　枚数制限 ${esc(LIMITS[c.limit||'unlimited']?.label||'無制限')}</div></div></div>`;
}
function galleryModal(){
  if(ui.gallerySelected){const c=CARD[ui.gallerySelected];if(!c)ui.gallerySelected=null;
    else return `<div class="modal sv-detail-modal" role="dialog" aria-modal="true" aria-label="${esc(c.name)} の詳細"><div class="modal-box gallery-dialog sv-detail-dialog">
    <div class="modal-title-line"><h2>カード詳細</h2>${btn('×','galleryBack','btn sm square')}</div>
    ${cardDetailContent(c)}${btn('一覧に戻る','galleryBack','btn primary wide sv-detail-close')}</div></div>`;}
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="カード図鑑"><div class="modal-box gallery-dialog">
    <div class="modal-title-line"><h2>◈ カード図鑑 <span class="tiny muted">${CARDS.length}種類</span></h2>${btn('×','closeGallery','btn sm square')}</div>
    <div class="form-duo"><div><label for="galleryType" class="field-label">カード種類</label><select id="galleryType" class="input"><option value="all">すべて</option>${['monster','spell','trap'].map(t=>`<option value="${t}" ${ui.galleryFilterType===t?'selected':''}>${t==='monster'?'モンスター':t==='spell'?'魔法':'罠'}</option>`).join('')}</select></div>
    <div><label for="galleryRarity" class="field-label">レアリティ</label><select id="galleryRarity" class="input"><option value="all">すべて</option>${Object.entries(RARITIES).map(([v,n])=>`<option value="${v}" ${ui.galleryFilterRarity===v?'selected':''}>${v} ${n}</option>`).join('')}</select></div></div>
    <input id="gallerySearch" class="input mt8" placeholder="名前で検索" autocomplete="off">
    <div class="gallery-grid">${CARDS.map(c=>`<button type="button" class="gallery-entry" data-action="galleryDetail" data-id="${esc(c.id)}" data-cardtype="${esc(c.type)}" data-rarity="${esc(c.rarity||'N')}" data-cardname="${esc(c.name)}" data-cardsearch="${esc(c.name.toLocaleLowerCase('ja'))}">
      <div class="gallery-card">${cardHtml(c.id)}</div><span class="gallery-caption">${esc(c.name)}</span><span class="rarity-label rarity-text-${esc(c.rarity||'N')}">${esc(c.rarity||'N')}</span></button>`).join('')}</div>
    <p class="tiny muted">カードをタップすると、画像・効果・能力値を拡大表示できます。</p>
  </div></div>`;
}
function shareImportModal(){
  if(ui.shareError)return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-box"><h2>共有リンクのエラー</h2><p class="small muted">${esc(ui.shareError)}</p>${btn('閉じる','rejectShare','btn primary wide')}</div></div>`;
  const d=ui.pendingShare;if(!d)return '';
  const absent=missingCards(d.counts);
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="共有デッキを取り込む"><div class="modal-box">
    <h2>▤ 共有デッキを取り込む</h2>
    <div class="panel"><b>${esc(d.name)}</b><div class="small muted">${sum(d.counts)}枚・モンスター ${deckCountType(d.counts,'monster')}枚 / 魔法 ${deckCountType(d.counts,'spell')}枚 / 罠 ${deckCountType(d.counts,'trap')}枚</div></div>
    ${absent.length?`<div class="notice">未受信のオリジナルカードが${absent.length}種類あります。Firebase接続でカード図鑑に追加されると使用可能になります。</div>`:''}
    <p class="small muted">このiPhoneに別のデッキとして保存します。元のデッキは上書きしません。禁止制限・枚数設定が合わない場合は編集が必要です。</p>
    ${btn('このデッキを保存','acceptShare','btn primary wide','',ui.decks.decks.length>=MAX_SAVED_DECKS)}
    ${btn('キャンセル','rejectShare','btn ghost wide mt8')}
  </div></div>`;
}
const selectOptions=(choices,selected)=>Object.entries(choices).map(([value,label])=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`).join('');
const MAGIC_EFFECTS={draw2:'カードを2枚ドロー',heal1000:'LPを1000回復',destroy:'相手モンスター1体を破壊',boost500:'自分モンスター1体のATK＋500',burn800:'相手に800ダメージ'};
const TRAP_EFFECTS={negate:'攻撃を無効化',counterdestroy:'攻撃したモンスターを破壊',counterburn:'攻撃無効＋700ダメージ'};
// All abilities are configured in the ordinary card editor. For normal spells,
// show the graveyard-choice operation early without adding a separate creation path.
const availableOperations=(when,card=null)=>{
 const ordinarySpell=card?.type==='spell'&&spellKind(card)==='normal'&&when==='main';
 const options=Object.entries(OPERATIONS).filter(([op])=>
   op==='reviveSelected'&&!ordinarySpell?false:
   when==='continuous'?['boost','weaken','boostDef','weakenDef'].includes(op):
   when==='attack'?op!=='negateEffect':when==='response'?op!=='negateAttack':!['negateAttack','negateEffect'].includes(op));
 if(ordinarySpell){
   const index=options.findIndex(([op])=>op==='reviveSelected');
   if(index>0)options.splice(1,0,...options.splice(index,1));
 }
 return Object.fromEntries(options);
};
function draftEffectFields(d){
 const isEffect=d.type!=='monster'||d.subtype==='effect';if(!isEffect)return '';
 const mode=d.ability?'builder':'preset';
 const kind=spellKind(d);
 const whenChoices=d.type==='trap'?{attack:TRIGGERS.attack,response:TRIGGERS.response}:d.type==='spell'? (
   kind==='equip'?{continuous:TRIGGERS.continuous}:persistentSpell(d)?{main:TRIGGERS.main,continuous:TRIGGERS.continuous}:{main:TRIGGERS.main}):
   {main:TRIGGERS.main,summon:TRIGGERS.summon,continuous:TRIGGERS.continuous};
 const when=whenChoices[d.ability?.when]?d.ability.when:Object.keys(whenChoices)[0];
 const operations=availableOperations(when,d);
 const op=operations[d.ability?.operation]?d.ability.operation:Object.keys(operations)[0];
 const targetsAllowed=abilityTargets(op,when,d.type,kind);
 const targets=Object.fromEntries(targetsAllowed.map(k=>[k,TARGETS[k]]));
 const target=targetsAllowed.includes(d.ability?.target)?d.ability.target:targetsAllowed[0];
 const meta=ABILITY_META[op];
 const numeric=meta.min!==undefined;
 const amount=Number.isSafeInteger(d.ability?.amount)&&
   (!numeric?d.ability.amount===0:d.ability.amount>=meta.min&&d.ability.amount<=meta.max)
     ?d.ability.amount:meta.amount;
 return `<div class="effect-builder"><h3>✦ 効果エディター</h3>
 ${kind==='equip'&&d.type==='spell'?'<p class="small muted">装備魔法：自分・相手のモンスターを選んで強化／弱体化できます。</p>':
 `<label class="field-label" for="cardEffectMode">設定方式</label><select id="cardEffectMode" class="input">${selectOptions({builder:'自由設定（おすすめ）',preset:'かんたん効果プリセット'},mode)}</select>`}
 ${mode==='builder'?`<div class="form-duo"><div><label class="field-label" for="cardAbilityWhen">発動条件</label><select id="cardAbilityWhen" class="input">${selectOptions(whenChoices,when)}</select></div>
 <div><label class="field-label" for="cardAbilityOperation">処理内容（便利な順）</label><select id="cardAbilityOperation" class="input">${selectOptions(operations,op)}</select></div></div>
 <div class="form-duo"><div><label class="field-label" for="cardAbilityTarget">効果を受ける対象</label><select id="cardAbilityTarget" class="input">${selectOptions(targets,target)}</select></div>
 <div><label class="field-label" for="cardAbilityAmount">${numeric?'数値・枚数（直接入力）':'数値（指定不要）'}</label><input id="cardAbilityAmount" class="input" type="number" inputmode="numeric" step="1" min="${numeric?meta.min:0}" max="${numeric?meta.max:0}" value="${amount}" ${numeric?'':'disabled'}></div></div>
 <p class="small muted mt8 sv-effect-preview" aria-live="polite">${esc(abilityText({when,operation:op,target,amount}))}</p>
 ${op==='reviveSelected'?'<div class="sv-operation-help">発動時に自分・相手の墓地からモンスターを1体選びます。自分のモンスターゾーンに空きが必要です。</div>':''}
 <p class="tiny muted">整数を直接入力。自分へのダメージ・相手の回復も可能です。通常の攻守変化はターン終了で戻り、永続効果は継続します。対象がいない効果は不発です。</p>`:
 `<div class="form-duo">${d.type==='monster'?`<div><label class="field-label" for="cardEffectKind">効果タイプ</label><select class="input" id="cardEffectKind">${selectOptions({continuous:'永続',ignition:'起動',trigger:'召喚時'},d.monsterEffect?.kind||'ignition')}</select></div>`:''}
 <div><label class="field-label" for="cardEffectCode">効果</label><select class="input" id="cardEffectCode">${selectOptions(d.type==='monster'?MONSTER_EFFECTS[d.monsterEffect?.kind||'ignition']:d.type==='spell'?MAGIC_EFFECTS:TRAP_EFFECTS,d.type==='monster'?d.monsterEffect?.code:d.effect)}</select></div></div>`}
 <p class="tiny muted mt8">召喚時の単体対象は最初に見つかったカードを自動選択します。永続効果は攻守変更に対応。儀式・融合魔法は専用の効果を使います。</p></div>`;
}
function ruleModal(){const r=ui.rules;
 return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-box"><div class="modal-title-line"><h2>⚙ デュエルルール</h2>${btn('×','closeRules','btn sm square')}</div>
 <p class="small muted">部屋を作る側の設定が対戦に適用されます。設定はこの端末に保存されます。</p>
 <label class="field-label" for="ruleLP">初期LP</label><select class="input" id="ruleLP">${selectOptions({1000:'1000',2000:'2000',4000:'4000',6000:'6000',8000:'8000',10000:'10000',12000:'12000',16000:'16000',20000:'20000'},String(r.lp))}</select>
 <label class="field-label" for="ruleDeck">デッキ枚数</label><select class="input" id="ruleDeck">${selectOptions({20:'20枚',30:'30枚',40:'40枚',50:'50枚',60:'60枚'},String(r.deckSize))}</select>
 <label class="field-label" for="ruleCost">コスト上限</label><select class="input" id="ruleCost">${selectOptions({0:'制限なし',40:'40',50:'50',60:'60',70:'70',80:'80',100:'100',120:'120',150:'150',200:'200',240:'240'},String(r.costLimit||0))}</select>
 <p class="tiny muted">各カードのコスト合計が上限以下のデッキだけ使用できます。</p>
 <p class="small muted mt8">通常ルールは8000LP・40枚。変更した場合、同じ枚数のデッキが必要です。</p>
 ${btn('保存する','saveRules','btn primary wide')}</div></div>`;
}
function appearanceModal(){const x=ui.appearance;
 return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-box"><div class="modal-title-line"><h2>🎨 デザイン設定</h2>${btn('×','closeAppearance','btn sm square')}</div>
 <label class="field-label" for="matChoice">プレイマット</label><select class="input" id="matChoice">${selectOptions({nebula:'星雲',forest:'森',lava:'溶岩',ocean:'深海'},x.mat)}</select>
 <label class="field-label" for="backChoice">カード裏面</label><select class="input" id="backChoice">${selectOptions({crest:'金の紋章',flame:'炎の渦',ice:'蒼の結晶',midnight:'漆黒'},x.back)}</select>
 <p class="small muted">見た目だけを変更します。このiPhoneごとに保存されます。</p>
 ${btn('閉じる','closeAppearance','btn primary wide')}</div></div>`;
}
function packModal(){const st=ui.packs;
 if(ui.packResults)return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-box pack-manager"><div class="modal-title-line"><h2>✦ 開封結果</h2>${btn('×','packBack','btn sm square')}</div>
 <div class="pack-results">${ui.packResults.map(id=>`<button class="gallery-entry" data-action="packDetail" data-id="${esc(id)}"><div class="gallery-card">${cardHtml(id)}</div><span>${esc(CARD[id]?.name||id)}</span></button>`).join('')}</div>
 <p class="small muted mt8">獲得カードはこのiPhoneのコレクションに保存されます。</p>${btn('戻る','packBack','btn primary wide')}</div></div>`;
 if(ui.packDraft){const d=ui.packDraft,ids=new Set(d.ids);return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-box pack-manager"><div class="modal-title-line"><h2>オリジナルパック作成</h2>${btn('×','packEditorBack','btn sm square')}</div>
 <label class="field-label" for="packName">パック名</label><input class="input" id="packName" maxlength="30" value="${esc(d.name)}">
 <label class="field-label" for="packSize">1回で引く枚数</label><select class="input" id="packSize">${selectOptions(Object.fromEntries(Array.from({length:10},(_,i)=>[i+1,`${i+1}枚`])),String(d.size||5))}</select>
 <h3 class="mt8">レアリティ排出比率（重み）</h3><div class="pack-weights">${Object.keys(RARITIES).map(r=>`<label><span>${r}</span><input data-pack-weight="${r}" class="input" type="number" min="0" max="1000" step="0.5" value="${d.weights?.[r]??0}"></label>`).join('')}</div>
 <p class="tiny muted">比率は合計100でなくても構いません。収録していないレアリティは抽選から除外します。</p>
 <h3 class="mt8">収録カード</h3><p class="small muted">何も選ばない場合は全カードが対象です。選択中：${ids.size}種類</p>
 <div class="pack-card-list">${CARDS.map(c=>`<label class="pack-card-row"><input type="checkbox" data-pack-card="${esc(c.id)}" ${ids.has(c.id)?'checked':''}><span class="rarity-label rarity-text-${esc(c.rarity||'N')}">${esc(c.rarity||'N')}</span><span>${esc(c.name)}</span></label>`).join('')}</div>
 ${btn('パックを保存','packSave','btn primary wide mt8')}${btn('キャンセル','packEditorBack','btn ghost wide mt8')}</div></div>`;}
 return `<div class="modal" role="dialog" aria-modal="true"><div class="modal-box pack-manager"><div class="modal-title-line"><h2>🎁 パック開封</h2>${btn('×','closePacks','btn sm square')}</div>
 <div class="small muted">このiPhoneのコレクション：${Object.values(st.collection).reduce((a,b)=>a+b,0)}枚 / ${Object.keys(st.collection).filter(k=>st.collection[k]>0).length}種類。パックは無料・回数制限なしです。</div>
 <div class="deck-saved-list">${st.packs.map(p=>`<div class="saved-deck"><div class="row between"><b>${esc(p.name)}</b><span class="pill">${p.size}枚</span></div><p class="small muted">${p.ids?.length?p.ids.length+'種類を収録':'全カード収録'}</p>
 <div class="row wrap">${btn('開封する','packOpenOne','btn primary sm',`data-id="${esc(p.id)}"`)}${btn('編集','packEdit','btn sm',`data-id="${esc(p.id)}"`)}${p.id!=='starter'?btn('削除','packDelete','btn ghost sm',`data-id="${esc(p.id)}"`):''}</div></div>`).join('')}</div>
 ${btn('＋ 新しいパックを作る','packNew','btn secondary wide','',st.packs.length>=25)}
 <h3 class="mt8">獲得カード</h3><div class="collection-grid">${Object.entries(st.collection).filter(([id,n])=>n>0&&CARD[id]).sort((a,b)=>a[0].localeCompare(b[0])).map(([id,n])=>`<button data-action="packDetail" data-id="${esc(id)}" class="collection-item">${esc(CARD[id].emoji||'✦')} ${esc(CARD[id].name)} ×${n}</button>`).join('')||'<p class="small muted">まだカードを獲得していません。</p>'}</div>
 </div></div>`;
}
function detailOverlay(){const c=CARD[ui.previewCardId];if(!c)return '';
 return `<div class="modal modal-detail sv-detail-modal" role="dialog" aria-modal="true" aria-label="${esc(c.name)} の詳細"><div class="modal-box gallery-dialog sv-detail-dialog">
 <div class="modal-title-line"><h2>カード詳細</h2>${btn('×','closePreview','btn sm square')}</div>
 ${cardDetailContent(c)}${btn('閉じる','closePreview','btn primary wide sv-detail-close')}</div></div>`;
}
function appearanceApply(){const a=$('app');if(a){a.dataset.mat=ui.appearance.mat;a.dataset.back=ui.appearance.back;}}
function persistAppearance(){storage.setItem('duel-appearance-v5',JSON.stringify(ui.appearance));appearanceApply();}
function savePackDraftFields(){const d=ui.packDraft;if(!d)return;d.name=$('packName')?.value||d.name;d.size=Number($('packSize')?.value||d.size);
 document.querySelectorAll('[data-pack-weight]').forEach(x=>d.weights[x.dataset.packWeight]=Math.max(0,Number(x.value)||0));}

function newCardDraft(){
  const random=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,'').slice(0,24):`${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(24,'0').slice(0,24);
  return {id:`u_${random}`,name:'',rarity:'N',limit:'unlimited',cost:2,type:'monster',subtype:'normal',summonKind:'normal',level:4,atk:1500,def:1200,emoji:'✨',desc:'',image:'',fx:{visual:'auto',sound:'auto'},monsterEffect:{kind:'ignition',code:'burn500'}};
}
function cardsModal(){
  if(ui.cardDraft)return editorModal();
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="カード管理"><div class="modal-box card-manager sv-card-manager">
    <div class="modal-title-line"><h2>カード管理</h2>${btn('×','closeCards','btn sm square')}</div>
    <div class="sv-card-admin">${ui.adminUnlocked
      ?`<div class="row between"><span class="sv-admin-status">✓ 編集モード</span>${btn('ロック','lockCards','btn sm ghost','',ui.adminBusy)}</div>`
      :`<div class="row sv-admin-login"><input id="cardAdminPassword" class="input grow" type="password" placeholder="管理パスワード" aria-label="管理パスワード" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64">${btn('解除','unlockCards','btn primary','',!ui.sdk||ui.adminBusy)}</div>`}
    </div>
    ${ui.adminUnlocked&&existingDraft(CARD_DRAFT_KEY)?`<div class="sv-draft-reminder">編集中のカードがあります ${btn('再開','resumeCardDraft','btn sm primary')}${btn('破棄','discardCardDraft','btn sm ghost')}</div>`:''}
    ${btn('＋ カードを作成','newCard','btn primary wide','',!ui.adminUnlocked)}
    <input id="cardSearch" class="input mt8" value="${esc(ui.cardManageQuery)}" placeholder="カード名を検索" autocomplete="off">
    <div class="form-duo mt8"><select id="cardManageType" class="input" aria-label="カードの種類">${selectOptions({all:'すべての種類',monster:'モンスター',spell:'魔法',trap:'罠'},ui.cardManageType)}</select>
    <select id="cardManageRarity" class="input" aria-label="レアリティ">${selectOptions({all:'すべてのレアリティ',...RARITIES},ui.cardManageRarity)}</select></div>
    <div class="sv-list-caption"><span id="cardManageCount"></span><span>編集するカードを選択</span></div>
    <div class="card-manage-list">${CARDS.map(c=>{
       const canEdit=ui.adminUnlocked;
       return `<div class="card-manage-item" data-cardname="${esc(c.name)}" data-cardsearch="${esc(c.name.toLocaleLowerCase('ja'))}" data-cardtype="${esc(c.type)}" data-rarity="${esc(c.rarity||'N')}">
         ${cardThumb(c)}
         <div class="grow"><b>${esc(c.name)}</b><div class="tiny muted"><span class="rarity-label rarity-text-${esc(c.rarity||'N')}">${esc(c.rarity||'N')}</span> ${esc(suffix(c))}</div></div>
         ${btn(canEdit?'編集':'閲覧のみ','editCard','btn sm',`data-id="${esc(c.id)}"`,!canEdit)}
       </div>`}).join('')}</div>
  </div></div>`;
}
function editorModal(){
  const d=ui.cardDraft;
  const isMonster=d.type==='monster';
  const custom=!!ui.customCards[d.id];
  const editable=ui.adminUnlocked;
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="カードを編集"><div class="modal-box card-manager">
    <div class="modal-title-line"><h2>${ORIGINAL_IDS.has(d.id)?'カードを編集':custom?'カードを編集':'カードを作成'}</h2>${btn('×','cardList','btn sm square')}</div>
    <p class="tiny muted sv-autosave-note">入力内容は下書きとして自動保存されます</p>
    <div class="sv-editor-main">
    <div class="editor-preview"><div class="card-demo">${cardHtmlPreview(d)}</div>
      <div class="upload-tools"><label class="btn secondary upload-label">🖼 画像を選ぶ<input id="cardImage" type="file" accept="image/*" hidden></label>
      ${d.image?btn('画像を削除','removeCardImage','btn sm ghost'):''}
</div></div>
    <div class="card-form">
      <label class="field-label" for="cardName">カード名</label><input id="cardName" class="input" maxlength="32" value="${esc(d.name)}" placeholder="例：星影の魔術師">
      <label class="field-label" for="cardRarity">レアリティ</label><select id="cardRarity" class="input">${selectOptions(RARITIES,d.rarity||'N')}</select>
      <div class="form-duo"><div><label class="field-label" for="cardType">種類</label><select class="input" id="cardType">${selectOptions({monster:'モンスター',spell:'魔法',trap:'罠'},d.type)}</select></div>
      ${!isMonster&&d.type==='spell'?`<div><label class="field-label" for="cardSpellKind">魔法の種類</label><select class="input" id="cardSpellKind">${selectOptions(SPELL_KINDS,spellKind(d))}</select></div>`:''}
      ${isMonster?`<div><label class="field-label" for="cardSubtype">モンスター種別</label><select class="input" id="cardSubtype">${selectOptions({normal:'通常',effect:'効果'},d.subtype||'normal')}</select></div>`:''}</div>
      ${isMonster?`<label class="field-label" for="cardSummonKind">召喚方法</label><select id="cardSummonKind" class="input">${selectOptions(SUMMON_KINDS,summonKind(d))}</select>`:''}
      ${isMonster&&summonKind(d)==='fusion'?`<div class="form-duo"><div><label class="field-label">融合素材①</label><select id="fusionMat1" class="input">${selectOptions(Object.fromEntries(CARDS.filter(c=>c.type==='monster'&&summonKind(c)!=='fusion'&&c.id!==d.id).map(c=>[c.id,c.name])),d.fusionMaterials?.[0]||'m03')}</select></div>
      <div><label class="field-label">融合素材②</label><select id="fusionMat2" class="input">${selectOptions(Object.fromEntries(CARDS.filter(c=>c.type==='monster'&&summonKind(c)!=='fusion'&&c.id!==d.id).map(c=>[c.id,c.name])),d.fusionMaterials?.[1]||'m12')}</select></div></div>`:''}
      ${d.type==='spell'&&spellKind(d)==='ritual'?`<label class="field-label" for="ritualFor">対応する儀式モンスター</label><select class="input" id="ritualFor">${selectOptions({ '':'すべての儀式モンスター',...Object.fromEntries(CARDS.filter(c=>summonKind(c)==='ritual').map(c=>[c.id,c.name]))},d.ritualFor||'')}</select>`:''}
      ${isMonster?`<div class="form-trio"><div><label class="field-label" for="cardLevel">レベル</label><input id="cardLevel" class="input" inputmode="numeric" type="number" min="1" max="12" value="${d.level||4}"></div>
          <div><label class="field-label" for="cardAtk">ATK</label><input id="cardAtk" class="input" inputmode="numeric" type="number" min="0" max="5000" value="${d.atk??1500}"></div>
          <div><label class="field-label" for="cardDef">DEF</label><input id="cardDef" class="input" inputmode="numeric" type="number" min="0" max="5000" value="${d.def??1200}"></div></div>`:''}
      ${!(d.type==='spell'&&['ritual','fusion'].includes(spellKind(d)))?draftEffectFields(d):'<p class="tiny muted">召喚効果は自動設定されます。</p>'}
      <details class="sv-advanced-fields"><summary>詳細設定 <span>制限・コスト・説明・演出</span></summary>
      <div class="form-duo"><div><label class="field-label" for="cardLimit">禁止・制限</label><select id="cardLimit" class="input">${selectOptions(Object.fromEntries(Object.entries(LIMITS).map(([v,x])=>[v,x.label])),d.limit||'unlimited')}</select></div>
      <div><label class="field-label" for="cardCost">デッキコスト</label><input id="cardCost" class="input" type="number" inputmode="numeric" min="1" max="20" value="${d.cost??cardCost(d)}"></div></div>
      <label class="field-label" for="cardEmoji">画像がない場合のアイコン</label><input id="cardEmoji" class="input" maxlength="8" value="${esc(d.emoji||'✨')}">
      <label class="field-label" for="cardDesc">フレーバー説明文</label><textarea id="cardDesc" class="input" maxlength="250" rows="2" placeholder="カードの説明を入力">${esc(d.desc||'')}</textarea>
      <div class="fx-card-editor"><h3>✧ このカードの演出・音</h3>
        <div class="form-duo"><div><label class="field-label" for="cardFxVisual">使用時のエフェクト</label><select class="input" id="cardFxVisual">${selectOptions(VISUAL_CHOICES,d.fx?.visual||'auto')}</select></div>
        <div><label class="field-label" for="cardFxSound">使用時の効果音</label><select class="input" id="cardFxSound">${selectOptions(SOUND_CHOICES,d.fx?.sound||'auto')}</select></div></div>
        <div class="row mt8">${btn('▶ この演出を試す','previewCardFx','btn sm secondary')}</div>
      </div>
      </details>
    </div>
    </div>
    <div class="sv-sticky-actions sv-card-save">
      ${btn('カードを保存','saveCard','btn primary wide','',!editable||ui.cardBusy)}
    </div>
    ${custom?btn(ORIGINAL_IDS.has(d.id)?'初期状態に戻す':'このカードを削除','deleteCard','btn ghost danger wide mt8','',!editable):''}
  </div></div>`;
}
function cardHtmlPreview(card){return cardHtml(card.id,{card});}
function readCardForm(){
  const d=ui.cardDraft;if(!d)return;
  const value=(id,fallback='')=>$(id)?.value??fallback;
  d.name=value('cardName',d.name).trim();
  d.rarity=value('cardRarity',d.rarity||'N');d.limit=value('cardLimit',d.limit||'unlimited');d.cost=Number(value('cardCost',d.cost??cardCost(d)));
  d.type=value('cardType',d.type);
  if(d.type==='spell')d.spellKind=value('cardSpellKind',d.spellKind||'normal');else delete d.spellKind;
  if(d.type==='monster'){d.summonKind=value('cardSummonKind',d.summonKind||'normal');if(d.summonKind==='fusion')d.fusionMaterials=[value('fusionMat1',d.fusionMaterials?.[0]||'m03'),value('fusionMat2',d.fusionMaterials?.[1]||'m12')];else delete d.fusionMaterials;}else delete d.summonKind;
  if(d.type==='spell'&&d.spellKind==='ritual')d.ritualFor=value('ritualFor',d.ritualFor||'');else delete d.ritualFor;
  d.emoji=value('cardEmoji',d.emoji).trim()||'✦';
  d.desc=value('cardDesc',d.desc).trim();
  d.fx={visual:value('cardFxVisual',d.fx?.visual||'auto'),sound:value('cardFxSound',d.fx?.sound||'auto')};
  if(d.type==='monster'){
    d.subtype=value('cardSubtype',d.subtype||'normal');
    d.level=Number(value('cardLevel',d.level??4));
    d.atk=Number(value('cardAtk',d.atk??1500));d.def=Number(value('cardDef',d.def??1200));
    if(d.subtype==='effect'){
      const kind=value('cardEffectKind',d.monsterEffect?.kind||'ignition');
      const code=value('cardEffectCode',d.monsterEffect?.code||Object.keys(MONSTER_EFFECTS[kind])[0]);
      d.monsterEffect={kind,code};
    }else delete d.monsterEffect;
    delete d.effect;
  }else{d.effect=d.type==='spell'&&['ritual','fusion'].includes(spellKind(d))?(spellKind(d)==='ritual'?'ritualSummon':'fusionSummon'):value('cardEffectCode',d.effect||'draw2');delete d.monsterEffect;delete d.subtype;}
  const mode=value('cardEffectMode',d.ability?'builder':'preset');
  if(d.type==='spell'&&['ritual','fusion'].includes(spellKind(d))){delete d.ability;}
  else if((d.type!=='monster'||d.subtype==='effect')&&(mode==='builder'||d.type==='spell'&&spellKind(d)==='equip')){
    const when=value('cardAbilityWhen',d.ability?.when|| (d.type==='trap'?'attack':'main'));
    const allowed=availableOperations(when,d);
    const previous=d.ability?.operation;
    const chosen=value('cardAbilityOperation',previous||'draw');
    const operation=Object.hasOwn(allowed,chosen)?chosen:Object.hasOwn(allowed,previous)?previous:Object.keys(allowed)[0];
    const choices=abilityTargets(operation,when,d.type,d.spellKind||'normal');
    const target=value('cardAbilityTarget',d.ability?.target||choices[0]);
    const meta=ABILITY_META[operation];
    const val=Number(value('cardAbilityAmount',d.ability?.amount??meta.amount));
    // Preserve an invalid input until the user fixes it; validation rejects it at save time.
    d.ability={when,operation,target:choices.includes(target)?target:choices[0],amount:meta.min===undefined?0:val};
  }else delete d.ability;
  // This special spell has no unrelated legacy draw effect.
  if(d.type==='spell'&&d.ability?.operation==='reviveSelected')delete d.effect;
  saveCardDraft();
}
async function saveCardFromForm(){
  if(!ui.adminUnlocked||!ui.sdk||!ui.uid)return toast('管理パスワードを解除し、オンラインで保存してください');
  if(ui.cardBusy)return;
  readCardForm();
  const d={...ui.cardDraft,owner:ui.customCards[ui.cardDraft.id]?.owner||ui.uid||'local'};
  if(d.type==='monster'&&d.subtype==='effect'&&!d.ability&&!MONSTER_EFFECTS[d.monsterEffect?.kind]?.[d.monsterEffect?.code])
    d.monsterEffect={kind:d.monsterEffect?.kind||'ignition',code:Object.keys(MONSTER_EFFECTS[d.monsterEffect?.kind||'ignition'])[0]};
  if(!isSafeCustomCard(d))return toast('名前・攻守・効果・画像サイズを確認してください');
  ui.cardBusy=true;
  try{
    await ui.sdk.set(ui.sdk.ref(ui.db,`cardLibrary/cards/${d.id}`),d);
    clearCardDraft();ui.cardDraft=null;render();toast('共有カードを保存しました');
  }catch(e){toast('保存に失敗しました：'+e.message);}
  finally{ui.cardBusy=false;}
}
async function deleteCard(){
  if(!ui.adminUnlocked||!ui.sdk||!ui.uid)return toast('管理パスワードを解除し、オンラインで削除してください');
  const id=ui.cardDraft?.id;
  if(!ui.customCards[id])return;
  if(!confirm(ORIGINAL_IDS.has(id)?'カードを初期状態に戻しますか？':'このカードを削除しますか？ デッキに入れている場合は組み直しが必要です。'))return;
  try{
    await ui.sdk.remove(ui.sdk.ref(ui.db,`cardLibrary/cards/${id}`));
    clearCardDraft();ui.cardDraft=null;render();toast('反映しました');
  }catch(e){toast('削除に失敗しました：'+e.message);}
}
async function compressCardImage(file){
  if(!file.type.startsWith('image/'))throw Error('画像ファイルを選んでください');
  if(file.size>12*1024*1024)throw Error('12MB以下の写真を選んでください');
  const url=URL.createObjectURL(file);
  try{
    const im=new Image();
    await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=()=>reject(Error('画像を開けません'));im.src=url;});
    let size=420,quality=.76,result='';
    for(let tries=0;tries<7;tries++){
      const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('画像処理に失敗しました');
      const side=Math.min(im.naturalWidth,im.naturalHeight),sx=(im.naturalWidth-side)/2,sy=(im.naturalHeight-side)/2;
      ctx.drawImage(im,sx,sy,side,side,0,0,size,size);
      result=canvas.toDataURL('image/jpeg',quality);
      if(result.length<=65000)break;
      size=Math.floor(size*.83);quality=Math.max(.45,quality-.06);
    }
    if(!result.startsWith('data:image/jpeg;base64,')||result.length>90000)throw Error('画像を縮小できませんでした');
    return result;
  }finally{URL.revokeObjectURL(url);}
}

/** Candidate highlighting is presentation-only: the engine still validates every action. */
function targetFlags(owner,zone,index,item){
 const m=ui.targetMode;
 if(!m||zone==='field'||zone==='hand')return {eligible:false,picked:false,empty:false};
 const occupied=!!item;
 if(m.type==='tribute'){
   const eligible=owner==='mine'&&zone==='monsters'&&occupied;
   return {eligible,picked:eligible&&m.indices.includes(index),empty:false};
 }
 if(m.type==='move'){
   const eligible=owner==='mine'&&zone===m.zone&&!occupied;
   return {eligible,picked:false,empty:eligible};
 }
 if(m.type==='attack')return {eligible:owner==='opponent'&&zone==='monsters'&&occupied,picked:false,empty:false};
 if(['spell','quick','monsterEffect','chainTrap'].includes(m.type)){
   const id=m.id||(m.type==='monsterEffect'?activePlayer()?.monsters[m.index]?.id:
     m.type==='chainTrap'?activePlayer()?.backrow[m.index]?.id:null);
   const spot=targetSpot(effectTarget(id));
   return {eligible:owner===spot.owner&&zone===spot.zone&&occupied,picked:false,empty:false};
 }
 return {eligible:false,picked:false,empty:false};
}
function slotBaseLabel(owner,zone,index,occupied){
 return `${owner==='mine'?'自分':'相手'}の${zone==='monsters'?'モンスター':'魔法・罠'}ゾーン${index+1}${occupied?' カードあり':' 空き'}`;
}
/** Target-mode UI refresh does not rebuild 22 board slots or the entire hand. */
function refreshDuelTarget(){
 const view=$('view');
 if(!view?.classList.contains('duel-active')||!ui.game||!view.querySelector('.sv-target-banner')){render();return;}
 view.classList.toggle('sv-is-targeting',!!ui.targetMode&&ui.targetMode.type!=='revive');
 view.querySelector('.sv-target-banner').innerHTML=renderTargetHint();
 for(const node of view.querySelectorAll('.battlefield .slot[data-select]')){
   const owner=node.dataset.owner,zone=node.dataset.zone,index=Number(node.dataset.index);
   const player=ui.game.players[owner==='mine'?ui.seat:1-ui.seat];
   const item=zone==='field'?player?.field:player?.[zone]?.[index];
   const f=targetFlags(owner,zone,index,item);
   node.classList.toggle('sv-target-eligible',f.eligible&&!f.empty);
   node.classList.toggle('sv-target-empty',f.empty);
   node.classList.toggle('sv-target-picked',f.picked);
   node.classList.remove('selected');node.setAttribute('aria-pressed','false');
   if(!node.dataset.baseLabel)node.dataset.baseLabel=node.getAttribute('aria-label')||'';
   node.setAttribute('aria-label',node.dataset.baseLabel+(f.picked?'、リリース対象に選択済み':f.eligible?'、対象として選択できます':''));
 }
 for(const node of view.querySelectorAll('.hand-slot.selected')){node.classList.remove('selected');node.setAttribute('aria-pressed','false');}
 view.querySelector('.duel-card-actions')?.remove();
}
/** Bring the target guide into view on a phone; no game-state writes. */
function startTargetMode(mode){
 ui.targetMode=mode;ui.selected=null;
 if(mode.type==='revive'){render();return;}
 refreshDuelTarget();
 requestAnimationFrame(()=>{
   const banner=$('view')?.querySelector('.sv-target-banner .sv-target-choice');
   if(banner&&ui.targetMode===mode)banner.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 });
}
function slotHtml(player,owner,zone,i){
  const item=player?.[zone]?.[i]||null;
  const hide=owner==='opponent'&&((zone==='backrow'&&item?.faceDown)||item?.pos==='set');
  const selected=ui.selected?.owner===owner&&ui.selected?.zone===zone&&ui.selected?.index===i;
  const occupied=item?.id;
  let marker='';
  if(zone==='monsters'&&occupied&&(!hide||owner==='mine')) {
    const seat=owner==='mine'?ui.seat:1-ui.seat;const attack=effectiveAtk(item,ui.game,seat);const defense=effectiveDef(item,ui.game,seat);
    marker=`<span class="slot-tag">${item.pos==='atk'?'攻'+attack:item.pos==='set'?'裏守':'守'+defense}</span>`;
  }
  const target=targetFlags(owner,zone,i,item);
  const {eligible,picked,empty:emptyTarget}=target;
  const baseLabel=slotBaseLabel(owner,zone,i,occupied);
  const describedLabel=baseLabel+(picked?'、リリース対象に選択済み':eligible?'、対象として選択できます':'');
  return `<button type="button" aria-label="${esc(describedLabel)}" class="slot ${occupied?'':'empty'} ${selected?'selected':''} ${eligible&&!emptyTarget?'sv-target-eligible':''} ${picked?'sv-target-picked':''} ${emptyTarget?'sv-target-empty':''}" data-select="1" data-owner="${owner}" data-zone="${zone}" data-index="${i}" aria-pressed="${!!selected}">
  ${occupied?cardHtml(item.id,{hidden:hide,def:item.pos==='def'}):''}${marker}</button>`;
}
function fieldSlotHtml(player,owner){
 const item=player?.field,hidden=owner==='opponent'&&item?.faceDown;
 const selected=ui.selected?.owner===owner&&ui.selected?.zone==='field';
 return `<button type="button" class="slot field-slot ${item?'':'empty'} ${selected?'selected':''}" data-select="1" data-owner="${owner}" data-zone="field" data-index="0" aria-pressed="${!!selected}" aria-label="${owner==='mine'?'自分':'相手'}のフィールド魔法">
 ${item?cardHtml(item.id,{hidden}):'<span class="sv-empty-field" aria-hidden="true">✦</span>'}</button>`;
}
function playerStatus(p,side){
  const isCurrent=ui.game.turn===side;
  const lp=p?.lp??ui.game?.rules?.lp??8000;
  return `<div class="seat ${side!==ui.seat?'right':''}" data-seat="${side}">
  <div class="avatar">${side===0?'🔥':'🌊'}</div><div><div class="seat-name">${esc(p?.name||'対戦相手')} ${isCurrent?'<span class="turn-chip">手番</span>':''}</div>
  <div class="lp ${lp<=2000?'danger':''}">${Number(lp).toLocaleString('ja-JP')} <span class="tiny">LP</span></div>
  <div class="mini-stats">山札 ${p?.deck?.length??ui.rules.deckSize} / 手札 ${p?.hand?.length??0} / <span class="sv-grave-count">墓地 ${p?.grave?.length??0}</span> / 除外 ${p?.banished?.length??0}</div></div></div>`;
}
function quickChoices(){
 const s=ui.game,p=activePlayer();if(!s||!p)return [];
 const rows=p.backrow.map((x,i)=>({card:x&&CARD[x.id],source:'backrow',index:i,item:x}))
   .filter(x=>x.card?.type==='spell'&&spellKind(x.card)==='quick'&&x.item?.faceDown&&x.item.setTurn<s.turnNo);
 if(s.turn===ui.seat)rows.push(...p.hand.map((id,i)=>({card:CARD[id],source:'hand',index:i}))
   .filter(x=>x.card?.type==='spell'&&spellKind(x.card)==='quick'));
 return rows;
}
function quickChoiceButtons(){return quickChoices().map(x=>btn('⚡ '+esc(x.card.name),'quickResponse','btn sm secondary',`data-source="${x.source}" data-index="${x.index}"`)).join('');}
function renderPending(){
  const s=ui.game;if(!s.pending)return '';
  if(s.pending.kind==='chain'){
    const ch=s.pending,priority=ch.priority===ui.seat;
    const traps=activePlayer().backrow.map((v,i)=>({v,i})).filter(({v})=>v&&v.setTurn<s.turnNo&&CARD[v.id]?.type==='trap'&&
      (CARD[v.id]?.ability?.when==='response'||(ch.afterAttack&&(CARD[v.id]?.ability?.when==='attack'||!CARD[v.id]?.ability))));
    // The chain entries have already been activated and are public. Never list a
    // still-set card that has not entered the chain.
    const links=ch.stack.map((e,i)=>`<span class="sv-chain-step"><span class="sv-chain-index">${i+1}</span><span>${esc(CARD[e.cardId]?.name||'発動したカード')}</span></span>`).join('');
    return `<section class="respond sv-response sv-response--chain ${priority?'sv-response--ready':'sv-response--waiting'}" role="region" aria-label="チェーンへの応答">
      <div class="sv-response-heading"><span class="sv-response-label">CHAIN ${ch.stack.length}</span><strong>${priority?'あなたの応答順です':'相手の応答待ち'}</strong></div>
      <div class="sv-chain-track" aria-label="カードの発動順">${links}</div>
      <p class="sv-response-help">${priority?'罠・速攻魔法を追加するか、パスしてください。':'相手がカードの追加またはパスを選択しています。'}<span> 効果は右端から解決します。</span></p>
      ${priority?`<div class="sv-response-actions row wrap">${traps.map(({v,i})=>btn(esc(CARD[v.id].name),'chainTrap','btn sm secondary',`data-index="${i}"`)).join('')}${quickChoiceButtons()}
      ${btn('チェーンに追加せずパス','chainPass','btn primary sm')}</div>`:''}
      ${ui.demo&&!priority?btn('操作側を交代','switchSeat','btn secondary wide mt8'):''}</section>`;
  }
  const attacking=s.pending.by===ui.seat;
  if(attacking)return `<section class="respond sv-response sv-response--waiting" role="region" aria-label="攻撃への応答">
   <div class="sv-response-heading"><span class="sv-response-label">BATTLE</span><strong>攻撃宣言済み・相手の応答待ち</strong></div>
   <p class="sv-response-help">相手が罠・速攻魔法を使用するか選択しています。</p>
   ${ui.demo?btn('相手側に切り替える','switchSeat','btn secondary wide mt8'):''}</section>`;
  const p=activePlayer();
  const traps=p.backrow.map((v,i)=>({v,i})).filter(({v})=>v&&CARD[v.id]?.type==='trap'&&v.setTurn<s.turnNo&&(CARD[v.id]?.ability?.when==='attack'||!CARD[v.id]?.ability));
  return `<section class="respond sv-response sv-response--ready" role="region" aria-label="攻撃への応答">
    <div class="sv-response-heading"><span class="sv-response-label">BATTLE</span><strong>相手が攻撃！ 応答を選択</strong></div>
    <p class="sv-response-help">使用可能な罠・速攻魔法を発動するか、攻撃を通してください。</p>
    <div class="sv-response-actions row wrap">${traps.map(({v,i})=>btn(`${esc(CARD[v.id].emoji)} ${esc(CARD[v.id].name)}`,'trap','btn sm secondary',`data-index="${i}"`)).join('')}${quickChoiceButtons()||''}
    ${btn('何も発動せず攻撃を通す','passAttack','btn primary sm')}</div></section>`;
}
function renderTargetHint(){
 if(!ui.targetMode)return '';
 const m=ui.targetMode;
 if(m.type==='revive')return '';
 const cancel=btn('キャンセル','cancelTarget','btn sm ghost');
 if(m.type==='tribute')return `<section class="hintbox sv-target-choice" role="status"><div class="sv-target-heading"><span class="sv-target-step">召喚準備</span><strong>リリースする自分のモンスターを選択</strong></div><p class="sv-target-sub">${m.indices.length} / ${m.needed}体選択中。選択済みをもう一度タップすると解除できます。</p><div class="row wrap mt8">${btn('選択して召喚','confirmTributes','btn primary sm','',m.indices.length!==m.needed)}${cancel}</div></section>`;
 if(m.type==='move')return `<section class="hintbox sv-target-choice" role="status"><div class="sv-target-heading"><span class="sv-target-step">位置移動</span><strong>光る空きゾーンをタップ</strong></div><p class="sv-target-sub">移動先のゾーンを選んでください。</p><div class="row mt8">${cancel}</div></section>`;
 const id=m.id||(m.type==='monsterEffect'?activePlayer()?.monsters[m.index]?.id:
   m.type==='chainTrap'?activePlayer()?.backrow[m.index]?.id:null);
 const target=effectTarget(id),attack=m.type==='attack';
 const enemyMonsters=ui.game.players[1-ui.seat].monsters.filter(Boolean).length;
 const spot=targetSpot(target),p=ui.game.players[spot.owner==='mine'?ui.seat:1-ui.seat];
 const candidates=attack?enemyMonsters:p?.[spot.zone]?.filter(Boolean).length||0;
 const title=attack?'⚔ 攻撃対象を選択':`✦ ${TARGETS[target]||'効果対象'}を選択`;
 const explanation=attack?(enemyMonsters?'光っている相手モンスターをタップ':'相手モンスターがいないため直接攻撃できます'):
  (candidates?'光っているカードをタップして効果を発動します':'対象となるカードがありません。キャンセルしてください');
 return `<section class="hintbox sv-target-choice" role="status"><div class="sv-target-heading"><span class="sv-target-step">${attack?'バトル':'効果発動'}</span><strong>${esc(title)}</strong></div><p class="sv-target-sub">${esc(explanation)}</p><div class="row wrap mt8">${attack&&!enemyMonsters?btn('直接攻撃','directAttack','btn primary sm'):''}${cancel}</div></section>`;
}
function renderSelection(){
  const s=ui.game,sel=ui.selected;if(!sel||!isMine())return '';
  const p=s.players[ui.seat],enemy=s.players[1-ui.seat];
  let id=null,item=null;
  if(sel.zone==='hand'){id=p.hand[sel.index];}
  if(sel.zone==='monsters'){
    item=(sel.owner==='mine'?p:enemy).monsters[sel.index];id=item?.id;
  }
  if(sel.zone==='field'){item=(sel.owner==='mine'?p:enemy).field;id=item?.id;}
  if(sel.zone==='backrow'){
    item=(sel.owner==='mine'?p:enemy).backrow[sel.index];id=item?.id;
  }
  if(!id)return '';
  if(sel.owner==='opponent'&&((sel.zone==='backrow'||sel.zone==='field')&&item?.faceDown||item?.pos==='set'))return '<div class="card-detail duel-card-actions"><div class="row between"><b>裏側のカード</b><button class="btn sm ghost" data-action="cancelSelection">閉じる</button></div><div class="small muted">内容はまだわかりません。</div></div>'; 
  const c=CARD[id];if(!c)return '';
  let options='';const canMain=inMain();
  if(sel.owner==='mine'&&sel.zone==='hand'&&myTurn()&&!s.pending&&(canMain||c.type==='spell'&&spellKind(c)==='quick')){
    if(c.type==='monster'&&canMain){
      options=summonKind(c)==='ritual'?btn('儀式召喚','openRitual','btn primary sm'):summonKind(c)==='fusion'?'':btn('攻撃表示で召喚','summonAtk','btn primary sm')+btn('裏側守備でセット','summonSet','btn sm');
    }else if(c.type==='spell'){
      options=btn(['ritual','fusion'].includes(spellKind(c))?(spellKind(c)==='ritual'?'儀式召喚':'融合召喚'):'魔法を発動','spellHand','btn primary sm')+(canMain?btn('伏せてセット','setHand','btn sm'):'');
    }else if(canMain)options=btn('伏せてセット','setHand','btn primary sm');
  }
  if(sel.owner==='mine'&&sel.zone==='hand'&&myTurn()&&s.phase==='end'&&p.hand.length>6)
     options=btn('このカードを捨てる','discard','btn primary sm');
  if(sel.owner==='mine'&&sel.zone==='monsters'&&item){
    if(canMain){
      if(item.pos==='set')options+=btn('反転召喚','flip','btn primary sm');
      else options+=btn('表示形式変更','changePosition','btn sm');
    }
    if(canMain&&item.pos!=='set'&&c.subtype==='effect'&&(c.ability?.when==='main'||c.monsterEffect?.kind==='ignition')&&item.effectUsedTurn!==s.turnNo&&(item.effectLockedUntil||0)<s.turnNo)
      options+=btn('✦ モンスター効果を発動','monsterEffect','btn secondary sm');
    if(myTurn()&&s.phase==='battle'&&!s.pending&&item.pos==='atk'&&!item.attacked&&(item.attackLockedUntil||0)<s.turnNo&&s.turnNo>1)
      options+=btn('このモンスターで攻撃','attackSelect','btn primary sm');
  }
  if(sel.owner==='mine'&&sel.zone==='monsters'&&canMain&&item){options+=btn('位置移動','moveSelected','btn sm')+btn('墓地へ','destroySelected','btn sm ghost')+btn('除外','banishSelected','btn sm ghost');}
  if(sel.owner==='mine'&&(sel.zone==='backrow'||sel.zone==='field')&&item){
    if(c.type==='spell'&&item.faceDown&&myTurn()&&!s.pending&&(canMain||spellKind(c)==='quick'))options=btn(['ritual','fusion'].includes(spellKind(c))?'特殊召喚':'魔法を発動','spellField','btn primary sm');
    if(c.type==='trap'&&s.pending?.kind==='attack'&&s.pending.by!==ui.seat&&item.setTurn<s.turnNo)
      options=btn('罠を発動','trap','btn primary sm',`data-index="${sel.index}"`);
  }
  if(sel.owner==='mine'&&sel.zone==='backrow'&&canMain&&item)options+=btn('位置移動','moveSelected','btn sm')+btn('墓地へ','destroySelected','btn sm ghost')+btn('除外','banishSelected','btn sm ghost');
  if(sel.owner==='mine'&&sel.zone==='field'&&canMain&&item)options+=btn('フィールド魔法を墓地へ','destroySelected','btn sm ghost');
  return `<section class="card-detail duel-card-actions" role="region" aria-label="カード操作"><div class="row between duel-detail-heading"><div class="detail-title">${esc(c.name)}</div><span class="detail-badge">${cardTypeName(c)}</span>${btn('×','cancelSelection','btn sm square ghost')}</div>
   <div class="small muted mt8">${esc(suffix(c))}${item?.bonus?` / 強化+${item.bonus}`:''}</div><p class="detail-text">${esc(effectText(c)||c.desc)}</p>
   <div class="actionbar">${options||'<span class="sv-action-empty">現在実行できる操作はありません</span>'}${btn('🔎 詳細を見る','viewCard','btn secondary sm sv-inspect')}</div></section>`;
}
function renderGame(){
  const s=ui.game;if(!s)return renderHome();
  const roombar=ui.demo?`<div class="rooms">練習モード</div>`:
    `<div class="row between rooms"><span>部屋の合言葉：<b>${esc(ui.roomCode)}</b></span>${btn('招待リンクをコピー','copyInvite','btn sm')}</div>`;
  if(s.status==='waiting')return `${roombar}<section class="hero"><div class="eyebrow">WAITING ROOM</div><h1>対戦相手を待っています</h1>
    <p>数字4桁の合言葉、または招待リンクを相手に送ってください。</p></section><section class="panel"><div class="code">${esc(ui.roomCode)}</div>
    ${btn('招待リンクをコピー','copyInvite','btn primary wide')}
    <p class="small muted center mt8">相手が入室すると自動的に始まります。</p></section>
    ${btn('ホームに戻る','goHome','btn ghost wide')}`;
  const me=s.players[ui.seat],enemy=s.players[1-ui.seat];
  if(!me)return '<div class="notice">この対戦に参加していません。</div>';
  const ready=!!s.pending;
  const myStatus=playerStatus(me,ui.seat),enemyStatus=playerStatus(enemy,1-ui.seat);
  const handNavThreshold=window.innerWidth>=700?7:window.innerWidth>=560?5:window.innerWidth>=370?4:3;
  // A shallow, static fan: numeric CSS variables are cheap to render and do not
  // change card indices, hit handlers, game data or online synchronization.
  const fanMiddle=(me.hand.length-1)/2;
  const fanStrength=Math.min(1,Math.max(0,(me.hand.length-1)/4));
  const hand=me.hand.map((id,i)=>{
    const arc=fanMiddle?(i-fanMiddle)/fanMiddle:0;
    const tilt=(arc*8*fanStrength).toFixed(1);
    const drop=Math.round(Math.pow(Math.abs(arc),1.6)*10*fanStrength);
    return `<button type="button" class="hand-slot ${ui.selected?.zone==='hand'&&ui.selected?.index===i?'selected':''}" style="--sv-fan-angle:${tilt}deg;--sv-fan-drop:${drop}px;--sv-fan-layer:${i+1}" data-select="1" data-owner="mine" data-zone="hand" data-index="${i}" aria-label="手札${i+1} ${esc(CARD[id]?.name||'カード')}" aria-pressed="${!!(ui.selected?.zone==='hand'&&ui.selected?.index===i)}">${cardHtml(id)}</button>`;
  }).join('');
  const phaseButton=!myTurn()||ready||s.status!=='playing'||s.phase==='end'?'':s.phase==='main2'?btn('ターン終了','endTurn','btn primary'):btn(s.phase==='draw'?'メインへ':s.phase==='main1'?(s.turnNo===1?'メイン2へ':'バトルへ'):'メイン2へ','nextPhase','btn primary');
  const endButton=myTurn()&&!ready&&s.status==='playing'&&!['main2','draw','end'].includes(s.phase)?btn('ターン終了','endTurn','btn ghost'):'';
  const handAdjustment=s.phase==='end'&&myTurn()&&me.hand.length>6;
  const winner=s.status==='finished'?`<section class="panel winner">🏆 ${s.winner==='draw'?'引き分け':`${esc(s.players[s.winner].name)} の勝利！`}</section>`:'';
  const layoutButton=btn(ui.duelCompact?'拡大表示':'省スペース','toggleCompact','btn sm ghost duel-layout-button');
  const commandBar=`<div class="duel-commandbar" role="group" aria-label="フェイズ操作"><div class="duel-command-state"><span class="duel-turn">TURN ${s.turnNo}</span><strong>${esc(PHASES[s.phase]||'終了')}</strong><span class="duel-who">${s.status==='finished'?'決着':s.pending?'応答中':myTurn()?'自分のターン':'相手のターン'}</span></div>${phaseButton||endButton?`<div class="duel-command-buttons">${phaseButton}${endButton}</div>`:''}${layoutButton}</div>`;
  const duelHud=ui.duelCompact?`<div class="duel-hud" aria-label="ライフポイントとデッキ残数"><div class="duel-hud-seat"><span class="duel-hud-label">相手</span>${enemyStatus}</div><div class="duel-hud-seat"><span class="duel-hud-label">自分</span>${myStatus}</div></div>`:`<div class="statusbar">${enemyStatus}</div>`;
  return `${roombar}${commandBar}${duelHud}
   ${handAdjustment?`<div class="notice hand-adjust-banner">エンドフェイズ：あと${me.hand.length-6}枚捨ててください ${btn('手札を見る','scrollToHand','btn sm primary')}</div>`:''}
   ${renderPending()}
   <div class="sv-target-banner" aria-live="polite">${renderTargetHint()}</div>
   <div class="battlefield">
     <div class="field-zone-line"><span>相手のフィールド魔法</span>${fieldSlotHtml(enemy,'opponent')}</div><div class="zone-caption">相手の魔法・罠</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(enemy,'opponent','backrow',i)).join('')}</div>
     <div class="zone-caption">相手のモンスター</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(enemy,'opponent','monsters',i)).join('')}</div>
     <div class="field-center duel-center-mark" aria-hidden="true">✦</div>
     <div class="zone-caption">自分のモンスター</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(me,'mine','monsters',i)).join('')}</div>
     <div class="zone-caption">自分の魔法・罠</div>
     <div class="slots">${Array.from({length:5},(_,i)=>slotHtml(me,'mine','backrow',i)).join('')}</div><div class="field-zone-line"><span>自分のフィールド魔法</span>${fieldSlotHtml(me,'mine')}</div>
   </div>
   ${!ui.duelCompact?`<div class="statusbar">${myStatus}<div class="row">${ui.demo?btn('操作側を交代','switchSeat','btn sm secondary'):''}</div></div>`:ui.demo?`<div class="duel-demo-switch">${btn('操作側を交代','switchSeat','btn sm secondary')}</div>`:''}
   ${winner}
   <div class="sv-hand-heading"><div class="hand-count">自分の手札 (${me.hand.length}枚)　${handAdjustment?'・捨てるカードをタップ':!myTurn()?'・相手のターン中':''}</div>
   ${me.hand.length>handNavThreshold?`<div class="sv-hand-controls" role="group" aria-label="手札の送り操作"><span class="sv-hand-position" aria-hidden="true"></span>${btn('‹','handPrev','btn sm ghost sv-hand-nav','aria-label="手札を左へ" title="前のカード"')}${btn('›','handNext','btn sm ghost sv-hand-nav','aria-label="手札を右へ" title="次のカード"')}</div>`:''}</div>
   <div class="hand-scroll ${me.hand.length<=(window.innerWidth<370?3:window.innerWidth<560?4:7)?'sv-hand-balanced':''}" role="region" aria-label="自分の手札。左右にスクロールできます" tabindex="0">${hand||'<div class="muted small">手札がありません</div>'}</div>
   ${renderSelection()}
   <details class="panel duel-tools" ${ui.duelToolsOpen?'open':''}><summary>その他の操作</summary><div class="row wrap battle-tools">
     ${btn('🎲 サイコロ','rollDice','btn sm secondary')}${btn('🪙 コイン','flipCoin','btn sm secondary')}
     ${myTurn()&&!ready&&['main1','main2'].includes(s.phase)?btn('山札を混ぜる','shuffleDeck','btn sm'):''}
     ${ui.demo?btn('↶ 1操作戻す','undoDemo','btn sm ghost','',!s.undoSnapshot):
       (s.undoRequest!==null&&s.undoRequest!==undefined&&s.undoRequest!==ui.seat?
        btn('取り消し承認','approveUndo','btn sm primary')+btn('拒否','rejectUndo','btn sm ghost'):
       btn(s.undoRequest===ui.seat?'承認待ち':'↶ 取り消しを依頼','requestUndo','btn sm ghost','',!s.undoSnapshot||s.undoActor!==ui.seat||s.undoRequest!==null&&s.undoRequest!==undefined))}
     ${myTurn()&&!ready&&['main1','main2'].includes(s.phase)&&me.extraDeck?.length?btn(`✦ EXデッキ (${me.extraDeck.length})`,'openFusion','btn sm primary'):''}
     ${btn('🎨 デザイン','openAppearance','btn sm')}${btn('墓地・除外','showGrave','btn sm secondary')}
   </div>${s.lastRandom?`<div class="notice mt8">${esc(s.lastRandom)}</div>`:''}
   </details>
   <details class="panel duel-log" ${ui.duelLogOpen?'open':''}><summary>対戦ログ (${s.log.length})</summary><div class="loglist">${s.log.map(x=>`<div>• ${esc(x)}</div>`).join('')}</div></details>
   <div class="footer-links">${s.status==='playing'?btn('降参する','surrender','btn ghost sm'):''}${btn('🔊 演出設定','openFx','btn ghost sm')}${btn('ホームへ','goHome','btn ghost sm')}</div>
   ${ui.graveOpen?graveModal():''}${ui.fxOpen?fxModal():''}${ui.appearanceOpen?appearanceModal():''}${ui.previewCardId?detailOverlay():''}${ui.specialDraft?specialModal():''}${ui.targetMode?.type==='revive'?graveReviveModal():''}`;
}
/** Move only the existing hand scroller. No board rebuild or game-state writes. */
function scrollHandCards(direction){
 const strip=$('view')?.querySelector('.hand-scroll');
 const first=strip?.querySelector('.hand-slot');
 if(!strip||!first)return;
 // With overlapping cards, the advance is the *layout* distance, not
 // the card's full bounding width (which includes its visual rotation).
 const second=first.nextElementSibling;
 const pitch=second?.classList.contains('hand-slot')?
   Math.max(36,second.offsetLeft-first.offsetLeft):first.offsetWidth;
 const perPage=Math.max(1,Math.floor((strip.clientWidth-28)/pitch)-1);
 const distance=pitch*perPage*direction;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 strip.scrollBy({left:distance,behavior:reduced?'auto':'smooth'});
}
/** Synchronize just two arrows and one tiny counter. No rerender, no game writes. */
function syncHandNavigation(){
 const view=$('view'),strip=view?.querySelector('.hand-scroll'),controls=view?.querySelector('.sv-hand-controls');
 if(!strip||!controls)return;
 const max=Math.max(0,strip.scrollWidth-strip.clientWidth),overflow=max>1;
 controls.style.display=overflow?'':'none';
 if(!overflow)return;
 const prev=controls.querySelector('[data-action="handPrev"]');
 const next=controls.querySelector('[data-action="handNext"]');
 if(prev)prev.disabled=strip.scrollLeft<=2;
 if(next)next.disabled=strip.scrollLeft>=max-2;
 // offsetLeft is already the overlapping layout coordinate; no rotation measurements.
 const items=strip.querySelectorAll('.hand-slot');
 let start=-1,end=-1;
 const left=strip.scrollLeft+12,right=strip.scrollLeft+strip.clientWidth-12;
 for(let i=0;i<items.length;i++){
   const el=items[i];
   if(el.offsetLeft+el.offsetWidth>left&&el.offsetLeft<right){if(start<0)start=i;end=i;}
 }
 const label=controls.querySelector('.sv-hand-position');
 if(label)label.textContent=start>=0?`${start+1}–${end+1} / ${items.length}`:`${items.length}枚`;
}
let handNavFrame=0;
function scheduleHandNavigation(){
 if(handNavFrame)return;
 handNavFrame=requestAnimationFrame(()=>{handNavFrame=0;syncHandNavigation();});
}
window.addEventListener('resize',scheduleHandNavigation,{passive:true});
// Scroll events do not bubble, so delegate in capture phase. At most one update per frame.
$('view').addEventListener('scroll',event=>{
 if(event.target?.classList?.contains('hand-scroll'))scheduleHandNavigation();
},{capture:true,passive:true});
/** Reveal only a clipped portion. Never scroll the page vertically. */
function revealHandCard(index){
 const strip=$('view')?.querySelector('.hand-scroll');
 const el=strip?.querySelector(`.hand-slot[data-index="${index}"]`);
 if(!el)return;
 const margin=18,left=strip.scrollLeft+margin,right=strip.scrollLeft+strip.clientWidth-margin;
 const start=el.offsetLeft,end=start+el.offsetWidth;
 const correction=start<left?start-left:end>right?end-right:0;
 if(Math.abs(correction)>1){strip.scrollLeft+=correction;scheduleHandNavigation();}
}
// Arrow keys focus adjacent fanned cards; Enter/Space still use normal card selection.
$('view').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const current=event.target?.closest?.('.hand-scroll>.hand-slot');
 if(!current)return;
 const list=Array.from(current.parentElement.querySelectorAll('.hand-slot'));
 const at=list.indexOf(current);if(at<0)return;
 event.preventDefault();
 const nextIndex=event.key==='Home'?0:event.key==='End'?list.length-1:
   Math.min(list.length-1,Math.max(0,at+(event.key==='ArrowLeft'?-1:1)));
 const next=list[nextIndex];if(!next)return;
 next.focus({preventScroll:true});revealHandCard(nextIndex);
});
/** Update only the selected-card drawer; the field and hand are untouched. */
function refreshDuelSelection(){
 const view=$('view');
 if(!view?.classList.contains('duel-active')||ui.targetMode||!ui.game||typeof document.createElement!=='function'){render();return;}
 for(const node of view.querySelectorAll('.slot.selected,.hand-slot.selected')){node.classList.remove('selected');node.setAttribute('aria-pressed','false');}
 const selected=ui.selected;
 if(selected){
   const node=Array.from(view.querySelectorAll('[data-select]')).find(x=>
     x.dataset.owner===selected.owner&&x.dataset.zone===selected.zone&&Number(x.dataset.index)===selected.index);
   if(node){node.classList.add('selected');node.setAttribute('aria-pressed','true');}
 }
 const old=view.querySelector('.duel-card-actions');
 const html=renderSelection();
 if(!html){old?.remove();return;}
 const template=document.createElement('template');template.innerHTML=html.trim();
 const next=template.content.firstElementChild;
 if(!next){old?.remove();return;}
 if(old)old.replaceWith(next);
 else {const hand=view.querySelector('.hand-scroll');if(hand)hand.after(next);else view.append(next);}
 if(selected?.owner==='mine'&&selected.zone==='hand')revealHandCard(selected.index);
}
function graveModal(){const me=activePlayer(),enemy=ui.game.players[1-ui.seat];
 const view=(p,side)=>`<h3>${side}：墓地 (${p.grave.length})</h3><div class="grave-list">${p.grave.map((id,i)=>`<button class="grave-chip" data-action="graveDetail" data-id="${esc(id)}">${esc(CARD[id]?.name||id)}</button>`).join('')||'なし'}</div>
 <h3>${side}：除外 (${p.banished?.length||0})</h3><div class="grave-list">${(p.banished||[]).map(id=>`<button class="grave-chip" data-action="graveDetail" data-id="${esc(id)}">${esc(CARD[id]?.name||id)}</button>`).join('')||'なし'}</div>`;
 return `<div class="modal"><div class="modal-box"><div class="modal-title-line"><h2>墓地・除外ゾーン</h2>${btn('×','closeGrave','btn sm square')}</div>
 ${view(me,'自分')}${myTurn()&&!ui.game.pending&&['main1','main2'].includes(ui.game.phase)&&me.grave.length?btn('墓地のカードを除外する','banishFromGrave','btn sm secondary mt8'):''}
 <hr class="soft-divider">${view(enemy,'相手')}</div></div>`;
}
function render(){
 const view=$('view');
 const mode=!!ui.game||!!ui.draftRoom,changed=ui.renderedMode!==mode;
 const wasGame=!!view.classList.contains('duel-active');
 const oldY=wasGame?window.scrollY:0;
 const handX=wasGame?(view.querySelector('.hand-scroll')?.scrollLeft||0):0;
 const logY=wasGame?(view.querySelector('.loglist')?.scrollTop||0):0;
 const modalY=wasGame?(view.querySelector('.modal-box')?.scrollTop||0):0;
 // Mobile form controls can trigger a full editor redraw. Keep the editing position;
 // do not inherit the card-list scroll position when opening a *new* editor.
 const editorY=ui.cardDraft&&view.querySelector('#cardName')?view.querySelector('.card-manager')?.scrollTop:null;
 if(wasGame){
   ui.duelToolsOpen=view.querySelector('.duel-tools')?.open??ui.duelToolsOpen;
   ui.duelLogOpen=view.querySelector('.duel-log')?.open??ui.duelLogOpen;
 }
 ui.renderedMode=mode;
 view.classList.toggle('duel-active',!!ui.game&&ui.game.status!=='waiting');
 view.classList.toggle('duel-compact',!!ui.game&&ui.game.status!=='waiting'&&ui.duelCompact);
 view.classList.toggle('sv-is-targeting',!!ui.game&&ui.game.status!=='waiting'&&!!ui.targetMode&&ui.targetMode.type!=='revive');
 view.innerHTML=ui.draftRoom?renderDraftRoom():ui.game?renderGame():ui.roomCode?`<section class="panel"><h2>部屋の情報を読み込み中</h2><p class="small muted">接続状態を確認しています。</p>${btn('ホームに戻る','goHome','btn secondary')}</section>`:renderHome();
 // Apply saved filters only when their list is present.
 if($('deckSearch'))updateCardRows('deck');
 if($('cardSearch'))updateManagedCards();
 if(editorY!==null&&editorY!==undefined){const editor=view.querySelector('.card-manager');if(editor)editor.scrollTop=editorY;}
 appearanceApply();
 if(changed){try{window.scrollTo(0,0);}catch{}}
 else if(wasGame&&ui.game){
   // Preserve the user's position when a selection or online action redraws the field.
   const hand=view.querySelector('.hand-scroll');if(hand)hand.scrollLeft=handX;
   const log=view.querySelector('.loglist');if(log)log.scrollTop=logY;
   const modal=view.querySelector('.modal-box');if(modal)modal.scrollTop=modalY;
   if(Math.abs(window.scrollY-oldY)>2)try{window.scrollTo(0,oldY);}catch{}
 }
 if(ui.game)syncHandNavigation();
}
function readHomeValues(){
 const input=$('playerName');if(input){ui.nickname=(input.value.trim()||'プレイヤー').slice(0,12);storage.setItem('duel-name',ui.nickname);}
}
function startDeckDraft(mode,source){
  if(mode==='new'&&ui.decks.decks.length>=MAX_SAVED_DECKS)return toast('保存できるデッキは最大30組です');
  const base=source||activeSavedDeck();
  ui.deckDraft=mode==='new'?{...newDeck('新しいデッキ',{}),isNew:true}:{...base,counts:{...base.counts},extraCounts:{...base.extraCounts||{}},isNew:false};
  ui.deckFilterType='all';ui.deckFilterRarity='all';saveDeckDraft();render();
}
function saveDeck(){
  const d=ui.deckDraft;if(!d||!validDeck(d.counts,ui.rules,d.extraCounts||{}))return toast(`${ui.rules.deckSize}枚・禁止制限を守ってください`);
  if(ui.collectionOnly&&[...Object.entries(d.counts),...Object.entries(d.extraCounts||{})].some(([id,n])=>n>(deckPool()[id]||0)))return toast('所持カード枚数を超えています');
  const name=($('deckName')?.value||d.name).trim().slice(0,28)||'名前のないデッキ';
  const result={id:d.id,name,counts:{...d.counts},extraCounts:{...d.extraCounts||{}},updatedAt:Date.now()};
  if(d.isNew){if(ui.decks.decks.length>=MAX_SAVED_DECKS)return toast('保存数の上限です');ui.decks.decks.push(result);}
  else{const i=ui.decks.decks.findIndex(x=>x.id===d.id);if(i<0)return toast('デッキがありません');ui.decks.decks[i]=result;}
  ui.decks.activeId=result.id;persistDecks();const fromSealed=ui.sealedOnly;clearDeckDraft();ui.deckDraft=null;if(fromSealed){ui.sealedOnly=false;ui.collectionOnly=false;ui.deckOpen=false;ui.sealedOpen=false;ui.duelOpen=true;ui.sealedSession=null;storeSealed();}render();toast('「'+name+'」を保存しました');if(fromSealed)requestAnimationFrame(()=>document.getElementById('duel-setup')?.scrollIntoView({block:'start',behavior:'smooth'}));
}
function selectDeck(id){
 const d=ui.decks.decks.find(x=>x.id===id);if(!d)return;
 if(!validDeck(d.counts,ui.rules,d.extraCounts||{}))return toast(`${ui.rules.deckSize}枚・禁止制限を守る必要があります`);
 ui.decks.activeId=id;persistDecks();render();toast('対戦用デッキを切り替えました');
}
async function shareDeck(id){
 const d=ui.decks.decks.find(x=>x.id===id);if(!d)return;
 let url;try{url=`${location.origin}${location.pathname}?deck=${encodeDeckShare(d)}`;}catch(e){return toast(e.message);}
 if(navigator.share){
   try{await navigator.share({title:`SAHOVERSE：${d.name}`,text:'このデッキを取り込む',url});return;}
   catch(e){if(e.name==='AbortError')return;}
 }
 try{await navigator.clipboard.writeText(url);toast('デッキ共有リンクをコピーしました');}
 catch{prompt('リンクをコピーして送ってください',url);}
}
function closeShare(){ui.pendingShare=null;ui.shareError='';try{const u=new URL(location.href);u.searchParams.delete('deck');history.replaceState({},'',u.pathname+u.search+u.hash);}catch{}render();}
function addImportedDeck(){
 if(!ui.pendingShare)return;if(ui.decks.decks.length>=MAX_SAVED_DECKS)return toast('デッキ保存数の上限です');
 const deck=newDeck(ui.pendingShare.name+'（共有）',ui.pendingShare.counts,ui.pendingShare.extraCounts||{});
 ui.decks.decks.push(deck);ui.decks.activeId=deck.id;persistDecks();closeShare();toast('共有デッキを保存しました');
}
/** Update only deck counts/buttons; keep search, scroll and keyboard focus intact. */
function refreshDeckEditor(){
  if(!ui.deckDraft)return;
  const counts=ui.deckDraft.counts,total=sum(counts);
  const valid=validDeck(counts,ui.rules,ui.deckDraft.extraCounts||{})&&(!ui.collectionOnly||
    [...Object.entries(counts),...Object.entries(ui.deckDraft.extraCounts||{})].every(([id,n])=>n<=(deckPool()[id]||0)));
  const counter=document.querySelector('.deck-total');
  if(counter){counter.textContent=`${total} / ${ui.rules.deckSize}`;counter.classList.toggle('good',valid);}
  const save=document.querySelector('[data-action="saveDeck"]');if(save)save.disabled=!valid;
  const cost=document.querySelector('.deck-cost-total');if(cost)cost.textContent=String(deckCost(counts,CARD));
  const saveCount=document.querySelector('.sv-save-count');if(saveCount)saveCount.textContent=`${total} / ${ui.rules.deckSize}`;
  const typeTotals=document.querySelector('.sv-deck-types');if(typeTotals)typeTotals.textContent=`M ${deckCountType(counts,'monster')} ・ S ${deckCountType(counts,'spell')} ・ T ${deckCountType(counts,'trap')}`;
  const extra=ui.deckDraft.extraCounts||{},countExtra=sum(extra);
  const exTotal=document.querySelector('.ex-total');if(exTotal)exTotal.textContent=`${countExtra} / 15`;
  const exSave=document.querySelector('.sv-save-ex');if(exSave)exSave.textContent=`${countExtra} / 15`;
  for(const row of document.querySelectorAll('.ex-deck-item')){const add=row.querySelector('[data-action="extraPlus"]'),minus=row.querySelector('[data-action="extraMinus"]'),qty=row.querySelector('.ex-count');if(!add)continue;const n=extra[add.dataset.id]||0;if(qty)qty.textContent=String(n);if(minus)minus.disabled=n<1;add.disabled=n>=Math.min(cardLimit(CARD[add.dataset.id]),ui.collectionOnly?(deckPool()[add.dataset.id]||0):3)||countExtra>=15;}
  for(const row of document.querySelectorAll('.deck-item:not(.ex-deck-item)')){
    const add=row.querySelector('[data-action="deckPlus"]');if(!add)continue;
    const id=add.dataset.id,c=CARD[id],count=counts[id]||0;
    const minus=row.querySelector('[data-action="deckMinus"]');
    const qty=row.querySelector('.count');if(qty)qty.textContent=String(count);
    if(minus)minus.disabled=count<=0;
    add.disabled=!c||count>=Math.min(cardLimit(c),ui.collectionOnly?(deckPool()[id]||0):3)||total>=ui.rules.deckSize;
  }
  // Quantity changes only affect visibility when the "in deck" filter is active.
  // Otherwise search, type and rarity results stay unchanged; do not rescan the list.
  if(ui.deckOnly)updateCardRows('deck');
}
function updateCardRows(scope){
 const gallery=scope==='gallery';const type=gallery?ui.galleryFilterType:ui.deckFilterType;
 const rarity=gallery?ui.galleryFilterRarity:ui.deckFilterRarity;
 const search=($(gallery?'gallerySearch':'deckSearch')?.value||'').trim().toLocaleLowerCase('ja');
 if(!gallery)ui.deckSearch=$('deckSearch')?.value||'';
 let matches=0;
 for(const row of document.querySelectorAll(gallery?'.gallery-entry':'.deck-item:not(.ex-deck-item)')){
   const qty=gallery?0:(ui.deckDraft?.counts?.[row.querySelector('[data-action="deckPlus"]')?.dataset.id]||0);
   row.hidden=(type!=='all'&&row.dataset.cardtype!==type)||(rarity!=='all'&&row.dataset.rarity!==rarity)||!(row.dataset.cardsearch||row.dataset.cardname.toLocaleLowerCase('ja')).includes(search)||(!gallery&&ui.deckOnly&&qty===0);
   if(!row.hidden)matches++;
 }
 if(!gallery){const out=$('deckMatchCount');if(out)out.textContent=`${matches}種類を表示`;}
}
function updateManagedCards(){
 const q=($('cardSearch')?.value||'').trim().toLocaleLowerCase('ja');
 ui.cardManageQuery=$('cardSearch')?.value||'';
 let matches=0;
 for(const row of document.querySelectorAll('.card-manage-item')){
   row.hidden=(!(row.dataset.cardsearch||row.dataset.cardname.toLocaleLowerCase('ja')).includes(q))||(ui.cardManageType!=='all'&&row.dataset.cardtype!==ui.cardManageType)||(ui.cardManageRarity!=='all'&&row.dataset.rarity!==ui.cardManageRarity);
   if(!row.hidden)matches++;
 }
 const out=$('cardManageCount');if(out)out.textContent=`${matches} / ${CARDS.length}種類`;
}
function readDraftName(){
 const value=$('draftName')?.value||ui.nickname;
 ui.nickname=(value.trim()||'プレイヤー').slice(0,12);
 storage.setItem('duel-name',ui.nickname);
}
function saveCompletedDrafts(room,code,local=false){
 if(!room?.completedDraft)return;
 const marker='duel-draft-saved-'+(local?code:code+'-'+ui.uid);
 if(storage.getItem(marker))return;
 const seats=local?[0,1]:[ui.seat];
 let added=0;
 for(const seat of seats){
   const counts=room.completedDraft.counts?.[seat];
   if(!counts||ui.decks.decks.length>=MAX_SAVED_DECKS)continue;
   const name=`${room.completedDraft.format==='open'?'通常':'2択'}ドラフト・${room.completedDraft.players?.[seat]?.name||seat+1}`;
   const deck=newDeck(name,counts);
   ui.decks.decks.push(deck);ui.decks.activeId=deck.id;added++;
 }
 if(added){persistDecks();toast('ドラフトデッキを保存しました');}
 storage.setItem(marker,'1');
}
function startLocalDraft(){
 readDraftName();
 try{
   let room=createDraftRoom({uid:'local-draft-a',name:'プレイヤー1',rules:ui.rules,format:ui.draftFormat});
   room=joinDraftRoom(room,{uid:'local-draft-b',name:'プレイヤー2'});
   ui.demoDraft=true;ui.demo=false;ui.draftCode='LOCAL';ui.roomCode='';ui.game=null;ui.draftRoom=room;ui.seat=0;ui.draftOpen=false;
   render();window.scrollTo(0,0);
 }catch(e){toast(e.message);}
}
async function createOnlineDraft(){
 if(ui.busy)return;
 if(!onlineReady())return;readDraftName();setBusy(true);
 try{
   for(let attempt=0;attempt<24;attempt++){
     const code=makeCode(),r=ui.sdk.ref(ui.db,'rooms/'+code);
     const result=await ui.sdk.runTransaction(r,old=>old?undefined:createDraftRoom({uid:ui.uid,name:ui.nickname,rules:ui.rules,format:ui.draftFormat}),{applyLocally:false});
     if(result.committed){ui.draftOpen=false;await openRoom(code,true);return;}
   }
   throw Error('4桁の合言葉を発行できませんでした');
 }catch(e){toast('ドラフト作成エラー：'+e.message);}finally{setBusy(false);}
}
async function joinOnlineDraft(){
 if(ui.busy)return;
 if(!onlineReady())return;readDraftName();
 const code=normalizeRoomCode($('draftCodeInput')?.value||'');
 if(!isRoomCode(code))return toast('数字4桁の合言葉を入力してください（旧8文字コードも使用可）');
 setBusy(true);let problem='ドラフトが見つかりません';
 try{
   const r=ui.sdk.ref(ui.db,'rooms/'+code);
   const initial=(await ui.sdk.get(r)).val();
   if(!initial)throw Error('ドラフト部屋が見つかりません。コードを確認してください');
   const guests=Array.isArray(initial.players)?initial.players:[initial.players?.[0],initial.players?.[1]];
   if(guests.some(p=>p?.uid===ui.uid)){ui.draftOpen=false;await openRoom(code,true);return;}
   if(initial.status!=='waiting'||guests[1])throw Error('ドラフト部屋はすでに開始済みか満室です');
   const result=await ui.sdk.runTransaction(r,old=>{
     // The first invocation can be null on an uncached second device.
     const current=old??initial;
     if(!current){problem='部屋が見つかりません';return;}
     const players=Array.isArray(current.players)?current.players:[current.players?.[0],current.players?.[1]];
     if(players.some(p=>p?.uid===ui.uid))return current;
     if(current.status!=='waiting'||players[1]){problem='ドラフト部屋はすでに開始済みか満室です';return;}
     try{return joinDraftRoom(current,{uid:ui.uid,name:ui.nickname});}catch(e){problem=e.message;return;}
   },{applyLocally:false});
   if(!result.committed)throw Error(problem);
   ui.draftOpen=false;await openRoom(code,true);
 }catch(e){const message=String(e?.message||e);toast(/permission.denied|PERMISSION_DENIED/i.test(message)?'Firebaseの部屋への書き込み権限がありません。ルールを確認してください':'参加エラー：'+message);}finally{setBusy(false);}
}
async function draftPick(index){
 if(!ui.draftRoom||ui.busy)return;
 if(ui.demoDraft){
   try{
     const next=applyDraftPick(ui.draftRoom,'local-draft-'+(ui.draftRoom.draft.round%2?'b':'a'),index);
     if(next.completedDraft){
       saveCompletedDrafts(next,'local-'+Date.now(),true);
       ui.draftRoom=null;ui.demoDraft=false;ui.demo=true;ui.game=next;ui.seat=next.turn;storeDemo();
       setNetwork('お試し対戦','ok');
     }else ui.draftRoom=next;
     render();window.scrollTo(0,0);
   }catch(e){toast(e.message);}
   return;
 }
 if(!onlineReady())return;
 setBusy(true);let problem='ドラフト選択に失敗しました';
 const expectedRevision=ui.draftRoom.revision;
 try{
   const result=await ui.sdk.runTransaction(ui.sdk.ref(ui.db,'rooms/'+ui.draftCode),old=>{
     if(!old)return;
     if(old.revision!==expectedRevision){problem='ドラフトの候補が更新されました。再度カードを選んでください';return;}
     try{return applyDraftPick(old,ui.uid,index);}catch(e){problem=e.message;return;}
   },{applyLocally:false});
   if(!result.committed)toast(problem);
 }catch(e){toast('通信エラー：'+e.message);}finally{setBusy(false);}
}
async function copyDraftInvite(){
 const url=`${location.origin}${location.pathname}?draft=${encodeURIComponent(ui.draftCode)}`;
 try{await navigator.clipboard.writeText(url);toast('招待リンクをコピーしました');}
 catch{prompt('招待リンク',url);}
}
function startDemo(){readHomeValues();if(!validDeck(ui.counts,ui.rules,activeSavedDeck()?.extraCounts||{}))return toast(`先に${ui.rules.deckSize}枚のデッキを完成させてください`);ui.demo=true;ui.seat=0;ui.roomCode='';ui.selected=null;ui.targetMode=null;
 const other=ui.decks.decks.find(d=>d.id!==ui.decks.activeId&&validDeck(d.counts,ui.rules,d.extraCounts||{}));
 ui.game=createDemo({counts1:ui.counts,extra1:activeSavedDeck()?.extraCounts||{},counts2:other?.counts||ui.counts,extra2:other?.extraCounts||activeSavedDeck()?.extraCounts||{},rules:ui.rules});ui.seat=ui.game.turn;ui.lastFxRevision=ui.game.revision;ui.pendingDrawEvent=null;closeDrawReveal();storeDemo();setNetwork('お試し対戦','ok');render();}
function storeDemo(){if(ui.demo&&ui.game){storage.setItem('duel-demo-state',JSON.stringify(ui.game));storage.setItem('duel-demo-seat',String(ui.seat));}}
async function remoteCreate(){
 if(ui.busy)return;
 if(!onlineReady())return;readHomeValues();if(!validDeck(ui.counts,ui.rules,activeSavedDeck()?.extraCounts||{}))return toast(`先に${ui.rules.deckSize}枚のデッキを完成させてください`);
 setBusy(true);
 try{
   for(let tries=0;tries<24;tries++){
     const code=makeCode(),r=ui.sdk.ref(ui.db,`rooms/${code}`);
     const result=await ui.sdk.runTransaction(r,old=>old?undefined:createRoom({uid:ui.uid,name:ui.nickname,counts:ui.counts,extraCounts:activeSavedDeck()?.extraCounts||{},rules:ui.rules}),{applyLocally:false});
     if(result.committed){await openRoom(code);return;}
   }
   throw Error('4桁の合言葉を発行できませんでした');
 }catch(e){toast('部屋の作成に失敗しました：'+e.message)}finally{setBusy(false);}
}
async function remoteJoin(){
 if(ui.busy)return;
 if(!onlineReady())return;readHomeValues();
 // The host's deck rules may differ from the guest's default rules.
 const code=normalizeRoomCode($('roomCode')?.value||'');
 if(!isRoomCode(code))return toast('数字4桁の合言葉を入力してください（旧8文字コードも使用可）');
 setBusy(true);
 try{
   const r=ui.sdk.ref(ui.db,`rooms/${code}`);
   // Firebase transactions can see an empty local cache on a second iPhone.
   // Read the room first to populate the local view and distinguish missing/full rooms.
   const initial=(await ui.sdk.get(r)).val();
   if(!initial)return toast('部屋が見つかりません。部屋コードを確認してください');
   const participants=Array.isArray(initial.players)?initial.players:[initial.players?.[0],initial.players?.[1]];
   if(participants.some(p=>p?.uid===ui.uid)){await openRoom(code);return;}
   if(initial.status!=='waiting'||participants[1])return toast('この部屋はすでに対戦中か満室です');
   const roomRules=normalizeRuleSettings(initial.rules||ui.rules);
   if(!validDeck(ui.counts,roomRules,activeSavedDeck()?.extraCounts||{}))return toast(`部屋のルールに合う${roomRules.deckSize}枚のデッキを選んでください`);
   let failure='';
   // A Realtime Database transaction may first receive null even though get()
   // just confirmed the room exists on the server (cold transaction cache).
   // Use the confirmed snapshot as the optimistic value; Firebase compares the
   // transaction against the server and retries this callback on any conflict.
   // Returning undefined for the initial null would permanently abort joining.
   const result=await ui.sdk.runTransaction(r,old=>{
     const current=old??initial;
     if(!current){failure='部屋が見つかりません';return;}
     const players=Array.isArray(current.players)?current.players:[current.players?.[0],current.players?.[1]];
     if(players.some(p=>p?.uid===ui.uid))return current;
     if(current.status!=='waiting'||players[1]){failure='この部屋はすでに対戦中か満室です';return;}
     try{return joinRoom(current,{uid:ui.uid,name:ui.nickname,counts:ui.counts,extraCounts:activeSavedDeck()?.extraCounts||{}});}
     catch(e){failure=e.message;return;}
   },{applyLocally:false});
   if(!result.committed)return toast(failure||'参加処理が完了しませんでした。もう一度お試しください');
   await openRoom(code);
 }catch(e){
   const message=String(e?.message||e);
   toast(/permission.denied|PERMISSION_DENIED/i.test(message)?'Firebaseの部屋への書き込み権限がありません。ルールを確認してください':'参加できませんでした：'+message);
 }finally{setBusy(false);}
}
async function openRoom(code,isDraft=false){
 clearBoardCue();
 if(ui.unsub){ui.unsub();ui.unsub=null;}
 ui.demo=false;ui.demoDraft=false;ui.game=null;ui.draftRoom=null;ui.roomCode=code;ui.draftCode=code;ui.selected=null;ui.targetMode=null;ui.lastFxRevision=null;ui.pendingDrawEvent=null;closeDrawReveal();
 history.replaceState({},'',`${location.pathname}?${isDraft?'draft':'room'}=${code}`);
 ui.lastRoom={code};storage.setItem(LAST_ROOM_KEY,JSON.stringify(ui.lastRoom));
 let lastRoomVersion='';
 ui.unsub=ui.sdk.onValue(ui.sdk.ref(ui.db,`rooms/${code}`),snap=>{
   if(ui.roomCode!==code)return; // Ignore late callbacks from a previous room.
   const v=snap.val();if(!v){ui.game=null;ui.draftRoom=null;render();toast('部屋が見つかりません');return;}
   // Every server-side duel/draft action increments revision. Avoid an identical repaint.
   const roomVersion=`${v.revision??0}:${v.status??''}:${v.draft?.round??''}`;
   if(lastRoomVersion===roomVersion)return;
   lastRoomVersion=roomVersion;
   // A remote update may reorder hand/field indices: never keep a stale pick.
   ui.selected=null;ui.targetMode=null;
   const previousRoom=ui.game;
   const draftActive=!!v.draft&&['waiting','drafting'].includes(v.status);
   ui.game=draftActive?null:normalizeRoom(v);
   ui.draftRoom=draftActive?normalizeDraftRoom(v):null;
   const people=Array.isArray(v.players)?v.players:[v.players?.[0],v.players?.[1]];
   ui.seat=people.findIndex(p=>p?.uid===ui.uid);
   if(ui.seat<0){ui.game=null;ui.draftRoom=null;toast('この部屋に参加していません');}
   if(ui.game?.completedDraft&&ui.seat>=0)saveCompletedDrafts(ui.game,code);
   render();if(ui.game)handleRoomCue(ui.game,previousRoom);
 },err=>{if(ui.roomCode===code){toast('同期エラー：'+err.message);setNetwork('同期エラー','off');}});
 render();
}
async function send(action){
 if(!ui.game||ui.busy)return;
 if(!ui.demo&&!onlineReady())return;
 const previousTargetType=ui.targetMode?.type;const hadTarget=!!ui.targetMode;ui.targetMode=null;
 if(hadTarget&&!ui.demo){if(previousTargetType==='revive')render();else refreshDuelTarget();}
 if(ui.demo){
   if(action.type==='undoDemo'){
     if(!ui.game.undoSnapshot)return toast('取り消せる操作がありません');
     const restored=normalizeRoom(structuredClone(ui.game.undoSnapshot));for(const key of ['mode','completedDraft','createdAt'])if(!Object.hasOwn(restored,key)&&Object.hasOwn(ui.game,key))restored[key]=structuredClone(ui.game[key]);restored.revision=(ui.game.revision||0)+1;restored.undoSnapshot=null;restored.undoActor=null;restored.undoRequest=null;restored.log.unshift('直前の操作を取り消しました。');ui.game=restored;storeDemo();render();return;
   }
   try {const previousRoom=ui.game;ui.game=applyAction(ui.game,ui.game.players[ui.seat].uid,action);ui.selected=null;storeDemo();render();handleRoomCue(ui.game,previousRoom);}
   catch(e){if(hadTarget)render();toast(e.message);}return;
 }
 setBusy(true);let problem=null;
 const expectedRevision=ui.game.revision;
 try{
   const result=await ui.sdk.runTransaction(ui.sdk.ref(ui.db,`rooms/${ui.roomCode}`),old=>{
      if(!old){problem='部屋がありません';return;}
      if(old.revision!==expectedRevision){problem='相手の操作で対戦状況が更新されました。確認してやり直してください';return;}
      try{return applyAction(old,ui.uid,action);}catch(e){problem=e.message;return;}
   },{applyLocally:false});
   if(!result.committed)toast(problem||'ほかの操作と重なりました。もう一度お試しください。');
   else ui.selected=null;
 }catch(e){
   const message=String(e?.message||e),code=String(e?.code||'');
   if(/permission.denied|PERMISSION_DENIED/i.test(message+' '+code))
     toast('Firebase書き込み権限エラー：対戦ルールを確認してください。 '+message);
   else if(/contains undefined|invalid data|undefined in property/i.test(message))
     toast('対戦データの保存形式エラー：'+message);
   else toast('通信・同期エラー：'+message);
   console.error('[SAHOVERSE room transaction]',{action:action.type,code,message},e);
 }finally{setBusy(false);}
}
function attemptSummon(faceDown){
 const hand=ui.selected?.index;if(ui.selected?.zone!=='hand')return;
 const id=activePlayer()?.hand[hand],c=CARD[id];if(!c||c.type!=='monster')return;
 const need=c.level<=4?0:c.level<=6?1:2;
 const owned=activePlayer()?.monsters.map((m,i)=>m?i:null).filter(i=>i!==null)||[];
 if(owned.length<need)return toast(`召喚には${need}体のリリースが必要です`);
 if(!need)return send({type:'summon',hand,faceDown,tributes:[]});
 startTargetMode({type:'tribute',hand,faceDown,needed:need,indices:[]});
}
function specialSpells(kind){
 const p=activePlayer();if(!p)return [];
 const hand=p.hand.map((id,index)=>({id,source:'hand',index}));
 const row=p.backrow.map((slot,index)=>slot?.faceDown?{id:slot.id,source:'backrow',index}:null).filter(Boolean);
 return [...hand,...row].filter(x=>CARD[x.id]?.type==='spell'&&spellKind(CARD[x.id])===kind);
}
const specialKey=x=>`${x.source}:${x.index}`;
function beginSpecial(kind,opts={}){
 if(!inMain())return toast('自分のメインフェイズで行ってください');
 const spells=specialSpells(kind);if(!spells.length)return toast(kind==='ritual'?'儀式魔法が必要です':'融合魔法が必要です');
 const p=activePlayer();const targets=kind==='ritual'?p.hand.map((id,i)=>({id,index:i})).filter(x=>summonKind(CARD[x.id])==='ritual'):
   [...new Set(p.extraDeck||[])].filter(id=>summonKind(CARD[id])==='fusion').map(id=>({id}));
 if(!targets.length)return toast(kind==='ritual'?'手札に儀式モンスターが必要です':'EXデッキに融合モンスターが必要です');
 const spell=spells.find(x=>x.source===opts.source&&x.index===opts.index)||spells[0];
 const target=targets.find(x=>kind==='ritual'?x.index===opts.ritualHand:x.id===opts.fusionId) ||targets[0];
 ui.specialDraft={kind,spellKey:specialKey(spell),targetKey:kind==='ritual'?String(target.index):target.id,materials:[]};
 ui.selected=null;render();
}
function specialModal(){
 const d=ui.specialDraft,p=activePlayer();if(!d||!p)return '';
 const spells=specialSpells(d.kind);if(!spells.length)return '';
 const chosenSpell=spells.find(x=>specialKey(x)===d.spellKey)||spells[0];
 const spellCard=CARD[chosenSpell.id];
 const targets=d.kind==='ritual'?p.hand.map((id,index)=>({id,key:String(index)})).filter(x=>summonKind(CARD[x.id])==='ritual'&&(!spellCard.ritualFor||spellCard.ritualFor===x.id)):
   [...new Set(p.extraDeck||[])].filter(id=>summonKind(CARD[id])==='fusion').map(id=>({id,key:id}));
 const target=targets.find(x=>x.key===d.targetKey)||targets[0];
 d.spellKey=specialKey(chosenSpell);if(target)d.targetKey=target.key;
 const card=CARD[target?.id];
 const all=[...p.hand.map((id,index)=>({zone:'hand',index,id})),...p.monsters.map((m,index)=>m?{zone:'monsters',index,id:m.id}:null).filter(Boolean)];
 const allowed=target?all.filter(x=>CARD[x.id]?.type==='monster' && !(x.zone==='hand'&&((d.kind==='ritual'&&x.index===Number(target.key))||(chosenSpell.source==='hand'&&x.index===chosenSpell.index)))&&
    (d.kind==='ritual'||card.fusionMaterials?.includes(x.id))):[];
 const selected=allowed.filter(x=>d.materials.includes(`${x.zone}:${x.index}`));
 const matched=d.kind==='ritual'?selected.reduce((sum,m)=>sum+(CARD[m.id]?.level||0),0)>=(card?.level||Infinity):
    selected.length===2&&[...selected.map(x=>x.id)].sort().join(',')===[...(card?.fusionMaterials||[])].sort().join(',');
 const room=p.monsters.some((m,i)=>!m||selected.some(x=>x.zone==='monsters'&&x.index===i));
 const enabled=!!target&&matched&&room;
 const details=card?d.kind==='ritual'?`必要レベル ${card.level} / 選択 ${selected.reduce((sum,m)=>sum+CARD[m.id].level,0)}`:
   `素材：${(card.fusionMaterials||[]).map(id=>CARD[id]?.name||id).join(' ＋ ')}`:'対応するモンスターがありません';
 return `<div class="modal" role="dialog" aria-modal="true" aria-label="${d.kind==='ritual'?'儀式':'融合'}召喚"><div class="modal-box special-manager">
  <div class="modal-title-line"><h2>✦ ${d.kind==='ritual'?'儀式':'融合'}召喚</h2>${btn('×','closeSpecial','btn sm square')}</div>
  <label class="field-label" for="specialSpell">使用する魔法</label>
  <select id="specialSpell" class="input">${spells.map(x=>`<option value="${specialKey(x)}" ${specialKey(x)===specialKey(chosenSpell)?'selected':''}>${esc(CARD[x.id].name)}（${x.source==='hand'?'手札':'セット'}）</option>`).join('')}</select>
  <label class="field-label" for="specialTarget">召喚するモンスター</label>
  <select id="specialTarget" class="input" ${targets.length?'':'disabled'}>${targets.map(x=>`<option value="${esc(x.key)}" ${x.key===target?.key?'selected':''}>${esc(CARD[x.id].name)}</option>`).join('')}</select>
  <div class="special-note">${esc(details)}</div>
  <label class="field-label">素材を選択</label>
  <div class="special-material-list">${allowed.map(x=>{const key=`${x.zone}:${x.index}`;return `<label class="special-material"><input type="checkbox" data-special-material="${key}" ${selected.some(t=>`${t.zone}:${t.index}`===key)?'checked':''}><span>${esc(CARD[x.id].name)}</span><span class="small muted">${x.zone==='hand'?'手札':'場'}・★${CARD[x.id].level}</span></label>`;}).join('')||'<p class="small muted">選択できる素材がありません</p>'}</div>
  ${btn('召喚する','confirmSpecial','btn primary wide','',!enabled)}${btn('キャンセル','closeSpecial','btn ghost wide mt8')}
 </div></div>`;
}
function confirmSpecial(){
 const d=ui.specialDraft;if(!d)return;
 const [spellSource,index]=d.spellKey.split(':');
 const materials=d.materials.map(v=>{const [zone,n]=v.split(':');return {zone,index:Number(n)};});
 const action=d.kind==='ritual'?{type:'ritualSummon',ritualHand:Number(d.targetKey),spellSource,spellIndex:Number(index),materials}:
  {type:'fusionSummon',fusionId:d.targetKey,spellSource,spellIndex:Number(index),materials};
 ui.specialDraft=null;return send(action);
}
/** Choose a public graveyard card without leaking either player's hand/deck. */
function graveReviveModal(){
 const m=ui.targetMode,me=activePlayer();if(m?.type!=='revive'||!me)return '';
 const empty=me.monsters.some(x=>x===null);
 const sideList=[ui.seat,1-ui.seat].map(seat=>{
   const p=ui.game.players[seat];
   const items=p.grave.map((id,index)=>({id,index,card:CARD[id]})).filter(x=>x.card?.type==='monster');
   return `<section class="sv-revive-group"><h3>${seat===ui.seat?'自分':'相手'}の墓地 <span>${items.length}体</span></h3>
   ${items.length?`<div class="sv-revive-list">${items.map(x=>`<button type="button" class="sv-revive-choice" data-action="selectRevive" data-seat="${seat}" data-index="${x.index}" data-id="${esc(x.id)}" ${empty?'':'disabled'}>
       ${cardThumb(x.card)}<span class="sv-revive-copy"><b>${esc(x.card.name)}</b><small>★${x.card.level}　ATK ${x.card.atk} / DEF ${x.card.def}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div>`:'<p class="small muted">選べるモンスターがありません</p>'}
   </section>`;
 }).join('');
 return `<div class="modal sv-revive-modal" role="dialog" aria-modal="true" aria-label="墓地から特殊召喚するモンスターを選ぶ"><div class="modal-box sv-revive-dialog">
   <div class="modal-title-line"><h2>✦ 墓地から特殊召喚</h2>${btn('×','cancelTarget','btn sm square')}</div>
   <p class="small muted">自分・相手の墓地から1体を選び、自分の空きゾーンに攻撃表示で特殊召喚します。</p>
   ${empty?'':'<div class="notice">自分のモンスターゾーンが満杯です。</div>'}
   ${sideList}${btn('キャンセル','cancelTarget','btn ghost wide mt8')}</div></div>`;
}
function chooseSpell(source,index){
 const p=activePlayer(),id=source==='hand'?p.hand[index]:source==='field'?p.field?.id:p.backrow[index]?.id;
 if(!id)return;
 if(CARD[id]?.type==='spell'&&['ritual','fusion'].includes(spellKind(CARD[id])))return beginSpecial(spellKind(CARD[id]),{source,index});
 if(isGraveRevive(id)){startTargetMode({type:'revive',source,index,id});return;}
 if(effectNeedsTarget(id)){
   startTargetMode({type:'spell',source,index,id});
   toast('効果を受けるカードをフィールドからタップしてください');
 }else send({type:source==='hand'?'spellFromHand':'spellFromField',[source==='hand'?'hand':'index']:index,field:source==='field'});
}
function chooseSlot(owner,zone,index){
 if(!ui.game||ui.game.status==='waiting')return;
 if(ui.targetMode){
   const mode=ui.targetMode;
   if(mode.type==='tribute'){
     if(owner==='mine'&&zone==='monsters'&&activePlayer()?.monsters[index]){
       mode.indices=mode.indices.includes(index)?mode.indices.filter(i=>i!==index):[...mode.indices,index].slice(0,mode.needed);refreshDuelTarget();return;
     }return toast('自分のモンスターをタップしてください');
   }
   if(mode.type==='move'){
     if(owner==='mine'&&zone===mode.zone&&!activePlayer()?.[zone]?.[index])return send({type:'moveCard',zone:zone,from:mode.from,to:index});
     return toast('同じ列の空きゾーンをタップしてください');
   }
   if(mode.type==='attack'&&owner==='opponent'&&zone==='monsters'&&ui.game.players[1-ui.seat].monsters[index])
     return send({type:'attack',index:mode.index,target:index});
   if(['monsterEffect','chainTrap','quick','spell'].includes(mode.type)){
     const id=mode.id|| (mode.type==='monsterEffect'?activePlayer()?.monsters[mode.index]?.id:
       mode.type==='chainTrap'?activePlayer()?.backrow[mode.index]?.id:null);
     const spot=targetSpot(effectTarget(id));
     const targetPlayer=ui.game.players[owner==='mine'?ui.seat:1-ui.seat];
     if(owner===spot.owner&&zone===spot.zone&&targetPlayer?.[zone]?.[index]){
       if(mode.type==='monsterEffect')return send({type:'activateMonsterEffect',index:mode.index,target:index});
       if(mode.type==='chainTrap')return send({type:mode.attack?'activateTrap':'chainTrap',index:mode.index,target:index});
       if(mode.type==='quick')return send({type:'quickResponse',source:mode.source,index:mode.index,target:index});
       if(mode.type==='spell')return send({type:mode.source==='hand'?'spellFromHand':'spellFromField',
          [mode.source==='hand'?'hand':'index']:mode.index,field:mode.source==='field',target:index});
     }
   }
   return toast('指定された側のカードをタップしてください');
 }
 if(zone==='hand'){
   if(owner!=='mine')return;
   ui.selected=ui.selected?.owner===owner&&ui.selected?.zone===zone&&ui.selected?.index===index?null:{owner,zone,index};return refreshDuelSelection();
 }
 if(zone==='monsters'||zone==='backrow'||zone==='field'){
   if(!(zone==='field'?ui.game.players[owner==='mine'?ui.seat:1-ui.seat]?.field:ui.game.players[owner==='mine'?ui.seat:1-ui.seat]?.[zone]?.[index]))return;
   ui.selected=ui.selected?.owner===owner&&ui.selected?.zone===zone&&ui.selected?.index===index?null:{owner,zone,index};return refreshDuelSelection();
 }
}
async function copyInvite(){
 const link=`${location.origin}${location.pathname}?room=${encodeURIComponent(ui.roomCode)}`;
 try{await navigator.clipboard.writeText(link);toast('招待リンクをコピーしました');}
 catch{prompt('招待リンクをコピーしてください',link);}
}
function goHome(){clearBoardCue();if(ui.unsub){ui.unsub();ui.unsub=null;}ui.demo=false;ui.demoDraft=false;ui.draftRoom=null;ui.draftCode='';ui.draftOpen=false;ui.game=null;ui.roomCode='';ui.selected=null;ui.targetMode=null;ui.specialDraft=null;ui.graveOpen=false;ui.fxOpen=false;ui.settingsOpen=false;ui.duelOpen=false;ui.lastFxRevision=null;ui.pendingDrawEvent=null;closeDrawReveal();try{history.replaceState({},'',location.pathname);}catch{}if(configReady&&ui.db)setNetwork(ui.networkConnected===true?'オンライン接続可能':ui.networkConnected===false?'再接続待ち':'接続確認中',ui.networkConnected===true?'ok':ui.networkConnected===false?'off':'');else setNetwork('お試し対戦可能');render();}
function preserveInputBeforeNetworkRefresh(){
 // Firebase connects asynchronously, possibly while a card or pack editor is open.
 // Keep the user's in-progress input intact when we actually need to rebuild the UI.
 if(ui.cardDraft&&$('cardName'))readCardForm();
 if(ui.packDraft&&$('packName'))savePackDraftFields();
 if(ui.deckDraft&&$('deckName'))ui.deckDraft.name=$('deckName').value;
}
async function initFirebase(){
 // The config is OPTIONAL for the offline UI, and is loaded after the home screen.
 // A missing/incorrect export must not prevent the whole game from starting.
 try {
   const configModule=await import('./firebase-config.js?config=196');
   firebaseConfig=configModule.firebaseConfig||null;
   configReady=['apiKey','authDomain','databaseURL','projectId','appId'].every(key=>
     typeof firebaseConfig?.[key]==='string'&&firebaseConfig[key].trim()!=='');
   if(!configReady){setNetwork('Firebase未設定','off');return;}
 } catch(error) {
   setNetwork('Firebase設定エラー','off');
   toast('Firebase設定を確認してください：'+(error?.message||String(error)));
   return;
 }
 try {
   const [{initializeApp},{getAuth,signInAnonymously},{getDatabase,ref,runTransaction,onValue,get,set,remove}]=await Promise.all([
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
     import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js'),
   ]);
   const app=initializeApp(firebaseConfig);const auth=getAuth(app);
   await auth.authStateReady();if(!auth.currentUser)await signInAnonymously(auth);
   ui.uid=auth.currentUser.uid;ui.db=getDatabase(app);ui.sdk={ref,runTransaction,onValue,get,set,remove};
   // Firebase reconnects room listeners itself; only a single connection-state listener is needed.
   ui.connectionUnsub?.();
   ui.connectionUnsub=onValue(ref(ui.db,'.info/connected'),snap=>{
     const connected=snap.val()===true;ui.networkConnected=connected;
     setNetwork(connected?'オンライン接続可能':'再接続待ち',connected?'ok':'off');
   });
   ui.cardUnsub=onValue(ref(ui.db,'cardLibrary/cards'),snapshot=>{
     ui.cardLibraryReady=true;
     const cards=snapshot.val()||{};
     const encoded=JSON.stringify(cards);
     if(encoded===lastCardLibraryJSON)return; // No data change, no disk write, no repaint.
     preserveInputBeforeNetworkRefresh();
     ui.customCards=cards;
     lastCardLibraryJSON=encoded;
     storage.setItem('duel-custom-cards',encoded);
     replaceCustomCards(cards);
     render();
     // A custom card's art/data may arrive after the room event.
     if(ui.game)showPendingDraw(ui.game);
   },err=>{ui.cardLibraryReady=false;toast('カード共有エラー：'+err.message);});
   setNetwork(ui.networkConnected===true?'オンライン接続可能':ui.networkConnected===false?'再接続待ち':'接続確認中',ui.networkConnected===true?'ok':ui.networkConnected===false?'off':'');
   preserveInputBeforeNetworkRefresh();
   render(); // First connection: expose the online buttons exactly once.
   // URL invitation / reload: resume only for a participant with the same anonymous UID.
   const resumeCode=new URLSearchParams(location.search).get('room')||new URLSearchParams(location.search).get('draft');
   if(resumeCode&&isRoomCode(resumeCode))await reconnectLastRoom(resumeCode,true);
 }catch(e){
   // Do not leave enabled online actions if the SDK failed to connect.
   configReady=false;
   setNetwork('接続設定エラー','off');toast('Firebase接続エラー：'+e.message);
   preserveInputBeforeNetworkRefresh();render();
 }
}
$('view').addEventListener('click',async e=>{
 if(ui.fxSettings.sound||ui.fxSettings.bgm)unlockAudio();if(ui.fxSettings.bgm)setBgmPlaying(true); // iOS gesture
 const selected=e.target.closest('[data-select]');if(selected){chooseSlot(selected.dataset.owner,selected.dataset.zone,Number(selected.dataset.index));return;}
 const el=e.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(ui.busy)return;
 if(action==='openDraft'||action==='openOpenDraft'){ui.draftFormat=action==='openOpenDraft'?'open':'two';ui.draftOpen=true;ui.duelOpen=false;render();return;}
 if(action==='closeDraft'){ui.draftOpen=false;render();return;}
 if(action==='draftDemo')return startLocalDraft();
 if(action==='createDraftRoom')return createOnlineDraft();
 if(action==='joinDraftRoom')return joinOnlineDraft();
 if(action==='copyDraftInvite')return copyDraftInvite();
 if(action==='draftPick')return draftPick(Number(el.dataset.index));
 if(action==='closeSpecial'){ui.specialDraft=null;render();return;}
 if(action==='confirmSpecial')return confirmSpecial();
 if(action==='openRitual')return beginSpecial('ritual',{ritualHand:ui.selected?.index});
 if(action==='openFusion')return beginSpecial('fusion');
 if(action==='extraPlus'||action==='extraMinus'){if(!ui.deckDraft)return;const id=el.dataset.id,c=CARD[id];if(!c||summonKind(c)!=='fusion')return;const counts=ui.deckDraft.extraCounts||={},n=counts[id]||0;if(action==='extraPlus'&&n<Math.min(cardLimit(c),ui.collectionOnly?(deckPool()[id]||0):3)&&sum(counts)<15)counts[id]=n+1;else if(action==='extraMinus'&&n>0){if(n===1)delete counts[id];else counts[id]=n-1;}ui.deckDraft.extraCounts=counts;saveSealedDraft();saveDeckDraft();refreshDeckEditor();return;}
 if(action==='toggleCompact'){ui.duelCompact=!ui.duelCompact;storage.setItem('duel-compact',ui.duelCompact?'1':'0');render();return;}
 if(action==='openDuel'){ui.duelOpen=true;render();requestAnimationFrame(()=>document.getElementById('duel-setup')?.scrollIntoView({behavior:'smooth',block:'start'}));return;}
 if(action==='closeDuel'){ui.duelOpen=false;render();return;}
 if(action==='exportBackup'){exportBackup();return;}
 if(action==='resumeRoom'){return reconnectLastRoom(ui.lastRoom?.code||'');}
 if(action==='openSettings'){ui.settingsOpen=true;render();return;}
 if(action==='closeSettings'){ui.settingsOpen=false;render();return;}
 if(action==='settingsAppearance'){ui.settingsOpen=false;ui.appearanceOpen=true;render();return;}
 if(action==='settingsFx'){ui.settingsOpen=false;ui.fxOpen=true;render();return;}
 if(action==='settingsRules'){ui.settingsOpen=false;ui.rulesOpen=true;render();return;}
 if(action==='openRules'){ui.rulesOpen=true;render();return;}
 if(action==='closeRules'){ui.rulesOpen=false;render();return;}
 if(action==='saveRules'){ui.rules=writeRuleSettings(storage,{lp:Number($('ruleLP').value),deckSize:Number($('ruleDeck').value),costLimit:Number($('ruleCost').value)});ui.rulesOpen=false;render();toast('ルールを保存しました');return;}
 if(action==='openAppearance'){ui.appearanceOpen=true;render();return;}
 if(action==='closeAppearance'){ui.appearanceOpen=false;render();return;}
 if(action==='openSealed'){ui.sealedOpen=true;render();return;}
 if(action==='closeSealed'){ui.sealedOpen=false;render();return;}
 if(action==='sealedResume'){resumeSealed();return;}
 if(action==='sealedDraw'){
   const id=$('sealedPack')?.value,p=ui.packs.packs.find(x=>x.id===id);if(!p)return toast('パックを選んでください');
   if(ui.decks.decks.length>=MAX_SAVED_DECKS)return toast('保存できるデッキは最大30組です');
   if(ui.sealedSession&&!confirm('前回のパック戦の作成途中データを上書きしますか？'))return;
   try{
     const session=sealedPoolFromPacks(p,ui.rules.deckSize);
     ui.sealedSession=session;storeSealed();
     collect(ui.packs,session.drawn);savePackStore(storage,ui.packs);
     resumeSealed();toast(`${session.packCount}パックから${session.drawn.length}枚獲得！`);
   }catch(e){toast('開封できません：'+e.message);}
   return;
 }
 if(action==='openPacks'){ui.packOpen=true;ui.packResults=null;ui.packDraft=null;render();return;}
 if(action==='closePacks'){ui.packOpen=false;ui.packDraft=null;ui.packResults=null;render();return;}
 if(action==='packBack'){ui.packResults=null;render();return;}
 if(action==='packEditorBack'){ui.packDraft=null;render();return;}
 if(action==='packNew'){if(ui.packs.packs.length>=25)return toast('パックは最大25種類');ui.packDraft=newPack();render();return;}
 if(action==='packEdit'){ui.packDraft=structuredClone(ui.packs.packs.find(p=>p.id===el.dataset.id));render();return;}
 if(action==='packSave'){
   savePackDraftFields();let d;try{d=normalizePack(ui.packDraft);}catch(e){toast(e.message);return;}
   if(!Object.values(d.weights).some(w=>w>0))return toast('少なくとも1種類の排出比率を正にしてください');
   const index=ui.packs.packs.findIndex(p=>p.id===d.id);
   if(index>=0)ui.packs.packs[index]=d;else ui.packs.packs.push(d);
   savePackStore(storage,ui.packs);ui.packDraft=null;render();toast('パックを保存しました');return;
 }
 if(action==='packOpenOne'){
   const p=ui.packs.packs.find(x=>x.id===el.dataset.id);if(!p)return;
   try{ui.packResults=openPack(p);collect(ui.packs,ui.packResults);savePackStore(storage,ui.packs);render();}
   catch(e){toast('開封できません：'+e.message);}return;
 }
 if(action==='packDelete'){
  const p=ui.packs.packs.find(x=>x.id===el.dataset.id);if(!p||p.id==='starter'||!confirm('このパックを削除しますか？'))return;
  ui.packs.packs=ui.packs.packs.filter(x=>x.id!==p.id);savePackStore(storage,ui.packs);render();return;
 }
 if(action==='packDetail'){ui.previewCardId=el.dataset.id;render();return;}
 if(action==='viewCard'){const x=ui.selected;let id=null;if(x&&ui.game){const p=ui.game.players[x.owner==='mine'?ui.seat:1-ui.seat];id=x.zone==='hand'?p.hand[x.index]:x.zone==='field'?p.field?.id:p[x.zone]?.[x.index]?.id;}if(id){ui.previewCardId=id;if($('view').classList.contains('duel-active'))$('view').insertAdjacentHTML('beforeend',detailOverlay());else render();}return;}
 if(action==='graveDetail'){ui.previewCardId=el.dataset.id;render();return;}
 if(action==='closePreview'){ui.previewCardId=null;const modal=$('view').querySelector('.modal-detail.sv-detail-modal');if(modal&&ui.game)modal.remove();else render();return;}

 if(action==='openFx'){ui.fxOpen=true;render();return;}
 if(action==='closeFx'){ui.fxOpen=false;render();return;}
 if(['previewFlame','previewSlash','previewShadow','previewRitual','previewFusion','previewVictory'].includes(action)){
   const kind={previewFlame:'flame',previewSlash:'slash',previewShadow:'shadow',previewRitual:'ritual',previewFusion:'fusion',previewVictory:'victory'}[action];
   const type=kind==='slash'?'impact':kind==='shadow'?'trap':kind==='ritual'?'ritual':kind==='fusion'?'fusion':kind==='victory'?'win':'summon';
   const sound=kind==='flame'?'boom':kind==='slash'?'slash':kind==='shadow'?'spark':kind==='victory'?'chime':'chime';
   Promise.resolve(unlockAudio()).then(()=>playCue({type,cardId:'__preview',winner:0,viewerSeat:0}, {name:kind==='victory'?'': 'テスト演出',fx:{visual:kind,sound}},ui.fxSettings));return;
 }
 if(action==='previewCardFx'&&ui.cardDraft){readCardForm();
   const card=ui.cardDraft;
   Promise.resolve(unlockAudio()).then(()=>playCue({type:card.type==='trap'?'trap':card.type==='spell'?'spell':card.summonKind==='ritual'?'ritual':card.summonKind==='fusion'?'fusion':card.subtype==='effect'?'effect':'summon',cardId:card.id},card,ui.fxSettings));return;}
 if(action==='unlockCards'){
   if(ui.adminBusy)return;
   if(!ui.sdk||!ui.uid)return toast('Firebaseへの接続を確認してください');
   const password=$('cardAdminPassword')?.value||'';
   if(!password)return toast('管理パスワードを入力してください');
   ui.adminBusy=true;
   try{
     await ui.sdk.set(ui.sdk.ref(ui.db,`adminSessions/${ui.uid}`),password);
     ui.adminUnlocked=true;render();toast('編集モードを解除しました');
   }catch{if($('cardAdminPassword'))$('cardAdminPassword').value='';toast('パスワードが違うか、Firebaseルールが未更新です');}
   finally{ui.adminBusy=false;}
   return;
 }
 if(action==='lockCards'){
   if(ui.adminBusy)return;
   ui.adminUnlocked=false;ui.adminBusy=true;ui.cardDraft=null;clearCardDraft();render();
   try{if(ui.sdk&&ui.uid)await ui.sdk.remove(ui.sdk.ref(ui.db,`adminSessions/${ui.uid}`));}
   catch{toast('ロック状態の同期に失敗しました。再度開いて確認してください');}
   finally{ui.adminBusy=false;}
   return;
 }
 if(action==='openCards'){readHomeValues();ui.cardsOpen=true;ui.cardDraft=null;render();return;}
 if(action==='closeCards'){ui.cardsOpen=false;ui.cardDraft=null;render();return;}
 if(action==='resumeCardDraft'){if(!ui.adminUnlocked)return toast('管理パスワードを入力してください');ui.cardDraft=existingDraft(CARD_DRAFT_KEY);render();return;}
 if(action==='discardCardDraft'){clearCardDraft();render();return;}
 if(action==='newCard'){if(!ui.adminUnlocked)return toast('管理パスワードを入力してください');ui.cardDraft=newCardDraft();saveCardDraft();render();return;}
 if(action==='editCard'){if(!ui.adminUnlocked)return toast('管理パスワードを入力してください');ui.cardDraft={...CARD[el.dataset.id],subtype:CARD[el.dataset.id]?.type==='monster'?(CARD[el.dataset.id]?.subtype||'normal'):undefined,monsterEffect:CARD[el.dataset.id]?.monsterEffect?{...CARD[el.dataset.id].monsterEffect}:undefined};saveCardDraft();render();return;}
 if(action==='cardList'){ui.cardDraft=null;render();return;}
 if(action==='saveCard')return saveCardFromForm();
 if(action==='deleteCard')return deleteCard();
 if(action==='removeCardImage'){if(ui.cardDraft){readCardForm();ui.cardDraft.image='';saveCardDraft();render();}return;}
 if(action==='openGallery'){readHomeValues();ui.galleryOpen=true;ui.gallerySelected=null;render();return;}
 if(action==='closeGallery'){ui.galleryOpen=false;ui.gallerySelected=null;render();return;}
 if(action==='galleryDetail'){ui.gallerySelected=el.dataset.id;render();return;}
 if(action==='galleryBack'){ui.gallerySelected=null;render();return;}
 if(action==='editDeck'){readHomeValues();ui.sealedOnly=false;ui.collectionOnly=false;ui.deckOpen=true;ui.deckDraft=null;render();return;}
 if(action==='closeDeck'){saveSealedDraft();const wasSealed=ui.sealedOnly;ui.deckOpen=false;ui.deckDraft=null;ui.sealedOnly=false;ui.collectionOnly=false;if(wasSealed)ui.sealedOpen=true;render();return;}
 if(action==='deckBack'){saveSealedDraft();if(ui.sealedOnly){ui.sealedOnly=false;ui.collectionOnly=false;ui.deckOpen=false;ui.sealedOpen=true;}ui.deckDraft=null;render();return;}
 if(action==='resumeDeckDraft'){const d=existingDraft(DECK_DRAFT_KEY);if(d&&d.counts&&d.extraCounts){ui.deckDraft=d;ui.sealedOnly=false;ui.collectionOnly=false;render();}return;}
 if(action==='discardDeckDraft'){clearDeckDraft();render();return;}
 if(action==='deckNew'||action==='deckNewRed'||action==='deckNewBlue'){
   startDeckDraft('new');
   if(ui.deckDraft&&action!=='deckNew'){ui.deckDraft.counts=copyPreset(action==='deckNewRed'?'red':'blue');ui.deckDraft.extraCounts={m26:1};ui.deckDraft.name=action==='deckNewRed'?'紅蓮デッキ（新規）':'蒼海デッキ（新規）';saveDeckDraft();render();}
   return;
 }
 if(action==='deckSelect'){selectDeck(el.dataset.id);return;}
 if(action==='deckEdit'){const d=ui.decks.decks.find(x=>x.id===el.dataset.id);if(d)startDeckDraft('edit',d);return;}
 if(action==='deckShare'){shareDeck(el.dataset.id);return;}
 if(action==='deckClone'){
   const d=ui.decks.decks.find(x=>x.id===el.dataset.id);
   if(!d||ui.decks.decks.length>=MAX_SAVED_DECKS)return;
   const cloned=newDeck(d.name+' のコピー',d.counts,d.extraCounts||{});ui.decks.decks.push(cloned);persistDecks();render();toast('デッキを複製しました');return;
 }
 if(action==='deckDelete'){
   const d=ui.decks.decks.find(x=>x.id===el.dataset.id);
   if(!d||ui.decks.decks.length<=1||!confirm(`「${d.name}」を削除しますか？`))return;
   ui.decks.decks=ui.decks.decks.filter(x=>x.id!==d.id);
   if(ui.decks.activeId===d.id)ui.decks.activeId=ui.decks.decks[0].id;
   persistDecks();render();toast('デッキを削除しました');return;
 }
 if(action==='deckPlus'||action==='deckMinus'){
   if(!ui.deckDraft)return;
   const counts=ui.deckDraft.counts,id=el.dataset.id,n=counts[id]||0;
   if(action==='deckPlus'&&n<Math.min(cardLimit(CARD[id]),ui.collectionOnly?(deckPool()[id]||0):3)&&sum(counts)<ui.rules.deckSize)counts[id]=n+1;
   if(action==='deckMinus'&&n>0){if(n===1)delete counts[id];else counts[id]=n-1;}
   saveSealedDraft();saveDeckDraft();refreshDeckEditor();return;
 }
 if(action==='loadRed'||action==='loadBlue'||action==='deckClear'){
   if(!ui.deckDraft)return;
   ui.deckDraft.counts=action==='deckClear'?{}:copyPreset(action==='loadRed'?'red':'blue');ui.deckDraft.extraCounts=action==='deckClear'?{}:{m26:1};saveSealedDraft();saveDeckDraft();render();return;
 }
 if(action==='saveDeck'){saveDeck();return;}
 if(action==='acceptShare'){addImportedDeck();return;}
 if(action==='rejectShare'){closeShare();return;}
 if(action==='demo')return startDemo();
 if(action==='createRoom')return remoteCreate();
 if(action==='joinRoom')return remoteJoin();
 if(action==='copyInvite')return copyInvite();
 if(action==='goHome')return goHome();
 if(action==='cancelSelection'){ui.selected=null;refreshDuelSelection();return;}
 if(action==='switchSeat'){ui.seat=1-ui.seat;ui.selected=null;ui.targetMode=null;closeDrawReveal();storeDemo();render();showPendingDraw(ui.game);return;}
 if(action==='nextPhase')return send({type:'nextPhase'});
 if(action==='chainPass')return send({type:'chainPass'});
 if(action==='quickResponse'){
   const source=el.dataset.source,index=Number(el.dataset.index),p=activePlayer();
   const id=source==='hand'?p.hand[index]:p.backrow[index]?.id;
   if(effectNeedsTarget(id)){
     startTargetMode({type:'quick',source,index,id});toast('効果の対象をタップしてください');return;
   }
   return send({type:'quickResponse',source,index});
 }
 if(action==='chainTrap'){const i=Number(el.dataset.index),c=CARD[activePlayer()?.backrow[i]?.id];
  if(c&&effectNeedsTarget(c.id)){startTargetMode({type:'chainTrap',index:i,id:c.id});return;}
  return send({type:'chainTrap',index:i});}
 if(action==='manualDraw')return send({type:'manualDraw'});
 if(action==='shuffleDeck')return send({type:'shuffleDeck'});
 if(action==='rollDice')return send({type:'random',kind:'dice'});
 if(action==='flipCoin')return send({type:'random',kind:'coin'});
 if(action==='requestUndo'||action==='approveUndo'||action==='rejectUndo')return send({type:action});
 if(action==='undoDemo')return send({type:'undoDemo'});
 if(action==='moveSelected'){const x=ui.selected;if(!x||x.owner!=='mine')return;startTargetMode({type:'move',zone:x.zone,from:x.index});return;}
 if(action==='destroySelected'||action==='banishSelected'){const x=ui.selected;if(x?.owner!=='mine')return;return send({type:action==='destroySelected'?'manualDestroy':'manualBanish',zone:x.zone,index:x.index});}
 if(action==='banishFromGrave'){const n=Number(prompt('除外する墓地のカード番号を指定\n'+(activePlayer()?.grave||[]).map((id,i)=>`${i+1}: ${CARD[id]?.name||id}`).join('\n')));if(Number.isInteger(n))return send({type:'banishGrave',index:n-1});return;}
 if(action==='handPrev'||action==='handNext'){scrollHandCards(action==='handPrev'?-1:1);return;}
 if(action==='scrollToHand'){document.querySelector('.hand-count')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
 if(action==='endTurn')return send({type:'endTurn'});
 if(action==='passAttack')return send({type:'passAttack'});
 if(action==='trap'){
  const i=Number(el.dataset.index??ui.selected?.index),c=CARD[activePlayer()?.backrow[i]?.id];
  if(c&&effectNeedsTarget(c.id)){
   startTargetMode({type:'chainTrap',attack:true,index:i,id:c.id});return;
  }
  return send({type:'activateTrap',index:i});
 }
 if(action==='confirmTributes'){const m=ui.targetMode;if(m?.type==='tribute'&&m.indices.length===m.needed)return send({type:'summon',hand:m.hand,faceDown:m.faceDown,tributes:[...m.indices]});return;}
 if(action==='summonAtk')return attemptSummon(false);
 if(action==='summonSet')return attemptSummon(true);
 if(action==='setHand')return send({type:'setBackrow',hand:ui.selected.index});
 if(action==='spellHand')return chooseSpell('hand',ui.selected.index);
 if(action==='spellField')return chooseSpell(ui.selected.zone==='field'?'field':'backrow',ui.selected.index);
 if(action==='flip')return send({type:'flip',index:ui.selected.index});
 if(action==='changePosition')return send({type:'changePosition',index:ui.selected.index});
 if(action==='discard')return send({type:'discard',hand:ui.selected.index});
 if(action==='monsterEffect'){
   const i=ui.selected?.index,m=activePlayer()?.monsters[i],c=CARD[m?.id];
   if(!c)return;
   if(effectNeedsTarget(c.id)){
     startTargetMode({type:'monsterEffect',index:i,id:c.id});return;
   }
   return send({type:'activateMonsterEffect',index:i});
 }
 if(action==='attackSelect'){startTargetMode({type:'attack',index:ui.selected.index});return;}
 if(action==='directAttack')return send({type:'attack',index:ui.targetMode.index,target:null});
 if(action==='selectRevive'){
   const m=ui.targetMode;if(m?.type!=='revive')return;
   const seat=Number(el.dataset.seat),index=Number(el.dataset.index),cardId=el.dataset.id;
   if(![0,1].includes(seat)||!Number.isInteger(index)||ui.game?.players[seat]?.grave[index]!==cardId||CARD[cardId]?.type!=='monster')return toast('墓地の対象が変わりました。もう一度選択してください');
   return send({type:m.source==='hand'?'spellFromHand':'spellFromField',[m.source==='hand'?'hand':'index']:m.index,field:m.source==='field',target:{seat,index,cardId}});
 }
 if(action==='cancelTarget'){const modal=ui.targetMode?.type==='revive';ui.targetMode=null;if(modal)render();else refreshDuelTarget();return;}
 if(action==='surrender'&&confirm('本当に降参しますか？'))return send({type:'surrender'});
 if(action==='showGrave'){ui.graveOpen=true;render();return;}
 if(action==='closeGrave'){ui.graveOpen=false;render();return;}
});
$('view').addEventListener('input',e=>{
 if(e.target.id==='fxVolume'){ui.fxSettings.volume=Number(e.target.value);writeFxSettings(ui.fxSettings);const el=$('fxVolumeValue');if(el)el.textContent=`${ui.fxSettings.volume}%`;return;}
 if(e.target.id==='gallerySearch'){updateCardRows('gallery');return;}
 if(e.target.id==='deckSearch'){updateCardRows('deck');return;}
 if(e.target.id==='deckName'&&ui.deckDraft){ui.deckDraft.name=e.target.value;saveSealedDraft();saveDeckDraft();return;}
 if(e.target.id==='cardSearch'){updateManagedCards();return;}
 if(ui.cardDraft&&['cardName','cardLevel','cardAtk','cardDef','cardCost','cardEmoji','cardDesc','cardAbilityAmount'].includes(e.target.id)){
   readCardForm();
   const preview=document.querySelector('.card-demo');if(preview)preview.innerHTML=cardHtmlPreview(ui.cardDraft);
   if(e.target.id==='cardAbilityAmount'){
     const note=document.querySelector('.sv-effect-preview');if(note)note.textContent=abilityText(ui.cardDraft.ability);
   }
 }

});
$('view').addEventListener('change',async e=>{
 if(e.target.id==='backupFile'){await importBackup(e.target.files?.[0]);return;}
 if(['fxVisualToggle','fxSoundToggle','fxBgmToggle'].includes(e.target.id)){
   ui.fxSettings[e.target.id==='fxVisualToggle'?'visuals':e.target.id==='fxSoundToggle'?'sound':'bgm']=e.target.checked;
   writeFxSettings(ui.fxSettings);
   if(e.target.id==='fxSoundToggle'&&e.target.checked)unlockAudio();
   if(e.target.id==='fxBgmToggle')setBgmPlaying(ui.fxSettings.bgm);
   return;
 }
 if(e.target.id==='cardImage'&&e.target.files?.[0]){
   readCardForm(); // 写真選択前に入力した名前・ATK等が消えないよう保存
   ui.cardBusy=true;
   try {const img=await compressCardImage(e.target.files[0]);if(ui.cardDraft){ui.cardDraft.image=img;saveCardDraft();toast('画像を登録しました');}}
   catch(err){toast('画像を読み込めません：'+err.message);}
   finally{ui.cardBusy=false;render();}return;
 }
 if(e.target.id==='specialSpell'&&ui.specialDraft){ui.specialDraft.spellKey=e.target.value;ui.specialDraft.materials=[];render();return;}
 if(e.target.id==='specialTarget'&&ui.specialDraft){ui.specialDraft.targetKey=e.target.value;ui.specialDraft.materials=[];render();return;}
 if(e.target.matches('[data-special-material]')&&ui.specialDraft){const key=e.target.dataset.specialMaterial;ui.specialDraft.materials=e.target.checked?[...new Set([...ui.specialDraft.materials,key])]:ui.specialDraft.materials.filter(x=>x!==key);render();return;}
 if(['cardType','cardSubtype','cardSpellKind','cardSummonKind','cardEffectKind','cardEffectMode','cardAbilityWhen','cardAbilityOperation'].includes(e.target.id)&&ui.cardDraft){
   readCardForm();
   if(e.target.id==='cardType'){
     ui.cardDraft.type=e.target.value;
     if(ui.cardDraft.type==='monster'){ui.cardDraft.subtype='normal';delete ui.cardDraft.effect;delete ui.cardDraft.ability;}
     else{
       ui.cardDraft.effect=ui.cardDraft.type==='spell'?'draw2':'negate';
       if(ui.cardDraft.type==='spell')ui.cardDraft.spellKind='normal';
       ui.cardDraft.ability=ui.cardDraft.type==='spell'?{when:'main',operation:'draw',target:'self',amount:1}:
         {when:'attack',operation:'negateAttack',target:'none',amount:0};
       delete ui.cardDraft.monsterEffect;
     }
   }
   if(e.target.id==='cardSubtype'){
     ui.cardDraft.subtype=e.target.value;
     if(e.target.value==='effect'&&!ui.cardDraft.ability)ui.cardDraft.ability={when:'main',operation:'draw',target:'self',amount:1};
     if(e.target.value==='normal')delete ui.cardDraft.ability;
   }
   if(e.target.id==='cardSummonKind'){ui.cardDraft.summonKind=e.target.value;if(e.target.value==='fusion')ui.cardDraft.fusionMaterials=['m03','m12'];else delete ui.cardDraft.fusionMaterials;}
   if(e.target.id==='cardSpellKind'){
     ui.cardDraft.spellKind=e.target.value;
     if(ui.cardDraft.ability?.when==='continuous'&&!persistentSpell(ui.cardDraft))ui.cardDraft.ability.when='main';
     if(['ritual','fusion'].includes(e.target.value)){ui.cardDraft.effect=e.target.value==='ritual'?'ritualSummon':'fusionSummon';delete ui.cardDraft.ability;}
     if(e.target.value==='equip')ui.cardDraft.ability={when:'continuous',operation:'boost',target:'ownMonster',amount:500};
     if(e.target.value==='field')ui.cardDraft.ability={when:'continuous',operation:'boost',target:'ownAllMonsters',amount:500};
   }
   if(e.target.id==='cardEffectKind')ui.cardDraft.monsterEffect={kind:e.target.value,code:Object.keys(MONSTER_EFFECTS[e.target.value])[0]};
   if(e.target.id==='cardEffectMode'){
     if(e.target.value==='builder'){
       const when=ui.cardDraft.type==='trap'?'attack':'main';
       const op=when==='attack'?'negateAttack':'draw';
       ui.cardDraft.ability={when,operation:op,target:abilityTargets(op,when,ui.cardDraft.type,spellKind(ui.cardDraft))[0],amount:ABILITY_META[op].amount};
     }else delete ui.cardDraft.ability;
   }
   if(e.target.id==='cardAbilityWhen'&&ui.cardDraft.ability){
     ui.cardDraft.ability.when=e.target.value;
     const operations=availableOperations(e.target.value,ui.cardDraft);
     if(!Object.hasOwn(operations,ui.cardDraft.ability.operation)){
       const op=e.target.value==='continuous'?'boost':e.target.value==='response'?'negateEffect':e.target.value==='attack'?'negateAttack':'draw';
       ui.cardDraft.ability.operation=op;ui.cardDraft.ability.amount=ABILITY_META[op].amount;
     }
     const validTargets=abilityTargets(ui.cardDraft.ability.operation,e.target.value,ui.cardDraft.type,spellKind(ui.cardDraft));
     if(!validTargets.includes(ui.cardDraft.ability.target))ui.cardDraft.ability.target=validTargets[0];
   }
   if(e.target.id==='cardAbilityOperation'&&ui.cardDraft.ability){
     const op=e.target.value,when=ui.cardDraft.ability.when;
     ui.cardDraft.ability.operation=op;ui.cardDraft.ability.target=abilityTargets(op,when,ui.cardDraft.type,spellKind(ui.cardDraft))[0];ui.cardDraft.ability.amount=ABILITY_META[op].amount;
   }
   saveCardDraft();render();return;
 }
 if(['cardEffectCode','cardAbilityTarget','cardAbilityAmount','cardLimit','cardCost','fusionMat1','fusionMat2','ritualFor'].includes(e.target.id)&&ui.cardDraft){readCardForm();return;}
 if(e.target.id==='cardRarity'&&ui.cardDraft){readCardForm();const preview=document.querySelector('.card-demo');if(preview)preview.innerHTML=cardHtmlPreview(ui.cardDraft);return;}
 if(e.target.id==='matChoice'||e.target.id==='backChoice'){ui.appearance[e.target.id==='matChoice'?'mat':'back']=e.target.value;persistAppearance();return;}
 if(e.target.id==='collectionOnly'){ui.collectionOnly=e.target.checked;render();return;}
 if(e.target.id==='deckOnly'){ui.deckOnly=e.target.checked;updateCardRows('deck');return;}
 if(e.target.id==='cardManageType'||e.target.id==='cardManageRarity'){ui[e.target.id==='cardManageType'?'cardManageType':'cardManageRarity']=e.target.value;updateManagedCards();return;}
 if(e.target.matches('[data-pack-card]')&&ui.packDraft){savePackDraftFields();const id=e.target.dataset.packCard;if(e.target.checked&&!ui.packDraft.ids.includes(id))ui.packDraft.ids.push(id);else if(!e.target.checked)ui.packDraft.ids=ui.packDraft.ids.filter(x=>x!==id);return;}
 if(e.target.id==='activeDeck'){readHomeValues();selectDeck(e.target.value);return;}
 if(e.target.id==='deckType'||e.target.id==='deckRarity'){
   ui[e.target.id==='deckType'?'deckFilterType':'deckFilterRarity']=e.target.value;updateCardRows('deck');return;
 }
 if(e.target.id==='galleryType'||e.target.id==='galleryRarity'){
   ui[e.target.id==='galleryType'?'galleryFilterType':'galleryFilterRarity']=e.target.value;updateCardRows('gallery');return;
 }
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 if($('draw-reveal')?.classList.contains('visible')){closeDrawReveal();return;}
 if(ui.targetMode){ui.targetMode=null;render();return;}
 if(ui.previewCardId){ui.previewCardId=null;render();return;}
 if(ui.gallerySelected){ui.gallerySelected=null;render();return;}
 if(ui.selected&&ui.game&&!ui.targetMode){ui.selected=null;refreshDuelSelection();}
});
window.addEventListener('pagehide',()=>{try{flushDraft();}catch{}});
// オンライン設定前は1台お試しのみ利用可能。
setNetwork('画面の準備完了');render();window.__DUEL_READY=true;initFirebase();
