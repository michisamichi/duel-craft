import {makeRoomCode,normalizeRoomCode,isRoomCode} from './room-code.js?v=2047';
import {CARDS,CARD,PRESETS,copyPreset,validDeck,validExtraDeck,replaceCustomCards,isSafeCustomCard,effectText,MONSTER_EFFECTS,PASSIVE_SCALE_CODES,PASSIVE_SCOPES,COUNT_STAT_ZONES,COUNT_MONSTER_KINDS,defaultPassiveConfig,ORIGINAL_IDS,RARITIES,SPELL_KINDS,spellKind,persistentSpell,summonKind,SUMMON_KINDS,ATTRIBUTE_NAMES,RACE_NAMES,HISTORICAL_PRESETS} from './cards.js?v=2047';
import {readDeckStore,writeDeckStore,newDeck,encodeDeckShare,decodeDeckShare,MAX_SAVED_DECKS,totalCards} from './decks.js?v=2047';
import {makeBackup,parseBackup,applyBackup} from './backup.js?v=2047';
import {EFFECT_TEMPLATE_KEY,BUILTIN_EFFECT_TEMPLATES,readTemplates,saveTemplate,deleteTemplate,canApplyTemplate,applyTemplate,templateDescription} from './effect-templates.js?v=2047';
import {PHASES,createRoom,joinRoom,createDemo,applyAction,normalizeRoom,effectiveAtk,effectiveDef,isAttackTargetLegal,canManuallyChangePosition,remainingAttacks,specialHandTributeSlots,canDirectAttackWithMonsters,isAttackSealedByEquip,trapsSuppressed,canActivateMainTrap,canExtraNormalSummon,summonTributeNeed,validSummonTributes,hasDoubleLightTribute,canProtectOwnTraps,redirectedSpellTargetSlot,attackerAllySlot,canActivateAttackTrap,canActivateResponseTrap,canOfferSpell,canBorrowMonster,isDragonEffectTargetBlocked,canOfferMonsterIgnition,monsterEffectActivationBlocked} from './engine.js?v=2047';
import {LIMITS,cardLimit,cardCost,deckCost,fusionMaterialsMatch,TRIGGERS,TARGETS,OPERATIONS,ABILITY_META,BEFORE_META,abilityCostOptions,abilityTargets,followUpTargets,abilityText,normalizeRuleSettings,readRuleSettings,writeRuleSettings} from './rules.js?v=2047';
import {createDraftRoom,joinDraftRoom,applyDraftPick,normalizeDraftRoom} from './draft.js?v=2047';
import {readPackStore,savePackStore,newPack,normalizePack,openPack,collect} from './packs.js?v=2047';
import {SEALED_STORAGE_KEY,sealedPoolFromPacks,normalizeSealedSession,allowedSealedCopies,sealedCapacity} from './sealed.js?v=2047';
import {VISUAL_CHOICES,SOUND_CHOICES,readFxSettings,writeFxSettings,unlockAudio,playCue,setBgmPlaying} from './fx.js?v=2047';
import {playBoardCue,clearBoardCue} from './board-effects.js?v=2047';
import {createRoomSnapshotGate,actionScopeIsCurrent,matchesOriginalRoom} from './online-guards.js?v=2047';

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
  nickname:storage.getItem('duel-name')||'プレイヤー',activeTab:'duel',
  counts:{...selectedStoredDeck.counts},
  decks:storedDecks,deckDraft:null,deckFilterType:'all',deckFilterRarity:'all',deckSearch:'',deckOnly:false,deckSort:'default',
  duelCompact:storage.getItem('duel-compact')!=='0',
  handZoom:storage.getItem('saho-hand-zoom-v1')==='1',
  duelOpen:!!new URLSearchParams(location.search).get('room'),draftOpen:!!new URLSearchParams(location.search).get('draft'),draftFormat:'two',settingsOpen:false,
  galleryOpen:false,gallerySelected:null,galleryFilterType:'all',galleryFilterRarity:'all',gallerySearch:'',gallerySort:'default',galleryScrollTop:0,tabScrollY:{duel:0,gallery:0,decks:0,settings:0},
  pendingShare:null,shareError:'',
  game:null,roomCode:'',draftRoom:null,draftCode:'',demoDraft:false,seat:0,demo:false,selected:null,targetMode:null,specialDraft:null,deckOpen:false,deckInfoOpen:false,
  busy:false,sdk:null,db:null,uid:null,unsub:null,roomGate:null,cardUnsub:null,toastTimer:null,
  cardsOpen:false,cardDraft:null,cardManageType:'all',cardManageRarity:'all',cardManageQuery:'',customCards:stored('duel-custom-cards',{}),cardBusy:false,adminUnlocked:false,adminBusy:false,
  fxOpen:false,fxSettings:readFxSettings(),lastFxRevision:null,pendingDrawEvent:null,
  rules:readRuleSettings(storage),rulesOpen:false,appearanceOpen:false,appearance:stored('duel-appearance-v5',{mat:'nebula',back:'crest'}),
  packOpen:false,packDraft:null,packResults:null,packs:readPackStore(storage),collectionOnly:false,previewCardId:null,
  sealedOpen:false,sealedOnly:false,sealedSession:normalizeSealedSession(stored(SEALED_STORAGE_KEY,null)),
  duelToolsOpen:false,duelLogOpen:false,duelLogFilter:'all',graveSearch:'',graveFilterType:'all',
  lastRoom:existingDraft(LAST_ROOM_KEY),networkConnected:null,connectionEpoch:0,connectionUnsub:null,cardLibraryReady:false,
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
const manualTarget=t=>['ownMonster','enemyMonster','ownBackrow','enemyBackrow','eitherMonster','eitherBackrow'].includes(t);
const eitherSideTarget=t=>t==='eitherMonster'||t==='eitherBackrow';
const isGraveRevive=id=>CARD[id]?.ability?.operation==='reviveSelected'&&CARD[id]?.ability?.target==='eitherGraveMonster';
const effectNeedsTarget=id=>manualTarget(effectTarget(id));
const targetSpot=t=>({owner:t.startsWith('enemy')?'opponent':'mine',zone:t.endsWith('Backrow')?'backrow':'monsters'});
const cardTypeName=c=>c.type==='monster'?(c.historicalEffectPending?`${c.historicalOriginalKind||'効果'}モンスター（効果保留）`:(summonKind(c)==='normal'?(c.subtype==='effect'?'効果モンスター':'通常モンスター'):`${SUMMON_KINDS[summonKind(c)]}${c.subtype==='effect'?'・効果':''}モンスター`)):c.type==='spell'?SPELL_KINDS[spellKind(c)]:(c.historicalKind==='P'?'永続罠（効果は簡易）':c.historicalKind==='K'?'カウンター罠（効果は簡易）':c.historicalKind==='T'?'通常罠':'罠');
const isMine=()=>!!ui.game?.players?.[ui.seat];
const activePlayer=()=>ui.game?.players?.[ui.seat];
const myTurn=()=>ui.game?.turn===ui.seat&&ui.game?.status==='playing';
const inMain=()=>myTurn()&&!ui.game.pending&&['main1','main2'].includes(ui.game.phase);
const suffix=(c)=>c.type==='monster'?`★${c.level}　${c.attribute||'不明'}属性 / ${c.race||'不明'}族　ATK ${c.atk} / DEF ${c.def}`:cardTypeName(c);
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
const APPEARANCE_MATS=[
  {id:'nebula',label:'星雲',copy:'宇宙風のスタンダード背景'},
  {id:'forest',label:'森',copy:'緑系の落ち着いたマット'},
  {id:'lava',label:'溶岩',copy:'赤系の熱いバトル背景'},
  {id:'ocean',label:'深海',copy:'青系で見やすい背景'},
  {id:'aurora',label:'月光の極光',copy:'青い極光と氷原',asset:'appearance-mat-aurora.webp'},
  {id:'sanctum',label:'星殿の祭壇',copy:'金の幾何学模様',asset:'appearance-mat-sanctum.svg'},
];
const APPEARANCE_BACKS=[
  {id:'crest',label:'金の紋章',copy:'標準のクラシック裏面'},
  {id:'flame',label:'炎の渦',copy:'赤系の力強い裏面'},
  {id:'ice',label:'蒼の結晶',copy:'青系のクールな裏面'},
  {id:'midnight',label:'漆黒',copy:'黒基調のシックな裏面'},
  {id:'astral',label:'星霜の羅針',copy:'蒼緑の星紋様',asset:'appearance-back-astral.svg'},
  {id:'obsidian',label:'黒曜の紋章',copy:'紫黒と金の装飾',asset:'appearance-back-obsidian.svg'},
];
const appearanceLabel=(kind,id)=>((kind==='mat'?APPEARANCE_MATS:APPEARANCE_BACKS).find(x=>x.id===id)?.label)||id;
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
  const detail=c.historicalEffectPending?c.desc:(c.historicalKind&&c.status!=='exact'?c.desc:(effectText(c)||c.desc||''));
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

