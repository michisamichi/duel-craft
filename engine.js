import {CARD, expandDeck, shuffle, validDeck, spellKind, persistentSpell, summonKind} from './cards.js?v=196';
import {normalizeRuleSettings} from './rules.js?v=196';

export const PHASES = {draw:'ドロー',main1:'メイン1',battle:'バトル',main2:'メイン2',end:'エンド'};
const blank5 = () => [null,null,null,null,null];
const fail = msg => {throw new Error(msg)};
const assert = (cond,msg) => {if(!cond) fail(msg)};
const opponent = seat => 1-seat;
const mustCard = id => {assert(!!CARD[id],'不明なカードです');return CARD[id];};
// Continuous modifiers are derived from the board; no recalculation state is stored.
function continuousStatBonus(item,state,seat,stat){
 const card=CARD[item?.id];if(!card||item.pos==='set')return 0;
 let result=0;
 const plus=stat==='atk'?'boost':'boostDef',minus=stat==='atk'?'weaken':'weakenDef';
 const own=card.ability?.when==='continuous'?card.ability:null;
 if(own&&own.operation===plus)result+=own.amount;
 if(own&&own.operation===minus)result-=own.amount;
 if(card.subtype==='effect'&&card.monsterEffect?.kind==='continuous'&&stat==='atk')
   result+=card.monsterEffect.code==='atk300'?300:card.monsterEffect.code==='atk500'?500:0;
 if(!state||seat===null)return result;
 for(let ownerSeat=0;ownerSeat<2;ownerSeat++){
  const p=state.players[ownerSeat];if(!p)continue;
  for(const slot of [...(p.backrow||[]),p.field]){
   if(!slot||slot.faceDown)continue;
   const spell=CARD[slot.id],ab=actionAbility(spell);
   if(spell?.type!=='spell'||!persistentSpell(spell)||ab?.when!=='continuous')continue;
   if(ab.operation!==plus&&ab.operation!==minus)continue;
   const kind=spellKind(spell);
   let applies=false;
   if(kind==='field'||!slot.linkKey){
    applies=ab.target==='bothMonsters'||
      (['ownMonster','ownAllMonsters'].includes(ab.target)&&seat===ownerSeat)||
      (['enemyMonster','enemyAllMonsters'].includes(ab.target)&&seat!==ownerSeat);
   }else applies=slot.linkKey===item.key&&(slot.linkOwner??ownerSeat)===seat;
   if(applies)result+=(ab.operation===plus?1:-1)*ab.amount;
  }
 }
 return result;
}
export function effectiveAtk(item,state=null,seat=null){
 const c=CARD[item?.id];return c?Math.max(0,c.atk+(item.bonus||0)+continuousStatBonus(item,state,seat,'atk')):0;
}
export function effectiveDef(item,state=null,seat=null){
 const c=CARD[item?.id];return c?Math.max(0,c.def+(item.defBonus||0)+continuousStatBonus(item,state,seat,'def')):0;
}
function activateMonsterAbility(s,seat,item,kind){
  const c=mustCard(item.id), e=c.monsterEffect;
  assert(c.subtype==='effect'&&e?.kind===kind,'この種類の効果は発動できません');
  const p=s.players[seat],enemy=s.players[1-seat];
  switch(e.code){
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

const log = (s,text) => {s.log.unshift(text);s.log=s.log.slice(0,30);};
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
  if(item){originalOwner(s,item,p).grave.push(item.id);p[zone][index]=null;
    if(zone==='monsters'&&item.key!==undefined)removeOrphanEquips(p);
  }
}
function removeOrphanEquips(p){
  const alive=new Set(p.monsters.filter(Boolean).map(m=>m.key));
  for(let i=0;i<p.backrow.length;i++){
    const v=p.backrow[i];if(v?.linkKey!==undefined&&(v.linkOwner===undefined||v.linkOwner==='own')&&!alive.has(v.linkKey)){
      p.grave.push(v.id);p.backrow[i]=null;
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
function resolveAttack(s) {
  const a=s.pending;
  assert(a?.kind==='attack','処理する攻撃がありません');
  const atkP=s.players[a.by],defP=s.players[1-a.by];
  const attacker=atkP.monsters[a.attacker];
  if(!attacker){log(s,'攻撃モンスターがいないため、攻撃は終了しました。');s.pending=null;return;}
  const atk=effectiveAtk(attacker,s,a.by);
  if(a.target===null) {
    if(defP.monsters.some(Boolean)) {log(s,'相手のモンスターがいるため直接攻撃できません。');}
    else{defP.lp=Math.max(0,defP.lp-atk);log(s,`${atkP.name} の直接攻撃！ ${defP.name} に${atk}ダメージ。`);}
  } else {
    const defender=defP.monsters[a.target];
    if(!defender) {log(s,'対象モンスターがいなくなったため攻撃は終了しました。');s.pending=null;return;}
    const dc=mustCard(defender.id);
    if(defender.pos==='set'){defender.pos='def';log(s,`${dc.name} が表になりました。`);}
    const isAtk=defender.pos==='atk';
    const power=isAtk?effectiveAtk(defender,s,1-a.by):effectiveDef(defender,s,1-a.by);
    if(atk>power){
      sendToGrave(defP,'monsters',a.target,s);
      if(isAtk)defP.lp=Math.max(0,defP.lp-(atk-power));
      log(s,`${mustCard(attacker.id).name} が ${dc.name} を破壊！${isAtk?` ${atk-power}ダメージ。`:''}`);
    } else if(atk<power) {
      if(isAtk)sendToGrave(atkP,'monsters',a.attacker,s);
      atkP.lp=Math.max(0,atkP.lp-(power-atk));
      log(s,`${dc.name} が攻撃を防ぎ、${atkP.name} に${power-atk}ダメージ。`);
    } else {
      if(isAtk){sendToGrave(atkP,'monsters',a.attacker,s);sendToGrave(defP,'monsters',a.target,s);log(s,'攻撃力が同じため、両方のモンスターが破壊されました。');}
      else log(s,'攻撃力と守備力が同じため、どちらも破壊されません。');
    }
  }
  s.pending=null;sweepOrphanEquips(s);checkWinner(s);
}
function actionAbility(card){
 if(card?.ability)return card.ability;
 if(card?.type==='spell'){
  const op={draw2:['draw','self',2],heal1000:['heal','self',1000],burn800:['damage','opponent',800],destroy:['destroy','enemyMonster',0],boost500:['boost','ownMonster',500]}[card.effect];
  return op?{when:'main',operation:op[0],target:op[1],amount:op[2]}:null;
 }
 if(card?.type==='trap'){
  const op={negate:['negateAttack','none',0],counterdestroy:['destroy','attacker',0],counterburn:['damage','opponent',700]}[card.effect];
  return op?{when:'attack',operation:op[0],target:op[1],amount:op[2]}:null;
 }
 if(card?.monsterEffect){
  const op={draw1:['draw','self',1],heal500:['heal','self',500],burn500:['damage','opponent',500],atk500:['boost','ownMonster',500],destroy1:['destroy','enemyMonster',0]}[card.monsterEffect.code];
  return op?{when:card.monsterEffect.kind==='trigger'?'summon':card.monsterEffect.kind==='continuous'?'continuous':'main',operation:op[0],target:op[1],amount:op[2]}:null;
 }
 return null;
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
 if(ab.target==='attacker')assert(s.pending?.kind==='attack'||s.pending?.afterAttack,'攻撃中のみ選べます');
}
function abilityMonsterRefs(s,seat,target,index,chain){
 const one=(side,at)=>Number.isInteger(at)&&at>=0&&at<5&&s.players[side].monsters[at]?[{side,index:at}]:[];
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
 const sides=target==='ownAllBackrow'?[seat]:target==='enemyAllBackrow'?[1-seat]:[];
 return sides.flatMap(side=>s.players[side].backrow.flatMap((m,i)=>m?[{side,index:i}]:[]));
}
function executeAbility(s,entry,chain){
 const seat=entry.seat,p=s.players[seat],card=mustCard(entry.cardId);
 const ab=actionAbility(card);if(!ab)return;
 // A continuous spell's stat changes are already included in effectiveAtk/Def.
 // Resolving it must not add a second, temporary stat bonus.
 if(card.type==='spell'&&ab.when==='continuous'){
   log(s,`${p.name}：「${card.name}」の永続効果が適用されました。`);return;
 }
 const recipient=ab.target==='opponent'?1-seat:seat;
 const player=s.players[recipient],qty=ab.amount;
 // All mutations are bounded by the 5-slot field and a maximum of 10 cards.
 const monsters=abilityMonsterRefs(s,seat,ab.target,entry.target,chain);
 const backrow=abilityBackrowRefs(s,seat,ab.target,entry.target);
 const monsterOps=new Set(['destroy','banish','sendGrave','returnHand','returnDeck','changePosition','setAtk','setDef','boost','weaken','boostDef','weakenDef','lockAttack','lockEffect','steal']);
 if(monsterOps.has(ab.operation)){
  for(const {side,index} of monsters){
   const owner=s.players[side],item=owner.monsters[index];if(!item)continue;
   switch(ab.operation){
    case 'destroy':case 'sendGrave':sendToGrave(owner,'monsters',index,s);break;
    case 'banish':originalOwner(s,item,owner).banished.push(item.id);owner.monsters[index]=null;break;
    case 'returnHand':returnMonsterToOwner(s,item,owner,'hand');owner.monsters[index]=null;break;
    case 'returnDeck':returnMonsterToOwner(s,item,owner,'deck');owner.monsters[index]=null;break;
    case 'changePosition':if(item.pos==='set')item.pos='atk';else item.pos=item.pos==='atk'?'def':'atk';item.changedTurn=s.turnNo;break;
    case 'boost':item.bonus=(item.bonus||0)+qty;break;
    case 'weaken':item.bonus=(item.bonus||0)-qty;break;
    case 'boostDef':item.defBonus=(item.defBonus||0)+qty;break;
    case 'weakenDef':item.defBonus=(item.defBonus||0)-qty;break;
    case 'setAtk':item.bonus=(item.bonus||0)+qty-effectiveAtk(item,s,side);break;
    case 'setDef':item.defBonus=(item.defBonus||0)+qty-effectiveDef(item,s,side);break;
    case 'lockAttack':item.attackLockedUntil=Math.max(item.attackLockedUntil||0,s.turnNo+2);break;
    case 'lockEffect':item.effectLockedUntil=Math.max(item.effectLockedUntil||0,s.turnNo+2);break;
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
   const owner=s.players[side],item=owner.backrow[index];if(!item)continue;
   owner.backrow[index]=null;
   if(ab.operation==='destroyBackrow')owner.grave.push(item.id);
   else if(ab.operation==='banishBackrow')owner.banished.push(item.id);
   else owner.hand.push(item.id);
  }
 }else switch(ab.operation){
  case 'draw':draw(player,qty,s);break;
  case 'heal':player.lp+=qty;break;
  case 'damage':player.lp=Math.max(0,player.lp-qty);break;
  case 'setLP':player.lp=qty;break;
  case 'halfLP':player.lp=Math.floor(player.lp/2);break;
  case 'searchMonster':case 'searchSpell':case 'searchTrap':{
   const type=ab.operation==='searchMonster'?'monster':ab.operation==='searchSpell'?'spell':'trap';
   for(let i=0;i<qty;i++){
    const pos=player.deck.findIndex(id=>CARD[id]?.type===type);
    if(pos<0)break;
    player.hand.push(player.deck.splice(pos,1)[0]);
   }
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
  case 'banishDeck':player.banished.push(...player.deck.splice(0,qty));break;
  case 'shuffleDeck':player.deck=shuffle(player.deck);break;
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
  case 'graveRevive':{
   for(let i=0;i<qty;i++){
    const slot=player.monsters.indexOf(null);
    const graveIndex=player.grave.findLastIndex(id=>CARD[id]?.type==='monster');
    if(slot<0||graveIndex<0)break;
    const id=player.grave.splice(graveIndex,1)[0];
    player.monsters[slot]={key:++s.nextKey,id,pos:'atk',bornTurn:s.turnNo,attacked:true,changedTurn:s.turnNo,bonus:0};
   }
   break;
  }
  case 'negateAttack':if(chain)chain.attackNegated=true;break;
  // negateEffect is handled during chain resolution, so it can counter its predecessor.
  case 'negateEffect':break;
 }
 if(card.type==='trap'&&!card.ability&&chain?.afterAttack&&['counterburn','negate'].includes(card.effect))chain.attackNegated=true;
 log(s,`${p.name}：「${card.name}」の効果を解決しました。`);
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
function startChain(s,entry,afterAttack=null){
 assert(!s.pending||s.pending.kind==='attack','対応処理中です');
 s.pending={kind:'chain',stack:[{...chainEntry(entry.seat,entry.cardId,entry.target,entry.discardOnResolve),...(entry.persistentZone?{persistentZone:entry.persistentZone,...entry.persistentZone==='backrow'?{persistentIndex:entry.persistentIndex}:{}}:{})}],priority:1-entry.seat,passes:0,afterAttack,attackNegated:false};
 log(s,`チェーン1：「${mustCard(entry.cardId).name}」発動。相手の応答を待ちます。`);
}
function castSpell(s,seat,source,index,target){
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
  if(!(kind==='field'&&ab.when==='continuous'))abilityTargetCheck(s,seat,ab,target);
  // 装備魔法は対象のモンスターに紐付ける。移動しても装備関係は維持する。
  if(kind==='equip'){
    assert(['ownMonster','enemyMonster'].includes(ab.target)&&Number.isInteger(target),'装備するモンスターを選んでください');
    const monster=getMonster(s,ab.target==='ownMonster'?seat:1-seat,target);
    if(monster.key===undefined)monster.key=++s.nextKey;
  }
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
  ch.stack.push(entry);ch.priority=1-seat;ch.passes=0;
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
    assert([...items.map(m=>m.id)].sort().join(',')===[...card.fusionMaterials].sort().join(','),'融合素材が一致しません');
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
      if(e.code!=='destroy1')activateMonsterAbility(s,seat,summoned,'trigger');
    }
  }
  checkWinner(s);
  return id;
}
function addChainTrap(s,seat,index,target){
 const ch=s.pending;assert(ch?.kind==='chain'&&ch.priority===seat,'チェーンの応答順ではありません');
 assert(ch.stack.length<8,'チェーンは最大8つまでです');
 const item=s.players[seat].backrow[index];assert(item&&mustCard(item.id).type==='trap','罠カードがありません');
 assert(item.setTurn<s.turnNo,'セットしたターンに罠は使えません');
 const c=mustCard(item.id),ab=actionAbility(c);assert(ab&&(ab.when==='response'||(ab.when==='attack'&&ch.afterAttack)),'今はこの罠を発動できません');
 abilityTargetCheck(s,seat,ab,target);
 s.players[seat].backrow[index]=null;
 ch.stack.push(chainEntry(seat,item.id,target,true));ch.priority=1-seat;ch.passes=0;
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
 sweepOrphanEquips(s);
  if(after&&s.status==='playing'&&!ch.attackNegated){s.pending={kind:'attack',...after};resolveAttack(s);}
 else if(after)log(s,'攻撃は無効になりました。');
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

function endTurn(s) {
  assert(!s.pending,'相手の対応が終わっていません');
  const p=s.players[s.turn];assert(s.phase!=='draw','ドローフェイズを完了してください');
  // Official OCG hand-size adjustment: never discard freely during main/battle.
  // If there are more than six cards, remain in End Phase until the owner selects discards.
  if(p.hand.length>6){
    assert(s.phase!=='end','手札を6枚にするまで、捨てるカードを選んでください');
    s.phase='end';
    log(s,`${p.name}：エンドフェイズ。手札を6枚にしてください。`);
    return;
  }
  for(const pl of s.players)for(const mon of pl.monsters)if(mon){mon.bonus=0;mon.defBonus=0;}
  s.turn=1-s.turn;s.turnNo++;s.phase='main1';s.players[s.turn].normalUsed=false;
  const active=s.players[s.turn];
  for(const mon of active.monsters)if(mon)mon.attacked=false;
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
  const before=takeSnapshot(s);
  const seat=s.players.findIndex(p=>p?.uid===actorUid);
  reqOwn(s,seat);
  const p=s.players[seat],enemy=s.players[1-seat];
  const a=action||{};
  const ownTurn=s.turn===seat;
  const lpBefore=s.players.map(q=>q.lp);
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
  // Store only a public, non-sensitive cue for audiovisual sync.
  let cueType=null, cueCard=null;
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
      const need=c.level<=4?0:c.level<=6?1:2;
      const tributes=a.tributes||[];
      assert(Array.isArray(tributes)&&tributes.length===need,'必要なリリース数が違います');
      assert(new Set(tributes).size===tributes.length,'同じモンスターを2回リリースできません');
      assert(tributes.every(i=>Number.isInteger(i)&&!!getMonster(s,seat,i)),'リリースするモンスターを正しく選んでください');
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
      const ab=actionAbility(c);abilityTargetCheck(s,seat,ab,a.target,a.index);
      m.effectUsedTurn=s.turnNo;
      startChain(s,{seat,cardId:m.id,target:ab.target==='ownMonster'&&a.target===undefined?a.index:a.target});
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
      castSpell(s,seat,'hand',a.hand,a.target);break;
    }
    case 'spellFromField': {
      castSpell(s,seat,a.field?'field':'backrow',a.index,a.target);break;
    }
    case 'quickResponse': {
      assert(['hand','backrow'].includes(a.source),'発動場所が不正です');
      castSpell(s,seat,a.source,a.index,a.target);break;
    }
    case 'flip': {
      requireMain(s,seat);const m=getMonster(s,seat,a.index);
      assert(m&&m.pos==='set','裏側守備表示のモンスターではありません');
      assert(m.bornTurn!==s.turnNo,'セットしたターンには反転召喚できません');
      m.pos='atk';m.changedTurn=s.turnNo;log(s,`${p.name} は ${CARD[m.id].name} を反転召喚しました。`);break;
    }
    case 'changePosition': {
      requireMain(s,seat);const m=getMonster(s,seat,a.index);
      assert(m&&m.pos!=='set','表側のモンスターを選んでください');
      assert(m.bornTurn!==s.turnNo,'召喚したターンには表示形式を変更できません');
      assert(m.changedTurn!==s.turnNo,'このターンはすでに表示形式を変更しました');
      assert(!m.attacked,'攻撃したモンスターは表示形式を変更できません');
      m.pos=m.pos==='atk'?'def':'atk';m.changedTurn=s.turnNo;log(s,`${p.name} はモンスターの表示形式を変更しました。`);break;
    }
    case 'attack': {
      assert(ownTurn&&s.phase==='battle','バトルフェイズではありません');
      assert(!s.pending,'すでに攻撃の対応待ちです');
      assert(s.turnNo>1,'先攻1ターン目は攻撃できません');
      const m=getMonster(s,seat,a.index);
      assert(m&&m.pos==='atk','攻撃表示のモンスターを選んでください');
      assert(!m.attacked,'このモンスターはすでに攻撃しました');
      assert((m.attackLockedUntil||0)<s.turnNo,'このモンスターは攻撃を封じられています');
      const target=a.target===null?null:a.target;
      if(target===null)assert(!enemy.monsters.some(Boolean),'相手のモンスターがいるため直接攻撃できません');
      else assert(Number.isInteger(target)&&!!getMonster(s,1-seat,target),'攻撃対象を選んでください');
      m.attacked=true;s.pending={kind:'attack',by:seat,attacker:a.index,target};
      log(s,`${p.name} の攻撃宣言。${enemy.name} は罠を使うか選んでください。`);break;
    }
    case 'passAttack': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'対応できる攻撃がありません');
      log(s,`${p.name} はカードを発動しませんでした。`);resolveAttack(s);break;
    }
    case 'activateTrap': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'相手の攻撃時に発動できます');
      assert(arrayIndex(p.backrow,a.index),'ゾーンが不正です');
      const item=p.backrow[a.index];assert(item&&mustCard(item.id).type==='trap','セットされた罠カードがありません');
      assert(item.setTurn<s.turnNo,'セットしたターンに罠は発動できません');
      const c=mustCard(item.id),ab=actionAbility(c);assert(ab?.when==='attack','この攻撃に対応できない罠です');
      abilityTargetCheck(s,seat,ab,a.target);
      const attack=s.pending;
      p.backrow[a.index]=null;
      startChain(s,{seat,cardId:item.id,target:a.target,discardOnResolve:true},attack);
      break;
    }
    case 'chainPass': {
      const ch=s.pending;assert(ch?.kind==='chain'&&ch.priority===seat,'あなたの応答順ではありません');
      ch.passes++;ch.priority=1-seat;
      if(ch.passes>=2)finishChain(s);
      else log(s,`${p.name} はチェーンを追加しませんでした。`);
      break;
    }
    case 'chainTrap': {
      assert(Number.isInteger(a.index),'罠の位置が不正です');
      addChainTrap(s,seat,a.index,a.target);break;
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
    case 'manualDestroy': case 'manualBanish':{
      requireMain(s,seat);assert(['monsters','backrow','field'].includes(a.zone),'ゾーンが不正です');
      assert(a.zone==='field'?!!p.field:Number.isInteger(a.index)&&p[a.zone][a.index],'対象カードがありません');
      const item=a.zone==='field'?p.field:p[a.zone][a.index];
      if(a.zone==='field')p.field=null;else p[a.zone][a.index]=null;
      const owner=a.zone==='monsters'?originalOwner(s,item,p):p;
      if(a.type==='manualDestroy')owner.grave.push(item.id);else owner.banished.push(item.id);
      sweepOrphanEquips(s);
      log(s,`${p.name} が自分のカード「${mustCard(item.id).name}」を${a.type==='manualDestroy'?'墓地へ送りました':'除外しました'}。`);break;
    }
    case 'banishGrave':{
      requireMain(s,seat);assert(Number.isInteger(a.index)&&a.index>=0&&a.index<p.grave.length,'墓地の位置が不正です');
      p.banished.push(p.grave.splice(a.index,1)[0]);log(s,`${p.name} は墓地から1枚除外しました。`);break;
    }
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
      else if(s.phase==='battle')s.phase='main2';
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
  sweepOrphanEquips(s);
  s.undoSnapshot=before;s.undoActor=seat;s.undoRequest=null;
  s.revision=(s.revision||0)+1;
  if(s.status==='finished'&&current.status!=='finished'){cueType='win';cueCard=null;}
  // Do not write a drawn card id into the shared event; only the drawing iPhone
  // resolves its latest hand card when displaying the enlarged preview.
  if(['endTurn','discard'].includes(a.type)&&s.status==='playing'&&s.turn!==seat){
    s.lastEvent={id:s.revision,type:'draw',cardId:null,actor:s.turn,damage:0};
  }else if(cueType){
    const damage=lpBefore.reduce((v,old,i)=>v+Math.max(0,old-s.players[i].lp),0);
    s.lastEvent={id:s.revision,type:cueType,cardId:cueCard||null,actor:seat,damage};
  }
  return s;
}
