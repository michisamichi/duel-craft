import {CARD, expandDeck, shuffle, validDeck, spellKind, persistentSpell, summonKind, normalizeRace, normalizeAttribute} from './cards.js?v=1995';
import {normalizeRuleSettings,BEFORE_META,fusionMaterialsMatch} from './rules.js?v=1995';

export const PHASES = {draw:'ドロー',main1:'メイン1',battle:'バトル',main2:'メイン2',end:'エンド'};
const blank5 = () => [null,null,null,null,null];
const fail = msg => {throw new Error(msg)};
const assert = (cond,msg) => {if(!cond) fail(msg)};
const opponent = seat => 1-seat;
const mustCard = id => {assert(!!CARD[id],'不明なカードです');return CARD[id];};
// Native historical bonuses are derived at read time; no per-turn cache or
// synchronized stat fields are needed. Hidden opposing monsters are excluded.
function historicalAtkBonus(item,state,seat){
 const effect=CARD[item?.id]?.monsterEffect;
 const code=effect?.code;
 if(!state||seat!==0&&seat!==1)return 0;
 if(code==='graveNamedScale'){
  let count=0;
  for(let owner=0;owner<2;owner++){
   if(effect.scope!=='both'&&owner!==(effect.scope==='own'?seat:1-seat))continue;
   for(const id of state.players[owner]?.grave||[]){
    if(effect.names.includes(CARD[id]?.name))count++;
   }
  }
  return count*effect.amount;
 }
 if(code==='raceFieldGraveScale'){
  let count=0;
  for(let owner=0;owner<2;owner++){
   if(effect.scope!=='both'&&owner!==(effect.scope==='own'?seat:1-seat))continue;
   const p=state.players[owner];if(!p)continue;
   for(const m of p.monsters||[]){
    if(m&&m.pos!=='set'&&normalizeRace(CARD[m.id]?.race)===normalizeRace(effect.race))count++;
   }
   for(const id of p.grave||[]){
    if(normalizeRace(CARD[id]?.race)===normalizeRace(effect.race))count++;
   }
  }
  return count*effect.amount;
 }
 if(code==='darkMagicianGrave300'){
  let count=0;
  for(const p of state.players){
   if(!p)continue;
   for(const id of p.grave||[]){
    const name=CARD[id]?.name;
    if(name==='ブラック・マジシャン'||name==='マジシャン・オブ・ブラックカオス')count++;
   }
  }
  return 300*count;
 }
 if(code==='enemyDragon500'){
  const opponent=state.players[1-seat];
  if(!opponent)return 0;
  let count=0;
  for(const m of opponent.monsters||[]){
   if(m&&m.pos!=='set'&&(CARD[m.id]?.race==='ドラゴン'||CARD[m.id]?.race==='dragon'))count++;
  }
  for(const id of opponent.grave||[]){
   if(CARD[id]?.race==='ドラゴン'||CARD[id]?.race==='dragon')count++;
  }
  return 500*count;
 }
 return 0;
}
// This is a damage-step-only modifier. Do not show it in ordinary field ATK.
function combatAtk(item,state,seat,other){
 const atk=effectiveAtk(item,state,seat);
 const e=CARD[item?.id]?.monsterEffect;
 const targetAttribute=normalizeAttribute(CARD[other?.id]?.attribute);
 if(e?.code==='darkBattle500'&&targetAttribute==='闇')return atk+500;
 if(e?.kind==='continuous'&&e.code==='battleAttributeScale'&&targetAttribute===normalizeAttribute(e.attribute))return atk+e.amount;
 return atk;
}
// Attack count is stored on the monster instance, not on the card definition.
// The legacy `attacked` flag continues to protect manual position changes.
// If an older room has only `attacked`, it counts as one attack, never zero.
// Both summon exceptions are pure derived rules. Neither adds turn flags,
// asynchronous selection windows or new synchronized data.
const baseTributeNeed=c=>c.level<=4?0:c.level<=6?1:2;
const canSoloSummon=(c,handCount)=>handCount===1&&c?.monsterEffect?.kind==='summonRule'&&
  c.monsterEffect.code==='soloHandNoTribute'&&baseTributeNeed(c)>0;
const doubleLightRelease=(c,monsters,index)=>baseTributeNeed(c)===2&&normalizeAttribute(c.attribute)==='光'&&
  monsters?.[index]&&CARD[monsters[index].id]?.monsterEffect?.kind==='summonRule'&&
  CARD[monsters[index].id].monsterEffect.code==='doubleLightTribute';
export function summonTributeNeed(card,handCount){
 return canSoloSummon(card,handCount)?0:baseTributeNeed(card);
}
export function validSummonTributes(card,handCount,monsters,indices){
 if(!card||!Array.isArray(monsters)||!Array.isArray(indices)||new Set(indices).size!==indices.length||
    !indices.every(i=>Number.isInteger(i)&&i>=0&&i<5&&!!monsters[i]))return false;
 const ordinary=baseTributeNeed(card),need=summonTributeNeed(card,handCount);
 // Gaia's optional ordinary tribute is accepted for direct/legacy room actions;
 // the touch UI offers the simpler, zero-release summon while eligible.
 return indices.length===need||canSoloSummon(card,handCount)&&indices.length===ordinary||
   ordinary===2&&indices.length===1&&!!doubleLightRelease(card,monsters,indices[0]);
}
export function hasDoubleLightTribute(card,monsters){
 return baseTributeNeed(card)===2&&normalizeAttribute(card.attribute)==='光'&&
   monsters.some((_,i)=>!!doubleLightRelease(card,monsters,i));
}
export function remainingAttacks(monster){
 if(!monster||monster.pos!=='atk')return 0;
 const effect=CARD[monster.id]?.monsterEffect;
 const limit=effect?.kind==='continuous'&&effect.code==='multiAttack'&&
   Number.isInteger(effect.count)&&effect.count>=2&&effect.count<=5?effect.count:1;
 const used=Number.isInteger(monster.attackCount)?Math.max(0,monster.attackCount):(monster.attacked?1:0);
 return Math.max(0,limit-used);
}
// Battle destruction immunity prevents ONLY sending to grave by battle.
// The opponent's current ATK (not its DEF or the eventual damage amount) is the criterion.
function resolveFlipEffect(s,seat,item){
 const c=CARD[item?.id],e=c?.monsterEffect;
 if(c?.subtype!=='effect'||e?.kind!=='flip')return;
 if(e.code==='returnOpponentOnFlip'){
   const foe=s.players[1-seat];let moved=0;
   // A fixed, bounded loop; no choice, extra chain window, or remote round trip.
   for(let i=0;i<5&&moved<e.amount;i++){
     const monster=foe.monsters[i];if(!monster)continue;
     const name=CARD[monster.id]?.name||'モンスター';
     returnMonsterToOwner(s,monster,foe,'hand');foe.monsters[i]=null;
     moved++;log(s,`「${c.name}」：${name}を持ち主の手札に戻しました（自動選択）。`);
   }
   if(moved){removeOrphanEquips(foe);}else log(s,`「${c.name}」：戻す相手モンスターがありません。`);
   return;
 }
 if(e.code==='destroyOpponentOnFlip'){
   // No pending choice/chain: the first opposing occupied slot is selected.
   const foe=s.players[1-seat];
   const target=foe.monsters.findIndex(Boolean);
   if(target<0){log(s,`「${c.name}」：相手フィールドに対象がありません。`);return;}
   const targetName=CARD[foe.monsters[target].id]?.name||'モンスター';
   sendToGrave(foe,'monsters',target,s);
   log(s,`「${c.name}」のリバース効果：${targetName}を破壊しました（自動選択）。`);
   return;
 }
 if(e.code==='recoverOwnSpellOnFlip'){
   const own=s.players[seat];
   const at=own.grave.findIndex(id=>CARD[id]?.type==='spell');
   if(at<0){log(s,`「${c.name}」：墓地に魔法カードがありません。`);return;}
   const id=own.grave.splice(at,1)[0];own.hand.push(id);
   log(s,`「${c.name}」のリバース効果：${CARD[id].name}を手札に戻しました（自動選択）。`);
   return;
 }
 if(e.code==='scoutDrawDiscardSpells'){
   const amount=Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=5?e.amount:0;
   if(!amount)return;
   const opp=s.players[1-seat],handBefore=opp.hand.length;
   // draw() enforces deck-out. Only cards drawn by THIS effect are discarded.
   if(!draw(opp,amount,s))return;
   let spells=0;
   for(let i=opp.hand.length-1;i>=handBefore;i--){
     if(CARD[opp.hand[i]]?.type==='spell'){
       opp.grave.push(opp.hand.splice(i,1)[0]);spells++;
     }
   }
   log(s,`「${c.name}」のリバース効果：相手が${amount}枚ドローし、魔法カード${spells}枚を墓地へ送りました。`);
   return;
 }
 if(e.code!=='millOpponentDeck')return;
 // A short deck sends only the remaining cards; deck-out is checked on draw, not on milling.
 const amount=Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=10?e.amount:0;
 const opponent=s.players[1-seat];
 const sent=opponent.deck.splice(0,Math.min(amount,opponent.deck.length));
 if(sent.length)opponent.grave.push(...sent);
 log(s,`「${c.name}」のリバース効果：${opponent.name}のデッキから${sent.length}枚を墓地へ送りました。`);
}
function protectedFromBattle(victim,state,victimSeat,opposing){
  const e=CARD[victim?.id]?.monsterEffect;
  return victim?.pos!=='set'&&e?.kind==='continuous'&&
    e.code==='battleImmuneAtkThreshold'&&Number.isInteger(e.threshold)&&
    combatAtk(opposing,state,1-victimSeat,victim)>=e.threshold;
}
// The attacker may bypass monsters only while this printed continuous effect holds.
// Do not persist or cache the permission: it is checked both at declaration and resolution.
export function canDirectAttackWithMonsters(s,seat,item){
 const enemies=s?.players?.[1-seat]?.monsters;if(!enemies)return false;
 if(!enemies.some(Boolean))return true;
 if(item?.pos==='set'||CARD[item?.id]?.ability?.operation!=='directEarthWaterFire')return false;
 const visible=enemies.filter(m=>m&&m.pos!=='set');
 return visible.length>0&&visible.every(m=>['地','水','炎'].includes(normalizeAttribute(CARD[m.id]?.attribute)));
}
// Continuous modifiers are derived from the board; no recalculation state is stored.
function continuousStatBonus(item,state,seat,stat){
 const card=CARD[item?.id];if(!card||item.pos==='set')return 0;
 let result=0;
 const plus=stat==='atk'?'boost':'boostDef',minus=stat==='atk'?'weaken':'weakenDef';
 const own=card.ability?.when==='continuous'?card.ability:null;
 if(own&&own.operation===plus)result+=own.amount;
 if(own&&own.operation===minus)result-=own.amount;
 if(card.subtype==='effect'&&card.monsterEffect?.kind==='continuous'&&stat==='atk'){
   result+=card.monsterEffect.code==='atk300'?300:card.monsterEffect.code==='atk500'?500:0;
   result+=historicalAtkBonus(item,state,seat);
 }
 if(!state||seat===null)return result;
 let relativeEquipApplied=false;
 for(let ownerSeat=0;ownerSeat<2;ownerSeat++){
  const p=state.players[ownerSeat];if(!p)continue;
  // Continuous attribute auras affect both players without being stored on cards.
  // Scan only face-up monsters. No stat recursion: source effects are plain metadata.
  if(stat==='atk'){
   const targetAttr=normalizeAttribute(card.attribute);
   for(const source of p.monsters||[]){
    if(!source||source.pos==='set')continue;
    const aura=CARD[source.id]?.monsterEffect;
    if(aura?.kind!=='continuous')continue;
    if(aura.code==='raceAuraGuard'){
      // The source itself is also boosted when its race matches; no recursive ATK evaluation.
      if(ownerSeat===seat&&normalizeRace(card.race)===normalizeRace(aura.race))result+=aura.amount;
      continue;
    }
    if(aura.code!=='attributeFieldAura')continue;
    if(aura.scope==='own'&&ownerSeat!==seat||aura.scope==='opponent'&&ownerSeat===seat)continue;
    if(targetAttr===normalizeAttribute(aura.attribute))result+=aura.amount;
    if(targetAttr===normalizeAttribute(aura.negativeAttribute))result-=aura.negativeAmount;
   }
  }
  // Avoid allocating a concatenated slot array for each ATK/DEF evaluation.
  // Preserve the same order: all backrow cards, then the field card.
  const backrow=p.backrow||[];
  for(let i=0;i<=backrow.length;i++){
   const slot=i===backrow.length?p.field:backrow[i];
   if(!slot||slot.faceDown)continue;
   const spell=CARD[slot.id],ab=actionAbility(spell);
   if(spell?.type!=='spell'||!persistentSpell(spell)||ab?.when!=='continuous')continue;
   if(ab.operation!==plus&&ab.operation!==minus&&ab.operation!=='earthAura'&&ab.operation!=='lpRelativeEquip')continue;
   const kind=spellKind(spell);
   if(ab.operation==='earthAura'){
     // Shared stat aura: only face-up EARTH monsters, both controllers.
     // The DEF reduction is the printed card's fixed 400-point clause.
     if(kind==='field'&&normalizeAttribute(card.attribute)==='地')result+=stat==='atk'?ab.amount:-400;
     continue;
   }
   let applies=false;
   if(kind==='field'||!slot.linkKey){
    applies=ab.target==='bothMonsters'||
      (['ownMonster','ownAllMonsters'].includes(ab.target)&&seat===ownerSeat)||
      (['enemyMonster','enemyAllMonsters'].includes(ab.target)&&seat!==ownerSeat);
   }else applies=slot.linkKey===item.key&&(slot.linkOwner??ownerSeat)===seat;
   if(!applies)continue;
   if(ab.operation==='lpRelativeEquip'){
    if(stat!=='atk'||relativeEquipApplied)continue;
    relativeEquipApplied=true;
    const selfLP=p.lp,otherLP=state.players[1-ownerSeat].lp;
    // Apply the printed original-ATK delta. Equal LP leaves the ATK unchanged.
    result+=selfLP<otherLP?card.atk:selfLP>otherLP?-Math.ceil(card.atk/2):0;
   }else result+=(ab.operation===plus?1:-1)*ab.amount;
  }
 }
 return result;
}
export function effectiveAtk(item,state=null,seat=null){
 const c=CARD[item?.id];if(!c)return 0;
  const swapped=item.swappedOriginalStatsTurn===state?.turnNo;
  const original=swapped?c.def:(Number.isInteger(item.copiedAtk)?item.copiedAtk:c.atk);
  const base=item.doubleOriginalAtkTurn===state?.turnNo?2*c.atk:original;
 return Math.max(0,base+(item.bonus||0)+continuousStatBonus(item,state,seat,'atk'));
}
export function effectiveDef(item,state=null,seat=null){
  const c=CARD[item?.id];return c?Math.max(0,(item.swappedOriginalStatsTurn===state?.turnNo?c.atk:(Number.isInteger(item.copiedDef)?item.copiedDef:c.def))+(item.defBonus||0)+continuousStatBonus(item,state,seat,'def')):0;
}
function activateMonsterAbility(s,seat,item,kind){
  const c=mustCard(item.id), e=c.monsterEffect;
  assert(c.subtype==='effect'&&e?.kind===kind,'この種類の効果は発動できません');
  const p=s.players[seat],enemy=s.players[1-seat];
  switch(e.code){
    case 'copyOpponentPrintedStats':{
      const copied=enemy.monsters.find(m=>m&&m.pos!=='set');
      if(!copied){log(s,`「${c.name}」：相手の表側モンスターがないためコピーしません。`);return;}
      const printed=CARD[copied.id];
      if(!printed){log(s,`「${c.name}」：コピー対象が見つかりません。`);return;}
      item.copiedAtk=printed.atk;item.copiedDef=printed.def;
      log(s,`「${c.name}」：${printed.name}の元々のATK${printed.atk}・DEF${printed.def}をコピーしました（自動選択）。`);
      return;
    }
    case 'searchDeckOnSummon':{
      // One shared deterministic search handler for both historical and custom monsters.
      // No card chooser/chain window: the first matching candidate in deck order is used.
      const matches=id=>{const found=CARD[id];if(!found)return false;
        if(e.filter==='ritualMonster')return found.type==='monster'&&summonKind(found)==='ritual';
        if(e.filter==='ritualSpell')return found.type==='spell'&&spellKind(found)==='ritual';
        return e.filter==='named'&&found.name===e.name;};
      const at=p.deck.findIndex(matches);
      if(at>=0){p.hand.push(p.deck.splice(at,1)[0]);log(s,`「${c.name}」：条件に合うカードを手札へ加えました。`);}
      else log(s,`「${c.name}」：デッキに該当カードはありません。`);
      return;
    }
    case 'draw1':draw(p,1,s);break;
    case 'heal500':p.lp+=500;break;
    case 'burn500':enemy.lp=Math.max(0,enemy.lp-500);break;
    case 'atk500':item.bonus=(item.bonus||0)+500;break;
    case 'destroy1':
      assert(kind==='ignition'&&Number.isInteger(target)&&!!getMonster(s,1-seat,target),'破壊する相手モンスターを選択してください');
      sendToGrave(enemy,'monsters',target,s);break;
    default:fail('このモンスター効果には未対応です');
  }
  log(s,`「${c.name}」の効果を発動！`);
  checkWinner(s);
}