// The four idle tabs share the same view. Duel/online state is never rebuilt by tab navigation.
function renderHome(){
  const linkCode=new URLSearchParams(location.search).get('room')||'';
  const content=ui.activeTab==='gallery'?galleryModal(true):
    ui.activeTab==='decks'?deckModal(true):
    ui.activeTab==='settings'?settingsPage():
    `<section class="sv-home sv-duel-home" aria-label="デュエル">
      <div class="sv-hero sv-hero-compact">
        <img src="./sahoverse-icon-192.png?v=2047" width="66" height="66" alt="" class="sv-crest">
        <div class="sv-hero-text"><div class="sv-hero-title">SAHOVERSE</div><div class="sv-hero-sub">CARD DUEL</div></div>
      </div>
      <div class="sv-idle-kicker">BATTLE ARENA <span aria-hidden="true">/ 01</span></div>
      <h1 class="sv-page-title">デュエル</h1>
      ${btn('<span class="sv-duel-icon" aria-hidden="true">⚔</span><span>対戦を始める</span><span class="sv-chevron" aria-hidden="true">›</span>','openDuel','sv-duel-button')}
      <div class="sv-duel-menu">
        ${ui.lastRoom?.code?btn('↻ 前回の対戦に戻る','resumeRoom','sv-resume-button'):''}
        <div class="sv-draft-modes">${btn('✦ 2択ドラフト','openDraft','sv-draft-launch')}${btn('◇ 通常ドラフト','openOpenDraft','sv-draft-launch sv-draft-open-launch')}</div>
        ${btn('⚙ デュエルルール','openRules','sv-footer-tile sv-rule-launch')}
      </div>
    </section>
    ${ui.duelOpen?`<section class="panel sv-duel-setup" id="duel-setup">
      <div class="row between"><h2>対戦設定</h2>${btn('×','closeDuel','btn sm square') }</div>
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
    </section>`:''}`;
  return `${content}
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
    location.href=location.pathname+'?v=2047';
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
function settingsOptions(){
  return `<div class="sv-settings-options">
    <div class="sv-settings-group-title">ライブラリ・外観</div>
    ${btn('✦ カード管理','openCards','btn secondary wide sv-settings-card')}
    ${btn('カード裏面・プレイマット','settingsAppearance','btn secondary wide')}
    ${btn('演出・音量','settingsFx','btn secondary wide')}
    <div class="sv-backup-group">
      <div class="sv-settings-group-title">データ管理</div>
      ${btn('バックアップを保存','exportBackup','btn secondary wide')}
      <label class="btn secondary wide sv-import-label">バックアップから復元<input id="backupFile" type="file" accept=".json,application/json" hidden></label>
      <p class="tiny muted">デッキ・カード・パック・設定を復元。共有カードはFirebase側のデータが優先されます。</p>
    </div>
  </div>`;
}
function settingsPage(){
  return `<section class="sv-tab-page sv-settings-page" aria-label="設定">
    <div class="sv-page-heading"><div><div class="sv-section-label">PREFERENCES</div><h1>設定</h1></div></div>
    ${settingsOptions()}
  </section>`;
}
function settingsModal(){
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="設定"><div class="modal-box sv-settings">
    <div class="modal-title-line"><h2>設定</h2>${btn('×','closeSettings','btn sm square')}</div>
    ${settingsOptions()}
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
const historicByDeck=d=>Object.entries(HISTORICAL_PRESETS).find(([key])=>d.id===`d_historic${key}20012002`)?.[1];
const historicCardsText=counts=>Object.entries(counts||{}).map(([id,n])=>`<span>${esc(CARD[id]?.name||id)}${n>1?' ×'+n:''}</span>`).join('、');
function deckModal(embedded=false){
  if(!ui.deckDraft||embedded){
    const library=`    ${embedded?'<div class="sv-idle-kicker">DECK COLLECTION <span aria-hidden="true">/ 03</span></div>':''}<div class="modal-title-line"><h2>${embedded?'デッキ作成':'▤ マイデッキ'}</h2>${embedded?'':btn('×','closeDeck','btn sm square')}</div>
    <div class="sv-deck-library-stat"><span>MY DECKS</span><strong>${ui.decks.decks.length}</strong><span>/ ${MAX_SAVED_DECKS}</span><span class="sv-deck-library-stat-note">端末内に保存</span></div>
    ${existingDraft(DECK_DRAFT_KEY)?`<div class="sv-draft-reminder">編集中のデッキがあります ${btn('再開','resumeDeckDraft','btn sm primary')}${btn('破棄','discardDeckDraft','btn sm ghost')}</div>`:''}
    <div class="row wrap mt8">${btn('＋ 空から作る','deckNew','btn primary sm','',ui.decks.decks.length>=MAX_SAVED_DECKS)}${btn('🔥 紅蓮で作る','deckNewRed','btn sm','',ui.decks.decks.length>=MAX_SAVED_DECKS)}${btn('🌊 蒼海で作る','deckNewBlue','btn sm','',ui.decks.decks.length>=MAX_SAVED_DECKS)}</div><div class="sv-history-library-note">2001–2002年の復刻デッキ4種は自動追加済み。原作カードの効果には簡易再現・代替・保留があります。${Object.keys(HISTORICAL_PRESETS).some(key=>!ui.decks.decks.some(d=>d.id===`d_historic${key}20012002`))?btn('復刻デッキを再追加','deckRestoreHistoric','btn sm ghost','',ui.decks.decks.length>=MAX_SAVED_DECKS):''}</div>
    <div class="deck-saved-list">${ui.decks.decks.map(d=>`<section class="saved-deck ${d.id===ui.decks.activeId?'active':''}">
       <div class="row between"><b>${esc(d.name)}</b><span class="pill">${sum(d.counts)} / ${ui.rules.deckSize}枚 + EX ${sum(d.extraCounts||{})}</span></div>
       <div class="small muted">モンスター ${deckCountType(d.counts,'monster')}・魔法 ${deckCountType(d.counts,'spell')}・罠 ${deckCountType(d.counts,'trap')}・コスト ${deckCost(d.counts,CARD)}${ui.rules.costLimit?'/'+ui.rules.costLimit:''}</div>${historicByDeck(d)?`<details class="sv-history-deck-info"><summary>当時の収録内容（EX・サイド含む）</summary><p>発売：${esc(historicByDeck(d).releaseDate)}　メイン40枚</p><p><b>EX ${sum(historicByDeck(d).extraCounts)}枚：</b> ${historicCardsText(historicByDeck(d).extraCounts)}</p><p><b>サイド ${sum(historicByDeck(d).sideCounts)}枚：</b> ${historicCardsText(historicByDeck(d).sideCounts)}</p>${d.id==='d_historicka20012002'?'<p>※青眼の究極竜は3体融合が未対応のため、対戦用EXデッキへの登録を保留しています。</p>':''}</details>`:''}
       <div class="deck-controls">
         ${btn(d.id===ui.decks.activeId?'✓ 使用中':'使う','deckSelect','btn sm primary',`data-id="${esc(d.id)}"`,d.id===ui.decks.activeId||!validDeck(d.counts,ui.rules,d.extraCounts||{}))}
         ${btn('編集','deckEdit','btn sm',`data-id="${esc(d.id)}"`)}
         ${btn('共有','deckShare','btn sm secondary',`data-id="${esc(d.id)}"`,!validDeck(d.counts,ui.rules,d.extraCounts||{}))}
         ${btn('複製','deckClone','btn sm',`data-id="${esc(d.id)}"`,ui.decks.decks.length>=MAX_SAVED_DECKS)}
         ${btn('削除','deckDelete','btn sm ghost',`data-id="${esc(d.id)}"`,ui.decks.decks.length<=1)}
       </div></section>`).join('')}</div>

`;
    return embedded?`<section class="sv-tab-page sv-deck-page" aria-label="デッキ作成"><div class="sv-deck-page-content">${library}</div></section>${ui.deckDraft?deckModal():''}`:
      `<div class="modal" role="dialog" aria-modal="true" aria-label="デッキ管理"><div class="modal-box deck-manager">${library}</div></div>`;
  }
  const d=ui.deckDraft,counts=d.counts,extra=d.extraCounts||{};
  const pool=deckPool();
  const usable=validDeck(counts,ui.rules,extra)&&(!ui.collectionOnly||[...Object.entries(counts),...Object.entries(extra)].every(([id,n])=>n<=(pool[id]||0)));
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="デッキを作成・編集"><div class="modal-box deck-manager">
    <div class="modal-title-line"><h2>${ui.sealedOnly?'パック戦':'デッキ編集'}</h2>${btn('×','deckBack','btn sm square')}</div>
    <label for="deckName" class="field-label">デッキ名</label><input id="deckName" class="input" maxlength="28" value="${esc(d.name)}">
    <div class="sv-deck-stats"><span>メイン <b class="deck-total ${usable?'good':''}">${sum(counts)} / ${ui.rules.deckSize}</b></span><span class="sv-deck-types">M ${deckCountType(counts,'monster')} ・ S ${deckCountType(counts,'spell')} ・ T ${deckCountType(counts,'trap')}</span></div>
    <div class="sv-deck-progress ${usable?'is-ready':''}" role="progressbar" aria-label="メインデッキ枚数" aria-valuemin="0" aria-valuemax="${ui.rules.deckSize}" aria-valuenow="${sum(counts)}"><span class="sv-deck-progress-bar" style="width:${Math.min(100,100*sum(counts)/Math.max(1,ui.rules.deckSize))}%"></span></div>
    <div class="sv-deck-progress-note" id="deckProgressNote" aria-live="polite">${usable?'✓ 保存できます':sum(counts)<ui.rules.deckSize?`あと ${ui.rules.deckSize-sum(counts)} 枚`:'枚数・制限を確認してください'}</div>
    <div class="deck-cost-summary">合計コスト <b class="deck-cost-total">${deckCost(counts,CARD)}</b>${ui.rules.costLimit?` / ${ui.rules.costLimit} まで`:'（制限なし）'}</div>
    ${ui.sealedOnly?`<div class="notice">今回の開封分だけで構築（${ui.sealedSession?.drawn.length||0}枚）</div>`:''}
    <div class="sv-filter-strip"><input id="deckSearch" class="input" type="search" placeholder="カード名で検索" aria-label="デッキ編集：カード名で検索" autocomplete="off" value="${esc(ui.deckSearch)}"><label class="sv-check-chip"><input id="deckOnly" type="checkbox" ${ui.deckOnly?'checked':''}> 収録中</label></div>
    <details class="sv-deck-tools"><summary>詳細絞り込み・一括操作<span class="sv-deck-tools-active">${ui.deckFilterType!=='all'||ui.deckFilterRarity!=='all'?'（絞り込み中）':''}</span></summary>
      <div class="form-duo mt8"><div><label for="deckType" class="field-label">種類</label><select class="input" id="deckType"><option value="all">すべて</option>${['monster','spell','trap'].map(t=>`<option value="${t}" ${ui.deckFilterType===t?'selected':''}>${t==='monster'?'モンスター':t==='spell'?'魔法':'罠'}</option>`).join('')}</select></div>
      <div><label for="deckRarity" class="field-label">レアリティ</label><select class="input" id="deckRarity"><option value="all">すべて</option>${Object.entries(RARITIES).map(([v,n])=>`<option value="${v}" ${ui.deckFilterRarity===v?'selected':''}>${v} ${n}</option>`).join('')}</select></div></div>
      <div class="row wrap mt8">${ui.sealedOnly?'':`${btn('🔥 紅蓮を読み込む','loadRed','btn sm')}${btn('🌊 蒼海を読み込む','loadBlue','btn sm')}`}${btn('デッキを空にする','deckClear','btn sm ghost')}</div>
    </details>
    <div class="sv-deck-sort"><label for="deckSort">並び順</label><select class="input" id="deckSort" aria-label="デッキ編集：カードの並び順">
      ${[['default','登録順'],['included','収録枚数が多い順'],['name','名前順'],['atk','攻撃力が高い順'],['cost','コストが高い順']].map(([v,n])=>`<option value="${v}" ${ui.deckSort===v?'selected':''}>${n}</option>`).join('')}
    </select></div>
    <div class="sv-deck-results"><span id="deckMatchCount" aria-live="polite"></span>${btn('条件クリア','deckReset','btn sm ghost sv-deck-reset','hidden')}</div>
    <div class="sv-deck-empty" id="deckEmpty" hidden>該当するカードがありません。<div class="mt8">${btn('検索条件を解除','deckReset','btn sm secondary')}</div></div>
    <div class="deck-list mt8">${CARDS.filter(c=>summonKind(c)!=='fusion'&&(!ui.sealedOnly||pool[c.id]>0)).map((c,idx)=>`<div class="deck-item ${counts[c.id]?'sv-deck-included':''}" data-cardid="${esc(c.id)}" data-original-order="${idx}" data-cardtype="${esc(c.type)}" data-rarity="${esc(c.rarity||'N')}" data-cardname="${esc(c.name)}" data-cardsearch="${esc(c.name.toLocaleLowerCase('ja'))}">
      ${cardThumb(c)}<div class="grow"><div class="deck-item-title">${esc(c.name)} <span class="rarity-label rarity-text-${esc(c.rarity||'N')}">${esc(c.rarity||'N')}</span></div><div class="deck-item-detail">${esc(suffix(c))} · C${cardCost(c)} ${ui.collectionOnly?'· 所持'+(pool[c.id]||0):''}</div></div>
      ${btn('−','deckMinus','btn sm square',`data-id="${esc(c.id)}" aria-label="${esc(c.name)}を1枚減らす"`,!counts[c.id])}<span class="count">${counts[c.id]||0}</span>
      ${btn('＋','deckPlus','btn sm square',`data-id="${esc(c.id)}" aria-label="${esc(c.name)}を1枚増やす"`,(counts[c.id]||0)>=Math.min(cardLimit(c),ui.collectionOnly?(pool[c.id]||0):3)||sum(counts)>=ui.rules.deckSize)}</div>`).join('')}</div>
    <h3 class="mt8">EXデッキ <span class="pill ex-total">${sum(extra)} / 15</span></h3>
    <div class="small muted">融合モンスターはここに入れます（最大15枚）。</div>
    <div class="deck-list ex-deck-list">${CARDS.filter(c=>summonKind(c)==='fusion'&&(!ui.sealedOnly||pool[c.id]>0)).map(c=>`<div class="deck-item ex-deck-item">
     ${cardThumb(c)}<div class="grow"><b>${esc(c.name)}</b><div class="tiny muted">${esc(suffix(c))}${![2,3].includes(c.fusionMaterials?.length)?' · 素材情報未対応':''}</div></div>
     ${btn('−','extraMinus','btn sm square',`data-id="${esc(c.id)}"`,!extra[c.id])}<span class="ex-count">${extra[c.id]||0}</span>${btn('＋','extraPlus','btn sm square',`data-id="${esc(c.id)}"`,![2,3].includes(c.fusionMaterials?.length)||(extra[c.id]||0)>=Math.min(cardLimit(c),ui.collectionOnly?(pool[c.id]||0):3)||sum(extra)>=15)}
    </div>`).join('')}</div>
    <div class="sv-sticky-actions sv-deck-save">
      <div class="sv-save-total">メイン <strong class="sv-save-count">${sum(counts)} / ${ui.rules.deckSize}</strong>　 EX <strong class="sv-save-ex">${sum(extra)} / 15</strong></div>
      ${btn(d.isNew?'デッキを保存':'変更を保存','saveDeck','btn primary wide','',!usable)}
    </div>
  </div></div>`;
}
function deckCountType(counts,type){return Object.entries(counts).reduce((n,[id,count])=>n+(CARD[id]?.type===type?count:0),0);}
function cardDetailContent(c){
 const text=c.historicalKind&&c.status!=='exact'?(c.desc||'原作効果は再現待ち'):(effectText(c)||c.desc||'効果なし');
 const detailFacts=c.type==='monster'
   ?`<div class="sv-detail-stats"><div><span>LEVEL</span><b>★ ${Number(c.level)||0}</b></div><div><span>ATK</span><b>${Number(c.atk)||0}</b></div><div><span>DEF</span><b>${Number(c.def)||0}</b></div></div>`
   :`<div class="sv-detail-stats sv-detail-spell"><div><span>CATEGORY</span><b>${esc(cardTypeName(c))}</b></div><div><span>RARITY</span><b>${esc(c.rarity||'N')}</b></div></div>`;
 return `<div class="sv-detail-layout"><div class="gallery-detail-card card-demo">${cardHtml(c.id)}</div>
  <div class="sv-detail-information"><div class="sv-detail-overline">${esc(cardTypeName(c))} ・ ${esc(RARITIES[c.rarity]||'ノーマル')}</div>
  <h3>${esc(c.name)}</h3>${detailFacts}${c.type==='monster'?`<p class="sv-history-spec"><span>${esc(c.attribute||'未設定')}属性</span><span>${esc(c.race||'未設定')}族</span></p>`:''}${c.historicalKind?`<p class="sv-history-status">${c.historicalEffectPending?'効果未再現：通常モンスター相当で対戦':c.status==='proxy'?'代替効果で対戦':c.status==='simplified'?'簡易効果で対戦':c.status==='exact'?'効果再現済み':'収録データ再現'}</p>`:''}<div class="sv-detail-copy"><div class="sv-detail-copy-label">${c.type==='monster'?'カードテキスト':'効果・説明'}</div><p>${esc(text)}</p></div>
  <div class="sv-detail-foot">コスト ${cardCost(c)}　・　枚数制限 ${esc(LIMITS[c.limit||'unlimited']?.label||'無制限')}</div></div></div>`;
}
// Gallery-only sorting. Stable ties retain their original card registration order.
// No game-state changes, image decoding, storage writes or continuous observers.
const galleryNameCollator=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
const GALLERY_SORTS=new Set(['default','name','atk','def','level','cost']);
function gallerySortedCards(cards){
 const mode=GALLERY_SORTS.has(ui.gallerySort)?ui.gallerySort:'default';
 if(mode==='default')return cards;
 const sorted=[...cards];
 if(mode==='name')return sorted.sort((a,b)=>galleryNameCollator.compare(a.name,b.name));
 if(mode==='cost')return sorted.sort((a,b)=>cardCost(b)-cardCost(a));
 return sorted.sort((a,b)=>{
   // A spell or trap has no combat stats. Always place it after monsters.
   if(a.type!=='monster'&&b.type==='monster')return 1;
   if(a.type==='monster'&&b.type!=='monster')return -1;
   if(a.type!=='monster')return 0;
   return (Number(b[mode])||0)-(Number(a[mode])||0);
 });
}
function galleryVisibleIds(){
 const query=ui.gallerySearch.trim().toLocaleLowerCase('ja');
 const matched=CARDS.filter(c=>(ui.galleryFilterType==='all'||c.type===ui.galleryFilterType)
   &&(ui.galleryFilterRarity==='all'||(c.rarity||'N')===ui.galleryFilterRarity)
   &&c.name.toLocaleLowerCase('ja').includes(query));
 return gallerySortedCards(matched).map(c=>c.id);
}
/** Rearrange existing gallery nodes, preserving their images and listeners. */
function updateGalleryOrder(){
 const grid=$('view')?.querySelector('.gallery-grid');
 if(!grid)return;
 const nodes=new Map(Array.from(grid.querySelectorAll('.gallery-entry'),el=>[el.dataset.id,el]));
 const ordered=gallerySortedCards(CARDS);
 // A single DOM insertion avoids repeated layout and duplicate card markup.
 const fragment=document.createDocumentFragment();
 for(const card of ordered){const node=nodes.get(card.id);if(node)fragment.appendChild(node);}
 grid.appendChild(fragment);
}
function galleryModal(embedded=false){
  const visibleIds=ui.gallerySelected?galleryVisibleIds():[];
  const position=visibleIds.indexOf(ui.gallerySelected);

  const detail=ui.gallerySelected&&CARD[ui.gallerySelected]
    ?`<div class="modal sv-detail-modal" role="dialog" aria-modal="true" aria-label="${esc(CARD[ui.gallerySelected].name)} の詳細"><div class="modal-box gallery-dialog sv-detail-dialog">
      <div class="modal-title-line"><h2>カード詳細</h2>${btn('×','galleryBack','btn sm square')}</div>
      ${cardDetailContent(CARD[ui.gallerySelected])}
      <div class="sv-gallery-pager" role="group" aria-label="絞り込み結果のカードを切り替え">
        ${btn('‹ 前のカード','galleryPrev','btn secondary sv-gallery-page-button','',position<=0)}
        <span class="sv-gallery-position" aria-live="polite">${position>=0?position+1:'–'} / ${visibleIds.length}</span>
        ${btn('次のカード ›','galleryNext','btn secondary sv-gallery-page-button','',position<0||position>=visibleIds.length-1)}
      </div>${btn('一覧に戻る','galleryBack','btn primary wide sv-detail-close')}
    </div></div>`:'';
  if(ui.gallerySelected&&!detail)ui.gallerySelected=null;
  const list=`${embedded?'<div class="sv-idle-kicker">CARD ARCHIVE <span aria-hidden="true">/ 02</span></div>':''}<div class="modal-title-line"><h2>${embedded?'カード図鑑':'◈ カード図鑑'}</h2>${embedded?'':btn('×','closeGallery','btn sm square')}</div>
    <div class="sv-gallery-filter-panel"><div class="form-duo"><div><label for="galleryType" class="field-label">カード種類</label><select id="galleryType" class="input"><option value="all">すべて</option>${['monster','spell','trap'].map(t=>`<option value="${t}" ${ui.galleryFilterType===t?'selected':''}>${t==='monster'?'モンスター':t==='spell'?'魔法':'罠'}</option>`).join('')}</select></div>
    <div><label for="galleryRarity" class="field-label">レアリティ</label><select id="galleryRarity" class="input"><option value="all">すべて</option>${Object.entries(RARITIES).map(([v,n])=>`<option value="${v}" ${ui.galleryFilterRarity===v?'selected':''}>${v} ${n}</option>`).join('')}</select></div></div>
    <div class="sv-gallery-search"><input id="gallerySearch" class="input" type="search" aria-label="カード名で検索" value="${esc(ui.gallerySearch)}" placeholder="名前で検索" autocomplete="off"><button type="button" class="sv-gallery-search-clear" data-action="galleryClearSearch" id="galleryClearSearch" aria-label="検索語を消去" ${ui.gallerySearch?'':'hidden'}>×</button></div>
    <div class="sv-gallery-resultbar"><span id="galleryMatchCount" role="status" aria-live="polite"></span>${btn('条件をクリア','galleryReset','btn ghost sm sv-gallery-reset',ui.galleryFilterType==='all'&&ui.galleryFilterRarity==='all'&&!ui.gallerySearch?'hidden':'')}</div>
    <div class="sv-gallery-sort-row"><label for="gallerySort">並び順</label><select class="input" id="gallerySort" aria-label="カードの並び順">
      ${[['default','登録順'],['name','名前順'],['atk','攻撃力が高い順'],['def','守備力が高い順'],['level','レベルが高い順'],['cost','コストが高い順']].map(([value,label])=>`<option value="${value}" ${ui.gallerySort===value?'selected':''}>${label}</option>`).join('')}
    </select></div></div>
    <p id="galleryEmpty" class="sv-gallery-empty" hidden>一致するカードがありません。検索語や絞り込み条件を変更してください。</p>
    <div class="gallery-grid">${gallerySortedCards(CARDS).map(c=>`<button type="button" class="gallery-entry" data-action="galleryDetail" data-id="${esc(c.id)}" data-cardtype="${esc(c.type)}" data-rarity="${esc(c.rarity||'N')}" data-cardname="${esc(c.name)}" data-cardsearch="${esc(c.name.toLocaleLowerCase('ja'))}">
      <div class="gallery-card">${cardHtml(c.id)}</div><span class="gallery-caption">${esc(c.name)}</span><span class="sv-gallery-meta"><span class="sv-gallery-kind">${c.type==='monster'?'モンスター':c.type==='spell'?'魔法':'罠'}</span><span class="rarity-label rarity-text-${esc(c.rarity||'N')}">${esc(c.rarity||'N')}</span></span></button>`).join('')}</div>
    <p class="tiny muted">カードをタップすると、画像・効果・能力値を拡大表示できます。</p>`;
  return embedded?`<section class="sv-tab-page sv-gallery-page" aria-label="カード図鑑">${list}</section>${detail}`:
    detail||`<div class="modal" role="dialog" aria-modal="true" aria-label="カード図鑑"><div class="modal-box gallery-dialog">${list}</div></div>`;
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
 if(when==='summon'&&card?.type==='trap')return {destroyOnEnemySummon:OPERATIONS.destroyOnEnemySummon};
 if(when==='main'&&card?.type==='trap')return {graveRevive:OPERATIONS.graveRevive};
 if(when==='battleDamage')return card?.type==='monster'?{
   draw:OPERATIONS.draw,discardNewest:OPERATIONS.discardNewest,millFirstType:OPERATIONS.millFirstType
 }:{};
 const ordinarySpell=card?.type==='spell'&&spellKind(card)==='normal'&&when==='main';
 const fieldAura=card?.type==='spell'&&spellKind(card)==='field'&&when==='continuous';
 const equipPierce=card?.type==='spell'&&spellKind(card)==='equip'&&when==='continuous';
 const responseTrap=card?.type==='trap'&&when==='response';
 const attackTrap=card?.type==='trap'&&when==='attack';
 const special={stealUntilEnd:ordinarySpell,stealWithEquip:equipPierce,sealEnemyAttacks:ordinarySpell,removeSpellBackrow:ordinarySpell,banishSetBackrow:ordinarySpell,destroyThenSetBackrow:responseTrap,diceStats:when==='main'&&card?.type==='spell'&&spellKind(card)==='quick'||when==='attack'&&card?.type==='trap',extraNormalSummon:when==='continuous'&&card?.type==='trap',crushVirus:responseTrap,revealSetMonsters:responseTrap,negateWeakenAttacker:attackTrap,preventEquipAttack:when==='continuous'&&card?.type==='spell'&&spellKind(card)==='equip',tributeOtherToAttack:when==='continuous'&&card?.type==='monster',timeWizardCoin:when==='main'&&card?.type==='monster',selfSpecialFromHand:when==='main'&&card?.type==='monster',selfSpecialFromHandGiveRevive:when==='main'&&card?.type==='monster',lockWhileSourceFaceUp:when==='summon'&&card?.type==='monster',negateAndLockAttacker:attackTrap,lpRelativeEquip:equipPierce,fusionMaterialSubstitute:when==='continuous'&&card?.type==='monster',directEarthWaterFire:when==='continuous'&&card?.type==='monster',setAttackerDefense:attackTrap,destroyGiveOwn:ordinarySpell,borrowOpponentSpell:responseTrap,protectOwnTraps:responseTrap,redirectSpellTarget:responseTrap,lockPositionNextTurn:ordinarySpell,summonSheepTokens:when==='main'&&card?.type==='spell'&&['normal','quick'].includes(spellKind(card)),summonKuribohTokens:when==='main'&&card?.type==='spell'&&['normal','quick'].includes(spellKind(card)),summonRaceFromHand:when==='main'&&['monster','spell'].includes(card?.type)&&!(card?.type==='spell'&&spellKind(card)!=='normal'),reviveBothSet:ordinarySpell,millFirstType:false,summonNamedFromHand:when==='main'&&['monster','spell'].includes(card?.type),replaceHands:ordinarySpell,swapPrintedStats:ordinarySpell,recoverNormalAtk:responseTrap,earthAura:fieldAura,pierce:equipPierce,negateEndBattle:attackTrap,redirectAttack:attackTrap,redirectToAttackerAlly:attackTrap,destroyOnEnemySummon:when==='summon'&&card?.type==='trap',concealDefender:attackTrap,blastAttacker:attackTrap};
 const options=Object.entries(OPERATIONS).filter(([op])=>
   Object.hasOwn(special,op)&&!special[op]?false:
   op==='reflectAttack'&&!(when==='attack'&&card?.type==='trap')?false:
   op==='reviveSelected'&&!ordinarySpell?false:
   when==='continuous'?card?.type==='trap'?op==='extraNormalSummon':['boost','weaken','boostDef','weakenDef','earthAura','pierce','lpRelativeEquip','fusionMaterialSubstitute','directEarthWaterFire','tributeOtherToAttack','preventEquipAttack','stealWithEquip'].includes(op):
   when==='attack'?op!=='negateEffect':when==='response'?op!=='negateAttack':!['negateAttack','negateEffect'].includes(op));
 if(ordinarySpell){
   const index=options.findIndex(([op])=>op==='reviveSelected');
   if(index>0)options.splice(1,0,...options.splice(index,1));
 }
 return Object.fromEntries(options);
};
function passiveScaleFields(effect){
 if(effect.code==='specialByThreeNames'||effect.code==='reviveMaterialOnDestroy'){
  const count=effect.code==='specialByThreeNames'?3:2;
  return `<div class="sv-passive-editor"><p class="tiny muted">指定名のカードを完全一致で判定します。効果は追加の選択待ちなしに処理します。</p>${Array.from({length:count},(_,i)=>`<label class="field-label" for="cardNativeName${i+1}">モンスター名${i+1}</label><input id="cardNativeName${i+1}" class="input" maxlength="32" value="${esc(effect.names?.[i]||'')}">`).join('')}</div>`;
 }
 if(['preventBattleDamage','weakenOpponentOnGrave'].includes(effect.code))return '<p class="tiny muted">条件を満たした時だけ自動処理（クリボーは手札から発動）。チェーンの細かな裁定は省略します。</p>';

 if(effect.code==='recruitOnBattleDestroy')return `<div class="sv-passive-editor"><div class="form-duo"><div><label class="field-label" for="cardRecruitAttribute">特殊召喚するモンスターの属性</label><select class="input" id="cardRecruitAttribute">${selectOptions(Object.fromEntries(ATTRIBUTE_NAMES.map(x=>[x,x+'属性'])),effect.attribute||'地')}</select></div><div><label class="field-label" for="cardRecruitThreshold">元々のATK上限</label><input class="input" id="cardRecruitThreshold" type="number" min="0" max="5000" step="1" inputmode="numeric" value="${esc(effect.threshold??1500)}"></div></div><p class="tiny muted">戦闘破壊で墓地へ送られた時のみ。デッキの最初の候補を自動選択。空きゾーンがない場合は不発。</p></div>`;
 if(effect.code==='searchDeckOnSummon')return effect.filter==='named'?`<div class="sv-passive-editor"><label class="field-label" for="cardSearchName">デッキから探すカード名（完全一致）</label><input id="cardSearchName" class="input" maxlength="32" value="${esc(effect.name||'')}" placeholder="例：幻獣王ガゼル"></div>`:'';
 if(effect.code==='multiAttack')return `<div class="sv-passive-editor"><label class="field-label" for="cardMultiAttackCount">1回のバトルフェイズで攻撃できる回数</label><input class="input" id="cardMultiAttackCount" type="number" inputmode="numeric" min="2" max="5" step="1" value="${esc(effect.count??2)}"><p class="tiny muted">攻撃が無効になった場合も1回として数えます。守備表示では攻撃できません。</p></div>`;
 if(effect.code==='scoutDrawDiscardSpells')return `<div class="sv-passive-editor"><label class="field-label" for="cardScoutDrawAmount">リバース時に相手がドローする枚数</label><input class="input" id="cardScoutDrawAmount" type="number" inputmode="numeric" min="1" max="5" step="1" value="${esc(effect.amount??3)}"><p class="tiny muted">その中の魔法カードだけ墓地へ送ります。ドローの公開演出・チェーン応答は簡略化します。</p></div>`;
 if(effect.code==='returnOpponentOnFlip')return `<div class="sv-passive-editor"><label class="field-label" for="cardFlipBounceCount">手札に戻す最大枚数</label><input class="input" id="cardFlipBounceCount" type="number" inputmode="numeric" min="1" max="2" step="1" value="${esc(effect.amount??2)}"><p class="tiny muted">有効な対象を左端から自動選択します。お互いの場を選ぶ場合、相手の場を優先します。</p></div>`;
 if(effect.code==='searchStatOnGrave')return `<div class="sv-passive-editor"><div class="form-duo"><div><label class="field-label" for="cardGraveSearchThreshold">サーチ条件（ATK/DEFがこの数値以下）</label><input class="input" id="cardGraveSearchThreshold" type="number" inputmode="numeric" min="0" max="5000" step="1" value="${esc(effect.threshold??1500)}"></div><div><label class="field-label" for="cardGraveSearchLimit">ターン中の発動制限</label><select class="input" id="cardGraveSearchLimit">${selectOptions({none:'制限なし',restricted:'同名のサーチは1回・加えたカードと同名の効果を封じる'},effect.restrictActivation?'restricted':'none')}</select></div></div><p class="tiny muted">自分のデッキから最初の候補1体を手札に加えます。</p></div>`;
 if(effect.code==='millOpponentDeck')return `<div class="sv-passive-editor"><label class="field-label" for="cardFlipMillAmount">リバース時に墓地へ送る枚数</label><input class="input" id="cardFlipMillAmount" type="number" inputmode="numeric" min="1" max="10" step="1" value="${esc(effect.amount??5)}"><p class="tiny muted">反転召喚・戦闘による表側化で発動。チェーンによる応答は簡略化します。</p></div>`;
 if(effect.code==='battleImmuneAtkThreshold')return `<div class="sv-passive-editor"><label class="field-label" for="cardPassiveThreshold">戦闘相手のATKがこの数値以上なら破壊されない</label><input class="input" id="cardPassiveThreshold" type="number" inputmode="numeric" min="100" max="5000" step="1" value="${esc(effect.threshold??1900)}"><p class="tiny muted">戦闘ダメージはそのまま受けます。効果による破壊は防ぎません。</p></div>`;
 if(effect.code==='raceAuraGuard')return `<div class="sv-passive-editor"><div class="form-duo"><div><label class="field-label" for="cardPassiveRace">ATK上昇対象の種族</label><select class="input" id="cardPassiveRace">${selectOptions(Object.fromEntries(RACE_NAMES.map(x=>[x,x+'族'])),effect.race||'戦士')}</select></div><div><label class="field-label" for="cardPassiveAmount">ATK上昇値</label><input class="input" id="cardPassiveAmount" type="number" inputmode="numeric" min="50" max="2000" value="${esc(effect.amount??400)}"></div></div><p class="tiny muted">自身が表側の間、自分の指定種族を強化します。仲間のモンスターが1体以上存在すると、このカードを相手が攻撃対象に選べなくなります。</p></div>`;
 if(effect.code==='attributeFieldAura')return `<div class="sv-passive-editor"><div class="form-duo"><div><label class="field-label" for="cardPassiveAttribute">ATK上昇対象の属性</label><select class="input" id="cardPassiveAttribute">${selectOptions(Object.fromEntries(ATTRIBUTE_NAMES.map(x=>[x,x+'属性'])),effect.attribute||'地')}</select></div><div><label class="field-label" for="cardPassiveAmount">ATK上昇値</label><input class="input" id="cardPassiveAmount" type="number" inputmode="numeric" min="50" max="2000" value="${esc(effect.amount??500)}"></div></div><div class="form-duo"><div><label class="field-label" for="cardPassiveNegativeAttribute">ATK減少対象の属性</label><select class="input" id="cardPassiveNegativeAttribute">${selectOptions(Object.fromEntries(ATTRIBUTE_NAMES.map(x=>[x,x+'属性'])),effect.negativeAttribute||'風')}</select></div><div><label class="field-label" for="cardPassiveNegativeAmount">ATK減少値</label><input class="input" id="cardPassiveNegativeAmount" type="number" inputmode="numeric" min="50" max="2000" value="${esc(effect.negativeAmount??400)}"></div></div><p class="tiny muted">表側で存在する間、該当するモンスターのATKに適用。両方同じ属性には指定できません。</p></div>`;
 const amount=Number.isInteger(effect.amount)?effect.amount:(defaultPassiveConfig(effect.code)?.amount||500);
 const amountLabel=effect.code==='battleAttributeScale'?'戦闘時のATK上昇値':'1枚・1体あたりのATK上昇値';
 const amountField=`<div><label class="field-label" for="cardPassiveAmount">${amountLabel}</label><input class="input" id="cardPassiveAmount" type="number" inputmode="numeric" min="50" max="2000" step="1" value="${esc(amount)}"></div>`;
 if(effect.code==='countStatScale'){
  const options=(values,suffix)=>({'':'指定なし',...Object.fromEntries(values.map(v=>[v,v+suffix]))});
  const field=(id,label,choices,selected)=>`<div><label class="field-label" for="${id}">${label}</label><select class="input" id="${id}">${selectOptions(choices,selected??'')}</select></div>`;
  const zones=effect.zones||['grave'];
  const kinds=Object.fromEntries(Object.entries(COUNT_MONSTER_KINDS).filter(([key])=>key!=='token'||zones.includes('field')));
  return `<div class="sv-passive-editor">
    <div class="form-duo">${amountField}${field('cardCountStat','上昇する能力', {atk:'ATK',def:'DEF'},effect.stat)}</div>
    <fieldset><legend class="field-label">数える場所（複数選択可）</legend><div class="row wrap">
      ${Object.entries(COUNT_STAT_ZONES).map(([key,label])=>`<label><input type="checkbox" id="cardCountZone-${key}" ${zones.includes(key)?'checked':''} ${zones.length===1&&zones.includes(key)?'disabled':''}> ${label}</label>`).join('')}
    </div></fieldset>
    <div class="form-duo">
      ${field('cardCountAttribute','属性',options(ATTRIBUTE_NAMES,'属性'),effect.attribute)}
      ${field('cardCountRace','種族',options(RACE_NAMES,'族'),effect.race)}
      ${field('cardCountLevel','レベル',options(Array.from({length:12},(_,i)=>String(i+1)),''),effect.level==null?'':String(effect.level))}
      ${field('cardCountMonsterKind','モンスターの種類',{'':'指定なし',...kinds},effect.monsterKind)}
    </div>
    ${Array.from({length:3},(_,i)=>`<label class="field-label" for="cardCountName${i+1}">カード名${i+1}（任意）</label><input class="input" id="cardCountName${i+1}" maxlength="32" value="${esc(effect.names?.[i]||'')}">`).join('')}
    <p class="tiny muted">カード名はいずれかに完全一致。属性など、ほかの条件はすべて満たす必要があります。</p>
  </div>`;
 }
 const scopeField=''; // Scope is now chosen in the common ② 対象 selector.
 if(effect.code==='graveNamedScale')return `<div class="sv-passive-editor"><div class="form-duo">${amountField}${scopeField}</div><div class="form-duo"><div><label class="field-label" for="cardPassiveName1">数えるカード名①</label><input class="input" id="cardPassiveName1" maxlength="32" value="${esc(effect.names?.[0]||'')}"></div><div><label class="field-label" for="cardPassiveName2">カード名②（任意）</label><input class="input" id="cardPassiveName2" maxlength="32" value="${esc(effect.names?.[1]||'')}"></div></div><p class="tiny muted">名前は完全一致で判定します。同名カードは墓地にある枚数分を数えます。</p></div>`;
 if(effect.code==='raceFieldGraveScale')return `<div class="sv-passive-editor"><div class="form-duo">${amountField}${scopeField}</div><label class="field-label" for="cardPassiveRace">数える種族（表側の場・墓地）</label><select class="input" id="cardPassiveRace">${selectOptions(Object.fromEntries(RACE_NAMES.map(x=>[x,x+'族'])),effect.race||'ドラゴン')}</select><p class="tiny muted">裏側表示モンスターは数えません。</p></div>`;
 if(effect.code==='battleAttributeScale')return `<div class="sv-passive-editor"><div class="form-duo">${amountField}<div><label class="field-label" for="cardPassiveAttribute">戦闘相手の属性</label><select class="input" id="cardPassiveAttribute">${selectOptions(Object.fromEntries(ATTRIBUTE_NAMES.map(x=>[x,x+'属性'])),effect.attribute||'闇')}</select></div></div><p class="tiny muted">戦闘中のダメージ計算時だけ適用されます。直接攻撃には適用しません。</p></div>`;
 return '';
}
// The same 3-step vocabulary is used by built-in abilities and native historical effects.
// Only compatible combinations are selectable; fixed-target effects remain visibly fixed.
function nativeRecipeTarget(e,card){
 if(card?.type==='spell'||card?.type==='trap'){const targets={draw2:'自分のデッキ',heal1000:'自分のLP',destroy:'相手のモンスター',boost500:'自分のモンスター',burn800:'相手のLP',negate:'相手の攻撃',counterdestroy:'攻撃モンスター',counterburn:'相手の攻撃'};return `<select class="input" disabled aria-label="対象はこの効果で固定"><option>${esc(targets[card.effect]||'効果によって固定')}</option></select>`;}
 if(['countStatScale','graveNamedScale','raceFieldGraveScale','attributeFieldAura'].includes(e?.code))
   return `<select class="input" id="cardPassiveScope" aria-label="数えるカードの側">${selectOptions(PASSIVE_SCOPES,e.scope||'both')}</select>`;
 if(e?.code==='recruitOnBattleDestroy')return `<select class="input" id="cardRecruitTarget" disabled><option>自分のデッキの指定属性・ATK以下</option></select>`;
 if(['returnOpponentOnFlip','destroyOpponentOnFlip'].includes(e?.code))return `<select class="input" id="cardFlipScope" aria-label="対象にできる場">${selectOptions(PASSIVE_SCOPES,e.scope||'opponent')}</select>`;
 if(e?.code==='searchStatOnGrave')return `<select class="input" id="cardGraveSearchStat">${selectOptions({atk:'自分のデッキのATK指定値以下',def:'自分のデッキのDEF指定値以下'},e.stat||'atk')}</select>`;
 if(e?.code==='searchDeckOnSummon')
   return `<select class="input" id="cardSearchFilter">${selectOptions({ritualMonster:'自分のデッキの儀式モンスター',ritualSpell:'自分のデッキの儀式魔法',named:'自分のデッキの指定名カード'},e.filter||'ritualMonster')}</select>`;
 const fixed={cyberJarRevealFive:'お互いのフィールド・デッキ（自動処理）',morphingJarTwo:'お互いのフィールド・デッキ（自動処理）',soloHandNoTribute:'自分の手札',doubleLightTribute:'自分自身（リリース時）',returnOpponentOnFlip:'相手のモンスター（左端から最大2体）',destroyOpponentOnFlip:'相手のモンスター（左端を自動選択）',recoverOwnSpellOnFlip:'自分の墓地の魔法（最初を自動選択）',destroyOnAttackToDefense:'相手のモンスター（左端を自動選択）',millOpponentDeck:'相手のデッキ',scoutDrawDiscardSpells:'相手の手札・デッキ',graveNamedScale:'墓地の指定カード',battleAttributeScale:'戦闘相手の指定属性',battleImmuneAtkThreshold:'戦闘相手',raceAuraGuard:'自分の指定種族',attributeFieldAura:'表側表示の指定属性',raceFieldGraveScale:'場・墓地の指定種族',recruitOnBattleDestroy:'自分デッキの指定属性・ATK以下',copyOpponentPrintedStats:'相手の表側モンスター（左端）',destroyAttachedEquip:'自身に装備されたカード',doubleOriginalAtkEndDestroy:'自分自身',selfReturnHand:'自分自身',postAttackDefenseLock:'自分自身',multiAttack:'自分自身',darkMagicianGrave300:'お互いの墓地',enemyDragon500:'相手の場・墓地',darkBattle500:'闇属性の戦闘相手',atk300:'自分自身',atk500:'自分自身',draw1:'自分のデッキ',heal500:'自分のLP',burn500:'相手のLP',destroy1:'相手のモンスター'};
 return `<select class="input" disabled aria-label="この効果の対象は固定"><option>${esc(fixed[e?.code]||'自分自身')}</option></select>`;
}
function draftEffectFields(d){
 const isEffect=d.type!=='monster'||d.subtype==='effect';if(!isEffect)return '';
 const mode=d.ability?'builder':'preset';
 const kind=spellKind(d);
 const whenChoices=d.type==='trap'?{main:TRIGGERS.main,attack:TRIGGERS.attack,response:TRIGGERS.response,summon:'相手の通常召喚・反転召喚に自動対応',continuous:'表側の間ずっと（追加通常召喚）'}:d.type==='spell'? (
   kind==='equip'?{continuous:TRIGGERS.continuous}:persistentSpell(d)?{main:TRIGGERS.main,continuous:TRIGGERS.continuous}:{main:TRIGGERS.main}):
   {main:TRIGGERS.main,summon:TRIGGERS.summon,battleDamage:TRIGGERS.battleDamage,continuous:TRIGGERS.continuous};
 const when=whenChoices[d.ability?.when]?d.ability.when:Object.keys(whenChoices)[0];
 const operations=availableOperations(when,d);
 const op=operations[d.ability?.operation]?d.ability.operation:Object.keys(operations)[0];
 const targetsAllowed=abilityTargets(op,when,d.type,kind);
 const targets=Object.fromEntries(targetsAllowed.map(k=>[k,TARGETS[k]]));
 const target=targetsAllowed.includes(d.ability?.target)?d.ability.target:targetsAllowed[0];
 const costOptions=abilityCostOptions(op,target);
 const sequenceOptions={single:'通常（1つの効果）',
   ...(op!=='stealUntilEnd'?{ifResolved:'最初の効果を処理した場合、続けて追加効果'}:{}),
   sequential:'発動時にコストを払う（従来方式）'};
 const meta=ABILITY_META[op];
 const numeric=meta.min!==undefined;
 const nextOperations=Object.fromEntries(Object.entries(availableOperations(when,d)).filter(([key])=>followUpTargets(key,target,when,d.type,kind).length));
 const nextOp=nextOperations[d.ability?.then?.operation]?d.ability.then.operation:Object.keys(nextOperations)[0];
 const nextTargets=nextOp?followUpTargets(nextOp,target,when,d.type,kind):[];
 const nextTarget=nextTargets.includes(d.ability?.then?.target)?d.ability.then.target:nextTargets[0];
 const nextMeta=nextOp?ABILITY_META[nextOp]:null;
 const numericNext=!!nextMeta&&nextMeta.min!==undefined;
 const amount=Number.isSafeInteger(d.ability?.amount)&&
   (!numeric?d.ability.amount===0:d.ability.amount>=meta.min&&d.ability.amount<=meta.max)
     ?d.ability.amount:meta.amount;
 return `<div class="effect-builder"><h3>✦ 効果エディター</h3><p class="small muted">発動条件・対象・効果・数値を選択します。組み合わせられない複雑な効果は例外効果一覧を使用してください。</p>
 ${kind==='equip'&&d.type==='spell'?'<p class="small muted">装備魔法：自分・相手のモンスターを選んで強化／弱体化できます。</p>':
 `<label class="field-label" for="cardEffectMode">設定方式</label><select id="cardEffectMode" class="input">${selectOptions({builder:'組み合わせ式（発動する効果）',preset:'例外の効果一覧（永続・リバースなど）'},mode)}</select>`}
 ${mode==='builder'?`<div class="sv-recipe-grid sv-recipe-four"><div><label class="field-label" for="cardAbilityWhen">発動条件</label><select id="cardAbilityWhen" class="input">${selectOptions(whenChoices,when)}</select></div>
 <div><label class="field-label" for="cardAbilityTarget">対象</label><select id="cardAbilityTarget" class="input">${selectOptions(targets,target)}</select></div>
 <div><label class="field-label" for="cardAbilityOperation">効果</label><select id="cardAbilityOperation" class="input">${selectOptions(operations,op)}</select></div>
 <div><label class="field-label" for="cardAbilityAmount">数値</label><input id="cardAbilityAmount" class="input" type="number" inputmode="numeric" step="1" min="${numeric?meta.min:0}" max="${numeric?meta.max:0}" value="${amount}" ${numeric?'':'disabled'}></div></div>
 ${['searchNamed','summonNamedFromHand'].includes(op)?`<div class="form-duo sv-search-params"><div><label class="field-label" for="cardNamedMatch">名前の条件</label><select id="cardNamedMatch" class="input">${selectOptions(op==='summonNamedFromHand'?{exact:'完全一致'}:{exact:'完全一致',contains:'名前に含む'},d.ability?.match||'exact')}</select></div><div><label class="field-label" for="cardNamedQuery">探すカード名・文字（最大32文字）</label><input id="cardNamedQuery" class="input" maxlength="32" value="${esc(d.ability?.query??(op==='summonNamedFromHand'?'ランプの魔精・ラ・ジーン':'融合'))}" placeholder="カード名"></div></div><p class="tiny muted">${op==='summonNamedFromHand'?'手札に同名モンスターがいて、場に空きがある場合に特殊召喚。先頭候補を自動選択します。':'デッキ内で先に見つかったカードを自動選択します。該当カードなしの場合は何もしません。'}</p>`:''}
 ${op==='summonRaceFromHand'?`<div class="sv-search-params form-duo"><div><label class="field-label" for="cardSummonRace">特殊召喚する種族</label><select id="cardSummonRace" class="input">${selectOptions(Object.fromEntries(RACE_NAMES.map(r=>[r,r])),d.ability?.query||'ドラゴン')}</select></div><div><label class="field-label" for="cardSummonRequired">場に必要な表側モンスター名（省略可）</label><input id="cardSummonRequired" class="input" maxlength="48" value="${esc(d.ability?.requiredFaceUpName||'')}" placeholder="条件なし"></div><p class="tiny muted">手札の先頭から自動選択。場の空きに応じて最大2体まで特殊召喚。</p></div>`:''}
 ${op==='summonSheepTokens'?`<p class="tiny muted">4枠と未使用の通常召喚権が必要です。発動ターンは通常召喚・反転召喚・主な特殊召喚ができません。羊トークンをアドバンス召喚のリリースには使えません。</p>`:''}
 ${op==='sealEnemyAttacks'?`<p class="tiny muted">相手の次の3ターンは新たに召喚したモンスターも攻撃できません。魔法カードは発動後に墓地へ送られます。</p>`:''}
 ${op==='summonKuribohTokens'?`<p class="tiny muted">自分の表側「クリボー」が必要。発動時に自動リリースして、空き枠すべてにクリボートークンを守備表示で生成します。</p>`:''}
 ${op==='extraNormalSummon'?`<p class="tiny muted">セットした次のターン以降、メインフェイズに表にする。通常召喚を使い切った後も1体につき500LPで追加召喚・セットできます。</p>`:''}
 ${op==='reviveBothSet'?`<p class="tiny muted">双方の墓地に通常召喚可能なモンスターと空きゾーンが必要。各自1体を裏側守備で蘇生します。</p>`:''}
 ${op==='millFirstType'?`<div class="sv-search-params"><label class="field-label" for="cardMillType">墓地へ送るカードの種類</label><select id="cardMillType" class="input">${selectOptions({monster:'モンスター',spell:'魔法',trap:'罠'},['monster','spell','trap'].includes(d.ability?.match)?d.ability.match:'monster')}</select><p class="tiny muted">相手デッキから最初に見つかったカード1枚を自動選択。候補がなければ処理なし。</p></div>`:''}
 ${(['main','attack','response'].includes(when)&&!['summonSheepTokens','summonKuribohTokens'].includes(op))?`<div class="sv-sequence-controls"><label class="field-label" for="cardAbilitySequence">効果の構成</label><select id="cardAbilitySequence" class="input">${selectOptions(sequenceOptions,d.ability?.then?'ifResolved':d.ability?.before?'sequential':'single')}</select>
 ${d.ability?.then&&nextMeta?`<div class="sv-sequence-stage"><b>した場合、</b><div class="sv-recipe-grid sv-recipe-three"><div><label class="field-label" for="cardThenTarget">対象</label><select id="cardThenTarget" class="input">${selectOptions(Object.fromEntries(nextTargets.map(t=>[t,TARGETS[t]])),nextTarget)}</select></div><div><label class="field-label" for="cardThenOperation">効果</label><select id="cardThenOperation" class="input">${selectOptions(nextOperations,nextOp)}</select></div><div><label class="field-label" for="cardThenAmount">数値</label><input id="cardThenAmount" class="input" type="number" inputmode="numeric" step="1" min="${numericNext?nextMeta.min:0}" max="${numericNext?nextMeta.max:0}" value="${numericNext?d.ability.then.amount:0}" ${numericNext?'':'disabled'}></div></div><p class="tiny muted">最初の効果が実際に処理された場合のみ続けて実行。追加効果の対象は自動で特定できる範囲、または最初と同じカードに限定します。</p></div>`:''}
 ${d.ability?.before?`<div class="sv-sequence-stage"><b>① A｜発動に必要な処理</b><label class="field-label" for="cardBeforeOperation">Aの種類</label><select id="cardBeforeOperation" class="input">${selectOptions(Object.fromEntries(costOptions.map(k=>[k,BEFORE_META[k].label])),d.ability.before.operation)}</select>
 <label class="field-label" for="cardBeforeAmount">Aで使う枚数・体数・LP（直接入力）</label><input id="cardBeforeAmount" class="input" type="number" inputmode="numeric" step="1" min="1" max="${BEFORE_META[d.ability.before.operation]?.max||1}" value="${esc(d.ability.before.amount)}"><p class="tiny muted">フィールド・手札のカードは発動時に選択。LP・デッキ・墓地は自動処理。Aを実行できない場合は発動不可です。</p></div>`:''}</div>`:''}
 <p class="small muted mt8 sv-effect-preview" aria-live="polite" style="white-space:pre-line">${esc(abilityText({when,operation:op,target,amount,...(['searchNamed','summonNamedFromHand'].includes(op)?{match:d.ability?.match||'exact',query:d.ability?.query||''}:{}),...(op==='summonRaceFromHand'?{match:'race',query:d.ability?.query||'ドラゴン',...(d.ability?.requiredFaceUpName?{requiredFaceUpName:d.ability.requiredFaceUpName}:{})}:{}),...(op==='millFirstType'?{match:d.ability?.match||'monster'}:{}),...(d.ability?.before?{before:d.ability.before}:{}),...(d.ability?.then?{then:d.ability.then}:{})}))}</p>
 ${op==='reviveSelected'?'<div class="sv-operation-help">発動時に自分・相手の墓地からモンスターを1体選びます。自分のモンスターゾーンに空きが必要です。</div>':''}
 <p class="tiny muted">整数を直接入力。自分へのダメージ・相手の回復も可能です。通常の攻守変化はターン終了で戻り、永続効果は継続します。対象がいない効果は不発です。</p>`:
 `<div class="sv-recipe-grid sv-recipe-four">${d.type==='monster'?`<div><label class="field-label" for="cardEffectKind">発動条件</label><select class="input" id="cardEffectKind">${selectOptions({summonRule:'召喚・リリースの例外ルール',continuous:'表側の間・戦闘中など',ignition:'自分メインフェイズで',trigger:'召喚・反転召喚したとき（対応効果のみ）',flip:'リバースしたとき',position:'攻撃表示から守備表示に手動変更したとき',endPhase:'自分エンドフェイズに',grave:'フィールドから墓地へ送られたとき',battle:'戦闘で破壊され墓地へ送られたとき'},d.monsterEffect?.kind||'ignition')}</select></div>`:`<div><label class="field-label">発動条件</label><select class="input" disabled><option>${d.type==='spell'?'魔法を発動したとき':'相手が攻撃したとき'}</option></select></div>`}
 <div><label class="field-label">対象</label>${nativeRecipeTarget(d.monsterEffect,d)}</div>
 <div><label class="field-label" for="cardEffectCode">効果</label><select class="input" id="cardEffectCode">${selectOptions(d.type==='monster'?MONSTER_EFFECTS[d.monsterEffect?.kind||'ignition']:d.type==='spell'?MAGIC_EFFECTS:TRAP_EFFECTS,d.type==='monster'?d.monsterEffect?.code:d.effect)}</select></div><div><label class="field-label">数値</label><span class="input sv-fixed-number" aria-label="数値は効果ごとの詳細設定で指定">${d.monsterEffect?.amount??d.monsterEffect?.count??d.monsterEffect?.threshold??'指定不要・詳細で設定'}</span></div></div>`}
 ${d.type==='monster'&&(PASSIVE_SCALE_CODES.includes(d.monsterEffect?.code)||['millOpponentDeck','scoutDrawDiscardSpells','multiAttack','searchDeckOnSummon','returnOpponentOnFlip','searchStatOnGrave'].includes(d.monsterEffect?.code))?passiveScaleFields(d.monsterEffect):''}
 ${d.type==='monster'&&d.monsterEffect?`<p class="small muted mt8 sv-effect-preview" aria-live="polite">${esc(effectText({monsterEffect:d.monsterEffect}))}</p>`:''}
 <p class="tiny muted mt8">永続補正は場・墓地の状況に応じ自動更新され、戦闘時補正はダメージ計算に反映します。儀式・融合魔法は専用の効果を使います。</p></div>`;
}
/** Reusable recipes are stored on this device and included in local backups. */
function effectTemplateFields(d){
 const all=readTemplates(storage);
 const own=all.filter(t=>canApplyTemplate(t,d));
 const shipped=BUILTIN_EFFECT_TEMPLATES.filter(t=>canApplyTemplate(t,d));
 const applicable=[...shipped,...own];
 const option=t=>`<option value="${esc(t.id)}" data-description="${esc(templateDescription(t))}">${esc(t.name)}</option>`;
 const choices=`${shipped.length?`<optgroup label="標準テンプレート">${shipped.map(option).join('')}</optgroup>`:''}${own.length?`<optgroup label="マイ効果">${own.map(option).join('')}</optgroup>`:''}`;
 return `<details class="sv-effect-template-manager"><summary>効果テンプレート <span class="tiny muted">標準${BUILTIN_EFFECT_TEMPLATES.length}種・マイ${all.length}件</span></summary>
   <p class="tiny muted">標準テンプレートはカードの種類に応じて表示。選んで適用した後、組み合わせ式で調整できます。登録した効果は端末バックアップに含まれます。</p>
   <div class="sv-template-save"><label class="field-label" for="effectTemplateName">この効果をマイ効果に登録</label><div class="row"><input id="effectTemplateName" class="input grow" maxlength="32" placeholder="効果の名前（32字以内）" autocomplete="off">${btn('登録','saveEffectTemplate','btn sm primary')}</div></div>
   ${applicable.length?`<label class="field-label" for="effectTemplateSelect">呼び出す効果</label><select id="effectTemplateSelect" class="input" aria-label="効果テンプレート">${choices}</select><div class="sv-template-actions row wrap">${btn('適用','applyEffectTemplate','btn sm secondary')}${btn('マイ効果を削除','deleteEffectTemplate','btn sm ghost')}</div><p class="tiny muted sv-template-description">選択中：${esc(templateDescription(applicable[0]))}</p>`:'<p class="tiny muted">このカードの種類に対応するテンプレートはありません。</p>'}
   <p class="tiny muted">標準テンプレートは削除できません。異なるカード種類（魔法は異なる魔法種別）には適用できません。既存カードは変更されません。</p>
 </details>`;
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
function appearanceChoiceTile(kind,opt,current){
 const selected=current===opt.id;
 if(kind==='mat')return `<button type="button" class="gallery-entry sv-appearance-entry ${selected?'is-selected':''}" data-action="appearancePick" data-kind="mat" data-value="${esc(opt.id)}" aria-pressed="${selected?'true':'false'}" aria-label="プレイマット ${esc(opt.label)}">
   <div class="sv-appearance-thumb sv-mat-preview sv-mat-preview--${esc(opt.id)}" aria-hidden="true">
     ${opt.asset?`<img class="sv-appearance-asset" src="./${esc(opt.asset)}" alt="" loading="lazy" decoding="async">`:''}
     <div class="sv-mat-preview-zones">
       <span></span><span></span><span></span><span></span><span></span>
       <span></span><span></span><span></span><span></span><span></span>
     </div>
   </div>
   <span class="sv-appearance-entry-title">${esc(opt.label)}</span>
   <span class="sv-appearance-entry-copy">${esc(opt.copy)}</span>
   ${selected?'<span class="sv-appearance-badge">選択中</span>':''}
 </button>`;
 return `<button type="button" class="gallery-entry sv-appearance-entry ${selected?'is-selected':''}" data-action="appearancePick" data-kind="back" data-value="${esc(opt.id)}" aria-pressed="${selected?'true':'false'}" aria-label="カード裏面 ${esc(opt.label)}">
   <div class="sv-appearance-thumb sv-back-preview sv-back-preview--${esc(opt.id)}" aria-hidden="true">
     <div class="sv-cardback-thumb">
       ${opt.asset?`<img class="sv-appearance-cardback-asset" src="./${esc(opt.asset)}" alt="" loading="lazy" decoding="async">`:''}
       <div class="sv-cardback-inner"></div>
       <div class="sv-cardback-emblem">✦</div>
     </div>
   </div>
   <span class="sv-appearance-entry-title">${esc(opt.label)}</span>
   <span class="sv-appearance-entry-copy">${esc(opt.copy)}</span>
   ${selected?'<span class="sv-appearance-badge">選択中</span>':''}
 </button>`;
}
function appearanceGallerySection(kind,current){
 const list=kind==='mat'?APPEARANCE_MATS:APPEARANCE_BACKS;
 const title=kind==='mat'?'プレイマット':'カード裏面';
 return `<section class="sv-appearance-section"><div class="row between sv-appearance-heading"><label class="field-label">${title}</label><span class="pill" data-appearance-current="${kind}" aria-live="polite">選択中：${esc(appearanceLabel(kind,current))}</span></div>
 <div class="gallery-grid sv-appearance-grid">${list.map(opt=>appearanceChoiceTile(kind,opt,current)).join('')}</div></section>`;
}
function appearanceModal(){const x=ui.appearance;
 return `<div class="modal" role="dialog" aria-modal="true" aria-label="デザイン設定"><div class="modal-box sv-appearance-modal"><div class="modal-title-line"><h2>🎨 デザイン設定</h2>${btn('×','closeAppearance','btn sm square')}</div>
 <p class="small muted">カード図鑑のように一覧からタップして選べます。見た目だけを変更し、このiPhoneごとに保存されます。</p>
 <div class="sv-appearance-scroller">${appearanceGallerySection('mat',x.mat)}${appearanceGallerySection('back',x.back)}</div>
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
  return {id:`u_${random}`,name:'',rarity:'N',limit:'unlimited',cost:2,type:'monster',subtype:'normal',summonKind:'normal',attribute:'光',race:'魔法使い',level:4,atk:1500,def:1200,emoji:'✨',desc:'',image:'',fx:{visual:'auto',sound:'auto'},monsterEffect:{kind:'ignition',code:'burn500'}};
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
      ${isMonster?`<label class="field-label" for="cardSummonKind">召喚方法</label><select id="cardSummonKind" class="input">${selectOptions(SUMMON_KINDS,summonKind(d))}</select><div class="form-duo mt8"><div><label class="field-label" for="cardAttribute">属性</label><select class="input" id="cardAttribute">${selectOptions(Object.fromEntries(ATTRIBUTE_NAMES.map(x=>[x,x])),d.attribute||'光')}</select></div><div><label class="field-label" for="cardRace">種族</label><select class="input" id="cardRace">${selectOptions(Object.fromEntries(RACE_NAMES.map(x=>[x,x+'族'])),d.race||'魔法使い')}</select></div></div>`:''}
      ${isMonster&&summonKind(d)==='fusion'?`<div class="form-duo"><div><label class="field-label">融合素材①</label><select id="fusionMat1" class="input">${selectOptions(Object.fromEntries(CARDS.filter(c=>c.type==='monster'&&summonKind(c)!=='fusion'&&c.id!==d.id).map(c=>[c.id,c.name])),d.fusionMaterials?.[0]||'m03')}</select></div>
      <div><label class="field-label">融合素材②</label><select id="fusionMat2" class="input">${selectOptions(Object.fromEntries(CARDS.filter(c=>c.type==='monster'&&summonKind(c)!=='fusion'&&c.id!==d.id).map(c=>[c.id,c.name])),d.fusionMaterials?.[1]||'m12')}</select></div></div>
      <label class="field-label" for="fusionMat3">融合素材③（任意・3体融合）</label><select id="fusionMat3" class="input">${selectOptions({'':'2体融合',...Object.fromEntries(CARDS.filter(c=>c.type==='monster'&&summonKind(c)!=='fusion'&&c.id!==d.id).map(c=>[c.id,c.name]))},d.fusionMaterials?.[2]||'')}</select>`:''}
      ${d.type==='spell'&&spellKind(d)==='ritual'?`<label class="field-label" for="ritualFor">対応する儀式モンスター</label><select class="input" id="ritualFor">${selectOptions({ '':'すべての儀式モンスター',...Object.fromEntries(CARDS.filter(c=>summonKind(c)==='ritual').map(c=>[c.id,c.name]))},d.ritualFor||'')}</select>`:''}
      ${isMonster?`<div class="form-trio"><div><label class="field-label" for="cardLevel">レベル</label><input id="cardLevel" class="input" inputmode="numeric" type="number" min="1" max="12" value="${d.level||4}"></div>
          <div><label class="field-label" for="cardAtk">ATK</label><input id="cardAtk" class="input" inputmode="numeric" type="number" min="0" max="5000" value="${d.atk??1500}"></div>
          <div><label class="field-label" for="cardDef">DEF</label><input id="cardDef" class="input" inputmode="numeric" type="number" min="0" max="5000" value="${d.def??1200}"></div></div>`:''}
      ${!(d.type==='spell'&&['ritual','fusion'].includes(spellKind(d)))?draftEffectFields(d):'<p class="tiny muted">召喚効果は自動設定されます。</p>'}
      ${((d.type==='monster'&&d.subtype==='effect')||(d.type==='spell'&&!['ritual','fusion'].includes(spellKind(d)))||d.type==='trap')?effectTemplateFields(d):''}
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
  if(d.type==='monster'){d.summonKind=value('cardSummonKind',d.summonKind||'normal');if(d.summonKind==='fusion')d.fusionMaterials=[value('fusionMat1',d.fusionMaterials?.[0]||'m03'),value('fusionMat2',d.fusionMaterials?.[1]||'m12'),value('fusionMat3',d.fusionMaterials?.[2]||'')].filter(Boolean);else delete d.fusionMaterials;}else delete d.summonKind;
  if(d.type==='spell'&&d.spellKind==='ritual')d.ritualFor=value('ritualFor',d.ritualFor||'');else delete d.ritualFor;
  d.emoji=value('cardEmoji',d.emoji).trim()||'✦';
  d.desc=value('cardDesc',d.desc).trim();
  d.fx={visual:value('cardFxVisual',d.fx?.visual||'auto'),sound:value('cardFxSound',d.fx?.sound||'auto')};
  if(d.type==='monster'){
    d.attribute=value('cardAttribute',d.attribute||'光');d.race=value('cardRace',d.race||'魔法使い');
    d.subtype=value('cardSubtype',d.subtype||'normal');
    d.level=Number(value('cardLevel',d.level??4));
    d.atk=Number(value('cardAtk',d.atk??1500));d.def=Number(value('cardDef',d.def??1200));
    if(d.subtype==='effect'){
      const kind=value('cardEffectKind',d.monsterEffect?.kind||'ignition');
      const code=value('cardEffectCode',d.monsterEffect?.code||Object.keys(MONSTER_EFFECTS[kind])[0]);
      const previous=d.monsterEffect;
      const preset=defaultPassiveConfig(code);
      d.monsterEffect={kind,code};
      if(preset&&(kind==='hand'||kind==='summonRule'||kind==='continuous'||kind==='flip'||kind==='position'||kind==='endPhase'||kind==='grave'||kind==='battle'||code==='searchDeckOnSummon'||code==='copyOpponentPrintedStats')){
        d.monsterEffect={...preset,...(previous?.code===code?previous:{})};
        if(['specialByThreeNames','reviveMaterialOnDestroy'].includes(code)){
          d.monsterEffect.names=Array.from({length:code==='specialByThreeNames'?3:2},(_,i)=>value(`cardNativeName${i+1}`,d.monsterEffect.names?.[i]||'').trim());
        }else if(code==='multiAttack'){
          d.monsterEffect.count=Number(value('cardMultiAttackCount',d.monsterEffect.count));
        }else if(['returnOpponentOnFlip','destroyOpponentOnFlip'].includes(code)){
          const scope=value('cardFlipScope',d.monsterEffect.scope||'opponent');
          if(scope!=='opponent')d.monsterEffect.scope=scope;
          else delete d.monsterEffect.scope;
          if(code==='returnOpponentOnFlip')d.monsterEffect.amount=Number(value('cardFlipBounceCount',d.monsterEffect.amount));
        }else if(code==='recruitOnBattleDestroy'){
          d.monsterEffect.attribute=value('cardRecruitAttribute',d.monsterEffect.attribute||'地');
          d.monsterEffect.threshold=Number(value('cardRecruitThreshold',d.monsterEffect.threshold));
        }else if(code==='searchStatOnGrave'){
          d.monsterEffect.stat=value('cardGraveSearchStat',d.monsterEffect.stat||'atk');
          d.monsterEffect.threshold=Number(value('cardGraveSearchThreshold',d.monsterEffect.threshold));
          if(value('cardGraveSearchLimit',d.monsterEffect.restrictActivation?'restricted':'none')==='restricted')d.monsterEffect.restrictActivation=true;
          else delete d.monsterEffect.restrictActivation;
        }else if(['selfReturnHand','postAttackDefenseLock','destroyAttachedEquip','trapSuppression','soloHandNoTribute','doubleLightTribute','doubleOriginalAtkEndDestroy','destroyOpponentOnFlip','recoverOwnSpellOnFlip','destroyOnAttackToDefense','copyOpponentPrintedStats','preventBattleDamage','weakenOpponentOnGrave'].includes(code)){
          // No numeric inputs for automatic end-phase or post-attack behavior.
        }else if(code==='searchDeckOnSummon'){
          d.monsterEffect.filter=value('cardSearchFilter',d.monsterEffect.filter||'ritualMonster');
          if(d.monsterEffect.filter==='named')d.monsterEffect.name=value('cardSearchName',d.monsterEffect.name||'').trim();
          else delete d.monsterEffect.name;
        }else if(code==='millOpponentDeck'){
          d.monsterEffect.amount=Number(value('cardFlipMillAmount',d.monsterEffect.amount));
        }else if(code==='scoutDrawDiscardSpells'){
          d.monsterEffect.amount=Number(value('cardScoutDrawAmount',d.monsterEffect.amount));
        }else if(code==='battleImmuneAtkThreshold'){
          d.monsterEffect.threshold=Number(value('cardPassiveThreshold',d.monsterEffect.threshold));
        }else if(code==='countStatScale'){
          const effect=d.monsterEffect;
          effect.amount=Number(value('cardPassiveAmount',effect.amount));
          effect.scope=value('cardPassiveScope',effect.scope);
          effect.stat=value('cardCountStat',effect.stat);
          effect.zones=Object.keys(COUNT_STAT_ZONES).filter(zone=>$('cardCountZone-'+zone)?.checked??effect.zones.includes(zone));
          const names=Array.from({length:3},(_,i)=>value(`cardCountName${i+1}`,effect.names?.[i]||'').trim()).filter(Boolean);
          if(names.length)effect.names=[...new Set(names)];
          else delete effect.names;
          const filters={attribute:value('cardCountAttribute',effect.attribute||''),race:value('cardCountRace',effect.race||''),
            level:Number(value('cardCountLevel',effect.level||'')),monsterKind:value('cardCountMonsterKind',effect.monsterKind||'')};
          if(!effect.zones.includes('field')&&filters.monsterKind==='token')filters.monsterKind='';
          for(const [key,setting] of Object.entries(filters)){
            if(setting)effect[key]=setting;
            else delete effect[key];
          }
        }else if(code==='raceAuraGuard'){
          d.monsterEffect.amount=Number(value('cardPassiveAmount',d.monsterEffect.amount));
          d.monsterEffect.race=value('cardPassiveRace',d.monsterEffect.race);
        }else if(code==='attributeFieldAura'){
          d.monsterEffect.amount=Number(value('cardPassiveAmount',d.monsterEffect.amount));
          d.monsterEffect.attribute=value('cardPassiveAttribute',d.monsterEffect.attribute);
          d.monsterEffect.negativeAttribute=value('cardPassiveNegativeAttribute',d.monsterEffect.negativeAttribute);
          d.monsterEffect.negativeAmount=Number(value('cardPassiveNegativeAmount',d.monsterEffect.negativeAmount));
          d.monsterEffect.scope=value('cardPassiveScope',d.monsterEffect.scope);
        }else{
          d.monsterEffect.amount=Number(value('cardPassiveAmount',d.monsterEffect.amount));
          if(code==='graveNamedScale'){
            d.monsterEffect.scope=value('cardPassiveScope',d.monsterEffect.scope);
            d.monsterEffect.names=[value('cardPassiveName1',d.monsterEffect.names?.[0]||'').trim(),value('cardPassiveName2',d.monsterEffect.names?.[1]||'').trim()].filter(Boolean);
          }else if(code==='raceFieldGraveScale'){
            d.monsterEffect.scope=value('cardPassiveScope',d.monsterEffect.scope);
            d.monsterEffect.race=value('cardPassiveRace',d.monsterEffect.race);
          }else if(code==='battleAttributeScale'){
            d.monsterEffect.attribute=value('cardPassiveAttribute',d.monsterEffect.attribute);
          }
        }
      }
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
    const sequence=value('cardAbilitySequence',d.ability?.then?'ifResolved':d.ability?.before?'sequential':'single');
    const validatedTarget=choices.includes(target)?target:choices[0];
    const costOptions=abilityCostOptions(operation,validatedTarget);
    const selectedCost=value('cardBeforeOperation',d.ability?.before?.operation||costOptions[0]);
    const costOp=costOptions.includes(selectedCost)?selectedCost:costOptions[0];
    const costAmount=selectedCost===costOp?Number(value('cardBeforeAmount',d.ability?.before?.amount??BEFORE_META[costOp].amount)):BEFORE_META[costOp].amount;
    const nextOperation=value('cardThenOperation',d.ability?.then?.operation||'draw');
    const thenOpts=followUpTargets(nextOperation,validatedTarget,when,d.type,d.spellKind||'normal');
    const nextTargetChosen=value('cardThenTarget',d.ability?.then?.target||thenOpts[0]);
    const thenInfo=ABILITY_META[nextOperation];
    const nextValue=Number(value('cardThenAmount',d.ability?.then?.amount??thenInfo?.amount??0));
    d.ability={when,operation,target:validatedTarget,amount:meta.min===undefined?0:val,
      ...(operation==='summonRaceFromHand'?{match:'race',query:value('cardSummonRace',d.ability?.query||'ドラゴン'),...(value('cardSummonRequired','').trim()?{requiredFaceUpName:value('cardSummonRequired','').trim()}:{} )}:{}),
      ...(operation==='millFirstType'?{match:value('cardMillType',d.ability?.match||'monster')}:{}),
      ...(['searchNamed','summonNamedFromHand'].includes(operation)?{match:operation==='summonNamedFromHand'?'exact':value('cardNamedMatch',d.ability?.match||'exact'),query:value('cardNamedQuery',d.ability?.query??(operation==='summonNamedFromHand'?'ランプの魔精・ラ・ジーン':'融合'))}:{}),
      ...(!['summonSheepTokens','summonKuribohTokens'].includes(operation)&&sequence==='sequential'&&BEFORE_META[costOp]&&['main','attack','response'].includes(when)?{before:{operation:costOp,amount:costAmount}}:{}),
      ...(!['summonSheepTokens','summonKuribohTokens','stealUntilEnd'].includes(operation)&&sequence==='ifResolved'&&thenInfo&&thenOpts.length&&when!=='continuous'?{then:{operation:nextOperation,target:thenOpts.includes(nextTargetChosen)?nextTargetChosen:thenOpts[0],amount:thenInfo.min===undefined?0:nextValue}}:{})};
  }else delete d.ability;
  if(d.responseGuard&&!(d.type==='trap'&&d.ability?.when==='response'&&d.ability?.operation==='negateEffect'))delete d.responseGuard;
  // Builder and native preset are mutually exclusive: never apply hidden double bonuses.
  if(d.type==='monster'&&d.subtype==='effect'&&d.ability)delete d.monsterEffect;
  // This special spell has no unrelated legacy draw effect.
  if(d.type==='spell'&&d.ability?.operation==='reviveSelected')delete d.effect;
  saveCardDraft();
}
function saveOwnEffectTemplate(){
 if(!ui.adminUnlocked||!ui.cardDraft)return;
 const name=$('effectTemplateName')?.value?.trim()||'';
 if(!name)return toast('効果の名前を入力してください');
 readCardForm();
 try{
  const item=saveTemplate(storage,ui.cardDraft,name);
  render();toast(`「${item.name}」を登録しました`);
 }catch(e){toast(e.message||'効果を登録できませんでした');}
}
function applyOwnEffectTemplate(){
 if(!ui.adminUnlocked||!ui.cardDraft)return;
 const id=$('effectTemplateSelect')?.value;
 const template=BUILTIN_EFFECT_TEMPLATES.find(t=>t.id===id)||readTemplates(storage).find(t=>t.id===id);
 if(!template)return toast('登録済み効果を選択してください');
 readCardForm();
 try{
  ui.cardDraft=applyTemplate(ui.cardDraft,template);
  saveCardDraft();render();toast(`「${template.name}」を適用しました`);
 }catch(e){toast(e.message||'効果を適用できませんでした');}
}
function removeOwnEffectTemplate(){
 if(!ui.adminUnlocked||!ui.cardDraft)return;
 const id=$('effectTemplateSelect')?.value;
 const item=readTemplates(storage).find(t=>t.id===id);
 if(!item)return toast('標準テンプレートは削除できません');
 if(!confirm(`「${item.name}」を登録一覧から削除しますか？\nすでに作成したカードの効果は変わりません。`))return;
 readCardForm();
 if(deleteTemplate(storage,id)){render();toast('テンプレートを削除しました');}
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
 if(!m||(zone==='hand'&&m.type!=='prerequisite'))return {eligible:false,picked:false,empty:false};
 const occupied=!!item;
 if(m.type==='prerequisite'){
   const meta=BEFORE_META[CARD[m.id]?.ability?.before?.operation];
   const excluded=owner==='mine'&&((zone==='hand'&&m.source==='hand'&&m.index===index)||(zone==='backrow'&&m.source==='backrow'&&m.index===index));
   const legalVirusCost=CARD[m.id]?.ability?.operation!=='crushVirus'||
     (zone==='monsters'&&item.pos!=='set'&&CARD[item.id]?.attribute==='闇'&&effectiveAtk(item,ui.game,ui.seat)<=1000);
   const eligible=owner==='mine'&&zone===meta?.zone&&occupied&&!excluded&&legalVirusCost;
   return {eligible,picked:eligible&&m.indices.includes(index),empty:false};
 }
 if(m.type==='tribute'){
   const eligible=owner==='mine'&&zone==='monsters'&&occupied&&!CARD[item?.id]?.isToken;
   return {eligible,picked:eligible&&m.indices.includes(index),empty:false};
 }
 if(m.type==='move'){
   const eligible=owner==='mine'&&zone===m.zone&&!occupied;
   return {eligible,picked:false,empty:eligible};
 }
 if(m.type==='attack')return {eligible:owner==='opponent'&&zone==='monsters'&&occupied&&isAttackTargetLegal(ui.game,ui.seat,index),picked:false,empty:false};
 if(['spell','quick','monsterEffect','chainTrap','mainTrap'].includes(m.type)){
   const id=m.id||(m.type==='monsterEffect'?activePlayer()?.monsters[m.index]?.id:
     ['chainTrap','mainTrap'].includes(m.type)?activePlayer()?.backrow[m.index]?.id:null);
   const target=effectTarget(id),spot=targetSpot(target),operation=CARD[id]?.ability?.operation;
   const side=owner==='mine'?ui.seat:1-ui.seat;
   let eligible=occupied&&(eitherSideTarget(target)||owner===spot.owner)&&
     (zone===spot.zone||target==='eitherBackrow'&&zone==='field');
   if(eligible&&target==='eitherBackrow'&&owner==='mine'&&zone===m.source&&index===m.index)eligible=false;
   if(eligible&&target==='eitherMonster'&&isDragonEffectTargetBlocked(ui.game,ui.seat,side,index))eligible=false;
   if(eligible&&['stealUntilEnd','stealWithEquip'].includes(operation))
     eligible=canBorrowMonster(ui.game,ui.seat,index,operation==='stealWithEquip');
   return {eligible,picked:false,empty:false};
 }
 return {eligible:false,picked:false,empty:false};
}
function slotBaseLabel(owner,zone,index,occupied){
 return `${owner==='mine'?'自分':'相手'}の${zone==='monsters'?'モンスター':'魔法・罠'}ゾーン${index+1}${occupied?' カードあり':' 空き'}`;
}
/** Count only currently legal highlighted positions; UI-only, never sent to the engine. */
function targetCandidateCount(){
 if(!ui.game||!ui.targetMode||ui.targetMode.type==='revive')return 0;
 let count=0;
 for(const owner of ['mine','opponent']){
   const player=ui.game.players[owner==='mine'?ui.seat:1-ui.seat];
   if(!player)continue;
   for(const zone of ['monsters','backrow'])for(let i=0;i<5;i++){
     const f=targetFlags(owner,zone,i,player[zone]?.[i]);
     if(f.eligible)count++;
   }
   if(targetFlags(owner,'field',0,player.field).eligible)count++;
 }
 const hand=activePlayer()?.hand||[];
 for(let i=0;i<hand.length;i++)if(targetFlags('mine','hand',i,hand[i]).eligible)count++;
 return count;
}
/** Optional jump, never auto-pick a card or change a duel action. */
function focusDuelTargets(){
 if(!ui.targetMode)return;
 const view=$('view');
 const candidate=view?.querySelector('.hand-slot.sv-target-eligible, .battlefield .slot.sv-target-eligible, .battlefield .slot.sv-target-empty');
 if(!candidate){toast('現在、選択できる候補はありません');return;}
 candidate.focus({preventScroll:true});
 // The whole board is already visible in tablet landscape. Focusing must
 // not produce a surprising full-page jump while targeting.
 const docked=window.matchMedia?.('(orientation:landscape) and (min-width:950px) and (min-height:600px)').matches;
 if(!docked){
   const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   candidate.scrollIntoView({block:'center',inline:'nearest',behavior:reduce?'auto':'smooth'});
 }
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
   const order=f.picked?ui.targetMode?.indices?.indexOf(index)+1:0;
   node.dataset.svPickOrder=order>0?String(order):'';
   // Keep the attacking monster distinct from the enemy cards that can be chosen.
   const attackSource=ui.targetMode?.type==='attack'&&owner==='mine'&&zone==='monsters'&&index===ui.targetMode.index;
   node.classList.toggle('sv-attack-source',attackSource);
   node.classList.remove('selected');node.setAttribute('aria-pressed',String(f.picked));
   if(!node.dataset.baseLabel)node.dataset.baseLabel=node.getAttribute('aria-label')||'';
   node.setAttribute('aria-label',node.dataset.baseLabel+(attackSource?'、このモンスターで攻撃中':f.picked?`、選択済み${order}番目`:f.eligible?'、対象として選択できます':''));
 }
 for(const node of view.querySelectorAll('.hand-slot[data-select]')){
   const i=Number(node.dataset.index),f=targetFlags('mine','hand',i,activePlayer()?.hand?.[i]);
   node.classList.toggle('sv-target-eligible',f.eligible);node.classList.toggle('sv-target-picked',f.picked);
   const order=f.picked?ui.targetMode?.indices?.indexOf(i)+1:0;
   node.dataset.svPickOrder=order>0?String(order):'';
   const cardName=CARD[activePlayer()?.hand?.[i]]?.name||'カード';
   node.setAttribute('aria-label',`手札${i+1} ${cardName}${order>0?`、選択済み${order}番目`:f.eligible?'、対象候補':''}`);
   node.classList.remove('selected');node.setAttribute('aria-pressed',String(f.picked));
 }
 view.querySelector('.duel-card-actions')?.remove();
 // Target mode changes the available hand width without resizing the viewport.
 scheduleHandNavigation();
}
/** Bring the target guide into view on a phone; no game-state writes. */
function startTargetMode(mode){
 ui.targetMode=mode;ui.selected=null;
 if(mode.type==='revive'){render();return;}
 refreshDuelTarget();
 requestAnimationFrame(()=>{
   const banner=$('view')?.querySelector('.sv-target-banner .sv-target-choice');
   // The landscape guide is fixed beside the hand; scrolling it into view
   // would move the entire page on some iPad Safari builds.
   const docked=window.matchMedia?.('(orientation:landscape) and (min-width:950px) and (min-height:600px)').matches;
   if(banner&&ui.targetMode===mode&&!docked)banner.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 });
}
function slotHtml(player,owner,zone,i){
  const item=player?.[zone]?.[i]||null;
  const hide=owner==='opponent'&&((zone==='backrow'&&item?.faceDown)||item?.pos==='set');
  const selected=ui.selected?.owner===owner&&ui.selected?.zone===zone&&ui.selected?.index===i;
  const occupied=item?.id;
  // A single stance badge replaces the overlaid stat label that obscured card names.
  // A set opponent monster stays private: no name or numeric stats in the DOM label.
  const stance=zone==='monsters'&&occupied?(item.pos==='set'?'set':item.pos==='def'?'defense':'attack'):'';
  let marker='',stanceLabel='';
  if(stance==='set'){
    stanceLabel='裏側守備表示';
    marker='<span class="sv-stance-badge" aria-hidden="true">▣ 裏守</span>';
  }else if(stance){
    const seat=owner==='mine'?ui.seat:1-ui.seat;
    const atk=effectiveAtk(item,ui.game,seat);
    const def=effectiveDef(item,ui.game,seat);
    const atkText=Number.isFinite(atk)?String(atk):'—';
    const defText=Number.isFinite(def)?String(def):'—';
    stanceLabel=`${stance==='attack'?'攻撃表示':'守備表示'}、攻撃力 ${atkText}、守備力 ${defText}`;
    // Both public combat values stay immediately under the card, never inside
    // the card artwork. Hidden set monsters must not expose either value.
    marker=`<span class="sv-stance-badge sv-combat-stats" aria-hidden="true"><strong class="sv-stat-attack">${atkText}</strong><span class="sv-stat-divider"> / </span><strong class="sv-stat-defense">${defText}</strong></span>`;
  }
  const target=targetFlags(owner,zone,i,item);
  const {eligible,picked,empty:emptyTarget}=target;
  const pickOrder=picked?ui.targetMode?.indices?.indexOf(i)+1:0;
  const attackSource=ui.targetMode?.type==='attack'&&owner==='mine'&&zone==='monsters'&&i===ui.targetMode.index;
  const baseLabel=slotBaseLabel(owner,zone,i,occupied);
  const publicName=occupied&&!hide?CARD[item.id]?.name||'':'';
  const staticLabel=baseLabel+(publicName?'、'+publicName:'')+(stanceLabel?'、'+stanceLabel:'');
  const describedLabel=staticLabel+
    (attackSource?'、このモンスターで攻撃中':picked?`、選択済み${pickOrder}番目`:eligible?'、対象として選択できます':'');
  return `<button type="button" aria-label="${esc(describedLabel)}" data-base-label="${esc(staticLabel)}" class="slot ${occupied?'':'empty'} ${selected?'selected':''} ${stance?'sv-stance-'+stance:''} ${eligible&&!emptyTarget?'sv-target-eligible':''} ${picked?'sv-target-picked':''} ${emptyTarget?'sv-target-empty':''} ${attackSource?'sv-attack-source':''}" data-sv-pick-order="${pickOrder>0?pickOrder:''}" data-select="1" data-owner="${owner}" data-zone="${zone}" data-index="${i}" aria-pressed="${!!(selected||picked)}">
  ${occupied?cardHtml(item.id,{hidden:hide,def:item.pos==='def'}):''}${marker}</button>`;
}
function fieldSlotHtml(player,owner){
 const item=player?.field,hidden=owner==='opponent'&&item?.faceDown;
 const selected=ui.selected?.owner===owner&&ui.selected?.zone==='field';
 const eligible=targetFlags(owner,'field',0,item).eligible,baseLabel=`${owner==='mine'?'自分':'相手'}のフィールド魔法`;
 return `<button type="button" class="slot field-slot ${item?'':'empty'} ${selected?'selected':''} ${eligible?'sv-target-eligible':''}" data-select="1" data-owner="${owner}" data-zone="field" data-index="0" aria-pressed="${!!selected}" data-base-label="${baseLabel}" aria-label="${baseLabel}${eligible?'、対象として選択できます':''}">
 ${item?cardHtml(item.id,{hidden}):'<span class="sv-empty-field" aria-hidden="true">✦</span>'}</button>`;
}
function playerStatus(p,side){
  const isCurrent=ui.game.turn===side;
  const lp=p?.lp??ui.game?.rules?.lp??8000;
  // Display-only LP fraction, capped at the opening LP; healing beyond it
  // still shows the exact numeric LP. No state mutation or subscriptions.
  const openingLP=Math.max(1,Number(ui.game?.rules?.lp)||8000);
  const lpPercent=Math.max(0,Math.min(100,Math.round(Number(lp)/openingLP*100)||0));
  return `<div class="seat ${side!==ui.seat?'right':''}" data-seat="${side}">
  <div class="avatar">${side===0?'🔥':'🌊'}</div><div><div class="seat-name">${esc(p?.name||'対戦相手')} ${isCurrent?'<span class="turn-chip">手番</span>':''}</div>
  <div class="lp ${lp<=2000?'danger':''}">${Number(lp).toLocaleString('ja-JP')} <span class="tiny">LP</span></div>
  <div class="sv-lp-track${lpPercent<=25?' sv-lp-low':''}" style="--sv-lp-fill:${lpPercent}%" aria-hidden="true"><span class="sv-lp-fill"></span></div>
  <div class="mini-stats">山札 ${p?.deck?.length??ui.rules.deckSize} / 手札 ${p?.hand?.length??0} / <span class="sv-grave-count">墓地 ${p?.grave?.length??0}</span> / 除外 ${p?.banished?.length??0}</div></div></div>`;
}
/** Compact physical piles stay visible on the duel board, including on phones.
 * The main deck is always face-down; its contents are never exposed. */
function duelPileRow(player,seat,owner){
 const mine=owner==='mine';
 const label=mine?'自分':'相手';
 const top=player.grave[player.grave.length-1];
 // The graveyard is public; render its actual newest card. No extra image
 // fetch, state subscription or timer is created. Deck content stays hidden.
 const gravePreview=top?cardHtml(top):'<span class="sv-pile-empty" aria-hidden="true">✦</span>';
 return `<div class="sv-pile-row ${mine?'sv-pile-row--mine':'sv-pile-row--opponent'}" data-seat="${seat}" aria-label="${label}のデッキと墓地">
   <button type="button" class="sv-pile sv-pile--deck" data-action="showDeckInfo" data-seat="${seat}" data-pile="deck" aria-label="${label}のデッキ、残り${player.deck.length}枚。デッキの中身は非公開">
     <span class="sv-pile-preview" aria-hidden="true">${cardHtml(null,{hidden:true})}</span><span class="sv-pile-icon" aria-hidden="true">▤</span><span>デッキ</span><strong>${player.deck.length}</strong>
   </button>
   <button type="button" class="sv-pile sv-pile--grave" data-action="showGrave" data-seat="${seat}" data-pile="grave" aria-label="${label}の墓地、${player.grave.length}枚。${top?'一番上は'+(CARD[top]?.name||'カード')+'。':''}カードを確認">
     <span class="sv-pile-preview" aria-hidden="true">${gravePreview}</span><span class="sv-pile-icon" aria-hidden="true">✦</span><span>墓地</span><strong class="sv-grave-count">${player.grave.length}</strong>
   </button>
 </div>`;
}
function quickChoices(){
 const s=ui.game,p=activePlayer();if(!s||!p)return [];
 const rows=p.backrow.map((x,i)=>({card:x&&CARD[x.id],source:'backrow',index:i,item:x}))
   .filter(x=>x.card?.type==='spell'&&spellKind(x.card)==='quick'&&x.item?.faceDown&&x.item.setTurn<s.turnNo);
 if(s.turn===ui.seat)rows.push(...p.hand.map((id,i)=>({card:CARD[id],source:'hand',index:i}))
   .filter(x=>x.card?.type==='spell'&&spellKind(x.card)==='quick'));
 return rows.filter(x=>(x.card?.ability?.target!=='eitherBackrow'||canOfferSpell(s,ui.seat,x.card,x.source,x.index))&&
   (x.card?.ability?.operation!=='diceStats'||
    s.players[x.card.ability.target==='ownAllMonsters'?ui.seat:1-ui.seat].monsters.some(m=>m&&m.pos!=='set')));
}
function quickChoiceButtons(){return quickChoices().map(x=>btn('⚡ '+esc(x.card.name),'quickResponse','btn sm secondary',`data-source="${x.source}" data-index="${x.index}"`)).join('');}
function renderPending(){
  const s=ui.game;if(!s.pending)return '';
  if(s.pending.kind==='chain'){
    const ch=s.pending,priority=ch.priority===ui.seat;
    const traps=priority&&!trapsSuppressed(s)?activePlayer().backrow.map((v,i)=>({v,i})).filter(({v,i})=>{
      if(!v||v.faceDown!==true||v.setTurn>=s.turnNo||CARD[v.id]?.type!=='trap')return false;
      if(!canActivateResponseTrap(s,ui.seat,i))return false;
      const card=CARD[v.id],guard=card.responseGuard,top=ch.stack[ch.stack.length-1];
      if(card.ability?.operation==='redirectSpellTarget'&&redirectedSpellTargetSlot(s,ui.seat,top)<0)return false;
      if(card.ability?.operation==='protectOwnTraps'&&!canProtectOwnTraps(s,ui.seat,top,i))return false;
      if(card.ability?.operation==='redirectToAttackerAlly'&&attackerAllySlot(s,ui.seat,ch.afterAttack)<0)return false;
      if(card.ability?.when==='attack'&&!canActivateAttackTrap(s,ui.seat,i))return false;
      if(guard){const linked=CARD[top?.cardId],ab=linked?.ability;
        if(linked?.type!=='spell'||guard==='targetedSpell'&&!['ownMonster','enemyMonster'].includes(ab?.target))return false;
      }
      return card.ability?.when==='response'||(ch.afterAttack&&(card.ability?.when==='attack'||!card.ability));
    }):[];
    // Only links already on the public stack are named. The UI never inspects
    // hidden set cards, changes priority, or modifies the chain itself.
    const links=ch.stack.map((e,i)=>`<span role="listitem" class="sv-chain-step${i===ch.stack.length-1?' sv-chain-step--last':''}" aria-label="チェーン${i+1}、${esc(CARD[e.cardId]?.name||'発動したカード')}"><span class="sv-chain-index">${i+1}</span><span class="sv-chain-cardname">${esc(CARD[e.cardId]?.name||'発動したカード')}</span></span>`).join('');
    const resolveOrder=Array.from({length:ch.stack.length},(_,i)=>ch.stack.length-i).join(' → ');
    // Build the response choices once, and only for the seat with priority.
    const choices=priority?traps.map(({v,i})=>btn(esc(CARD[v.id].name),'chainTrap','btn sm secondary',`data-index="${i}"`)).join('')+quickChoiceButtons():'';
    return `<section class="respond sv-response sv-response--chain ${priority?'sv-response--ready':'sv-response--waiting'}" role="region" aria-label="チェーンへの応答">
      <div class="sv-response-heading"><span class="sv-response-label">CHAIN ${ch.stack.length}</span><strong>${priority?'あなたの応答順です':'相手の応答待ち'}</strong><span class="sv-response-status">${priority?'選択できます':'相手が操作中'}</span></div>
      <div class="sv-chain-guide" aria-label="チェーンの発動順と効果解決順"><span>発動順 <b>1 → ${ch.stack.length}</b></span><span>解決順 <b>${resolveOrder}</b></span></div>
      <div class="sv-chain-track" role="list" aria-label="発動済みカード、発動順">${links}</div>
      <p class="sv-response-help">${priority?'罠・速攻魔法を追加するか、パスしてください。':'相手がカードの追加またはパスを選択しています。'}<span> 追加がなければ最後に発動した効果から解決します。</span></p>
      ${priority?`<div class="sv-response-actions row wrap">${choices}</div><div class="sv-response-primary">${btn('チェーンに追加せずパス','chainPass','btn primary sm')}</div>`:''}
      ${ui.demo&&!priority?btn('操作側を交代','switchSeat','btn secondary wide mt8'):''}</section>`;
  }
  const attacking=s.pending.by===ui.seat;
  if(attacking)return `<section class="respond sv-response sv-response--waiting" role="region" aria-label="攻撃への応答">
   <div class="sv-response-heading"><span class="sv-response-label">BATTLE</span><strong>攻撃宣言済み・相手の応答待ち</strong><span class="sv-response-status">相手が操作中</span></div>
   <p class="sv-response-help">相手が罠・速攻魔法を使用するか選択しています。</p>
   ${ui.demo?btn('相手側に切り替える','switchSeat','btn secondary wide mt8'):''}</section>`;
  const p=activePlayer();
  const guards=s.pending.preventBattleDamageSeat===ui.seat?[]:p.hand.map((id,i)=>({id,i})).filter(x=>CARD[x.id]?.monsterEffect?.kind==='hand'&&CARD[x.id].monsterEffect.code==='preventBattleDamage'&&!monsterEffectActivationBlocked(s,ui.seat,x.id));
  const traps=trapsSuppressed(s)?[]:p.backrow.map((v,i)=>({v,i})).filter(({v,i})=>v&&v.faceDown===true&&CARD[v.id]?.type==='trap'&&v.setTurn<s.turnNo&&(CARD[v.id]?.ability?.when==='attack'||!CARD[v.id]?.ability)&&
    (CARD[v.id]?.ability?.operation!=='redirectToAttackerAlly'||attackerAllySlot(s,ui.seat,s.pending)>=0)&&
    (CARD[v.id]?.ability?.when!=='attack'||canActivateAttackTrap(s,ui.seat,i)));
  return `<section class="respond sv-response sv-response--ready" role="region" aria-label="攻撃への応答">
    <div class="sv-response-heading"><span class="sv-response-label">BATTLE</span><strong>相手が攻撃！ 応答を選択</strong><span class="sv-response-status">選択できます</span></div>
    <p class="sv-response-help">使用可能な罠・速攻魔法を発動するか、攻撃を通してください。</p>
    <div class="sv-response-actions row wrap">${traps.map(({v,i})=>btn(`${esc(CARD[v.id].emoji)} ${esc(CARD[v.id].name)}`,'trap','btn sm secondary',`data-index="${i}"`)).join('')}${quickChoiceButtons()}${guards.map(({id,i})=>btn(`✦ ${esc(CARD[id].name)}（戦闘ダメージ0）`,'discardBattleGuard','btn sm secondary',`data-index="${i}"`)).join('')}</div>
    <div class="sv-response-primary">${btn('何も発動せず攻撃を通す','passAttack','btn primary sm')}</div></section>`;
}
function renderTargetHint(){
 if(!ui.targetMode)return '';
 const m=ui.targetMode;
 if(m.type==='revive')return '';
 const cancel=btn('キャンセル','cancelTarget','btn sm ghost');
 const candidateCount=targetCandidateCount();
 const focus=btn('候補へ移動','focusTargets','btn sm secondary','',candidateCount===0);
 const countBadge=`<span class="sv-target-candidate-count">候補 ${candidateCount} 件</span>`;
 if(m.type==='prerequisite'){
   const ab=CARD[m.id]?.ability?.before,meta=BEFORE_META[ab?.operation];
   return `<section class="hintbox sv-target-choice" role="status"><div class="sv-target-heading"><span class="sv-target-step">A｜必要な処理</span><strong>${esc(meta?.label||'カードを選択')}</strong></div>
   <p class="sv-target-sub"><strong>${m.indices.length} / ${ab?.amount||0}</strong>枚選択。残り <strong>${Math.max(0,(ab?.amount||0)-m.indices.length)}</strong> 枚。選択済みをタップすると解除。 ${countBadge}</p>
   <div class="row wrap mt8 sv-target-actions">${btn('Aを確定して次へ','confirmPrerequisite','btn primary sm','',m.indices.length!==ab?.amount)}${focus}${cancel}</div></section>`;
 }
  if(m.type==='tribute'){
   const p=activePlayer(),c=CARD[p?.hand[m.hand]],ready=validSummonTributes(c,p?.hand.length,p?.monsters,m.indices);
   const double=hasDoubleLightTribute(c,p?.monsters||[]);
   return `<section class="hintbox sv-target-choice" role="status"><div class="sv-target-heading"><span class="sv-target-step">召喚準備</span><strong>リリースする自分のモンスターを選択</strong></div><p class="sv-target-sub"><strong>${m.indices.length} / ${m.needed}</strong>体選択。選択済みをタップすると解除。${double?' カイザー・シーホース1体だけでも召喚可能。':''} ${countBadge}</p><div class="row wrap mt8 sv-target-actions">${btn('選択して召喚','confirmTributes','btn primary sm','',!ready)}${focus}${cancel}</div></section>`;
  }
 if(m.type==='move')return `<section class="hintbox sv-target-choice" role="status"><div class="sv-target-heading"><span class="sv-target-step">位置移動</span><strong>光る空きゾーンをタップ</strong></div><p class="sv-target-sub">移動先のゾーンを選んでください。 ${countBadge}</p><div class="row wrap mt8 sv-target-actions">${focus}${cancel}</div></section>`;
 const id=m.id||(m.type==='monsterEffect'?activePlayer()?.monsters[m.index]?.id:
   ['chainTrap','mainTrap'].includes(m.type)?activePlayer()?.backrow[m.index]?.id:null);
 const target=effectTarget(id),attack=m.type==='attack';
 const enemyMonsters=ui.game.players[1-ui.seat].monsters.filter(Boolean).length;
 const candidates=candidateCount;
 const title=attack?'⚔ 攻撃対象':`✦ ${TARGETS[target]||'効果対象'}`;
 const attackingName=attack?CARD[activePlayer()?.monsters?.[m.index]?.id]?.name||'選択したモンスター':'';
 const explanation=attack?(enemyMonsters?(candidates?`「${attackingName}」→ 水色の相手カードをタップで攻撃`:'攻撃可能な対象がありません。キャンセルしてください。'):`「${attackingName}」→ 下のボタンで直接攻撃`):
  (candidates?'光るカードをタップすると効果を発動します':'対象がありません。キャンセルしてください');
 return `<section class="hintbox sv-target-choice ${attack?'sv-target-choice--attack':'sv-target-choice--effect'}" role="status"><div class="sv-target-heading"><span class="sv-target-step">${attack?'バトル':'効果発動'}</span><strong>${esc(title)}</strong></div><p class="sv-target-sub">${esc(explanation)} ${countBadge}</p><div class="row wrap mt8 sv-target-actions">${attack&&!enemyMonsters?btn('直接攻撃','directAttack','btn primary sm'):''}${focus}${cancel}</div></section>`;
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
    if(c.type==='monster'&&canMain&&p.sheepLockTurn!==s.turnNo&&(!p.normalUsed||canExtraNormalSummon(s,ui.seat))){
      options=((['selfSpecialFromHand','selfSpecialFromHandGiveRevive'].includes(c.ability?.operation)&&p.monsters.includes(null)||specialHandTributeSlots(s,ui.seat,c).length===3)?btn('✦ 特殊召喚','specialSummonSelf','btn secondary sm'):'')+(summonKind(c)==='ritual'?btn('儀式召喚','openRitual','btn primary sm'):summonKind(c)==='fusion'?'':btn('攻撃表示で召喚','summonAtk','btn primary sm')+btn('裏側守備でセット','summonSet','btn sm'));
    }else if(c.type==='spell'){
      options=(canOfferSpell(s,ui.seat,c,'hand')?btn(['ritual','fusion'].includes(spellKind(c))?(spellKind(c)==='ritual'?'儀式召喚':'融合召喚'):'魔法を発動','spellHand','btn primary sm'):'')+(canMain?btn('伏せてセット','setHand','btn sm'):'');
    }else if(canMain)options=btn('伏せてセット','setHand','btn primary sm');
  }
  if(sel.owner==='mine'&&sel.zone==='hand'&&myTurn()&&s.phase==='end'&&p.hand.length>6)
     options=btn('このカードを捨てる','discard','btn primary sm');
  if(sel.owner==='mine'&&sel.zone==='monsters'&&item){
    if(canMain&&p.positionLockedTurn!==s.turnNo){
      if(item.pos==='set')options+=btn('反転召喚','flip','btn primary sm');
      else if(canManuallyChangePosition(item,s.turnNo))options+=btn('表示形式変更','changePosition','btn sm');
    }
    if(canMain&&p.positionLockedTurn===s.turnNo)options+='<span class="tiny muted">催眠術：このターンは手動の表示変更不可</span>';
    if(Number.isInteger(item.positionLockedThroughTurn)&&s.turnNo<=item.positionLockedThroughTurn)options+='<span class="tiny muted">表示形式は次の自分ターン終了まで変更不可（効果による変更は可能）</span>';
    if(canMain&&canOfferMonsterIgnition(s,ui.seat,sel.index))
      options+=btn('✦ モンスター効果を発動','monsterEffect','btn secondary sm');
    if(myTurn()&&s.phase==='battle'&&!s.pending&&(p.attackSealedThroughTurn||0)<s.turnNo&&item.pos==='atk'&&remainingAttacks(item)>0&&(item.attackLockedUntil||0)<s.turnNo&&!isAttackSealedByEquip(s,ui.seat,item)&&s.turnNo>1&&
      (c.ability?.operation!=='tributeOtherToAttack'||p.monsters.some((m,i)=>i!==sel.index&&m))){
      // A clear, explicit direct-attack command needs no redundant target picker.
      // The engine still validates the action; this changes only the UI route.
      const clearOpponentField=canDirectAttackWithMonsters(s,ui.seat,item);
      options+=clearOpponentField?
        btn('直接攻撃','directAttackSelected','btn primary sm')+(enemy.monsters.some(Boolean)?btn('攻撃対象を選ぶ','attackSelect','btn sm'):''):
        btn('攻撃対象を選ぶ','attackSelect','btn primary sm');
    }
  }
  if(sel.owner==='mine'&&sel.zone==='monsters'&&canMain&&item)options+=btn('位置移動','moveSelected','btn sm');
  if(sel.owner==='mine'&&(sel.zone==='backrow'||sel.zone==='field')&&item){
    if(c.type==='spell'&&item.faceDown&&myTurn()&&!s.pending&&(canMain||spellKind(c)==='quick')&&canOfferSpell(s,ui.seat,c,sel.zone,sel.index))options=btn(['ritual','fusion'].includes(spellKind(c))?'特殊召喚':'魔法を発動','spellField','btn primary sm');
    if(c.type==='trap'&&sel.zone==='backrow'&&item.faceDown&&canMain&&myTurn()&&item.setTurn<s.turnNo&&!trapsSuppressed(s)&&c.ability?.operation==='extraNormalSummon'&&c.ability?.when==='continuous')
      options=btn('永続罠を発動','activateContinuousTrap','btn primary sm',`data-index="${sel.index}"`);
    if(c.type==='trap'&&sel.zone==='backrow'&&canActivateMainTrap(s,ui.seat,sel.index))
      options=btn('罠を発動','activateMainTrap','btn primary sm',`data-index="${sel.index}"`);
    if(c.type==='trap'&&s.pending?.kind==='attack'&&s.pending.by!==ui.seat&&item.setTurn<s.turnNo)
      options=btn('罠を発動','trap','btn primary sm',`data-index="${sel.index}"`);
  }
  if(sel.owner==='mine'&&sel.zone==='backrow'&&canMain&&item)options+=btn('位置移動','moveSelected','btn sm');
  // Read-only card context and controls; never derive legal actions in the UI.
  // Keep the existing action buttons and handlers exactly as they are.
  const zoneName={hand:'手札',monsters:'モンスターゾーン',backrow:'魔法・罠ゾーン',field:'フィールドゾーン'}[sel.zone]||'カード';
  // Historical cards may have substitute/simplified behavior. Never present an
  // engine-generated effect as the original if this catalog marks it pending.
  // This is display-only; card actions and game resolution are untouched.
  const historicalStatus=c.historicalEffectPending?'未実装':c.historicalKind?
    ({exact:'再現済み',simplified:'簡易効果',proxy:'代替効果'}[c.status]||'基本データ'):'';
  const statusClass=c.historicalEffectPending?'pending':
    c.status==='proxy'?'proxy':c.status==='simplified'?'simplified':
    c.status==='exact'?'exact':'reference';
  const effectCopy=c.historicalKind&&(c.historicalEffectPending||c.status!=='exact')?
    (c.desc||'原作効果の再現は保留しています。'):(effectText(c)||c.desc||'説明はありません');
  const effectIntro=String(effectCopy).replace(/\s+/g,' ').trim().slice(0,52);
  const effectHeading=c.type==='monster'&&c.subtype==='normal'&&!c.historicalEffectPending?'カード説明':'効果・説明';
  const faceUpMonster=c.type==='monster'&&sel.zone==='monsters'&&item;
  const currentAtk=faceUpMonster?effectiveAtk(item,s,sel.owner==='mine'?ui.seat:1-ui.seat):0;
  const currentDef=faceUpMonster?effectiveDef(item,s,sel.owner==='mine'?ui.seat:1-ui.seat):0;
  const currentStats=faceUpMonster?`<div class="sv-current-combat"><span class="sv-current-stance">${item.pos==='atk'?'攻撃表示':item.pos==='def'?'守備表示':'裏側守備表示'}</span><strong class="sv-current-atk">ATK ${currentAtk}</strong><span class="sv-current-divider">/</span><strong class="sv-current-def">DEF ${currentDef}</strong>${currentAtk!==Number(c.atk)||currentDef!==Number(c.def)?`<small class="sv-current-base">元 ${Number(c.atk)||0} / ${Number(c.def)||0}</small>`:''}</div><div class="sv-current-meta">★${Number(c.level)||0}　${esc(c.attribute||'不明')}属性 / ${esc(c.race||'不明')}族</div>`:esc(suffix(c));
  // Keep inspection available without mixing it into the list of duel actions.
  // Button actions and eligibility are identical to v1.9.65; this is UI only.
  return `<section class="card-detail duel-card-actions sv-action-sheet" role="region" aria-label="カード操作"><div class="sv-action-kicker"><span class="sv-action-location">${sel.owner==='mine'?'自分':'相手'}の${zoneName}</span>${historicalStatus?`<span class="sv-effect-status sv-effect-status--${statusClass}">${esc(historicalStatus)}</span>`:''}<span class="sv-action-ready">${options?'操作を選択':'カードを確認'}</span></div>
   <div class="row between duel-detail-heading"><div class="sv-action-identity"><div class="detail-title" title="${esc(c.name)}">${esc(c.name)}</div><span class="detail-badge">${esc(cardTypeName(c))}</span></div><div class="sv-action-head-controls">${btn('拡大','viewCard','btn sm ghost sv-inspect','aria-label="カードを拡大表示"')}${btn('×','cancelSelection','btn sm square ghost','aria-label="カード選択を閉じる"')}</div></div>
   <div class="sv-action-stats">${currentStats}</div>
   <div class="sv-action-tools"><div class="sv-action-tools-label">${options?'実行できる操作':'操作'}</div><div class="actionbar">${options||'<span class="sv-action-empty">今は実行できる操作がありません</span>'}</div></div>
   <details class="sv-action-copy sv-effect-copy"><summary aria-label="${esc(effectHeading)}を開閉"><span class="sv-effect-title">${esc(effectHeading)}</span><span class="sv-action-effect-teaser">${esc(effectIntro)}${String(effectCopy).length>52?'…':''}</span></summary><p class="detail-text">${esc(effectCopy)}</p></details></section>`;
}
// A presentation-only classification of already public log text. The complete
// original message is always retained, and no action/room state is changed.
const DUEL_LOG_FILTERS=[['all','すべて'],['battle','戦闘'],['effect','効果'],['progress','進行・その他']];
function duelLogCategory(message){
 const text=String(message??'');
 if(/攻撃|ダメージ|戦闘|防ぎ|相打ち/.test(text))return 'battle';
 if(/チェーン|効果|発動|無効/.test(text))return 'effect';
 return 'progress';
}
function duelLogEntries(log){
 const items=(Array.isArray(log)?log:[]).map((message,index)=>({message,index,kind:duelLogCategory(message)}));
 const selected=DUEL_LOG_FILTERS.some(([value])=>value===ui.duelLogFilter)?ui.duelLogFilter:'all';
 const visible=selected==='all'?items:items.filter(item=>item.kind===selected);
 const names={battle:'戦闘',effect:'効果',progress:'進行'};
 return `<div class="sv-log-controls" role="group" aria-label="対戦ログの表示種類">${DUEL_LOG_FILTERS.map(([value,label])=>btn(label,'duelLogFilter',`btn sm sv-log-filter${selected===value?' is-active':''}`,`data-filter="${value}" aria-pressed="${selected===value}"`)).join('')}</div>
 <div class="sv-log-status" role="status">${visible.length} / ${items.length} 件 · 新しい順</div>
 <div class="loglist sv-loglist" role="list" aria-label="対戦ログ・新しい順">${visible.length?visible.map(item=>`<div role="listitem" class="sv-log-entry sv-log-entry--${item.kind}"><span class="sv-log-order">${item.index===0?'最新':`#${item.index+1}`}</span><span class="sv-log-tag">${names[item.kind]}</span><span class="sv-log-message">${esc(item.message)}</span></div>`).join(''):'<p class="sv-log-empty">該当する履歴はありません</p>'}</div>`;
}
function updateDuelLogView(){
 const content=$('view')?.querySelector('.sv-log-content');
 if(content&&ui.game)content.innerHTML=duelLogEntries(ui.game.log);
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
  // Landscape tablets and short landscape phones show the hand in a narrow side panel.
  // Determine arrow visibility by the panel layout, not the full viewport width.
  const sideHand=(window.innerWidth>=700&&window.innerWidth<1024&&window.innerHeight<=560);
  // Enlarged mode keeps swipe/navigation available even for a short hand.
  // An iPad action dock can reduce the hand width after selecting a card.
  // Create lightweight arrows from two cards onward; hide them if all fit.
  const tabletLandscape=window.innerWidth>=950&&window.innerHeight>=600&&window.innerWidth>window.innerHeight;
  const handNavThreshold=ui.handZoom||tabletLandscape?1:(sideHand?3:window.innerWidth>=700?7:window.innerWidth>=560?5:window.innerWidth>=370?4:3);
  // A shallow, static fan: numeric CSS variables are cheap to render and do not
  // change card indices, hit handlers, game data or online synchronization.
  const fanMiddle=(me.hand.length-1)/2;
  const fanStrength=Math.min(1,Math.max(0,(me.hand.length-1)/4));
  const hand=me.hand.map((id,i)=>{
    // Most turns have no hand targets; skip target flag objects entirely.
    const target=ui.targetMode?.type==='prerequisite'?targetFlags('mine','hand',i,id):null;
    const order=target?.picked?ui.targetMode.indices.indexOf(i)+1:0;
    const arc=fanMiddle?(i-fanMiddle)/fanMiddle:0;
    const tilt=(arc*8*fanStrength).toFixed(1);
    const drop=Math.round(Math.pow(Math.abs(arc),1.6)*10*fanStrength);
    return `<button type="button" class="hand-slot ${ui.selected?.zone==='hand'&&ui.selected?.index===i?'selected':''} ${target?.eligible?'sv-target-eligible':''} ${target?.picked?'sv-target-picked':''}" data-sv-pick-order="${order>0?order:''}" style="--sv-fan-angle:${tilt}deg;--sv-fan-drop:${drop}px;--sv-fan-layer:${i+1}" data-select="1" data-owner="mine" data-zone="hand" data-index="${i}" aria-label="手札${i+1} ${esc(CARD[id]?.name||'カード')}${order>0?`、選択済み${order}番目`:target?.eligible?'、対象候補':''}" aria-pressed="${!!(target?.picked||(ui.selected?.zone==='hand'&&ui.selected?.index===i))}">${cardHtml(id)}</button>`;
  }).join('');
  const phaseButton=!myTurn()||ready||s.status!=='playing'||s.phase==='end'?'':s.phase==='main2'?btn('ターン終了','endTurn','btn primary'):btn(s.phase==='draw'?'メインへ':s.phase==='main1'?(s.turnNo===1?'メイン2へ':'バトルへ'):'メイン2へ','nextPhase','btn primary');
  const endButton=myTurn()&&!ready&&s.status==='playing'&&!['main2','draw','end'].includes(s.phase)?btn('ターン終了','endTurn','btn ghost'):'';
  const handAdjustment=s.phase==='end'&&myTurn()&&me.hand.length>6;
  const winner=s.status==='finished'?`<section class="panel winner">🏆 ${s.winner==='draw'?'引き分け':`${esc(s.players[s.winner].name)} の勝利！`}</section>`:'';
  const layoutButton=btn(ui.duelCompact?'拡大表示':'省スペース','toggleCompact','btn sm ghost duel-layout-button');
  const handJump=btn(`手札 ${me.hand.length}`,'scrollToHand','btn sm ghost sv-hand-shortcut',`aria-label="手札 ${me.hand.length}枚の位置へ移動"`);
  const commandBar=`<div class="duel-commandbar" role="group" aria-label="フェイズ操作"><div class="duel-command-state"><span class="duel-turn">TURN ${s.turnNo}</span><strong>${esc(PHASES[s.phase]||'終了')}</strong><span class="duel-who">${s.status==='finished'?'決着':s.pending?'応答中':myTurn()?'自分のターン':'相手のターン'}</span></div>${phaseButton||endButton?`<div class="duel-command-buttons">${phaseButton}${endButton}</div>`:''}${handJump}${layoutButton}</div>`;
  // The indicator reflects the phase already confirmed by the engine.
  // Current-step highlighting is decorative, never a navigation/control path.
  const phaseTrack=`<div class="sv-phase-track" role="group" aria-label="現在のフェイズ：${esc(PHASES[s.phase]||'終了')}">${Object.entries(PHASES).map(([key,name])=>`<span class="sv-phase-step${s.status==='playing'&&s.phase===key?' is-current':''}" ${s.status==='playing'&&s.phase===key?'aria-current="step"':''}>${esc(name)}</span>`).join('')}</div>`;
  const landscapeHud=`<div class="sv-landscape-hud" aria-label="ライフポイント"><div class="sv-landscape-seat sv-landscape-seat--opponent">${enemyStatus}</div><div class="sv-landscape-seat sv-landscape-seat--mine">${myStatus}</div></div>`;
  const duelHud=ui.duelCompact?`<div class="duel-hud" aria-label="ライフポイントとデッキ残数"><div class="duel-hud-seat"><span class="duel-hud-label">相手</span>${enemyStatus}</div><div class="duel-hud-seat"><span class="duel-hud-label">自分</span>${myStatus}</div></div>`:`<div class="statusbar">${enemyStatus}</div>`;
  // Opponent hand is public only as a count. Show card backs, never IDs.
  // Cap the decorative preview at 10 to avoid unnecessary DOM nodes.
  const opponentHand=`<div class="sv-opponent-hand" aria-label="相手の手札 ${enemy.hand.length}枚"><div class="sv-opponent-hand-cards" aria-hidden="true">${Array.from({length:Math.min(10,enemy.hand.length)},()=>`<span class="sv-opponent-hand-card">${cardHtml(null,{hidden:true})}</span>`).join('')}</div><span class="sv-opponent-hand-count">${enemy.hand.length}枚</span></div>`;
    const lastAction=s.log?.[0];
  const actionRecap=lastAction?`<div class="sv-action-recap" role="status" aria-label="直前の対戦ログ"><span class="sv-action-recap-mark" aria-hidden="true">✓</span><span class="sv-action-recap-label">直前</span><span class="sv-action-recap-text" title="${esc(lastAction)}">${esc(lastAction)}</span>${btn('履歴','showDuelLog','btn sm ghost sv-action-recap-open')}</div>`:'';
  return `${roombar}${commandBar}${phaseTrack}${actionRecap}${duelHud}${landscapeHud}
   ${handAdjustment?`<div class="notice hand-adjust-banner">エンドフェイズ：あと${me.hand.length-6}枚捨ててください ${btn('手札を見る','scrollToHand','btn sm primary')}</div>`:''}
   ${renderPending()}
   <div class="sv-target-banner" aria-live="polite">${renderTargetHint()}</div>
   <div class="sv-duel-workspace"><div class="sv-board-stack"><div class="battlefield" id="svDuelBoard">${opponentHand}
     <div class="field-zone-line sv-field--opponent"><span>相手のフィールド魔法</span>${fieldSlotHtml(enemy,'opponent')}</div>${duelPileRow(enemy,1-ui.seat,'opponent')}
     <div class="zone-caption sv-zone-heading sv-zone-heading--opponent"><span class="sv-zone-owner">相手</span><span>魔法・罠</span><span class="sv-zone-capacity">${enemy.backrow.filter(Boolean).length}/5</span></div>
     <div class="slots sv-board-row sv-board-row--opponent sv-board-row--backrow" role="group" aria-label="相手の魔法・罠ゾーン">${Array.from({length:5},(_,i)=>slotHtml(enemy,'opponent','backrow',i)).join('')}</div>
     <div class="zone-caption sv-zone-heading sv-zone-heading--opponent"><span class="sv-zone-owner">相手</span><span>モンスター</span><span class="sv-zone-capacity">${enemy.monsters.filter(Boolean).length}/5</span></div>
     <div class="slots sv-board-row sv-board-row--opponent sv-board-row--monsters" role="group" aria-label="相手のモンスターゾーン">${Array.from({length:5},(_,i)=>slotHtml(enemy,'opponent','monsters',i)).join('')}</div>
     <div class="field-center duel-center-mark sv-board-midline" aria-hidden="true"><span>✦</span><span>VS</span><span>✦</span></div>
     <div class="zone-caption sv-zone-heading sv-zone-heading--mine"><span class="sv-zone-owner">自分</span><span>モンスター</span><span class="sv-zone-capacity">${me.monsters.filter(Boolean).length}/5</span></div>
     <div class="slots sv-board-row sv-board-row--mine sv-board-row--monsters" role="group" aria-label="自分のモンスターゾーン">${Array.from({length:5},(_,i)=>slotHtml(me,'mine','monsters',i)).join('')}</div>
     <div class="zone-caption sv-zone-heading sv-zone-heading--mine"><span class="sv-zone-owner">自分</span><span>魔法・罠</span><span class="sv-zone-capacity">${me.backrow.filter(Boolean).length}/5</span></div>
     <div class="slots sv-board-row sv-board-row--mine sv-board-row--backrow" role="group" aria-label="自分の魔法・罠ゾーン">${Array.from({length:5},(_,i)=>slotHtml(me,'mine','backrow',i)).join('')}</div>${duelPileRow(me,ui.seat,'mine')}<div class="field-zone-line sv-field--mine"><span>自分のフィールド魔法</span>${fieldSlotHtml(me,'mine')}</div>
   </div>
   ${!ui.duelCompact?`<div class="statusbar">${myStatus}<div class="row">${ui.demo?btn('操作側を交代','switchSeat','btn sm secondary'):''}</div></div>`:ui.demo?`<div class="duel-demo-switch">${btn('操作側を交代','switchSeat','btn sm secondary')}</div>`:''}
   ${winner}
   </div><aside class="sv-hand-panel ${ui.handZoom?'sv-hand-zoom':''}" id="svDuelHand" aria-label="手札とカード操作">
   <div class="sv-hand-heading"><div class="hand-count">自分の手札 (${me.hand.length}枚)　${handAdjustment?'・捨てるカードをタップ':!myTurn()?'・相手のターン中':''}</div>
   ${me.hand.length?btn(ui.handZoom?'通常サイズ':'カード拡大','toggleHandZoom','btn sm ghost sv-hand-zoom-button',`aria-pressed="${ui.handZoom}" aria-label="${ui.handZoom?'手札カードを通常サイズに戻す':'手札カードを大きく表示'}"`):''}
   ${btn('盤面へ','scrollToBoard','btn sm ghost sv-board-shortcut', 'aria-label="デュエル盤面に移動"')}
   ${me.hand.length>handNavThreshold?`<div class="sv-hand-controls" role="group" aria-label="手札の送り操作"><span class="sv-hand-position" aria-hidden="true"></span>${btn('‹','handPrev','btn sm ghost sv-hand-nav','aria-label="手札を左へ" title="前のカード"')}${btn('›','handNext','btn sm ghost sv-hand-nav','aria-label="手札を右へ" title="次のカード"')}</div>`:''}</div>
   <div class="hand-scroll ${me.hand.length<=handNavThreshold?'sv-hand-balanced':''} ${me.hand.length>=9?'sv-hand-many':''}" role="region" aria-label="自分の手札。左右にスクロールできます" tabindex="0">${hand||'<div class="muted small">手札がありません</div>'}</div>
   ${renderSelection()}
   </aside></div>
   <details class="panel duel-tools" ${ui.duelToolsOpen?'open':''}><summary>その他の操作</summary><div class="row wrap battle-tools">
     ${btn('🎲 サイコロ','rollDice','btn sm secondary')}${btn('🪙 コイン','flipCoin','btn sm secondary')}
     ${myTurn()&&!ready&&['main1','main2'].includes(s.phase)?btn('山札を混ぜる','shuffleDeck','btn sm'):''}
     ${ui.demo?btn('↶ 1操作戻す','undoDemo','btn sm ghost','',!s.undoSnapshot):
       (s.undoRequest!==null&&s.undoRequest!==undefined&&s.undoRequest!==ui.seat?
        btn('取り消し承認','approveUndo','btn sm primary')+btn('拒否','rejectUndo','btn sm ghost'):
       btn(s.undoRequest===ui.seat?'承認待ち':'↶ 取り消しを依頼','requestUndo','btn sm ghost','',!s.undoSnapshot||s.undoActor!==ui.seat||s.undoRequest!==null&&s.undoRequest!==undefined))}
     ${myTurn()&&!ready&&['main1','main2'].includes(s.phase)&&me.extraDeck?.length?btn(`✦ EXデッキ (${me.extraDeck.length})`,'openFusion','btn sm primary'):''}
     ${btn('🎨 デザイン','openAppearance','btn sm')}${btn('墓地・除外','showGrave','btn sm secondary')}
   </div><div class="sv-landscape-menu-actions">${ui.demo?btn('操作側を交代','switchSeat','btn sm secondary'):''}${s.status==='playing'?btn('降参する','surrender','btn sm ghost'):''}${btn('🔊 演出設定','openFx','btn sm ghost')}${btn('ホームへ','goHome','btn sm ghost')}${!ui.demo?btn('招待リンクをコピー','copyInvite','btn sm ghost'):''}</div>${s.lastRandom?`<div class="notice mt8">${esc(s.lastRandom)}</div>`:''}
   </details>
   <details class="panel duel-log" ${ui.duelLogOpen?'open':''}><summary>対戦ログ (${s.log.length})</summary><div class="sv-log-content">${duelLogEntries(s.log)}</div></details>
   <div class="footer-links">${s.status==='playing'?btn('降参する','surrender','btn ghost sm'):''}${btn('🔊 演出設定','openFx','btn ghost sm')}${btn('ホームへ','goHome','btn ghost sm')}</div>
   ${ui.graveOpen?graveModal():''}${ui.deckInfoOpen?deckInfoModal():''}${ui.fxOpen?fxModal():''}${ui.appearanceOpen?appearanceModal():''}${ui.previewCardId?detailOverlay():''}${ui.specialDraft?specialModal():''}${ui.targetMode?.type==='revive'?graveReviveModal():''}`;
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
 if(!html){old?.remove();scheduleHandNavigation();return;}
 const template=document.createElement('template');template.innerHTML=html.trim();
 const next=template.content.firstElementChild;
 if(!next){old?.remove();scheduleHandNavigation();return;}
 if(old)old.replaceWith(next);
 else {const hand=view.querySelector('.hand-scroll');if(hand)hand.after(next);else view.append(next);}
 if(selected?.owner==='mine'&&selected.zone==='hand')revealHandCard(selected.index);
 // Selection opens or closes a hand dock without a resize or scroll event;
 // update the arrows after CSS layout, once in the next animation frame.
 scheduleHandNavigation();
}
// Graveyard and banished cards are public. Searching only filters local DOM;
// it does not mutate turn state, reveal hidden cards or schedule any background work.
function updateGraveFilter(){
 const dialog=$('view')?.querySelector('.sv-grave-dialog');if(!dialog)return;
 const query=(ui.graveSearch||'').normalize('NFKC').toLocaleLowerCase('ja').trim();
 const kind=ui.graveFilterType||'all';
 let matching=0,total=0;
 for(const zone of dialog.querySelectorAll('.sv-grave-zone')){
   let zoneMatches=0;
   for(const row of zone.querySelectorAll('.sv-grave-card')){
     const visible=(kind==='all'||row.dataset.cardkind===kind)&&(!query||(row.dataset.cardsearch||'').includes(query));
     row.hidden=!visible;total++;if(visible){zoneMatches++;matching++;}
   }
   const empty=zone.querySelector('.sv-grave-no-match');if(empty)empty.hidden=zoneMatches!==0;
 }
 for(const button of dialog.querySelectorAll('[data-action="graveType"]')){
   const selected=button.dataset.kind===kind;
   button.classList.toggle('is-active',selected);button.setAttribute('aria-pressed',String(selected));
 }
 const status=dialog.querySelector('.sv-grave-match-count');
 if(status)status.textContent=`表示 ${matching} / 全 ${total} 枚`;
 const reset=dialog.querySelector('[data-action="graveReset"]');
 if(reset)reset.hidden=!query&&kind==='all';
}
// Public graveyard/banish information only. Compact one-line card rows avoid
// duplicating uploaded base64 artwork in the DOM on long graveyard lists.
// Rendering never changes play order, the game state or the data-action route.
function graveModal(){
 const me=activePlayer(),enemy=ui.game.players[1-ui.seat];
 const cardRows=(cards,group)=>cards?.length?`<div class="sv-grave-list" aria-label="${group}のカード一覧">${cards.map(id=>{
   const c=CARD[id],name=c?.name||id,kind=c?.type||'unknown';
   const type=c?cardTypeName(c):'不明なカード';
   const normalizedName=name.normalize('NFKC').toLocaleLowerCase('ja');
   const stat=c?.type==='monster'?suffix(c):type;
   const symbol=c?.type==='monster'?'✹':c?.type==='spell'?'✦':'✧';
   return `<button type="button" class="grave-chip sv-grave-card" data-action="graveDetail" data-id="${esc(id)}" data-cardkind="${esc(kind)}" data-cardsearch="${esc(normalizedName)}" aria-label="${esc(name)}、${esc(stat)}、詳細を見る">
    <span class="sv-grave-art" aria-hidden="true"><span class="sv-grave-symbol">${symbol}</span><span class="sv-grave-emoji">${esc(c?.emoji||'✦')}</span></span>
    <span class="sv-grave-card-copy"><strong>${esc(name)}</strong><small>${esc(stat)}</small></span>
    <span class="sv-grave-chevron" aria-hidden="true">›</span></button>`;
 }).join('')}</div><p class="sv-grave-no-match" hidden>この条件に一致するカードはありません</p>`:'<p class="sv-grave-empty">カードはありません</p>';
 const playerColumn=(p,name,owner)=>`<section class="sv-grave-player" aria-label="${name}の墓地・除外">
  <h3 class="sv-grave-player-title"><span class="sv-grave-side sv-grave-side--${owner}">${name}</span><span>墓地・除外</span></h3>
  <section class="sv-grave-zone"><h4>墓地 <span>${p.grave.length}枚</span></h4>${cardRows(p.grave,name+'の墓地')}</section>
  <section class="sv-grave-zone"><h4>除外 <span>${(p.banished||[]).length}枚</span></h4>${cardRows(p.banished||[],name+'の除外')}</section>
 </section>`;
 return `<div class="modal sv-grave-modal" role="dialog" aria-modal="true" aria-label="墓地・除外ゾーン"><div class="modal-box sv-grave-dialog">
 <div class="modal-title-line sv-grave-modal-heading"><h2>墓地・除外ゾーン</h2>${btn('×','closeGrave','btn sm square','aria-label="墓地・除外を閉じる"')}</div>
 <div class="sv-grave-search-tools" role="search" aria-label="墓地・除外カードを検索">
   <label for="graveSearch" class="sv-grave-search-label">カード名で検索</label>
   <input type="search" id="graveSearch" class="input sv-grave-search" autocomplete="off" placeholder="カード名を入力" value="${esc(ui.graveSearch)}">
   <div class="sv-grave-type-filters" role="group" aria-label="カード種類の絞り込み">
     ${[['all','すべて'],['monster','モンスター'],['spell','魔法'],['trap','罠']].map(([kind,label])=>btn(label,'graveType',`sv-grave-type-filter${ui.graveFilterType===kind?' is-active':''}`,`data-kind="${kind}" aria-pressed="${ui.graveFilterType===kind}"`)).join('')}
   </div>
   <div class="sv-grave-search-bottom"><span class="sv-grave-match-count" role="status" aria-live="polite"></span>${btn('条件クリア','graveReset','btn sm ghost','hidden')}</div>
 </div>
 <div class="sv-grave-columns">${playerColumn(me,'自分','mine')}${playerColumn(enemy,'相手','opponent')}</div>
 </div></div>`;
}
function deckInfoModal(){
 const me=activePlayer(),enemy=ui.game?.players?.[1-ui.seat];
 return `<div class="modal" role="dialog" aria-modal="true" aria-label="デッキの枚数"><div class="modal-box sv-deck-summary"><div class="modal-title-line"><h2>デッキ</h2>${btn('×','closeDeckInfo','btn sm square')}</div>
 <p>自分：残り <strong>${me?.deck?.length??0}</strong> 枚</p>
 <p>相手：残り <strong>${enemy?.deck?.length??0}</strong> 枚</p>
 <p class="small muted">メインデッキは裏側です。カードの内容や順番は確認できません。</p></div></div>`;
}
function render(){
 const view=$('view');
 const mode=!!ui.game||!!ui.draftRoom,changed=ui.renderedMode!==mode;
 const wasGame=!!view.classList.contains('duel-active');
 if(ui.galleryOpen&&!ui.gallerySelected&&view.querySelector('.gallery-grid')){const list=view.querySelector('.gallery-dialog');if(list)ui.galleryScrollTop=list.scrollTop;}
 const oldY=wasGame?window.scrollY:0;
 const oldGalleryY=!wasGame&&ui.activeTab==='gallery'?window.scrollY:null;
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
 const nav=$('bottomNav');
 if(nav){nav.hidden=mode||!!ui.roomCode;for(const item of nav.querySelectorAll('[data-tab]')){const current=item.dataset.tab===ui.activeTab;item.classList.toggle('is-active',current);if(current)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');}}
 document.body.classList.toggle('sv-idle-mode',!mode&&!ui.roomCode);
 view.classList.toggle('duel-active',!!ui.game&&ui.game.status!=='waiting');
 view.classList.toggle('duel-compact',!!ui.game&&ui.game.status!=='waiting'&&ui.duelCompact);
 view.classList.toggle('sv-is-targeting',!!ui.game&&ui.game.status!=='waiting'&&!!ui.targetMode&&ui.targetMode.type!=='revive');
 view.classList.toggle('sv-is-responding',!!ui.game&&ui.game.status!=='waiting'&&!!ui.game.pending);
 view.innerHTML=ui.draftRoom?renderDraftRoom():ui.game?renderGame():ui.roomCode?`<section class="panel"><h2>部屋の情報を読み込み中</h2><p class="small muted">接続状態を確認しています。</p>${btn('ホームに戻る','goHome','btn secondary')}</section>`:renderHome();
 // Apply saved filters only when their list is present.
 if($('deckSearch')){updateCardRows('deck');if(ui.deckSort!=='default')updateDeckOrder();}
 if($('gallerySearch')){updateCardRows('gallery');const gallery=view.querySelector('.gallery-dialog');if(gallery)gallery.scrollTop=ui.galleryScrollTop;}
 if($('cardSearch'))updateManagedCards();
 if(ui.graveOpen)updateGraveFilter();
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
 if(oldGalleryY!==null&&ui.activeTab==='gallery'&&Math.abs(window.scrollY-oldGalleryY)>2){try{window.scrollTo(0,oldGalleryY);}catch{}}
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
// Only rearranges rendered deck rows. Game/card/deck state is never modified.
const DECK_SORTS=new Set(['default','included','name','atk','cost']);
function updateDeckOrder(toTop=false){
 const list=$('view')?.querySelector('.deck-manager .deck-list:not(.ex-deck-list)');
 if(!list||!ui.deckDraft)return;
 const mode=DECK_SORTS.has(ui.deckSort)?ui.deckSort:'default';
 if(mode==='default'&&list.dataset.sortMode==='default')return;
 const rows=Array.from(list.children);
 const counts=ui.deckDraft.counts;
 rows.sort((a,b)=>{
   if(mode==='included'){
     const diff=(counts[b.dataset.cardid]||0)-(counts[a.dataset.cardid]||0);
     if(diff)return diff;
   }else if(mode==='name'){
     const diff=galleryNameCollator.compare(CARD[a.dataset.cardid]?.name||'',CARD[b.dataset.cardid]?.name||'');
     if(diff)return diff;
   }else if(mode==='atk'){
     const ca=CARD[a.dataset.cardid],cb=CARD[b.dataset.cardid];
     if(ca?.type!=='monster'&&cb?.type==='monster')return 1;
     if(ca?.type==='monster'&&cb?.type!=='monster')return -1;
     if(ca?.type==='monster'&&cb?.type==='monster'){
       const diff=(Number(cb.atk)||0)-(Number(ca.atk)||0);
       if(diff)return diff;
     }
   }else if(mode==='cost'){
     const diff=cardCost(CARD[b.dataset.cardid])-cardCost(CARD[a.dataset.cardid]);
     if(diff)return diff;
   }
   return Number(a.dataset.originalOrder)-Number(b.dataset.originalOrder);
 });
 const top=list.scrollTop;
 const fragment=document.createDocumentFragment();
 for(const row of rows)fragment.appendChild(row);
 list.appendChild(fragment);
 list.dataset.sortMode=mode;
 list.scrollTop=toTop?0:top;
}
/** Update only deck counts/buttons; keep search, scroll and keyboard focus intact. */
function refreshDeckEditor(){
  if(!ui.deckDraft)return;
  const counts=ui.deckDraft.counts,total=sum(counts);
  const valid=validDeck(counts,ui.rules,ui.deckDraft.extraCounts||{})&&(!ui.collectionOnly||
    [...Object.entries(counts),...Object.entries(ui.deckDraft.extraCounts||{})].every(([id,n])=>n<=(deckPool()[id]||0)));
  const counter=document.querySelector('.deck-total');
  if(counter){counter.textContent=`${total} / ${ui.rules.deckSize}`;counter.classList.toggle('good',valid);}
  const progress=document.querySelector('.sv-deck-progress');
  if(progress){progress.setAttribute('aria-valuenow',String(total));progress.classList.toggle('is-ready',valid);const bar=progress.querySelector('.sv-deck-progress-bar');if(bar)bar.style.width=`${Math.min(100,100*total/Math.max(1,ui.rules.deckSize))}%`;}
  const progressNote=$('deckProgressNote');if(progressNote)progressNote.textContent=valid?'✓ 保存できます':total<ui.rules.deckSize?`あと ${ui.rules.deckSize-total} 枚`:'枚数・制限を確認してください';
  const save=document.querySelector('[data-action="saveDeck"]');if(save)save.disabled=!valid;
  const cost=document.querySelector('.deck-cost-total');if(cost)cost.textContent=String(deckCost(counts,CARD));
  const saveCount=document.querySelector('.sv-save-count');if(saveCount)saveCount.textContent=`${total} / ${ui.rules.deckSize}`;
  const typeTotals=document.querySelector('.sv-deck-types');if(typeTotals)typeTotals.textContent=`M ${deckCountType(counts,'monster')} ・ S ${deckCountType(counts,'spell')} ・ T ${deckCountType(counts,'trap')}`;
  const extra=ui.deckDraft.extraCounts||{},countExtra=sum(extra);
  const exTotal=document.querySelector('.ex-total');if(exTotal)exTotal.textContent=`${countExtra} / 15`;
  const exSave=document.querySelector('.sv-save-ex');if(exSave)exSave.textContent=`${countExtra} / 15`;
  for(const row of document.querySelectorAll('.ex-deck-item')){const add=row.querySelector('[data-action="extraPlus"]'),minus=row.querySelector('[data-action="extraMinus"]'),qty=row.querySelector('.ex-count');if(!add)continue;const n=extra[add.dataset.id]||0;if(qty)qty.textContent=String(n);if(minus)minus.disabled=n<1;add.disabled=![2,3].includes(CARD[add.dataset.id]?.fusionMaterials?.length)||n>=Math.min(cardLimit(CARD[add.dataset.id]),ui.collectionOnly?(deckPool()[add.dataset.id]||0):3)||countExtra>=15;}
  for(const row of document.querySelectorAll('.deck-item:not(.ex-deck-item)')){
    const add=row.querySelector('[data-action="deckPlus"]');if(!add)continue;
    const id=add.dataset.id,c=CARD[id],count=counts[id]||0;
    const minus=row.querySelector('[data-action="deckMinus"]');
    const qty=row.querySelector('.count');if(qty)qty.textContent=String(count);
    row.classList.toggle('sv-deck-included',count>0);
    if(minus)minus.disabled=count<=0;
    add.disabled=!c||count>=Math.min(cardLimit(c),ui.collectionOnly?(deckPool()[id]||0):3)||total>=ui.rules.deckSize;
  }
  // Quantity changes only affect visibility when the "in deck" filter is active.
  // Otherwise search, type and rarity results stay unchanged; do not rescan the list.
  if(ui.deckOnly)updateCardRows('deck');
  if(ui.deckSort==='included')updateDeckOrder();
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
 if(gallery){
   const total=CARDS.length,out=$('galleryMatchCount');if(out)out.textContent=`${matches} / ${total} 種類`;
   const empty=$('galleryEmpty');if(empty)empty.hidden=matches!==0;
   const clear=$('galleryClearSearch');if(clear)clear.hidden=!$('gallerySearch')?.value;
   const reset=document.querySelector('.sv-gallery-reset');if(reset)reset.hidden=type==='all'&&rarity==='all'&&!$('gallerySearch')?.value;
 }else{
   const out=$('deckMatchCount');if(out)out.textContent=`${matches}種類を表示`;
   const empty=$('deckEmpty');if(empty)empty.hidden=matches!==0;
   const changed=type!=='all'||rarity!=='all'||!!search||!!ui.deckOnly;
   const reset=document.querySelector('.sv-deck-reset');if(reset)reset.hidden=!changed;
   const active=document.querySelector('.sv-deck-tools-active');if(active)active.textContent=type!=='all'||rarity!=='all'?'（絞り込み中）':'';
 }
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
     // Four-digit room codes can be reused. Do not join a newly recreated room
     // based on the old get() snapshot, even if both rooms are still waiting.
     if(old&&!matchesOriginalRoom(initial,old)){
       failure='別の対戦部屋に切り替わりました。部屋コードを確認してください';return;
     }
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
 if(ui.roomGate){ui.roomGate.retire();ui.roomGate=null;}
 if(ui.unsub){ui.unsub();ui.unsub=null;}
 ui.demo=false;ui.demoDraft=false;ui.game=null;ui.draftRoom=null;ui.roomCode=code;ui.draftCode=code;ui.selected=null;ui.targetMode=null;ui.lastFxRevision=null;ui.pendingDrawEvent=null;closeDrawReveal();
 history.replaceState({},'',`${location.pathname}?${isDraft?'draft':'room'}=${code}`);
 ui.lastRoom={code};storage.setItem(LAST_ROOM_KEY,JSON.stringify(ui.lastRoom));
 const gate=createRoomSnapshotGate(code,()=>ui.roomCode);
 ui.roomGate=gate;
 ui.unsub=ui.sdk.onValue(ui.sdk.ref(ui.db,`rooms/${code}`),snap=>{
   const v=snap.val();
   // Avoid stale callbacks and older revisions resetting a newer game state.
   if(!gate.accept(v))return;
   if(!v){ui.game=null;ui.draftRoom=null;render();toast('部屋が見つかりません');return;}
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
 },err=>{if(ui.roomGate===gate&&ui.roomCode===code){toast('同期エラー：'+err.message);setNetwork('同期エラー','off');}});
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
 // Capture the originating room and authenticated user. Firebase may retry
 // an updater after a disconnect; never apply that old action in a new session.
 const session={code:ui.roomCode,uid:ui.uid,epoch:ui.connectionEpoch};
 try{
   const result=await ui.sdk.runTransaction(ui.sdk.ref(ui.db,`rooms/${session.code}`),old=>{
      if(!actionScopeIsCurrent(session,ui)){
        problem='画面の切り替え・通信切断により操作を中止しました';return;
      }
      if(!old){problem='部屋がありません';return;}
      if(old.revision!==expectedRevision){problem='相手の操作で対戦状況が更新されました。確認してやり直してください';return;}
      try{return applyAction(old,session.uid,action);}catch(e){problem=e.message;return;}
   },{applyLocally:false});
   // The room can still be visible after a disconnect/reconnect. Tell the
   // player the old operation was cancelled instead of silently doing nothing.
   if(!ui.demo && ui.roomCode===session.code && ui.uid===session.uid){
     if(!result.committed)toast(problem||'ほかの操作と重なりました。もう一度お試しください。');
     else ui.selected=null;
   }
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
 const p=activePlayer();if(p.sheepLockTurn===ui.game?.turnNo)return toast('羊トークンを出したターンは召喚できません');
 const need=summonTributeNeed(c,p.hand.length);
 const owned=p.monsters.map((m,i)=>m?i:null).filter(i=>i!==null);
 if(owned.length<need&&!hasDoubleLightTribute(c,p.monsters))return toast(`召喚には${need}体のリリースが必要です`);
 if(!need){
   // Gaia-type rule: normally choose the zero-release path, but a full
   // monster zone must offer the ordinary tribute alternative.
   if(c.level>4&&p.monsters.every(Boolean)){
     const ordinary=c.level<=6?1:2;
     return startTargetMode({type:'tribute',hand,faceDown,needed:ordinary,indices:[]});
   }
   return send({type:'summon',hand,faceDown,tributes:[]});
 }
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
    (d.kind==='ritual'||card.fusionMaterials?.includes(x.id)||CARD[x.id]?.ability?.operation==='fusionMaterialSubstitute')):[];
 const selected=allowed.filter(x=>d.materials.includes(`${x.zone}:${x.index}`));
 const matched=d.kind==='ritual'?selected.reduce((sum,m)=>sum+(CARD[m.id]?.level||0),0)>=(card?.level||Infinity):
    fusionMaterialsMatch(card?.fusionMaterials,selected.map(x=>x.id),id=>CARD[id]?.ability?.operation==='fusionMaterialSubstitute');
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
function compositeAction(origin,costIndices,target){
 let action;
 if(origin.type==='monsterEffect')action={type:'activateMonsterEffect',index:origin.index};
 else if(origin.type==='chainTrap')action={type:origin.attack?'activateTrap':'chainTrap',index:origin.index};
 else if(origin.type==='mainTrap')action={type:'activateMainTrap',index:origin.index};
 else if(origin.type==='quick')action={type:'quickResponse',source:origin.source,index:origin.index};
 else action={type:origin.source==='hand'?'spellFromHand':'spellFromField',
   [origin.source==='hand'?'hand':'index']:origin.index,field:origin.source==='field'};
 return {...action,...(costIndices?{costIndices}:{}) ,...(target!==undefined?{target}:{})};
}
function completePrerequisite(origin,indices){
 const costIndices=indices||[];
 const c=CARD[origin.id];if(!c)return;
 if(isGraveRevive(c.id)){startTargetMode({...origin,type:'revive',costIndices});return;}
 if(effectNeedsTarget(c.id)){startTargetMode({...origin,costIndices});return;}
 return send(compositeAction(origin,costIndices));
}
function beginComposite(origin){
 const cost=CARD[origin.id]?.ability?.before;
 if(!cost)return false;
 const meta=BEFORE_META[cost.operation],p=activePlayer();if(!meta||!p)return true;
 const excluded=meta.zone==='hand'&&origin.source==='hand'?1:
   meta.zone==='backrow'&&origin.source==='backrow'?1:0;
 const available=meta.zone==='lp'?Math.max(0,p.lp-1):
   meta.zone==='monsters'||meta.zone==='backrow'?p[meta.zone].filter(Boolean).length-excluded:
   (p[meta.zone]?.length||0)-excluded;
 if(available<cost.amount){toast('Aを実行できないため、このカードは発動できません');return true;}
 if(['monsters','backrow','hand'].includes(meta.zone)){
   startTargetMode({...origin,type:'prerequisite',originType:origin.type,indices:[]});return true;
 }
 completePrerequisite(origin,[]);return true;
}
function chooseSpell(source,index){
 const p=activePlayer(),id=source==='hand'?p.hand[index]:source==='field'?p.field?.id:p.backrow[index]?.id;
 if(!id)return;
 if(CARD[id]?.type==='spell'&&['ritual','fusion'].includes(spellKind(CARD[id])))return beginSpecial(spellKind(CARD[id]),{source,index});
 if(beginComposite({type:'spell',source,index,id}))return;
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
   if(mode.type==='prerequisite'){
     const cost=CARD[mode.id]?.ability?.before,meta=BEFORE_META[cost?.operation],p=activePlayer();
     const excluded=(zone==='hand'&&mode.source==='hand'||zone==='backrow'&&mode.source==='backrow')&&mode.index===index;
     if(owner==='mine'&&zone===meta?.zone&&p?.[zone]?.[index]&&!excluded){
       mode.indices=mode.indices.includes(index)?mode.indices.filter(i=>i!==index):[...mode.indices,index].slice(0,cost.amount);
       refreshDuelTarget();return;
     }return toast('Aに使用できる自分のカードを選んでください');
   }
   if(mode.type==='tribute'){
     if(owner==='mine'&&zone==='monsters'&&activePlayer()?.monsters[index]){
       mode.indices=mode.indices.includes(index)?mode.indices.filter(i=>i!==index):[...mode.indices,index].slice(0,mode.needed);refreshDuelTarget();return;
     }return toast('自分のモンスターをタップしてください');
   }
   if(mode.type==='move'){
     if(owner==='mine'&&zone===mode.zone&&!activePlayer()?.[zone]?.[index])return send({type:'moveCard',zone:zone,from:mode.from,to:index});
     return toast('同じ列の空きゾーンをタップしてください');
   }
   if(mode.type==='attack'&&owner==='opponent'&&zone==='monsters'&&ui.game.players[1-ui.seat].monsters[index]){
     if(!isAttackTargetLegal(ui.game,ui.seat,index))return toast('このモンスターは仲間に守られているため攻撃できません');
     return send({type:'attack',index:mode.index,target:index});
   }
   if(['monsterEffect','chainTrap','mainTrap','quick','spell'].includes(mode.type)){
     const id=mode.id|| (mode.type==='monsterEffect'?activePlayer()?.monsters[mode.index]?.id:
       ['chainTrap','mainTrap'].includes(mode.type)?activePlayer()?.backrow[mode.index]?.id:null);
     const side=owner==='mine'?ui.seat:1-ui.seat,targetPlayer=ui.game.players[side];
     const item=zone==='field'?targetPlayer.field:targetPlayer?.[zone]?.[index];
     if(targetFlags(owner,zone,index,item).eligible){
       if(eitherSideTarget(effectTarget(id)))return send(compositeAction(mode,mode.costIndices,{seat:side,index:zone==='field'?-1:index}));
       if(mode.type==='monsterEffect')return send({type:'activateMonsterEffect',index:mode.index,target:index,...(mode.costIndices?{costIndices:mode.costIndices}:{})});
       if(mode.type==='chainTrap')return send({type:mode.attack?'activateTrap':'chainTrap',index:mode.index,target:index,...(mode.costIndices?{costIndices:mode.costIndices}:{})});
       if(mode.type==='mainTrap')return send({type:'activateMainTrap',index:mode.index,target:index});
       if(mode.type==='quick')return send({type:'quickResponse',source:mode.source,index:mode.index,target:index,...(mode.costIndices?{costIndices:mode.costIndices}:{})});
       if(mode.type==='spell')return send({type:mode.source==='hand'?'spellFromHand':'spellFromField',
          [mode.source==='hand'?'hand':'index']:mode.index,field:mode.source==='field',target:index,...(mode.costIndices?{costIndices:mode.costIndices}:{})});
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
function goHome(){ui.activeTab='duel';ui.duelLogFilter='all';clearBoardCue();if(ui.roomGate){ui.roomGate.retire();ui.roomGate=null;}if(ui.unsub){ui.unsub();ui.unsub=null;}ui.demo=false;ui.demoDraft=false;ui.draftRoom=null;ui.draftCode='';ui.draftOpen=false;ui.game=null;ui.roomCode='';ui.selected=null;ui.targetMode=null;ui.specialDraft=null;ui.graveOpen=false;ui.deckInfoOpen=false;ui.fxOpen=false;ui.settingsOpen=false;ui.duelOpen=false;ui.lastFxRevision=null;ui.pendingDrawEvent=null;closeDrawReveal();try{history.replaceState({},'',location.pathname);}catch{}if(configReady&&ui.db)setNetwork(ui.networkConnected===true?'オンライン接続可能':ui.networkConnected===false?'再接続待ち':'接続確認中',ui.networkConnected===true?'ok':ui.networkConnected===false?'off':'');else setNetwork('お試し対戦可能');render();}
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
     const connected=snap.val()===true;
     // A transaction queued while disconnected must not replay after reconnection.
     if(ui.networkConnected===true&&!connected)ui.connectionEpoch++;
     ui.networkConnected=connected;
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
$('bottomNav').addEventListener('click',e=>{
  const target=e.target.closest('button[data-tab]');if(!target||ui.busy||ui.game||ui.draftRoom||ui.roomCode)return;
  const next=target.dataset.tab;if(!['duel','gallery','decks','settings'].includes(next)||ui.activeTab===next)return;
  ui.tabScrollY[ui.activeTab]=window.scrollY;
  readHomeValues();ui.activeTab=next;ui.duelOpen=false;ui.draftOpen=false;ui.galleryOpen=false;ui.gallerySelected=null;
  ui.deckOpen=false;ui.deckDraft=null;ui.cardsOpen=false;ui.cardDraft=null;ui.settingsOpen=false;
  ui.fxOpen=false;ui.rulesOpen=false;ui.appearanceOpen=false;ui.previewCardId=null;ui.packOpen=false;ui.sealedOpen=false;
  render();requestAnimationFrame(()=>{try{window.scrollTo(0,ui.tabScrollY[next]||0);}catch{}});
});
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
 if(action==='extraPlus'||action==='extraMinus'){if(!ui.deckDraft)return;const id=el.dataset.id,c=CARD[id];if(!c||summonKind(c)!=='fusion')return;const counts=ui.deckDraft.extraCounts||={},n=counts[id]||0;if(action==='extraPlus'&&[2,3].includes(c.fusionMaterials?.length)&&n<Math.min(cardLimit(c),ui.collectionOnly?(deckPool()[id]||0):3)&&sum(counts)<15)counts[id]=n+1;else if(action==='extraMinus'&&n>0){if(n===1)delete counts[id];else counts[id]=n-1;}ui.deckDraft.extraCounts=counts;saveSealedDraft();saveDeckDraft();refreshDeckEditor();return;}
 if(action==='toggleCompact'){ui.duelCompact=!ui.duelCompact;storage.setItem('duel-compact',ui.duelCompact?'1':'0');render();return;}
 if(action==='toggleHandZoom'){if(!ui.game)return;ui.handZoom=!ui.handZoom;storage.setItem('saho-hand-zoom-v1',ui.handZoom?'1':'0');render();return;}
 if(action==='openDuel'){ui.duelOpen=true;render();requestAnimationFrame(()=>document.getElementById('duel-setup')?.scrollIntoView({behavior:'smooth',block:'start'}));return;}
 if(action==='closeDuel'){ui.duelOpen=false;render();return;}
 if(action==='exportBackup'){exportBackup();return;}
 if(action==='resumeRoom'){return reconnectLastRoom(ui.lastRoom?.code||'');}
 if(action==='openSettings'){ui.activeTab='settings';ui.settingsOpen=false;render();return;}
 if(action==='closeSettings'){ui.settingsOpen=false;render();return;}
 if(action==='settingsAppearance'){ui.settingsOpen=false;ui.appearanceOpen=true;render();return;}
 if(action==='settingsFx'){ui.settingsOpen=false;ui.fxOpen=true;render();return;}
 if(action==='settingsRules'){ui.settingsOpen=false;ui.rulesOpen=true;render();return;}
 if(action==='openRules'){ui.rulesOpen=true;render();return;}
 if(action==='closeRules'){ui.rulesOpen=false;render();return;}
 if(action==='saveRules'){ui.rules=writeRuleSettings(storage,{lp:Number($('ruleLP').value),deckSize:Number($('ruleDeck').value),costLimit:Number($('ruleCost').value)});ui.rulesOpen=false;render();toast('ルールを保存しました');return;}
 if(action==='openAppearance'){ui.appearanceOpen=true;render();return;}
 if(action==='closeAppearance'){ui.appearanceOpen=false;render();return;}
  if(action==='appearancePick'){
    const kind=el.dataset.kind,value=el.dataset.value;
    const choices=kind==='mat'?APPEARANCE_MATS:kind==='back'?APPEARANCE_BACKS:null;
    if(!choices||!choices.some(option=>option.id===value)||ui.appearance[kind]===value)return;
    ui.appearance[kind]=value;persistAppearance();
    // Update the two selected tiles in place. Keep the gallery scroll position
    // and focus (instead of rebuilding all four tab pages after every tap).
    for(const tile of document.querySelectorAll('.sv-appearance-entry[data-kind="'+kind+'"]')){
      const selected=tile.dataset.value===value;
      tile.classList.toggle('is-selected',selected);
      tile.setAttribute('aria-pressed',String(selected));
      tile.querySelector('.sv-appearance-badge')?.remove();
      if(selected){const badge=document.createElement('span');badge.className='sv-appearance-badge';badge.textContent='選択中';tile.append(badge);}
    }
    const current=document.querySelector('[data-appearance-current="'+kind+'"]');
    if(current)current.textContent='選択中：'+appearanceLabel(kind,value);
    return;
  }
 if(action==='openSealed'){return;} // Pack entry intentionally disabled until future development.
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
 if(action==='openPacks'){return;} // Pack entry disabled; underlying pack logic retained.
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
 if(action==='graveType'){
   if(!ui.graveOpen||!['all','monster','spell','trap'].includes(el.dataset.kind))return;
   ui.graveFilterType=el.dataset.kind;updateGraveFilter();return;
 }
 if(action==='graveReset'){
   ui.graveSearch='';ui.graveFilterType='all';
   const search=$('graveSearch');if(search)search.value='';
   updateGraveFilter();return;
 }
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
 if(action==='saveEffectTemplate')return saveOwnEffectTemplate();
 if(action==='applyEffectTemplate')return applyOwnEffectTemplate();
 if(action==='deleteEffectTemplate')return removeOwnEffectTemplate();
 if(action==='saveCard')return saveCardFromForm();
 if(action==='deleteCard')return deleteCard();
 if(action==='removeCardImage'){if(ui.cardDraft){readCardForm();ui.cardDraft.image='';saveCardDraft();render();}return;}
 if(action==='openGallery'){readHomeValues();ui.activeTab='gallery';ui.galleryOpen=false;ui.gallerySelected=null;ui.galleryScrollTop=0;render();return;}
 if(action==='closeGallery'){ui.galleryOpen=false;ui.gallerySelected=null;render();return;}
 if(action==='galleryClearSearch'){
   ui.gallerySearch='';const input=$('gallerySearch');if(input)input.value='';updateCardRows('gallery');return;
 }
 if(action==='galleryReset'){
   ui.galleryFilterType='all';ui.galleryFilterRarity='all';ui.gallerySearch='';
   if($('galleryType'))$('galleryType').value='all';
   if($('galleryRarity'))$('galleryRarity').value='all';
   if($('gallerySearch'))$('gallerySearch').value='';
   updateCardRows('gallery');return;
 }
 if(action==='galleryPrev'||action==='galleryNext'){
   const ids=galleryVisibleIds(),index=ids.indexOf(ui.gallerySelected);
   const next=index+(action==='galleryNext'?1:-1);
   if(index<0||next<0||next>=ids.length)return;
   ui.gallerySelected=ids[next];render();
   document.querySelector('.sv-detail-dialog [data-action="'+action+'"]')?.focus({preventScroll:true});return;
 }
 if(action==='galleryDetail'){ui.galleryScrollTop=ui.activeTab==='gallery'?window.scrollY:($('view').querySelector('.gallery-dialog')?.scrollTop||0);ui.gallerySearch=$('gallerySearch')?.value||ui.gallerySearch;ui.gallerySelected=el.dataset.id;render();return;}
 if(action==='galleryBack'){ui.gallerySelected=null;render();if(ui.activeTab==='gallery')requestAnimationFrame(()=>window.scrollTo(0,ui.galleryScrollTop));return;}
 if(action==='editDeck'){readHomeValues();ui.activeTab='decks';ui.sealedOnly=false;ui.collectionOnly=false;ui.deckOpen=false;ui.deckDraft=null;render();return;}
 if(action==='closeDeck'){saveSealedDraft();const wasSealed=ui.sealedOnly;ui.deckOpen=false;ui.deckDraft=null;ui.sealedOnly=false;ui.collectionOnly=false;if(wasSealed)ui.sealedOpen=true;render();return;}
 if(action==='deckBack'){saveSealedDraft();if(ui.sealedOnly){ui.sealedOnly=false;ui.collectionOnly=false;ui.deckOpen=false;ui.sealedOpen=true;}ui.deckDraft=null;render();return;}
 if(action==='resumeDeckDraft'){const d=existingDraft(DECK_DRAFT_KEY);if(d&&d.counts&&d.extraCounts){ui.deckDraft=d;ui.sealedOnly=false;ui.collectionOnly=false;render();}return;}
 if(action==='discardDeckDraft'){clearDeckDraft();render();return;}
 if(action==='deckNew'||action==='deckNewRed'||action==='deckNewBlue'){
   startDeckDraft('new');
   if(ui.deckDraft&&action!=='deckNew'){ui.deckDraft.counts=copyPreset(action==='deckNewRed'?'red':'blue');ui.deckDraft.extraCounts={m26:1};ui.deckDraft.name=action==='deckNewRed'?'紅蓮デッキ（新規）':'蒼海デッキ（新規）';saveDeckDraft();render();}
   return;
 }
 if(action==='deckRestoreHistoric'){
   let added=0;for(const [key,p] of Object.entries(HISTORICAL_PRESETS)){if(ui.decks.decks.length>=MAX_SAVED_DECKS)break;const id=`d_historic${key}20012002`;if(ui.decks.decks.some(d=>d.id===id))continue;ui.decks.decks.push({id,name:p.name,counts:{...p.counts},extraCounts:key==='ka'?{}:{...p.extraCounts},updatedAt:Date.now()});added++;}
   if(added){persistDecks();render();toast(`${added}種の復刻デッキを追加しました`);}else toast('復刻デッキはすべて登録済みか、保存枠が上限です');return;
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
 if(action==='deckReset'){
   ui.deckFilterType='all';ui.deckFilterRarity='all';ui.deckSearch='';ui.deckOnly=false;
   if($('deckType'))$('deckType').value='all';if($('deckRarity'))$('deckRarity').value='all';
   if($('deckSearch'))$('deckSearch').value='';if($('deckOnly'))$('deckOnly').checked=false;
   updateCardRows('deck');return;
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
   if(action==='deckClear'&&(sum(ui.deckDraft.counts)>0||sum(ui.deckDraft.extraCounts||{})>0)&&!confirm('編集中のデッキのカードをすべて外しますか？'))return;
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
   if(beginComposite({type:'quick',source,index,id}))return;
   if(effectNeedsTarget(id)){
     startTargetMode({type:'quick',source,index,id});toast('効果の対象をタップしてください');return;
   }
   return send({type:'quickResponse',source,index});
 }
 if(action==='activateMainTrap'){
   const i=Number(el.dataset.index??ui.selected?.index),card=CARD[activePlayer()?.backrow[i]?.id];
   if(!card)return;
   if(beginComposite({type:'mainTrap',index:i,id:card.id}))return;
   if(effectNeedsTarget(card.id)){startTargetMode({type:'mainTrap',index:i,id:card.id});return;}
   return send({type:'activateMainTrap',index:i});
 }
 if(action==='activateContinuousTrap'){const i=Number(el.dataset.index??ui.selected?.index);return send({type:'activateContinuousTrap',index:i});}
 if(action==='chainTrap'){const i=Number(el.dataset.index),c=CARD[activePlayer()?.backrow[i]?.id];
  if(c&&beginComposite({type:'chainTrap',index:i,id:c.id}))return;
  if(c&&effectNeedsTarget(c.id)){startTargetMode({type:'chainTrap',index:i,id:c.id});return;}
  return send({type:'chainTrap',index:i});}
 if(action==='manualDraw')return send({type:'manualDraw'});
 if(action==='shuffleDeck')return send({type:'shuffleDeck'});
 if(action==='rollDice')return send({type:'random',kind:'dice'});
 if(action==='flipCoin')return send({type:'random',kind:'coin'});
 if(action==='requestUndo'||action==='approveUndo'||action==='rejectUndo')return send({type:action});
 if(action==='undoDemo')return send({type:'undoDemo'});
 if(action==='moveSelected'){const x=ui.selected;if(!x||x.owner!=='mine')return;startTargetMode({type:'move',zone:x.zone,from:x.index});return;}
 if(action==='handPrev'||action==='handNext'){scrollHandCards(action==='handPrev'?-1:1);return;}
 if(action==='focusTargets'){focusDuelTargets();return;}
 if(action==='duelLogFilter'){
   if(!ui.game||!DUEL_LOG_FILTERS.some(([value])=>value===el.dataset.filter))return;
   ui.duelLogFilter=el.dataset.filter;updateDuelLogView();return;
 }
 if(action==='showDuelLog'){const panel=$('view')?.querySelector('.duel-log');if(panel){ui.duelLogFilter='all';updateDuelLogView();panel.open=true;ui.duelLogOpen=true;panel.scrollIntoView({block:'center',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}return;}
 if(action==='scrollToHand'||action==='scrollToBoard'){
   const dest=$('view')?.querySelector(action==='scrollToHand'?'#svDuelHand':'#svDuelBoard');
   if(dest){const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
     dest.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start',inline:'nearest'});}
   return;
 }
 if(action==='endTurn')return send({type:'endTurn'});
 if(action==='passAttack')return send({type:'passAttack'});
 if(action==='discardBattleGuard')return send({type:'discardBattleGuard',hand:Number(el.dataset.index)});
 if(action==='trap'){
  const i=Number(el.dataset.index??ui.selected?.index),c=CARD[activePlayer()?.backrow[i]?.id];
  if(c&&beginComposite({type:'chainTrap',attack:true,index:i,id:c.id}))return;
  if(c&&effectNeedsTarget(c.id)){
   startTargetMode({type:'chainTrap',attack:true,index:i,id:c.id});return;
  }
  return send({type:'activateTrap',index:i});
 }
 if(action==='confirmPrerequisite'){const m=ui.targetMode,c=CARD[m?.id]?.ability?.before;if(m?.type==='prerequisite'&&c?.amount===m.indices.length)completePrerequisite({...m,type:m.originType},[...m.indices]);return;}
 if(action==='confirmTributes'){const m=ui.targetMode;if(m?.type==='tribute'&&validSummonTributes(CARD[activePlayer()?.hand[m.hand]],activePlayer()?.hand.length,activePlayer()?.monsters,m.indices))return send({type:'summon',hand:m.hand,faceDown:m.faceDown,tributes:[...m.indices]});return;}
 if(action==='specialSummonSelf'){if(activePlayer()?.sheepLockTurn===ui.game?.turnNo)return toast('羊トークンを出したターンは特殊召喚できません');return send({type:'specialSummonSelf',hand:ui.selected?.index});}
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
   if(beginComposite({type:'monsterEffect',index:i,id:c.id}))return;
   if(effectNeedsTarget(c.id)){
     startTargetMode({type:'monsterEffect',index:i,id:c.id});return;
   }
   return send({type:'activateMonsterEffect',index:i});
 }
 if(action==='attackSelect'){startTargetMode({type:'attack',index:ui.selected.index});return;}
 if(action==='directAttackSelected'){
   // In contrast to auto-attack, this path requires a deliberate button tap.
   // Recheck visible conditions in case the selected card changed meanwhile.
   const sel=ui.selected,s=ui.game,me=activePlayer(),opponent=s?.players?.[1-ui.seat];
   const monster=sel?.owner==='mine'&&sel.zone==='monsters'?me?.monsters?.[sel.index]:null;
   if(!s||!myTurn()||s.phase!=='battle'||s.pending||s.turnNo<=1||!monster||
      monster.pos!=='atk'||remainingAttacks(monster)<1||(monster.attackLockedUntil||0)>=s.turnNo||isAttackSealedByEquip(s,ui.seat,monster)||
      (CARD[monster.id]?.ability?.operation==='tributeOtherToAttack'&&!me.monsters.some((m,i)=>i!==sel.index&&m))||
      !canDirectAttackWithMonsters(s,ui.seat,monster))return toast('攻撃条件が変わりました。カードを選び直してください');
   return send({type:'attack',index:sel.index,target:-1});
 }
 if(action==='directAttack'){const mode=ui.targetMode;if(mode?.type!=='attack')return;return send({type:'attack',index:mode.index,target:-1});}
 if(action==='selectRevive'){
   const m=ui.targetMode;if(m?.type!=='revive')return;
   const seat=Number(el.dataset.seat),index=Number(el.dataset.index),cardId=el.dataset.id;
   if(![0,1].includes(seat)||!Number.isInteger(index)||ui.game?.players[seat]?.grave[index]!==cardId||CARD[cardId]?.type!=='monster')return toast('墓地の対象が変わりました。もう一度選択してください');
   return send({type:m.source==='hand'?'spellFromHand':'spellFromField',[m.source==='hand'?'hand':'index']:m.index,field:m.source==='field',target:{seat,index,cardId},...(m.costIndices?{costIndices:m.costIndices}:{})});
 }
 if(action==='cancelTarget'){const modal=ui.targetMode?.type==='revive';ui.targetMode=null;if(modal)render();else refreshDuelTarget();return;}
 if(action==='surrender'&&confirm('本当に降参しますか？'))return send({type:'surrender'});
 if(action==='showGrave'){ui.graveSearch='';ui.graveFilterType='all';ui.graveOpen=true;ui.deckInfoOpen=false;render();return;}
 if(action==='closeGrave'){ui.graveOpen=false;render();return;}
 if(action==='showDeckInfo'){ui.deckInfoOpen=true;ui.graveOpen=false;render();return;}
 if(action==='closeDeckInfo'){ui.deckInfoOpen=false;render();return;}
});
$('view').addEventListener('input',e=>{
 if(e.target.id==='fxVolume'){ui.fxSettings.volume=Number(e.target.value);writeFxSettings(ui.fxSettings);const el=$('fxVolumeValue');if(el)el.textContent=`${ui.fxSettings.volume}%`;return;}
 if(e.target.id==='graveSearch'){ui.graveSearch=e.target.value;updateGraveFilter();return;}
 if(e.target.id==='gallerySearch'){ui.gallerySearch=e.target.value;updateCardRows('gallery');return;}
 if(e.target.id==='deckSearch'){updateCardRows('deck');return;}
 if(e.target.id==='deckName'&&ui.deckDraft){ui.deckDraft.name=e.target.value;saveSealedDraft();saveDeckDraft();return;}
 if(e.target.id==='cardSearch'){updateManagedCards();return;}
 if(ui.cardDraft&&/^cardCountName[1-3]$/.test(e.target.id)){
   readCardForm();
   const note=document.querySelector('.sv-effect-preview');if(note)note.textContent=effectText(ui.cardDraft);
 }
 if(ui.cardDraft&&['cardNamedQuery','cardName','cardLevel','cardAtk','cardDef','cardCost','cardEmoji','cardDesc','cardAbilityAmount','cardBeforeAmount','cardPassiveAmount','cardPassiveThreshold','cardPassiveNegativeAmount','cardPassiveName1','cardPassiveName2','cardFlipMillAmount','cardMultiAttackCount','cardFlipBounceCount','cardGraveSearchThreshold'].includes(e.target.id)){
   readCardForm();
   const preview=document.querySelector('.card-demo');if(preview)preview.innerHTML=cardHtmlPreview(ui.cardDraft);
   if(['cardNamedQuery','cardAbilityAmount','cardBeforeAmount','cardPassiveAmount','cardPassiveThreshold','cardPassiveNegativeAmount','cardPassiveName1','cardPassiveName2','cardFlipMillAmount','cardMultiAttackCount','cardFlipBounceCount','cardGraveSearchThreshold'].includes(e.target.id)){
     const note=document.querySelector('.sv-effect-preview');if(note)note.textContent=ui.cardDraft.ability?abilityText(ui.cardDraft.ability):effectText(ui.cardDraft);
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
 if(['cardType','cardSubtype','cardSpellKind','cardSummonKind','cardEffectKind','cardEffectCode','cardEffectMode','cardAbilityWhen','cardAbilityTarget','cardAbilityOperation','cardAbilitySequence','cardBeforeOperation','cardThenOperation','cardSearchFilter','cardGraveSearchStat'].includes(e.target.id)&&ui.cardDraft){
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
   if(e.target.id==='cardEffectKind'){const code=Object.keys(MONSTER_EFFECTS[e.target.value])[0];ui.cardDraft.monsterEffect=defaultPassiveConfig(code)||{kind:e.target.value,code};}
   if(e.target.id==='cardEffectCode'&&ui.cardDraft.type==='monster'&&ui.cardDraft.subtype==='effect'){
     const code=e.target.value,kind=ui.cardDraft.monsterEffect?.kind||'ignition';
     ui.cardDraft.monsterEffect=defaultPassiveConfig(code)||{kind,code};
   }
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
       const op=e.target.value==='continuous'?(ui.cardDraft.type==='trap'?'extraNormalSummon':'boost'):e.target.value==='response'?'negateEffect':e.target.value==='attack'?'negateAttack':'draw';
       ui.cardDraft.ability.operation=op;ui.cardDraft.ability.amount=ABILITY_META[op].amount;
     }
     const validTargets=abilityTargets(ui.cardDraft.ability.operation,e.target.value,ui.cardDraft.type,spellKind(ui.cardDraft));
     if(!validTargets.includes(ui.cardDraft.ability.target))ui.cardDraft.ability.target=validTargets[0];
     if(ui.cardDraft.ability.then){const then=ui.cardDraft.ability.then,valid=followUpTargets(then.operation,ui.cardDraft.ability.target,e.target.value,ui.cardDraft.type,spellKind(ui.cardDraft));if(!valid.includes(then.target))then.target=valid[0];if(!then.target)delete ui.cardDraft.ability.then;}
     if(!['main','attack','response'].includes(e.target.value))delete ui.cardDraft.ability.before;
     if(e.target.value==='continuous'||e.target.value==='battleDamage')delete ui.cardDraft.ability.then;
   }
   if(e.target.id==='cardAbilitySequence'&&ui.cardDraft.ability){
     const ab=ui.cardDraft.ability;
     delete ab.before;delete ab.then;
     if(e.target.value==='sequential'||ab.operation==='crushVirus'){
       const operation=abilityCostOptions(ab.operation,ab.target)[0];
       ab.before={operation,amount:BEFORE_META[operation].amount};
     }
     if(e.target.value==='ifResolved'){
       const options=Object.keys(availableOperations(ab.when,ui.cardDraft)).filter(op=>followUpTargets(op,ab.target,ab.when,ui.cardDraft.type,spellKind(ui.cardDraft)).length);
       const op=options.includes('draw')?'draw':options[0];
       if(op)ab.then={operation:op,target:followUpTargets(op,ab.target,ab.when,ui.cardDraft.type,spellKind(ui.cardDraft))[0],amount:ABILITY_META[op].amount};
     }
   }
   if(e.target.id==='cardThenOperation'&&ui.cardDraft.ability?.then){
     const ab=ui.cardDraft.ability;const op=e.target.value;
     const available=followUpTargets(op,ab.target,ab.when,ui.cardDraft.type,spellKind(ui.cardDraft));
     if(available.length)ab.then={operation:op,target:available[0],amount:ABILITY_META[op].amount};
   }
   if(e.target.id==='cardBeforeOperation'&&ui.cardDraft.ability?.before){
     ui.cardDraft.ability.before={operation:e.target.value,amount:BEFORE_META[e.target.value]?.amount||1};
   }
   if(e.target.id==='cardAbilityOperation'&&ui.cardDraft.ability){
     const op=e.target.value,when=ui.cardDraft.ability.when;
     ui.cardDraft.ability.operation=op;const valid=abilityTargets(op,when,ui.cardDraft.type,spellKind(ui.cardDraft));if(!valid.includes(ui.cardDraft.ability.target))ui.cardDraft.ability.target=valid[0];ui.cardDraft.ability.amount=ABILITY_META[op].amount;
     if(op==='crushVirus'){ui.cardDraft.ability.before={operation:'sendOwnMonsterGrave',amount:1};delete ui.cardDraft.ability.then;}
     else if(op==='revealSetMonsters'){delete ui.cardDraft.ability.before;delete ui.cardDraft.ability.then;}
     if(['summonSheepTokens','summonKuribohTokens'].includes(op)){delete ui.cardDraft.ability.before;delete ui.cardDraft.ability.then;}
     if(op==='summonRaceFromHand'){ui.cardDraft.ability.match='race';ui.cardDraft.ability.query='ドラゴン';delete ui.cardDraft.ability.then;delete ui.cardDraft.ability.before;}
     else if(op==='millFirstType'){ui.cardDraft.ability.match='monster';delete ui.cardDraft.ability.query;delete ui.cardDraft.ability.then;}
     else if(op==='summonNamedFromHand'){ui.cardDraft.ability.match='exact';ui.cardDraft.ability.query='ランプの魔精・ラ・ジーン';delete ui.cardDraft.ability.then;}
     else {delete ui.cardDraft.ability.match;delete ui.cardDraft.ability.query;}
     if(op!=='summonRaceFromHand')delete ui.cardDraft.ability.requiredFaceUpName;
     if(['negateAttack','negateEffect'].includes(op))delete ui.cardDraft.ability.then;
   }
   saveCardDraft();render();return;
 }
 if(e.target.id.startsWith('cardCount')&&ui.cardDraft){
   readCardForm();
   if(e.target.id.startsWith('cardCountZone-'))render();
   else {
     const note=document.querySelector('.sv-effect-preview');if(note)note.textContent=effectText(ui.cardDraft);
   }
   return;
 }
 if(e.target.id==='effectTemplateSelect'&&ui.cardDraft){const note=document.querySelector('.sv-template-description');if(note)note.textContent='選択中：'+(e.target.selectedOptions[0]?.dataset.description||'');return;}
 if(['cardFlipScope','cardGraveSearchLimit'].includes(e.target.id)&&ui.cardDraft){
   readCardForm();
   const note=document.querySelector('.sv-effect-preview');if(note)note.textContent=effectText(ui.cardDraft);
   return;
 }
 if(['cardAttribute','cardRace'].includes(e.target.id)&&ui.cardDraft){readCardForm();const preview=document.querySelector('.card-demo');if(preview)preview.innerHTML=cardHtmlPreview(ui.cardDraft);return;}
 if(['cardSummonRace','cardSummonRequired','cardMillType','cardNamedMatch','cardNamedQuery','cardPassiveAmount','cardPassiveName1','cardPassiveName2','cardPassiveScope','cardPassiveRace','cardPassiveAttribute','cardPassiveThreshold','cardPassiveNegativeAttribute','cardPassiveNegativeAmount','cardFlipMillAmount','cardScoutDrawAmount','cardSearchName','cardMultiAttackCount','cardFlipBounceCount','cardGraveSearchThreshold','cardAbilityTarget','cardAbilityAmount','cardThenTarget','cardThenAmount','cardLimit','cardCost','fusionMat1','fusionMat2','ritualFor'].includes(e.target.id)&&ui.cardDraft){readCardForm();if(e.target.id.startsWith('cardPassive')||['cardSummonRace','cardSummonRequired','cardMillType','cardNamedMatch','cardNamedQuery','cardFlipMillAmount','cardScoutDrawAmount','cardSearchName','cardMultiAttackCount','cardFlipBounceCount','cardGraveSearchThreshold','cardAbilityTarget','cardAbilityAmount','cardThenTarget','cardThenAmount'].includes(e.target.id)){const note=document.querySelector('.sv-effect-preview');if(note)note.textContent=ui.cardDraft.ability?abilityText(ui.cardDraft.ability):effectText(ui.cardDraft);}return;}
 if(e.target.id==='cardRarity'&&ui.cardDraft){readCardForm();const preview=document.querySelector('.card-demo');if(preview)preview.innerHTML=cardHtmlPreview(ui.cardDraft);return;}
 if(e.target.id==='matChoice'||e.target.id==='backChoice'){ui.appearance[e.target.id==='matChoice'?'mat':'back']=e.target.value;persistAppearance();return;}
 if(e.target.id==='collectionOnly'){ui.collectionOnly=e.target.checked;render();return;}
 if(e.target.id==='deckOnly'){ui.deckOnly=e.target.checked;updateCardRows('deck');return;}
 if(e.target.id==='cardManageType'||e.target.id==='cardManageRarity'){ui[e.target.id==='cardManageType'?'cardManageType':'cardManageRarity']=e.target.value;updateManagedCards();return;}
 if(e.target.matches('[data-pack-card]')&&ui.packDraft){savePackDraftFields();const id=e.target.dataset.packCard;if(e.target.checked&&!ui.packDraft.ids.includes(id))ui.packDraft.ids.push(id);else if(!e.target.checked)ui.packDraft.ids=ui.packDraft.ids.filter(x=>x!==id);return;}
 if(e.target.id==='activeDeck'){readHomeValues();selectDeck(e.target.value);return;}
 if(e.target.id==='deckSort'){
   if(!DECK_SORTS.has(e.target.value))return;
   ui.deckSort=e.target.value;updateDeckOrder(true);return;
 }
 if(e.target.id==='deckType'||e.target.id==='deckRarity'){
   ui[e.target.id==='deckType'?'deckFilterType':'deckFilterRarity']=e.target.value;updateCardRows('deck');return;
 }
 if(e.target.id==='gallerySort'){
   if(!GALLERY_SORTS.has(e.target.value))return;
   ui.gallerySort=e.target.value;updateGalleryOrder();return;
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
