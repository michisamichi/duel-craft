import assert from 'node:assert/strict';
import test from 'node:test';
import {CARD,CARDS,PRESETS,replaceCustomCards,validMonsterEffect} from '../cards.js?v=2048';
import {applyAction,canOfferMonsterIgnition,createDemo,monsterEffectActivationBlocked,normalizeRoom} from '../engine.js?v=2048';
import {applyTemplate,BUILTIN_EFFECT_TEMPLATES,readTemplates,saveTemplate,templateDescription} from '../effect-templates.js?v=2048';

const id = name => CARDS.find(card=>card.name===name).id;
const sangan = id('クリッター'), witch = id('黒き森のウィッチ');
const bug = id('人喰い虫'), penguin = id('ペンギン・ソルジャー');
const blackHole = id('ブラック・ホール'), lord = id('ロード・オブ・ドラゴン－ドラゴンの支配者－');
const dragon = id('青眼の白龍'), kuriboh = id('クリボー');
const item = (id,key,pos='atk',ownerSeat=0) => ({id,key,pos,ownerSeat,bornTurn:1,bonus:0});
const play = (s,seat,action) => applyAction(s,s.players[seat].uid,action);
const demo = (phase='main1') => {
  const s=createDemo({counts1:PRESETS.red.counts,counts2:PRESETS.blue.counts});
  Object.assign(s,{turn:0,turnNo:3,phase,nextKey:30});
  for(const p of s.players){p.hand=[];p.deck=['m01','m01'];}
  return s;
};
const finishChain = s => {
  while(s.pending?.kind==='chain')s=play(s,s.pending.priority,{type:'chainPass'});
  return s;
};

test('クリッター and 黒き森のウィッチ each search once per turn at their own printed threshold', () => {
  const s=demo(), [own,foe]=s.players;
  own.monsters=[item(sangan,1),item(sangan,2),item(witch,3),item(witch,4),null];
  const atkOnly=id('岩石の巨兵'), defOnly=id('ゴブリン突撃部隊');
  own.deck=[defOnly,atkOnly,atkOnly];
  foe.monsters[0]=item(sangan,5,'atk',1);
  foe.deck=[atkOnly];
  own.hand=[blackHole];
  const next=finishChain(play(s,0,{type:'spellFromHand',hand:0}));
  assert.deepEqual(next.players[0].hand,[atkOnly,defOnly]);
  assert.deepEqual(next.players[0].deck,[atkOnly]);
  assert.deepEqual(next.players[1].hand,[atkOnly]);
  assert.deepEqual(next.players[0].graveSearchUsedNames,['クリッター','黒き森のウィッチ']);
  assert.equal(next.pending,null);
  assert.equal(s.players[0].monsters.filter(Boolean).length,4);
});

test('searched names disable the player’s activated effects across card IDs through the end phase', () => {
  const alternate={...CARD.m22,id:'u_ee00000000000001',owner:'local'};
  replaceCustomCards({[alternate.id]:alternate});
  try{
    const s=demo(), [own,foe]=s.players;
    own.monsters[0]=item(sangan,1);
    own.monsters[1]=item(alternate.id,2);
    foe.monsters[0]=item('m22',3,'atk',1);
    own.deck=['m22','m01'];
    own.hand=[id('ブラック・マジシャン・ガール')];
    let next=play(s,0,{type:'summon',hand:0,tributes:[0]});
    next=normalizeRoom(JSON.parse(JSON.stringify(next)));
    assert.deepEqual(next.players[0].hand,['m22']);
    assert.equal(monsterEffectActivationBlocked(next,0,alternate.id),true);
    assert.equal(monsterEffectActivationBlocked(next,1,'m22'),false);
    assert.equal(canOfferMonsterIgnition(next,0,1),false);
    assert.throws(()=>play(next,0,{type:'activateMonsterEffect',index:1}),/発動条件/);
    next=play(next,0,{type:'endTurn'});
    assert.equal(monsterEffectActivationBlocked(next,0,alternate.id),false);
    next=play(next,1,{type:'endTurn'});
    assert.equal(canOfferMonsterIgnition(next,0,1),true);
    next=finishChain(play(next,0,{type:'activateMonsterEffect',index:1}));
    assert.equal(next.players[1].lp,foe.lp-500);
  }finally{replaceCustomCards({});}
});

test('search can fail with no candidate and same-name hand effects remain gated during an attack', () => {
  const missing=demo(), [owner]=missing.players;
  owner.monsters[0]=item(witch,1);
  owner.deck=['s01'];
  owner.hand=[blackHole];
  const empty=finishChain(play(missing,0,{type:'spellFromHand',hand:0}));
  assert.deepEqual(empty.players[0].deck,['s01']);
  assert.deepEqual(empty.players[0].hand,[]);
  assert.equal(empty.status,'playing');
  assert.equal(empty.pending,null);

  const battle=demo('battle'), [attacking,defending]=battle.players;
  attacking.monsters[0]=item(dragon,1);
  attacking.monsters[1]=item('m01',3);
  defending.monsters[0]=item(sangan,2,'atk',1);
  defending.deck=[kuriboh];
  let next=play(battle,0,{type:'attack',index:0,target:0});
  next=play(next,1,{type:'passAttack'});
  assert.deepEqual(next.players[1].hand,[kuriboh]);
  assert.equal(monsterEffectActivationBlocked(next,1,kuriboh),true);
  assert.equal(next.pending,null);
  next=play(next,0,{type:'attack',index:1,target:-1});
  assert.throws(()=>play(next,1,{type:'discardBattleGuard',hand:0}),/同名/);
  assert.deepEqual(next.players[1].hand,[kuriboh]);
  next=play(next,1,{type:'passAttack'});
  assert.equal(next.pending,null);
});

