import {SHEEP_TOKEN_ID,KURIBOH_TOKEN_ID,CARD, expandDeck, shuffle, validDeck, spellKind, persistentSpell, summonKind, normalizeRace, normalizeAttribute} from './cards.js?v=2351';
import {normalizeRuleSettings,BEFORE_META,ABILITY_META,fusionMaterialsMatch,matchesDeckFilter,MOVE_COUNT_FIELD,MOVE_COUNT_BACKROW,COUNT_SUMMON_OPERATIONS,canCountPreviousMove} from './rules.js?v=2351';

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
const canSoloSummon=(c,handCount)=>handCount>=1&&handCount<=(c?.monsterEffect?.maxHand??1)&&c?.monsterEffect?.kind==='summonRule'&&
  c.monsterEffect.code==='soloHandNoTribute'&&baseTributeNeed(c)>0;
const doubleLightRelease=(c,monsters,index)=>baseTributeNeed(c)===2&&
  monsters?.[index]&&CARD[monsters[index].id]?.monsterEffect?.kind==='summonRule'&&
  CARD[monsters[index].id].monsterEffect.code==='doubleLightTribute'&&
  normalizeAttribute(c.attribute)===normalizeAttribute(CARD[monsters[index].id].monsterEffect.attribute||'光');
export function summonTributeNeed(card,handCount){
 return canSoloSummon(card,handCount)?0:baseTributeNeed(card);
}
export function validSummonTributes(card,handCount,monsters,indices){
 if(!card||!Array.isArray(monsters)||!Array.isArray(indices)||new Set(indices).size!==indices.length||
    !indices.every(i=>Number.isInteger(i)&&i>=0&&i<5&&!!monsters[i]&&!CARD[monsters[i].id]?.isToken))return false;
 const ordinary=baseTributeNeed(card),need=summonTributeNeed(card,handCount);
 // Gaia's optional ordinary tribute is accepted for direct/legacy room actions;
 // the touch UI offers the simpler, zero-release summon while eligible.
 return indices.length===need||canSoloSummon(card,handCount)&&indices.length===ordinary||
   ordinary===2&&indices.length===1&&!!doubleLightRelease(card,monsters,indices[0]);
}
export function hasDoubleLightTribute(card,monsters){
 return baseTributeNeed(card)===2&&monsters.some((_,i)=>!!doubleLightRelease(card,monsters,i));
}
export function specialHandTributeSlots(s,seat,card){
 const e=card?.monsterEffect;
 if(e?.kind!=='hand'||e.code!=='specialByThreeNames'||!Array.isArray(e.names)||e.names.length!==3)return [];
 const p=s?.players?.[seat],selected=[];
 if(!p)return [];
 for(const name of e.names){
  const at=p.monsters.findIndex((m,i)=>m&&m.pos!=='set'&&!selected.includes(i)&&CARD[m.id]?.name===name);
  if(at<0)return [];
  selected.push(at);
 }
 return selected;
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
 if(c?.subtype!=='effect')return;
 if(c.ability?.when==='flip'){executeAbility(s,{seat,cardId:item.id,sourceMonsterKey:item.key},null);return;}
 if(e?.kind!=='flip')return;
 if(e.code==='cyberJarRevealFive'){
   // Resolve a fixed snapshot, not newly summoned replacements from grave triggers.
   // Card selection is automatic; no new chain, timer or network synchronization.
   const original=[];
   const revealCount=Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=5?e.amount:5;
   for(let side=0;side<2;side++)for(let slot=0;slot<5;slot++){
     const monster=s.players[side].monsters[slot];
     if(monster)original.push({side,slot,key:monster.key,id:monster.id});
   }
   for(const {side,slot,key,id} of original){
     const mon=s.players[side].monsters[slot];
     if(mon&&mon.key===key&&mon.id===id)sendToGrave(s.players[side],'monsters',slot,s,true);
   }
   // Revealed cards are neither drawn nor milled: a short deck simply exposes
   // fewer cards and never triggers deck-out. Preserve physical card counts.
   const summoned=[];
   for(let side=0;side<2;side++){
     const p=s.players[side],shown=p.deck.splice(0,Math.min(revealCount,p.deck.length));
     let deployed=0;
     for(const id of shown){
       const card=CARD[id],slot=p.monsters.indexOf(null);
       if(card?.type==='monster'&&summonKind(card)==='normal'&&Number.isInteger(card.level)&&card.level<=4&&card.level>=1&&slot>=0){
         const instance={key:++s.nextKey,id,ownerSeat:side,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
         p.monsters[slot]=instance;summoned.push({side,instance});deployed++;
       }else p.hand.push(id);
     }
     log(s,`「${c.name}」：${p.name}が${shown.length}枚公開し、${deployed}体を特殊召喚しました。`);
   }
   // Special-summon-only triggers run after both sides' boards are established.
   for(const {side,instance} of summoned){
     if(s.players[side].monsters.some(m=>m?.key===instance.key)&&
       CARD[instance.id]?.monsterEffect?.code==='copyOpponentPrintedStats')
       activateMonsterAbility(s,side,instance,'trigger');
   }
   return;
 }
 if(e.code==='morphingJarTwo'){
   // Bounded, synchronous processing: no pickers, new chain, timers or RTDB fields.
   // Snapshot ownership before leaving the field. Cards cannot trigger grave effects.
   const returned=[0,0];
   for(let side=0;side<2;side++)for(let slot=0;slot<5;slot++){
     const p=s.players[side],mon=p.monsters[slot];
     if(!mon)continue;
     p.monsters[slot]=null;
     const card=CARD[mon.id];
     if(!card||card.isToken)continue; // Tokens disappear without entering any zone.
     const owner=originalOwner(s,mon,p),ownerSeat=s.players.indexOf(owner);
     if(summonKind(card)==='fusion')owner.extraDeck.push(mon.id);
     else {owner.deck.push(mon.id);returned[ownerSeat]++;}
   }
   // Equipped cards must detach before new instances occupy old slots.
   sweepOrphanEquips(s);
   for(let side=0;side<2;side++){
     const p=s.players[side],need=returned[side];
     if(!need)continue;
     p.deck=shuffle(p.deck); // Shuffle once per player, not once per monster.
     const revealed=[];let found=0;
     // Each iteration removes a card; even an all-spell deck terminates.
     while(p.deck.length&&found<need){
       const id=p.deck.shift();revealed.push(id);
       if(CARD[id]?.type==='monster')found++;
     }
     let placed=0;
     for(const id of revealed){
       const card=CARD[id],slot=p.monsters.indexOf(null);
       if(card?.type==='monster'&&summonKind(card)==='normal'&&card.level>=1&&card.level<=4&&slot>=0){
         p.monsters[slot]={key:++s.nextKey,id,ownerSeat:side,pos:'set',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
         placed++;
       }else p.deck.push(id); // Not drawn; all remaining revealed cards return to deck.
     }
     p.deck=shuffle(p.deck);
     log(s,`「${c.name}」：${p.name}が${need}体分をデッキへ戻し、${revealed.length}枚公開・${placed}体を裏側守備表示で特殊召喚しました。`);
   }
   return;
 }
 if(e.code==='returnOpponentOnFlip'){
   const foe=s.players[1-seat];let moved=0;
   // A fixed, bounded loop; no choice, extra chain window, or remote round trip.
   for(let i=0;i<5&&moved<e.amount;i++){
     const monster=foe.monsters[i];if(!monster)continue;
     const name=CARD[monster.id]?.name||'モンスター';
     returnMonsterToOwner(s,monster,foe,'hand');foe.monsters[i]=null;
     moved++;log(s,`「${c.name}」：${name}を持ち主の手札に戻しました（自動選択）。`);
   }
   // An equip controlled by either player can be attached to the bounced monster.
   // Sweep both boards rather than only the opponent's backrow.
   if(moved){sweepOrphanEquips(s);}else log(s,`「${c.name}」：戻す相手モンスターがありません。`);
   return;
 }
 if(e.code==='destroyOpponentOnFlip'){
   // Snapshot instances: grave triggers must not cause newly summoned monsters to be destroyed.
   const foe=s.players[1-seat],limit=Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=3?e.amount:1;
   const victims=foe.monsters.map((m,i)=>m?{i,key:m.key,id:m.id}:null).filter(Boolean).slice(0,limit);
   if(!victims.length){log(s,`「${c.name}」：相手フィールドに対象がありません。`);return;}
   for(const {i,key,id} of victims){
     const current=foe.monsters[i];if(!current||current.key!==key||current.id!==id)continue;
     sendToGrave(foe,'monsters',i,s,true);
     log(s,`「${c.name}」のリバース効果：${CARD[id]?.name||'モンスター'}を破壊しました（自動選択）。`);
   }
   sweepOrphanEquips(s);return;
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
     if(CARD[opp.hand[i]]?.type===(e.discardType||'spell')){
       opp.grave.push(opp.hand.splice(i,1)[0]);spells++;
     }
   }
   log(s,`「${c.name}」のリバース効果：相手が${amount}枚ドローし、指定種類のカード${spells}枚を墓地へ送りました。`);
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
// A linked equip prevents only the linked monster from declaring a new attack.
// Derive permission directly from active cards; no extra turn flags needed.
// Linked attack locks are checked on demand; leaving the board or flipping the
// source face-down releases the lock without timers or end-turn callbacks.
export function isAttackLockedByMonster(s,item){
 if(!item||!Array.isArray(item.attackLockSources))return false;
 return item.attackLockSources.some(key=>Number.isInteger(key)&&s.players.some(p=>p.monsters.some(mon=>mon?.key===key&&mon.pos!=='set')));
}
export function isAttackSealedByEquip(s,seat,item){
 if(!item||item.key===undefined)return false;
 const suppressed=trapsSuppressed(s);
 return isAttackLockedByMonster(s,item)||s.players.some(p=>p?.backrow.some(eq=>eq&&!eq.faceDown&&eq.linkKey===item.key&&eq.linkOwner===seat&&
   (CARD[eq.id]?.ability?.operation==='preventEquipAttack'||(!suppressed&&['negateAndLockAttacker','negateWeakenAttacker'].includes(CARD[eq.id]?.ability?.operation)))));
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
 const suppressed=stat==='atk'&&trapsSuppressed(state);
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
   // Target-bound continuous trap: the -700 is derived from the live link only.
   // Unlike temporary monster.bonus, it stops instantly if the trap is removed.
   if(stat==='atk'&&!suppressed&&spell?.type==='trap'&&ab?.operation==='negateWeakenAttacker'&&
      slot.linkKey===item.key&&slot.linkOwner===seat)result-=ab.amount;
   if(spell?.type!=='spell'||!persistentSpell(spell)||ab?.when!=='continuous')continue;
   if(ab.operation!==plus&&ab.operation!==minus&&ab.operation!=='earthAura'&&ab.operation!=='lpRelativeEquip')continue;
   const kind=spellKind(spell);
   if(ab.operation==='earthAura'){
     // Shared field aura; legacy cards default to printed EARTH / DEF-400.
     if(kind==='field'&&normalizeAttribute(card.attribute)===normalizeAttribute(ab.attribute||'地'))result+=stat==='atk'?ab.amount:-(ab.defDecrease??400);
     continue;
   }
   let applies=false;
   // An equip without a valid monster link must NEVER behave like a field aura.
   // Old/imported rooms can contain incomplete link metadata.
   if(kind==='equip'){
     applies=Number.isInteger(slot.linkKey)&&Number.isInteger(item.key)&&
       slot.linkKey===item.key&&(slot.linkOwner??ownerSeat)===seat;
   }else if(kind==='field'||!slot.linkKey){
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
  const effect=c.monsterEffect;
  const multiplier=effect?.code==='doubleOriginalAtkEndDestroy'&&Number.isInteger(effect.multiplier)&&effect.multiplier>=2&&effect.multiplier<=4?effect.multiplier:2;
  const base=item.doubleOriginalAtkTurn===state?.turnNo?multiplier*c.atk:original;
 return Math.max(0,base+(item.bonus||0)+(Number.isSafeInteger(item.permanentAtkDelta)?Math.max(-5000,Math.min(5000,item.permanentAtkDelta)):0)+continuousStatBonus(item,state,seat,'atk'));
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
      const visible=enemy.monsters.filter(m=>m&&m.pos!=='set');
      const copied=e.selection==='highest'?visible.reduce((best,m)=>!best||CARD[m.id]?.atk>CARD[best.id]?.atk?m:best,null):visible[0];
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
      const count=e.count??1;let found=0;
      for(let i=0;i<count;i++){
        const at=p.deck.findIndex(matches);
        if(at<0)break;
        p.hand.push(p.deck.splice(at,1)[0]);found++;
      }
      log(s,`「${c.name}」：デッキから${found}枚を手札へ加えました（自動選択）。`);
      return;
    }
    case 'draw1':draw(p,1,s);break;
    case 'heal500':p.lp+=500;break;
    case 'burn500':enemy.lp=Math.max(0,enemy.lp-500);break;
    case 'atk500':item.bonus=(item.bonus||0)+500;break;
    case 'destroy1':
      assert(kind==='ignition'&&Number.isInteger(target)&&!!getMonster(s,1-seat,target),'破壊する相手モンスターを選択してください');
      sendToGrave(enemy,'monsters',target,s,true);break;
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
  if(CARD[item.id]?.isToken)return; // Tokens vanish when leaving the field.
  const owner=originalOwner(s,item,controller);
  if(summonKind(CARD[item.id])==='fusion')owner.extraDeck.push(item.id);
  else if(zone==='hand')owner.hand.push(item.id);
  else {owner.deck.push(item.id);owner.deck=shuffle(owner.deck);}
}
function sendToGrave(p,zone,index,s=null,destroyed=false) {
  const item=p[zone][index];
  if(!item)return;
  const owner=originalOwner(s,item,p);
  if(!CARD[item.id]?.isToken)owner.grave.push(item.id);p[zone][index]=null;
  if(zone==='monsters'&&item.key!==undefined)removeOrphanEquips(p);
  // Field-to-grave search resolves synchronously. Never create a pending
  // choice/chain or access the network; empty decks are a harmless no-op.
  if(zone!=='monsters'||!s||s.status!=='playing')return;
  const card=CARD[item.id],ab=card?.ability;
  if(ab&&((ab.when==='grave')||(destroyed&&ab.when==='destroyed'))){
   const seat=s.players.indexOf(owner);
   if(seat>=0)executeAbility(s,{seat,cardId:item.id,sourceMonsterKey:item.key},null);
   return;
  }
  const e=card?.monsterEffect;
  if(e?.kind!=='grave')return;
  if(e.code==='weakenOpponentOnGrave'){
    const enemy=s.players[1-s.players.indexOf(owner)];
    const target=enemy?.monsters?.find(m=>m&&m.pos!=='set');
    if(target){const amount=e.amount??500;target.permanentAtkDelta=Math.max(-5000,(target.permanentAtkDelta||0)-amount);log(s,`「${CARD[item.id].name}」：相手モンスターのATKを場を離れるまで${amount}下げました。`);}
    return;
  }
  if(e.code==='reviveMaterialOnDestroy'){
    if(!destroyed)return;
    for(let i=0;i<(e.count??1);i++){
      const slot=owner.monsters.indexOf(null);
      if(slot<0)break;
      const at=owner.grave.findIndex(id=>e.names.includes(CARD[id]?.name)&&summonKind(CARD[id])==='normal');
      if(at<0)break;
      const id=owner.grave.splice(at,1)[0];
      owner.monsters[slot]={key:++s.nextKey,id,ownerSeat:s.players.indexOf(owner),pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
      log(s,`「${CARD[item.id].name}」：墓地の「${CARD[id].name}」を特殊召喚しました。`);
    }
    return;
  }
  if(e.code!=='searchStatOnGrave')return;
  const at=owner.deck.findIndex(id=>{
    const c=CARD[id];return c?.type==='monster'&&summonKind(c)!=='fusion'&&c[e.stat]<=e.threshold&&
      (e.race===undefined||normalizeRace(c.race)===normalizeRace(e.race));
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
   // Equipment is destroyed if its linked monster is gone OR turns face-down.
   // Do not allow the same instance to regain an old equip when flipped up.
   if(!s.players[targetSeat]?.monsters.some(m=>m?.key===item.linkKey&&m.pos!=='set')){
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
     c.atk<=e.threshold&&normalizeAttribute(c.attribute)===normalizeAttribute(e.attribute)&&
     (e.race===undefined||normalizeRace(c.race)===normalizeRace(e.race));});
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
 for(let ownerSeat=0;ownerSeat<2;ownerSeat++)for(const equip of s.players[ownerSeat].backrow){
  const card=CARD[equip?.id];
  if(equip&&!equip.faceDown&&equip.linkKey===item.key&&(equip.linkOwner??ownerSeat)===seat&&
     card?.type==='spell'&&spellKind(card)==='equip'&&card.ability?.operation==='pierce')return true;
 }
 return false;
}
function resolveBattleDamageEffect(s,seat,item,damage){
 if(damage<=0||s.status!=='playing')return;
 const c=CARD[item?.id],ab=actionAbility(c);
 if(c?.subtype!=='effect'||ab?.when!=='battleDamage')return;
 // Only valid, player-only operations are admitted by card creation rules;
 // defend against malformed imported/legacy definitions as well.
 if(!(['draw','discardNewest','millFirstType'].includes(ab.operation)||ab.operation==='mill'&&ab.target==='opponent'&&!!ab.filter)||ab.before||ab.then||
    !['self','opponent'].includes(ab.target)||
    (ab.operation==='millFirstType'&&(ab.target!=='opponent'||ab.amount!==0||!['monster','spell','trap'].includes(ab.match))))return;
 const target=s.players[ab.target==='opponent'?1-seat:seat];
 const count=()=>['millFirstType','mill'].includes(ab.operation)?target.grave.length:target.hand.length;
 const before=count();
 executeAbility(s,{seat,cardId:item.id},null);
 const changed=Math.abs(count()-before);
 const result=ab.operation==='draw'?'ドロー':['millFirstType','mill'].includes(ab.operation)?'デッキから墓地へ送った':'手札から墓地へ送った';
 log(s,`「${c.name}」：戦闘ダメージ時の効果で${changed?`${changed}枚${result}`:'該当カードなし・処理なし'}。`);
}
// Pure eligibility check reused at activation and resolution. Does not store new state.
// A redirect is legal only for an attack against a monster that still exists,
// and only when a distinct legal defender remains. A direct attack is excluded.
// Automatically resolve one previously set summon trap. There is no waiting
// phase or newly persisted pending value; this preserves two-device progress.
function resolveSummonTrap(s,summonerSeat,slot,expectedKey){
 if(s.status!=='playing'||trapsSuppressed(s))return;
 const summoned=s.players[summonerSeat]?.monsters?.[slot];
 if(!summoned||summoned.pos==='set'||(expectedKey!==undefined&&summoned.key!==expectedKey))return;
 const defender=s.players[1-summonerSeat];
 for(let i=0;i<5;i++){
  const set=defender.backrow[i],c=set&&CARD[set.id],ab=actionAbility(c);
  // Only an armed, face-down trap can fire. A face-up imported/old
  // continuous entry must never be consumed as a summon reaction.
  if(!set||set.faceDown!==true||c?.type!=='trap'||ab?.when!=='summon'||
     ab.operation!=='destroyOnEnemySummon'||set.setTurn>=s.turnNo||
     effectiveAtk(summoned,s,summonerSeat)<ab.amount)continue;
  // Existing slot identity is checked once. No card can be replaced during
  // this synchronous action; all costs and triggers run in the usual pipeline.
  defender.backrow[i]=null;defender.grave.push(set.id);
  const name=CARD[summoned.id]?.name||'モンスター';
  sendToGrave(s.players[summonerSeat],'monsters',slot,s,true);
  log(s,`「${c.name}」を自動発動：${name}を破壊しました（召喚時のチェーンは省略）。`);
  break;
 }
}
export function redirectedAttackSlot(s,attack){
 if(!attack||!Number.isInteger(attack.target)||attack.target<0||attack.target>=5||![0,1].includes(attack.by))return -1;
 const defenders=s.players?.[1-attack.by]?.monsters;
 const current=defenders?.[attack.target];
 if(!current||(attack.targetKey!==undefined&&current.key!==attack.targetKey)||!isAttackTargetLegal(s,attack.by,attack.target))return -1;
 return defenders.findIndex((m,i)=>i!==attack.target&&m&&isAttackTargetLegal(s,attack.by,i));
}
// Magic Arm Shield: battle a different face-up monster on the attacker's side.
// A temporary change of controller is represented only in damage calculation;
// no card moves between persistent zones, and there is no extra UI prompt.
export function attackerAllySlot(s,seat,attack){
 if(!s||![0,1].includes(seat)||!attack||attack.by!==1-seat||
    !Number.isInteger(attack.attacker)||attack.attacker<0||attack.attacker>=5||
    !Number.isInteger(attack.target)||attack.target<0||attack.target>=5)return -1;
 const attacker=s.players[attack.by]?.monsters?.[attack.attacker];
 const original=s.players[seat]?.monsters?.[attack.target];
 if(!attacker||attacker.pos!=='atk'||
   (attack.attackerKey!==undefined&&attacker.key!==attack.attackerKey)||
   !original||(attack.targetKey!==undefined&&original.key!==attack.targetKey)||
   !isAttackTargetLegal(s,attack.by,attack.target))return -1;
 return s.players[attack.by].monsters.findIndex((m,i)=>i!==attack.attacker&&m&&m.pos!=='set'&&Number.isInteger(m.key));
}
// A read-only legality query shared with touch UI. Never changes duel state,
// opens a wait screen, or needs additional Firebase fields. It prevents invalid
// attack-trap buttons (e.g. direct attack cannot be redirected or concealed).
export function canActivateAttackTrap(s,seat,index){
 if(!s||s.status!=='playing'||![0,1].includes(seat)||!Number.isInteger(index)||index<0||index>=5||trapsSuppressed(s))return false;
 const pending=s.pending;
 const attack=pending?.kind==='attack'?pending:pending?.kind==='chain'?pending.afterAttack:null;
 if(!attack||pending.kind==='attack'&&attack.by!==1-seat||pending.kind==='chain'&&pending.priority!==seat)return false;
 const slot=s.players?.[seat]?.backrow?.[index],card=CARD[slot?.id],ab=actionAbility(card);
 if(!slot||slot.faceDown!==true||slot.setTurn>=s.turnNo||card?.type!=='trap'||ab?.when!=='attack')return false;
 const monster=s.players?.[attack.by]?.monsters?.[attack.attacker];
 if(!monster||monster.pos!=='atk'||(attack.attackerKey!==undefined&&monster.key!==attack.attackerKey))return false;
 if((ab.filter?.fieldPosition||ab.filter&&MOVE_COUNT_BACKROW.includes(ab.operation))&&!hasFieldPositionTarget(s,seat,ab))return false;
 if(ab.target==='attacker'&&isDragonEffectTargetBlocked(s,seat,attack.by,attack.attacker))return false;
 if(ab.operation==='redirectAttack')return redirectedAttackSlot(s,attack)>=0;
 if(ab.operation==='redirectToAttackerAlly')return attackerAllySlot(s,seat,attack)>=0;
 if(ab.operation==='concealDefender')return !pending.attackNegated&&!pending.attackInterrupted&&concealDefenderSlot(s,seat,attack)>=0;
 if(ab.operation==='diceStats')return s.players[ab.target==='ownAllMonsters'?seat:1-seat].monsters.some(m=>m&&m.pos!=='set');
 // These reactions require an attack that has not yet been canceled.
 // Preserve existing attacker-side counter-chain compatibility; no new state.
 if(ab.operation==='negateEndBattle'||ab.operation==='blastAttacker'||
    (ab.operation==='destroy'&&ab.target==='enemyAttackMonsters')){
   if(pending.attackNegated||pending.attackInterrupted)return false;
 }
 // A canceled attack has no damage left to reflect; don't offer an inert Cylinder.
 if(ab.operation==='reflectAttack'&&(pending.attackNegated||pending.attackInterrupted))return false;
 return true;
}
// Magical Hats (simplified): the currently declared defender must be
// the same face-up card when activated / resolved. No extra summoned tokens.
export function concealDefenderSlot(s,seat,attack){
 if(![0,1].includes(seat)||!attack||attack.by!==1-seat||
    !Number.isInteger(attack.attacker)||attack.attacker<0||attack.attacker>=5||
    !Number.isInteger(attack.target)||attack.target<0||attack.target>=5)return -1;
 const attacker=s?.players?.[attack.by]?.monsters?.[attack.attacker];
 const defender=s?.players?.[seat]?.monsters?.[attack.target];
 if(!attacker||attacker.pos!=='atk'||(attack.attackerKey!==undefined&&attacker.key!==attack.attackerKey)||
    !defender||defender.pos==='set'||(attack.targetKey!==undefined&&defender.key!==attack.targetKey)||
    !isAttackTargetLegal(s,attack.by,attack.target))return -1;
 return attack.target;
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
    sendToGrave(player,'monsters',index,s,true);
  };
  if(a.redirectAlly){
    const {slot,key}=a.redirectAlly;
    const ally=Number.isInteger(slot)&&slot>=0&&slot<5?atkP.monsters[slot]:null;
    if(!ally||slot===a.attacker||ally.pos==='set'||ally.key!==key||
       !defP.monsters[a.target]||(a.targetKey!==undefined&&defP.monsters[a.target].key!==a.targetKey)){
      log(s,'新しい攻撃対象がいなくなったため攻撃を終了しました。');s.pending=null;return;
    }
    const name=CARD[ally.id]?.name||'モンスター';
    const attackerAtk=combatAtk(attacker,s,a.by,ally);
    const allyInAttack=ally.pos==='atk';
    const allyPower=allyInAttack?combatAtk(ally,s,a.by,attacker):effectiveDef(ally,s,a.by);
    if(attackerAtk>allyPower){
      if(!protectedFromBattle(ally,s,a.by,attacker))destroyedInBattle(atkP,slot);
      if(allyInAttack||hasPiercingEquip(s,attacker,a.by)){
       dealtDamage=a.preventBattleDamageSeat===1-a.by?0:attackerAtk-allyPower;
       defP.lp=Math.max(0,defP.lp-dealtDamage);
      }
    }else if(attackerAtk<allyPower){
      if(allyInAttack&&!rocketAssault&&!protectedFromBattle(attacker,s,a.by,ally))destroyedInBattle(atkP,a.attacker);
      if(!rocketAssault){
       dealtDamage=a.preventBattleDamageSeat===a.by?0:allyPower-attackerAtk;
       atkP.lp=Math.max(0,atkP.lp-dealtDamage);
       damageSourceSeat=1-a.by;damageSource=ally;
      }
    }else if(allyInAttack&&attackerAtk>0){
      if(!rocketAssault&&!protectedFromBattle(attacker,s,a.by,ally))destroyedInBattle(atkP,a.attacker);
      if(!protectedFromBattle(ally,s,a.by,attacker))destroyedInBattle(atkP,slot);
    }
    log(s,`マジックアーム・シールド：攻撃対象を${name}へ変更して戦闘処理しました（コントロール移動は省略）。`);
  }else if(a.target===-1 || a.target===null) {
    if(!canDirectAttackWithMonsters(s,a.by,attacker)) {log(s,'相手のモンスターがいるため直接攻撃できません。');}
    else{dealtDamage=a.preventBattleDamageSeat===1-a.by?0:directAtk;defP.lp=Math.max(0,defP.lp-dealtDamage);log(s,`${atkP.name} の直接攻撃！ ${defP.name} に${dealtDamage}ダメージ。`);}
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
        dealtDamage=a.preventBattleDamageSeat===1-a.by?0:atk-power;defP.lp=Math.max(0,defP.lp-dealtDamage);
        if(!isAtk)log(s,`貫通ダメージ ${dealtDamage} を与えました。`);
      }
      log(s,survives?`${dc.name} は戦闘では破壊されません。${isAtk?` ${dealtDamage}ダメージ。`:''}`:
        `${mustCard(attacker.id).name} が ${dc.name} を破壊！${isAtk?` ${dealtDamage}ダメージ。`:''}`);
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
      const amount=CARD[attacker.id]?.monsterEffect?.amount??500;
      stillThere.bonus=(stillThere.bonus||0)-amount;
      log(s,`「${CARD[attacker.id].name}」：${dc.name}の攻撃力をターン終了まで${amount}下げました。`);
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
// Pure, no-wait eligibility shared between spell buttons and the engine.
// Checks the four reusable historic recipes that otherwise lead to an empty
// target/cost picker. Never uses card names or new serialized state fields.
// A single eligibility predicate for the existing cost picker and payment.
export function eligibleFilteredCost(cost,item){
 if(!item)return false;
 if(!cost?.filter)return true;
 const zone=BEFORE_META[cost.operation]?.zone;
 if(zone==='monsters')return item.pos!=='set'&&!CARD[item.id]?.isToken&&matchesFieldFilter(item,cost.filter);
 if(zone==='backrow')return item.faceDown===false&&matchesDeckFilter(CARD[item.id],cost.filter);
 if(zone==='hand'||zone==='grave')return matchesDeckFilter(CARD[item],cost.filter)&&!CARD[item]?.isToken;
 return false;
}
function hasFilteredCost(s,seat,ab,source=null){
 const cost=ab?.before;if(ab?.requirement&&cost?.operation==='payLP')return s.players[seat].lp>cost.amount;
 if(!cost?.filter)return true;
 const zone=BEFORE_META[cost.operation]?.zone,p=s.players[seat];
 let count=0;
 for(const [index,item] of (p[zone]||[]).entries()){
  if(source?.zone===zone&&source.index===index)continue;
  if(eligibleFilteredCost(cost,item)&&++count>=cost.amount)break;
 }
 return count>=cost.amount&&(ab.operation!=='draw'||s.players[ab.target==='opponent'?1-seat:seat].deck.length>=ab.amount);
}
function countForCondition(s,seat,r){
 if(r.zone==='ownLP')return s.players[seat].lp;
 if(r.zone==='enemyLP')return s.players[1-seat].lp;
 if(r.zone==='relativeLP')return s.players[seat].lp-s.players[1-seat].lp;
 const sides=r.zone.startsWith('both')?[seat,1-seat]:[r.zone.startsWith('enemy')?1-seat:seat];
 let count=0;
 for(const side of sides){const p=s.players[side];
  if(r.zone.endsWith('Field')){for(const m of p.monsters){if(m&&(r.kind==='all'||r.kind==='faceup'&&m.pos!=='set'||m.pos===r.kind)&&(!r.filter||m.pos!=='set'&&matchesDeckFilter(CARD[m.id],r.filter)))count++;}}
  else if(r.zone.endsWith('Backrow')){for(const item of p.backrow){if(!item)continue;if(r.kind==='all'||r.kind==='set'&&item.faceDown===true||item.faceDown===false&&(r.kind==='faceup'||CARD[item.id]?.type===r.kind))count++;}}
  else if(r.zone.endsWith('Hand'))count+=p.hand.length;
  else if(r.zone.endsWith('Deck'))count+=p.deck.length;
  else{for(const id of (r.zone.endsWith('Banished')?p.banished:p.grave)){if((r.kind==='all'||CARD[id]?.type===r.kind)&&(!r.filter||matchesDeckFilter(CARD[id],r.filter)))count++;}}
 }
 return count;
}
function conditionSatisfied(s,seat,r){
 if(!r)return true;
 const n=countForCondition(s,seat,r);
 return r.comparison==='atLeast'?n>=r.count:r.comparison==='atMost'?n<=r.count:n===r.count;
}
function allConditionsSatisfied(s,seat,ab){return ab.requirementMode==='or'?conditionSatisfied(s,seat,ab.requirement)||conditionSatisfied(s,seat,ab.requirement2):conditionSatisfied(s,seat,ab.requirement)&&conditionSatisfied(s,seat,ab.requirement2);}
function meetsCountRequirement(s,seat,ab){
 if(!ab?.requirement||ab.operation==='conditionBranch')return true;
 // Only activation eligibility is checked; later chain links may change the board.
 return allConditionsSatisfied(s,seat,ab)&&(ab.operation!=='draw'||s.players[ab.target==='opponent'?1-seat:seat].deck.length>=ab.amount);
}
export function canOfferSpell(s,seat,card,source='hand'){
 if(!s||![0,1].includes(seat)||card?.type!=='spell')return false;
 const p=s.players?.[seat],enemy=s.players?.[1-seat],ab=actionAbility(card);
 if(!p||!enemy)return false;
 if(!ab)return true; // Ritual/fusion spells have separate, already validated UI paths.
 const op=ab.operation;
 if(!meetsCountRequirement(s,seat,ab)||!hasFilteredCost(s,seat,ab,source==='hand'?{zone:'hand',index:p.hand.indexOf(card.id)}:null))return false;
 if((ab.filter?.fieldPosition||ab.filter&&MOVE_COUNT_BACKROW.includes(ab.operation))&&!hasFieldPositionTarget(s,seat,ab))return false;
 if(op==='summonSheepTokens')return p.monsters.filter(m=>m===null).length>=ab.amount&&
   (s.turn!==seat||!p.normalUsed);
 if(op==='summonKuribohTokens')return p.monsters.some(m=>m&&m.pos!=='set'&&!CARD[m.id]?.isToken&&CARD[m.id]?.name==='クリボー');
 if(op==='summonMonsterHand')return canSummonFilteredHand(s,seat,ab);
 if(['banishOwnHand','returnOwnHandToDeck'].includes(op))return canMoveFilteredHand(p,ab,source==='hand'?card.id:null);
 if(op==='summonRaceFromHand')return canSummonRaceFromHand(s,seat,ab);
 // Four historic spell recipes use only existing board/grave information.
 // The same read-only checks apply to custom cards with matching abilities.
 if(op==='removeSpellBackrow'&&ab.target==='enemyBackrow')
   return enemy.backrow.some(item=>item&&(item.faceDown||CARD[item.id]?.type==='spell'));
 if(op==='destroyBackrow'&&ab.target==='enemyBackrow')
   return enemy.backrow.some(Boolean);
 // Hurricane-style full-field bounce has no targets on an empty board.
 // UI and dispatch share this read-only check even for user-made cards.
 if(op==='returnBackrow'&&ab.target==='bothAllBackrow')
   return s.players.some(side=>side.field||side.backrow.some(Boolean));
 if(op==='destroy'&&ab.target==='bothMonsters')
   return s.players.some(side=>side.monsters.some(Boolean));
 // Shared Yugi/Joey/Kaiba/Pegasus recipes use the same preflight in UI and engine.
 if(op==='reviveSelected'&&ab.target==='eitherGraveMonster')
   return p.monsters.some(m=>m===null)&&s.players.some(side=>side.grave.some(id=>CARD[id]?.type==='monster'));
 if(op==='destroy'&&ab.target==='enemyLowestAtk')
   return enemy.monsters.some(m=>m&&m.pos!=='set');
 if(op==='searchNamed'&&ab.match==='exact'&&typeof ab.query==='string'&&ab.query.length)
   return p.deck.some(id=>CARD[id]?.name===ab.query);
 if(op==='draw'&&ab.target==='self'&&!ab.then)
   return p.deck.length>=ab.amount;
 if(op==='reviveBothSet')return canReviveBothSet(s);
 // Four historical recipes: visibility follows the same no-wait preconditions
 // that the engine uses, independent of a card's printed name.
 if(op==='replaceHands'){
   const ownCount=p.hand.length-(source==='hand'?1:0);
   return ownCount+enemy.hand.length>0&&p.deck.length>=ownCount&&enemy.deck.length>=enemy.hand.length;
 }
 if(op==='graveRevive'&&(ab.filter||ab.before?.operation==='payLP')){
   const recipient=ab.target==='opponent'?enemy:p;
   return (ab.before?.operation!=='payLP'||p.lp>ab.before.amount)&&recipient.monsters.some(m=>m===null)&&
     recipient.grave.some(id=>matchesDeckFilter(CARD[id],ab.filter));
 }
 if(spellKind(card)==='equip'&&op==='lpRelativeEquip'&&ab.target==='ownMonster')
   return p.monsters.some((m,i)=>m&&m.pos!=='set'&&!isDragonEffectTargetBlocked(s,seat,seat,i))&&
     (source!=='hand'||p.backrow.some(item=>item===null));
 // Reuse the exact declarative abilities for the four new recipes. Check only
 // state already in the room; no extra target picker or waiting phase is needed.
 if(op==='draw'&&ab.target==='self'&&ab.then?.operation==='discardNewest')
   return p.deck.length>=ab.amount;
 if(op==='destroyGiveOwn'&&ab.target==='enemyMonster')
   return p.monsters.some(Boolean)&&enemy.monsters.some((m,i)=>m&&!isDragonEffectTargetBlocked(s,seat,1-seat,i));
 if(op==='swapPrintedStats'&&ab.target==='bothMonsters')
   return s.players.some(side=>side.monsters.some(m=>m&&m.pos!=='set'));
 if(spellKind(card)==='equip'&&op==='pierce'&&ab.target==='ownMonster')
   return p.monsters.some((m,i)=>m&&m.pos!=='set'&&!isDragonEffectTargetBlocked(s,seat,seat,i))&&
     (source!=='hand'||p.backrow.some(item=>item===null));
 if(op==='destroy'&&ab.target==='enemyMonster'&&ab.before?.operation==='discardOwnHand'){
   const available=p.hand.length-(source==='hand'?1:0);
   return available>=ab.before.amount&&enemy.monsters.some((m,i)=>m&&!isDragonEffectTargetBlocked(s,seat,1-seat,i));
 }
 if(spellKind(card)==='equip'&&ab.operation==='boost'&&ab.target==='ownMonster')
   return p.monsters.some((m,i)=>m&&m.pos!=='set'&&!isDragonEffectTargetBlocked(s,seat,seat,i))&&
     (source!=='hand'||p.backrow.some(item=>item===null));
 return true;
}
function canReviveBothSet(s){
 return s.players.every(p=>p.monsters.some(m=>m===null)&&p.grave.some(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='normal'));
}
// Read-only eligibility for monster ignition effects. Reuses the current
// in-room state; there are no pending windows, timers or network fields.
// It also applies to user cards copied from the built-in effect templates.
export function canOfferMonsterIgnition(s,seat,index){
 if(!s||s.status!=='playing'||![0,1].includes(seat)||s.turn!==seat||
    !['main1','main2'].includes(s.phase)||s.pending||
    !Number.isInteger(index)||index<0||index>=5)return false;
 const p=s.players?.[seat],m=p?.monsters?.[index],c=CARD[m?.id];
 if(!m||m.pos==='set'||c?.subtype!=='effect'||
    (c.ability?.when!=='main'&&c.monsterEffect?.kind!=='ignition')||
    (m.effectLockedUntil||0)>=s.turnNo||m.effectUsedTurn===s.turnNo)return false;
 const ab=actionAbility(c);
 if(!meetsCountRequirement(s,seat,ab)||!hasFilteredCost(s,seat,ab,{zone:'monsters',index}))return false;
 if((ab?.filter?.fieldPosition||ab?.filter&&MOVE_COUNT_BACKROW.includes(ab.operation))&&!hasFieldPositionTarget(s,seat,ab))return false;
 if(ab?.operation==='summonMonsterHand')return canSummonFilteredHand(s,seat,ab);
 if(['banishOwnHand','returnOwnHandToDeck'].includes(ab?.operation))return canMoveFilteredHand(p,ab);
 if(ab?.operation==='summonNamedFromHand')return canSummonNamedFromHand(p,ab);
 if(ab?.operation==='fusionFromExtraPay5000')return p.lp>(c.monsterEffect?.cost??5000)&&
   p.monsters.some(x=>x===null)&&p.extraDeck.some(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='fusion');
 return true;
}
function canSummonFilteredHand(s,seat,ab){
 const p=s.players[seat];
 return p.sheepLockTurn!==s.turnNo&&p.monsters.includes(null)&&p.hand.some(id=>eligibleHandSummon(id,ab.filter));
}
function eligibleHandMove(id,filter){
 const c=CARD[id];if(!c||c.isToken)return false;
 return !filter||Object.keys(filter).every(k=>k==='deckPlacement')||matchesDeckFilter(c,filter);
}
function canMoveFilteredHand(p,ab,sourceId=null){
 // Ignore one occurrence of the activating spell; duplicate copies remain eligible.
 let skip=sourceId;for(const id of p.hand){if(skip!==null&&id===skip){skip=null;continue;}if(eligibleHandMove(id,ab.filter))return true;}return false;
}
function eligibleHandSummon(id,filter){const c=CARD[id];return c?.type==='monster'&&!c.isToken&&summonKind(c)==='normal'&&matchesDeckFilter(c,filter);}
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
  if(before.filter)assert(zone==='grave'&&hasFilteredCost(s,seat,ab),'条件に一致する墓地コストが足りません');
  const removed=before.filter?takeFilteredCards(p.grave,qty,before.filter,true):zone==='deck'?p.deck.splice(0,qty):p.grave.splice(-qty,qty);
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
   !(source?.zone===zone&&source.index===i)&&(!before.filter||eligibleFilteredCost(before,p[zone][i]))),
 'Aに使うカードを指定数選んでください');
 if(before.filter)assert(hasFilteredCost(s,seat,ab,source),'条件に一致するコストまたはドローに必要なカードが足りません');
 // A must not remove B's explicitly selected single target. Without this
 // check a later chained summon at the same slot could be hit incorrectly.
 if((zone==='monsters'&&ab.target==='ownMonster'||zone==='backrow'&&ab.target==='ownBackrow')&&indices.includes(target))
   fail('AでBの対象を取り除くことはできません');
 if(ab.operation==='crushVirus'){
  const sacrifice=p.monsters[indices[0]];
  assert(sacrifice&&sacrifice.pos!=='set'&&normalizeAttribute(CARD[sacrifice.id]?.attribute)==='闇'&&
    effectiveAtk(sacrifice,s,seat)<=1000,'闇属性・ATK1000以下の表側モンスター1体を選んでください');
 }
 const sorted=[...indices].sort((a,b)=>b-a);
 const chosen=before.filter&&zone==='monsters'?new Map(indices.map(i=>[i,p.monsters[i]])):null;
 const shifted=source?.zone==='hand'?indices.filter(i=>i<source.index).length:0;
 for(const i of sorted){
  if(zone==='monsters'){
   const item=p.monsters[i];
   if(chosen)assert(item===chosen.get(i)&&eligibleFilteredCost(before,item),'コスト選択後に対象が変化しました');
   if(before.operation==='sendOwnMonsterGrave')sendToGrave(p,'monsters',i,s);
   else if(before.operation==='banishOwnMonster'){
    if(!CARD[item.id]?.isToken)originalOwner(s,item,p).banished.push(item.id);p.monsters[i]=null;
   }else{
    returnMonsterToOwner(s,item,p,before.operation==='returnOwnMonsterHand'?'hand':'deck');
    p.monsters[i]=null;
   }
  }else if(zone==='backrow'){
   const [item]=p.backrow.splice(i,1);
   p.backrow.splice(i,0,null);
   const owner=before.filter?originalOwner(s,item,p):p;
   (before.operation==='sendOwnBackrowGrave'?owner.grave:owner.banished).push(item.id);
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
// If the opposing controller has a face-up Dragon Lord, the effect cannot
// select a Dragon on either side of the board. This checks the current state,
// so summoning/removing the Lord takes effect without counters or timers.
export function isDragonEffectTargetBlocked(s,casterSeat,targetSeat,index){
 if(![0,1].includes(casterSeat)||![0,1].includes(targetSeat)||!Number.isInteger(index)||index<0||index>=5)return false;
 const victim=s?.players?.[targetSeat]?.monsters?.[index];
 if(!victim)return false;
 const race=normalizeRace(CARD[victim.id]?.race);
 return !!s.players[1-casterSeat]?.monsters?.some(m=>m&&m.pos!=='set'&&
   CARD[m.id]?.monsterEffect?.kind==='continuous'&&CARD[m.id].monsterEffect.code==='dragonTargetGuard'&&
   normalizeRace(CARD[m.id].monsterEffect.race||'ドラゴン')===race);
}
function abilityTargetCheck(s,seat,ab,target,sourceIndex){
 if(!ab)fail('効果の定義がありません');
 const choices={ownMonster:seat,enemyMonster:1-seat,ownBackrow:seat,enemyBackrow:1-seat};
 if(Object.hasOwn(choices,ab.target)){
  if(ab.when==='continuous'&&sourceIndex!==undefined)return;
  const side=choices[ab.target],zone=ab.target.endsWith('Backrow')?'backrow':'monsters';
  assert(Number.isInteger(target)&&target>=0&&target<5&&s.players[side][zone][target],
    zone==='monsters'?'対象モンスターを選んでください':'対象の魔法・罠を選んでください');
  if(zone==='monsters')assert(!isDragonEffectTargetBlocked(s,seat,side,target),`${normalizeRace(CARD[s.players[side].monsters[target].id]?.race)}族を効果の対象にできません`);
  // Magic Removal may inspect a set Spell/Trap, but cannot target a face-up Trap.
  if(ab.operation==='removeSpellBackrow'){
   const item=s.players[side].backrow[target];
   assert(item.faceDown||CARD[item.id]?.type==='spell','表側の罠カードは対象にできません');
  }
  if(ab.operation==='banishSetBackrow'){
   assert(s.players[side].backrow[target].faceDown===true,'セットされた魔法・罠だけを対象にできます');
  }
 }
 if(ab.target==='enemyFaceDownMonster'){
  assert(s.players[1-seat].monsters.some(m=>m?.pos==='set'),'相手に裏側守備表示のモンスターがありません');
 }
 if(ab.target==='eitherGraveMonster'){
  assert(s.players[seat].monsters.some(m=>m===null),'自分のモンスターゾーンに空きがありません');
  assert(target&&typeof target==='object'&&!Array.isArray(target)&&
    (target.seat===0||target.seat===1)&&Number.isInteger(target.index)&&
    typeof target.cardId==='string','蘇生する墓地のモンスターを指定してください');
  const targetId=s.players[target.seat].grave[target.index];
  assert(typeof target.cardId==='string'&&targetId===target.cardId&&CARD[targetId]?.type==='monster','墓地の対象を確認してください');
 }
 if(ab.target==='attacker'){
  const attack=s.pending?.kind==='attack'?s.pending:s.pending?.afterAttack;
  assert(attack,'攻撃中のみ選べます');
  assert(!isDragonEffectTargetBlocked(s,seat,attack.by,attack.attacker),`${normalizeRace(CARD[s.players[attack.by].monsters[attack.attacker]?.id]?.race)}族を効果の対象にできません`);
 }
}
function matchesFieldFilter(m,filter){
 if(!m)return false;
 if(!filter)return true;
 if(m.pos==='set')return filter.fieldPosition==='set'; // validation prohibits private selectors for set targets
 if(filter.fieldPosition==='set'||(['atk','def'].includes(filter.fieldPosition)&&m.pos!==filter.fieldPosition))return false;
 return matchesDeckFilter(CARD[m.id],filter);
}
function matchesBackrowFilter(item,f){
 if(!item||f.fieldPosition==='faceup'&&item.faceDown||f.fieldPosition==='set'&&!item.faceDown)return false;
 if(f.cardType||f.spellKind||f.nameContains){
  if(item.faceDown)return false;
  const c=CARD[item.id];return !!c&&(!f.cardType||c.type===f.cardType)&&(!f.spellKind||spellKind(c)===f.spellKind)&&(!f.nameContains||c.name.includes(f.nameContains));
 }return true;
}
function hasFieldPositionTarget(s,seat,ab){
 if(MOVE_COUNT_BACKROW.includes(ab.operation)){
  const sides=ab.target==='ownAllBackrow'?[seat]:ab.target==='enemyAllBackrow'?[1-seat]:[seat,1-seat];
  return sides.some(side=>s.players[side].backrow.some(item=>matchesBackrowFilter(item,ab.filter))||ab.target==='bothAllBackrow'&&matchesBackrowFilter(s.players[side].field,ab.filter));
 }
 const sides=ab.target==='ownAllMonsters'?[seat]:ab.target==='bothMonsters'?[seat,1-seat]:[1-seat];
 return sides.some(side=>s.players[side].monsters.some(m=>m&&(ab.target!=='enemyAttackMonsters'||m.pos==='atk')&&matchesFieldFilter(m,ab.filter)));
}
function abilityMonsterRefs(s,seat,target,index,chain,targetMonsterKey,filter=null){
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
  return i===-1?[]:one(1-seat,i); // one() also verifies the activation-time card identity.
 }
 if(target==='ownMonster')return isDragonEffectTargetBlocked(s,seat,seat,index)?[]:one(seat,index);
 if(target==='enemyMonster')return isDragonEffectTargetBlocked(s,seat,1-seat,index)?[]:one(1-seat,index);
 if(target==='attacker'){
  const a=chain?.afterAttack||(s.pending?.kind==='attack'?s.pending:null);
  return a&&!isDragonEffectTargetBlocked(s,seat,a.by,a.attacker)?one(a.by,a.attacker):[];
 }
 const sides=target==='ownAllMonsters'?[seat]:['enemyAllMonsters','enemyAttackMonsters'].includes(target)?[1-seat]:target==='bothMonsters'?[seat,1-seat]:[];
 let refs=sides.flatMap(side=>s.players[side].monsters.flatMap((m,i)=>{
  if(!m||(target==='enemyAttackMonsters'&&m.pos!=='atk')||!matchesFieldFilter(m,filter))return [];
  return [{side,index:i}];
 }));
 if(filter?.maxCount!==undefined){
  const order=filter.order;
  if(order&&order!=='left'){
   const stat=order.startsWith('atk')?'atk':'def',direction=order.endsWith('High')?-1:1;
   const value=ref=>CARD[s.players[ref.side].monsters[ref.index].id]?.[stat]??0;
   refs.sort((a,b)=>direction*(value(a)-value(b))); // stable sort retains side/left order on ties
  }
  refs=refs.slice(0,filter.maxCount);
 }
 return refs.map(ref=>{const m=s.players[ref.side].monsters[ref.index];
  if(!Number.isInteger(m.key))m.key=++s.nextKey; // Snapshot only the selected instances.
  return {...ref,key:m.key};
 });
}
function abilityBackrowRefs(s,seat,target,index,identityKey){
 const one=(side,at)=>{
  const item=Number.isInteger(at)&&at>=0&&at<5?s.players[side].backrow[at]:null;
  return item&&(identityKey===undefined||item.key===identityKey)?[{side,index:at,key:item.key}]:[];
 };
 if(target==='ownBackrow')return one(seat,index);
 if(target==='enemyBackrow')return one(1-seat,index);
 const sides=target==='ownAllBackrow'?[seat]:target==='enemyAllBackrow'?[1-seat]:target==='bothAllBackrow'?[seat,1-seat]:[];
 // A bulk spell snapshots the instances present at the start of resolution.
 // Keys are assigned only to legacy keyless entries.  If another effect ever
 // replaces a slot during this loop, that replacement must not be touched.
 const ref=(side,index,item)=>{
  if(!Number.isInteger(item.key))item.key=++s.nextKey;
  return {side,index,key:item.key};
 };
 return sides.flatMap(side=>[...s.players[side].backrow.flatMap((item,i)=>item?[ref(side,i,item)]:[]),
  ...(target==='bothAllBackrow'&&s.players[side].field?[ref(side,-1,s.players[side].field)]:[])]);
}
function summonDefenseTokens(s,seat,tokenId,count){
 const p=s.players[seat];
 const spaces=p.monsters.filter(m=>m===null).length;
 const quantity=Math.min(count,spaces);
 for(let n=0;n<quantity;n++){
  const at=p.monsters.indexOf(null);
  p.monsters[at]={key:++s.nextKey,id:tokenId,ownerSeat:seat,pos:'def',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
 }
 return quantity;
}
// No new random state: the outcome is a pure function of the current, already
// synchronized duel state and the source card. Two clients/replays agree exactly.
export function deterministicDice(s,seat,cardId){
 let hash=2166136261;for(const ch of String(cardId||'')){hash=Math.imul(hash^ch.codePointAt(0),16777619)>>>0;}
 let n=(hash^Math.imul(s.turnNo||1,0x9e3779b1)^Math.imul((s.revision||0)+1,0x85ebca6b)^Math.imul(seat+1,0xc2b2ae35))>>>0;
 n^=n>>>16;n=Math.imul(n,0x7feb352d)>>>0;n^=n>>>15;n=Math.imul(n,0x846ca68b)>>>0;n^=n>>>16;
 return 1+((n>>>0)%6);
}
function banishMatchingDeckCards(s,name,reason){
 let total=0;
 for(const player of s.players){
  for(let i=player.deck.length-1;i>=0;i--){
   if(CARD[player.deck[i]]?.name!==name)continue;
   player.banished.push(player.deck.splice(i,1)[0]);total++;
  }
 }
 if(total)log(s,`${reason}：双方のデッキから同名カード${total}枚を除外しました。`);
}
// Deterministic, bounded zone selection. Unfiltered legacy ordering is preserved.
function takeFilteredCards(zone,qty,filter,newest=false){
 const picked=[];
 for(let i=0;i<qty;i++){
  const at=newest?zone.findLastIndex(id=>matchesDeckFilter(CARD[id],filter)):zone.findIndex(id=>matchesDeckFilter(CARD[id],filter));
  if(at<0)break; picked.push(zone.splice(at,1)[0]);
 }
 return picked;
}
// For branch follow-ups measure the source that the first automatic operation changes.
// No whole-player serialization or new room field is needed for these branches.
const BRANCH_PROGRESS={heal:'lp',damage:'lp',searchMonster:'deck',searchSpell:'deck',searchTrap:'deck',mill:'deck',banishDeck:'deck',discardNewest:'hand',banishOwnHand:'hand',returnOwnHandToDeck:'hand',graveRecover:'grave',graveBanish:'grave',graveRecycle:'grave',banishedRecover:'banished'};
function branchProgress(s,seat,ab){
 const p=s.players[ab.target==='opponent'?1-seat:seat],key=BRANCH_PROGRESS[ab.operation];
 return key==='lp'?p.lp:p[key].length;
}
function executeAbility(s,entry,chain,stageOverride=null,branchStage=false,previousMoved=0,previousDestroyedStat=0){
 const seat=entry.seat,p=s.players[seat],card=mustCard(entry.cardId);
 let ab=stageOverride||actionAbility(card);if(!ab)return;
 // Resolve once per stage, using only current synchronized state. No mutation of card definitions.
 if(ab.scale){
   const fromPrintedPercent=['previousDestroyedAtk','previousDestroyedDef','previousMovedAtk','previousMovedDef'].includes(ab.scale.zone);
   const fromPrintedLevel=['previousDestroyedLevel','previousMovedLevel'].includes(ab.scale.zone);
   const base=fromPrintedPercent||fromPrintedLevel?previousDestroyedStat:ab.scale.zone==='previousMoved'?previousMoved:countForCondition(s,seat,ab.scale);
   const independent=ab.operation==='changeStats';
   const calc=n=>Math.min(ABILITY_META[ab.operation].max,independent?Math.max(-10000,fromPrintedPercent?Math.trunc(base*n/100):base*n):fromPrintedPercent?Math.floor(base*n/100):base*n);
   const qty=calc(ab.amount),defAmount=independent?calc(ab.defAmount):undefined;
   if(qty===0&&(!independent||defAmount===0)){log(s,`「${card.name}」：計算した効果値が0のため不発。`);return;}
   log(s,`「${card.name}」：計算した効果値 ${qty}${independent?' / DEF '+defAmount:''}。`);
   ab={...ab,amount:qty,...(independent?{defAmount}:{})};
 }
 // For draw-and-follow-up, a successful draw is identified by its hand-size
 // delta. Avoid serializing both players' entire state before and after each
 // activation (especially large decks). Other custom composite recipes retain
 // the existing generic compatibility path.
 const drawThenSeat=ab.then&&ab.operation==='draw'&&['self','opponent'].includes(ab.target)
   ?(ab.target==='opponent'?1-seat:seat):null;
 const handBeforeDraw=drawThenSeat===null?null:s.players[drawThenSeat].hand.length;
 const printedZone=ab.then?.scale?.zone;
 const printedStatKey=['previousDestroyedAtk','previousMovedAtk'].includes(printedZone)?'atk':['previousDestroyedDef','previousMovedDef'].includes(printedZone)?'def':['previousDestroyedLevel','previousMovedLevel'].includes(printedZone)?'level':null;
 const atkMeasure=!!printedStatKey&&MOVE_COUNT_FIELD.includes(ab.operation)&&canCountPreviousMove(ab);
 const moveMeasure=ab.then?.scale?.zone==='previousMoved'&&canCountPreviousMove(ab);
 let destroyedStat=0;
 const summonMeasure=!!(ab.then&&COUNT_SUMMON_OPERATIONS.includes(ab.operation)&&(branchStage||moveMeasure||ab.operation==='summonMonsterDeck'));
 const combinedStats=['boostBoth','weakenBoth','changeStats'].includes(ab.operation);
 const statMeasure=combinedStats&&!!ab.then;
 let changedStats=0;
 const fieldMeasure=summonMeasure||!!((branchStage&&ab.then||moveMeasure||atkMeasure)&&(MOVE_COUNT_FIELD.includes(ab.operation)||MOVE_COUNT_BACKROW.includes(ab.operation)));
 let moved=0;
 // New automatic deck-return stages shuffle once per original owner, reproducibly on transaction retry.
 const batchReturn=ab.operation==='returnDeck'&&(stageOverride!==null||moveMeasure||atkMeasure);
 const shuffledOwners=batchReturn?new Set():null;
 const branchMeasure=(branchStage&&ab.then||moveMeasure)&&drawThenSeat===null&&!fieldMeasure&&!statMeasure;
 const beforeStage=ab.then&&drawThenSeat===null&&!fieldMeasure&&!statMeasure?(branchMeasure?branchProgress(s,seat,ab):JSON.stringify(s.players)):null;
 if(card.type==='monster'&&ab.operation==='fusionFromExtraPay5000'){
   // No new target picker: the first still-available fusion card is deterministic.
   const selectable=p.extraDeck.map((id,i)=>({id,i})).filter(x=>CARD[x.id]?.type==='monster'&&summonKind(CARD[x.id])==='fusion');
   const chosen=card.monsterEffect?.selection==='highest'?selectable.reduce((best,x)=>!best||CARD[x.id].atk>CARD[best.id].atk?x:best,null):selectable[0];
   const at=chosen?.i??-1;
   const slot=p.monsters.indexOf(null);
   if(at<0||slot<0){log(s,`「${card.name}」：EXデッキに融合モンスターがないか、ゾーン満杯のため不発になりました。`);return;}
   const id=p.extraDeck.splice(at,1)[0];
   const summoned={key:++s.nextKey,id,ownerSeat:seat,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
   p.monsters[slot]=summoned;
   log(s,`「${card.name}」：EXデッキから「${CARD[id].name}」を特殊召喚しました（自動選択）。`);
   if(CARD[id]?.monsterEffect?.kind==='trigger'&&CARD[id].monsterEffect.code==='copyOpponentPrintedStats')activateMonsterAbility(s,seat,summoned,'trigger');
   return;
 }
 if(card.type==='monster'&&ab.operation==='conditionBranch'){
   const satisfied=allConditionsSatisfied(s,seat,ab),step=satisfied?ab.heads:ab.tails;
   log(s,`「${card.name}」：解決時の条件は${satisfied?'成立':'不成立'}。`);
   if(step.operation==='draw'&&s.players[step.target==='opponent'?1-seat:seat].deck.length<step.amount){log(s,'ドローに必要なカードが足りないため不発。');return;}
   executeAbility(s,entry,chain,{when:'main',...step},true);return;
 }
 if(card.type==='monster'&&ab.operation==='coinBranch'){
   const mon=p.monsters[entry.target];
   if(mon&&entry.targetMonsterKey!==undefined&&mon.key!==entry.targetMonsterKey)return;
   if(!mon){log(s,`「${card.name}」：発動元が場を離れたため不発。`);return;}
   // Fixed parity makes RTDB transaction retries and demo replay consistent.
   const face=((s.turnNo+mon.key)&1)===0?'heads':'tails';
   log(s,`「${card.name}」：コイントスは${face==='heads'?'表':'裏'}。`);
   const step=ab[face];
   executeAbility(s,entry,chain,{when:'main',...step},true);
   return;
 }
 if(card.type==='monster'&&ab.operation==='timeWizardCoin'){
   // Recheck the same monster instance when the chain resolves. The parity is
   // fully deterministic for local demo/replay and online transaction retries.
   const mon=p.monsters[entry.target];
   if(!mon||mon.pos==='set'||mon.id!==card.id||(entry.targetMonsterKey!==undefined&&entry.targetMonsterKey!==mon.key))return;
   const success=((s.turnNo+(mon.key||0))&1)===0;
   const affectedSeat=success?1-seat:seat,affected=s.players[affectedSeat];
   // Snapshot only the five original monster instances. Destruction may cause
   // field-to-grave effects; never destroy a newly summoned replacement.
   // Failed coin damage is half the sum of destroyed monsters' original ATK,
   // including face-down monsters; never count later grave-trigger replacements.
   const victims=affected.monsters.map((victim,index)=>victim?{
    index,victim,atk:!success?(CARD[victim.id]?.atk||0):0
   }:null).filter(Boolean);
   let failedDamage=0;
   for(const {index,victim,atk} of victims){
    if(affected.monsters[index]!==victim)continue;
    sendToGrave(affected,'monsters',index,s,true);
    if(!success)failedDamage+=atk;
   }
   if(!success)p.lp=Math.max(0,p.lp-Math.floor(failedDamage/2));
   log(s,`「${card.name}」：${success?'表':'裏'}。${success?'相手':'自分'}のモンスターを破壊しました${success?'':`（${Math.floor(failedDamage/2)}ダメージ）`}。`);
   return;
 }
 if(card.type==='monster'&&ab.operation==='doubleOriginalAtkEndDestroy'){
   const m=p.monsters[entry.target];
   if(m&&m.pos!=='set'&&(entry.targetMonsterKey===undefined||m.key===entry.targetMonsterKey)&&m.id===card.id){
     m.doubleOriginalAtkTurn=s.turnNo;
     log(s,`「${card.name}」：攻撃力がエンドフェイズまで元々の${card.monsterEffect?.multiplier??2}倍になりました。`);
   }
   return;
 }
 if(ab.operation==='crushVirus'){
  // One-shot, bounded resolution. Capture opposing hand and field once, so
  // cards searched by on-destruction effects are not accidentally destroyed.
  const rival=s.players[1-seat];let handSent=0,fieldSent=0;
  const survivors=[];
  for(const id of rival.hand){
   if(CARD[id]?.type==='monster'&&(CARD[id].atk||0)>=1500){rival.grave.push(id);handSent++;}
   else survivors.push(id);
  }
  rival.hand=survivors;
  const victims=rival.monsters.map((m,i)=>m&&
    (m.pos==='set'?(CARD[m.id]?.atk||0):effectiveAtk(m,s,1-seat))>=1500?{i,key:m.key,id:m.id}:null).filter(Boolean);
  for(const {i,key,id} of victims){
   const current=rival.monsters[i];
   if(current&&current.key===key&&current.id===id){sendToGrave(rival,'monsters',i,s,true);fieldSent++;}
  }
  log(s,`「${card.name}」：相手の手札${handSent}枚・フィールド${fieldSent}体を破壊しました（継続効果省略）。`);
  return;
 }
 if(ab.operation==='revealSetMonsters'){
  // Reveal first, then process matching live instances only. Flip effects may
  // remove other monsters, so stale slots must never trigger twice.
  const reveals=[];
  for(let side=0;side<2;side++)for(let i=0;i<5;i++){
   const m=s.players[side].monsters[i];if(!m||m.pos!=='set')continue;
   m.pos='def';m.changedTurn=s.turnNo;reveals.push({side,i,key:m.key,id:m.id});
  }
  for(const {side,i,key,id} of reveals){
   const m=s.players[side].monsters[i];
   if(m&&m.key===key&&m.id===id&&m.pos==='def')resolveFlipEffect(s,side,m);
  }
  log(s,`「${card.name}」：裏側守備モンスター${reveals.length}体を表側守備にしました（永続制限省略）。`);
  return;
 }
 if(ab.operation==='diceStats'){
  // All visible monsters at resolution; never open a target picker or affect set cards.
  const roll=deterministicDice(s,seat,entry.cardId);
  const targetSeat=ab.target==='ownAllMonsters'?seat:1-seat;
  const delta=(ab.target==='ownAllMonsters'?1:-1)*roll*100;
  let count=0;
  for(const monster of s.players[targetSeat].monsters){
   if(!monster||monster.pos==='set')continue;
   monster.bonus=(monster.bonus||0)+delta;
   monster.defBonus=(monster.defBonus||0)+delta;
   count++;
  }
  log(s,`「${card.name}」：サイコロ${roll}。表側モンスター${count}体のATK/DEFを${Math.abs(delta)}${delta>0?'上昇':'低下'}。`);
  return;
 }
 // A continuous spell's stat changes are already included in effectiveAtk/Def.
 // Resolving it must not add a second, temporary stat bonus.
 if(ab.operation==='sealEnemyAttacks'){
   const enemy=s.players[1-seat];
   enemy.attackSealedThroughTurn=Math.max(enemy.attackSealedThroughTurn||0,s.turnNo+5);
   log(s,`「${card.name}」：相手の次の3ターンの攻撃を禁止しました。`);
   return;
 }
 if(card.type==='spell'&&ab.when==='continuous'){
   log(s,`${p.name}：「${card.name}」の永続効果が適用されました。`);return;
 }
 const recipient=ab.target==='opponent'?1-seat:seat;
 const player=s.players[recipient],qty=ab.amount;
 // All mutations are bounded by the 5-slot field and a maximum of 10 cards.
 const monsters=abilityMonsterRefs(s,seat,ab.target,entry.target,chain,entry.targetMonsterKey,combinedStats?{fieldPosition:'faceup',...ab.filter}:ab.filter);
 let backrow=abilityBackrowRefs(s,seat,ab.target,entry.target,entry.targetBackrowKey);
 if(MOVE_COUNT_BACKROW.includes(ab.operation)&&ab.filter){
  const f=ab.filter;
  backrow=backrow.filter(({side,index})=>{
   const owner=s.players[side],item=index===-1?owner.field:owner.backrow[index];
   return matchesBackrowFilter(item,f);
  });
  if(f.maxCount!==undefined)backrow=backrow.slice(0,f.maxCount);
 }
 const monsterOps=new Set(['destroy','banish','sendGrave','returnHand','returnDeck','changePosition','setAttackerDefense','negateAndLockAttacker','negateWeakenAttacker','setAtk','setDef','boost','weaken','boostDef','weakenDef','boostBoth','weakenBoth','changeStats','lockAttack','lockWhileSourceFaceUp','lockEffect','steal','destroyGiveOwn','swapPrintedStats','blastAttacker']);
 if(monsterOps.has(ab.operation)){
  for(const {side,index,key} of monsters){
   if(fieldMeasure&&s.status!=='playing')break;
   const owner=s.players[side],item=owner.monsters[index];
   if(!item||(key!==undefined&&item.key!==key))continue; // No newly summoned replacement may inherit an old target.
   if(!matchesFieldFilter(item,ab.filter))continue;
   if(item.pos==='set'&&['boost','weaken','boostDef','weakenDef'].includes(ab.operation)&&['ownAllMonsters','enemyAllMonsters','bothMonsters'].includes(ab.target))continue;
   if(combinedStats&&item.pos==='set')continue;
   if(atkMeasure&&item.pos!=='set'&&!CARD[item.id]?.isToken)destroyedStat+=Math.max(0,CARD[item.id]?.[printedStatKey]||0);
   switch(ab.operation){
    case 'changeStats':case 'boostBoth':case 'weakenBoth':{
     const delta=ab.operation==='changeStats'?qty:ab.operation==='boostBoth'?qty:-qty;
     item.bonus=(item.bonus||0)+delta;item.defBonus=(item.defBonus||0)+(ab.operation==='changeStats'?ab.defAmount:delta);
     if(statMeasure)changedStats++;
     break;
    }
    case 'destroy':case 'sendGrave':{
     if(fieldMeasure&&(ab.operation==='destroy'||!CARD[item.id]?.isToken))moved++;
     sendToGrave(owner,'monsters',index,s,ab.operation==='destroy');break;
    }
    case 'swapPrintedStats':if(item.pos!=='set')item.swappedOriginalStatsTurn=s.turnNo;break;
    case 'blastAttacker':{
      if(item.pos!=='atk')break;
      // Early Structure Deck wording used the monster's ATK at resolution.
      // Resolve once before destruction removes equipment and field bonuses.
      const points=effectiveAtk(item,s,side);
      sendToGrave(owner,'monsters',index,s,true);
      s.players[seat].lp=Math.max(0,s.players[seat].lp-points);
      s.players[1-seat].lp=Math.max(0,s.players[1-seat].lp-points);
      if(chain?.afterAttack)chain.attackNegated=true;
      log(s,`攻撃モンスターを破壊し、お互いに${points}ダメージ。`);
      break;
    }
    case 'banish':{
      const oldCard=CARD[item.id];
      if(fieldMeasure&&!oldCard?.isToken)moved++;
      if(!oldCard?.isToken)originalOwner(s,item,owner).banished.push(item.id);
      owner.monsters[index]=null;removeOrphanEquips(owner);
      // Nobleman of Crossout: only a face-down FLIP monster triggers same-name
      // banishment from both decks; original instance was checked above.
      if(ab.target==='enemyFaceDownMonster'&&oldCard?.monsterEffect?.kind==='flip')
        banishMatchingDeckCards(s,oldCard.name,`${card.name}：リバースモンスター同名`);
      break;
    }
    case 'returnHand':if(fieldMeasure&&!CARD[item.id]?.isToken)moved++;returnMonsterToOwner(s,item,owner,'hand');owner.monsters[index]=null;break;
    case 'returnDeck':{
      if(batchReturn){
       if(!CARD[item.id]?.isToken){
        const destination=originalOwner(s,item,owner);
        if(summonKind(CARD[item.id])==='fusion')destination.extraDeck.push(item.id);
        else {destination.deck.push(item.id);shuffledOwners.add(s.players.indexOf(destination));}
        if(fieldMeasure)moved++;
       }
      }else returnMonsterToOwner(s,item,owner,'deck');
      owner.monsters[index]=null;break;
    }
    case 'changePosition':
      if(item.pos==='set')item.pos='atk';else item.pos=item.pos==='atk'?'def':'atk';
      item.changedTurn=s.turnNo;
      // A changed attack position always interrupts the declared attack,
      // even if a subsequent chain link changes it back.
      if(chain?.afterAttack?.by===side&&chain.afterAttack.attacker===index)chain.attackInterrupted=true;
      break;
    case 'negateWeakenAttacker':case 'negateAndLockAttacker':
      if(chain?.afterAttack?.by===side&&chain.afterAttack.attacker===index&&!chain.attackNegated){
       chain.attackNegated=true;
       // Both historical traps share one bounded, persistent target link.
       // Place the resolved trap in its owner's free zone; no new pending step.
       const free=p.backrow.indexOf(null);
       if(free>=0){
         if(!Number.isInteger(item.key))item.key=++s.nextKey;
         p.backrow[free]={id:entry.cardId,faceDown:false,setTurn:s.turnNo,linkKey:item.key,linkOwner:side};
         entry.discardOnResolve=false;
       }else log(s,`「${card.name}」：魔法・罠ゾーンが満杯のため永続効果は適用されません。`);
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
    case 'lockWhileSourceFaceUp':{
      // Only bind the exact summoning instance, never a new occupant of its slot.
      const source=s.players[seat].monsters.find(m=>m?.key===entry.sourceMonsterKey&&m.pos!=='set'&&m.id===entry.cardId);
      if(source&&Number.isInteger(source.key)){
        const links=Array.isArray(item.attackLockSources)?item.attackLockSources.filter(Number.isInteger):[];
        if(!links.includes(source.key))item.attackLockSources=[...links.slice(-9),source.key];
      }
      break;
    }
    case 'lockEffect':item.effectLockedUntil=Math.max(item.effectLockedUntil||0,s.turnNo+2);break;
    case 'destroyGiveOwn':{
     // Single deterministic two-field operation: destroy enemy target, then gift the first own monster.
     // Recheck both cards at resolution; no intermediate target picker or pending state.
     if(side!==1-seat)break;
     const mine=s.players[seat],ownAt=mine.monsters.findIndex(Boolean);
     if(ownAt<0){log(s,`「${card.name}」：渡せる自分のモンスターがないため不発。`);break;}
     const gift=mine.monsters[ownAt];
     sendToGrave(owner,'monsters',index,s,true);
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
  if(batchReturn)for(const side of shuffledOwners){
   const deck=s.players[side].deck;
   // FNV seed over current deck order + synchronized turn/revision/source. No stored RNG state.
   let seed=(2166136261^Math.imul(s.turnNo||1,0x9e3779b1)^Math.imul((s.revision||0)+1,0x85ebca6b)^Math.imul(side+1,0xc2b2ae35))>>>0;
   for(const id of [entry.cardId,...deck])for(const ch of String(id)+'|')seed=Math.imul(seed^ch.codePointAt(0),16777619)>>>0;
   if(!seed)seed=1;
   for(let i=deck.length-1;i>0;i--){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const j=(seed>>>0)%(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  }
 }else if(['destroyBackrow','banishBackrow','banishSetBackrow','returnBackrow','removeSpellBackrow','destroyThenSetBackrow'].includes(ab.operation)){
  for(const {side,index,key} of backrow){
   const owner=s.players[side],item=index===-1?owner.field:owner.backrow[index];
   if(!item||(key!==undefined&&item.key!==key))continue;
   // A set-only target must remain set throughout resolution.
   if(ab.operation==='banishSetBackrow'&&item.faceDown!==true)continue;
   if(ab.operation==='removeSpellBackrow'&&CARD[item.id]?.type!=='spell'){
    log(s,`「${card.name}」：セットされた罠を確認しました。破壊しません。`);
    continue;
   }
   if(index===-1)owner.field=null;else owner.backrow[index]=null;
   if(fieldMeasure)moved++;
   const destination=originalOwner(s,item,owner);
   if(['destroyBackrow','removeSpellBackrow','destroyThenSetBackrow'].includes(ab.operation))destination.grave.push(item.id);
   else if(['banishBackrow','banishSetBackrow'].includes(ab.operation)){
     destination.banished.push(item.id);
     if(ab.operation==='banishSetBackrow'&&CARD[item.id]?.type==='trap')
       banishMatchingDeckCards(s,CARD[item.id].name,`${card.name}：罠カード同名`);
   }else destination.hand.push(item.id);
   if(ab.operation==='destroyThenSetBackrow'){
    // Optional secondary step: only after destruction succeeded. Never opens a picker.
    const free=p.backrow.indexOf(null);
    const handIndex=p.hand.findIndex(id=>CARD[id]?.type==='trap'||
      CARD[id]?.type==='spell'&&spellKind(CARD[id])!=='field');
    if(free>=0&&handIndex>=0){
     const id=p.hand.splice(handIndex,1)[0];
     p.backrow[free]={id,faceDown:true,setTurn:s.turnNo};
     log(s,`「${card.name}」：手札から魔法・罠1枚をセットしました（自動選択）。`);
    }
   }
  }
 }else switch(ab.operation){
  case 'summonSheepTokens':{
   // Exact, bounded all-or-nothing placement. Recheck after chain links.
   if(p.monsters.filter(m=>m===null).length<ab.amount){log(s,`「${card.name}」：空きが${ab.amount}枠未満のため不発。`);break;}
   summonDefenseTokens(s,seat,SHEEP_TOKEN_ID,ab.amount);
   p.sheepLockTurn=s.turnNo;
   log(s,`「${card.name}」：羊トークン${ab.amount}体を守備表示で特殊召喚しました。`);
   break;
  }
  case 'summonKuribohTokens':{
   if(p.sheepLockTurn===s.turnNo)break;
   // The cost was paid at activation. Resolve with the currently free slots only.
   const total=summonDefenseTokens(s,seat,KURIBOH_TOKEN_ID,5);
   log(s,`「${card.name}」：クリボートークン${total}体を守備表示で特殊召喚しました。`);
   break;
  }
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
   if(p.sheepLockTurn===s.turnNo)break;
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
    const pos=player.deck.findIndex(id=>CARD[id]?.type===type&&
      (!ab.filter||matchesDeckFilter(CARD[id],ab.filter)));
    if(pos<0)break;
    player.hand.push(player.deck.splice(pos,1)[0]);
   }
   break;
  }
  case 'summonMonsterHand':{
   if(recipient!==seat||p.sheepLockTurn===s.turnNo)break;
   for(let i=0;i<Math.min(qty,2);i++){
    const slot=p.monsters.indexOf(null),at=p.hand.findLastIndex(id=>eligibleHandSummon(id,ab.filter));
    if(slot<0||at<0)break;
    const id=p.hand.splice(at,1)[0];
    p.monsters[slot]={key:++s.nextKey,id,ownerSeat:seat,pos:ab.filter?.summonPosition||'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
    if(summonMeasure)moved++;
   }
   break;
  }
  case 'summonMonsterDeck':{
   // Deterministic, bounded search. No second selection or network round-trip.
   let count=0;
   if((summonMeasure||branchStage)&&player.sheepLockTurn===s.turnNo)break;
   for(let i=0;i<qty;i++){
    const slot=player.monsters.indexOf(null);if(slot<0)break;
    const pos=player.deck.findIndex(id=>CARD[id]?.type==='monster'&&
      summonKind(CARD[id])==='normal'&&matchesDeckFilter(CARD[id],ab.filter));
    if(pos<0)break;
    const id=player.deck.splice(pos,1)[0];
    const summoned={key:++s.nextKey,id,ownerSeat:recipient,pos:ab.filter?.summonPosition||'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
    player.monsters[slot]=summoned;count++;if(summonMeasure)moved++;
   }
   log(s,`「${card.name}」：デッキから${count}体特殊召喚しました。`);
   break;
  }
  case 'banishOwnHand':case 'returnOwnHandToDeck':{
   if(recipient!==seat)break;
   const moved=[];for(let i=0;i<Math.min(qty,5);i++){const at=player.hand.findLastIndex(id=>eligibleHandMove(id,ab.filter));if(at<0)break;moved.push(player.hand.splice(at,1)[0]);}
   if(ab.operation==='banishOwnHand')player.banished.push(...moved);
   else{const main=[];for(const id of moved)(summonKind(CARD[id])==='fusion'?player.extraDeck:main).push(id);if(ab.filter?.deckPlacement==='top')player.deck.unshift(...main);else player.deck.push(...main);}
   break;
  }
  case 'discardNewest':{
   if(ab.filter){
    // Only own hand may be filtered; never inspect the opponent's hidden hand for new recipes.
    if(recipient===seat)player.grave.push(...takeFilteredCards(player.hand,qty,ab.filter,true));
   }else{const count=Math.min(qty,player.hand.length);
    if(count)player.grave.push(...player.hand.splice(-count,count));}
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
  case 'mill':player.grave.push(...(ab.filter?takeFilteredCards(player.deck,qty,ab.filter):player.deck.splice(0,qty)));break;
  case 'millFirstType':{
   // First matching card, deterministic on both devices. No shuffle or selection window.
   const at=player.deck.findIndex(id=>CARD[id]?.type===ab.match);
   if(at>=0)player.grave.push(player.deck.splice(at,1)[0]);
   break;
  }
  case 'banishDeck':player.banished.push(...(ab.filter?takeFilteredCards(player.deck,qty,ab.filter):player.deck.splice(0,qty)));break;
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
  case 'graveRecover':{
   if(ab.filter){
    // A filtered recovery selects only eligible monsters, newest first; no user prompt.
    for(let i=0;i<qty;i++){
     const at=player.grave.findLastIndex(id=>matchesDeckFilter(CARD[id],ab.filter));
     if(at<0)break;
     const id=player.grave.splice(at,1)[0];
     (summonKind(CARD[id])==='fusion'?player.extraDeck:player.hand).push(id);
    }
   }else for(const id of player.grave.splice(Math.max(0,player.grave.length-qty),qty))
    (summonKind(CARD[id])==='fusion'?player.extraDeck:player.hand).push(id);
   break;
  }
  case 'graveBanish':player.banished.push(...(ab.filter?takeFilteredCards(player.grave,qty,ab.filter,true):player.grave.splice(Math.max(0,player.grave.length-qty),qty)));break;
  case 'graveRecycle':{
   const reclaimed=ab.filter?takeFilteredCards(player.grave,qty,ab.filter,true):player.grave.splice(Math.max(0,player.grave.length-qty),qty);
   if(reclaimed.length){
     const main=reclaimed.filter(id=>summonKind(CARD[id])!=='fusion');
     player.extraDeck.push(...reclaimed.filter(id=>summonKind(CARD[id])==='fusion'));
     if(main.length){player.deck.push(...main);player.deck=shuffle(player.deck);}
   }
   break;
  }
  case 'banishedRecover':{for(const id of (ab.filter?takeFilteredCards(player.banished,qty,ab.filter,true):player.banished.splice(Math.max(0,player.banished.length-qty),qty)))
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
   p.monsters[slot]={key:++s.nextKey,id,ownerSeat:target.seat,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
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
    target.monsters[slot]={key:++s.nextKey,id,ownerSeat:s.players.indexOf(target),pos:'set',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
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
    const item={key:++s.nextKey,id,ownerSeat:recipient,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
    player.monsters[slot]=item;summoned++;
    if(CARD[id]?.monsterEffect?.kind==='trigger'&&CARD[id].monsterEffect.code==='copyOpponentPrintedStats')activateMonsterAbility(s,recipient,item,'trigger');
   }
   log(s,`「${card.name}」：手札から${summoned}体を特殊召喚しました。`);
   break;
  }
  case 'graveRevive':{
   if((summonMeasure||branchStage)&&player.sheepLockTurn===s.turnNo)break;
   for(let i=0;i<qty;i++){
    if(summonMeasure&&s.status!=='playing')break;
    const slot=player.monsters.indexOf(null);
    const graveIndex=player.grave.findLastIndex(id=>matchesDeckFilter(CARD[id],ab.filter));
    if(slot<0||graveIndex<0)break;
    const id=player.grave.splice(graveIndex,1)[0];
    // Special summons do not consume the summoned monster's attack for this turn.
    // This also applies to recipes reused through the card creator.
    player.monsters[slot]={key:++s.nextKey,id,ownerSeat:recipient,pos:ab.filter?.summonPosition||'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
    if(summonMeasure)moved++;
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
  case 'redirectToAttackerAlly':{
   const attack=chain?.afterAttack;
   if(!attack||chain.attackNegated||chain.attackInterrupted||attack.redirectAlly)break;
   const slot=attackerAllySlot(s,seat,attack);
   if(slot<0){log(s,'攻撃者側に別の適切なモンスターがないため不発。');break;}
   attack.redirectAlly={slot,key:s.players[attack.by].monsters[slot].key};
   log(s,`「${card.name}」：攻撃者側の別のモンスターへ攻撃対象を変更します。`);
   break;
  }
  case 'concealDefender':{
   const attack=chain?.afterAttack;
   if(!attack||chain.attackNegated||chain.attackInterrupted)break;
   const slot=concealDefenderSlot(s,seat,attack);
   if(slot<0){log(s,'攻撃対象が変わったため裏側守備への変更は不発になりました。');break;}
   const defender=s.players[seat].monsters[slot];
   defender.pos='set';defender.changedTurn=s.turnNo;
   chain.attackNegated=true;
   log(s,`「${CARD[defender.id]?.name||'モンスター'}」を裏側守備表示にし、攻撃を無効にしました。`);
   break;
  }
  case 'redirectAttack':{
   const attack=chain?.afterAttack;
   if(!attack||chain.attackNegated||chain.attackInterrupted)break;
   const attacker=s.players[attack.by]?.monsters?.[attack.attacker];
   if(!attacker||attacker.pos!=='atk'||(attack.attackerKey!==undefined&&attacker.key!==attack.attackerKey))break;
   const slot=redirectedAttackSlot(s,attack);
   if(slot<0){log(s,'攻撃対象を変更できるモンスターがないため不発になりました。');break;}
   attack.target=slot;
   const nextKey=s.players[1-attack.by].monsters[slot].key;
   if(Number.isInteger(nextKey))attack.targetKey=nextKey;
   else delete attack.targetKey; // Avoid undefined in Firebase transaction payloads.
   log(s,`攻撃対象を「${CARD[s.players[1-attack.by].monsters[slot].id]?.name||'別のモンスター'}」へ変更しました。`);
   break;
  }
  case 'negateAttack':if(chain)chain.attackNegated=true;break;
  case 'negateEndBattle':{
   if(chain?.afterAttack&&!chain.attackNegated&&!chain.attackInterrupted){chain.attackNegated=true;chain.endBattle=true;}
   break;
  }
  // negateEffect is handled during chain resolution, so it can counter its predecessor.
  case 'negateEffect':case 'protectOwnTraps':case 'redirectSpellTarget':break;
 }
 if(card.type==='trap'&&!card.ability&&chain?.afterAttack&&['counterburn','negate'].includes(card.effect))chain.attackNegated=true;
 log(s,`${p.name}：「${card.name}」の効果を解決しました。`);
 // A failed mandatory draw ends the duel. Do not discard cards or execute
 // any other follow-up after a deck-out (or a different terminal effect).
 // For draw composites, only a full draw counts as a successful first step.
 if((branchStage&&ab.then)||moveMeasure||atkMeasure||statMeasure)checkWinner(s); // Never execute a new branch follow-up after lethal damage.
 // Exact field count is recorded at each direct mutation; simple zone moves
 // cannot trigger other moves and use only the source length delta.
 if(moveMeasure&&drawThenSeat!==null)moved=Math.max(0,s.players[drawThenSeat].hand.length-handBeforeDraw);
 else if(moveMeasure&&!fieldMeasure)moved=Math.max(0,beforeStage-branchProgress(s,seat,ab));
 const applied=!!ab.then&&s.status==='playing'&&(
  drawThenSeat!==null
   ?s.players[drawThenSeat].hand.length===handBeforeDraw+ab.amount
   :statMeasure?changedStats>0:fieldMeasure?moved>0:beforeStage!==null&&(branchMeasure?branchProgress(s,seat,ab):JSON.stringify(s.players))!==beforeStage);
 if(ab.then&&applied){
  // A follow-up is part of this same effect, not a new activation or chain link.
  // Only automatic or reused targets are permitted by isValidAbility.
  executeAbility(s,entry,chain,{when:ab.when,...ab.then},false,moved,destroyedStat);
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
 if(ab?.target==='ownMonster'||['doubleOriginalAtkEndDestroy','timeWizardCoin','coinBranch'].includes(ab?.operation))side=entry.seat;
 else if(ab?.target==='enemyMonster')side=1-entry.seat;
 else if(ab?.target==='enemyFaceDownMonster'){
  side=1-entry.seat;at=s.players[side]?.monsters?.findIndex(m=>m?.pos==='set');
 }
 else if(ab?.target==='attacker'){
  const attack=s.pending?.kind==='attack'?s.pending:s.pending?.afterAttack;
  if(attack){side=attack.by;at=attack.attacker;}
 }
 if(side!==null&&Number.isInteger(at)&&at>=0&&at<5){
  const victim=s.players[side]?.monsters?.[at];
  if(victim&&!Number.isInteger(victim.key))victim.key=++s.nextKey;
  if(Number.isInteger(victim?.key))entry.targetMonsterKey=victim.key;
 }
 // Assign an identity only to the two new targeted backrow effects. A new
 // card in the same zone must not be destroyed by an older chain link.
 if(['destroyBackrow','removeSpellBackrow','destroyThenSetBackrow','banishSetBackrow','banishBackrow','returnBackrow'].includes(ab?.operation)&&ab?.target==='enemyBackrow'&&Number.isInteger(at)&&at>=0&&at<5){
  const item=s.players[1-entry.seat]?.backrow?.[at];
  if(item){
   if(!Number.isInteger(item.key))item.key=++s.nextKey;
   entry.targetBackrowKey=item.key;
  }
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
  assert(meetsCountRequirement(s,seat,ab),'カードの存在数・枚数による発動条件を満たしていません');
  assert(hasFilteredCost(s,seat,ab,fromHand?{zone:'hand',index}:null),'条件に一致するコストまたはドローに必要なカードが足りません');
  if(ab.filter?.fieldPosition||ab.filter&&MOVE_COUNT_BACKROW.includes(ab.operation))assert(hasFieldPositionTarget(s,seat,ab),'表示形式と条件に一致するカードがいません');
  // Reject effects that have no legal target or insufficient draw/search cards
  // before paying costs, removing the spell, or opening a networked chain.
  if(!ab.before&&(ab.operation==='reviveSelected'||ab.operation==='searchNamed'||
     ab.operation==='draw'&&!ab.then||
     ab.operation==='destroy'&&ab.target==='enemyLowestAtk'))
    assert(canOfferSpell(s,seat,c,source),'発動に必要なデッキ・墓地・モンスター・ゾーンがありません');
  // Keep the established Kuriboh/Flute error messages and cost checks.
  // Only preflight new discard/target and equip cases before opening a chain.
  if(ab.operation==='destroy'&&ab.before?.operation==='discardOwnHand'||kind==='equip'&&ab.operation==='boost')
    assert(canOfferSpell(s,seat,c,source),'発動に必要なモンスター・手札・空きゾーンがありません');
  if(ab.operation==='returnBackrow'&&ab.target==='bothAllBackrow')
    assert(canOfferSpell(s,seat,c,source),'戻す魔法・罠がフィールドにありません');
  if((ab.operation==='removeSpellBackrow'||ab.operation==='destroyBackrow')&&ab.target==='enemyBackrow'||
     ab.operation==='destroy'&&ab.target==='bothMonsters'||
     ab.operation==='swapPrintedStats'&&ab.target==='bothMonsters'||
     kind==='equip'&&ab.operation==='pierce'&&ab.target==='ownMonster')
    assert(canOfferSpell(s,seat,c,source),'効果を適用できる魔法・罠・モンスターがありません');
  if(ab.operation==='draw'&&ab.target==='self'&&ab.then?.operation==='discardNewest')
    assert(canOfferSpell(s,seat,c,source),'効果に必要なカードをドローできません');
  if(ab.operation==='destroyGiveOwn'&&ab.target==='enemyMonster'){
    assert(p.monsters.some(Boolean),'自分のフィールドに渡すモンスターがありません');
    assert(canOfferSpell(s,seat,c,source),'対象となる相手モンスターがいません');
  }
  if(kind==='equip'&&ab.operation==='lpRelativeEquip')
    assert(canOfferSpell(s,seat,c,source),'魔法・罠ゾーンが満杯か、装備できる表側モンスターがありません');
  // A two-player hand replacement must never enter the chain when either
  // player cannot complete its mandatory draws. Avoid partial mutation/deck-out.
  if(ab.operation==='diceStats')
   assert(s.players[ab.target==='ownAllMonsters'?seat:1-seat].monsters.some(m=>m&&m.pos!=='set'),
    '効果を受ける表側表示モンスターがいません');
  if(ab.operation==='summonSheepTokens'){
   assert(p.monsters.filter(m=>m===null).length>=ab.amount,`羊トークン${ab.amount}体のために空きゾーンが${ab.amount}枠必要です`);
   if(s.turn===seat)assert(!p.normalUsed,'このターン通常召喚済みのためスケープ・ゴートを発動できません');
  }
  // Only a face-up physical Kuriboh can pay the activation cost. Its release
  // guarantees at least one free slot; opposing chain links may later fill it.
  const kuribohCost=ab.operation==='summonKuribohTokens'?p.monsters.findIndex(m=>m&&m.pos!=='set'&&!CARD[m.id]?.isToken&&CARD[m.id]?.name==='クリボー'):-1;
  if(ab.operation==='summonKuribohTokens')assert(kuribohCost>=0,'表側表示の「クリボー」が必要です');
  if(['banishOwnHand','returnOwnHandToDeck'].includes(ab.operation))assert(canMoveFilteredHand(p,ab,source==='hand'?c.id:null),'移動できる手札カードがありません');
  if(ab.operation==='summonMonsterHand')assert(canSummonFilteredHand(s,seat,ab),'特殊召喚できる手札と空きゾーンが必要です');
  if(ab.operation==='summonRaceFromHand')assert(canSummonRaceFromHand(s,seat,ab),'発動条件のモンスター・手札の指定種族・ゾーンの空きを確認してください');
  if(ab.operation==='reviveBothSet')assert(canReviveBothSet(s),'双方の墓地に通常召喚可能なモンスターと空きゾーンが必要です');
  if(ab.operation==='summonNamedFromHand')
    assert(canSummonNamedFromHand(p,ab),'指定名モンスターが手札にないか、モンスターゾーンが満杯です');
  if(ab.operation==='destroyGiveOwn')assert(p.monsters.some(Boolean),'自分のフィールドに渡すモンスターがありません');
  if(ab.operation==='graveRevive'){const recipient=ab.target==='opponent'?s.players[1-seat]:p;assert(recipient.monsters.some(x=>x===null)&&recipient.grave.some(id=>matchesDeckFilter(CARD[id],ab.filter)),'蘇生できるモンスターまたはゾーンの空きがありません');}
  if(ab.operation==='graveRevive'&&ab.before?.operation==='payLP')
    assert(canOfferSpell(s,seat,c,source),'蘇生可能なモンスターと支払いLPを確認してください');
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
    assert(monster.pos!=='set','裏側守備表示のモンスターに装備できません');
    if(monster.key===undefined)monster.key=++s.nextKey;
  }
  const movedBefore=payBefore(s,seat,ab,costIndices,fromHand?{zone:'hand',index}:source==='backrow'?{zone:'backrow',index}:null,target);
  if(kuribohCost>=0)sendToGrave(p,'monsters',kuribohCost,s); // Cost is paid now, even if resolution is negated.
  if(fromHand)index-=movedBefore;
  const ongoing=persistentSpell(c);
  let slotItem={id,faceDown:false,setTurn:s.turnNo};
  if(!fromHand)slotItem={...old,faceDown:false};
  if(ab.operation==='preventEquipAttack')slotItem.virusEndPhases=0;
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
    assert([2,3].includes(items.length)&&items.length===card.fusionMaterials?.length,'融合素材の数が正しくありません');
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
  const summoned={key:++s.nextKey,id,ownerSeat:seat,pos:'atk',bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
  p.monsters[slot]=summoned;
  log(s,`${p.name} は「${spell.name}」で「${card.name}」を${isRitual?'儀式':'融合'}召喚しました。`);
  if(card.subtype==='effect'){
    if(card.ability?.when==='summon'){
      const ab=actionAbility(card),target=summonTriggerTarget(s,seat,ab.target,slot);
      if(target!==-1)executeAbility(s,{seat,cardId:id,target,sourceMonsterKey:summoned.key},null);
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
export function canExtraNormalSummon(s,seat){
 const p=s?.players?.[seat];
 return !!p&&p.lp>500&&!trapsSuppressed(s)&&p.backrow.some(item=>item&&!item.faceDown&&
  CARD[item.id]?.type==='trap'&&CARD[item.id]?.ability?.when==='continuous'&&
  CARD[item.id].ability.operation==='extraNormalSummon'&&CARD[item.id].ability.amount===500);
}
export function trapsSuppressed(s){
 return !!s?.players?.some(p=>p?.monsters?.some(m=>m&&m.pos!=='set'&&
   CARD[m.id]?.monsterEffect?.kind==='continuous'&&CARD[m.id].monsterEffect.code==='trapSuppression'));
}
export function canProtectOwnTraps(s,seat,previous,excludeIndex=-1){
 if(![0,1].includes(seat)||!previous||previous.seat!==1-seat)return false;
 const ab=actionAbility(CARD[previous.cardId]);
 if(!['destroyBackrow','destroyThenSetBackrow'].includes(ab?.operation))return false;
 const own=s?.players?.[seat]?.backrow;
 if(!Array.isArray(own))return false;
 const active=(v,i)=>i!==excludeIndex&&v&&CARD[v.id]?.type==='trap';
 if(['enemyAllBackrow','bothAllBackrow'].includes(ab.target))return own.some(active);
 if(ab.target==='enemyBackrow'&&Number.isInteger(previous.target))
  return previous.target!==excludeIndex&&!!active(own[previous.target],previous.target);
 return false;
}
export function redirectedSpellTargetSlot(s,seat,previous){
 if(![0,1].includes(seat)||previous?.seat!==1-seat)return -1;
 const spell=CARD[previous.cardId],ab=actionAbility(spell);
 // Persistent equips/fields already bind a link at activation; never retarget those.
 if(spell?.type!=='spell'||!['normal','quick'].includes(spellKind(spell))||!['ownMonster','enemyMonster'].includes(ab?.target))return -1;
 const side=ab.target==='ownMonster'?previous.seat:1-previous.seat;
 const at=previous.target;
 if(!Number.isInteger(at)||at<0||at>=5)return -1;
 const monsters=s?.players?.[side]?.monsters;
 const original=monsters?.[at];
 if(!original||(previous.targetMonsterKey!==undefined&&original.key!==previous.targetMonsterKey))return -1;
 for(let i=0;i<5;i++){
  if(i===at||!monsters[i]||isDragonEffectTargetBlocked(s,previous.seat,side,i))continue;
  return i;
 }
 return -1;
}
// Optional self-turn activation of selected ordinary traps that previously worked
// only while responding to another effect. The same deterministic effect
// handler and chain resolver are reused; no extra stored state is introduced.
// In particular, counter traps and attack/summon reactions are NOT eligible.
const PROACTIVE_TRAP_OPERATIONS=new Set(['recoverNormalAtk','borrowOpponentSpell','destroyThenSetBackrow','healPerFieldMonster','crushVirus','revealSetMonsters']);
export function canActivateMainTrap(s,seat,index){
 if(!s||s.status!=='playing'||s.turn!==seat||!['main1','main2'].includes(s.phase)||s.pending||trapsSuppressed(s)||![0,1].includes(seat))return false;
 const p=s.players?.[seat],enemy=s.players?.[1-seat];
 if(!p||!enemy||!Number.isInteger(index)||index<0||index>=5)return false;
 const item=p.backrow?.[index],card=CARD[item?.id],ab=actionAbility(card);
 if(!item||!item.faceDown||item.setTurn>=s.turnNo||card?.type!=='trap'||!ab)return false;
 if(ab.when==='main'&&ab.operation==='graveRevive')return p.monsters.includes(null)&&p.grave.some(id=>matchesDeckFilter(CARD[id],ab.filter));
 if(ab.when!=='response'||!PROACTIVE_TRAP_OPERATIONS.has(ab.operation))return false;
 if(ab.operation==='recoverNormalAtk')return p.grave.filter(id=>CARD[id]?.type==='monster').length>=5&&
   p.grave.some(id=>CARD[id]?.type==='monster'&&CARD[id].subtype!=='effect'&&(CARD[id].atk||0)<=1500&&summonKind(CARD[id])==='normal');
 if(ab.operation==='borrowOpponentSpell')return enemy.grave.some(id=>CARD[id]?.type==='spell');
 if(ab.operation==='destroyThenSetBackrow')return enemy.backrow.some(Boolean);
 if(ab.operation==='healPerFieldMonster')return p.monsters.some(Boolean)||enemy.monsters.some(Boolean);
 if(ab.operation==='crushVirus')return p.monsters.some(m=>m&&m.pos!=='set'&&
   normalizeAttribute(CARD[m.id]?.attribute)==='闇'&&effectiveAtk(m,s,seat)<=1000);
 if(ab.operation==='revealSetMonsters')return s.players.some(x=>x.monsters.some(m=>m?.pos==='set'));
 return false;
}
// Read-only shared gate for chain responses. Card-builder copies of Magic Jammer
// have no named-card metadata; derive its spell-only restriction from the
// ability itself, so templates behave exactly like their source card.
export function canActivateResponseTrap(s,seat,index){
 const ch=s?.pending;
 if(s?.status!=='playing'||ch?.kind!=='chain'||ch.priority!==seat||
    ![0,1].includes(seat)||!Number.isInteger(index)||index<0||index>=5||
    ch.stack.length>=8||trapsSuppressed(s))return false;
 const item=s.players?.[seat]?.backrow?.[index],card=CARD[item?.id],ab=actionAbility(card);
 if(!item||item.faceDown!==true||item.setTurn>=s.turnNo||card?.type!=='trap')return false;
 if(!ab)return !!ch.afterAttack&&['negate','counterburn','counterdestroy'].includes(card.effect);
 if(ab.when==='attack')return !!ch.afterAttack&&canActivateAttackTrap(s,seat,index);
 if(ab.when!=='response')return false;
 if((ab.filter?.fieldPosition||ab.filter&&MOVE_COUNT_BACKROW.includes(ab.operation))&&!hasFieldPositionTarget(s,seat,ab))return false;
 const previous=ch.stack[ch.stack.length-1],source=CARD[previous?.cardId];
 if(card.responseGuard||ab.operation==='redirectSpellTarget'||
    (ab.operation==='negateEffect'&&ab.before?.operation==='discardOwnHand')){
   if(source?.type!=='spell')return false;
   if(card.responseGuard==='targetedSpell'&&
      !['ownMonster','enemyMonster'].includes(actionAbility(source)?.target))return false;
 }
 if(ab.before?.operation==='discardOwnHand'&&
    s.players[seat].hand.length<ab.before.amount)return false;
 if(ab.operation==='redirectSpellTarget'&&redirectedSpellTargetSlot(s,seat,previous)<0)return false;
 if(ab.operation==='protectOwnTraps'&&!canProtectOwnTraps(s,seat,previous,index))return false;
 if(ab.operation==='diceStats'&&
    !s.players[ab.target==='ownAllMonsters'?seat:1-seat].monsters.some(m=>m&&m.pos!=='set'))return false;
 if(ab.operation==='borrowOpponentSpell'&&
    !s.players[1-seat].grave.some(id=>CARD[id]?.type==='spell'))return false;
 if(ab.operation==='recoverNormalAtk'){
  const grave=s.players[seat].grave;
  if(grave.filter(id=>CARD[id]?.type==='monster').length<5||
    !grave.some(id=>CARD[id]?.type==='monster'&&CARD[id].subtype!=='effect'&&
     (CARD[id].atk||0)<=1500&&summonKind(CARD[id])==='normal'))return false;
 }
 return true;
}
function addChainTrap(s,seat,index,target,costIndices){
 const ch=s.pending;assert(ch?.kind==='chain'&&ch.priority===seat,'チェーンの応答順ではありません');
 assert(!trapsSuppressed(s),'サイコ・ショッカーの効果で罠カードを発動できません');
 assert(ch.stack.length<8,'チェーンは最大8つまでです');
 const item=s.players[seat].backrow[index];assert(item&&mustCard(item.id).type==='trap','罠カードがありません');
 // Only an armed set trap may become a chain link. Face-up legacy/imported
 // entries must not be fired a second time by the same response action.
 assert(item.faceDown===true,'セット状態の罠カードだけ発動できます');
 assert(item.setTurn<s.turnNo,'セットしたターンに罠は使えません');
 const c=mustCard(item.id),ab=actionAbility(c);assert(ab&&(ab.when==='response'||(ab.when==='attack'&&ch.afterAttack)),'今はこの罠を発動できません');
 // Historical counter traps can use the same generic negateEffect operation,
 // with a small optional activation guard on the immediately preceding link.
 if(c.responseGuard){
  const previous=ch.stack[ch.stack.length-1],spell=previous&&CARD[previous.cardId];
  assert(spell?.type==='spell','魔法カードの発動にしか対応できません');
  if(c.responseGuard==='targetedSpell')assert(['ownMonster','enemyMonster'].includes(actionAbility(spell)?.target),'モンスター1体を対象とする魔法にしか対応できません');
 }
 if(ab.operation==='negateEffect'&&ab.before?.operation==='discardOwnHand')
  assert(CARD[ch.stack[ch.stack.length-1]?.cardId]?.type==='spell','魔法カードの発動にしか対応できません');
 if(ab.operation==='redirectSpellTarget')assert(redirectedSpellTargetSlot(s,seat,ch.stack[ch.stack.length-1])>=0,'対象を変更できる相手の魔法がありません');
 if(ab.operation==='protectOwnTraps')assert(canProtectOwnTraps(s,seat,ch.stack[ch.stack.length-1],index),'自分の罠を破壊する直前の効果にのみ発動できます');
 if(ab.operation==='diceStats')assert(s.players[ab.target==='ownAllMonsters'?seat:1-seat].monsters.some(m=>m&&m.pos!=='set'),
   '効果を受ける表側表示モンスターがいません');
 if(ab.operation==='borrowOpponentSpell')assert(s.players[1-seat].grave.some(id=>CARD[id]?.type==='spell'),'相手の墓地に魔法カードがありません');
 if(ab.operation==='recoverNormalAtk'){
  const grave=s.players[seat].grave;
  assert(grave.filter(id=>CARD[id]?.type==='monster').length>=5,'墓地にモンスターが5体以上必要です');
  assert(grave.some(id=>CARD[id]?.type==='monster'&&CARD[id].subtype!=='effect'&&(CARD[id].atk||0)<=1500&&summonKind(CARD[id])==='normal'),'回収できる通常モンスターがいません');
 }
 if(ab.operation==='redirectAttack')assert(redirectedAttackSlot(s,ch.afterAttack)>=0,'攻撃対象を変更できる別のモンスターがありません');
 if(ab.operation==='redirectToAttackerAlly')assert(attackerAllySlot(s,seat,ch.afterAttack)>=0,'攻撃者側に別の表側モンスターがありません');
 if(ab.operation==='concealDefender')assert(!ch.attackNegated&&!ch.attackInterrupted&&concealDefenderSlot(s,seat,ch.afterAttack)>=0,'裏側守備にできる攻撃対象がありません');
 assert(canActivateResponseTrap(s,seat,index),'このチェーンには発動できません');
 abilityTargetCheck(s,seat,ab,target);
 if(ab.when==='attack')assert(canActivateAttackTrap(s,seat,index),'この攻撃に対して発動できません');
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
   if(['negateEffect','protectOwnTraps'].includes(actionAbility(mustCard(entry.cardId))?.operation)){
     cancelPrevious=true;
     log(s,`「${mustCard(entry.cardId).name}」が直前のチェーン効果を無効化します。`);
     continue;
   }
   if(actionAbility(mustCard(entry.cardId))?.operation==='redirectSpellTarget'){
     const earlier=ch.stack[i-1];
     const newIndex=redirectedSpellTargetSlot(s,entry.seat,earlier);
     if(newIndex>=0){
       const priorAbility=actionAbility(CARD[earlier.cardId]);
       const side=priorAbility.target==='ownMonster'?earlier.seat:1-earlier.seat;
       earlier.target=newIndex;
       const key=s.players[side].monsters[newIndex]?.key;
       if(Number.isInteger(key))earlier.targetMonsterKey=key;
       else delete earlier.targetMonsterKey; // Firebase cannot store undefined.
       log(s,`「${mustCard(entry.cardId).name}」：直前の魔法の対象を変更しました。`);
     }else log(s,`「${mustCard(entry.cardId).name}」：適切な別の対象がなく不発。`);
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
  // Virus equipment counts the linked monster controller's end phases.
  // Only up to ten physical backrow cards are examined and no effect chain is opened.
  if(s.phase!=='end'){
    for(const owner of s.players){
      for(let i=0;i<owner.backrow.length;i++){
        const equip=owner.backrow[i];
        if(!equip||equip.faceDown||CARD[equip.id]?.ability?.operation!=='preventEquipAttack'||equip.linkOwner!==s.turn)continue;
        const targetSeat=s.turn,host=s.players[targetSeat];
        const at=host.monsters.findIndex(mon=>mon&&mon.key===equip.linkKey&&mon.pos!=='set');
        if(at<0)continue;
        equip.virusEndPhases=(equip.virusEndPhases||0)+1;
        if(equip.virusEndPhases<2)continue;
        // Detach before destroying to ensure the equip returns to its owner once.
        owner.backrow[i]=null;
        const victimName=CARD[host.monsters[at].id]?.name||'モンスター';
        sendToGrave(host,'monsters',at,s,true);
        owner.hand.push(equip.id);
        log(s,`「${CARD[equip.id].name}」：${victimName}を破壊し、装備魔法を持ち主の手札へ戻しました。`);
      }
    }
  }
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
    for(const board of s.players){
      for(let i=0;i<board.monsters.length;i++){
        const item=board.monsters[i];
        if(!item||item.pos==='set')continue;
        const effect=CARD[item.id]?.monsterEffect;
        if(effect?.kind!=='endPhase'||effect.code!=='selfReturnHand'||
           board!==p&&effect.phase!=='both')continue;
        returnMonsterToOwner(s,item,board,'hand');
        board.monsters[i]=null;
        log(s,`「${CARD[item.id].name}」はエンドフェイズに持ち主の手札へ戻りました。`);
      }
    }
    sweepOrphanEquips(s);
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
  for(const pl of s.players){
    if(Number.isInteger(pl.positionLockedTurn)&&pl.positionLockedTurn<nextTurnNo)delete pl.positionLockedTurn;
    if(Number.isInteger(pl.sheepLockTurn)&&pl.sheepLockTurn<nextTurnNo)delete pl.sheepLockTurn;
    if(Number.isInteger(pl.attackSealedThroughTurn)&&pl.attackSealedThroughTurn<nextTurnNo)delete pl.attackSealedThroughTurn;
  }
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
    case 'activateContinuousTrap':cueType='trap';cueCard=p.backrow[a.index]?.id;break;
    case 'activateMainTrap':cueType='trap';cueCard=p.backrow[a.index]?.id;break;
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
    case 'fusionSummon':{assert(p.sheepLockTurn!==s.turnNo,'羊トークンを出したターンは特殊召喚できません');doSpecialSummon(s,seat,a);break;}
    case 'specialSummonSelf':{
      requireMain(s,seat);
      assert(p.sheepLockTurn!==s.turnNo,'羊トークンを出したターンはほかのモンスターを召喚できません');
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],c=mustCard(id);
      const byOwnAbility=['selfSpecialFromHand','selfSpecialFromHandGiveRevive'].includes(c.ability?.operation)&&c.ability?.when==='main';
      const byMaterials=c.monsterEffect?.kind==='hand'&&c.monsterEffect.code==='specialByThreeNames';
      assert(c.type==='monster'&&summonKind(c)==='normal'&&(byOwnAbility||byMaterials),'このカードは手札から特殊召喚できません');
      const tributes=byMaterials?specialHandTributeSlots(s,seat,c):[];
      if(byMaterials)assert(tributes.length===3,'指定名のモンスター3体が場に必要です');
      const slot=p.monsters.findIndex((m,i)=>m===null||tributes.includes(i));assert(slot>=0,'モンスターゾーンが満杯です');
      // Complete all eligibility checks before any state mutation.
      for(const i of tributes)sendToGrave(p,'monsters',i,s);
      p.hand.splice(a.hand,1);
      p.monsters[slot]={key:++s.nextKey,id,ownerSeat:seat,pos:'atk',bornTurn:s.turnNo,changedTurn:s.turnNo,attacked:false,bonus:0};
      log(s,`${p.name}は「${c.name}」を手札から特殊召喚しました。`);
      if(byOwnAbility&&c.ability.operation==='selfSpecialFromHandGiveRevive'){
        const foe=s.players[1-seat],empty=foe.monsters.indexOf(null);
        const at=foe.grave.findLastIndex(cid=>CARD[cid]?.type==='monster'&&summonKind(CARD[cid])==='normal');
        if(empty>=0&&at>=0){
          const borrowed=foe.grave.splice(at,1)[0];
          const revived={key:++s.nextKey,id:borrowed,ownerSeat:1-seat,pos:'atk',bornTurn:s.turnNo,changedTurn:s.turnNo,attacked:false,bonus:0};
          foe.monsters[empty]=revived;
          log(s,`「${c.name}」：相手の墓地の「${CARD[borrowed].name}」を自動で特殊召喚しました（任意選択省略）。`);
          if(CARD[borrowed]?.monsterEffect?.kind==='trigger'&&CARD[borrowed].monsterEffect.code==='copyOpponentPrintedStats')activateMonsterAbility(s,1-seat,revived,'trigger');
        }
      }
      cueType='summon';cueCard=id;break;
    }
    case 'summon': {
      requireMain(s,seat);
      assert(p.sheepLockTurn!==s.turnNo,'羊トークンを出したターンは通常召喚できません');
      const additional=p.normalUsed;
      if(additional)assert(canExtraNormalSummon(s,seat),'通常召喚済みです。表側の追加召喚効果とLPを確認してください');
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],c=mustCard(id);
      assert(c.type==='monster'&&summonKind(c)==='normal','儀式・融合モンスターは通常召喚できません');
      const tributes=a.tributes||[];
      assert(validSummonTributes(c,p.hand.length,p.monsters,tributes),'必要なリリース数またはリリース対象が正しくありません');
      const slot=p.monsters.findIndex((m,i)=>m===null||tributes.includes(i));
      assert(slot>=0,'モンスターゾーンが満杯です');
      if(additional)p.lp-=500; // Paid only after every summon precondition succeeds.
      for(const i of tributes)sendToGrave(p,'monsters',i,s);
      p.hand.splice(a.hand,1);
      p.monsters[slot]={key:++s.nextKey,id,ownerSeat:seat,pos:a.faceDown?'set':(a.position==='def'?'def':'atk'),bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
      const summonedKey=p.monsters[slot].key;
      p.normalUsed=true;
      if(!a.faceDown&&c.subtype==='effect'&&s.status==='playing'){
        if(c.ability?.when==='summon'){
          // The simplified summon-trigger flow cannot ask for a target while summoning.
          // Own-monster effects use the summoned card; opponent-target effects pick
          // the first available opposing monster instead of silently doing nothing.
          const target=summonTriggerTarget(s,seat,c.ability.target,slot);
          if(target!==-1)executeAbility(s,{seat,cardId:id,target,sourceMonsterKey:summonedKey},null);
          else log(s,`「${c.name}」の効果は対象がいないため処理できませんでした。`);
        }else if(c.monsterEffect?.kind==='trigger')activateMonsterAbility(s,seat,p.monsters[slot],'trigger');
      }
      if(additional)log(s,`${p.name} は追加通常召喚のため500LPを支払いました。`);
      log(s,`${p.name} はモンスターを${a.faceDown?'裏側守備表示でセット':a.position==='def'?'守備表示で召喚':'召喚'}しました。`);
      if(!a.faceDown)resolveSummonTrap(s,seat,slot,summonedKey);
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
        const cost=c.monsterEffect?.cost??5000;
        assert(p.lp>cost,`LPが${cost}以下のため発動できません`);
        assert(p.monsters.some(m=>m===null),'モンスターゾーンが満杯です');
        assert(p.extraDeck.some(id=>CARD[id]?.type==='monster'&&summonKind(CARD[id])==='fusion'),'EXデッキに融合モンスターがありません');
      }
      assert(canOfferMonsterIgnition(s,seat,a.index),'このモンスター効果の発動条件を満たしていません');
      const actualTarget=['doubleOriginalAtkEndDestroy','timeWizardCoin','coinBranch'].includes(ab?.operation)?a.index:a.target;
      abilityTargetCheck(s,seat,ab,actualTarget,a.index);
      payBefore(s,seat,ab,a.costIndices,ab.before?.filter&&BEFORE_META[ab.before.operation]?.zone==='monsters'?{zone:'monsters',index:a.index}:null,actualTarget);
      if(ab?.operation==='fusionFromExtraPay5000')p.lp-=(c.monsterEffect?.cost??5000); // activation cost, not on resolution
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
      requireMain(s,seat);assert(p.sheepLockTurn!==s.turnNo,'羊トークンを出したターンは反転召喚できません');const m=getMonster(s,seat,a.index);
      assert(m&&m.pos==='set','裏側守備表示のモンスターではありません');
      assert(p.positionLockedTurn!==s.turnNo,'催眠術の効果で反転召喚できません');
      assert(m.bornTurn!==s.turnNo,'セットしたターンには反転召喚できません');
      m.pos='atk';m.changedTurn=s.turnNo;log(s,`${p.name} は ${CARD[m.id].name} を反転召喚しました。`);
      resolveFlipEffect(s,seat,m);
      // Reuse the same deterministic summon-trigger path for flip summons.
      if(CARD[m.id]?.ability?.when==='summon'){
        const ability=CARD[m.id].ability,target=summonTriggerTarget(s,seat,ability.target,a.index);
        if(target!==-1)executeAbility(s,{seat,cardId:m.id,target,sourceMonsterKey:m.key},null);
      }
      if(CARD[m.id]?.monsterEffect?.kind==='trigger'&&['searchDeckOnSummon','copyOpponentPrintedStats'].includes(CARD[m.id].monsterEffect.code))activateMonsterAbility(s,seat,m,'trigger');
      resolveSummonTrap(s,seat,a.index,m.key);
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
        if(at>=0){const victim=CARD[enemy.monsters[at].id]?.name||'モンスター';sendToGrave(enemy,'monsters',at,s,true);log(s,`「${CARD[m.id].name}」：${victim}を破壊しました（自動選択）。`);}
        else log(s,`「${CARD[m.id].name}」：相手フィールドに対象がありません。`);
      }
      break;
    }
    case 'attack': {
      assert(ownTurn&&s.phase==='battle','バトルフェイズではありません');
      assert(!s.pending,'すでに攻撃の対応待ちです');
      assert(s.turnNo>1,'先攻1ターン目は攻撃できません');
      assert((p.attackSealedThroughTurn||0)<s.turnNo,'光の護封剣の効果で攻撃できません');
      const m=getMonster(s,seat,a.index);
      assert(m&&m.pos==='atk','攻撃表示のモンスターを選んでください');
      assert(remainingAttacks(m)>0,'このモンスターはすでに規定回数攻撃しました');
      assert((m.attackLockedUntil||0)<s.turnNo&&!isAttackSealedByEquip(s,seat,m),'このモンスターは攻撃を封じられています');
      const tributeAttack=m&&CARD[m.id]?.ability?.operation==='tributeOtherToAttack';
      const tributeAt=tributeAttack?p.monsters.findIndex((x,i)=>i!==a.index&&x):-1;
      if(tributeAttack)assert(tributeAt>=0,'攻撃するにはほかの自分のモンスター1体が必要です');
      // -1 is a Firebase-safe sentinel; null would silently disappear in RTDB.
      // Reject omitted targets, rather than accidentally treating them as direct attacks.
      assert(Object.hasOwn(a,'target'),'攻撃対象を選んでください');
      const target=a.target===null||a.target===-1?-1:a.target;
      if(target===-1)assert(canDirectAttackWithMonsters(s,seat,m),'相手のモンスターがいるため直接攻撃できません');
      else assert(isAttackTargetLegal(s,seat,target),'このモンスターは攻撃対象に選択できません');
      // Cost is sent to the grave only after attack legality has been checked.
      if(tributeAt>=0)sendToGrave(p,'monsters',tributeAt,s);
      m.attackCount=(Number.isInteger(m.attackCount)?Math.max(0,m.attackCount):(m.attacked?1:0))+1;
      m.attacked=true;
      const postAttack=CARD[m.id]?.monsterEffect;
      if(postAttack?.kind==='continuous'&&postAttack.code==='postAttackDefenseLock'){
        m.postAttackDefenseTurn=s.turnNo;
        m.positionLockedThroughTurn=s.turnNo+2*(postAttack.lockTurns??1);
      }
      s.pending={kind:'attack',by:seat,attacker:a.index,target,
        ...(m.key!==undefined?{attackerKey:m.key}:{}),
        ...(target>=0&&enemy.monsters[target]?.key!==undefined?{targetKey:enemy.monsters[target].key}:{})};
      log(s,`${p.name} の攻撃宣言。${enemy.name} は罠を使うか選んでください。`);break;
    }
    case 'discardBattleGuard': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'相手の攻撃に対応中のみ発動できます');
      assert(s.pending.preventBattleDamageSeat!==seat,'この戦闘では既にダメージを防いでいます');
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],e=CARD[id]?.monsterEffect;
      assert(e?.kind==='hand'&&e.code==='preventBattleDamage','このカードの効果は発動できません');
      p.hand.splice(a.hand,1);p.grave.push(id);
      s.pending.preventBattleDamageSeat=seat;
      log(s,`「${CARD[id].name}」を手札から捨て、この戦闘での自分へのダメージを0にします。`);
      cueType='effect';cueCard=id;break;
    }
    case 'passAttack': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'対応できる攻撃がありません');
      cueType='impact';cueActor=s.pending.by;cueCard=s.players[cueActor].monsters[s.pending.attacker]?.id||null;
      cueSlot=s.pending.attacker;cueTarget=s.pending.target==null?-1:s.pending.target;cueTargetSeat=1-cueActor;
      log(s,`${p.name} はカードを発動しませんでした。`);resolveAttack(s);break;
    }
    case 'activateMainTrap': {
      requireMain(s,seat);
      assert(!trapsSuppressed(s),'罠カードは無効化されています');
      assert(arrayIndex(p.backrow,a.index),'ゾーンが不正です');
      const item=p.backrow[a.index];
      assert(item?.faceDown===true&&item.setTurn<s.turnNo,'セットした次のターン以降に発動できます');
      const card=mustCard(item.id),ab=card.ability;
      if(ab?.when==='main'&&ab.operation==='graveRevive')
        assert(p.monsters.includes(null)&&p.grave.some(id=>matchesDeckFilter(CARD[id],ab.filter)),'蘇生先のモンスターと空きゾーンが必要です');
      assert(canActivateMainTrap(s,seat,a.index),'この罠は現在のメインフェイズに発動できません');
      abilityTargetCheck(s,seat,ab,a.target);
      // Main-phase virus uses the same validated up-front cost as a response trap.
      // Invalid selections are rejected without consuming either the trap or monsters.
      payBefore(s,seat,ab,a.costIndices,{zone:'backrow',index:a.index},a.target);
      p.backrow[a.index]=null;
      startChain(s,chainEntry(seat,item.id,a.target,true));
      break;
    }
    case 'activateContinuousTrap': {
      requireMain(s,seat);
      assert(!trapsSuppressed(s),'罠カードの効果は無効化されています');
      assert(arrayIndex(p.backrow,a.index),'ゾーンが不正です');
      const item=p.backrow[a.index];
      assert(item&&item.faceDown&&item.setTurn<s.turnNo,'セットした次のターン以降に発動できます');
      const card=mustCard(item.id);
      assert(card.type==='trap'&&card.ability?.when==='continuous'&&
        card.ability.operation==='extraNormalSummon'&&card.ability.amount===500,'この永続罠は発動できません');
      item.faceDown=false;
      log(s,`${p.name} は「${card.name}」を発動しました。`);
      break;
    }
    case 'activateTrap': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'相手の攻撃時に発動できます');
      assert(!trapsSuppressed(s),'サイコ・ショッカーの効果で罠カードを発動できません');
      assert(arrayIndex(p.backrow,a.index),'ゾーンが不正です');
      const item=p.backrow[a.index];assert(item&&mustCard(item.id).type==='trap','セットされた罠カードがありません');
      assert(item.faceDown===true,'セット状態の罠カードだけ発動できます');
      assert(item.setTurn<s.turnNo,'セットしたターンに罠は発動できません');
      const c=mustCard(item.id),ab=actionAbility(c);assert(ab?.when==='attack','この攻撃に対応できない罠です');
      if(ab.operation==='diceStats')assert(s.players[ab.target==='ownAllMonsters'?seat:1-seat].monsters.some(m=>m&&m.pos!=='set'),
        '効果を受ける表側表示モンスターがいません');
      if(ab.operation==='redirectAttack')assert(redirectedAttackSlot(s,s.pending)>=0,'攻撃対象を変更できる別のモンスターがありません');
 if(ab.operation==='redirectToAttackerAlly')assert(attackerAllySlot(s,seat,s.pending)>=0,'攻撃者側に別の表側モンスターがありません');
      if(ab.operation==='concealDefender')assert(concealDefenderSlot(s,seat,s.pending)>=0,'裏側守備にできる攻撃対象がありません');
      abilityTargetCheck(s,seat,ab,a.target);
      assert(canActivateAttackTrap(s,seat,a.index),'この攻撃に対して発動できません');
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
    case 'nextPhase': {
      assert(ownTurn&&!s.pending,'今は進められません');
      if(s.phase==='draw'){if(s.turnNo>1&&draw(p,1,s)){cueType='draw';cueCard=null;}if(s.status==='playing')s.phase='main1';}
      else if(s.phase==='main1')s.phase=s.turnNo===1||(p.attackSealedThroughTurn||0)>=s.turnNo?'main2':'battle';
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
