// Duel Craft v0.5. Extensible simple effect vocabulary; not a full OCG rules interpreter.
export const LIMITS={unlimited:{label:'無制限',max:3},semi:{label:'準制限',max:2},limited:{label:'制限',max:1},banned:{label:'禁止',max:0}};
export const RULE_DEFAULT={lp:8000,deckSize:40,costLimit:0};
// Cost is optional for legacy cards; defaults are independent of rarity.
export function cardCost(card){
  if(!card)return 0;
  const custom=Number(card.cost);
  if(card.cost!==undefined&&Number.isInteger(custom)&&custom>=1&&custom<=20)return custom;
  if(card.type==='monster')return (card.level>=7?4:card.level>=5?3:1)+(card.subtype==='effect'?1:0);
  return 2;
}
export function deckCost(counts,cardIndex){return Object.entries(counts||{}).reduce((total,[id,count])=>total+cardCost(cardIndex[id])*Number(count||0),0);}
export const TRIGGERS={main:'自分メインで発動',summon:'召喚したとき',continuous:'表側の間ずっと',attack:'相手の攻撃に対応',response:'相手の効果にチェーン'};
export const TARGETS={none:'対象なし',self:'自分',opponent:'相手',ownMonster:'自分のモンスター1体',enemyMonster:'相手のモンスター1体',attacker:'攻撃しているモンスター',ownAllMonsters:'自分のモンスター全体',enemyAllMonsters:'相手のモンスター全体',bothMonsters:'お互いのモンスター全体',ownBackrow:'自分の魔法・罠1枚',enemyBackrow:'相手の魔法・罠1枚',ownAllBackrow:'自分の魔法・罠すべて',enemyAllBackrow:'相手の魔法・罠すべて',eitherGraveMonster:'自分・相手の墓地のモンスター1体'};
// Display order is the priority order in the editor. Each operation has a working engine implementation.
export const ABILITY_META={
 draw:{label:'カードをドロー',scope:'player',amount:1,min:1,max:10},
 searchMonster:{label:'山札で最初のモンスターを手札へ加える',scope:'player',amount:1,min:1,max:5},
 searchSpell:{label:'山札で最初の魔法を手札へ加える',scope:'player',amount:1,min:1,max:5},
 searchTrap:{label:'山札で最初の罠を手札へ加える',scope:'player',amount:1,min:1,max:5},
 destroy:{label:'モンスターを破壊',scope:'monster',amount:0},
 banish:{label:'モンスターを除外',scope:'monster',amount:0},
 damage:{label:'LPにダメージ',scope:'player',amount:500,min:1,max:99999},
 heal:{label:'LPを回復',scope:'player',amount:500,min:1,max:99999},
 boost:{label:'攻撃力をアップ',scope:'monster',amount:500,min:1,max:10000},
 weaken:{label:'攻撃力をダウン',scope:'monster',amount:500,min:1,max:10000},
 boostDef:{label:'守備力をアップ',scope:'monster',amount:500,min:1,max:10000},
 weakenDef:{label:'守備力をダウン',scope:'monster',amount:500,min:1,max:10000},
 returnHand:{label:'モンスターを手札に戻す',scope:'monster',amount:0},
 returnDeck:{label:'モンスターをデッキに戻す',scope:'monster',amount:0},
 sendGrave:{label:'モンスターを墓地へ送る（破壊しない）',scope:'monster',amount:0},
 changePosition:{label:'攻撃・守備表示を変更',scope:'monster',amount:0},
 setAtk:{label:'攻撃力を指定値に変更',scope:'monster',amount:1500,min:0,max:10000},
 setDef:{label:'守備力を指定値に変更',scope:'monster',amount:1500,min:0,max:10000},
 lockAttack:{label:'次のターンまで攻撃を封じる',scope:'monster',amount:0},
 lockEffect:{label:'次のターンまで起動効果を封じる',scope:'monster',amount:0},
 steal:{label:'モンスターのコントロールを移す',scope:'monster',amount:0},
 destroyBackrow:{label:'魔法・罠を破壊',scope:'backrow',amount:0},
 banishBackrow:{label:'魔法・罠を除外',scope:'backrow',amount:0},
 returnBackrow:{label:'魔法・罠を手札に戻す',scope:'backrow',amount:0},
 discardRandom:{label:'手札をランダムに捨てる',scope:'player',amount:1,min:1,max:10},
 returnRandomHandDeck:{label:'手札をランダムにデッキへ戻す',scope:'player',amount:1,min:1,max:10},
 mill:{label:'デッキ上から墓地へ送る',scope:'player',amount:2,min:1,max:10},
 banishDeck:{label:'デッキ上から除外する',scope:'player',amount:2,min:1,max:10},
 shuffleDeck:{label:'デッキをシャッフル',scope:'player',amount:0},
 graveRecover:{label:'墓地の一番新しいカードから手札へ',scope:'player',amount:1,min:1,max:5},
 graveRevive:{label:'墓地の新しいモンスターから蘇生',scope:'player',amount:1,min:1,max:5},
 reviveSelected:{label:'自分・相手の墓地から選んで特殊召喚',scope:'grave',amount:0},
 graveBanish:{label:'墓地の新しいカードから除外',scope:'player',amount:1,min:1,max:10},
 graveRecycle:{label:'墓地の新しいカードからデッキへ',scope:'player',amount:1,min:1,max:10},
 banishedRecover:{label:'除外の新しいカードから手札へ',scope:'player',amount:1,min:1,max:5},
 setLP:{label:'LPを指定値にする',scope:'player',amount:4000,min:0,max:99999},
 halfLP:{label:'LPを半分にする',scope:'player',amount:0},
 negateAttack:{label:'攻撃を無効化',scope:'none',amount:0},
 negateEffect:{label:'直前のチェーン効果を無効化',scope:'none',amount:0}
};
export const OPERATIONS=Object.fromEntries(Object.entries(ABILITY_META).map(([k,v])=>[k,v.label]));
// Legacy reference: the first member now means the recommended initial value, not the only allowed value.
export const EFFECT_VALUES=Object.fromEntries(Object.entries(ABILITY_META).map(([k,v])=>[k,[v.amount]]));
export function abilityTargets(operation,when='main',type='monster',spellKind='normal'){
 const meta=ABILITY_META[operation];if(!meta)return ['none'];
 if(meta.scope==='none')return ['none'];
 if(meta.scope==='grave')return ['eitherGraveMonster'];
 if(meta.scope==='player')return ['self','opponent'];
 if(meta.scope==='backrow')return ['enemyBackrow','ownBackrow','enemyAllBackrow','ownAllBackrow'];
 if(when==='continuous'){
  if(type==='monster')return ['ownMonster'];
  if(spellKind==='field')return ['ownAllMonsters','enemyAllMonsters','bothMonsters'];
  if(spellKind==='equip')return ['ownMonster','enemyMonster'];
 }
 const first=['boost','boostDef','setAtk','setDef'].includes(operation)?'ownMonster':'enemyMonster';
 const second=first==='ownMonster'?'enemyMonster':'ownMonster';
 return [...(when==='attack'?['attacker']:[]),first,second,'enemyAllMonsters','ownAllMonsters','bothMonsters'];
}
export function isValidAbility(a,type='monster',spellKind='normal'){
 if(!a||typeof a!=='object'||!Object.hasOwn(TRIGGERS,a.when)||!Object.hasOwn(TARGETS,a.target)||!Object.hasOwn(ABILITY_META,a.operation))return false;
 const meta=ABILITY_META[a.operation];
 if(!Number.isSafeInteger(a.amount)||(meta.min===undefined?a.amount!==0:a.amount<meta.min||a.amount>meta.max))return false;
 if(type==='monster'&&!['main','summon','continuous'].includes(a.when))return false;
 if(type==='spell'&&a.when!=='main'&&!(a.when==='continuous'&&['continuous','equip','field'].includes(spellKind)))return false;
 if(type==='trap'&&!['attack','response'].includes(a.when))return false;
 if(a.when==='continuous'&&!['boost','weaken','boostDef','weakenDef'].includes(a.operation))return false;
 // Graveyard choice is deliberately a normal-spell-only feature; avoid invalid trap/continuous triggers.
 if(a.operation==='reviveSelected'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='eitherGraveMonster'))return false;
 if(a.operation==='negateAttack'&&a.when!=='attack')return false;
 if(a.operation==='negateEffect'&&a.when!=='response')return false;
 if(!abilityTargets(a.operation,a.when,type,spellKind).includes(a.target)){
  // Support old field-spell definitions that used ownMonster to mean own field.
  if(!(a.when==='continuous'&&type==='spell'&&spellKind==='field'&&a.target==='ownMonster'))return false;
 }
 return true;
}
export function abilityText(a){if(!a)return '';
 const meta=ABILITY_META[a.operation];if(!meta)return '';
 const usesAmount=meta.min!==undefined;
 const label=meta.label;
 if(a.operation==='reviveSelected')return '自分・相手の墓地のモンスター1体を選び、自分フィールドに攻撃表示で特殊召喚する。';
 const detail=usesAmount?(/LP|ダメージ|攻撃力|守備力/.test(label)?`${label}（${a.amount}）`:`${label}（${a.amount}枚）`):label;
 return `${TRIGGERS[a.when]||'効果'}：${TARGETS[a.target]||''} に ${detail}。`;
}
export function normalizeRuleSettings(input){const lp=Number(input?.lp),deckSize=Number(input?.deckSize),costLimit=Number(input?.costLimit);return {lp:Number.isInteger(lp)&&lp>=1000&&lp<=20000&&lp%500===0?lp:8000,deckSize:Number.isInteger(deckSize)&&deckSize>=20&&deckSize<=60?deckSize:40,costLimit:Number.isInteger(costLimit)&&costLimit>=20&&costLimit<=300?costLimit:0};}
export function cardLimit(c){return LIMITS[c?.limit]?.max??3;}
export function readRuleSettings(storage){try{return normalizeRuleSettings(JSON.parse(storage.getItem('duel-rules-v5')||'{}'));}catch{return {...RULE_DEFAULT};}}
export function writeRuleSettings(storage,value){const r=normalizeRuleSettings(value);storage.setItem('duel-rules-v5',JSON.stringify(r));return r;}
