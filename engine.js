import {CARD, expandDeck, shuffle, validDeck} from './cards.js';

export const PHASES = {main1:'メイン1',battle:'バトル',main2:'メイン2'};
const blank5 = () => [null,null,null,null,null];
const fail = msg => {throw new Error(msg)};
const assert = (cond,msg) => {if(!cond) fail(msg)};
const opponent = seat => 1-seat;
const mustCard = id => {assert(!!CARD[id],'不明なカードです');return CARD[id];};
const log = (s,text) => {s.log.unshift(text);s.log=s.log.slice(0,30);};
/** RTDB は null しかない配列や空配列を省略するため、読み込み時に形を復元。 */
export function normalizeRoom(s) {
  if(!s)return null;
  if(!Array.isArray(s.players))s.players=[s.players?.[0]||null,s.players?.[1]||null];
  for(const p of s.players){
    if(!p)continue;
    for(const field of ['monsters','backrow']){
      const original=p[field]||{};
      p[field]=Array.from({length:5},(_,i)=>original[i]??null);
    }
    for(const field of ['hand','deck','grave']){
      const original=p[field]||[];
      p[field]=Array.isArray(original)?original:Object.keys(original).sort((a,b)=>+a-+b).map(k=>original[k]);
    }
    p.normalUsed=!!p.normalUsed;
  }
  s.log=s.log||[];
  s.pending=s.pending||null;
  return s;
}
const newPlayer = ({uid,name,counts}) => {
  assert(validDeck(counts),'デッキは40枚、同じカードは3枚までです');
  return {uid, name:String(name||'プレイヤー').slice(0,12),
    deck:shuffle(expandDeck(counts)), hand:[], monsters:blank5(), backrow:blank5(), grave:[],
    lp:8000,normalUsed:false};
};
export function createRoom({uid,name,counts}) {
  return {status:'waiting',players:[newPlayer({uid,name,counts}),null],turn:0,turnNo:1,
    phase:'main1',pending:null,winner:null,log:['対戦相手の入室を待っています'],revision:0,createdAt:Date.now()};
}
export function joinRoom(state,{uid,name,counts}) {
  assert(state?.status==='waiting','参加できる部屋ではありません');
  assert(state.players[0].uid!==uid,'同じ端末からはオンライン対戦に参加できません');
  assert(!state.players[1],'すでに2人参加しています');
  const s=normalizeRoom(structuredClone(state));
  s.players[1]=newPlayer({uid,name,counts});
  s.status='playing';s.turn=Math.random()<0.5?0:1;
  s.turnNo=1; s.phase='main1';s.log=[];
  for(const p of s.players) draw(p,5,s,false);
  log(s,`対戦開始！ ${s.players[s.turn].name} が先攻です。`);
  s.revision++;
  return s;
}
export function createDemo({counts1,counts2}) {
  const s=createRoom({uid:'demo-a',name:'プレイヤー1',counts:counts1});
  return joinRoom(s,{uid:'demo-b',name:'プレイヤー2',counts:counts2});
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
function sendToGrave(p,zone,index) {
  const item=p[zone][index];
  if(item){p.grave.push(item.id);p[zone][index]=null;}
}
function resolveAttack(s) {
  const a=s.pending;
  assert(a?.kind==='attack','処理する攻撃がありません');
  const atkP=s.players[a.by],defP=s.players[1-a.by];
  const attacker=atkP.monsters[a.attacker];
  if(!attacker){log(s,'攻撃モンスターがいないため、攻撃は終了しました。');s.pending=null;return;}
  const atk=mustCard(attacker.id).atk+(attacker.bonus||0);
  if(a.target===null) {
    if(defP.monsters.some(Boolean)) {log(s,'相手のモンスターがいるため直接攻撃できません。');}
    else{defP.lp=Math.max(0,defP.lp-atk);log(s,`${atkP.name} の直接攻撃！ ${defP.name} に${atk}ダメージ。`);}
  } else {
    const defender=defP.monsters[a.target];
    if(!defender) {log(s,'対象モンスターがいなくなったため攻撃は終了しました。');s.pending=null;return;}
    const dc=mustCard(defender.id);
    if(defender.pos==='set'){defender.pos='def';log(s,`${dc.name} が表になりました。`);}
    const isAtk=defender.pos==='atk';
    const power=isAtk?dc.atk+(defender.bonus||0):dc.def;
    if(atk>power){
      sendToGrave(defP,'monsters',a.target);
      if(isAtk)defP.lp=Math.max(0,defP.lp-(atk-power));
      log(s,`${mustCard(attacker.id).name} が ${dc.name} を破壊！${isAtk?` ${atk-power}ダメージ。`:''}`);
    } else if(atk<power) {
      if(isAtk)sendToGrave(atkP,'monsters',a.attacker);
      atkP.lp=Math.max(0,atkP.lp-(power-atk));
      log(s,`${dc.name} が攻撃を防ぎ、${atkP.name} に${power-atk}ダメージ。`);
    } else {
      if(isAtk){sendToGrave(atkP,'monsters',a.attacker);sendToGrave(defP,'monsters',a.target);log(s,'攻撃力が同じため、両方のモンスターが破壊されました。');}
      else log(s,'攻撃力と守備力が同じため、どちらも破壊されません。');
    }
  }
  s.pending=null;checkWinner(s);
}
function spellAllowedTarget(s,seat,cardId,target) {
  const c=mustCard(cardId);
  if(c.effect==='destroy') {
    assert(Number.isInteger(target)&&!!getMonster(s,1-seat,target),'破壊する相手モンスターを選んでください');
  } else if(c.effect==='boost500') {
    assert(Number.isInteger(target)&&!!getMonster(s,seat,target),'強化する自分のモンスターを選んでください');
    assert(getMonster(s,seat,target).pos==='atk','表側攻撃表示のモンスターを選んでください');
  } else assert(target===undefined||target===null,'対象が不要なカードです');
}
function activateSpell(s,seat,id,target) {
  const c=mustCard(id),p=s.players[seat],enemy=s.players[opponent(seat)];
  assert(c.type==='spell','魔法カードではありません');
  spellAllowedTarget(s,seat,id,target);
  switch(c.effect) {
    case 'draw2': assert(p.deck.length>=2,'デッキが2枚未満なので使えません');draw(p,2,s);break;
    case 'heal1000':p.lp+=1000;break;
    case 'burn800':enemy.lp=Math.max(0,enemy.lp-800);break;
    case 'destroy':sendToGrave(enemy,'monsters',target);break;
    case 'boost500':p.monsters[target].bonus=(p.monsters[target].bonus||0)+500;break;
    default:fail('対応していない効果です');
  }
  p.grave.push(id);log(s,`${p.name} は魔法「${c.name}」を発動しました。`);checkWinner(s);
}
function endTurn(s) {
  assert(!s.pending,'相手の対応が終わっていません');
  const p=s.players[s.turn];assert(p.hand.length<=6,'手札が7枚以上あります。6枚以下になるまで手札を捨ててください。');
  for(const pl of s.players)for(const mon of pl.monsters)if(mon)mon.bonus=0;
  s.turn=1-s.turn;s.turnNo++;s.phase='main1';s.players[s.turn].normalUsed=false;
  const active=s.players[s.turn];
  for(const mon of active.monsters)if(mon)mon.attacked=false;
  log(s,`${active.name} のターン。`);
  draw(active,1,s);
  checkWinner(s);
}
/**
 * Firebase の transaction / ローカルお試しに共通する純粋な状態更新関数。
 * 不正な操作時は Error を投げ、既存の状態は変更しない。
 */
export function applyAction(current,actorUid,action) {
  assert(current?.status==='playing','対戦中ではありません');
  const s=normalizeRoom(structuredClone(current));
  const seat=s.players.findIndex(p=>p?.uid===actorUid);
  reqOwn(s,seat);
  const p=s.players[seat],enemy=s.players[1-seat];
  const a=action||{};
  const ownTurn=s.turn===seat;
  switch(a.type) {
    case 'summon': {
      requireMain(s,seat);
      assert(!p.normalUsed,'このターンはすでに通常召喚しました');
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],c=mustCard(id);
      assert(c.type==='monster','モンスターではありません');
      const need=c.level<=4?0:c.level<=6?1:2;
      const tributes=a.tributes||[];
      assert(Array.isArray(tributes)&&tributes.length===need,'必要なリリース数が違います');
      assert(new Set(tributes).size===tributes.length,'同じモンスターを2回リリースできません');
      assert(tributes.every(i=>Number.isInteger(i)&&!!getMonster(s,seat,i)),'リリースするモンスターを正しく選んでください');
      const slot=p.monsters.findIndex((m,i)=>m===null||tributes.includes(i));
      assert(slot>=0,'モンスターゾーンが満杯です');
      for(const i of tributes)sendToGrave(p,'monsters',i);
      p.hand.splice(a.hand,1);
      p.monsters[slot]={id,pos:a.faceDown?'set':(a.position==='def'?'def':'atk'),bornTurn:s.turnNo,attacked:false,changedTurn:s.turnNo,bonus:0};
      p.normalUsed=true;
      log(s,`${p.name} はモンスターを${a.faceDown?'裏側守備表示でセット':a.position==='def'?'守備表示で召喚':'召喚'}しました。`);
      break;
    }
    case 'setBackrow': {
      requireMain(s,seat);
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],c=mustCard(id);
      assert(c.type==='spell'||c.type==='trap','魔法・罠カードではありません');
      const slot=p.backrow.indexOf(null);assert(slot>=0,'魔法・罠ゾーンが満杯です');
      p.hand.splice(a.hand,1);p.backrow[slot]={id,faceDown:true,setTurn:s.turnNo};
      log(s,`${p.name} は魔法・罠を1枚セットしました。`);break;
    }
    case 'spellFromHand': {
      requireMain(s,seat);
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      const id=p.hand[a.hand],c=mustCard(id);
      assert(c.type==='spell','魔法カードではありません');
      assert(p.backrow.includes(null),'魔法・罠ゾーンが満杯です');
      // 効果が使えない場合にカードを消費しないよう、処理成功後に手札から取り除く。
      activateSpell(s,seat,id,a.target);p.hand.splice(a.hand,1);break;
    }
    case 'spellFromField': {
      requireMain(s,seat);
      assert(arrayIndex(p.backrow,a.index),'ゾーンが不正です');
      const item=p.backrow[a.index];assert(item&&mustCard(item.id).type==='spell','セットした魔法カードがありません');
      activateSpell(s,seat,item.id,a.target);p.backrow[a.index]=null;break;
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
      const target=a.target===null?null:a.target;
      if(target===null)assert(!enemy.monsters.some(Boolean),'相手のモンスターがいるため直接攻撃できません');
      else assert(Number.isInteger(target)&&!!getMonster(s,1-seat,target),'攻撃対象を選んでください');
      m.attacked=true;s.pending={kind:'attack',by:seat,attacker:a.index,target};
      log(s,`${p.name} の攻撃宣言。${enemy.name} は罠を使うか選んでください。`);break;
    }
    case 'passAttack': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'対応できる攻撃がありません');
      log(s,`${p.name} は罠を発動しませんでした。`);resolveAttack(s);break;
    }
    case 'activateTrap': {
      assert(s.pending?.kind==='attack'&&s.pending.by!==seat,'相手の攻撃時に発動できます');
      assert(arrayIndex(p.backrow,a.index),'ゾーンが不正です');
      const item=p.backrow[a.index];assert(item&&mustCard(item.id).type==='trap','セットされた罠カードがありません');
      assert(item.setTurn<s.turnNo,'セットしたターンに罠は発動できません');
      const c=mustCard(item.id),attackerPlayer=enemy;
      p.backrow[a.index]=null;p.grave.push(item.id);
      if(c.effect==='counterdestroy')sendToGrave(attackerPlayer,'monsters',s.pending.attacker);
      if(c.effect==='counterburn')attackerPlayer.lp=Math.max(0,attackerPlayer.lp-700);
      s.pending=null;
      log(s,`${p.name} が罠「${c.name}」を発動！ 攻撃を無効にしました。`);
      checkWinner(s);break;
    }
    case 'nextPhase': {
      assert(ownTurn&&!s.pending,'今は進められません');
      if(s.phase==='main1')s.phase=s.turnNo===1?'main2':'battle';
      else if(s.phase==='battle')s.phase='main2';
      else fail('次はターン終了です');
      log(s,`${p.name}：${PHASES[s.phase]}。`);break;
    }
    case 'endTurn':{
      assert(ownTurn&&!s.pending,'今はターンを終了できません');endTurn(s);break;
    }
    case 'discard':{
      assert(ownTurn&&!s.pending,'今は捨てられません');
      assert(p.hand.length>6,'手札が6枚以下なので捨てる必要はありません');
      assert(arrayIndex(p.hand,a.hand),'手札の位置が不正です');
      p.grave.push(p.hand.splice(a.hand,1)[0]);log(s,`${p.name} が手札を1枚捨てました。`);break;
    }
    case 'surrender':{
      s.status='finished';s.winner=1-seat;log(s,`${p.name} が降参しました。`);break;
    }
    default:fail('不明な操作です');
  }
  s.revision=(s.revision||0)+1;
  return s;
}
