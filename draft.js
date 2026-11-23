// Draft formats: 2-choice transfer and open-pick from 5 candidates.
// Weighting for newly offered cards: Monster 50%, Trap 25%, Spell 25%.
import {CARDS,CARD,validDeck,summonKind} from './cards.js?v=2080';
import {cardLimit,normalizeRuleSettings} from './rules.js?v=2080';
import {createRoom,joinRoom} from './engine.js?v=2080';

const fail = text => {throw Error(text);};
const normalizeCounts=raw=>({...raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}});
const clone = value=>structuredClone(value);
function randomSeed(){
  const buf=new Uint32Array(2);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(buf);
  else{buf[0]=Math.floor(Math.random()*4294967296);buf[1]=Date.now()%4294967296;}
  return buf[0]+'-'+buf[1];
}
function rngFor(seed,round){
  let h=2166136261;
  for(const char of String(seed)+':'+round){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}
  return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function normalizeDraftRoom(raw){
  if(!raw?.draft)fail('ドラフトデータがありません');
  const s=clone(raw);
  if(!Array.isArray(s.players))s.players=[s.players?.[0]||null,s.players?.[1]||null];
  if(!Array.isArray(s.draft.counts))s.draft.counts=[s.draft.counts?.[0]||{},s.draft.counts?.[1]||{}];
  s.draft.counts=s.draft.counts.map(normalizeCounts);
  if(!Array.isArray(s.draft.options))s.draft.options=[s.draft.options?.[0],s.draft.options?.[1]].filter(Boolean);
  return s;
}
function openOptionsFor(s){
  // Draw five distinct candidates, respecting the CURRENT picker's deck restrictions.
  const picker=s.draft.round%2,counts=s.draft.counts[picker];
  const available=CARDS.filter(c=>summonKind(c)!=='fusion' && cardLimit(c)>0 && (counts[c.id]||0)<cardLimit(c));
  if(!available.length)fail('選択できるカードがありません。禁止・制限を確認してください');
  const rng=rngFor(s.draft.seed,s.draft.round),out=[];
  for(let n=0;n<Math.min(5,available.length);n++){
    const remain=available.filter(c=>!out.includes(c.id));
    const roll=rng();const kind=roll<.5?'monster':roll<.75?'trap':'spell';
    const matching=remain.filter(c=>c.type===kind);
    const pool=matching.length?matching:remain;
    out.push(pool[Math.floor(rng()*pool.length)].id);
  }
  return out;
}
function optionsFor(s){
  if(s.draft.format==='open')return openOptionsFor(s);
  const counts=s.draft.counts;
  const pool=CARDS.filter(c=>summonKind(c)!=='fusion'&&cardLimit(c)>0&&[0,1].every(i=>(counts[i][c.id]||0)<cardLimit(c)));
  if(pool.length<2)fail('カードが足りません。カードを追加するか、デッキ枚数を減らしてください');
  const rand=rngFor(s.draft.seed,s.draft.round);
  const choose=exclude=>{
    const available=pool.filter(c=>c.id!==exclude);
    const dice=rand();
    const category=dice<.5?'monster':dice<.75?'trap':'spell';
    const group=available.filter(c=>c.type===category);
    const chosenPool=group.length?group:available;
    return chosenPool[Math.floor(rand()*chosenPool.length)].id;
  };
  const first=choose(null);return [first,choose(first)];
}
export function createDraftRoom({uid,name,rules,seed=randomSeed(),format='two'}){
  if(!uid)fail('プレイヤーIDがありません');
  if(!['two','open'].includes(format))fail('ドラフト方式が不正です');
  const normalized=normalizeRuleSettings({...rules,costLimit:0});
  return {status:'waiting',mode:'draft',rules:normalized,players:[{uid,name:String(name||'プレイヤー1').slice(0,12)},null],
    turn:0,turnNo:1,phase:'draft',revision:0,createdAt:Date.now(),
    draft:{format,seed,round:0,counts:[{},{}],options:[],lastPick:null},log:[]};
}
export function joinDraftRoom(room,{uid,name}){
  const s=normalizeDraftRoom(room);
  if(s.status!=='waiting'||s.mode!=='draft'||s.players[1])fail('参加できないドラフトです');
  if(!uid||s.players[0].uid===uid)fail('別のiPhoneから参加してください');
  s.players[1]={uid,name:String(name||'プレイヤー2').slice(0,12)};
  s.status='drafting';s.draft.options=optionsFor(s);s.revision++;return s;
}
export function applyDraftPick(room,uid,index){
  const s=normalizeDraftRoom(room);
  if(s.status!=='drafting'||!s.players[1])fail('ドラフトが進行していません');
  const picker=s.draft.round%2;
  if(s.players[picker]?.uid!==uid)fail('相手の選択を待ってください');
  const open=s.draft.format==='open',offers=s.draft.options;
  if(!Number.isInteger(index)||index<0||index>=offers.length)fail('カードを選んでください');
  if(open && (offers.length<1||offers.length>5||new Set(offers).size!==offers.length))fail('カードの候補が不正です');
  const choice=offers[index],other=open?null:offers[1-index];
  if(!choice||(!open&&(!other||choice===other)))fail('カードの選択肢が不正です');
  if(!CARD[choice]||(!open&&!CARD[other]))fail('カードが見つかりません');
  const assignments=open?[[picker,choice]]:[[picker,choice],[1-picker,other]];
  for(const [player,id] of assignments){
    const counts=s.draft.counts[player];
    if((counts[id]||0)>=cardLimit(CARD[id]))fail('カードの枚数制限を超えています');
    counts[id]=(counts[id]||0)+1;
  }
  s.draft.lastPick={picker,chosen:choice,other,round:s.draft.round+1};
  s.draft.round++;s.revision++;
  if(s.draft.round>=s.rules.deckSize*(open?2:1)){
    for(const counts of s.draft.counts)if(!validDeck(counts,s.rules))fail('完成したデッキに不正があります');
    const start=createRoom({uid:s.players[0].uid,name:s.players[0].name,counts:s.draft.counts[0],rules:s.rules});
    const game=joinRoom(start,{uid:s.players[1].uid,name:s.players[1].name,counts:s.draft.counts[1]});
    game.mode='draft';
    game.completedDraft={format:open?'open':'two',counts:s.draft.counts.map(x=>({...x})),players:s.players.map(p=>({uid:p.uid,name:p.name}))};
    game.revision=s.revision;
    game.log.unshift('ドラフト完成。デュエル開始！');
    return game;
  }
  s.draft.options=optionsFor(s);
  s.turn=s.draft.round%2;
  s.turnNo=s.draft.round+1;
  return s;
}
