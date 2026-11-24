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
export const TRIGGERS={main:'自分メインで発動',summon:'召喚したとき',flip:'リバースしたとき',grave:'フィールドから墓地に送られたとき',destroyed:'フィールドで破壊されたとき',battleDamage:'戦闘ダメージを与えたとき',continuous:'表側の間ずっと',attack:'相手の攻撃に対応',response:'相手の効果にチェーン'};
export const TARGETS={none:'対象なし',self:'自分',opponent:'相手',ownMonster:'自分のモンスター1体',enemyMonster:'相手のモンスター1体',attacker:'攻撃しているモンスター',ownAllMonsters:'自分のモンスター全体',enemyAllMonsters:'相手のモンスター全体',enemyAttackMonsters:'相手の攻撃表示モンスター全体',enemyLowestAtk:'相手の表側モンスター（ATK最低・左端優先）',enemyFaceDownMonster:'相手の裏側守備モンスター（左端優先）',bothMonsters:'お互いのモンスター全体',ownBackrow:'自分の魔法・罠1枚',enemyBackrow:'相手の魔法・罠1枚',ownAllBackrow:'自分の魔法・罠すべて',enemyAllBackrow:'相手の魔法・罠すべて',bothAllBackrow:'お互いの魔法・罠すべて（フィールド魔法を含む）',eitherGraveMonster:'自分・相手の墓地のモンスター1体'};
// Display order is the priority order in the editor. Each operation has a working engine implementation.
export const ABILITY_META={
 draw:{label:'カードをドロー',scope:'player',amount:1,min:1,max:10},
 searchMonster:{label:'デッキから条件に合うモンスターを手札へ',scope:'player',amount:1,min:1,max:5},
 summonMonsterHand:{label:'手札から条件に合うモンスターを特殊召喚（末尾優先）',scope:'player',amount:1,min:1,max:2},
 summonMonsterDeck:{label:'デッキから条件に合うモンスターを特殊召喚',scope:'player',amount:1,min:1,max:2},
 searchSpell:{label:'デッキから魔法を手札へ加える',scope:'player',amount:1,min:1,max:5},
 searchNamed:{label:'デッキから指定名のカードを手札へ加える',scope:'player',amount:1,min:1,max:3},
 summonNamedFromHand:{label:'手札の指定名モンスター1体を特殊召喚',scope:'player',amount:0},
 summonRaceFromHand:{label:'手札の指定種族モンスターを特殊召喚',scope:'player',amount:2,min:1,max:2},
 summonSheepTokens:{label:'羊トークンを守備表示で特殊召喚（1～4体）',scope:'player',amount:4,min:1,max:4},
 summonKuribohTokens:{label:'表側の「クリボー」をリリースしてクリボートークンを可能な限り特殊召喚',scope:'player',amount:0},
 extraNormalSummon:{label:'通常召喚済みでも500LPで追加通常召喚（永続罠）',scope:'player',amount:500,min:500,max:500},
 searchTrap:{label:'デッキから罠を手札へ加える',scope:'player',amount:1,min:1,max:5},
 destroy:{label:'モンスターを破壊',scope:'monster',amount:0},
 banish:{label:'モンスターを除外',scope:'monster',amount:0},
 damage:{label:'LPにダメージ',scope:'player',amount:500,min:1,max:99999},
 heal:{label:'LPを回復',scope:'player',amount:500,min:1,max:99999},
 healPerFieldMonster:{label:'場のモンスター数×指定値だけLPを回復',scope:'player',amount:300,min:1,max:5000},
 replaceHands:{label:'お互いの手札を全て捨て、各自同じ枚数ドロー',scope:'none',amount:0},
 swapPrintedStats:{label:'お互いの表側モンスターの元々のATK・DEFを交換',scope:'monster',amount:0},
 recoverNormalAtk:{label:'墓地のATK1500以下の通常モンスターを回収（新しい順）',scope:'player',amount:3,min:1,max:3},
 earthAura:{label:'指定属性のATK＋指定値／DEF減少（フィールド）',scope:'monster',amount:500,min:1,max:2000},
 pierce:{label:'装備モンスターに貫通ダメージ能力',scope:'monster',amount:0},
 sealEnemyAttacks:{label:'相手の次の3ターンの攻撃を禁止（新しいモンスターにも適用）',scope:'none',amount:0},
 negateEndBattle:{label:'攻撃を無効にしバトルフェイズ終了',scope:'none',amount:0},
 redirectAttack:{label:'攻撃対象を別の自分モンスターへ変更（左端優先）',scope:'none',amount:0},
 redirectToAttackerAlly:{label:'攻撃者側の別モンスターへ攻撃対象変更（自動選択）',scope:'none',amount:0},
 destroyOnEnemySummon:{label:'相手の通常召喚・反転召喚時、指定ATK以上なら破壊（自動発動）',scope:'monster',amount:1000,min:0,max:5000},
 concealDefender:{label:'攻撃対象の自分モンスターを裏側守備にして攻撃無効',scope:'none',amount:0},
 blastAttacker:{label:'攻撃モンスターを破壊し双方に現在ATK分のダメージ',scope:'monster',amount:0},
 boost:{label:'攻撃力をアップ',scope:'monster',amount:500,min:1,max:10000},
 weaken:{label:'攻撃力をダウン',scope:'monster',amount:500,min:1,max:10000},
 boostDef:{label:'守備力をアップ',scope:'monster',amount:500,min:1,max:10000},
 diceStats:{label:'擬似サイコロ（1～6）×100で味方ATK/DEF上昇・敵ATK/DEF低下',scope:'monster',amount:0},
 boostBoth:{label:'表側モンスターのATK・DEFを同時にアップ（ターン終了まで）',scope:'monster',amount:500,min:1,max:10000},
 changeStats:{label:'表側モンスターの攻撃力・守備力を個別に増減（ターン終了まで）',scope:'monster',amount:500,min:-10000,max:10000},
 weakenBoth:{label:'表側モンスターのATK・DEFを同時にダウン（ターン終了まで）',scope:'monster',amount:500,min:1,max:10000},
 weakenDef:{label:'守備力をダウン',scope:'monster',amount:500,min:1,max:10000},
 returnHand:{label:'モンスターを手札に戻す',scope:'monster',amount:0},
 returnDeck:{label:'モンスターをデッキに戻す',scope:'monster',amount:0},
 sendGrave:{label:'モンスターを墓地へ送る（破壊しない）',scope:'monster',amount:0},
 changePosition:{label:'攻撃・守備表示を変更',scope:'monster',amount:0},
 setAttackerDefense:{label:'攻撃モンスターを守備表示にして攻撃を中断',scope:'monster',amount:0},
 setAtk:{label:'攻撃力を指定値に変更',scope:'monster',amount:1500,min:0,max:10000},
 setDef:{label:'守備力を指定値に変更',scope:'monster',amount:1500,min:0,max:10000},
 lockAttack:{label:'次のターンまで攻撃を封じる',scope:'monster',amount:0},
 negateWeakenAttacker:{label:'攻撃を無効にして攻撃者のATKを下げ、攻撃を一時禁止',scope:'monster',amount:700,min:1,max:2000},
 preventEquipAttack:{label:'装備中の相手モンスターの攻撃を禁止',scope:'monster',amount:0},
 tributeOtherToAttack:{label:'攻撃時、ほかの自分のモンスター1体をリリース',scope:'player',amount:0},
 timeWizardCoin:{label:'擬似コイントスで片方の全モンスター破壊',scope:'player',amount:0},
 conditionBranch:{label:'条件成立・不成立で異なる効果を実行',scope:'none',amount:0},
 coinBranch:{label:'コイントスで表・裏それぞれの効果を実行',scope:'none',amount:0},
 selfSpecialFromHand:{label:'手札からこのモンスターを特殊召喚',scope:'player',amount:0},
 selfSpecialFromHandGiveRevive:{label:'手札から特殊召喚＋相手墓地から1体自動蘇生',scope:'player',amount:0},
 lockWhileSourceFaceUp:{label:'このモンスターが表側の間、相手1体の攻撃を禁止',scope:'monster',amount:0},
 negateAndLockAttacker:{label:'攻撃を無効にし、その攻撃モンスターを次のターンまで攻撃禁止',scope:'monster',amount:0},
 lpRelativeEquip:{label:'LP比較で装備モンスターの元々のATKを2倍／半分',scope:'monster',amount:0},
 fusionMaterialSubstitute:{label:'融合召喚の素材1体の代用になる',scope:'player',amount:0},
 directEarthWaterFire:{label:'相手の表側が地・水・炎のみなら直接攻撃可能',scope:'player',amount:0},
 lockPositionNextTurn:{label:'次の相手ターンの手動表示変更を禁止',scope:'player',amount:0},
 lockEffect:{label:'次のターンまで起動効果を封じる',scope:'monster',amount:0},
 steal:{label:'モンスターのコントロールを移す',scope:'monster',amount:0},
 destroyGiveOwn:{label:'相手モンスターを破壊し自分の左端1体を相手に渡す',scope:'monster',amount:0},
 destroyBackrow:{label:'魔法・罠を破壊',scope:'backrow',amount:0},
 removeSpellBackrow:{label:'魔法除去：魔法なら破壊・伏せ罠なら確認のみ',scope:'backrow',amount:0},
 destroyThenSetBackrow:{label:'魔法・罠を破壊後、手札から1枚セット（自動選択）',scope:'backrow',amount:0},
 banishBackrow:{label:'魔法・罠を除外',scope:'backrow',amount:0},
 banishSetBackrow:{label:'セットされた魔法・罠1枚を除外',scope:'backrow',amount:0},
 returnBackrow:{label:'魔法・罠を手札に戻す',scope:'backrow',amount:0},
 discardRandom:{label:'手札をランダムに捨てる',scope:'player',amount:1,min:1,max:10},
 banishOwnHand:{label:'自分の手札を除外（末尾優先）',scope:'player',amount:1,min:1,max:5},
 returnOwnHandToDeck:{label:'自分の手札をデッキに戻す（末尾優先）',scope:'player',amount:1,min:1,max:5},
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
 negateEffect:{label:'直前のチェーン効果を無効化',scope:'none',amount:0},
 protectOwnTraps:{label:'自分の罠を破壊する直前の効果を無効化（簡易）',scope:'none',amount:0},
 redirectSpellTarget:{label:'相手の対象指定魔法を別の適切なモンスターへ変更（左端優先）',scope:'none',amount:0},
 crushVirus:{label:'闇属性・ATK1000以下1体をリリースして相手のATK1500以上を破壊',scope:'none',amount:0},
 revealSetMonsters:{label:'お互いの裏側守備モンスターを表側守備にする',scope:'none',amount:0}
};
// A is paid immediately at activation, before B enters the chain. Keep the
// allowed vocabulary small and deterministic so RTDB and local games agree.
// A follow-up stage is only allowed when it does not require a second manual target picker.
// Single-card targets may be reused only when the preceding stage selected that same side/zone.
export function followUpTargets(operation,firstTarget,when='main',type='monster',spellKind='normal'){
 const op=ABILITY_META[operation];
 if(!op||['summonMonsterHand','banishOwnHand','returnOwnHandToDeck'].includes(operation)&&(when!=='main'||!['monster','spell'].includes(type)||type==='spell'&&!['normal','quick'].includes(spellKind))||when==='battleDamage'||['reflectAttack','redirectAttack','concealDefender','negateAttack','negateEndBattle','blastAttacker','negateEffect','protectOwnTraps','redirectSpellTarget','crushVirus','revealSetMonsters','reviveSelected','sealEnemyAttacks','steal','searchNamed','summonNamedFromHand','replaceHands','swapPrintedStats','recoverNormalAtk','earthAura','pierce','diceStats','millFirstType','summonRaceFromHand','summonSheepTokens','summonKuribohTokens','extraNormalSummon','reviveBothSet','destroyGiveOwn','borrowOpponentSpell','lockPositionNextTurn','setAttackerDefense','negateAndLockAttacker','negateWeakenAttacker','preventEquipAttack','tributeOtherToAttack','timeWizardCoin','conditionBranch','selfSpecialFromHand','selfSpecialFromHandGiveRevive','lockWhileSourceFaceUp','lpRelativeEquip','fusionMaterialSubstitute','directEarthWaterFire'].includes(operation))return [];
 const permitted=abilityTargets(operation,when,type,spellKind);
 const automatic=new Set(['none','self','opponent','ownAllMonsters','enemyAllMonsters','enemyAttackMonsters','bothMonsters','ownAllBackrow','enemyAllBackrow','bothAllBackrow','enemyLowestAtk','enemyFaceDownMonster']);
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
export const beforeText=a=>{const m=BEFORE_META[a?.operation];return m?`${m.label}（${a.amount}${m.zone==='lp'?'LP':m.zone==='monsters'?'体':'枚'}）${monsterFilterText(a.filter)}`:'';};
export const OPERATIONS=Object.fromEntries(Object.entries(ABILITY_META).map(([k,v])=>[k,v.label]));
// Legacy reference: the first member now means the recommended initial value, not the only allowed value.
export const EFFECT_VALUES=Object.fromEntries(Object.entries(ABILITY_META).map(([k,v])=>[k,[v.amount]]));
export function abilityTargets(operation,when='main',type='monster',spellKind='normal'){
 const meta=ABILITY_META[operation];if(!meta)return ['none'];
 if(meta.scope==='none')return ['none'];
 if(['removeSpellBackrow','destroyThenSetBackrow','banishSetBackrow'].includes(operation))return ['enemyBackrow'];
 if(operation==='changeStats')return when==='main'&&(type==='monster'||type==='spell'&&['normal','quick'].includes(spellKind))?['ownAllMonsters','enemyAllMonsters','bothMonsters']:[];
 if(operation==='swapPrintedStats'||operation==='earthAura')return ['bothMonsters'];
 if(operation==='diceStats')return when==='attack'&&type==='trap'?['enemyAllMonsters']:['ownAllMonsters'];
 if(operation==='pierce')return ['ownMonster'];
 if(operation==='blastAttacker')return ['attacker'];
 if(operation==='destroyOnEnemySummon')return ['enemyMonster'];
 if(operation==='setAttackerDefense'||operation==='negateAndLockAttacker'||operation==='negateWeakenAttacker')return ['attacker'];
 if(operation==='lpRelativeEquip')return ['ownMonster'];
 if(['fusionMaterialSubstitute','directEarthWaterFire','tributeOtherToAttack','timeWizardCoin','selfSpecialFromHand','selfSpecialFromHandGiveRevive'].includes(operation))return ['self'];
 if(operation==='preventEquipAttack')return ['enemyMonster'];
 if(meta.scope==='grave')return ['eitherGraveMonster'];
 if(when==='flip'&&FLIP_FIELD_FILTER_OPERATIONS.includes(operation))return ['enemyAllMonsters','ownAllMonsters','bothMonsters'];
 if(['summonNamedFromHand','summonMonsterHand','summonMonsterDeck','banishOwnHand','returnOwnHandToDeck','extraNormalSummon'].includes(operation))return ['self'];
 if(operation==='millFirstType'||operation==='mill'&&when==='battleDamage')return ['opponent'];
 if(operation==='lockWhileSourceFaceUp')return ['enemyMonster'];
 if(operation==='summonRaceFromHand'||operation==='summonSheepTokens'||operation==='summonKuribohTokens')return ['self'];
 if(meta.scope==='player')return ['self','opponent'];
 if(meta.scope==='backrow')return ['enemyBackrow','ownBackrow','enemyAllBackrow','ownAllBackrow','bothAllBackrow'];
 if(when==='continuous'){
  if(type==='monster')return ['ownMonster'];
  if(spellKind==='field')return ['ownAllMonsters','enemyAllMonsters','bothMonsters'];
  if(spellKind==='equip')return ['ownMonster','enemyMonster'];
 }
 if(['boostBoth','weakenBoth'].includes(operation))return when==='continuous'?[]:['ownAllMonsters','enemyAllMonsters','bothMonsters'];
 if(operation==='destroy')return ['enemyMonster','ownMonster','enemyLowestAtk','enemyAllMonsters','enemyAttackMonsters','ownAllMonsters','bothMonsters'];
 if(operation==='banish')return ['enemyMonster','ownMonster','enemyFaceDownMonster','enemyAllMonsters','ownAllMonsters','bothMonsters'];
 const first=['boost','boostDef','setAtk','setDef'].includes(operation)?'ownMonster':'enemyMonster';
 const second=first==='ownMonster'?'enemyMonster':'ownMonster';
 return [...(when==='attack'?['attacker']:[]),first,second,'enemyAllMonsters','ownAllMonsters','bothMonsters'];
}
// Exactly two fusion ingredients, with at most one substitute; no three-material or
// multi-substitute edge case. This pure matcher is shared by UI and duel engine.
export function fusionMaterialsMatch(required,actual,isSubstitute){
 if(!Array.isArray(required)||![2,3].includes(required.length)||!Array.isArray(actual)||actual.length!==required.length)return false;
 if([...required].sort().join(',')===[...actual].sort().join(','))return true;
 if(required.length===3)return false; // Three-material fusions require all three printed names.
 return actual.some((id,i)=>isSubstitute(id)&&required.includes(actual[1-i]));
}
// The only optional deck selector vocabulary. Omitted means no condition.
export const DECK_FILTER_ATTRIBUTES=['闇','光','地','水','炎','風','神'];
export const DECK_FILTER_RACES=['ドラゴン','戦士','魔法使い','機械','悪魔','天使','獣','獣戦士','鳥獣','水','昆虫','岩石','植物','アンデット','爬虫類','炎','魚','雷','恐竜','海竜','サイキック','幻竜','サイバース','幻想魔','幻神獣'];
export const COIN_BRANCH_OPERATIONS=['draw','heal','damage','mill','searchMonster','graveRecover','graveRevive','destroy','banish','boost','weaken','graveBanish','graveRecycle','banishedRecover','banishDeck','searchSpell','searchTrap','discardNewest','summonMonsterHand','banishOwnHand','returnOwnHandToDeck','sendGrave','returnHand','destroyBackrow','banishBackrow','returnBackrow','summonMonsterDeck','returnDeck','boostDef','weakenDef','boostBoth','weakenBoth','changeStats'];
const DECK_FILTER_KEYS=['atkMin','atkMax','defMin','defMax','levelMin','levelMax','attribute','race','nameContains','cardType','subtype','maxCount','order','spellKind','summonKind','summonPosition','deckPlacement','fieldPosition'];
export const FILTERABLE_OPERATIONS=['searchMonster','summonMonsterDeck','graveRevive','graveRecover','graveBanish','graveRecycle','banishedRecover','mill','banishDeck','searchSpell','searchTrap','discardNewest','summonMonsterHand','banishOwnHand','returnOwnHandToDeck'];
export const FIELD_FILTER_OPERATIONS=['destroy','banish','sendGrave','returnHand','returnDeck','boost','weaken','boostDef','weakenDef','setAtk','setDef','changePosition','lockAttack','lockEffect','boostBoth','weakenBoth','changeStats'];
export const FLIP_FIELD_FILTER_OPERATIONS=['returnHand','returnDeck','banish','boost','weaken','boostDef','weakenDef','lockAttack','lockEffect','boostBoth','weakenBoth'];
export const FIELD_FILTER_TARGETS=['ownAllMonsters','enemyAllMonsters','enemyAttackMonsters','bothMonsters'];
const MIXED_ZONE_FILTERS=['graveRecover','graveBanish','graveRecycle','banishedRecover','mill','banishDeck'];
export const MOVE_COUNT_BACKROW=['destroyBackrow','banishBackrow','returnBackrow'];
export const BACKROW_BATCH_TARGETS=['ownAllBackrow','enemyAllBackrow','bothAllBackrow'];
function validOperationFilter(stage,when=stage.when||'main'){
 if(MOVE_COUNT_BACKROW.includes(stage.operation)){
  const f=stage.filter;return BACKROW_BATCH_TARGETS.includes(stage.target)&&['main','attack','response','summon'].includes(when)&&!!f&&typeof f==='object'&&!Array.isArray(f)&&Object.keys(f).length>0&&Object.keys(f).every(k=>['fieldPosition','maxCount','cardType','spellKind','nameContains'].includes(k))&&
   (f.fieldPosition===undefined||['faceup','set'].includes(f.fieldPosition))&&(f.maxCount===undefined||Number.isInteger(f.maxCount)&&f.maxCount>=1&&f.maxCount<=12)&&
   (f.cardType===undefined||['spell','trap'].includes(f.cardType))&&(f.spellKind===undefined||f.cardType==='spell'&&['normal','quick','continuous','equip','field','ritual','fusion'].includes(f.spellKind))&&
   (f.nameContains===undefined||typeof f.nameContains==='string'&&f.nameContains.length>0&&f.nameContains.length<=32&&f.nameContains===f.nameContains.trim())&&
   (f.fieldPosition!=='set'||f.cardType===undefined&&f.spellKind===undefined&&f.nameContains===undefined);
 }
 if(!validDeckFilter(stage.filter))return false;
 if(stage.filter.fieldPosition!==undefined){
  if(!FIELD_FILTER_OPERATIONS.includes(stage.operation)||!FIELD_FILTER_TARGETS.includes(stage.target))return false;
  if(stage.target==='enemyAttackMonsters'&& !['atk','faceup'].includes(stage.filter.fieldPosition))return false;
  if(stage.filter.fieldPosition==='set'&&!['destroy','banish','sendGrave','returnHand','returnDeck'].includes(stage.operation))return false;
 }
 if(stage.filter.summonPosition!==undefined&&!['summonMonsterHand','summonMonsterDeck','graveRevive'].includes(stage.operation))return false;
 if(stage.filter.deckPlacement!==undefined&&stage.operation!=='returnOwnHandToDeck')return false;
 if(['discardNewest','banishOwnHand','returnOwnHandToDeck'].includes(stage.operation))return stage.target==='self'&&stage.filter.maxCount===undefined&&stage.filter.order===undefined;
 if(['summonMonsterDeck','summonMonsterHand'].includes(stage.operation)&&stage.filter.summonKind&&stage.filter.summonKind!=='normal')return false;
 if(['searchSpell','searchTrap'].includes(stage.operation))return stage.filter.cardType===(stage.operation==='searchSpell'?'spell':'trap');
 if(FIELD_FILTER_OPERATIONS.includes(stage.operation))return FIELD_FILTER_TARGETS.includes(stage.target)&&(['main','attack','response','summon'].includes(when)||when==='flip'&&FLIP_FIELD_FILTER_OPERATIONS.includes(stage.operation))&&(!stage.filter.cardType||stage.filter.cardType==='monster');
 return FILTERABLE_OPERATIONS.includes(stage.operation)&&stage.filter.maxCount===undefined&&stage.filter.order===undefined&&(!stage.filter.cardType||stage.filter.cardType==='monster'||MIXED_ZONE_FILTERS.includes(stage.operation));
}
export function validDeckFilter(f){
 return !!f&&typeof f==='object'&&!Array.isArray(f)&&Object.keys(f).length>0&&
  Object.keys(f).every(k=>DECK_FILTER_KEYS.includes(k))&&
  ['atkMin','atkMax','defMin','defMax'].every(k=>f[k]===undefined||Number.isInteger(f[k])&&f[k]>=0&&f[k]<=5000)&&
  ['levelMin','levelMax'].every(k=>f[k]===undefined||Number.isInteger(f[k])&&f[k]>=1&&f[k]<=12)&&
  (f.atkMin===undefined||f.atkMax===undefined||f.atkMin<=f.atkMax)&&
  (f.defMin===undefined||f.defMax===undefined||f.defMin<=f.defMax)&&
  (f.levelMin===undefined||f.levelMax===undefined||f.levelMin<=f.levelMax)&&
  (f.maxCount===undefined||Number.isInteger(f.maxCount)&&f.maxCount>=1&&f.maxCount<=10)&&
  (f.order===undefined||f.maxCount!==undefined&&['left','atkLow','atkHigh','defLow','defHigh'].includes(f.order))&&
  (f.cardType===undefined||['monster','spell','trap'].includes(f.cardType))&&
  (f.subtype===undefined||['normal','effect'].includes(f.subtype))&&
  (!f.cardType||f.cardType==='monster'||Object.keys(f).every(k=>['cardType','nameContains','spellKind','deckPlacement'].includes(k)))&&
  (f.fieldPosition===undefined||['atk','def','faceup','set'].includes(f.fieldPosition)&&(!f.cardType||f.cardType==='monster')&&
   (f.fieldPosition!=='set'||Object.keys(f).every(k=>['fieldPosition','cardType','maxCount','order'].includes(k))&&(!f.order||f.order==='left')))&&
  (f.deckPlacement===undefined||['top','bottom'].includes(f.deckPlacement))&&
  (f.summonPosition===undefined||['atk','def'].includes(f.summonPosition)&&(!f.cardType||f.cardType==='monster'))&&
  (f.summonKind===undefined||(!f.cardType||f.cardType==='monster')&&['normal','ritual','fusion'].includes(f.summonKind))&&
  (f.spellKind===undefined||f.cardType==='spell'&&['normal','quick','continuous','equip','field','ritual','fusion'].includes(f.spellKind))&&
  (f.attribute===undefined||DECK_FILTER_ATTRIBUTES.includes(f.attribute))&&
  (f.race===undefined||DECK_FILTER_RACES.includes(f.race))&&
  (f.nameContains===undefined||typeof f.nameContains==='string'&&f.nameContains.length>0&&f.nameContains.length<=32&&f.nameContains===f.nameContains.trim());
}
export function matchesDeckFilter(card,filter){
 if(card?.type!==(filter?.cardType||'monster'))return false;
 if(!filter)return true;
 return (filter.summonKind===undefined||(card.summonKind||'normal')===filter.summonKind)&&
  (filter.spellKind===undefined||(card.spellKind||'normal')===filter.spellKind)&&
  (filter.subtype===undefined||(card.subtype||'normal')===filter.subtype&&(!['ritual','fusion'].includes(card.summonKind)||filter.subtype!=='normal'))&&
  (filter.atkMin===undefined||card.atk>=filter.atkMin)&&
  (filter.atkMax===undefined||card.atk<=filter.atkMax)&&
  (filter.defMin===undefined||card.def>=filter.defMin)&&
  (filter.defMax===undefined||card.def<=filter.defMax)&&
  (filter.levelMin===undefined||card.level>=filter.levelMin)&&
  (filter.levelMax===undefined||card.level<=filter.levelMax)&&
  (filter.attribute===undefined||card.attribute===filter.attribute)&&
  (filter.race===undefined||card.race===filter.race)&&
  (filter.nameContains===undefined||(card.name||'').includes(filter.nameContains));
}
function validStatDelta(stage){return stage.operation==='changeStats'?Number.isSafeInteger(stage.defAmount)&&Math.abs(stage.defAmount)<=10000&&!!(stage.amount||stage.defAmount):stage.defAmount===undefined;}
export function validCoinStage(stage,allowPreviousMoved=false){
 if(!stage||typeof stage!=='object'||Array.isArray(stage)||Object.keys(stage).some(k=>!['amount','operation','target','filter','scale','defAmount'].includes(k)))return false;
 if(!validStatDelta(stage))return false;
 if(stage.scale!==undefined&&!validAmountScale(stage,'main',allowPreviousMoved))return false;
 if(stage.filter!==undefined&&!validOperationFilter(stage))return false;
 if(!COIN_BRANCH_OPERATIONS.includes(stage.operation)||!Number.isSafeInteger(stage.amount))return false;
 const meta=ABILITY_META[stage.operation];
 if(stage.amount<(meta.min??0)||stage.amount>(meta.max??0))return false;
 // All targets are automatically resolved; never open a second target picker.
 const permitted=meta.scope==='monster'?['enemyAllMonsters','ownAllMonsters','bothMonsters']:
  meta.scope==='backrow'?BACKROW_BATCH_TARGETS:stage.operation==='damage'||stage.operation==='heal'||meta.scope==='player'?['self','opponent']:[];
 return permitted.includes(stage.target)&&(!['summonMonsterHand','summonMonsterDeck','banishOwnHand','returnOwnHandToDeck'].includes(stage.operation)||stage.target==='self');
}
// A branch is allowed one automatic follow-up. Leaf validation remains non-recursive.
export const BRANCH_SEQUENCE_FIRST=['draw','heal','damage','searchMonster','searchSpell','searchTrap','mill','banishDeck','discardNewest','banishOwnHand','returnOwnHandToDeck','graveRecover','graveBanish','graveRecycle','banishedRecover','destroy','banish','sendGrave','returnHand','destroyBackrow','banishBackrow','returnBackrow','summonMonsterHand','summonMonsterDeck','graveRevive','returnDeck','boostBoth','weakenBoth','changeStats'];
export const MOVE_COUNT_FIELD=['destroy','banish','sendGrave','returnHand','returnDeck'];
export const COUNT_SUMMON_OPERATIONS=['summonMonsterHand','summonMonsterDeck','graveRevive'];
export const MOVE_COUNT_ZONE=['searchMonster','searchSpell','searchTrap','mill','banishDeck','discardNewest','banishOwnHand','returnOwnHandToDeck','graveRecover','graveBanish','graveRecycle','banishedRecover'];
export function canCountPreviousMove(stage){return !!stage&&(MOVE_COUNT_FIELD.includes(stage.operation)&&FIELD_FILTER_TARGETS.includes(stage.target)||MOVE_COUNT_BACKROW.includes(stage.operation)&&BACKROW_BATCH_TARGETS.includes(stage.target)||(MOVE_COUNT_ZONE.includes(stage.operation)||COUNT_SUMMON_OPERATIONS.includes(stage.operation)||stage.operation==='draw')&&['self','opponent'].includes(stage.target));}
const previousScaleContext=stage=>canCountPreviousMove(stage)&&(MOVE_COUNT_FIELD.includes(stage.operation)?stage.operation:true);
export function validBranchStage(stage){
 if(!stage||typeof stage!=='object'||Array.isArray(stage))return false;
 if(!Object.hasOwn(stage,'then'))return validCoinStage(stage);
 const {then,...first}=stage;
 return BRANCH_SEQUENCE_FIRST.includes(first.operation)&&validCoinStage(first)&&validCoinStage(then,previousScaleContext(first));
}
export function validCountRequirement(r){
 if(!r||typeof r!=='object'||Array.isArray(r)||!['comparison,count,kind,zone','comparison,count,filter,kind,zone'].includes(Object.keys(r).sort().join(',')))return false;
 if(['ownLP','enemyLP','relativeLP'].includes(r.zone))return r.kind==='lp'&&r.filter===undefined&&['atLeast','atMost','equal'].includes(r.comparison)&&Number.isSafeInteger(r.count)&&r.count>=(r.zone==='relativeLP'?-99999:0)&&r.count<=99999;
 if(/^(own|enemy|both)(Hand|Deck)$/.test(r.zone))return r.kind==='all'&&r.filter===undefined&&['atLeast','atMost','equal'].includes(r.comparison)&&Number.isSafeInteger(r.count)&&r.count>=0&&r.count<=(r.zone.startsWith('both')?120:60);
 if(/^(own|enemy|both)Backrow$/.test(r.zone))return ['all','faceup','set','spell','trap'].includes(r.kind)&&r.filter===undefined&&['atLeast','atMost','equal'].includes(r.comparison)&&Number.isSafeInteger(r.count)&&r.count>=0&&r.count<=(r.zone==='bothBackrow'?10:5);
 const field=['ownField','enemyField','bothField'].includes(r.zone),grave=/^(own|enemy|both)(Grave|Banished)$/.test(r.zone);
 if(r.filter!==undefined){
  if(!validDeckFilter(r.filter)||['maxCount','order','summonPosition','deckPlacement','fieldPosition'].some(k=>r.filter[k]!==undefined))return false;
  if(field){if(!['atk','def','faceup'].includes(r.kind)||r.filter.cardType&&r.filter.cardType!=='monster')return false;}
  else if(!grave||!['monster','spell','trap'].includes(r.kind)||(r.filter.cardType||'monster')!==r.kind)return false;
 }
 return (field||grave)&&['atLeast','atMost','equal'].includes(r.comparison)&&
  (field?['all','atk','def','set','faceup']:['all','monster','spell','trap']).includes(r.kind)&&
  Number.isSafeInteger(r.count)&&r.count>=0&&r.count<=(field?(r.zone==='bothField'?10:5):120);
}
export function validAmountScale(stage,when='main',allowPreviousMoved=false){
 const r=stage.scale;
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['zone','kind','filter'].includes(k))||typeof r.zone!=='string'||r.zone.endsWith('LP'))return false;
 if(when!=='main')return false;
 const independent=stage.operation==='changeStats';
 const validPercent=independent?Number.isSafeInteger(stage.amount)&&Math.abs(stage.amount)<=1000&&Number.isSafeInteger(stage.defAmount)&&Math.abs(stage.defAmount)<=1000:Number.isSafeInteger(stage.amount)&&stage.amount>=1&&stage.amount<=1000;
 if(r.zone==='previousMoved'){if(!allowPreviousMoved||r.kind!=='all'||Object.keys(r).length!==2)return false;}
 else if(['previousDestroyedAtk','previousDestroyedDef'].includes(r.zone)){if(allowPreviousMoved!=='destroy'||r.kind!=='all'||Object.keys(r).length!==2||!validPercent)return false;}
 else if(['previousMovedAtk','previousMovedDef','previousMovedLevel'].includes(r.zone)){if(!['banish','sendGrave','returnHand','returnDeck'].includes(allowPreviousMoved)||r.kind!=='all'||Object.keys(r).length!==2||r.zone!=='previousMovedLevel'&&!validPercent)return false;}
 else if(r.zone==='previousDestroyedLevel'){if(allowPreviousMoved!=='destroy'||r.kind!=='all'||Object.keys(r).length!==2)return false;}
 else if(!validCountRequirement({...r,comparison:'atLeast',count:0}))return false;
 return (['damage','heal'].includes(stage.operation)||stage.operation==='draw'&&r.zone==='previousMoved')&&['self','opponent'].includes(stage.target)||(['boost','weaken','boostDef','weakenDef','boostBoth','weakenBoth'].includes(stage.operation)&&FIELD_FILTER_TARGETS.includes(stage.target)||independent&&['ownAllMonsters','enemyAllMonsters','bothMonsters'].includes(stage.target));
}
export function isValidAbility(a,type='monster',spellKind='normal'){
 if(!a||typeof a!=='object'||!Object.hasOwn(TRIGGERS,a.when)||!Object.hasOwn(TARGETS,a.target)||!Object.hasOwn(ABILITY_META,a.operation))return false;
 if(!validStatDelta(a)||a.operation==='changeStats'&&(a.when!=='main'||a.before||!abilityTargets(a.operation,a.when,type,spellKind).includes(a.target)))return false;
 if(a.scale!==undefined&&(!validAmountScale(a,a.when)||!(type==='monster'||type==='spell'&&['normal','quick'].includes(spellKind))))return false;
 if(a.requirement2!==undefined&&(!a.requirement||!validCountRequirement(a.requirement2)))return false;
 if(a.requirementMode!==undefined&&(a.requirementMode!=='or'||!a.requirement||!a.requirement2))return false;
 if(a.operation==='conditionBranch')return type==='monster'&&a.when==='main'&&a.target==='none'&&a.amount===0&&validCountRequirement(a.requirement)&&validBranchStage(a.heads)&&validBranchStage(a.tails)&&Object.keys(a).sort().join(',')===(a.requirement2===undefined?'amount,heads,operation,requirement,tails,target,when':a.requirementMode==='or'?'amount,heads,operation,requirement,requirement2,requirementMode,tails,target,when':'amount,heads,operation,requirement,requirement2,tails,target,when');
 if(a.requirement!==undefined&&(!validCountRequirement(a.requirement)||a.when!=='main'||!['draw','heal','damage'].includes(a.operation)||a.before!==undefined&&a.before?.operation!=='payLP'&&!a.before?.filter||!['self','opponent'].includes(a.target)||!(type==='monster'||type==='spell'&&['normal','quick'].includes(spellKind))))return false;
 if(a.filter!==undefined&&!validOperationFilter(a))return false;
 if(a.filter&&a.before&&['searchSpell','searchTrap','discardNewest'].includes(a.operation))return false;
 if(a.filter&&a.before&&(FIELD_FILTER_OPERATIONS.includes(a.operation)||MIXED_ZONE_FILTERS.includes(a.operation)&&(['graveBanish','graveRecycle','banishedRecover','mill','banishDeck'].includes(a.operation)||a.filter.cardType||a.filter.subtype)))return false;
 if(a.operation==='coinBranch'){
  if(type!=='monster'||a.when!=='main'||a.target!=='none'||a.amount!==0||!validBranchStage(a.heads)||!validBranchStage(a.tails)||a.then!==undefined||a.before!==undefined||Object.keys(a).sort().join(',')!=='amount,heads,operation,tails,target,when')return false;
 }else if(a.heads!==undefined||a.tails!==undefined)return false;
 if(['summonMonsterHand','banishOwnHand','returnOwnHandToDeck'].includes(a.operation)&&(a.when!=='main'||a.target!=='self'||!['monster','spell'].includes(type)||type==='spell'&&!['normal','quick'].includes(spellKind)||a.before))return false;
 if(a.operation==='summonMonsterDeck'&&(a.target!=='self'||a.when==='continuous'||a.then!==undefined&&!(a.when==='main'&&(type==='monster'||type==='spell'&&['normal','quick'].includes(spellKind)))))return false;
 if(['flip','grave','destroyed'].includes(a.when)){
  const playerEffect=['draw','searchMonster','summonMonsterDeck','searchSpell','searchTrap','heal','damage','mill','graveRecover'].includes(a.operation)&&['self','opponent'].includes(a.target);
  const flipGroup=a.when==='flip'&&FLIP_FIELD_FILTER_OPERATIONS.includes(a.operation)&&FIELD_FILTER_TARGETS.includes(a.target)&&!!a.filter;
  if(type!=='monster'||!(playerEffect||flipGroup)||a.then||a.before)return false;
 }
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
 if(a.operation==='summonSheepTokens'&&!(type==='spell'&&['normal','quick'].includes(spellKind)&&a.when==='main'&&a.target==='self'&&Number.isInteger(a.amount)&&a.amount>=1&&a.amount<=4&&!a.before&&!a.then&&Object.keys(a).sort().join(',')==='amount,operation,target,when'))return false;
 if(a.operation==='summonKuribohTokens'&&!(type==='spell'&&['normal','quick'].includes(spellKind)&&a.when==='main'&&a.target==='self'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).sort().join(',')==='amount,operation,target,when'))return false;
 if(a.operation==='extraNormalSummon'&&!(type==='trap'&&a.when==='continuous'&&a.target==='self'&&a.amount===500&&!a.before&&!a.then&&Object.keys(a).sort().join(',')==='amount,operation,target,when'))return false;
 if(a.operation==='reviveBothSet'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='none'&&a.amount===0&&a.then===undefined&&a.before===undefined&&Object.keys(a).every(k=>['when','operation','target','amount'].includes(k))))return false;
 if(a.operation==='sealEnemyAttacks'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='none'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(type==='trap'&&a.when==='main'&&!(a.operation==='graveRevive'&&a.target==='self'&&a.amount===1&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.requiredFaceUpName!==undefined&&a.operation!=='summonRaceFromHand')return false;
 if(a.operation==='millFirstType'){
  if(a.when!=='battleDamage'||type!=='monster'||a.target!=='opponent'||a.amount!==0||!['monster','spell','trap'].includes(a.match)||a.query!==undefined||a.before!==undefined||a.then!==undefined)return false;
  if(Object.keys(a).some(k=>!['when','operation','target','amount','match'].includes(k)))return false;
 }
 if(!['searchNamed','summonNamedFromHand','millFirstType','summonRaceFromHand'].includes(a.operation)&&(a.query!==undefined||a.match!==undefined))return false;
 if(a.operation==='summonMonsterDeck'&&a.before!==undefined)return false;
 if(a.operation==='summonNamedFromHand'&&!(a.when==='main'&&['monster','spell'].includes(type)&&a.amount===0&&!a.then))return false;
 if(!Number.isSafeInteger(a.amount)||(meta.min===undefined?a.amount!==0:a.amount<meta.min||a.amount>meta.max))return false;
 if(type==='monster'&&!['main','summon','flip','grave','destroyed','continuous','battleDamage'].includes(a.when))return false;
 // Battle-damage triggers are synchronous, player-only, and never open a
 // second chain or manual cost picker; limit the vocabulary deliberately.
 if(a.when==='battleDamage'&&!(type==='monster'&&
  (['draw','discardNewest','millFirstType'].includes(a.operation)||a.operation==='mill'&&a.target==='opponent'&&!!a.filter)&&!a.before&&!a.then))return false;
 if(type==='spell'&&a.when!=='main'&&!(a.when==='continuous'&&['continuous','equip','field'].includes(spellKind)))return false;
 if(type==='trap'&&!['attack','response','summon'].includes(a.when)&&!(a.when==='continuous'&&a.operation==='extraNormalSummon')&&!(a.when==='main'&&a.operation==='graveRevive'))return false;
 if(a.when==='summon'&&type==='trap'&&a.operation!=='destroyOnEnemySummon')return false;
 if(a.operation==='removeSpellBackrow'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='enemyBackrow'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='destroyThenSetBackrow'&&!(type==='trap'&&a.when==='response'&&a.target==='enemyBackrow'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='banishSetBackrow'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='enemyBackrow'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='diceStats'&&!(a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4&&
   (type==='spell'&&spellKind==='quick'&&a.when==='main'&&a.target==='ownAllMonsters'||
    type==='trap'&&a.when==='attack'&&a.target==='enemyAllMonsters')))return false;
 if(a.operation==='crushVirus'&&!(type==='trap'&&a.when==='response'&&a.target==='none'&&a.amount===0&&!a.then&&
   a.before?.operation==='sendOwnMonsterGrave'&&a.before.amount===1&&Object.keys(a).length===5))return false;
 if(a.operation==='revealSetMonsters'&&!(type==='trap'&&a.when==='response'&&a.target==='none'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='destroyOnEnemySummon'&&!(type==='trap'&&a.when==='summon'&&a.target==='enemyMonster'&&a.amount>=0&&a.amount<=5000&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='redirectToAttackerAlly'&&!(type==='trap'&&a.when==='attack'&&a.target==='none'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.when==='continuous'&&!['boost','weaken','boostDef','weakenDef','earthAura','pierce','lpRelativeEquip','fusionMaterialSubstitute','directEarthWaterFire','tributeOtherToAttack','preventEquipAttack','extraNormalSummon'].includes(a.operation))return false;
 // Exceptional recipe types are deliberately bound to one supported trigger/zone.
 if(a.operation==='destroyGiveOwn'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='enemyMonster'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='borrowOpponentSpell'&&!(type==='trap'&&a.when==='response'&&a.target==='self'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='negateWeakenAttacker'&&!(type==='trap'&&a.when==='attack'&&a.target==='attacker'&&a.amount>=1&&a.amount<=2000&&!a.before&&!a.then))return false;
 if(a.operation==='preventEquipAttack'&&!(type==='spell'&&spellKind==='equip'&&a.when==='continuous'&&a.target==='enemyMonster'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='tributeOtherToAttack'&&!(type==='monster'&&a.when==='continuous'&&a.target==='self'&&a.amount===0&&!a.before&&!a.then))return false;
 if(['timeWizardCoin','selfSpecialFromHand','selfSpecialFromHandGiveRevive'].includes(a.operation)&&!(type==='monster'&&a.when==='main'&&a.target==='self'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='lockWhileSourceFaceUp'&&!(type==='monster'&&a.when==='summon'&&a.target==='enemyMonster'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='negateAndLockAttacker'&&!(type==='trap'&&a.when==='attack'&&a.target==='attacker'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='lpRelativeEquip'&&!(type==='spell'&&spellKind==='equip'&&a.when==='continuous'&&a.target==='ownMonster'&&a.amount===0&&!a.before&&!a.then))return false;
 if(['fusionMaterialSubstitute','directEarthWaterFire'].includes(a.operation)&&!(type==='monster'&&a.when==='continuous'&&a.target==='self'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='setAttackerDefense'&&!(type==='trap'&&a.when==='attack'&&a.target==='attacker'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='lockPositionNextTurn'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='opponent'&&a.amount===0&&!a.before&&!a.then))return false;
 if(a.operation==='earthAura'){
  if(!(type==='spell'&&spellKind==='field'&&a.when==='continuous'&&a.target==='bothMonsters'&&!a.before&&!a.then&&
       Object.keys(a).every(k=>['when','operation','target','amount','attribute','defDecrease'].includes(k))))return false;
  if(a.attribute!==undefined&&(!['闇','光','地','水','炎','風','神'].includes(a.attribute)||typeof a.attribute!=='string'))return false;
  if(a.defDecrease!==undefined&&(!Number.isInteger(a.defDecrease)||a.defDecrease<0||a.defDecrease>2000))return false;
 }
 if(a.operation==='pierce'&&!(type==='spell'&&spellKind==='equip'&&a.when==='continuous'&&a.target==='ownMonster'))return false;
 if(a.operation==='replaceHands'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='none'))return false;
 if(a.operation==='swapPrintedStats'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='bothMonsters'))return false;
 if(a.operation==='recoverNormalAtk'&&!(type==='trap'&&a.when==='response'&&a.target==='self'))return false;
 if(a.operation==='negateEndBattle'&&!(type==='trap'&&a.when==='attack'&&a.target==='none'))return false;
 if(a.operation==='concealDefender'&&!(type==='trap'&&a.when==='attack'&&a.target==='none'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='redirectAttack'&&!(type==='trap'&&a.when==='attack'&&a.target==='none'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='blastAttacker'&&!(type==='trap'&&a.when==='attack'&&a.target==='attacker'))return false;
 if(a.then!==undefined){
  if(a.when==='continuous'||['summonNamedFromHand','negateAttack','negateEndBattle','blastAttacker','negateEffect','replaceHands','swapPrintedStats','recoverNormalAtk'].includes(a.operation)||
     !a.then||typeof a.then!=='object'||Array.isArray(a.then)||
     Object.keys(a.then).some(k=>!['amount','operation','target','filter','scale','defAmount'].includes(k))||
     (a.then.scale!==undefined&&(!validAmountScale(a.then,a.when,previousScaleContext(a))||!(type==='monster'||type==='spell'&&['normal','quick'].includes(spellKind))))||
     !validStatDelta(a.then)||
     (a.then.filter!==undefined&&!validOperationFilter(a.then,a.when)))return false;
  const next=ABILITY_META[a.then.operation];
  if(!next||!Number.isSafeInteger(a.then.amount)||
    (next.min===undefined?a.then.amount!==0:a.then.amount<next.min||a.then.amount>next.max)||
    !followUpTargets(a.then.operation,a.target,a.when,type,spellKind).includes(a.then.target))return false;
 }
 if(a.before!==undefined){
  const cost=BEFORE_META[a.before?.operation];
  if(!cost||!Number.isSafeInteger(a.before.amount)||a.before.amount<1||a.before.amount>cost.max)return false;
  if(a.before.filter!==undefined){
   // Bounded costs with an independent first-stage effect.
   if(Object.keys(a.before).sort().join(',')!=='amount,filter,operation'||!['banishOwnGrave','recycleOwnGrave','discardOwnHand','returnOwnHandDeck','sendOwnMonsterGrave','banishOwnMonster','returnOwnMonsterHand','returnOwnMonsterDeck','sendOwnBackrowGrave','banishOwnBackrow'].includes(a.before.operation)||a.when!=='main'||!['draw','heal','damage'].includes(a.operation)||!(type==='monster'||type==='spell'&&['normal','quick'].includes(spellKind))||!(cost.zone==='backrow'?validDeckFilter(a.before.filter)&&['spell','trap'].includes(a.before.filter.cardType)&&Object.keys(a.before.filter).every(k=>['cardType','spellKind','nameContains'].includes(k))&&a.before.filter.spellKind!=='field':cost.zone==='monsters'?validDeckFilter(a.before.filter)&&!['set'].includes(a.before.filter.fieldPosition)&&(!a.before.filter.cardType||a.before.filter.cardType==='monster')&&['maxCount','order','summonPosition','deckPlacement'].every(k=>a.before.filter[k]===undefined):validOperationFilter({operation:a.before.operation==='banishOwnGrave'?'graveBanish':a.before.operation==='recycleOwnGrave'?'graveRecycle':'discardNewest',target:'self',filter:a.before.filter})))return false;
  }
  if(!['main','attack','response'].includes(a.when)||type==='spell'&&spellKind!=='normal'&&spellKind!=='quick')return false;
 }
 // Graveyard choice is deliberately a normal-spell-only feature; avoid invalid trap/continuous triggers.
 if(a.operation==='reviveSelected'&&!(type==='spell'&&spellKind==='normal'&&a.when==='main'&&a.target==='eitherGraveMonster'))return false;
 if(a.operation==='reflectAttack'&&!(type==='trap'&&a.when==='attack'&&a.target==='none'&&!a.before&&!a.then))return false;
 if(a.operation==='negateAttack'&&a.when!=='attack')return false;
 if(a.operation==='negateEndBattle'&&a.when!=='attack')return false;
 if(a.operation==='redirectAttack'&&a.when!=='attack')return false;
 if(a.operation==='redirectToAttackerAlly'&&a.when!=='attack')return false;
 if(a.operation==='concealDefender'&&a.when!=='attack')return false;
 if(a.operation==='negateEffect'&&a.when!=='response')return false;
 if(a.operation==='redirectSpellTarget'&&!(type==='trap'&&a.when==='response'&&a.target==='none'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(a.operation==='protectOwnTraps'&&!(type==='trap'&&a.when==='response'&&a.target==='none'&&a.amount===0&&!a.before&&!a.then&&Object.keys(a).length===4))return false;
 if(!abilityTargets(a.operation,a.when,type,spellKind).includes(a.target)){
  // Support old field-spell definitions that used ownMonster to mean own field.
  if(!(a.when==='continuous'&&type==='spell'&&spellKind==='field'&&a.target==='ownMonster'))return false;
 }
 return true;
}
// Shared display vocabulary for first-stage, coin outcome and follow-up filters.
export function monsterFilterText(f,operation){
 if(!f)return '';
 const terms=[];
 if(f.cardType)terms.push({monster:'モンスター',spell:'魔法',trap:'罠'}[f.cardType]);
 if(f.deckPlacement)terms.push(f.deckPlacement==='top'?'デッキの上に戻す':'デッキの下に戻す');
 if(f.fieldPosition&&MOVE_COUNT_BACKROW.includes(operation))terms.push(f.fieldPosition==='set'?'セットカード':'表側表示');
 else if(f.fieldPosition)terms.push(({atk:'表側攻撃表示',def:'表側守備表示',faceup:'表側表示',set:'裏側守備表示'})[f.fieldPosition]);
 if(f.summonPosition)terms.push(f.summonPosition==='def'?'表側守備表示で特殊召喚':'表側攻撃表示で特殊召喚');
 if(f.summonKind)terms.push(({normal:'通常召喚可能',ritual:'儀式',fusion:'融合'})[f.summonKind]+'モンスター');
 if(f.spellKind)terms.push(({normal:'通常',quick:'速攻',continuous:'永続',equip:'装備',field:'フィールド',ritual:'儀式',fusion:'融合'})[f.spellKind]+'魔法');
 if(f.subtype)terms.push(f.subtype==='normal'?'通常モンスター':'効果モンスター');
 for(const [key,title,suffix] of [['atkMin','ATK','以上'],['atkMax','ATK','以下'],['defMin','DEF','以上'],['defMax','DEF','以下'],['levelMin','Lv','以上'],['levelMax','Lv','以下']])
  if(f[key]!==undefined)terms.push(`${title}${f[key]}${suffix}`);
 if(f.attribute)terms.push(`${f.attribute}属性`);
 if(f.race)terms.push(`${f.race}族`);
 if(f.nameContains)terms.push(`名前に「${f.nameContains}」を含む`);
 if(f.maxCount!==undefined)terms.push(`最大${f.maxCount}${MOVE_COUNT_BACKROW.includes(operation)?'枚':'体'}`);
 if(f.order)terms.push({left:'左端優先',atkLow:'元々のATKが低い順',atkHigh:'元々のATKが高い順',defLow:'元々のDEFが低い順',defHigh:'元々のDEFが高い順'}[f.order]);
 return terms.length?`（条件：${terms.join('・')}）`:'';
}
function filteredOperationLabel(a){if(a.filter&&FIELD_FILTER_OPERATIONS.includes(a.operation))return a.filter.fieldPosition==='set'?`裏側守備表示に適用（公開情報のみ）・${ABILITY_META[a.operation].label}`:`条件に合う表側モンスターに適用（元々のATK/DEF・レベル）・${ABILITY_META[a.operation].label}`;return a.filter?({discardNewest:'手札から条件に合うカードを捨てる（末尾優先）',mill:'デッキから条件に合うカードを墓地へ送る',banishDeck:'デッキから条件に合うカードを除外',graveRecover:'墓地から条件に合うカードを回収',graveBanish:'墓地から条件に合うカードを除外',graveRecycle:'墓地から条件に合うカードをデッキへ戻す',banishedRecover:'除外から条件に合うカードを回収'}[a.operation]||ABILITY_META[a.operation].label):ABILITY_META[a.operation].label;}
function requirementText(r){
 if(!r)return '';
 const comparison={atLeast:'以上',atMost:'以下',equal:'ちょうど'}[r.comparison];
 if(r.zone.endsWith('LP'))return `${{ownLP:'自分のLP',enemyLP:'相手のLP',relativeLP:'自分のLP－相手のLP'}[r.zone]}が${r.count}LP${comparison}`;
 if(/^(own|enemy|both)Backrow$/.test(r.zone))return `${{own:'自分',enemy:'相手',both:'双方'}[r.zone.match(/^(own|enemy|both)/)[0]]}の魔法・罠ゾーン（${{all:'全カード',faceup:'表側',set:'裏側',spell:'表側魔法',trap:'表側罠'}[r.kind]}）が${r.count}枚${comparison}`;
 if(/^(own|enemy|both)(Hand|Deck)$/.test(r.zone))return `${{own:'自分',enemy:'相手',both:'双方'}[r.zone.match(/^(own|enemy|both)/)[0]]}の${r.zone.endsWith('Hand')?'手札':'デッキ残数'}が${r.count}枚${comparison}`;
 return `${{ownField:'自分の場',enemyField:'相手の場',bothField:'双方の場',ownGrave:'自分の墓地',enemyGrave:'相手の墓地',bothGrave:'双方の墓地',ownBanished:'自分の除外',enemyBanished:'相手の除外',bothBanished:'双方の除外'}[r.zone]}の${{all:r.zone.endsWith('Field')?'全モンスター':'全カード',atk:'表側攻撃表示',def:'表側守備表示',set:'裏側守備表示',faceup:'表側モンスター',monster:'モンスター',spell:'魔法',trap:'罠'}[r.kind]}${monsterFilterText(r.filter)}が${r.count}${r.zone.endsWith('Field')?'体':'枚'}${{atLeast:'以上',atMost:'以下',equal:'ちょうど'}[r.comparison]}`;
}
function combinedRequirementText(a){return requirementText(a.requirement)+(a.requirement2?(a.requirementMode==='or'?' または ':' かつ ')+requirementText(a.requirement2):'');}
function amountText(a){
 if(a.operation==='changeStats'){if(a.scale)return `ATK：${amountText({...a,operation:'boost'})} / DEF：${amountText({...a,operation:'boost',amount:a.defAmount})}（各±10000以内）`;return `ATK ${a.amount>=0?'+':''}${a.amount} / DEF ${a.defAmount>=0?'+':''}${a.defAmount}`;}
 if(!a.scale)return String(a.amount);
 if(['previousDestroyedAtk','previousDestroyedDef'].includes(a.scale.zone))return `直前に破壊した表側・非トークンモンスターのカード記載${a.scale.zone==='previousDestroyedAtk'?'ATK':'DEF'}合計×${a.amount}%（上限${ABILITY_META[a.operation].max}）`;
 if(a.scale.zone==='previousDestroyedLevel')return `直前に破壊した表側・非トークンモンスターのレベル合計×${a.amount}（上限${ABILITY_META[a.operation].max}）`;
 if(['previousMovedAtk','previousMovedDef','previousMovedLevel'].includes(a.scale.zone)){const stat=a.scale.zone.slice(13);return `直前に移動した表側・非トークンモンスターのカード記載${stat==='Level'?'レベル':stat.toUpperCase()}合計×${a.amount}${stat==='Level'?'':'%'}（上限${ABILITY_META[a.operation].max}）`;}
 if(a.scale.zone==='previousMoved')return `直前の効果で実際に処理したカード数×${a.amount}（上限${ABILITY_META[a.operation].max}）`;
 const source=requirementText({...a.scale,comparison:'equal',count:0}).replace(/が0[枚体]ちょうど$/,'');
 return `${source}の数×${a.amount}（解決時・上限${ABILITY_META[a.operation].max}）`;
}
export function abilityText(a){if(!a)return '';
 const meta=ABILITY_META[a.operation];if(!meta)return '';
 const usesAmount=meta.min!==undefined;
 const label=filteredOperationLabel(a);
 if(a.operation==='reviveSelected'&&!a.then)return (a.before?`コスト：${beforeText(a.before)}。\n`:'')+'自分・相手の墓地のモンスター1体を選び、自分フィールドに攻撃表示で特殊召喚する。';
 if(a.operation==='negateWeakenAttacker')return `${TRIGGERS[a.when]}：攻撃を無効にし、この罠が表側で残る間、攻撃モンスターのATKを${a.amount}下げ、攻撃を禁止する。`;
 if(a.operation==='earthAura')return `${a.attribute||'地'}属性の表側モンスターのATKを${a.amount}上げ、DEFを${a.defDecrease??400}下げる（フィールド魔法）。`;
 if(a.operation==='removeSpellBackrow')return '自分メイン：相手の表側魔法またはセットされた魔法・罠1枚を選ぶ。魔法なら破壊、裏側の罠なら確認するだけ。';
 if(a.operation==='banishSetBackrow')return '自分メイン：相手のセットされた魔法・罠1枚を対象として除外する。同名カードのデッキ除外は省略。';
 if(a.operation==='destroyThenSetBackrow')return '相手の効果にチェーン：相手の魔法・罠1枚を破壊。その後、自分の手札から魔法・罠1枚を自動選択してセット（フィールド魔法は対象外）。';
 if(a.operation==='diceStats')return `${TRIGGERS[a.when]}：対象側に表側モンスターが存在するとき、擬似サイコロ1～6の出目×100だけ、${a.target==='ownAllMonsters'?'自分の':'相手の'}表側モンスターのATK/DEFをターン終了まで${a.target==='ownAllMonsters'?'上げる':'下げる'}。`;
 if(a.operation==='extraNormalSummon')return '表側表示の永続罠：自分のメインフェイズに追加で通常召喚・セットする時、その都度500LPを払う（相手バトルフェイズ中は不可）。';
 if(a.operation==='preventEquipAttack')return `${TRIGGERS[a.when]}：装備している相手モンスターの攻撃を禁止。`;
 if(a.operation==='tributeOtherToAttack')return `${TRIGGERS[a.when]}：攻撃するには、自分のほかのモンスター1体をリリースする。`;
 if(a.operation==='timeWizardCoin')return `${TRIGGERS[a.when]}：擬似コイントスが成功なら相手、失敗なら自分の全モンスターを破壊。失敗時はLPダメージ。`;
 if(['coinBranch','conditionBranch'].includes(a.operation)){const leaf=stage=>`${TARGETS[stage.target]}：${filteredOperationLabel(stage)}${ABILITY_META[stage.operation].min!==undefined?`（${amountText(stage)}）`:''}${monsterFilterText(stage.filter,stage.operation)}`;const fmt=stage=>leaf(stage)+(stage.then?'。成功した場合、'+leaf(stage.then):'');return a.operation==='conditionBranch'?`自分メイン：効果解決時、${combinedRequirementText(a)}なら成立。\n成立：${fmt(a.heads)}。\n不成立：${fmt(a.tails)}。`:`自分メイン：擬似コイントスで分岐。\n表：${fmt(a.heads)}。\n裏：${fmt(a.tails)}。`;}
 if(a.operation==='selfSpecialFromHand')return `${TRIGGERS[a.when]}：手札からこのモンスターを特殊召喚（空きゾーン必須）。`;
 if(a.operation==='selfSpecialFromHandGiveRevive')return `${TRIGGERS[a.when]}：手札から自身を特殊召喚し、相手墓地の通常召喚可能なモンスター1体を自動蘇生（選択と辞退を省略）。`;
 if(a.operation==='lockWhileSourceFaceUp')return `${TRIGGERS[a.when]}：相手のモンスター1体を、このカードが表側でいる間攻撃禁止にする（左端自動選択）。`;
 if(a.operation==='negateAndLockAttacker')return `${TRIGGERS[a.when]}：攻撃を無効にし、この罠が表側で残る間、攻撃モンスターの攻撃を禁止する。`;
 if(a.operation==='lpRelativeEquip')return `${TRIGGERS[a.when]}：自分のLPが相手より少なければ装備モンスターの元々のATKを2倍、多ければ半分にする。`;
 if(a.operation==='fusionMaterialSubstitute')return `${TRIGGERS[a.when]}：2体素材の融合召喚で、融合素材1体の代わりに使用できる。`;
 if(a.operation==='directEarthWaterFire')return `${TRIGGERS[a.when]}：相手の表側表示モンスターが地・水・炎属性だけの場合、直接攻撃できる。`;
 if(a.operation==='borrowOpponentSpell')return `${TRIGGERS[a.when]}：相手の墓地の新しい魔法カード1枚を自分の手札へ加える（2000ダメージ・期限切れ返却は省略）。`;
 if(a.operation==='redirectSpellTarget')return `${TRIGGERS[a.when]}：相手の魔法が対象にしたモンスター1体を、同じ側の別の適切なモンスターへ変更する（左端優先）。`;
 if(a.operation==='protectOwnTraps')return `${TRIGGERS[a.when]}：自分の罠を破壊する直前の相手の効果を無効化する（身代わり処理は簡略化）。`;
 if(a.operation==='concealDefender')return `${TRIGGERS[a.when]}：攻撃対象の表側の自分モンスターを裏側守備表示にし、その攻撃を無効にする（デッキから魔法・罠を置く処理は行わない）。`;
 if(a.operation==='destroyOnEnemySummon')return `相手が攻撃力${a.amount}以上のモンスターを通常召喚・反転召喚したとき、セット済みの罠を自動発動してそのモンスターを破壊する（チェーン・発動選択は省略）。`;
 if(a.operation==='redirectToAttackerAlly')return `${TRIGGERS[a.when]}：相手側の別の表側モンスターを左端から自動選択し、戦闘対象を変更する（コントロール移動は省略）。`;
 if(a.operation==='redirectAttack')return `${TRIGGERS[a.when]}：攻撃対象を他の自分のモンスターへ変更（左端優先）。魔法・罠の効果対象変更は行わない。`;
 if(a.operation==='setAttackerDefense')return `${TRIGGERS[a.when]}：攻撃モンスターを守備表示にしその攻撃を中断する（装備・攻撃力上昇は省略）。`;
 if(a.operation==='destroyGiveOwn')return `${TRIGGERS[a.when]}：相手モンスター1体を破壊し自分の左端1体を相手に渡す。`;
 if(a.operation==='lockPositionNextTurn')return `${TRIGGERS[a.when]}：次の相手ターンに相手の手動表示形式変更と反転召喚を禁止する。`;
 if(a.operation==='summonSheepTokens')return `自分の空きモンスターゾーンに羊トークン${a.amount}体を守備表示で特殊召喚（${a.amount}枠必要。アドバンス召喚にはリリース不可。発動ターンの他の召喚制限は省略）。`;
 if(a.operation==='summonKuribohTokens')return '発動時に自分の表側「クリボー」1体をリリースし、空きゾーンにクリボートークンを可能な限り守備表示で特殊召喚（最大5体・リリース不可）。';
 if(a.operation==='reviveBothSet')return `${TRIGGERS[a.when]}：お互いの墓地のモンスターを新しい順に1体ずつ裏側守備で特殊召喚する。`;
 if(a.operation==='summonRaceFromHand')return `${TRIGGERS[a.when]}：${a.requiredFaceUpName?`「${a.requiredFaceUpName}」が表側で存在する場合、`:''}手札の${a.query}族モンスターを最大${a.amount}体特殊召喚する（先頭側から自動選択）。`;
 if(a.operation==='crushVirus')return 'セットした次のターン以降の自分メインまたは相手の効果にチェーン：闇属性・ATK1000以下の表側モンスター1体を墓地へ送り、相手の場と手札のATK1500以上を破壊（継続効果なし）。';
 if(a.operation==='revealSetMonsters')return 'セットした次のターン以降の自分メインまたは相手の効果にチェーン：お互いの裏側守備モンスターを表側守備にする（永続セット制限なし）。';
 if(a.operation==='millFirstType')return `${TRIGGERS[a.when]}：相手のデッキから${{monster:'モンスター',spell:'魔法',trap:'罠'}[a.match]||'指定種類'}カード1枚を墓地へ送る（デッキの先頭側から自動選択）。`;
 const filterText=monsterFilterText(a.filter,a.operation);
 const detail=a.operation==='millFirstType'
  ?`相手デッキの最初の${{monster:'モンスター',spell:'魔法',trap:'罠'}[a.match]||'指定種類'}カード1枚を墓地へ送る（自動選択）`
  :a.operation==='summonNamedFromHand'
  ?`自分の手札から「${a.query||''}」という名前のモンスター1体を特殊召喚する（最初の候補を自動選択。ゾーン満杯や候補なしの場合は不発）`
  :['searchMonster','summonMonsterDeck'].includes(a.operation)
  ?`${a.operation==='searchMonster'?'デッキから手札へ':'デッキから自分の場へ特殊召喚'}${filterText}（${a.amount}体・候補は先頭から自動選択）`
  :a.operation==='searchNamed'
  ?`自分のデッキから${a.match==='contains'?'名前に':'名前が'}「${a.query||''}」${a.match==='contains'?'を含む':'に一致する'}カードを${a.amount}枚手札に加える（デッキ先頭順・自動選択）`
  :usesAmount?(/LP|ダメージ|攻撃力|守備力/.test(label)?`${label}（${amountText(a)}）`:`${label}（${a.amount}枚）`):label;
 const result=`${TRIGGERS[a.when]||'効果'}：${TARGETS[a.target]||''} に ${detail}${!['searchMonster','summonMonsterDeck'].includes(a.operation)?filterText:''}。`;
 const then=a.then;
 const follow=then?`${TARGETS[then.target]}に${filteredOperationLabel(then)}${ABILITY_META[then.operation].min===undefined?'':`（${amountText(then)}）`}${monsterFilterText(then.filter,then.operation)}する。`:'';
 const requirement=a.requirement?`発動条件：${combinedRequirementText(a)}。\n`:'';
 return `${requirement}${a.before?`発動コスト：${beforeText(a.before)}。\n`:''}${result}${then?`\nこの効果が処理された場合、${follow}`:''}`;
}
export function normalizeRuleSettings(input){const lp=Number(input?.lp),deckSize=Number(input?.deckSize),costLimit=Number(input?.costLimit);return {lp:Number.isInteger(lp)&&lp>=1000&&lp<=20000&&lp%500===0?lp:8000,deckSize:Number.isInteger(deckSize)&&deckSize>=20&&deckSize<=60?deckSize:40,costLimit:Number.isInteger(costLimit)&&costLimit>=20&&costLimit<=300?costLimit:0};}
export function cardLimit(c){return LIMITS[c?.limit]?.max??3;}
export function readRuleSettings(storage){try{return normalizeRuleSettings(JSON.parse(storage.getItem('duel-rules-v5')||'{}'));}catch{return {...RULE_DEFAULT};}}
export function writeRuleSettings(storage,value){const r=normalizeRuleSettings(value);storage.setItem('duel-rules-v5',JSON.stringify(r));return r;}
