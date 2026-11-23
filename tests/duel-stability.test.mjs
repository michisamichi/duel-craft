import assert from 'node:assert/strict';
import test from 'node:test';
import {CARD, CARDS, PRESETS} from '../cards.js?v=2047';
import {applyAction, createDemo, canActivateMainTrap, canOfferSpell} from '../engine.js?v=2047';
import {actionScopeIsCurrent, createRoomSnapshotGate, matchesOriginalRoom} from '../online-guards.js?v=2047';

const duel = phase => {
  const game = createDemo({counts1: PRESETS.red.counts, counts2: PRESETS.blue.counts});
  Object.assign(game, {turn: 0, turnNo: 3, phase});
  return game;
};

const serializeRoom = game => JSON.parse(JSON.stringify(game, (key, value) => {
  if (Array.isArray(value) && ['players', 'monsters', 'backrow'].includes(key)) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));
  }
  return value === null ? undefined : value;
}));

test('room listener drops duplicate and older revisions and retires on room changes', () => {
  let code = '1234';
  const gate = createRoomSnapshotGate('1234', () => code);
  const playing = {revision: 3, status: 'playing'};
  assert.equal(gate.accept({status: 'waiting'}), true);
  assert.equal(gate.accept(playing), true);
  assert.equal(gate.accept({...playing}), false);
  assert.equal(gate.accept({revision: 2, status: 'playing'}), false);
  assert.equal(gate.accept({revision: '4', status: 'playing'}), false);
  assert.equal(gate.accept(null), true);
  assert.equal(gate.accept(playing), true);
  code = '5678';
  assert.equal(gate.accept({revision: 4}), false);
  gate.retire();
  code = '1234';
  assert.equal(gate.accept({revision: 5}), false);
});

test('online action scope rejects a different room, user, or connection after a retry', () => {
  const session = {code: '1234', uid: 'one', epoch: 2};
  const ui = {roomCode: '1234', uid: 'one', networkConnected: true, connectionEpoch: 2, demo: false};
  assert.equal(actionScopeIsCurrent(session, ui), true);
  for (const changed of [{roomCode: '5678'}, {uid: 'two'}, {networkConnected: false}, {connectionEpoch: 3}, {demo: true}]) {
    assert.equal(actionScopeIsCurrent(session, {...ui, ...changed}), false);
  }
  const original = {createdAt: 100, players: [{uid: 'one'}, null]};
  assert.equal(matchesOriginalRoom(original, {createdAt: 100, players: {0: {uid: 'one'}}}), true);
  assert.equal(matchesOriginalRoom(original, {createdAt: 101, players: [{uid: 'one'}]}), false);
  assert.equal(matchesOriginalRoom(original, {createdAt: 100, players: [{uid: 'two'}]}), false);
});

test('direct attack round-trips through sparse room data and cannot resolve twice', () => {
  const game = duel('battle');
  game.nextKey = 1;
  game.players[0].monsters[2] = {id: 'm06', key: 1, pos: 'atk'};
  const attack = {type: 'attack', index: 2, target: -1};
  const pass = {type: 'passAttack'};
  const declared = applyAction(serializeRoom(game), 'demo-a', attack);
  assert.equal(declared.revision, game.revision + 1);
  assert.equal(declared.players[1].lp, game.players[1].lp);
  assert.throws(() => applyAction(declared, 'demo-a', attack));
  assert.throws(() => applyAction(declared, 'unseated', pass));

  const saved = serializeRoom(declared);
  delete saved.pending.target;
  const before = structuredClone(saved);
  const resolved = applyAction(saved, 'demo-b', pass);
  assert.equal(resolved.revision, declared.revision + 1);
  assert.equal(resolved.players[1].lp, game.players[1].lp - CARD.m06.atk);
  assert.equal(resolved.pending, null);
  assert.throws(() => applyAction(resolved, 'demo-b', pass));
  assert.deepEqual(saved, before);
});

