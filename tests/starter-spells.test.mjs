import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD, isSafeCustomCard, replaceCustomCards} from '../cards.js?v=2048';
import {applyAction, canOfferSpell} from '../engine.js?v=2048';
import {applyTemplate, BUILTIN_EFFECT_TEMPLATES, readTemplates, saveTemplate} from '../effect-templates.js?v=2048';
import {isValidAbility} from '../rules.js?v=2048';

const byName = (name) => Object.values(CARD).find((card) => card.name === name);
const heart = byName('心変わり');
const snatch = byName('強奪');
const cyclone = byName('サイクロン');
const offering = byName('死者への手向け');
const fieldSpell = byName('ガイアパワー');
const jammer = byName('マジック・ジャマー');

function duel() {
  return {
    status: 'playing', turn: 0, turnNo: 3, phase: 'main1', nextKey: 20, revision: 0,
    pending: null, log: [], players: ['A', 'B'].map((uid) => ({
      uid, name: uid, lp: 8000, deck: ['m02', 'm03', 'm04'], hand: [], grave: [],
      monsters: Array(5).fill(null), backrow: Array(5).fill(null), extraDeck: [], banished: []
    }))
  };
}

const monster = (id, key, ownerSeat, pos = 'atk') => ({id, key, ownerSeat, pos, bornTurn: 1, changedTurn: 1, attacked: false, bonus: 0});
const set = (id, key) => ({id, key, setTurn: 1, faceDown: true});
const act = (state, type, params = {}, seat = state.turn) => applyAction(state, state.players[seat].uid, {type, ...params});

function resolve(state) {
  state = act(state, 'chainPass', {}, state.pending.priority);
  return act(state, 'chainPass', {}, state.pending.priority);
}

test('心変わり moves the same monster and permits its attack, then returns it once during hand adjustment', () => {
  let state = duel();
  const [a, b] = state.players;
  a.hand = [heart.id, ...Array(7).fill('m01')];
  b.monsters[2] = {...monster('m04', 7, 1), attacked: true, attackCount: 1};
  b.backrow[0] = {...set('s08', 8), faceDown: false, linkKey: 7, linkOwner: 1};
  state = resolve(act(state, 'spellFromHand', {hand: 0, target: 2}));
  const borrowed = state.players[0].monsters[0];
  assert.equal(borrowed.key, 7);
  assert.equal(borrowed.ownerSeat, 1);
  assert.equal(state.players[1].backrow[0].linkOwner, 0);
  assert.equal(state.players[1].monsters[2], null);
  assert.equal(state.players[0].grave[0], heart.id);

  state = act(state, 'nextPhase');
  state = act(state, 'attack', {index: 0, target: -1});
  state = act(state, 'passAttack', {}, 1);
  assert.equal(state.players[1].lp, 5800);
  state = act(state, 'endTurn');
  assert.equal(state.phase, 'end');
  assert.equal(state.players[0].monsters[0], null);
  assert.equal(state.players[1].monsters[0].key, 7);
  assert.equal(state.players[1].backrow[0].linkOwner, 1);
  state = act(state, 'discard', {hand: 0});
  assert.equal(state.turn, 1);
  assert.equal(state.players[1].monsters.filter(Boolean).length, 1);
  assert.ok(!Object.hasOwn(state.players[1].monsters[0], 'controlReturnSeat'));
});

test('心変わり rejects missing and full fields, permits face-down targets and uses the owner grave when return is blocked', () => {
  let state = duel();
  const [a, b] = state.players;
  a.hand = [heart.id];
  assert.equal(canOfferSpell(state, 0, heart), false);
  assert.throws(() => act(state, 'spellFromHand', {hand: 0, target: 0}));
  b.monsters[0] = monster('m03', 7, 1, 'set');
  a.monsters = Array.from({length: 5}, (_, i) => monster('m01', i + 1, 0));
  assert.equal(canOfferSpell(state, 0, heart), false);
  a.monsters[0] = null;
  state = resolve(act(state, 'spellFromHand', {hand: 0, target: 0}));
  assert.equal(state.players[0].monsters[0].pos, 'set');
  state.players[1].monsters = Array.from({length: 5}, (_, i) => monster('m01', i + 1, 1));
  state = act(state, 'endTurn');
  assert.equal(state.players[0].monsters[0], null);
  assert.deepEqual(state.players[1].grave, ['m03']);
});

test('強奪 holds control, pays the opponent once per turn, and returns control when サイクロン breaks the link', () => {
  let state = duel();
  const [a, b] = state.players;
  a.hand = [snatch.id];
  b.monsters[2] = monster('m04', 7, 1);
  b.backrow[0] = set(cyclone.id, 8);
  state = act(state, 'spellFromHand', {hand: 0, target: 2});
  assert.equal(state.players[0].monsters[0], null);
  state = resolve(state);
  assert.equal(state.players[0].monsters[0].key, 7);
  assert.equal(state.players[0].backrow[0].linkOwner, 0);
  assert.equal(state.players[1].lp, 8000);
  state = act(state, 'endTurn');
  assert.equal(state.players[1].lp, 9000);
  state = resolve(act(state, 'spellFromField', {index: 0, target: {seat: 0, index: 0}}));
  assert.equal(state.players[0].backrow[0], null);
  assert.equal(state.players[0].monsters[0], null);
  assert.equal(state.players[1].monsters[0].key, 7);
  assert.deepEqual(state.players[0].grave, [snatch.id]);
  assert.deepEqual(state.players[1].grave, [cyclone.id]);
});

