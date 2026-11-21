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
export const TRIGGERS={main:'自分メインで発動',summon:'召喚したとき',battleDamage:'戦闘ダメージを与えたとき',continuous:'表側の間ずっと',attack:'相手の攻撃に対応',response:'相手の効果にチェーン'};
export const TARGETS={none:'対象なし',self:'自分',opponent:'相手',ownMonster:'自分のモンスター1体',enemyMonster:'相手のモンスター1体',attacker:'攻撃しているモンスター',ownAllMonsters:'自分のモンスター全体',enemyAllMonsters:'相手のモンスター全体',enemyLowestAtk:'相手の表側モンスター（ATK最低・左端優先）',enemyFaceDownMonster:'相手の裏側守備モンスター（左端優先）',bothMonsters:'お互いのモンスター全体',ownBackrow:'自分の魔法・罠1枚',enemyBackrow:'相手の魔法・罠1枚',ownAllBackrow:'自分の魔法・罠すべて',enemyAllBackrow:'相手の魔法・罠すべて',bothAllBackrow:'お互いの魔法・罠すべて（フィールド魔法を含む）',eitherGraveMonster:'自分・相手の墓地のモンスター1体'};
// Display order is the priority order in the editor. Each operation has a working engine implementation.
export const ABILITY_META={
 draw:{label:'カードをドロー',scope:'player',amount:1,min:1,max:10},
 searchMonster:{label:'山札で最初のモンスターを手札へ加える',scope:'player',amount:1,min:1,max:5},
 searchSpell:{label:'山札で最初の魔法を手札へ加える',scope:'player',amount:1,min:1,max:5},
 searchNamed:{label:'デッキから指定名のカードを手札へ加える',scope:'player',amount:1,min:1,max:3},
 summonNamedFromHand:{label:'手札の指定名モンスター1体を特殊召喚',scope:'player',amount:0},
 summonRaceFromHand:{label:'手札の指定種族モンスターを特殊召喚',scope:'player',amount:2,min:1,max:2},
 searchTrap:{label:'山札で最初の罠を手札へ加える',scope:'player',amount:1,min:1,max:5},
 destroy:{label:'モンスターを破壊',scope:'monster',amount:0},
 banish:{label:'モンスターを除外',scope:'monster',amount:0},
 damage:{label:'LPにダメージ',scope:'player',amount:500,min:1,max:99999},
 heal:{label:'LPを回復',scope:'player',amount:500,min:1,max:99999},
 healPerFieldMonster:{label:'場のモンスター数×指定値だけLPを回復',scope:'player',amount:300,min:1,max:5000},
 replaceHands:{label:'お互いの手札を全て捨て、各自同じ枚数ドロー',scope:'none',amount:0},
 swapPrintedStats:{label:'お互いの表側モンスターの元々のATK・DEFを交換',scope:'monster',amount:0},
 recoverNormalAtk:{label:'墓地のATK1500以下の通常モンスターを回収（新しい順）',scope:'player',amount:3,min:1,max:3},
 earthAura:{label:'地属性のATK＋指定値／DEF－400（フィールド）',scope:'monster',amount:500,min:1,max:2000},
 pierce:{label:'装備モンスターに貫通ダメージ能力',scope:'monster',amount:0},
 negateEndBattle:{label:'攻撃を無効にしバトルフェイズ終了',scope:'none',amount:0},
 blastAttacker:{label:'攻撃モンスターを破壊し双方に元々ATK分のダメージ',scope:'monster',amount:0},
 boost:{label:'攻撃力をアップ',scope:'monster',amount:500,min:1,max:10000},
 weaken:{label:'攻撃力をダウン',scope:'monster',amount:500,min:1,max:10000},
 boostDef:{label:'守備力をアップ',scope:'monster',amount:500,min:1,max:10000},
 weakenDef:{label:'守備力をダウン',scope:'monster',amount:500,min:1,max:10000},
 returnHand:{label:'モンスターを手札に戻す',scope:'monster',amount:0},
 returnDeck:{label:'モンスターをデッキに戻す',scope:'monster',amount:0},
 sendGrave:{label:'モンスターを墓地へ送る（破壊しない）',scope:'monster',amount:0},
 changePosition:{label:'攻撃・守備表示を変更',scope:'monster',amount:0},
 setAttackerDefense:{label:'攻撃モンスターを守備表示にして攻撃を中断',scope:'monster',amount:0},
 setAtk:{label:'攻撃力を指定値に変更',scope:'monster',amount:1500,min:0,max:10000},
 setDef:{label:'守備力を指定値に変更',scope:'monster',amount:1500,min:0,max:10000},
 lockAttack:{label:'次のターンまで攻撃を封じる',scope:'monster',amount:0},
 negateAndLockAttacker:{label:'攻撃を無効にし、その攻撃モンスターを次のターンまで攻撃禁止',scope:'monster',amount:0},
 lpRelativeEquip:{label:'LP比較で装備モンスターの元々のATKを2倍／半分',scope:'monster',amount:0},
 fusionMaterialSubstitute:{label:'融合召喚の素材1体の代用になる',scope:'player',amount:0},
 directEarthWaterFire:{label:'相手の表側が地・水・炎のみなら直接攻撃可能',scope:'player',amount:0},
 lockPositionNextTurn:{label:'次の相手ターンの手動表示変更を禁止',scope:'player',amount:0},
 lockEffect:{label:'次のターンまで起動効果を封じる',scope:'monster',amount:0},
 steal:{label:'モンスターのコントロールを移す',scope:'monster',amount:0},
 destroyGiveOwn:{label:'相手モンスターを破壊し自分の左端1体を相手に渡す',scope:'monster',amount:0},
 destroyBackrow:{label:'魔法・罠を破壊',scope:'backrow',amount:0},
 banishBackrow:{label:'魔法・罠を除外',scope:'backrow',amount:0},
 returnBackrow:{label:'魔法・罠を手札に戻す',scope:'backrow',amount:0},
 discardRandom:{label:'手札をランダムに捨てる',scope:'player',amount:1,min:1,max:10},
 discardNewest:{label:'手札の末尾から指定枚数を捨てる（自動選択）',scope:'player',amount:1,min:1,max:10},
 returnRandomHandDeck:{label:'手札をランダムにデッキへ戻す',scope:'player',amount:1,min:1,max:10},
 mill:{label:'デッキ上から墓地へ送る',scope:'player',amount:2,min:1,max:10},
 millFirstType:{label:'デッキから指定種類のカード1枚を墓地へ送る',scope:'player',amount:0},
 banishDeck:{label:'デッキ上から除外する',scope:'player',amount:2,min:1,max:10},
 shuffleDeck:{label:'デッキをシャッフル',scope:'player',amount:0},
 graveRecover:{label:'墓地の一番新しいカードから手札へ',scope:'player',amount:1,min:1,max:5},
 borrowOpponentSpell:{label:'相手墓地の新しい魔法1枚を自分の手札へ',scope:'player',amount:0},
 graveRevive:{label:'墓地の新しいモンスターから蘇生',scope:'player',amount:1,min:1,max:5},
 reviveBothSet:{label:'お互いの墓地から1体ずつ裏側守備で蘇生',scope:'none',amount:0},
 reviveSelected:{label:'自分・相手の墓地から選んで特殊召喚',scope:'grave',amount:0},
 graveBanish:{label:'墓地の新しいカードから除外',scope:'player',amount:1,min:1,max:10},
 graveRecycle:{label:'墓地の新しいカードからデッキへ',scope:'player',amount:1,min:1,max:10},
 banishedRecover:{label:'除外の新しいカードから手札へ',scope:'player',amount:1,min:1,max:5},
 setLP:{label:'LPを指定値にする',scope:'player',amount:4000,min:0,max:99999},
 halfLP:{label:'LPを半分にする',scope:'player',amount:0},
 reflectAttack:{label:'攻撃を無効化し攻撃モンスターのATK分を反射',scope:'none',amount:0},
 negateAttack:{label:'攻撃を無効化',scope:'none',amount:0},
 negateEffect:{label:'直前のチェーン効果を無効化',scope:'none',amount:0}
};
// A is paid immediately at activation, before B enters the chain. Keep the
// allowed vocabulary small and deterministic so RTDB and local games agree.
// A follow-up stage is only allowed when it does not require a second manual target picker.
// Single-card targets may be reused only when the preceding stage selected that same side/zone.
export function followUpTargets(operation,firstTarget,when='main',type='monster',spellKind='normal'){
 const op=ABILITY_META[operation];
 if(!op||when==='battleDamage'||['reflectAttack','negateAttack','negateEndBattle','blastAttacker','negateEffect','reviveSelected','steal','searchNamed','summonNamedFromHand','replaceHands','swapPrintedStats','recoverNormalAtk','earthAura','pierce','millFirstType','summonRaceFromHand','reviveBothSet','destroyGiveOwn','borrowOpponentSpell','lockPositionNextTurn','setAttackerDefense','negateAndLockAttacker','lpRelativeEquip','fusionMaterialSubstitute','directEarthWaterFire'].includes(operation))return [];
 const permitted=abilityTargets(operation,when,type,spellKind);
 const automatic=new Set(['none','self','opponent','ownAllMonsters','enemyAllMonsters','bothMonsters','ownAllBackrow','enemyAllBackrow','bothAllBackrow','enemyLowestAtk','enemyFaceDownMonster']);
 return permitted.filter(target=>automatic.has(target)||target===firstTarget&&['ownMonster','enemyMonster','ownBackrow','enemyBackrow','attacker'].includes(target));
}
export const BEFORE_META={
 sendOwnMonsterGrave:{label:'自分のモンスターを墓地へ送る',zone:'monsters',amount:1,max:5},
 banishOwnMonster:{label:'自分のモンスターを除外する',zone:'monsters',amount:1,max:5},
 returnOwnMonsterHand:{label:'自分のモンスターを手札へ戻す',zone:'monsters',amount:1,max:5},
 returnOwnMonsterDeck:{label:'自分のモンスターをデッキへ戻す',zone:'monsters',amount:1,max:5},
 sendOwnBackrowGrave:{label:'自分の魔法・罠を墓地へ送る',zone:'backrow',amount:1,max:5},
 banishOwnBackrow:{label:'自分の魔法・罠を除外する',zone:'backrow',amount:1,max:5},
 discardOwnHand:{label:'自分の手札を捨てる',zone:'hand',amount:1,max:20},
 returnOwnHandDeck:{label:'自分の手札をデッキへ戻す',zone:'hand',amount:1,max:20},
 millOwnDeck:{label:'自分のデッキ上から墓地へ送る',zone:'deck',amount:1,max:60},
 banishOwnDeck:{label:'自分のデッキ上から除外する',zone:'deck',amount:1,max:60},
 banishOwnGrave:{label:'自分の墓地から除外する（新しい順）',zone:'grave',amount:1,max:60},
 recycleOwnGrave:{label:'自分の墓地からデッキへ戻す（新しい順）',zone:'grave',amount:1,max:60},
 payLP:{label:'自分のLPを支払う',zone:'lp',amount:500,max:99999}
};
export const beforeText=a=>{const m=BEFORE_META[a?.operation];return m?`${m.label}（${a.amount}${m.zone==='lp'?'LP':m.zone==='monsters'?'体':'枚'}）`:'';};
export const OPERATIONS=Object.fromEntries(Object.entries(ABILITY_META).map(([k,v])=>[k,v.label]));
// Legacy reference: the first member now means the recommended initial value, not the only allowed value.
export const EFFECT_VALUES=Object.fromEntries(Object.entries(ABILITY_META).map(([k,v])=>[k,[v.amount]]));
export function abilityTargets(operation,when='main',type='monster',spellKind='normal'){
 const meta=ABILITY_META[operation];if(!meta)return ['none'];
 if(meta.scope==='none')return ['none'];
 if(operation==='swapPrintedStats'||operation==='earthAura')return ['bothMonsters'];
 if(operation==='pierce')return ['ownMonster'];
 if(operation==='blastAttacker')return ['attacker'];
 if(operation==='setAttackerDefense'||operation==='negateAndLockAttacker')return ['attacker'];
 if(operation==='lpRelativeEquip')return ['ownMonster'];
 if(operation==='fusionMaterialSubstitute'||operation==='directEarthWaterFire')return ['self'];
 if(meta.scope==='grave')return ['eitherGraveMonster'];
 if(operation==='summonNamedFromHand')return ['self'];
 if(operation==='millFirstType')return ['opponent'];
 if(operation==='summonRaceFromHand')return ['self'];
 if(meta.scope==='player')return ['self','opponent'];
 if(meta.scope==='backrow')return ['enemyBackrow','ownBackrow','enemyAllBackrow','ownAllBackrow','bothAllBackrow'];
 if(when==='continuous'){
  if(type==='monster')return ['ownMonster'];
  if(spellKind==='field')return ['ownAllMonsters','enemyAllMonsters','bothMonsters'];
  if(spellKind==='equip')return ['ownMonster','enemyMonster'];
 }
 if(operation==='destroy')return ['enemyMonster','ownMonster','enemyLowestAtk','enemyAllMonsters','ownAllMonsters','bothMonsters'];
 if(operation==='banish')return ['enemyMonster','ownMonster','enemyFaceDownMonster','enemyAllMonsters','ownAllMonsters','bothMonsters'];
 const first=['boost','boostDef','setAtk','setDef'].includes(operation)?'ownMonster':'enemyMonster';
 const second=first==='ownMonster'?'enemyMonster':'ownMonster';
 return [...(when==='attack'?['attacker']:[]),first,second,'enemyAllMonsters','ownAllMonsters','bothMonsters'];
}
// Exactly two fusion ingredients, with at most one substitute; no three-material or
// multi-substitute edge case. This pure matcher is shared by UI and duel engine.
export function fusionMaterialsMatch(required,actual,isSubstitute){
 if(!Array.isArray(required)||required.length!==2||!Array.isArray(actual)||actual.length!==2)return false;
 if([...required].sort().join(',')===[...actual].sort().join(','))return true;
 return actual.some((id,i)=>isSubstitute(id)&&required.includes(actual[1-i]));
}
export function isValidAbility(a,type='monster',spellKind='normal'){
 if(!a||typeof a!=='object'||!Object.hasOwn(TRIGGERS,a.when)||!Object.hasOwn(TARGETS,a.target)||!Object.hasOwn(ABILITY_META,a.operation))return false;
 const meta=ABILITY_META[a.operation];
 if(['searchNamed','summonNamedFromHand'].includes(a.operation)&&Object.keys(a).some(k=>!['when','operation','target','amount','match','query','then','before'].includes(k)))return false;
 if(['searchNamed','summonNamedFromHand'].includes(a.operation)&&!(a.target==='self'&&(a.operation==='searchNamed'?['exact','contains']:['exact']).includes(a.match)&&
  typeof a.query==='string'&&a.query.length>=1&&a.query.length<=32&&a.query===a.query.trim()))return false;
 if(a.operation==='summonRaceFromHand'){
  if(a.when!=='main'||!['monster','spell'].includes(type)||type==='spell'&&spellKind!=='normal'||a.target!=='self'||a.match!=='race'||
     typeof a.query!=='string'||!a.query.trim()||a.query.length>16||/['\u0000-\u001f]/.test(a.query)||
     a.then!==undefined||a.before!==undefined||
     (a.requiredFaceUpName!==undefined&&(typeof a.requiredFaceUpName!=='string'||!a.requiredFaceUpName.trim()||a.requiredFaceUpName.length>48))||
     Object.keys(a).some(k=>!['when','operation','target','amount','match','query','requiredFaceUpName'].includes(k)))return false;
 }
 if(a.operation==='reviveBothSet'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='none'&&a.amount===0&&a.then===undefined&&a.before===undefined&&Object.keys(a).every(k=>['when','operation','target','amount'].includes(k))))return false;
 if(a.requiredFaceUpName!==undefined&&a.operation!=='summonRaceFromHand')return false;
 if(a.operation==='millFirstType'){
  if(a.when!=='battleDamage'||type!=='monster'||a.target!=='opponent'||a.amount!==0||!['monster','spell','trap'].includes(a.match)||a.query!==undefined||a.before!==undefined||a.then!==undefined)return false;
  if(Object.keys(a).some(k=>!['when','operation','target','amount','match'].includes(k)))return false;
 }
 if(!['searchNamed','summonNamedFromHand','millFirstType','summonRaceFromHand'].includes(a.operation)&&(a.query!==undefined||a.match!==undefined))return false;
 if(a.operation==='summonNamedFromHand'&&!(a.when==='main'&&['monster','spell'].includes(type)&&a.amount===0&&!a.then))return false;
 if(!Number.isSafeInteger(a.amount)||(meta.min===undefined?a.amount!==0:a.amount<meta.min||a.amount>meta.max))return false;
 if(type==='monster'&&!['main','summon','continuous','battleDamage'].includes(a.when))return false;
 // Battle-damage triggers are synchronous, player-only, and never open a
 // second chain or manual cost picker; limit the vocabulary deliberately.
 if(a.when==='battleDamage'&&!(type==='monster'&&
  ['draw','discardNewest','millFirstType'].includes(a.operation)&&!a.before&&!a.then))return false;
 if(type==='spell'&&a.when!=='main'&&!(a.when==='continuous'&&['continuous','equip','field'].includes(spellKind)))return false;
 if(type==='trap'&&!['attack','response'].includes(a.when))return false;
 if(a.when==='continuous'&&!['boost','weaken','boostDef','weakenDef','earthAura','pierce','lpRelativeEquip','fusionMaterialSubstitute','directEarthWaterFire'].includes(a.operation))return false;
 // Exceptional recipe types are deliberately bound to one supported trigger/zone.
 if(a.operation==='destroyGiveOwn'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='enemyMonster'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='borrowOpponentSpell'&&!(type==='trap'&&a.when==='response'&&a.target==='self'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='negateAndLockAttacker'&&!(type==='trap'&&a.when==='attack'&&a.target==='attacker'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='lpRelativeEquip'&&!(type==='spell'&&spellKind==='equip'&&a.when==='continuous'&&a.target==='ownMonster'&&a.amount===0&&!a.before&&!a.then))return false;
 if(['fusionMaterialSubstitute','directEarthWaterFire'].includes(a.operation)&&!(type==='monster'&&a.when==='continuous'&&a.target==='self'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='setAttackerDefense'&&!(type==='trap'&&a.when==='attack'&&a.target==='attacker'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='lockPositionNextTurn'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='opponent'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='earthAura'&&!(type==='spell'&&spellKind==='field'&&a.when==='continuous'&&a.target==='bothMonsters'))return false;
 if(a.operation==='pierce'&&!(type==='spell'&&spellKind==='equip'&&a.when==='continuous'&&a.target==='ownMonster'))return false;
 if(a.operation==='replaceHands'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='none'))return false;
 if(a.operation==='swapPrintedStats'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='bothMonsters'))return false;
 if(a.operation==='recoverNormalAtk'&&!(type==='trap'&&a.when==='response'&&a.target==='self'))return false;
 if(a.operation==='negateEndBattle'&&!(type==='trap'&&a.when==='attack'&&a.target==='none'))return false;
 if(a.operation==='blastAttacker'&&!(type==='trap'&&a.when==='attack'&&a.target==='attacker'))return false;
 if(a.then!==undefined){
  if(a.when==='continuous'||['summonNamedFromHand','negateAttack','negateEndBattle','blastAttacker','negateEffect','replaceHands','swapPrintedStats','recoverNormalAtk'].includes(a.operation)||
     !a.then||typeof a.then!=='object'||Array.isArray(a.then)||
     Object.keys(a.then).sort().join(',')!=='amount,operation,target')return false;
  const next=ABILITY_META[a.then.operation];
  if(!next||!Number.isSafeInteger(a.then.amount)||
    (next.min===undefined?a.then.amount!==0:a.then.amount<next.min||a.then.amount>next.max)||
    !followUpTargets(a.then.operation,a.target,a.when,type,spellKind).includes(a.then.target))return false;
 }
 if(a.before!==undefined){
  const cost=BEFORE_META[a.before?.operation];
  if(!cost||!Number.isSafeInteger(a.before.amount)||a.before.amount<1||a.before.amount>cost.max)return false;
  if(!['main','attack','response'].includes(a.when)||type==='spell'&&spellKind!=='normal'&&spellKind!=='quick')return false;
 }
 // Graveyard choice is deliberately a normal-spell-only feature; avoid invalid trap/continuous triggers.
 if(a.operation==='reviveSelected'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='eitherGraveMonster'))return false;
 if(a.operation==='reflectAttack'&&!(type==='trap'&&a.when==='attack'&&a.target==='none'&&!a.before&&!a.then))return false;
 if(a.operation==='negateAttack'&&a.when!=='attack')return false;
 if(a.operation==='negateEndBattle'&&a.when!=='attack')return false;
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
 if(a.operation==='reviveSelected'&&!a.then)return (a.before?`コスト：${beforeText(a.before)}。\n`:'')+'自分・相手の墓地のモンスター1体を選び、自分フィールドに攻撃表示で特殊召喚する。';
 if(a.operation==='negateAndLockAttacker')return `${TRIGGERS[a.when]}：攻撃を無効にし、攻撃モンスターの攻撃を次のターンまで封じる（永続リンクは省略）。`;
 if(a.operation==='lpRelativeEquip')return `${TRIGGERS[a.when]}：自分のLPが相手より少なければ装備モンスターの元々のATKを2倍、多ければ半分にする。`;
 if(a.operation==='fusionMaterialSubstitute')return `${TRIGGERS[a.when]}：2体素材の融合召喚で、融合素材1体の代わりに使用できる。`;
 if(a.operation==='directEarthWaterFire')return `${TRIGGERS[a.when]}：相手の表側表示モンスターが地・水・炎属性だけの場合、直接攻撃できる。`;
 if(a.operation==='borrowOpponentSpell')return `${TRIGGERS[a.when]}：相手の墓地の新しい魔法カード1枚を自分の手札へ加える（2000ダメージ・期限切れ返却は省略）。`;
 if(a.operation==='setAttackerDefense')return `${TRIGGERS[a.when]}：攻撃モンスターを守備表示にしその攻撃を中断する（装備・攻撃力上昇は省略）。`;
 if(a.operation==='destroyGiveOwn')return `${TRIGGERS[a.when]}：相手モンスター1体を破壊し自分の左端1体を相手に渡す。`;
 if(a.operation==='lockPositionNextTurn')return `${TRIGGERS[a.when]}：次の相手ターンに相手の手動表示形式変更と反転召喚を禁止する。`;
 if(a.operation==='reviveBothSet')return `${TRIGGERS[a.when]}：お互いの墓地のモンスターを新しい順に1体ずつ裏側守備で特殊召喚する。`;
 if(a.operation==='summonRaceFromHand')return `${TRIGGERS[a.when]}：${a.requiredFaceUpName?`「${a.requiredFaceUpName}」が表側で存在する場合、`:''}手札の${a.query}族モンスターを最大${a.amount}体特殊召喚する（先頭側から自動選択）。`;
 if(a.operation==='millFirstType')return `${TRIGGERS[a.when]}：相手のデッキから${{monster:'モンスター',spell:'魔法',trap:'罠'}[a.match]||'指定種類'}カード1枚を墓地へ送る（デッキの先頭側から自動選択）。`;
 const detail=a.operation==='millFirstType'
  ?`相手デッキの最初の${{monster:'モンスター',spell:'魔法',trap:'罠'}[a.match]||'指定種類'}カード1枚を墓地へ送る（自動選択）`
  :a.operation==='summonNamedFromHand'
  ?`自分の手札から「${a.query||''}」という名前のモンスター1体を特殊召喚する（最初の候補を自動選択。ゾーン満杯や候補なしの場合は不発）`
  :a.operation==='searchNamed'
  ?`自分のデッキから${a.match==='contains'?'名前に':'名前が'}「${a.query||''}」${a.match==='contains'?'を含む':'に一致する'}カードを${a.amount}枚手札に加える（デッキ先頭順・自動選択）`
  :usesAmount?(/LP|ダメージ|攻撃力|守備力/.test(label)?`${label}（${a.amount}）`:`${label}（${a.amount}枚）`):label;
 const result=`${TRIGGERS[a.when]||'効果'}：${TARGETS[a.target]||''} に ${detail}。`;
 const then=a.then;
 const follow=then?`${TARGETS[then.target]}に${ABILITY_META[then.operation].label}${ABILITY_META[then.operation].min===undefined?'':`（${then.amount}）`}する。`:'';
 return `${a.before?`発動コスト：${beforeText(a.before)}。\n`:''}${result}${then?`\nこの効果が処理された場合、${follow}`:''}`;
}
export function normalizeRuleSettings(input){const lp=Number(input?.lp),deckSize=Number(input?.deckSize),costLimit=Number(input?.costLimit);return {lp:Number.isInteger(lp)&&lp>=1000&&lp<=20000&&lp%500===0?lp:8000,deckSize:Number.isInteger(deckSize)&&deckSize>=20&&deckSize<=60?deckSize:40,costLimit:Number.isInteger(costLimit)&&costLimit>=20&&costLimit<=300?costLimit:0};}
export function cardLimit(c){return LIMITS[c?.limit]?.max??3;}
export function readRuleSettings(storage){try{return normalizeRuleSettings(JSON.parse(storage.getItem('duel-rules-v5')||'{}'));}catch{return {...RULE_DEFAULT};}}
export function writeRuleSettings(storage,value){const r=normalizeRuleSettings(value);storage.setItem('duel-rules-v5',JSON.stringify(r));return r;}