test('an extra hand card pauses the end phase until a discard and draws once', () => {
  const game = duel('main2');
  game.players[0].hand = Array(7).fill('m06');
  game.players[0].monsters[0] = {id: 'm06', key: 1, pos: 'atk', bonus: 500, defBonus: -300};
  game.players[1].deck = ['m06', 'm06'];
  const end = {type: 'endTurn'};
  assert.throws(() => applyAction(game, 'demo-a', {type: 'discard', hand: 0}));
  const waiting = applyAction(game, 'demo-a', end);
  assert.equal(waiting.phase, 'end');
  assert.equal(waiting.turn, 0);
  assert.equal(waiting.players[1].deck.length, 2);
  assert.throws(() => applyAction(waiting, 'demo-a', end));

  const next = applyAction(serializeRoom(waiting), 'demo-a', {type: 'discard', hand: 0});
  assert.equal(next.turn, 1);
  assert.equal(next.turnNo, game.turnNo + 1);
  assert.equal(next.phase, 'main1');
  assert.equal(next.players[0].hand.length, 6);
  assert.deepEqual(next.players[0].grave, ['m06']);
  assert.equal(next.players[0].monsters[0].bonus, 0);
  assert.equal(next.players[0].monsters[0].defBonus, 0);
  assert.equal(next.players[1].deck.length, 1);
  assert.equal(next.players[1].hand.length, game.players[1].hand.length + 1);
  assert.throws(() => applyAction(next, 'demo-a', {type: 'discard', hand: 0}));
});

test('a short deck rejects a draw spell and an empty mandatory draw ends the duel', () => {
  const game = duel('main1');
  const pot = CARDS.find(card => card.name === '強欲な壺');
  game.players[0].hand = [pot.id];
  game.players[0].deck = ['m06'];
  game.players[1].deck = [];
  const before = structuredClone(game);
  assert.equal(canOfferSpell(game, 0, pot), false);
  assert.throws(() => applyAction(game, 'demo-a', {type: 'spellFromHand', hand: 0}));
  assert.deepEqual(game, before);

  const finished = applyAction(game, 'demo-a', {type: 'endTurn'});
  assert.equal(finished.status, 'finished');
  assert.equal(finished.winner, 0);
  assert.equal(finished.pending, null);
  assert.throws(() => applyAction(finished, 'demo-b', {type: 'nextPhase'}));
});

test('死のデッキ破壊ウイルス validates its cost and resolves once through a room round trip', () => {
  const game = duel('main1');
  const id = name => CARDS.find(card => card.name === name).id;
  const virus = id('死のデッキ破壊ウイルス');
  const kuriboh = id('クリボー');
  const dragon = id('青眼の白龍');
  game.nextKey = 3;
  game.players[0].backrow[0] = {id: virus, faceDown: true, setTurn: 1};
  game.players[0].monsters[1] = {id: kuriboh, key: 1, pos: 'atk'};
  game.players[0].monsters[2] = {id: dragon, key: 2, pos: 'atk'};
  game.players[1].monsters[4] = {id: dragon, key: 3, pos: 'set'};
  game.players[1].hand = [dragon, kuriboh];
  const activate = {type: 'activateMainTrap', index: 0};
  const before = structuredClone(game);
  assert.equal(canActivateMainTrap(game, 0, 0), true);
  for (const costIndices of [[], [0], [2]]) {
    assert.throws(() => applyAction(game, 'demo-a', {...activate, costIndices}));
    assert.deepEqual(game, before);
  }

  const chain = applyAction(game, 'demo-a', {...activate, costIndices: [1]});
  assert.deepEqual(chain.players[0].grave, [kuriboh]);
  assert.equal(chain.players[0].monsters[1], null);
  assert.equal(chain.players[0].backrow[0], null);
  assert.deepEqual(chain.players[1].hand, [dragon, kuriboh]);
  const pass = {type: 'chainPass'};
  const passed = applyAction(serializeRoom(chain), 'demo-b', pass);
  const resolved = applyAction(passed, 'demo-a', pass);
  assert.equal(resolved.pending, null);
  assert.deepEqual(resolved.players[0].grave, [kuriboh, virus]);
  assert.deepEqual(resolved.players[1].hand, [kuriboh]);
  assert.deepEqual(resolved.players[1].grave, [dragon, dragon]);
  assert.equal(resolved.players[1].monsters[4], null);
  assert.throws(() => applyAction(resolved, 'demo-a', pass));
});
