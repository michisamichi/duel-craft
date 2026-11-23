import assert from 'node:assert/strict';
import test from 'node:test';
import {CARD,CARDS,PRESETS,replaceCustomCards,validMonsterEffect} from '../cards.js?v=2047';
import {applyAction,createDemo,effectiveAtk,effectiveDef} from '../engine.js?v=2047';
import {applyTemplate,BUILTIN_EFFECT_TEMPLATES,templateDescription} from '../effect-templates.js?v=2047';

const id=name=>CARDS.find(card=>card.name===name).id;
const baphomet=id('バフォメット'), gazelle=id('幻獣王ガゼル');
const copycat=id('ものマネ幻想師'), gilfer=id('暗黒魔族ギルファー・デーモン'), chimera=id('有翼幻獣キマイラ');
const blueEyes=id('青眼の白龍'), lord=id('ロード・オブ・ドラゴン－ドラゴンの支配者－');
const cardAt=(id,key,ownerSeat=0,pos='atk')=>({id,key,ownerSeat,pos,bornTurn:1,bonus:0});
const template=suffix=>BUILTIN_EFFECT_TEMPLATES.find(t=>t.id==='et_builtin_'+suffix);
const play=(s,seat,action)=>applyAction(s,s.players[seat].uid,action);
const resolve=s=>{
  for(let pass=0;pass<2&&s.pending?.kind==='chain';pass++)s=play(s,s.pending.priority,{type:'chainPass'});
  return s;
};
const demo=(phase='main1')=>{
  const s=createDemo({counts1:PRESETS.red.counts,counts2:PRESETS.blue.counts});
  Object.assign(s,{turn:0,turnNo:3,phase,nextKey:30});
  for(const p of s.players){p.hand=[];p.deck=['m01','m01'];}
  return s;
};

test('バフォメット searches an exact name on normal and flip summons',()=>{
  const s=demo(), [own]=s.players;
  own.monsters[0]=cardAt('m01',1);
  own.hand=[baphomet];
  own.deck=['m02',gazelle,'m03'];
  const summoned=play(s,0,{type:'summon',hand:0,tributes:[0]});
  assert.deepEqual(summoned.players[0].hand,[gazelle]);
  assert.deepEqual(summoned.players[0].deck,['m02','m03']);
  own.monsters[0]=cardAt(baphomet,1,0,'set');
  own.hand=[];
  const flipped=play(s,0,{type:'flip',index:0});
  assert.deepEqual(flipped.players[0].hand,[gazelle]);
  own.deck=[];
  const empty=play(s,0,{type:'flip',index:0});
  assert.deepEqual(empty.players[0].hand,[]);
  assert.equal(empty.status,'playing');
  assert.equal(empty.pending,null);
});

test('a named special summon cannot start バフォメット’s search, and legacy custom search can',()=>{
  const summonSpell={id:'u_ee00000000000010',type:'spell',spellKind:'normal',name:'指定名召喚',owner:'local',desc:'',
    ability:{when:'main',operation:'summonNamedFromHand',target:'self',amount:0,match:'exact',query:CARD[baphomet].name}};
  const legacy={...CARD[baphomet],id:'u_ee00000000000011',owner:'local',name:'従来の召喚サーチ',
    monsterEffect:{kind:'trigger',code:'searchDeckOnSummon',filter:'named',name:CARD[gazelle].name}};
  replaceCustomCards({[summonSpell.id]:summonSpell});
  try{
    const s=demo();s.players[0].hand=[summonSpell.id,baphomet];s.players[0].deck=[gazelle];
    const next=resolve(play(s,0,{type:'spellFromHand',hand:0}));
    assert.equal(next.players[0].monsters[0].id,baphomet);
    assert.deepEqual(next.players[0].hand,[]);
    assert.deepEqual(next.players[0].deck,[gazelle]);

    summonSpell.ability.query=legacy.name;
    replaceCustomCards({[summonSpell.id]:summonSpell,[legacy.id]:legacy});
    s.players[0].hand=[summonSpell.id,legacy.id];
    const legacySummon=resolve(play(s,0,{type:'spellFromHand',hand:0}));
    assert.equal(legacySummon.players[0].monsters[0].id,legacy.id);
    assert.deepEqual(legacySummon.players[0].hand,[gazelle]);
  }finally{replaceCustomCards({});}
});

test('ものマネ幻想師 skips protected and hidden targets and copies modified original stats only',()=>{
  const s=demo(), [own,foe]=s.players;
  own.hand=[copycat];
  foe.monsters[0]=cardAt(blueEyes,1,1);
  foe.monsters[1]=cardAt('m07',2,1,'set');
  foe.monsters[2]={...cardAt('m01',3,1),bonus:900,defBonus:700,swappedOriginalStatsTurn:s.turnNo};
  foe.monsters[3]=cardAt(lord,4,1);
  const copied=play(s,0,{type:'summon',hand:0});
  assert.equal(effectiveAtk(copied.players[0].monsters[0],copied,0),CARD.m01.def);
  assert.equal(effectiveDef(copied.players[0].monsters[0],copied,0),CARD.m01.atk);
  const next=play(copied,0,{type:'endTurn'});
  assert.equal(effectiveAtk(next.players[0].monsters[0],next,0),CARD.m01.def);
  assert.equal(effectiveDef(next.players[0].monsters[0],next,0),CARD.m01.atk);
});

