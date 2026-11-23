import assert from 'node:assert/strict';
import test from 'node:test';
import {isDeepStrictEqual} from 'node:util';
import {PRESETS,expandDeck,validDeck,validMonsterEffect} from '../cards.js?v=2048';
import {HISTORICAL_CARDS,HISTORICAL_PRESETS} from '../historical-data.js?v=2048';
import {isValidAbility} from '../rules.js?v=2048';
import {applyAction,createDemo} from '../engine.js?v=2048';
import {BUILTIN_EFFECT_TEMPLATES,isValidTemplate,templateFromCard} from '../effect-templates.js?v=2048';

const starters = ['yu','jy','ka'];

test('starter effect definitions validate and every supported starter recipe has a standard template', () => {
  const ids = new Set(starters.flatMap(key=>HISTORICAL_PRESETS[key].records.map(record=>record.id)));
  const cards = HISTORICAL_CARDS.filter(card=>ids.has(card.id));
  assert.equal(cards.length,ids.size);
  assert.equal(new Set(BUILTIN_EFFECT_TEMPLATES.map(t=>t.id)).size,BUILTIN_EFFECT_TEMPLATES.length);
  const effect = ({id,name,...data}) => data;
  const builtins = BUILTIN_EFFECT_TEMPLATES.map(template=>{
    assert.equal(isValidTemplate(template),true,template.name);
    return effect(template);
  });
  for(const card of cards){
    if(card.monsterEffect)assert.equal(validMonsterEffect(card.monsterEffect),true,card.name);
    if(card.ability)assert.equal(isValidAbility(card.ability,card.type,card.spellKind||'normal'),true,card.name);
    if(card.status==='proxy')continue;
    const recipe = templateFromCard(card,card.name,'et_starter_recipe');
    if(recipe)assert.ok(builtins.some(builtin=>isDeepStrictEqual(builtin,effect(recipe))),card.name);
  }
});

test('the three starter presets open practice duels and complete the first turn', () => {
  for(const [index,key] of starters.entries()){
    const a = PRESETS[key], b = PRESETS[starters[(index+1)%starters.length]];
    assert.equal(validDeck(a.counts,{deckSize:40},a.extraCounts),true,key);
    const game = createDemo({counts1:a.counts,extra1:a.extraCounts,counts2:b.counts,extra2:b.extraCounts});
    assert.deepEqual([...game.players[0].hand,...game.players[0].deck].sort(),expandDeck(a.counts).sort());
    assert.deepEqual(game.players[0].extraDeck,expandDeck(a.extraCounts));
    const uid = game.players[game.turn].uid;
    const main2 = applyAction(game,uid,{type:'nextPhase'});
    assert.equal(main2.phase,'main2');
    const next = applyAction(main2,uid,{type:'endTurn'});
    assert.equal(next.turn,1-game.turn);
    assert.equal(next.turnNo,2);
    assert.equal(next.players[next.turn].hand.length,6);
    assert.equal(next.pending,null);
  }
});