const log = (s,text) => {s.log.unshift(text);if(s.log.length>30)s.log.length=30;};
/** RTDB は null しかない配列や空配列を省略するため、読み込み時に形を復元。 */
export function normalizeRoom(s) {
  if(!s)return null;
  if(!Array.isArray(s.players))s.players=[s.players?.[0]??null,s.players?.[1]??null];
  for(const p of s.players){
    if(!p)continue;
    for(const field of ['monsters','backrow']){
      const original=p[field]||{};
      p[field]=Array.from({length:5},(_,i)=>original[i]??null);
    }
    p.banished=Array.isArray(p.banished)?p.banished:[];
    const extra=p.extraDeck||[];p.extraDeck=Array.isArray(extra)?extra:Object.keys(extra).sort((a,b)=>+a-+b).map(k=>extra[k]);
    p.field=p.field||null;
    for(const field of ['hand','deck','grave']){
      const original=p[field]||[];
      p[field]=Array.isArray(original)?original:Object.keys(original).sort((a,b)=>+a-+b).map(k=>original[k]);
    }
    p.normalUsed=!!p.normalUsed;
  }
  s.nextKey=Number.isInteger(s.nextKey)?s.nextKey:0;
  s.log=Array.isArray(s.log)?s.log:[];
  s.pending=s.pending||null;
  // RTDB omits null object properties. Old pending direct attacks can arrive
  // with no target key; normalize before a player accepts the attack.
  if(s.pending?.kind==='attack' && s.pending.target==null)s.pending.target=-1;
  if(s.pending?.kind==='chain' && s.pending.afterAttack && s.pending.afterAttack.target==null)
    s.pending.afterAttack.target=-1;
  return s;
}
const newPlayer = ({uid,name,counts,extraCounts={},rules}) => {
  assert(validDeck(counts,rules,extraCounts),`デッキは${rules.deckSize}枚・禁止制限を守る必要があります`);
  return {uid, name:String(name||'プレイヤー').slice(0,12),
    deck:shuffle(expandDeck(counts)),extraDeck:expandDeck(extraCounts), hand:[], monsters:blank5(), backrow:blank5(), grave:[],banished:[],
    field:null,lp:rules.lp,normalUsed:false};
};
export function createRoom({uid,name,counts,extraCounts={},rules}) {
  rules=normalizeRuleSettings(rules);
  return {status:'waiting',rules,players:[newPlayer({uid,name,counts,extraCounts,rules}),null],turn:0,turnNo:1,
    phase:'main1',nextKey:0,pending:null,winner:null,log:['対戦相手の入室を待っています'],revision:0,createdAt:Date.now()};
}
export function joinRoom(state,{uid,name,counts,extraCounts={}}) {
  assert(state?.status==='waiting','参加できる部屋ではありません');
  assert(state.players[0].uid!==uid,'同じ端末からはオンライン対戦に参加できません');
  assert(!state.players[1],'すでに2人参加しています');
  const s=normalizeRoom(structuredClone(state));
  s.rules=normalizeRuleSettings(s.rules);
  s.players[1]=newPlayer({uid,name,counts,extraCounts,rules:s.rules});
  s.status='playing';s.turn=Math.random()<0.5?0:1;
  s.turnNo=1; s.phase='main1';s.log=[];
  for(const p of s.players) draw(p,5,s,false);
  log(s,`対戦開始！ ${s.players[s.turn].name} が先攻です。`);
  s.revision++;
  return s;
}
export function createDemo({counts1,counts2,extra1={},extra2={},rules}) {
  const s=createRoom({uid:'demo-a',name:'プレイヤー1',counts:counts1,extraCounts:extra1,rules});
  return joinRoom(s,{uid:'demo-b',name:'プレイヤー2',counts:counts2,extraCounts:extra2});
}
function draw(p,n,s,loseOnShort=true) {
  for(let i=0;i<n;i++) {
    if(!p.deck.length) {
      if(loseOnShort) {s.status='finished';s.winner=s.players.indexOf(p)===0?1:0;log(s,`${p.name} はカードを引けず敗北。`);return false;}
      fail('ドローするカードが足りません');
    }
    p.hand.push(p.deck.shift());
  }
  return true;
}
function checkWinner(s) {
  if(s.status==='finished')return;
  if(s.players[0].lp<=0 || s.players[1].lp<=0){
    s.status='finished';
    s.winner=s.players[0].lp<=0 && s.players[1].lp<=0?'draw':s.players[0].lp<=0?1:0;
    log(s,s.winner==='draw'?'引き分けです。':`${s.players[s.winner].name} の勝利です！`);
  }
}
function requireMain(s,seat) {
  assert(s.turn===seat,'自分のターンではありません');
  assert(!s.pending,'相手の対応を待っています');
  assert(s.phase==='main1'||s.phase==='main2','メインフェイズではありません');
}
function reqOwn(s,seat) {assert([0,1].includes(seat) && s.players[seat], 'プレイヤーが見つかりません');}
const arrayIndex = (xs,i)=>Number.isInteger(i) && i>=0 && i<xs.length;
function getMonster(s,seat,index) {
  assert(arrayIndex(s.players[seat].monsters,index),'場所が不正です');
  return s.players[seat].monsters[index];
}
// Control and original ownership differ when an effect steals a monster.
// Existing room records without ownerSeat are treated as owned by the controller.
function originalOwner(s,item,controller){
  const seat=item?.ownerSeat;
  return Number.isInteger(seat)&&s?.players?.[seat] ? s.players[seat] : controller;
}
function returnMonsterToOwner(s,item,controller,zone){
  const owner=originalOwner(s,item,controller);
  if(summonKind(CARD[item.id])==='fusion')owner.extraDeck.push(item.id);
  else if(zone==='hand')owner.hand.push(item.id);
  else {owner.deck.push(item.id);owner.deck=shuffle(owner.deck);}
}
function sendToGrave(p,zone,index,s=null) {
  const item=p[zone][index];
  if(!item)return;
  const owner=originalOwner(s,item,p);
  owner.grave.push(item.id);p[zone][index]=null;
  if(zone==='monsters'&&item.key!==undefined)removeOrphanEquips(p);
  // Field-to-grave search resolves synchronously. Never create a pending
  // choice/chain or access the network; empty decks are a harmless no-op.
  if(zone!=='monsters'||!s||s.status!=='playing')return;
  const e=CARD[item.id]?.monsterEffect;
  if(e?.kind!=='grave'||e.code!=='searchStatOnGrave')return;
  const at=owner.deck.findIndex(id=>{
    const c=CARD[id];return c?.type==='monster'&&summonKind(c)!=='fusion'&&c[e.stat]<=e.threshold;
  });
  if(at<0){log(s,`「${CARD[item.id]?.name||item.id}」：検索対象がありません。`);return;}
  const found=owner.deck.splice(at,1)[0];owner.hand.push(found);
  log(s,`「${CARD[item.id]?.name||item.id}」：${CARD[found]?.name||found}を手札に加えました（自動選択）。`);
}
function removeOrphanEquips(p){
  const alive=new Set(p.monsters.filter(Boolean).map(m=>m.key));
  for(let i=0;i<p.backrow.length;i++){
    const v=p.backrow[i];if(v?.linkKey!==undefined&&(v.linkOwner===undefined||v.linkOwner==='own')&&!alive.has(v.linkKey)){
      p.grave.push(v.id);p.backrow[i]=null;
    }
  }
}
// A face-up monster with the equip-break effect destroys equipment attached to
// its current instance. Run only after an action/chain finishes, never mid-chain.
function breakEquipsOnMonster(s){
 for(let controller=0;controller<2;controller++){
  const monsters=s.players[controller]?.monsters||[];
  for(const mon of monsters){
   if(!mon||mon.pos==='set'||mon.key===undefined)continue;
   const e=CARD[mon.id]?.monsterEffect;
   if(e?.kind!=='continuous'||e.code!=='destroyAttachedEquip')continue;
   for(const p of s.players){
    if(!p)continue;
    for(let i=0;i<p.backrow.length;i++){
     const equip=p.backrow[i],card=CARD[equip?.id];
     if(!equip||equip.faceDown||card?.type!=='spell'||spellKind(card)!=='equip'||
        equip.linkKey!==mon.key||(equip.linkOwner??s.players.indexOf(p))!==controller)continue;
     p.backrow[i]=null;p.grave.push(equip.id);
     log(s,`「${CARD[mon.id].name}」の効果で装備カード「${card.name}」を破壊しました。`);
    }
   }
  }
 }
}
function sweepOrphanEquips(s){
 for(let seat=0;seat<2;seat++){
  const p=s.players[seat];if(!p)continue;
  for(let i=0;i<p.backrow.length;i++){
   const item=p.backrow[i];if(item?.linkKey===undefined)continue;
   const targetSeat=item.linkOwner??seat;
   if(!s.players[targetSeat]?.monsters.some(m=>m?.key===item.linkKey)){
    p.grave.push(item.id);p.backrow[i]=null;
   }
  }
 }
}
// Protect only a face-up aura source when another allied monster exists.
// Reused by the action validator and the board's target highlighting.
export function isAttackTargetLegal(s,attackingSeat,targetIndex){
  if(!s||![0,1].includes(attackingSeat)||!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=5)return false;
  const defenders=s.players?.[1-attackingSeat]?.monsters;
  const target=defenders?.[targetIndex];
  if(!target)return false;
  if(target.pos==='set')return true;
  const e=CARD[target.id]?.monsterEffect;
  if(e?.kind!=='continuous'||e.code!=='raceAuraGuard')return true;
  return !defenders.some((m,i)=>i!==targetIndex&&!!m);
}
// No extra choice, priority step, timer or Firebase round trip. Resolve only
// destroyed-by-battle sources recorded by resolveAttack, AFTER damage/flip.
function recruitDestroyedByBattle(s,fallen){
 for(const {item,controller} of fallen){
   const e=CARD[item.id]?.monsterEffect;
   if(e?.kind!=='battle'||e.code!=='recruitOnBattleDestroy')continue;
   const owner=originalOwner(s,item,s.players[controller]);
   const seat=s.players.indexOf(owner),slot=owner.monsters.indexOf(null);
   if(slot<0){log(s,`「${CARD[item.id].name}」：モンスターゾーンが満杯です。`);continue;}
   const at=owner.deck.findIndex(id=>{const c=CARD[id];return c?.type==='monster'&&summonKind(c)==='normal'&&
     c.atk<=e.threshold&&normalizeAttribute(c.attribute)===normalizeAttribute(e.attribute);});
   if(at<0){log(s,`「${CARD[item.id].name}」：条件に合うカードはデッキにありません。`);continue;}
   const id=owner.deck.splice(at,1)[0];
   const summoned={key:++s.nextKey,id,ownerSeat:seat,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
   owner.monsters[slot]=summoned;
   log(s,`「${CARD[item.id].name}」：${CARD[id].name}をデッキから攻撃表示で特殊召喚しました（自動選択）。`);
   if(CARD[id].monsterEffect?.kind==='trigger'&&CARD[id].monsterEffect.code==='copyOpponentPrintedStats')
      activateMonsterAbility(s,seat,summoned,'trigger');
 }
}
// Only linked, active equip spells grant piercing; no stored monster flags.
function hasPiercingEquip(s,item,seat){
 if(!item||!Number.isInteger(item.key))return false;
 for(const p of s.players)for(const equip of p.backrow){
  if(equip&&!equip.faceDown&&equip.linkKey===item.key&&equip.linkOwner===seat&&
     CARD[equip.id]?.ability?.operation==='pierce')return true;
 }
 return false;
}
function resolveBattleDamageEffect(s,seat,item,damage){
 if(damage<=0||s.status!=='playing')return;
 const c=CARD[item?.id],ab=actionAbility(c);
 if(c?.subtype!=='effect'||ab?.when!=='battleDamage')return;
 // Only valid, player-only operations are admitted by card creation rules;
 // defend against malformed imported/legacy definitions as well.
 if(!['draw','discardNewest','millFirstType'].includes(ab.operation)||ab.before||ab.then||
    !['self','opponent'].includes(ab.target)||
    (ab.operation==='millFirstType'&&(ab.target!=='opponent'||ab.amount!==0||!['monster','spell','trap'].includes(ab.match))))return;
 const target=s.players[ab.target==='opponent'?1-seat:seat];
 const count=()=>ab.operation==='millFirstType'?target.grave.length:target.hand.length;
 const before=count();
 executeAbility(s,{seat,cardId:item.id},null);
 const changed=Math.abs(count()-before);
 const result=ab.operation==='draw'?'ドロー':ab.operation==='millFirstType'?'デッキから墓地へ送った':'手札から墓地へ送った';
 log(s,`「${c.name}」：戦闘ダメージ時の効果で${changed?`${changed}枚${result}`:'該当カードなし・処理なし'}。`);
}
function resolveAttack(s) {
  const a=s.pending;
  assert(a?.kind==='attack','処理する攻撃がありません');
  const atkP=s.players[a.by],defP=s.players[1-a.by];
  const attacker=atkP.monsters[a.attacker];
  if(!attacker || attacker.pos!=='atk' || (a.attackerKey!==undefined && attacker.key!==a.attackerKey)){
    log(s,'攻撃モンスターが攻撃可能な状態ではないため、攻撃は終了しました。');s.pending=null;return;
  }
  // Attack-vs-monster modifiers depend on the revealed defender's attribute.
  // Resolve them below, after a set defender has been turned face up.
  const rocketAssault=CARD[attacker.id]?.monsterEffect?.kind==='continuous'&&
    CARD[attacker.id].monsterEffect.code==='rocketAssault';
  const directAtk=effectiveAtk(attacker,s,a.by);
  let flippedDefender=null;
  const fallen=[];
  let dealtDamage=0,damageSourceSeat=a.by,damageSource=attacker;
  const destroyedInBattle=(player,index)=>{
    const item=player.monsters[index];
    if(!item)return;
    fallen.push({item,controller:s.players.indexOf(player)});
    sendToGrave(player,'monsters',index,s);
  };
  if(a.target===-1 || a.target===null) {
    if(!canDirectAttackWithMonsters(s,a.by,attacker)) {log(s,'相手のモンスターがいるため直接攻撃できません。');}
    else{dealtDamage=directAtk;defP.lp=Math.max(0,defP.lp-directAtk);log(s,`${atkP.name} の直接攻撃！ ${defP.name} に${directAtk}ダメージ。`);}
  } else {
    const defender=defP.monsters[a.target];
    if(!defender || (a.targetKey!==undefined && defender.key!==a.targetKey)) {
      log(s,'攻撃対象のモンスターが変更されたため、攻撃は終了しました。');s.pending=null;return;
    }
    // An intervening response may establish a guard after the declaration.
    if(!isAttackTargetLegal(s,a.by,a.target)){
      log(s,'攻撃対象を選べなくなったため、攻撃は終了しました。');s.pending=null;return;
    }
    const dc=mustCard(defender.id);
    if(defender.pos==='set'){defender.pos='def';flippedDefender=defender;log(s,`${dc.name} が表になりました。`);}
    const isAtk=defender.pos==='atk';
    const atk=combatAtk(attacker,s,a.by,defender);
    const power=isAtk?combatAtk(defender,s,1-a.by,attacker):effectiveDef(defender,s,1-a.by);
    if(atk>power){
      const survives=protectedFromBattle(defender,s,1-a.by,attacker);
      if(!survives)destroyedInBattle(defP,a.target);
      if(isAtk||hasPiercingEquip(s,attacker,a.by)){
        dealtDamage=atk-power;defP.lp=Math.max(0,defP.lp-(atk-power));
        if(!isAtk)log(s,`貫通ダメージ ${atk-power} を与えました。`);
      }
      log(s,survives?`${dc.name} は戦闘では破壊されません。${isAtk?` ${atk-power}ダメージ。`:''}`:
        `${mustCard(attacker.id).name} が ${dc.name} を破壊！${isAtk?` ${atk-power}ダメージ。`:''}`);
    } else if(atk<power) {
      const survives=isAtk&&(rocketAssault||protectedFromBattle(attacker,s,a.by,defender));
      if(isAtk&&!survives)destroyedInBattle(atkP,a.attacker);
      if(!rocketAssault){
        atkP.lp=Math.max(0,atkP.lp-(power-atk));
        if(isAtk){dealtDamage=power-atk;damageSourceSeat=1-a.by;damageSource=defender;}
      }
      log(s,`${dc.name} が攻撃を防ぎ、${atkP.name} に${rocketAssault?0:power-atk}ダメージ。${survives?'（攻撃モンスターは戦闘破壊されない）':''}`);
    } else {
      // Official battle rule: 0 ATK against 0 ATK does not destroy either monster.
      if(isAtk&&atk>0){
        const attackerSafe=rocketAssault||protectedFromBattle(attacker,s,a.by,defender);
        const defenderSafe=protectedFromBattle(defender,s,1-a.by,attacker);
        if(!attackerSafe)destroyedInBattle(atkP,a.attacker);
        if(!defenderSafe)destroyedInBattle(defP,a.target);
        log(s,attackerSafe||defenderSafe?'同じ攻撃力での戦闘。破壊耐性を適用しました。':'攻撃力が同じため、両方のモンスターが破壊されました。');
      }
      else log(s,isAtk?'攻撃力0同士のため、どちらも破壊されません。':'攻撃力と守備力が同じため、どちらも破壊されません。');
    }
    // Apply to the same surviving defender instance only, never to a replacement
    // occupying the same zone. Temporary bonus already resets in endTurn().
    const stillThere=defP.monsters[a.target];
    if(rocketAssault&&stillThere?.key===defender.key){
      stillThere.bonus=(stillThere.bonus||0)-500;
      log(s,`「${CARD[attacker.id].name}」：${dc.name}の攻撃力をターン終了まで500下げました。`);
    }
  }
  // Battle damage that ends a duel wins immediately. Never let an automatic
  // deck-out draw after lethal damage overwrite the already-decided winner.
  checkWinner(s);
  resolveBattleDamageEffect(s,damageSourceSeat,damageSource,dealtDamage);
  // Resolve after the damage calculation even if the flipped card was destroyed.
  // Simplification: no separate chain response window for flip effects.
  if(flippedDefender)resolveFlipEffect(s,1-a.by,flippedDefender);
  if(fallen.length)recruitDestroyedByBattle(s,fallen);
  s.pending=null;sweepOrphanEquips(s);checkWinner(s);
}
// Legacy effect metadata is immutable; do not rebuild these lookup tables
// (and their small arrays) every time a monster stat or an effect is checked.
const LEGACY_SPELL_OPERATIONS={draw2:['draw','self',2],heal1000:['heal','self',1000],burn800:['damage','opponent',800],destroy:['destroy','enemyMonster',0],boost500:['boost','ownMonster',500]};
const LEGACY_TRAP_OPERATIONS={negate:['negateAttack','none',0],counterdestroy:['destroy','attacker',0],counterburn:['damage','opponent',700]};
const LEGACY_MONSTER_OPERATIONS={fusionFromExtraPay5000:['fusionFromExtraPay5000','none',0],doubleOriginalAtkEndDestroy:['doubleOriginalAtkEndDestroy','self',0],draw1:['draw','self',1],heal500:['heal','self',500],burn500:['damage','opponent',500],atk500:['boost','ownMonster',500],destroy1:['destroy','enemyMonster',0]};
function actionAbility(card){
 if(card?.ability)return card.ability;
 if(card?.type==='spell'){
  const op=LEGACY_SPELL_OPERATIONS[card.effect];
  return op?{when:'main',operation:op[0],target:op[1],amount:op[2]}:null;
 }
 if(card?.type==='trap'){
  const op=LEGACY_TRAP_OPERATIONS[card.effect];
  return op?{when:'attack',operation:op[0],target:op[1],amount:op[2]}:null;
 }
 if(card?.monsterEffect){
  const op=LEGACY_MONSTER_OPERATIONS[card.monsterEffect.code];
  return op?{when:card.monsterEffect.kind==='trigger'?'summon':card.monsterEffect.kind==='continuous'?'continuous':'main',operation:op[0],target:op[1],amount:op[2]}:null;
 }
 return null;
}
// Composite card A: an activation prerequisite. Validate the complete payment
// *before* changing any state. The engine rechecks selections independently of UI.
function canSummonRaceFromHand(s,seat,ab){
 const p=s.players[seat];
 if(ab.requiredFaceUpName&&!s.players.some(x=>x.monsters.some(m=>m&&m.pos!=='set'&&CARD[m.id]?.name===ab.requiredFaceUpName)))return false;
 return p.monsters.some(m=>m===null)&&p.hand.some(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='normal'&&normalizeRace(CARD[id].race)===normalizeRace(ab.query));
}
function canReviveBothSet(s){
 return s.players.every(p=>p.monsters.some(m=>m===null)&&p.grave.some(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='normal'));
}
function canSummonNamedFromHand(p,ab){
 return p.monsters.some(m=>m===null)&&p.hand.some(id=>CARD[id]?.type==='monster'&&
  summonKind(CARD[id])==='normal'&&CARD[id].name===ab.query);
}
function payBefore(s,seat,ab,indices,source=null,target=undefined){
 const before=ab?.before;if(!before)return 0;
 const meta=BEFORE_META[before.operation],qty=before.amount,p=s.players[seat];
 assert(meta&&Number.isSafeInteger(qty)&&qty>=1&&qty<=meta.max,'Aの処理が不正です');
 const zone=meta.zone;
 if(zone==='lp'){
  assert(p.lp>qty,'AのLPを支払えないため発動できません');
  p.lp-=qty;return 0;
 }
 if(zone==='deck'||zone==='grave'){
  assert(p[zone].length>=qty,'Aに必要なカードが足りないため発動できません');
  const removed=zone==='deck'?p.deck.splice(0,qty):p.grave.splice(-qty,qty);
  if(before.operation==='millOwnDeck')p.grave.push(...removed);
  else if(before.operation==='recycleOwnGrave'){
   const main=removed.filter(id=>summonKind(CARD[id])!=='fusion');
   p.extraDeck.push(...removed.filter(id=>summonKind(CARD[id])==='fusion'));
   if(main.length){p.deck.push(...main);p.deck=shuffle(p.deck);}
  }else p.banished.push(...removed);
  return 0;
 }
 assert(Array.isArray(indices)&&indices.length===qty&&new Set(indices).size===qty&&
  indices.every(i=>Number.isInteger(i)&&i>=0&&i<p[zone].length&&p[zone][i]&&
   !(source?.zone===zone&&source.index===i)),
 'Aに使うカードを指定数選んでください');
 // A must not remove B's explicitly selected single target. Without this
 // check a later chained summon at the same slot could be hit incorrectly.
 if((zone==='monsters'&&ab.target==='ownMonster'||zone==='backrow'&&ab.target==='ownBackrow')&&indices.includes(target))
   fail('AでBの対象を取り除くことはできません');
 const sorted=[...indices].sort((a,b)=>b-a);
 const shifted=source?.zone==='hand'?indices.filter(i=>i<source.index).length:0;
 for(const i of sorted){
  if(zone==='monsters'){
   const item=p.monsters[i];
   if(before.operation==='sendOwnMonsterGrave')sendToGrave(p,'monsters',i,s);
   else if(before.operation==='banishOwnMonster'){
    originalOwner(s,item,p).banished.push(item.id);p.monsters[i]=null;
   }else{
    returnMonsterToOwner(s,item,p,before.operation==='returnOwnMonsterHand'?'hand':'deck');
    p.monsters[i]=null;
   }
  }else if(zone==='backrow'){
   const [item]=p.backrow.splice(i,1);
   p.backrow.splice(i,0,null);
   (before.operation==='sendOwnBackrowGrave'?p.grave:p.banished).push(item.id);
  }else if(zone==='hand'){
   const [id]=p.hand.splice(i,1);
   if(before.operation==='discardOwnHand')p.grave.push(id);
   else p.deck.push(id);
  }
 }
 if(before.operation==='returnOwnHandDeck')p.deck=shuffle(p.deck);
 return shifted;
}
function summonTriggerTarget(s,seat,target,ownSlot){
 if(target==='ownMonster')return ownSlot;
 if(target==='enemyMonster')return s.players[1-seat].monsters.findIndex(Boolean);
 if(target==='ownBackrow')return s.players[seat].backrow.findIndex(Boolean);
 if(target==='enemyBackrow')return s.players[1-seat].backrow.findIndex(Boolean);
 return null; // Group and player effects do not need a slot selection.
}
function abilityTargetCheck(s,seat,ab,target,sourceIndex){
 if(!ab)fail('効果の定義がありません');
 const choices={ownMonster:seat,enemyMonster:1-seat,ownBackrow:seat,enemyBackrow:1-seat};
 if(Object.hasOwn(choices,ab.target)){
  if(ab.when==='continuous'&&sourceIndex!==undefined)return;
  const side=choices[ab.target],zone=ab.target.endsWith('Backrow')?'backrow':'monsters';
  assert(Number.isInteger(target)&&target>=0&&target<5&&s.players[side][zone][target],
    zone==='monsters'?'対象モンスターを選んでください':'対象の魔法・罠を選んでください');
 }
 if(ab.target==='eitherGraveMonster'){
  assert(s.players[seat].monsters.some(m=>m===null),'自分のモンスターゾーンに空きがありません');
  assert(target&&typeof target==='object'&&!Array.isArray(target)&&
    (target.seat===0||target.seat===1)&&Number.isInteger(target.index)&&
    typeof target.cardId==='string','蘇生する墓地のモンスターを指定してください');
  const targetId=s.players[target.seat].grave[target.index];
  assert(typeof target.cardId==='string'&&targetId===target.cardId&&CARD[targetId]?.type==='monster','墓地の対象を確認してください');
 }
 if(ab.target==='attacker')assert(s.pending?.kind==='attack'||s.pending?.afterAttack,'攻撃中のみ選べます');
}
function abilityMonsterRefs(s,seat,target,index,chain,targetMonsterKey){
 const one=(side,at)=>{
  const item=Number.isInteger(at)&&at>=0&&at<5?s.players[side].monsters[at]:null;
  // The zone index is not the card's identity. A chain link may remove it and
  // revive a different monster into the same zone before this effect resolves.
  if(!item||(targetMonsterKey!==undefined&&item.key!==targetMonsterKey))return [];
  return [{side,index:at}];
 };
 if(target==='enemyLowestAtk'){
  const candidates=s.players[1-seat].monsters.map((m,i)=>m&&m.pos!=='set'?{i,atk:effectiveAtk(m,s,1-seat)}:null).filter(Boolean);
  if(!candidates.length)return [];
  const minimum=Math.min(...candidates.map(m=>m.atk));
  return one(1-seat,candidates.find(m=>m.atk===minimum).i);
 }
 if(target==='enemyFaceDownMonster'){
  const i=s.players[1-seat].monsters.findIndex(m=>m?.pos==='set');
  return i===-1?[]:one(1-seat,i);
 }
 if(target==='ownMonster')return one(seat,index);
 if(target==='enemyMonster')return one(1-seat,index);
 if(target==='attacker'){
  const a=chain?.afterAttack||(s.pending?.kind==='attack'?s.pending:null);
  return a?one(a.by,a.attacker):[];
 }
 const sides=target==='ownAllMonsters'?[seat]:target==='enemyAllMonsters'?[1-seat]:target==='bothMonsters'?[seat,1-seat]:[];
 return sides.flatMap(side=>s.players[side].monsters.flatMap((m,i)=>m?[{side,index:i}]:[]));
}
function abilityBackrowRefs(s,seat,target,index){
 const one=(side,at)=>Number.isInteger(at)&&at>=0&&at<5&&s.players[side].backrow[at]?[{side,index:at}]:[];
 if(target==='ownBackrow')return one(seat,index);
 if(target==='enemyBackrow')return one(1-seat,index);
 const sides=target==='ownAllBackrow'?[seat]:target==='enemyAllBackrow'?[1-seat]:target==='bothAllBackrow'?[seat,1-seat]:[];
 return sides.flatMap(side=>[...s.players[side].backrow.flatMap((m,i)=>m?[{side,index:i}]:[]),
  ...(target==='bothAllBackrow'&&s.players[side].field?[{side,index:-1}]:[])]);
}
function executeAbility(s,entry,chain,stageOverride=null){
 const seat=entry.seat,p=s.players[seat],card=mustCard(entry.cardId);
 const ab=stageOverride||actionAbility(card);if(!ab)return;
 // Only composite effects pay this (small) snapshot cost; all ordinary cards stay on the fast path.
 const beforeStage=ab.then?JSON.stringify(s.players):null;
 if(card.type==='monster'&&ab.operation==='fusionFromExtraPay5000'){
   // No new target picker: the first still-available fusion card is deterministic.
   const at=p.extraDeck.findIndex(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='fusion');
   const slot=p.monsters.indexOf(null);
   if(at<0||slot<0){log(s,`「${card.name}」：EXデッキに融合モンスターがないか、ゾーン満杯のため不発になりました。`);return;}
   const id=p.extraDeck.splice(at,1)[0];
   const summoned={key:++s.nextKey,id,ownerSeat:seat,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
   p.monsters[slot]=summoned;
   log(s,`「${card.name}」：EXデッキから「${CARD[id].name}」を特殊召喚しました（自動選択）。`);
   if(CARD[id]?.monsterEffect?.kind==='trigger'&&CARD[id].monsterEffect.code==='copyOpponentPrintedStats')activateMonsterAbility(s,seat,summoned,'trigger');
   return;
 }
 if(card.type==='monster'&&ab.operation==='doubleOriginalAtkEndDestroy'){
   const m=p.monsters[entry.target];
   if(m&&m.pos!=='set'&&(entry.targetMonsterKey===undefined||m.key===entry.targetMonsterKey)&&m.id===card.id){
     m.doubleOriginalAtkTurn=s.turnNo;
     log(s,`「${card.name}」：攻撃力がエンドフェイズまで元々の2倍になりました。`);
   }
   return;
 }
 // A continuous spell's stat changes are already included in effectiveAtk/Def.
 // Resolving it must not add a second, temporary stat bonus.
 if(card.type==='spell'&&ab.when==='continuous'){
   log(s,`${p.name}：「${card.name}」の永続効果が適用されました。`);return;
 }
 const recipient=ab.target==='opponent'?1-seat:seat;
 const player=s.players[recipient],qty=ab.amount;
 // All mutations are bounded by the 5-slot field and a maximum of 10 cards.
 const monsters=abilityMonsterRefs(s,seat,ab.target,entry.target,chain,entry.targetMonsterKey);
 const backrow=abilityBackrowRefs(s,seat,ab.target,entry.target);
 const monsterOps=new Set(['destroy','banish','sendGrave','returnHand','returnDeck','changePosition','setAttackerDefense','negateAndLockAttacker','setAtk','setDef','boost','weaken','boostDef','weakenDef','lockAttack','lockEffect','steal','destroyGiveOwn','swapPrintedStats','blastAttacker']);
 if(monsterOps.has(ab.operation)){
  for(const {side,index} of monsters){
   const owner=s.players[side],item=owner.monsters[index];if(!item)continue;
   if(item.pos==='set'&&['boost','weaken','boostDef','weakenDef'].includes(ab.operation)&&['ownAllMonsters','enemyAllMonsters','bothMonsters'].includes(ab.target))continue;
   switch(ab.operation){
    case 'destroy':case 'sendGrave':sendToGrave(owner,'monsters',index,s);break;
    case 'swapPrintedStats':if(item.pos!=='set')item.swappedOriginalStatsTurn=s.turnNo;break;
    case 'blastAttacker':{
      const printed=Math.max(0,CARD[item.id]?.atk||0);
      if(item.pos==='set')break;
      sendToGrave(owner,'monsters',index,s);
      s.players[seat].lp=Math.max(0,s.players[seat].lp-printed);
      s.players[1-seat].lp=Math.max(0,s.players[1-seat].lp-printed);
      if(chain?.afterAttack)chain.attackNegated=true;
      log(s,`攻撃モンスターを破壊し、お互いに${printed}ダメージ。`);
      break;
    }
    case 'banish':originalOwner(s,item,owner).banished.push(item.id);owner.monsters[index]=null;removeOrphanEquips(owner);break;
    case 'returnHand':returnMonsterToOwner(s,item,owner,'hand');owner.monsters[index]=null;break;
    case 'returnDeck':returnMonsterToOwner(s,item,owner,'deck');owner.monsters[index]=null;break;
    case 'changePosition':
      if(item.pos==='set')item.pos='atk';else item.pos=item.pos==='atk'?'def':'atk';
      item.changedTurn=s.turnNo;
      // A changed attack position always interrupts the declared attack,
      // even if a subsequent chain link changes it back.
      if(chain?.afterAttack?.by===side&&chain.afterAttack.attacker===index)chain.attackInterrupted=true;
      break;
    case 'negateAndLockAttacker':
      // No persistence/re-targeting; the current attack is cancelled synchronously.
      if(chain?.afterAttack?.by===side&&chain.afterAttack.attacker===index&&!chain.attackNegated){
       chain.attackNegated=true;item.attackLockedUntil=Math.max(item.attackLockedUntil||0,s.turnNo+2);
      }
      break;
    case 'setAttackerDefense':
      // Fixed direction for Chain Boomerang; unlike generic position toggling,
      // repeated responses cannot accidentally switch the attacker back to ATK.
      if(item.pos==='set')break;
      item.pos='def';item.changedTurn=s.turnNo;
      if(chain?.afterAttack?.by===side&&chain.afterAttack.attacker===index)chain.attackInterrupted=true;
      break;
    case 'boost':item.bonus=(item.bonus||0)+qty;break;
    case 'weaken':item.bonus=(item.bonus||0)-qty;break;
    case 'boostDef':item.defBonus=(item.defBonus||0)+qty;break;
    case 'weakenDef':item.defBonus=(item.defBonus||0)-qty;break;
    case 'setAtk':item.bonus=(item.bonus||0)+qty-effectiveAtk(item,s,side);break;
    case 'setDef':item.defBonus=(item.defBonus||0)+qty-effectiveDef(item,s,side);break;
    case 'lockAttack':item.attackLockedUntil=Math.max(item.attackLockedUntil||0,s.turnNo+2);break;
    case 'lockEffect':item.effectLockedUntil=Math.max(item.effectLockedUntil||0,s.turnNo+2);break;
    case 'destroyGiveOwn':{
     // Single deterministic two-field operation: destroy enemy target, then gift the first own monster.
     // Recheck both cards at resolution; no intermediate target picker or pending state.
     if(side!==1-seat)break;
     const mine=s.players[seat],ownAt=mine.monsters.findIndex(Boolean);
     if(ownAt<0){log(s,`「${card.name}」：渡せる自分のモンスターがないため不発。`);break;}
     const gift=mine.monsters[ownAt];
     sendToGrave(owner,'monsters',index,s);
     // Preserve consistency if a field-to-grave effect fills the freed zone.
     const receiverSlot=owner.monsters[index]===null?index:owner.monsters.indexOf(null);
     if(receiverSlot>=0){mine.monsters[ownAt]=null;owner.monsters[receiverSlot]={...gift,ownerSeat:gift.ownerSeat??seat,attacked:true,changedTurn:s.turnNo,bornTurn:s.turnNo};
      for(const pl of s.players)for(const eq of pl.backrow)if(eq?.linkKey===gift.key&&eq.linkOwner===seat)eq.linkOwner=1-seat;
      log(s,`「${card.name}」：相手モンスターを破壊し、自分モンスターを渡しました。`);}
     break;
    }
    case 'steal':{
     const receiver=s.players[1-side],where=receiver.monsters.indexOf(null);
     if(where!==-1){
       owner.monsters[index]=null;
       receiver.monsters[where]={...item,ownerSeat:item.ownerSeat??side,attacked:true,changedTurn:s.turnNo,bornTurn:s.turnNo};
       // Equipment follows its linked monster when control changes.
       for(const p of s.players)for(const eq of p.backrow)
         if(eq?.linkKey===item.key&&(eq.linkOwner??side)===side)eq.linkOwner=1-side;
     }
     break;
    }
   }
  }
 }else if(['destroyBackrow','banishBackrow','returnBackrow'].includes(ab.operation)){
  for(const {side,index} of backrow){
   const owner=s.players[side],item=index===-1?owner.field:owner.backrow[index];if(!item)continue;
   if(index===-1)owner.field=null;else owner.backrow[index]=null;
   const destination=originalOwner(s,item,owner);
   if(ab.operation==='destroyBackrow')destination.grave.push(item.id);
   else if(ab.operation==='banishBackrow')destination.banished.push(item.id);
   else destination.hand.push(item.id);
  }
 }else switch(ab.operation){
  case 'draw':draw(player,qty,s);break;
  case 'replaceHands':{
   // A deterministic, bounded exchange. Activation checks both deck sizes,
   // and an intervening chain might draw away required deck cards.
   if(s.players.some(owner=>owner.deck.length<owner.hand.length)){
     log(s,'手札交換に必要なデッキ枚数が不足しているため、効果は不発になりました。');
     break;
   }
   for(const owner of s.players){
     const held=owner.hand.splice(0);
     owner.grave.push(...held);
     owner.hand.push(...owner.deck.splice(0,held.length));
   }
   break;
  }
  case 'recoverNormalAtk':{
   let found=0;
   for(let i=player.grave.length-1;i>=0&&found<qty;i--){
     const candidate=CARD[player.grave[i]];
     if(candidate?.type!=='monster'||candidate.subtype==='effect'||candidate.atk>1500||summonKind(candidate)!=='normal')continue;
     player.hand.push(player.grave.splice(i,1)[0]);found++;
   }
   break;
  }
  case 'heal':player.lp+=qty;break;
  case 'healPerFieldMonster':{
   const total=s.players[0].monsters.filter(Boolean).length+s.players[1].monsters.filter(Boolean).length;
   player.lp+=total*qty;break;
  }
  case 'damage':player.lp=Math.max(0,player.lp-qty);break;
  case 'setLP':player.lp=qty;break;
  case 'halfLP':player.lp=Math.ceil(player.lp/2);break; // Odd LP: round .5 up (OCG).
  case 'summonNamedFromHand':{
   const slot=p.monsters.indexOf(null);
   const pos=p.hand.findIndex(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='normal'&&CARD[id].name===ab.query);
   if(slot<0||pos<0){log(s,`「${card.name}」：空きゾーンまたは手札の指定名モンスターがないため不発。`);break;}
   const id=p.hand.splice(pos,1)[0];
   const summoned={key:++s.nextKey,id,ownerSeat:seat,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
   p.monsters[slot]=summoned;
   log(s,`「${card.name}」：手札の「${CARD[id].name}」を特殊召喚しました。`);
   // Follow the pre-existing deterministic native summon trigger route.
   if(CARD[id]?.monsterEffect?.kind==='trigger'&&['searchDeckOnSummon','copyOpponentPrintedStats'].includes(CARD[id].monsterEffect.code))
     activateMonsterAbility(s,seat,summoned,'trigger');
   break;
  }
  case 'searchNamed':{
   const query=typeof ab.query==='string'?ab.query:'';
   if(!query||!['exact','contains'].includes(ab.match))break;
   for(let i=0;i<qty;i++){
    const pos=player.deck.findIndex(id=>{const name=CARD[id]?.name||'';return ab.match==='exact'?name===query:name.includes(query);});
    if(pos<0)break;
    player.hand.push(player.deck.splice(pos,1)[0]);
   }
   break;
  }
  case 'searchMonster':case 'searchSpell':case 'searchTrap':{
   const type=ab.operation==='searchMonster'?'monster':ab.operation==='searchSpell'?'spell':'trap';
   for(let i=0;i<qty;i++){
    const pos=player.deck.findIndex(id=>CARD[id]?.type===type);
    if(pos<0)break;
    player.hand.push(player.deck.splice(pos,1)[0]);
   }
   break;
  }
  case 'discardNewest':{
   const count=Math.min(qty,player.hand.length);
   if(count)player.grave.push(...player.hand.splice(-count,count));
   break;
  }
  case 'discardRandom':{
   for(let i=0;i<qty&&player.hand.length;i++){
    const pos=Math.floor(Math.random()*player.hand.length);
    player.grave.push(player.hand.splice(pos,1)[0]);
   }
   break;
  }
  case 'returnRandomHandDeck':{
   let count=0;
   for(let i=0;i<qty&&player.hand.length;i++){
    const pos=Math.floor(Math.random()*player.hand.length);
    player.deck.push(player.hand.splice(pos,1)[0]);count++;
   }
   if(count)player.deck=shuffle(player.deck);
   break;
  }
  case 'mill':player.grave.push(...player.deck.splice(0,qty));break;
  case 'millFirstType':{
   // First matching card, deterministic on both devices. No shuffle or selection window.
   const at=player.deck.findIndex(id=>CARD[id]?.type===ab.match);
   if(at>=0)player.grave.push(player.deck.splice(at,1)[0]);
   break;
  }
  case 'banishDeck':player.banished.push(...player.deck.splice(0,qty));break;
  case 'shuffleDeck':player.deck=shuffle(player.deck);break;
  case 'borrowOpponentSpell':{
   const other=s.players[1-seat],at=other.grave.findLastIndex(id=>CARD[id]?.type==='spell');
   if(at>=0){const id=other.grave.splice(at,1)[0];p.hand.push(id);
    log(s,`「${card.name}」：相手の墓地から「${CARD[id].name}」を手札へ加えました。`);}
   else log(s,`「${card.name}」：相手の墓地に魔法カードがないため不発。`);
   break;
  }
  case 'lockPositionNextTurn':
   player.positionLockedTurn=s.turnNo+1;break;
  case 'graveRecover':{for(const id of player.grave.splice(Math.max(0,player.grave.length-qty),qty))
    (summonKind(CARD[id])==='fusion'?player.extraDeck:player.hand).push(id);break;}
  case 'graveBanish':player.banished.push(...player.grave.splice(Math.max(0,player.grave.length-qty),qty));break;
  case 'graveRecycle':{
   const reclaimed=player.grave.splice(Math.max(0,player.grave.length-qty),qty);
   if(reclaimed.length){
     const main=reclaimed.filter(id=>summonKind(CARD[id])!=='fusion');
     player.extraDeck.push(...reclaimed.filter(id=>summonKind(CARD[id])==='fusion'));
     if(main.length){player.deck.push(...main);player.deck=shuffle(player.deck);}
   }
   break;
  }
  case 'banishedRecover':{for(const id of player.banished.splice(Math.max(0,player.banished.length-qty),qty))
    (summonKind(CARD[id])==='fusion'?player.extraDeck:player.hand).push(id);break;}
  case 'reviveSelected':{
   // Unlike the existing auto-revive, this precisely selects either player's public grave.
   // Index+cardId prevents a stale chain target from reviving a different card.
   const target=entry.target;
   if(!target||![0,1].includes(target.seat)||!Number.isInteger(target.index))break;
   const grave=s.players[target.seat]?.grave;
   const slot=p.monsters.indexOf(null);
   if(slot<0||!grave||grave[target.index]!==target.cardId||CARD[target.cardId]?.type!=='monster'){
     log(s,`「${card.name}」の蘇生対象が移動したか、モンスターゾーンが満杯のため不発になりました。`);break;
   }
   const [id]=grave.splice(target.index,1);
   p.monsters[slot]={key:++s.nextKey,id,ownerSeat:target.seat,pos:'atk',bornTurn:s.turnNo,attacked:true,changedTurn:s.turnNo,bonus:0};
   log(s,`${p.name} は「${CARD[id].name}」を墓地から特殊召喚しました。`);
   if(CARD[id]?.monsterEffect?.code==='copyOpponentPrintedStats')activateMonsterAbility(s,seat,p.monsters[slot],'trigger');
   break;
  }
  case 'reviveBothSet':{
   // Transactional across both players: an intervening chain must not revive just one side.
   if(!canReviveBothSet(s)){log(s,`「${card.name}」は墓地・ゾーン条件が変わったため不発になりました。`);break;}
   for(const target of s.players){
    const at=target.grave.findLastIndex(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='normal');
    const slot=target.monsters.indexOf(null);
    const id=target.grave.splice(at,1)[0];
    target.monsters[slot]={key:++s.nextKey,id,pos:'set',bornTurn:s.turnNo,attacked:true,changedTurn:s.turnNo,bonus:0};
   }
   log(s,`「${card.name}」：双方がモンスターを裏側守備で1体ずつ蘇生しました。`);
   break;
  }
  case 'summonRaceFromHand':{
   if(ab.requiredFaceUpName&&!s.players.some(x=>x.monsters.some(m=>m&&m.pos!=='set'&&CARD[m.id]?.name===ab.requiredFaceUpName))){
    log(s,`「${card.name}」は発動条件のモンスターがいないため不発になりました。`);break;
   }
   let summoned=0;
   for(let i=0;i<qty;i++){
    const slot=player.monsters.indexOf(null);
    if(slot<0)break;
    const at=player.hand.findIndex(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='normal'&&normalizeRace(CARD[id].race)===normalizeRace(ab.query));
    if(at<0)break;
    const id=player.hand.splice(at,1)[0];
    const item={key:++s.nextKey,id,pos:'atk',bornTurn:s.turnNo,attacked:true,changedTurn:s.turnNo,bonus:0};
    player.monsters[slot]=item;summoned++;
    if(CARD[id]?.monsterEffect?.kind==='trigger'&&CARD[id].monsterEffect.code==='copyOpponentPrintedStats')activateMonsterAbility(s,recipient,item,'trigger');
   }
   log(s,`「${card.name}」：手札から${summoned}体を特殊召喚しました。`);
   break;
  }
  case 'graveRevive':{
   for(let i=0;i<qty;i++){
    const slot=player.monsters.indexOf(null);
    const graveIndex=player.grave.findLastIndex(id=>CARD[id]?.type==='monster');
    if(slot<0||graveIndex<0)break;
    const id=player.grave.splice(graveIndex,1)[0];
    player.monsters[slot]={key:++s.nextKey,id,pos:'atk',bornTurn:s.turnNo,attacked:true,changedTurn:s.turnNo,bonus:0};
    if(CARD[id]?.monsterEffect?.code==='copyOpponentPrintedStats')activateMonsterAbility(s,recipient,player.monsters[slot],'trigger');
   }
   break;
  }
  case 'reflectAttack':{
   // Fixed, synchronous resolution: do not open a second selection or chain.
   const attack=chain?.afterAttack;
   const attacker=attack&&s.players[attack.by]?.monsters?.[attack.attacker];
   if(!attack||chain.attackNegated||chain.attackInterrupted||!attacker||attacker.pos!=='atk'||
      (attack.attackerKey!==undefined&&attacker.key!==attack.attackerKey)){
    log(s,'攻撃が既に無効・中断されたか、攻撃モンスターがいないため反射ダメージは発生しません。');break;
   }
   const points=Math.max(0,effectiveAtk(attacker,s,attack.by));
   chain.attackNegated=true;
   s.players[attack.by].lp=Math.max(0,s.players[attack.by].lp-points);
   log(s,`攻撃を無効にし、${points}ダメージを反射しました。`);
   break;
  }
  case 'negateAttack':if(chain)chain.attackNegated=true;break;
  case 'negateEndBattle':{
   if(chain?.afterAttack&&!chain.attackNegated&&!chain.attackInterrupted){chain.attackNegated=true;chain.endBattle=true;}
   break;
  }
  // negateEffect is handled during chain resolution, so it can counter its predecessor.
  case 'negateEffect':break;
 }
 if(card.type==='trap'&&!card.ability&&chain?.afterAttack&&['counterburn','negate'].includes(card.effect))chain.attackNegated=true;
 log(s,`${p.name}：「${card.name}」の効果を解決しました。`);
 const applied=beforeStage!==null&&JSON.stringify(s.players)!==beforeStage;
 if(ab.then&&applied){
  // A follow-up is part of this same effect, not a new activation or chain link.
  // Only automatic or reused targets are permitted by isValidAbility.
  executeAbility(s,entry,chain,{when:ab.when,...ab.then});
 }else if(ab.then&&!applied){log(s,`「${card.name}」：最初の効果が適用されず、追加効果は発動しません。`);}
 sweepOrphanEquips(s);checkWinner(s);
}
// Firebase Realtime Database rejects undefined anywhere inside transaction data.
// Non-targeted spells/traps/effects must omit target rather than store target: undefined.
const chainEntry=(seat,cardId,target,discardOnResolve=false)=>{
 const entry=target===undefined?{seat,cardId}:{seat,cardId,target};
 // Keep a newly activated normal spell/trap in the chain rather than its grave.
 // Old saved rooms lacking this flag have already sent those cards to the grave.
 if(discardOnResolve)entry.discardOnResolve=true;
 return entry;
};
// Record the identity of a single targeted monster when the chain link is
// created. Older saved links without a key keep their legacy behavior.
function bindMonsterTarget(s,entry){
 const ab=actionAbility(CARD[entry.cardId]);
 let side=null,at=entry.target;
 if(ab?.target==='ownMonster'||ab?.target==='self'&&ab.operation==='doubleOriginalAtkEndDestroy')side=entry.seat;
 else if(ab?.target==='enemyMonster')side=1-entry.seat;
 else if(ab?.target==='attacker'){
  const attack=s.pending?.kind==='attack'?s.pending:s.pending?.afterAttack;
  if(attack){side=attack.by;at=attack.attacker;}
 }
 if(side!==null&&Number.isInteger(at)&&at>=0&&at<5){
  const key=s.players[side]?.monsters?.[at]?.key;
  if(Number.isInteger(key))entry.targetMonsterKey=key;
 }
 return entry;
}
function startChain(s,entry,afterAttack=null){
 assert(!s.pending||s.pending.kind==='attack','対応処理中です');
 s.pending={kind:'chain',stack:[bindMonsterTarget(s,{...chainEntry(entry.seat,entry.cardId,entry.target,entry.discardOnResolve),...(entry.persistentZone?{persistentZone:entry.persistentZone,...entry.persistentZone==='backrow'?{persistentIndex:entry.persistentIndex}:{}}:{})})],priority:1-entry.seat,passes:0,afterAttack,attackNegated:false,attackInterrupted:false};
 log(s,`チェーン1：「${mustCard(entry.cardId).name}」発動。相手の応答を待ちます。`);
}
function castSpell(s,seat,source,index,target,costIndices){
  const p=s.players[seat],ch=s.pending;
  const responding=!!ch,attackResponse=ch?.kind==='attack';
  const fromHand=source==='hand';
  const old=fromHand?p.hand[index]:source==='field'?p.field:p.backrow[index];
  const id=fromHand?old:old?.id,c=mustCard(id);
  assert(c.type==='spell','魔法カードではありません');
  const kind=spellKind(c),quick=kind==='quick';
  assert(!['ritual','fusion'].includes(kind),'この魔法は専用の召喚ボタンから発動してください');
  if(responding){
    assert(quick,'対応中は速攻魔法だけ発動できます');
    if(attackResponse)assert(seat!==ch.by,'攻撃への最初の対応は防御側が行います');
    else assert(ch.kind==='chain'&&ch.priority===seat&&ch.stack.length<8,'チェーンの応答順ではありません');
  } else {
    assert(s.turn===seat,'相手ターンに手札から魔法は使えません');
    assert(quick||['main1','main2'].includes(s.phase),'メインフェイズで発動してください');
    assert(!quick||['draw','main1','battle','main2'].includes(s.phase),'このフェイズでは使えません');
  }
  if(fromHand)assert(s.turn===seat&&arrayIndex(p.hand,index),'手札からの発動は自分ターンのみです');
  else {
    assert(old&&old.faceDown,'セット済みの魔法カードを選んでください');
    if(kind==='quick')assert(old.setTurn<s.turnNo,'速攻魔法はセットしたターンには発動できません');
  }
  const ab=actionAbility(c);assert(ab,'この魔法の効果は未対応です');
  // A two-player hand replacement must never enter the chain when either
  // player cannot complete its mandatory draws. Avoid partial mutation/deck-out.
  if(ab.operation==='summonRaceFromHand')assert(canSummonRaceFromHand(s,seat,ab),'発動条件のモンスター・手札の指定種族・ゾーンの空きを確認してください');
  if(ab.operation==='reviveBothSet')assert(canReviveBothSet(s),'双方の墓地に通常召喚可能なモンスターと空きゾーンが必要です');
  if(ab.operation==='summonNamedFromHand')
    assert(canSummonNamedFromHand(p,ab),'指定名モンスターが手札にないか、モンスターゾーンが満杯です');
  if(ab.operation==='destroyGiveOwn')assert(p.monsters.some(Boolean),'自分のフィールドに渡すモンスターがありません');
  if(ab.operation==='graveRevive')assert(p.monsters.some(x=>x===null)&&p.grave.some(id=>CARD[id]?.type==='monster'),'蘇生できるモンスターまたはゾーンの空きがありません');
  if(ab.operation==='lockPositionNextTurn')assert(s.turn===seat,'相手のターンには発動できません');
  if(ab.operation==='replaceHands'){
    const count=p.hand.length-(fromHand?1:0);
    const rival=s.players[1-seat];
    assert(count+rival.hand.length>0,'交換する手札がありません');
    assert(p.deck.length>=count&&rival.deck.length>=rival.hand.length,'双方のデッキに必要なカードがありません');
  }
  // Draw-then-discard must not activate if the mandatory draw cannot finish.
  if(ab.operation==='draw'&&ab.then?.operation==='discardNewest'&&ab.target==='self')
   assert(p.deck.length>=ab.amount,'効果に必要なカードをドローできません');
  if(!(kind==='field'&&ab.when==='continuous'))abilityTargetCheck(s,seat,ab,target);
  // 装備魔法は対象のモンスターに紐付ける。移動しても装備関係は維持する。
  if(kind==='equip'){
    assert(['ownMonster','enemyMonster'].includes(ab.target)&&Number.isInteger(target),'装備するモンスターを選んでください');
    const monster=getMonster(s,ab.target==='ownMonster'?seat:1-seat,target);
    if(monster.key===undefined)monster.key=++s.nextKey;
  }
  const movedBefore=payBefore(s,seat,ab,costIndices,fromHand?{zone:'hand',index}:source==='backrow'?{zone:'backrow',index}:null,target);
  if(fromHand)index-=movedBefore;
  const ongoing=persistentSpell(c);
  let slotItem={id,faceDown:false,setTurn:s.turnNo};
  if(!fromHand)slotItem={...old,faceDown:false};
  if(kind==='equip'||(kind==='continuous'&&['ownMonster','enemyMonster'].includes(ab.target))){
    const linkOwner=ab.target==='enemyMonster'?1-seat:seat;
    const monster=getMonster(s,linkOwner,target);
    if(monster.key===undefined)monster.key=++s.nextKey;
    slotItem.linkKey=monster.key;slotItem.linkOwner=linkOwner;
  }
  if(fromHand){
    if(ongoing&&kind!=='field')assert(p.backrow.some(v=>v===null),'魔法・罠ゾーンが満杯です');
    p.hand.splice(index,1);
    if(ongoing){
      if(kind==='field'){
        if(p.field)p.grave.push(p.field.id);
        p.field=slotItem;
      }else p.backrow[p.backrow.indexOf(null)]=slotItem;
    } // Non-persistent cards move to the grave only when the chain finishes.
  }else if(source==='field'){
    assert(kind==='field','フィールドゾーンにある魔法ではありません');
    p.field=slotItem;
  }else{
    assert(arrayIndex(p.backrow,index),'ゾーンが不正です');
    if(ongoing)p.backrow[index]=slotItem;
    else{p.backrow[index]=null;}
  }
  const entry=chainEntry(seat,id,target,!ongoing);
  if(ongoing){
    entry.persistentZone=kind==='field'?'field':'backrow';
    if(kind!=='field')entry.persistentIndex=fromHand?p.backrow.indexOf(slotItem):index;
  }
  if(!responding){startChain(s,entry);return;}
  if(attackResponse){startChain(s,entry,{...ch});return;}
  ch.stack.push(bindMonsterTarget(s,entry));ch.priority=1-seat;ch.passes=0;
  log(s,`チェーン${ch.stack.length}：「${c.name}」発動！`);
}
/** 召喚素材は「手札:番号」「場:番号」を明示する。配列をまとめて取り除き、手札インデックスのずれを防ぐ。 */
function materialEntries(s,seat,materials,excludeHand=[]){
  assert(Array.isArray(materials)&&materials.length>0&&materials.length<=8,'素材は1〜8体選んでください');
  const p=s.players[seat],seen=new Set();
  return materials.map(m=>{
    assert(m&&['hand','monsters'].includes(m.zone)&&Number.isInteger(m.index),'素材の指定が不正です');
    const key=`${m.zone}:${m.index}`;assert(!seen.has(key),'同じ素材は選べません');seen.add(key);
    assert(m.zone!=='hand'||!excludeHand.includes(m.index),'召喚するカードと魔法カードは素材にできません');
    const id=m.zone==='hand'?p.hand[m.index]:p.monsters[m.index]?.id;
    assert(id&&CARD[id]?.type==='monster','素材となるモンスターがありません');
    return {...m,id,level:CARD[id].level};
  });
}
function consumeMaterials(s,seat,materials){
  const p=s.players[seat];
  for(const m of materials.filter(m=>m.zone==='monsters'))sendToGrave(p,'monsters',m.index,s);
  for(const m of materials.filter(m=>m.zone==='hand').sort((a,b)=>b.index-a.index)){
    p.grave.push(p.hand.splice(m.index,1)[0]);
  }
}
function specialSpell(s,seat,a,kind){
  const p=s.players[seat],source=a.spellSource,index=a.spellIndex;
  assert(['hand','backrow'].includes(source)&&Number.isInteger(index),'魔法カードを選択してください');
  const id=source==='hand'?p.hand[index]:p.backrow[index]?.id;
  const c=mustCard(id);
  assert(c.type==='spell'&&spellKind(c)===kind,'対応する召喚魔法がありません');
  if(source==='backrow')assert(p.backrow[index]?.faceDown,'セットした魔法カードだけ発動できます');
  return {id,card:c};
}
function doSpecialSummon(s,seat,a){
  requireMain(s,seat);
  const p=s.players[seat],isRitual=a.type==='ritualSummon',kind=isRitual?'ritual':'fusion';
  const {id:spellId,card:spell}=specialSpell(s,seat,a,kind);
  let id,excluded=[];
  if(isRitual){
    assert(Number.isInteger(a.ritualHand),'儀式モンスターを選んでください');
    id=p.hand[a.ritualHand];excluded=[a.ritualHand];
  } else {
    id=a.fusionId;
    assert(p.extraDeck.includes(id),'EXデッキに融合モンスターがありません');
  }
  const card=mustCard(id);
  assert(card.type==='monster'&&summonKind(card)===kind,'召喚するモンスターの種類が違います');
  if(isRitual&&spell.ritualFor)assert(spell.ritualFor===id,'この儀式魔法では召喚できません');
  const items=materialEntries(s,seat,a.materials,excluded.concat(a.spellSource==='hand'?[a.spellIndex]:[]));
  if(isRitual)assert(items.reduce((sum,m)=>sum+m.level,0)>=card.level,'リリースする素材のレベル合計が足りません');
  else{
    assert(items.length===2,'融合素材を2体選んでください');
    assert(fusionMaterialsMatch(card.fusionMaterials,items.map(m=>m.id),id=>CARD[id]?.ability?.operation==='fusionMaterialSubstitute'),'融合素材が一致しません');
  }
  assert(p.monsters.some((m,i)=>!m||items.some(x=>x.zone==='monsters'&&x.index===i)),'モンスターゾーンが満杯です');
  // 妥当性の検証がすべて終わった後に状態を変更する。
  if(a.spellSource==='backrow'){p.backrow[a.spellIndex]=null;p.grave.push(spellId);}
  consumeMaterials(s,seat,items);
  // 手札番号は素材を取り除いた後には変わるため、IDと選択位置を使って追跡する。
  if(isRitual){
    const ritualAt=p.hand.indexOf(id);assert(ritualAt>=0,'儀式モンスターが見つかりません');
    p.hand.splice(ritualAt,1);
  } else p.extraDeck.splice(p.extraDeck.indexOf(id),1);
  if(a.spellSource==='hand'){
    const spellAt=p.hand.indexOf(spellId);assert(spellAt>=0,'魔法カードが見つかりません');
    p.hand.splice(spellAt,1);p.grave.push(spellId);
  }
  const slot=p.monsters.indexOf(null);assert(slot>=0,'モンスターゾーンが満杯です');
  const summoned={key:++s.nextKey,id,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
  p.monsters[slot]=summoned;
  log(s,`${p.name} は「${spell.name}」で「${card.name}」を${isRitual?'儀式':'融合'}召喚しました。`);
  if(card.subtype==='effect'){
    if(card.ability?.when==='summon'){
      const ab=actionAbility(card),target=summonTriggerTarget(s,seat,ab.target,slot);
      if(target!==-1)executeAbility(s,{seat,cardId:id,target},null);
    }else if(card.monsterEffect?.kind==='trigger'){
      const e=card.monsterEffect;
      if(e.code!=='destroy1'&&e.code!=='searchDeckOnSummon')activateMonsterAbility(s,seat,summoned,'trigger');
    }
  }
  checkWinner(s);
  return id;
}
// The lock is derived from face-up monsters, not a persisted/timed flag.
// Applying it to both seats also avoids a second-state-sync path.
export function trapsSuppressed(s){
 return !!s?.players?.some(p=>p?.monsters?.some(m=>m&&m.pos!=='set'&&
   CARD[m.id]?.monsterEffect?.kind==='continuous'&&CARD[m.id].monsterEffect.code==='trapSuppression'));
}
function addChainTrap(s,seat,index,target,costIndices){
 const ch=s.pending;assert(ch?.kind==='chain'&&ch.priority===seat,'チェーンの応答順ではありません');
 assert(!trapsSuppressed(s),'サイコ・ショッカーの効果で罠カードを発動できません');
 assert(ch.stack.length<8,'チェーンは最大8つまでです');
 const item=s.players[seat].backrow[index];assert(item&&mustCard(item.id).type==='trap','罠カードがありません');
 assert(item.setTurn<s.turnNo,'セットしたターンに罠は使えません');
 const c=mustCard(item.id),ab=actionAbility(c);assert(ab&&(ab.when==='response'||(ab.when==='attack'&&ch.afterAttack)),'今はこの罠を発動できません');
 // Historical counter traps can use the same generic negateEffect operation,
 // with a small optional activation guard on the immediately preceding link.
 if(c.responseGuard){
  const previous=ch.stack[ch.stack.length-1],spell=previous&&CARD[previous.cardId];
  assert(spell?.type==='spell','魔法カードの発動にしか対応できません');
  if(c.responseGuard==='targetedSpell')assert(['ownMonster','enemyMonster'].includes(actionAbility(spell)?.target),'モンスター1体を対象とする魔法にしか対応できません');
 }
 if(ab.operation==='borrowOpponentSpell')assert(s.players[1-seat].grave.some(id=>CARD[id]?.type==='spell'),'相手の墓地に魔法カードがありません');
 abilityTargetCheck(s,seat,ab,target);
 payBefore(s,seat,ab,costIndices,{zone:'backrow',index},target);
 s.players[seat].backrow[index]=null;
 ch.stack.push(bindMonsterTarget(s,chainEntry(seat,item.id,target,true)));ch.priority=1-seat;ch.passes=0;
 log(s,`チェーン${ch.stack.length}：「${c.name}」発動！`);
}
function finishChain(s){
 const ch=s.pending;assert(ch?.kind==='chain','チェーンがありません');
 const after=ch.afterAttack;
 // Unwind from most recently activated to oldest. Resolve target if still present.
 let cancelPrevious=false;
 for(let i=ch.stack.length-1;i>=0;i--){
   if(s.status==='finished')break;
   const entry=ch.stack[i];
   // A trap already on the chain is also suppressed if the lock is active when it resolves.
   // The trap still goes to the grave during ordinary chain cleanup.
   if(CARD[entry.cardId]?.type==='trap'&&trapsSuppressed(s)){
     log(s,`「${CARD[entry.cardId].name}」は罠封じにより効果を適用しません。`);
     cancelPrevious=false;continue;
   }
   if(cancelPrevious){
     log(s,`「${mustCard(entry.cardId).name}」の効果を無効化しました。`);
     // A negated continuous/equip/field spell cannot remain active on the board.
     if(entry.persistentZone){
       const owner=s.players[entry.seat];
       if(entry.persistentZone==='field'){
         if(owner.field?.id===entry.cardId){owner.field=null;owner.grave.push(entry.cardId);}
       }else if(Number.isInteger(entry.persistentIndex)&&owner.backrow[entry.persistentIndex]?.id===entry.cardId){
         owner.backrow[entry.persistentIndex]=null;owner.grave.push(entry.cardId);
       }
     }
     cancelPrevious=false;continue;
   }
   if(actionAbility(mustCard(entry.cardId))?.operation==='negateEffect'){
     cancelPrevious=true;
     log(s,`「${mustCard(entry.cardId).name}」が直前のチェーン効果を無効化します。`);
     continue;
   }
   executeAbility(s,entry,ch);
 }
 // Finish moving cards from chain storage to their owners' graves.
 // Even if an earlier effect ended the duel, every activated card leaves the chain.
 for(const entry of ch.stack)if(entry.discardOnResolve)s.players[entry.seat].grave.push(entry.cardId);
  s.pending=null;
 breakEquipsOnMonster(s);sweepOrphanEquips(s);
 // Successful negation ends the battle without opening another response.
 if(after&&ch.endBattle&&s.phase==='battle'){
   finishBattlePostAttack(s);s.phase='main2';
   log(s,'攻撃の無力化：バトルフェイズを終了しました。');
 }
  if(after&&s.status==='playing'&&!ch.attackNegated&&!ch.attackInterrupted){
   s.pending={kind:'attack',...after};resolveAttack(s);
 }else if(after&&ch.attackInterrupted)log(s,'攻撃モンスターの表示形式が変わったため、攻撃は終了しました。');
 else if(after&&ch.attackNegated)log(s,'攻撃は無効になりました。');
 checkWinner(s);
}
function takeSnapshot(s){
 const snapshot={};
 // Immutable room metadata (mode/completedDraft/createdAt) is deliberately not
 // duplicated here. Restoring it from the current room keeps Firebase payloads small.
 for(const key of ['status','players','turn','turnNo','phase','pending','winner','log','lastEvent','lastRandom','rules','nextKey'])
   if(Object.hasOwn(s,key))snapshot[key]=structuredClone(s[key]);
 return snapshot;
}

// Applies the delayed combat position change only to the same surviving monster instance.
// Each instance carries its own lightweight declaration marker (no polling or extra phase).
function finishBattlePostAttack(s){
  for(const p of s.players){
    for(const m of p.monsters){
      if(!m||m.postAttackDefenseTurn!==s.turnNo)continue;
      delete m.postAttackDefenseTurn;
      if(m.pos==='set')continue;
      m.pos='def';
      log(s,`「${CARD[m.id]?.name||m.id}」はバトルフェイズ終了時に守備表示になりました。`);
    }
  }
}
// A restriction imposed by this monster's own effect does NOT prevent spells/traps
// from changing position, nor the engine's automatic end-of-battle position change.
export const canManuallyChangePosition=(m,turnNo)=>!!m&&
  m.pos!=='set'&&m.bornTurn!==turnNo&&m.changedTurn!==turnNo&&!m.attacked&&
  !(Number.isInteger(m.positionLockedThroughTurn)&&turnNo<=m.positionLockedThroughTurn);
function endTurn(s) {
  assert(!s.pending,'相手の対応が終わっていません');
  const p=s.players[s.turn];assert(s.phase!=='draw','ドローフェイズを完了してください');
  if(s.phase==='battle')finishBattlePostAttack(s);
  // End-phase automatic return happens once, before the six-card hand adjustment.
  // phase==='end' is the existing discard-only continuation, so it cannot double-trigger.
  // Snapshot the slot identities first: no extra timers, polling, or persisted flags.
  if(s.phase!=='end'){
    // End-phase self-destruction occurs once before the six-card hand limit.
    for(const controller of s.players){
      for(let i=0;i<controller.monsters.length;i++){
        const item=controller.monsters[i];
        if(item?.doubleOriginalAtkTurn!==s.turnNo)continue;
        sendToGrave(controller,'monsters',i,s);
        log(s,`「${CARD[item.id]?.name||item.id}」はエンドフェイズに破壊されました。`);
      }
    }
    for(let i=0;i<p.monsters.length;i++){
      const item=p.monsters[i];
      if(!item||item.pos==='set')continue;
      const effect=CARD[item.id]?.monsterEffect;
      if(effect?.kind!=='endPhase'||effect.code!=='selfReturnHand')continue;
      returnMonsterToOwner(s,item,p,'hand');
      p.monsters[i]=null;
      log(s,`「${CARD[item.id].name}」はエンドフェイズに持ち主の手札へ戻りました。`);
    }
  }
  // Official OCG hand-size adjustment: never discard freely during main/battle.
  // If there are more than six cards, remain in End Phase until the owner selects discards.
  if(p.hand.length>6){
    assert(s.phase!=='end','手札を6枚にするまで、捨てるカードを選んでください');
    s.phase='end';
    log(s,`${p.name}：エンドフェイズ。手札を6枚にしてください。`);
    return;
  }
  const nextTurnNo=s.turnNo+1;
  // Reset stats and expire position locks in one pass over the existing 10 slots.
  for(const pl of s.players)for(const mon of pl.monsters)if(mon){
    mon.bonus=0;mon.defBonus=0;delete mon.doubleOriginalAtkTurn;delete mon.swappedOriginalStatsTurn;
    if(Number.isInteger(mon.positionLockedThroughTurn)&&mon.positionLockedThroughTurn<nextTurnNo)delete mon.positionLockedThroughTurn;
  }
  for(const pl of s.players)if(Number.isInteger(pl.positionLockedTurn)&&pl.positionLockedTurn<nextTurnNo)delete pl.positionLockedTurn;
  s.turn=1-s.turn;s.turnNo=nextTurnNo;s.phase='main1';s.players[s.turn].normalUsed=false;
  const active=s.players[s.turn];
  for(const mon of active.monsters)if(mon){mon.attacked=false;delete mon.attackCount;}
  log(s,`${active.name} のターン。`);
  if(draw(active,1,s))log(s,`${active.name} が1枚ドローしました。`);
  checkWinner(s);
}
/**
 * Firebase の transaction / ローカルお試しに共通する純粋な状態更新関数。
 * 不正な操作時は Error を投げ、既存の状態は変更しない。
 */
export function applyAction(current,actorUid,action) {
  assert(current?.status==='playing'||(['requestUndo','approveUndo','rejectUndo'].includes(action?.type)&&current?.status==='finished'),'対戦中ではありません');
  const s=normalizeRoom(structuredClone(current));
  const seat=s.players.findIndex(p=>p?.uid===actorUid);
  reqOwn(s,seat);
  const p=s.players[seat],enemy=s.players[1-seat];
  const a=action||{};
  const ownTurn=s.turn===seat;
  if(s.undoRequest!==null&&s.undoRequest!==undefined&&!['approveUndo','rejectUndo'].includes(a.type))fail('取り消し依頼への返答を待っています');
  if(ownTurn&&s.phase==='end'&&p.hand.length>6&&!['discard','surrender','requestUndo','approveUndo','rejectUndo'].includes(a.type))
    fail('エンドフェイズです。手札から捨てるカードを選んでください。');
  if(a.type==='requestUndo'){assert(s.undoSnapshot&&s.undoActor===seat&&!s.undoRequest,'直前の自分の操作だけ取り消しを依頼できます');s.undoRequest=seat;s.revision++;log(s,'直前の操作の取り消しを相手に依頼しました。');return s;}
  if(a.type==='rejectUndo'){assert(s.undoRequest!==null&&s.undoRequest!==undefined&&s.undoRequest!==seat,'依頼がありません');s.undoRequest=null;s.revision++;log(s,'取り消し依頼を断りました。');return s;}
  if(a.type==='approveUndo'){
   assert(s.undoRequest!==null&&s.undoRequest!==undefined&&s.undoRequest!==seat&&s.undoSnapshot,'依頼がありません');
   const restored=normalizeRoom(structuredClone(s.undoSnapshot));
   // Legacy undo snapshots (<= v1.9.11) did not include these properties.
   for(const key of ['mode','completedDraft','createdAt'])
     if(!Object.hasOwn(restored,key)&&Object.hasOwn(s,key))restored[key]=structuredClone(s[key]);
   restored.revision=(s.revision||0)+1;restored.undoRequest=null;restored.undoSnapshot=null;restored.undoActor=null;
   log(restored,'双方の同意により直前の操作を取り消しました。');return restored;
  }
  // Undo request/reject/approve return above. Only game-changing actions need
  // a new undo snapshot, which is a comparatively expensive deep clone.
  const before=takeSnapshot(s);
  const lpBefore=s.players.map(q=>q.lp);
  // Store only a public, non-sensitive cue for audiovisual sync.
  let cueType=null, cueCard=null, cueActor=seat, cueSlot=null, cueTarget=null, cueTargetSeat=null;
  switch(a.type){
    case 'summon':cueType=a.faceDown?'set':'summon';cueCard=p.hand[a.hand];break;
    case 'ritualSummon':cueType='ritual';cueCard=p.hand[a.ritualHand];break;
    case 'fusionSummon':cueType='fusion';cueCard=a.fusionId;break;
    case 'flip':cueType='summon';cueCard=p.monsters[a.index]?.id;break;
    case 'activateMonsterEffect':cueType='effect';cueCard=p.monsters[a.index]?.id;break;
    case 'spellFromHand':cueType='spell';cueCard=p.hand[a.hand];break;
    case 'quickResponse':cueType='spell';cueCard=a.source==='hand'?p.hand[a.index]:p.backrow[a.index]?.id;break;
    case 'spellFromField':cueType='spell';cueCard=p.backrow[a.index]?.id;break;
    case 'activateTrap':cueType='trap';cueCard=p.backrow[a.index]?.id;break;
    case 'attack':cueType='attack';cueCard=p.monsters[a.index]?.id;break;
    case 'passAttack':cueType='impact';cueCard=s.players[s.pending?.by]?.monsters[s.pending?.attacker]?.id;break;
    case 'setBackrow':cueType='set';cueCard=p.hand[a.hand];break;
  }
  switch(a.type) {
    case 'ritualSummon':
    case 'fusionSummon':{doSpecialSummon(s,seat,a);break;}
    case 'summon': {
      requireMain(s,seat);
      assert(!p.normalUsed,'このターンはすでに通常召喚しました');
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],c=mustCard(id);
      assert(c.type==='monster'&&summonKind(c)==='normal','儀式・融合モンスターは通常召喚できません');
      const tributes=a.tributes||[];
      assert(validSummonTributes(c,p.hand.length,p.monsters,tributes),'必要なリリース数またはリリース対象が正しくありません');
      const slot=p.monsters.findIndex((m,i)=>m===null||tributes.includes(i));
      assert(slot>=0,'モンスターゾーンが満杯です');
      for(const i of tributes)sendToGrave(p,'monsters',i,s);
      p.hand.splice(a.hand,1);
      p.monsters[slot]={key:++s.nextKey,id,pos:a.faceDown?'set':(a.position==='def'?'def':'atk'),bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
      p.normalUsed=true;
      if(!a.faceDown&&c.subtype==='effect'&&s.status==='playing'){
        if(c.ability?.when==='summon'){
          // The simplified summon-trigger flow cannot ask for a target while summoning.
          // Own-monster effects use the summoned card; opponent-target effects pick
          // the first available opposing monster instead of silently doing nothing.
          const target=summonTriggerTarget(s,seat,c.ability.target,slot);
          if(target!==-1)executeAbility(s,{seat,cardId:id,target},null);
          else log(s,`「${c.name}」の効果は対象がいないため処理できませんでした。`);
        }else if(c.monsterEffect?.kind==='trigger')activateMonsterAbility(s,seat,p.monsters[slot],'trigger');
      }
      log(s,`${p.name} はモンスターを${a.faceDown?'裏側守備表示でセット':a.position==='def'?'守備表示で召喚':'召喚'}しました。`);
      break;
    }
    case 'activateMonsterEffect': {
      requireMain(s,seat);
      const m=getMonster(s,seat,a.index);
      assert(m&&m.pos!=='set','表側表示の効果モンスターを選んでください');
      const c=mustCard(m.id);
      assert(c.subtype==='effect'&&(c.ability?.when==='main'||c.monsterEffect?.kind==='ignition'),'起動効果ではありません');
      assert((m.effectLockedUntil||0)<s.turnNo,'このモンスターの効果は封じられています');
      assert(m.effectUsedTurn!==s.turnNo,'このターンはすでに効果を使いました');
      const ab=actionAbility(c);
      if(ab?.operation==='summonRaceFromHand')assert(canSummonRaceFromHand(s,seat,ab),'発動条件のモンスター・手札の指定種族・ゾーンの空きを確認してください');
      if(ab?.operation==='summonNamedFromHand')
        assert(canSummonNamedFromHand(p,ab),'指定名モンスターが手札にないか、モンスターゾーンが満杯です');
      if(ab?.operation==='fusionFromExtraPay5000'){
        assert(p.lp>5000,'LPが5000以下のため発動できません');
        assert(p.monsters.some(m=>m===null),'モンスターゾーンが満杯です');
        assert(p.extraDeck.some(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='fusion'),'EXデッキに融合モンスターがありません');
      }
      const actualTarget=ab?.operation==='doubleOriginalAtkEndDestroy'?a.index:a.target;
      abilityTargetCheck(s,seat,ab,actualTarget,a.index);
      payBefore(s,seat,ab,a.costIndices,null,actualTarget);
      if(ab?.operation==='fusionFromExtraPay5000')p.lp-=5000; // activation cost, not on resolution
      m.effectUsedTurn=s.turnNo;
      startChain(s,{seat,cardId:m.id,target:ab.target==='ownMonster'&&actualTarget===undefined?a.index:actualTarget});
      break;
    }
    case 'setBackrow': {
      requireMain(s,seat);
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],c=mustCard(id);
      assert(c.type==='spell'||c.type==='trap','魔法・罠カードではありません');
      const slot=p.backrow.indexOf(null);assert(c.type==='spell'&&spellKind(c)==='field'||slot>=0,'魔法・罠ゾーンが満杯です');
      p.hand.splice(a.hand,1);
      if(c.type==='spell'&&spellKind(c)==='field'){
        if(p.field)p.grave.push(p.field.id);
        p.field={id,faceDown:true,setTurn:s.turnNo};
      }else p.backrow[slot]={id,faceDown:true,setTurn:s.turnNo};
      log(s,`${p.name} は魔法・罠を1枚セットしました。`);break;
    }
    case 'spellFromHand': {
      castSpell(s,seat,'hand',a.hand,a.target,a.costIndices);break;
    }
    case 'spellFromField': {
      castSpell(s,seat,a.field?'field':'backrow',a.index,a.target,a.costIndices);break;
    }
    case 'quickResponse': {
      assert(['hand','backrow'].includes(a.source),'発動場所が不正です');
      castSpell(s,seat,a.source,a.index,a.target,a.costIndices);break;
    }
    case 'flip': {
      requireMain(s,seat);const m=getMonster(s,seat,a.index);
      assert(m&&m.pos==='set','裏側守備表示のモンスターではありません');
      assert(p.positionLockedTurn!==s.turnNo,'催眠術の効果で反転召喚できません');
      assert(m.bornTurn!==s.turnNo,'セットしたターンには反転召喚できません');
      m.pos='atk';m.changedTurn=s.turnNo;log(s,`${p.name} は ${CARD[m.id].name} を反転召喚しました。`);
      resolveFlipEffect(s,seat,m);
      // Reuse the same deterministic summon-trigger path for flip summons.
      if(CARD[m.id]?.ability?.when==='summon'){
        const ability=CARD[m.id].ability,target=summonTriggerTarget(s,seat,ability.target,a.index);
        if(target!==-1)executeAbility(s,{seat,cardId:m.id,target},null);
      }
      if(CARD[m.id]?.monsterEffect?.kind==='trigger'&&['searchDeckOnSummon','copyOpponentPrintedStats'].includes(CARD[m.id].monsterEffect.code))activateMonsterAbility(s,seat,m,'trigger');
      break;
    }
    case 'changePosition': {
      requireMain(s,seat);const m=getMonster(s,seat,a.index);
      assert(m&&m.pos!=='set','表側のモンスターを選んでください');
      assert(p.positionLockedTurn!==s.turnNo,'催眠術の効果で表示形式を変更できません');
      assert(m.bornTurn!==s.turnNo,'召喚したターンには表示形式を変更できません');
      assert(m.changedTurn!==s.turnNo,'このターンはすでに表示形式を変更しました');
      assert(!m.attacked,'攻撃したモンスターは表示形式を変更できません');
      assert(!(Number.isInteger(m.positionLockedThroughTurn)&&s.turnNo<=m.positionLockedThroughTurn),'このモンスターは次の自分ターン終了まで表示形式を変更できません');
      const wasAttack=m.pos==='atk';
      m.pos=wasAttack?'def':'atk';m.changedTurn=s.turnNo;log(s,`${p.name} はモンスターの表示形式を変更しました。`);
      // Deliberately limited to ordinary manual position changes: no new chain,
      // target UI, recurring listeners, or asynchronous state is introduced.
      if(wasAttack&&CARD[m.id]?.monsterEffect?.kind==='position'&&CARD[m.id]?.monsterEffect?.code==='destroyOnAttackToDefense'){
        const at=enemy.monsters.findIndex(Boolean);
        if(at>=0){const victim=CARD[enemy.monsters[at].id]?.name||'モンスター';sendToGrave(enemy,'monsters',at,s);log(s,`「${CARD[m.id].name}」：${victim}を破壊しました（自動選択）。`);}
        else log(s,`「${CARD[m.id].name}」：相手フィールドに対象がありません。`);
      }
      break;
    }
    case 'attack': {
      assert(ownTurn&&s.phase==='battle','バトルフェイズではありません');
      assert(!s.pending,'すでに攻撃の対応待ちです');
      assert(s.turnNo>1,'先攻1ターン目は攻撃できません');
      const m=getMonster(s,seat,a.index);
      assert(m&&m.pos==='atk','攻撃表示のモンスターを選んでください');
      assert(remainingAttacks(m)>0,'このモンスターはすでに規定回数攻撃しました');
      assert((m.attackLockedUntil||0)<s.turnNo,'このモンスターは攻撃を封じられています');
      // -1 is a Firebase-safe sentinel; null would silently disappear in RTDB.
      // Reject omitted targets, rather than accidentally treating them as direct attacks.
      assert(Object.hasOwn(a,'target'),'攻撃対象を選んでください');
      const target=a.target===null||a.target===-1?-1:a.target;
      if(target===-1)assert(canDirectAttackWithMonsters(s,seat,m),'相手のモンスターがいるため直接攻撃できません');
      else assert(isAttackTargetLegal(s,seat,target),'このモンスターは攻撃対象に選択できません');
      m.attackCount=(Number.isInteger(m.attackCount)?Math.max(0,m.attackCount):(m.attacked?1:0))+1;
      m.attacked=true;
      const postAttack=CARD[m.id]?.monsterEffect;
      if(postAttack?.kind==='continuous'&&postAttack.code==='postAttackDefenseLock'){
        m.postAttackDefenseTurn=s.turnNo;
        m.positionLockedThroughTurn=s.turnNo+2;
      }
      s.pending={kind:'attack',by:seat,attacker:a.index,target,
        ...(m.key!==undefined?{attackerKey:m.key}:{}),
        ...(target>=0&&enemy.monsters[target]?.key!==undefined?{targetKey:enemy.monsters[target].key}:{})};
      log(s,`${p.name} の攻撃宣言。${enemy.name} は罠を使うか選んでください。`);break;
    }
    case 'passAttack': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'対応できる攻撃がありません');
      cueType='impact';cueActor=s.pending.by;cueCard=s.players[cueActor].monsters[s.pending.attacker]?.id||null;
      cueSlot=s.pending.attacker;cueTarget=s.pending.target==null?-1:s.pending.target;cueTargetSeat=1-cueActor;
      log(s,`${p.name} はカードを発動しませんでした。`);resolveAttack(s);break;
    }
    case 'activateTrap': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'相手の攻撃時に発動できます');
      assert(!trapsSuppressed(s),'サイコ・ショッカーの効果で罠カードを発動できません');
      assert(arrayIndex(p.backrow,a.index),'ゾーンが不正です');
      const item=p.backrow[a.index];assert(item&&mustCard(item.id).type==='trap','セットされた罠カードがありません');
      assert(item.setTurn<s.turnNo,'セットしたターンに罠は発動できません');
      const c=mustCard(item.id),ab=actionAbility(c);assert(ab?.when==='attack','この攻撃に対応できない罠です');
      abilityTargetCheck(s,seat,ab,a.target);
      payBefore(s,seat,ab,a.costIndices,{zone:'backrow',index:a.index},a.target);
      const attack=s.pending;
      p.backrow[a.index]=null;
      startChain(s,{seat,cardId:item.id,target:a.target,discardOnResolve:true},attack);
      break;
    }
    case 'chainPass': {
      const ch=s.pending;assert(ch?.kind==='chain'&&ch.priority===seat,'あなたの応答順ではありません');
      ch.passes++;ch.priority=1-seat;
      if(ch.passes>=2){
        // Playback happens only after resolution succeeds, not at spell activation.
        const possible=ch.stack.filter(e=>CARD[e.cardId]?.ability?.operation==='reviveSelected');
        finishChain(s);
        for(const e of possible){
          const old=s.players[e.seat]?.monsters||[],previous=before.players[e.seat]?.monsters||[];
          const slot=old.findIndex((m,i)=>m&&(!previous[i]||previous[i].key!==m.key)&&m.id===e.target?.cardId);
          if(slot>=0){cueType='revive';cueActor=e.seat;cueCard=old[slot].id;cueSlot=slot;}
        }
      }else log(s,`${p.name} はチェーンを追加しませんでした。`);
      break;
    }
    case 'chainTrap': {
      assert(Number.isInteger(a.index),'罠の位置が不正です');
      addChainTrap(s,seat,a.index,a.target,a.costIndices);break;
    }
    case 'manualDraw': {
      requireMain(s,seat);draw(p,1,s);log(s,`${p.name} が追加ドローしました（カジュアル操作）。`);checkWinner(s);break;
    }
    case 'shuffleDeck':{
      requireMain(s,seat);p.deck=shuffle(p.deck);log(s,`${p.name} がデッキをシャッフルしました。`);break;
    }
    case 'moveCard': {
      requireMain(s,seat);const zone=a.zone;
      assert(['monsters','backrow'].includes(zone),'ゾーンが不正です');
      assert(Number.isInteger(a.from)&&a.from>=0&&a.from<5&&Number.isInteger(a.to)&&a.to>=0&&a.to<5,'位置が不正です');
      assert(p[zone][a.from]&&!p[zone][a.to],'移動元または移動先を確認してください');
      p[zone][a.to]=p[zone][a.from];p[zone][a.from]=null;log(s,`${p.name} がカードの位置を移動しました。`);break;
    }
    case 'manualDestroy':
    case 'manualBanish':
    case 'banishGrave':
      // Not legal game actions. Destruction, sending to grave, and banishing
      // must be caused by battle, an effect, a cost, or a defined rule.
      fail('カードは理由なく破壊・除外できません。戦闘またはカード効果で処理してください');
    case 'random': {
      assert(!s.pending,'対応待ちの間はできません');
      if(a.kind==='coin'){const face=Math.random()<.5?'表':'裏';s.lastRandom=`コイントス：${face}`;}
      else if(a.kind==='dice'){s.lastRandom=`サイコロ：${Math.floor(Math.random()*6)+1}`;}
      else fail('ランダム操作が不正です');
      log(s,`${p.name} の ${s.lastRandom}`);break;
    }
    case 'nextPhase': {
      assert(ownTurn&&!s.pending,'今は進められません');
      if(s.phase==='draw'){if(s.turnNo>1&&draw(p,1,s)){cueType='draw';cueCard=null;}if(s.status==='playing')s.phase='main1';}
      else if(s.phase==='main1')s.phase=s.turnNo===1?'main2':'battle';
      else if(s.phase==='battle'){finishBattlePostAttack(s);s.phase='main2';}
      else fail('次はターン終了です');
      log(s,`${p.name}：${PHASES[s.phase]}。`);break;
    }
    case 'endTurn':{
      assert(ownTurn&&!s.pending,'今はターンを終了できません');endTurn(s);break;
    }
    case 'discard':{
      assert(ownTurn&&!s.pending&&s.phase==='end','手札の調整はエンドフェイズだけです');
      assert(p.hand.length>6,'手札が6枚以下なので捨てる必要はありません');
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      p.grave.push(p.hand.splice(a.hand,1)[0]);log(s,`${p.name} が手札を1枚捨てました。`);
      // Once adjusted to six cards, end the turn and perform the next player's one automatic draw.
      if(p.hand.length<=6)endTurn(s);
      break;
    }
    case 'surrender':{
      s.status='finished';s.winner=1-seat;log(s,`${p.name} が降参しました。`);break;
    }
    default:fail('不明な操作です');
  }
  // Tributes, manual moves and other actions may detach equip cards.
  // Clean up at the action boundary even when no effect chain was opened.
  if(!s.pending)breakEquipsOnMonster(s);sweepOrphanEquips(s);
  s.undoSnapshot=before;s.undoActor=seat;s.undoRequest=null;
  s.revision=(s.revision||0)+1;
  if(s.status==='finished'&&current.status!=='finished'){cueType='win';cueCard=null;}
  // Do not write a drawn card id into the shared event; only the drawing iPhone
  // resolves its latest hand card when displaying the enlarged preview.
  if(['endTurn','discard'].includes(a.type)&&s.status==='playing'&&s.turn!==seat){
    s.lastEvent={id:s.revision,type:'draw',cardId:null,actor:s.turn,damage:0};
  }else if(cueType){
    const damage=lpBefore.reduce((v,old,i)=>v+Math.max(0,old-s.players[i].lp),0);
    s.lastEvent={id:s.revision,type:cueType,cardId:cueType==='set'?null:(cueCard||null),actor:cueActor,damage,
      ...(cueType==='revive'||cueType==='impact'?{slot:cueSlot}:{}),
      ...(cueType==='impact'?{target:cueTarget,targetSeat:cueTargetSeat}:{})};
  }
  return s;
}