test('強奪 refuses face-down targets, and does not transfer a monster if the equip is broken or negated in the chain', () => {
  for (const answer of [cyclone, jammer]) {
    let state = duel();
    const [a, b] = state.players;
    a.hand = [snatch.id];
    b.monsters[1] = monster('m04', 7, 1, 'set');
    assert.equal(canOfferSpell(state, 0, snatch), false);
    assert.throws(() => act(state, 'spellFromHand', {hand: 0, target: 1}));
    b.monsters[1].pos = 'atk';
    b.backrow[0] = set(answer.id, 8);
    b.hand = ['m01'];
    state = act(state, 'spellFromHand', {hand: 0, target: 1});
    state = answer===cyclone
      ? act(state, 'quickResponse', {source: 'backrow', index: 0, target: {seat: 0, index: 0}}, 1)
      : act(state, 'chainTrap', {index: 0, costIndices: [0]}, 1);
    state = resolve(structuredClone(state));
    assert.equal(state.players[1].monsters[1].key, 7);
    assert.equal(state.players[0].monsters[0], null);
    assert.equal(state.players[0].backrow[0], null);
    assert.deepEqual(state.players[0].grave, [snatch.id]);
  }
});

test('サイクロン can destroy either field zone and will not cast without a different legal card', () => {
  for (const side of [0, 1]) {
    let state = duel();
    state.players[0].backrow[0] = set(cyclone.id, 8);
    assert.equal(canOfferSpell(state, 0, cyclone, 'backrow', 0), false);
    assert.throws(() => act(state, 'spellFromField', {index: 0, target: {seat: 0, index: 0}}));
    state.players[side].field = {...set(fieldSpell.id, 9), faceDown: false};
    const pending = act(state, 'spellFromField', {index: 0, target: {seat: side, index: -1}});
    assert.equal(pending.pending.stack[0].targetBackrowKey, 9);
    state = resolve(pending);
    assert.equal(state.players[side].field, null);
    assert.ok(state.players[side].grave.includes(fieldSpell.id));
  }
});

test('死者への手向け can target either player, validates payment, and stays bound to the chosen monster', () => {
  for (const side of [0, 1]) {
    const state = duel();
    state.players[0].hand = [offering.id, 'm03'];
    state.players[side].monsters[0] = monster('m01', 9, side);
    assert.throws(() => act(state, 'spellFromHand', {hand: 0, target: {seat: side, index: 0}, costIndices: [0]}));
    assert.deepEqual(state.players[0].hand, [offering.id, 'm03']);
    const pending = act(state, 'spellFromHand', {hand: 0, target: {seat: side, index: 0}, costIndices: [1]});
    assert.equal(pending.pending.stack[0].targetMonsterKey, 9);
    const resolved = resolve(pending);
    assert.equal(resolved.players[side].monsters[0], null);
    assert.ok(resolved.players[side].grave.includes('m01'));
    assert.ok(resolved.players[0].grave.includes('m03'));
    pending.players[side].monsters[0] = monster('m02', 10, side);
    assert.equal(resolve(pending).players[side].monsters[0].id, 'm02');
  }
});

test('starter spell templates match their cards and edited values persist and run in a duel', () => {
  const pairs = [[heart, 'changeofheart'], [snatch, 'snatch'], [cyclone, 'cyclone'], [offering, 'offering']];
  for (const [card, key] of pairs) {
    const source = BUILTIN_EFFECT_TEMPLATES.find((x) => x.id === 'et_builtin_' + key);
    assert.deepEqual(source?.ability, card.ability);
  }
  const equip = BUILTIN_EFFECT_TEMPLATES.find((x) => x.id === 'et_builtin_snatch');
  assert.equal(isValidAbility({...equip.ability, target: 'ownMonster'}, 'spell', 'equip'), false);
  assert.equal(isValidAbility({...heart.ability, then: {operation: 'draw', target: 'self', amount: 1}}, 'spell'), false);
  const stored = new Map();
  const storage = {getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value)};
  const custom = {id: 'u_0123456789abcdef', owner: 'AB', name: '装備テスト', type: 'spell', spellKind: 'equip', desc: ''};
  const draft = applyTemplate(custom, equip);
  draft.ability.amount = 400;
  saveTemplate(storage, draft, '回復400の装備');
  const reopened = applyTemplate(custom, readTemplates(storage)[0]);
  assert.equal(reopened.ability.amount, 400);
  assert.ok(isSafeCustomCard(reopened));
  replaceCustomCards({[reopened.id]: reopened});
  try {
    let state = duel();
    state.players[0].hand = [reopened.id];
    state.players[1].monsters[0] = monster('m01', 9, 1);
    state = resolve(act(state, 'spellFromHand', {hand: 0, target: 0}));
    assert.equal(act(state, 'endTurn').players[1].lp, 8400);
  } finally {
    replaceCustomCards({});
  }
});