test('ギルファー skips protected Dragons and stops weakening after the target is set face-down',()=>{
  const s=demo(), [own,foe]=s.players;
  own.monsters[0]=cardAt(gilfer,1);
  own.hand=[id('ブラック・マジシャン・ガール')];
  foe.monsters[0]=cardAt(blueEyes,2,1);
  foe.monsters[1]=cardAt(lord,3,1);
  foe.backrow[0]={id:id('マジカルシルクハット'),faceDown:true,setTurn:1};
  let next=play(s,0,{type:'summon',hand:0,tributes:[0]});
  assert.equal(effectiveAtk(next.players[1].monsters[0],next,1),CARD[blueEyes].atk);
  assert.equal(effectiveAtk(next.players[1].monsters[1],next,1),CARD[lord].atk-500);
  next.phase='battle';
  next=play(next,0,{type:'attack',index:0,target:1});
  next=resolve(play(next,1,{type:'activateTrap',index:0}));
  assert.equal(next.players[1].monsters[1].pos,'set');
  assert.equal(next.players[1].monsters[1].permanentAtkDelta,undefined);
  assert.equal(next.pending,null);
  next=play(next,0,{type:'endTurn'});
  next=play(next,1,{type:'flip',index:1});
  assert.equal(effectiveAtk(next.players[1].monsters[1],next,1),CARD[lord].atk);
});

test('キマイラ revives a named monster from its owner’s grave only when destroyed',()=>{
  const s=demo(), [own,foe]=s.players;
  own.monsters[0]=cardAt(chimera,1);
  own.grave=['m01',baphomet];
  own.deck=[gazelle];
  foe.grave=[gazelle];
  own.hand=[id('ブラック・ホール')];
  const revived=resolve(play(s,0,{type:'spellFromHand',hand:0}));
  assert.equal(revived.players[0].monsters[0].id,baphomet);
  assert.deepEqual(revived.players[0].deck,[gazelle]);
  assert.deepEqual(revived.players[1].grave,[gazelle]);
  assert.ok(revived.players[0].grave.includes(chimera));

  own.hand=[id('ブラック・マジシャン・ガール')];
  const tributed=play(s,0,{type:'summon',hand:0,tributes:[0]});
  assert.deepEqual(tributed.players[0].grave,['m01',baphomet,chimera]);
  assert.equal(tributed.players[0].monsters.filter(Boolean).length,1);
});

test('derivative grave and copying templates reuse the engine with editable names, scope and position',()=>{
  for(const [name,suffix] of [[baphomet,'baphomet'],[copycat,'copycat'],[gilfer,'gilfer'],[chimera,'chimera']]){
    assert.deepEqual(template(suffix).monsterEffect,CARD[name].monsterEffect);
    assert.ok(templateDescription(template(suffix)));
  }
  const revived=applyTemplate({id:'u_ee00000000000012',type:'monster',name:'味方を映す者',level:4,atk:0,def:0,desc:'',owner:'local'},template('copycat'));
  revived.monsterEffect.scope='own';
  const source=applyTemplate({id:'u_ee00000000000013',type:'monster',name:'守備の幻獣',level:4,atk:1000,def:900,desc:'',owner:'local'},template('chimera'));
  source.monsterEffect.names=[revived.name,CARD[gazelle].name];source.monsterEffect.position='def';
  assert.equal(validMonsterEffect(source.monsterEffect),true);
  assert.equal(validMonsterEffect({...source.monsterEffect,position:'set'}),false);
  assert.equal(validMonsterEffect({...revived.monsterEffect,scope:'invalid'}),false);
  assert.equal(validMonsterEffect({...template('gilfer').monsterEffect,amount:0}),false);
  replaceCustomCards({[revived.id]:revived,[source.id]:source});
  try{
    const s=demo('battle'), [own,foe]=s.players;
    own.monsters[0]=cardAt(blueEyes,1);
    foe.monsters[0]=cardAt(source.id,2,1);
    foe.monsters[1]=cardAt('m01',3,1);
    foe.grave=[revived.id];
    const next=play(play(s,0,{type:'attack',index:0,target:0}),1,{type:'passAttack'});
    const result=next.players[1].monsters[0];
    assert.equal(result?.id,revived.id);
    assert.equal(result.pos,'def');
    assert.equal(effectiveDef(result,next,1),CARD.m01.def);
    assert.equal(next.pending,null);
  }finally{replaceCustomCards({});}
});
