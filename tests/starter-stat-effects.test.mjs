import assert from 'node:assert/strict';
import test from 'node:test';
import {CARD,CARDS,PRESETS,replaceCustomCards,isSafeCustomCard,validMonsterEffect} from '../cards.js?v=2047';
import {applyAction,createDemo,normalizeRoom,effectiveAtk,effectiveDef} from '../engine.js?v=2047';
import {BUILTIN_EFFECT_TEMPLATES,applyTemplate,readTemplates,saveTemplate} from '../effect-templates.js?v=2047';
import {makeBackup,parseBackup,applyBackup} from '../backup.js?v=2047';

const id = name => CARDS.find(card => card.name === name).id;
const monster = (id, key, pos = 'atk') => ({id,key,pos,bornTurn:1,bonus:0,defBonus:0});
const demo = (phase = 'main1') => {
  const s = createDemo({counts1:PRESETS.red.counts,counts2:PRESETS.blue.counts});
  Object.assign(s,{turn:0,turnNo:3,phase,nextKey:20});
  return s;
};
const play = (s, side, action) => applyAction(s,s.players[side].uid,action);
const fight = (s, target) => play(play(s,0,{type:'attack',index:0,target}),1,{type:'passAttack'});
const memory = () => {
  const data = new Map();
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
};

test('ブラック・マジシャン・ガール counts both graves and duplicate copies', () => {
  const s = demo('battle');
  const dm = id('ブラック・マジシャン'), chaos = id('マジシャン・オブ・ブラックカオス');
  const girl = s.players[0].monsters[0] = monster(id('ブラック・マジシャン・ガール'),1);
  s.players[0].grave = [dm,dm];
  s.players[1].grave = [chaos,girl.id];
  s.players[1].banished = [dm];
  assert.equal(effectiveAtk(girl,s,0),2900);
  assert.equal(effectiveAtk(girl),2000);
  assert.equal(effectiveDef(girl),1700);
  assert.equal(fight(s,-1).players[1].lp,s.players[1].lp-2900);
  s.players[0].grave.pop();
  assert.equal(effectiveAtk(girl,s,0),2600);
});

test('バスター・ブレイダー excludes hidden and friendly dragons and follows zone moves', () => {
  const s = demo();
  const buster = s.players[0].monsters[0] = monster(id('バスター・ブレイダー'),1);
  s.players[0].grave = ['m17'];
  s.players[1].grave = ['m18','m06'];
  s.players[1].monsters[0] = monster('m17',2,'set');
  s.players[1].monsters[1] = monster('m18',3);
  assert.equal(effectiveAtk(buster,s,0),3600);
  s.players[1].monsters[0].pos = 'def';
  assert.equal(effectiveAtk(buster,s,0),4100);
  s.players[1].banished = [s.players[1].grave.shift()];
  assert.equal(effectiveAtk(buster,s,0),3600);
});

test('太陽の戦士 gains ATK only during battle against a revealed DARK monster', () => {
  const s = demo('battle');
  const sun = s.players[0].monsters[0] = monster(id('太陽の戦士'),1);
  assert.equal(effectiveAtk(sun,s,0),2100);
  assert.equal(fight(s,-1).players[1].lp,s.players[1].lp-2100);
  s.players[1].monsters[0] = monster(id('ブラック・マジシャン'),2);
  const win = fight(s,0);
  assert.equal(win.players[1].lp,s.players[1].lp-100);
  assert.equal(win.players[1].monsters[0],null);
  assert.equal(effectiveAtk(win.players[0].monsters[0],win,0),2100);
  s.players[1].monsters[0].pos = 'set';
  const defense = fight(s,0);
  assert.equal(defense.players[1].lp,s.players[1].lp);
  assert.equal(defense.players[1].monsters[0],null);
});

