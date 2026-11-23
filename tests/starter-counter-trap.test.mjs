import assert from 'node:assert/strict';
import test from 'node:test';
import {CARDS,PRESETS,replaceCustomCards} from '../cards.js?v=2047';
import {applyAction,canActivateResponseTrap,createDemo} from '../engine.js?v=2047';
import {applyTemplate,BUILTIN_EFFECT_TEMPLATES,templateFromCard} from '../effect-templates.js?v=2047';

test('Magic Jammer template keeps its spell guard through saving and an actual chain', () => {
  const template = BUILTIN_EFFECT_TEMPLATES.find(t=>t.id==='et_builtin_jammer');
  const card = applyTemplate({id:'u_3333333333333333',name:'魔法対策',type:'trap',desc:'',owner:'local'},template);
  assert.equal(card.responseGuard,'spell');
  assert.deepEqual(templateFromCard(JSON.parse(JSON.stringify(card)),template.name,template.id),template);
  replaceCustomCards({[card.id]:card});
  try {
    const game = createDemo({counts1:PRESETS.red.counts,counts2:PRESETS.blue.counts});
    const offer = CARDS.find(c=>c.name==='強欲な壺').id;
    Object.assign(game,{turn:0,turnNo:3,phase:'main1',nextKey:1});
    game.players[0].hand=[offer];
    game.players[1].hand=['m01'];
    game.players[1].backrow[0]={id:card.id,key:1,faceDown:true,setTurn:1};
    const activated = applyAction(game,'demo-a',{type:'spellFromHand',hand:0});
    assert.equal(canActivateResponseTrap(activated,1,0),true);
    const trapChain = structuredClone(activated);
    trapChain.pending.stack[0].cardId='t01';
    assert.equal(canActivateResponseTrap(trapChain,1,0),false);
    assert.throws(()=>applyAction(trapChain,'demo-b',{type:'chainTrap',index:0,costIndices:[0]}));
    let state=applyAction(activated,'demo-b',{type:'chainTrap',index:0,costIndices:[0]});
    for(let i=0;i<2;i++)state=applyAction(state,state.players[state.pending.priority].uid,{type:'chainPass'});
    assert.equal(state.pending,null);
    assert.deepEqual(state.players[0].hand,[]);
    assert.deepEqual(state.players[0].grave,[offer]);
    assert.deepEqual(state.players[1].grave,['m01',card.id]);
  } finally { replaceCustomCards({}); }
});