test('人喰い虫 chooses the other side first and can destroy itself when alone', () => {
  const s=demo(), [own,foe]=s.players;
  own.monsters[0]=item(bug,1,'set');
  own.monsters[1]=item('m01',2);
  foe.monsters[0]=item('m01',3,'set',1);
  let next=play(s,0,{type:'flip',index:0});
  assert.equal(next.players[1].monsters[0],null);
  assert.equal(next.players[0].monsters[0].id,bug);
  foe.monsters[0]=null;
  next=play(s,0,{type:'flip',index:0});
  assert.equal(next.players[0].monsters[1],null);
  own.monsters[1]=null;
  next=play(s,0,{type:'flip',index:0});
  assert.equal(next.players[0].monsters[0],null);
  assert.deepEqual(next.players[0].grave,[bug]);
  assert.equal(next.pending,null);
});

test('a battle-destroyed 人喰い虫 is absent before it selects a valid target', () => {
  const s=demo('battle'), [own,foe]=s.players;
  own.monsters[0]=item(dragon,1);
  own.monsters[1]=item(lord,2);
  foe.monsters[0]=item(bug,3,'set',1);
  const next=play(play(s,0,{type:'attack',index:0,target:0}),1,{type:'passAttack'});
  assert.equal(next.players[0].monsters[0].id,dragon);
  assert.deepEqual(next.players[0].grave,[lord]);
  assert.deepEqual(next.players[1].grave,[bug]);
  assert.equal(next.players[1].lp,foe.lp);
  assert.equal(next.pending,null);
});

test('ペンギン・ソルジャー returns up to two legal targets to their owners and clears linked equipment', () => {
  const s=demo(), [own,foe]=s.players;
  own.monsters[0]=item(penguin,1,'set');
  foe.monsters[0]=item(dragon,2,'atk',1);
  foe.monsters[1]=item(dragon,3,'set',0);
  foe.monsters[2]=item('m01',4,'atk',1);
  foe.monsters[3]=item(lord,5,'atk',1);
  own.backrow[0]={id:id('デーモンの斧'),linkOwner:1,linkKey:4,faceDown:false};
  const next=play(s,0,{type:'flip',index:0});
  assert.deepEqual(next.players[0].hand,[dragon]);
  assert.deepEqual(next.players[1].hand,['m01']);
  assert.equal(next.players[1].monsters[0].id,dragon);
  assert.equal(next.players[1].monsters[3].id,lord);
  assert.equal(next.players[0].backrow[0],null);
  assert.equal(next.pending,null);
});

test('all four built-in templates track their source and scoped variants persist and duel', () => {
  for(const [cardId,suffix] of [[sangan,'sangan'],[witch,'witch'],[bug,'maneater'],[penguin,'penguin']]){
    const builtin=BUILTIN_EFFECT_TEMPLATES.find(t=>t.id==='et_builtin_'+suffix);
    assert.deepEqual(builtin.monsterEffect,CARD[cardId].monsterEffect);
    assert.ok(templateDescription(builtin));
  }
  const card=applyTemplate({id:'u_ee00000000000002',name:'帰投する剣士',type:'monster',owner:'local',
    level:4,atk:800,def:900,desc:''},BUILTIN_EFFECT_TEMPLATES.find(t=>t.id==='et_builtin_penguin'));
  Object.assign(card.monsterEffect,{scope:'own',amount:1});
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  assert.deepEqual(readTemplates(storage),[]);
  const saved=saveTemplate(storage,card,'自分の場へ変更');
  const reloaded=applyTemplate(card,readTemplates(storage)[0]);
  assert.deepEqual(reloaded,card);
  assert.match(templateDescription(saved),/自分/);
  assert.equal(validMonsterEffect({...card.monsterEffect,scope:'nowhere'}),false);
  assert.equal(validMonsterEffect({...card.monsterEffect,amount:3}),false);
  assert.equal(validMonsterEffect({kind:'flip',code:'returnOpponentOnFlip',amount:1}),true);
  assert.equal(validMonsterEffect({kind:'grave',code:'searchStatOnGrave',stat:'atk',threshold:1}),true);
  replaceCustomCards({[reloaded.id]:reloaded});
  try{
    const s=demo(),[own,foe]=s.players;
    own.monsters[1]=item(reloaded.id,2,'set');
    own.monsters[0]=item('m01',1);
    foe.monsters[0]=item('m01',3,'atk',1);
    const next=play(s,0,{type:'flip',index:1});
    assert.deepEqual(next.players[0].hand,['m01']);
    assert.equal(next.players[1].monsters[0].id,'m01');
    assert.equal(next.pending,null);
  }finally{replaceCustomCards({});}
});