test('翻弄するエルフの剣士 uses the attacking controller in redirected battle', () => {
  const s = demo('battle'), [a,b] = s.players;
  a.monsters[0] = monster('m07',1);
  a.monsters[1] = monster(id('翻弄するエルフの剣士'),2);
  a.monsters[2] = monster(id('コマンド・ナイト'),3);
  b.monsters[0] = monster('m01',4);
  b.backrow[0] = {id:id('マジックアーム・シールド'),faceDown:true,setTurn:1,key:5};
  let next = play(s,0,{type:'attack',index:0,target:0});
  next = play(next,1,{type:'activateTrap',index:0});
  while(next.pending?.kind==='chain')next=play(next,next.pending.priority,{type:'chainPass'});
  assert.equal(next.pending,null);
  assert.equal(next.players[0].monsters[1]?.id,a.monsters[1].id);
  assert.equal(next.players[1].lp,b.lp-350);
});

test('a derived count recipe survives template, card, backup and room round trips', () => {
  const builtin = BUILTIN_EFFECT_TEMPLATES.find(t=>t.id==='et_builtin_bmg');
  const card = applyTemplate({id:'u_1111111111111111',name:'集計の剣士',type:'monster',owner:'local',
    level:4,atk:900,def:800,desc:''},builtin);
  Object.assign(card.monsterEffect,{stat:'def',amount:275,scope:'own',zones:['field','banished'],
    names:['紅蓮の剣士','灼熱の巨人','炎翼の獅子'],attribute:'fire',race:'warrior',level:4,monsterKind:'normal'});
  const storage = memory(), restored = memory();
  const template = saveTemplate(storage,card,'攻守テスト');
  storage.setItem('duel-custom-cards',JSON.stringify({[card.id]:card}));
  applyBackup(restored,parseBackup(JSON.stringify(makeBackup(storage))));
  const reloaded = JSON.parse(restored.getItem('duel-custom-cards'))[card.id];
  const recipe = readTemplates(restored)[0];
  assert.deepEqual(recipe,template);
  assert.deepEqual(applyTemplate(reloaded,recipe),card);
  assert.equal(isSafeCustomCard(reloaded),true);
  assert.equal(validMonsterEffect({...card.monsterEffect,zones:['hand']}),false);
  assert.equal(validMonsterEffect({...card.monsterEffect,zones:[]}),false);
  assert.equal(validMonsterEffect({...card.monsterEffect,zones:['grave'],monsterKind:'token'}),false);
  assert.equal(validMonsterEffect({...card.monsterEffect,level:13}),false);
  replaceCustomCards({[card.id]:reloaded});
  try {
    const s = demo();
    const [a,b] = s.players;
    a.monsters[0] = monster(card.id,1);
    a.monsters[1] = monster('m01',2);
    a.monsters[2] = monster('m01',3,'set');
    a.banished = ['m01','m13','m14','s01'];
    a.grave = ['m01'];
    b.banished = ['m01'];
    a.hand = ['m01'];
    const roundtrip = normalizeRoom(JSON.parse(JSON.stringify(s)));
    assert.equal(effectiveAtk(roundtrip.players[0].monsters[0],roundtrip,0),900);
    assert.equal(effectiveDef(roundtrip.players[0].monsters[0],roundtrip,0),1350);
    roundtrip.players[0].monsters[0].pos = 'set';
    assert.equal(effectiveDef(roundtrip.players[0].monsters[0],roundtrip,0),800);
  } finally { replaceCustomCards({}); }
});

test('an existing custom grave-name recipe still counts a named spell', () => {
  const card = {id:'u_2222222222222222',name:'旧カード',type:'monster',subtype:'effect',owner:'local',
    level:4,atk:900,def:800,desc:'',monsterEffect:{kind:'continuous',code:'graveNamedScale',scope:'own',
      names:[CARD.s01.name],amount:300}};
  replaceCustomCards({[card.id]:card});
  try {
    const s=demo();
    s.players[0].grave=['s01'];
    assert.equal(effectiveAtk(monster(card.id,1),s,0),1200);
  } finally { replaceCustomCards({}); }
});
