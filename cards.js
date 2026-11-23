import {LIMITS,cardLimit,deckCost,isValidAbility,abilityText} from './rules.js?v=2047';
import {HISTORICAL_CARDS,HISTORICAL_PRESETS,ATTRIBUTE_NAMES,RACE_NAMES} from './historical-data.js?v=2047';
export {HISTORICAL_PRESETS,ATTRIBUTE_NAMES,RACE_NAMES} from './historical-data.js?v=2047';
// オリジナルカード。データを追加すればカードプールを拡張できます。
export const CARDS = [
  {id:'m01',name:'紅蓮の剣士',type:'monster',level:4,atk:1800,def:1100,emoji:'⚔️',desc:'炎の剣で戦う勇敢な戦士。'},
  {id:'m02',name:'火山の番兵',type:'monster',level:4,atk:1600,def:1700,emoji:'🌋',desc:'熱い岩肌で敵の攻撃を防ぐ。'},
  {id:'m03',name:'焔の小竜',type:'monster',level:3,atk:1500,def:900,emoji:'🐉',desc:'小さくても強い炎の竜。'},
  {id:'m04',name:'陽炎の魔術師',type:'monster',level:4,atk:1700,def:1200,emoji:'🔥',desc:'幻影を操る炎の術師。'},
  {id:'m05',name:'赤銅の騎士',type:'monster',level:4,atk:1400,def:2000,emoji:'🛡️',desc:'鋼の盾で味方を守る。'},
  {id:'m06',name:'燃える狼',type:'monster',level:3,atk:1300,def:1000,emoji:'🐺',desc:'炎をまとう俊敏な狼。'},
  {id:'m07',name:'蒼海の騎士',type:'monster',level:4,atk:1750,def:1300,emoji:'🔱',desc:'青い海を守る剣士。'},
  {id:'m08',name:'深海の守護者',type:'monster',level:4,atk:1400,def:2100,emoji:'🐢',desc:'頑丈な甲羅を持つ守護者。'},
  {id:'m09',name:'しずくの精霊',type:'monster',level:3,atk:1200,def:1600,emoji:'💧',desc:'水流を自在に操る精霊。'},
  {id:'m10',name:'氷晶の剣士',type:'monster',level:4,atk:1900,def:800,emoji:'❄️',desc:'氷の刃で敵を切り裂く。'},
  {id:'m11',name:'真珠の魔導士',type:'monster',level:4,atk:1650,def:1600,emoji:'🪄',desc:'神秘的な真珠から力を得る。'},
  {id:'m12',name:'潮騒の海獣',type:'monster',level:3,atk:1500,def:1100,emoji:'🐬',desc:'大波と共に現れる海獣。'},
  {id:'m13',name:'灼熱の巨人',type:'monster',level:6,atk:2400,def:1800,emoji:'🗿',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m14',name:'炎翼の獅子',type:'monster',level:5,atk:2200,def:1600,emoji:'🦁',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m15',name:'深淵のクジラ',type:'monster',level:6,atk:2450,def:1900,emoji:'🐋',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m16',name:'白波の巨兵',type:'monster',level:5,atk:2100,def:2300,emoji:'🌊',desc:'召喚にはモンスター1体のリリースが必要。'},
  {id:'m17',name:'紅蓮王ドラゴン',type:'monster',level:8,atk:3000,def:2500,emoji:'🐲',desc:'召喚にはモンスター2体のリリースが必要。'},
  {id:'m18',name:'蒼天の海竜',type:'monster',level:8,atk:2900,def:2600,emoji:'🐉',desc:'召喚にはモンスター2体のリリースが必要。'},
  {id:'m19',name:'鉄のゴーレム',type:'monster',level:4,atk:1000,def:2200,emoji:'🤖',desc:'守備力に優れた鉄の巨人。'},
  {id:'m20',name:'風読みのフクロウ',type:'monster',level:2,atk:900,def:1400,emoji:'🦉',desc:'風の変化を読み取る。'},
  {id:'m21',name:'星霜の魔導士',type:'monster',subtype:'effect',level:4,atk:1400,def:1200,emoji:'🌠',monsterEffect:{kind:'trigger',code:'draw1'},desc:'召喚に成功した時、カードを1枚ドローする。'},
  {id:'m22',name:'熾火の使者',type:'monster',subtype:'effect',level:3,atk:1200,def:1000,emoji:'🔥',monsterEffect:{kind:'ignition',code:'burn500'},desc:'1ターンに1度、自分のメインフェイズに相手に500ダメージ。'},
  {id:'m23',name:'金剛の守護獣',type:'monster',subtype:'effect',level:4,atk:1500,def:1800,emoji:'🦁',monsterEffect:{kind:'continuous',code:'atk500'},desc:'このカードの攻撃力は500アップする。'},
  {id:'m24',name:'蒼雷の賢者',type:'monster',subtype:'effect',level:4,atk:1600,def:1400,emoji:'⚡',monsterEffect:{kind:'ignition',code:'destroy1'},desc:'1ターンに1度、相手のモンスター1体を破壊できる。'},
  {id:'s01',name:'知恵の巻物',type:'spell',emoji:'📜',effect:'draw2',desc:'カードを2枚ドローする。'},
  {id:'s02',name:'回復の泉',type:'spell',emoji:'💚',effect:'heal1000',desc:'自分のLPを1000回復する。'},
  {id:'s03',name:'雷の一撃',type:'spell',emoji:'⚡',effect:'destroy',desc:'相手のモンスター1体を破壊する。'},
  {id:'s04',name:'勇気の紋章',type:'spell',emoji:'💪',effect:'boost500',desc:'自分の表側モンスター1体の攻撃力を、このターンだけ500上げる。'},
  {id:'s05',name:'火球の呪文',type:'spell',emoji:'☄️',effect:'burn800',desc:'相手に800ダメージを与える。'},
  {id:'s06',name:'閃光の障壁',type:'spell',spellKind:'quick',emoji:'✨',ability:{when:'main',operation:'heal',target:'self',amount:500},desc:'自分のターンは手札から、セット後は次のターン以降にも使える。LP500回復。'},
  {id:'s07',name:'守護の紋章',type:'spell',spellKind:'continuous',emoji:'🪬',ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:300},desc:'指定した自分モンスター1体の攻撃力を300アップ。'},
  {id:'s08',name:'雷刃の剣',type:'spell',spellKind:'equip',emoji:'⚔️',ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:500},desc:'装備モンスターの攻撃力を500アップ。'},
  {id:'s09',name:'星界の祭壇',type:'spell',spellKind:'field',emoji:'🌌',ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:300},desc:'自分フィールドの表側モンスターの攻撃力を300アップ。'},
  {id:'m25',name:'星冠の儀式竜',type:'monster',summonKind:'ritual',subtype:'normal',level:7,atk:2700,def:2100,emoji:'✨',rarity:'SR',desc:'儀式魔法とレベル合計7以上のリリースで手札から呼び出す。'},
  {id:'m26',name:'炎海の双竜',type:'monster',summonKind:'fusion',subtype:'normal',fusionMaterials:['m03','m12'],level:8,atk:2900,def:2400,emoji:'🐲',rarity:'UR',desc:'「焔の小竜」＋「潮騒の海獣」'},
  {id:'s10',name:'星冠の儀式',type:'spell',spellKind:'ritual',effect:'ritualSummon',ritualFor:'m25',emoji:'🌟',rarity:'R',desc:'「星冠の儀式竜」を儀式召喚する。'},
  {id:'s11',name:'双竜の融合',type:'spell',spellKind:'fusion',effect:'fusionSummon',emoji:'🌀',rarity:'R',desc:'手札・フィールドの指定素材2体で融合召喚する。'},
  {id:'t01',name:'緊急防御',type:'trap',emoji:'🛡️',effect:'negate',desc:'相手の攻撃時に任意発動。その攻撃を無効にする。'},
  {id:'t02',name:'逆襲の落とし穴',type:'trap',emoji:'🕳️',effect:'counterdestroy',desc:'相手の攻撃時に任意発動。攻撃したモンスターを破壊する。'},
  {id:'t03',name:'反撃の炎',type:'trap',emoji:'💥',effect:'counterburn',desc:'相手の攻撃時に任意発動。攻撃を無効にし、相手に700ダメージ。'},
];
// Race and attribute metadata are used by native historical combat effects.
const ORIGINAL_ATTRIBUTES=['炎','炎','炎','炎','地','炎','水','水','水','水','水','水','炎','炎','水','水','炎','水','地','風','光','炎','地','光','光','炎'];
const ORIGINAL_RACES=['戦士','岩石','ドラゴン','魔法使い','戦士','獣','戦士','水','水','戦士','魔法使い','獣','岩石','獣','魚','戦士','ドラゴン','ドラゴン','岩石','鳥獣','魔法使い','炎','獣','魔法使い','ドラゴン','ドラゴン'];
for(let i=0;i<26;i++){const c=CARDS.find(x=>x.id===`m${String(i+1).padStart(2,'0')}`);if(c){c.attribute=ORIGINAL_ATTRIBUTES[i];c.race=ORIGINAL_RACES[i];}}
CARDS.push(...HISTORICAL_CARDS);
export const SPELL_KINDS={normal:'通常魔法',quick:'速攻魔法',continuous:'永続魔法',equip:'装備魔法',field:'フィールド魔法',ritual:'儀式魔法',fusion:'融合魔法'};
export const SUMMON_KINDS={normal:'通常',ritual:'儀式',fusion:'融合'};
export const summonKind=c=>c?.type==='monster'&&['ritual','fusion'].includes(c.summonKind)?c.summonKind:'normal';
export const spellKind=c=>c?.type==='spell'&&Object.hasOwn(SPELL_KINDS,c.spellKind)?c.spellKind:'normal';
export const persistentSpell=c=>['continuous','equip','field'].includes(spellKind(c));
export const RARITIES={N:'ノーマル',R:'レア',SR:'スーパーレア',UR:'ウルトラレア',SEC:'シークレット'};
const DEFAULT_RARITY={
  m17:'SEC',m18:'SEC',m21:'UR',m24:'UR',m13:'SR',m15:'SR',
  m23:'SR',m10:'SR',s01:'SR',s03:'SR',t02:'SR',
  m14:'R',m16:'R',m22:'R',s02:'R',s04:'R',t03:'R',m08:'R',m19:'R'
};
for(const c of CARDS)c.rarity=DEFAULT_RARITY[c.id]||c.rarity||'N';
export const SHEEP_TOKEN_ID='token_sheep';
const SHEEP_TOKEN={id:SHEEP_TOKEN_ID,name:'羊トークン',type:'monster',subtype:'normal',summonKind:'normal',isToken:true,attribute:'地',race:'獣',level:1,atk:0,def:0,emoji:'🐑',rarity:'N',desc:'守備表示で特殊召喚されるトークン。場を離れると消滅し、アドバンス召喚のリリースには使えない。'};
export const KURIBOH_TOKEN_ID='token_kuriboh';
const KURIBOH_TOKEN={id:KURIBOH_TOKEN_ID,name:'クリボートークン',type:'monster',subtype:'normal',summonKind:'normal',isToken:true,attribute:'闇',race:'悪魔',level:1,atk:300,def:200,emoji:'🟤',rarity:'N',desc:'増殖で守備表示で出現するトークン。場を離れると消滅し、アドバンス召喚にリリースできない。'};
export const CARD = {...Object.fromEntries(CARDS.map(c => [c.id,c])),[SHEEP_TOKEN_ID]:SHEEP_TOKEN,[KURIBOH_TOKEN_ID]:KURIBOH_TOKEN};
const ORIGINAL_CARDS = CARDS.map(c=>({...c}));
export const MONSTER_EFFECTS = {
  continuous: {
    atk300:'自分の攻撃力＋300（永続）',atk500:'自分の攻撃力＋500（永続）',
    darkMagicianGrave300:'お互いの墓地の「ブラック・マジシャン」「マジシャン・オブ・ブラックカオス」1枚につき攻撃力＋300',
    enemyDragon500:'相手の表側表示フィールド・墓地のドラゴン族モンスター1体につき攻撃力＋500',
    darkBattle500:'闇属性モンスターとのダメージ計算中のみ攻撃力＋500',
    countStatScale:'公開ゾーンの条件に合うモンスターの数で攻守を強化',
    graveNamedScale:'指定名のカードが墓地にある数だけATKアップ（カスタム）',
    raceFieldGraveScale:'指定種族がフィールド・墓地にある数だけATKアップ（カスタム）',
    battleAttributeScale:'指定属性との戦闘時だけATKアップ（カスタム）',
    battleImmuneAtkThreshold:'指定ATK以上のモンスターとの戦闘では破壊されない（カスタム）',
    attributeFieldAura:'場の指定属性にATK増加・別属性にATK減少（カスタム）',
    raceAuraGuard:'自分の指定種族ATK上昇＋仲間がいる間は自身への攻撃不可（カスタム）',
    postAttackDefenseLock:'攻撃後：バトル終了時に守備表示＋次の自分ターン終了まで表示形式変更不可',
    multiAttack:'1回のバトルフェイズで指定回数まで攻撃できる（カスタム）',
    destroyAttachedEquip:'このカードに装備された装備カードを破壊（チェーン応答は簡略化）',
    trapSuppression:'表側表示の間、お互いの罠カードの発動・効果を無効化（簡易）',
    dragonTargetGuard:'表側表示の間、相手はドラゴン族を効果の対象にできない',
    rocketAssault:'自分のバトルフェイズに攻撃する場合、戦闘破壊と自身の戦闘ダメージを防ぎ、戦闘後に相手ATKを500下げる（簡易）',
  },
  hand: {preventBattleDamage:'手札から捨てて戦闘ダメージを0にする（簡易）',specialByThreeNames:'自分フィールドの指定名3体をリリースして手札から特殊召喚（簡易）'},
  summonRule: {soloHandNoTribute:'手札が自身1枚ならリリースなしで通常召喚できる',doubleLightTribute:'光属性のレベル7以上の召喚時、このカードは2体分のリリースになる'},
  ignition: {fusionFromExtraPay5000:'5000LPを支払い、EXデッキ先頭の融合モンスター1体を特殊召喚（簡易）',doubleOriginalAtkEndDestroy:'自身の元々のATKをエンドフェイズまで2倍にし、そのエンドフェイズに自壊（簡易）',burn500:'相手に500ダメージ',heal500:'自分のLPを500回復',draw1:'1枚ドロー',destroy1:'相手のモンスター1体を破壊',atk500:'自分の攻撃力＋500（ターン終了まで）'},
  trigger: {copyOpponentPrintedStats:'召喚・反転召喚・特殊召喚時：表側モンスターの元々のATK・DEFをコピー（自動選択）',searchDeckOnSummon:'召喚時：デッキから条件に合うカードを手札へ加える',draw1:'召喚成功時に1枚ドロー',heal500:'召喚成功時にLP500回復',burn500:'召喚成功時に相手に500ダメージ',atk500:'召喚成功時に攻撃力＋500（ターン終了まで）'},
  battle: {recruitOnBattleDestroy:'戦闘で破壊され墓地へ送られたとき：指定属性・指定ATK以下のモンスターをデッキから特殊召喚（簡易）'},
  grave: {weakenOpponentOnGrave:'フィールドから墓地へ送られた時、表側モンスター1体のATKを下げる（簡易）',reviveMaterialOnDestroy:'フィールドで破壊された時、指定名のモンスターを墓地から蘇生（簡易）',searchStatOnGrave:'フィールドから墓地へ送られた時：指定ATK/DEF以下のモンスターをデッキから1体手札に加える（自動選択・簡易）'},
  flip: {cyberJarRevealFive:'リバース時：双方のモンスターを破壊し各5枚公開、レベル4以下を特殊召喚（簡易）',morphingJarTwo:'リバース時：双方のモンスターをデッキへ戻して、戻した数だけモンスターを公開しレベル4以下を裏側守備で特殊召喚（簡易）',returnOpponentOnFlip:'リバース時：モンスターを最大2体手札へ戻す（自動選択・簡易）',destroyOpponentOnFlip:'リバース時：モンスター1体を破壊（自動選択・簡易）',recoverOwnSpellOnFlip:'リバース時：墓地の魔法1枚を回収（自動選択・簡易）',millOpponentDeck:'リバース時：相手のデッキ上から指定枚数を墓地へ送る',scoutDrawDiscardSpells:'リバース時：相手が指定枚数ドローし、その中の魔法カードを墓地へ捨てる'},
  position: {destroyOnAttackToDefense:'攻撃表示から守備表示に手動変更したとき：相手のモンスター1体を破壊（自動選択・簡易）'},
  endPhase: {selfReturnHand:'自分エンドフェイズ：表側の自身を持ち主の手札に戻す'},
};
// Configurable passive effects share the same stat/damage routes as historical effects.
// No per-turn caches, timers or synchronization fields are needed.
export const PASSIVE_SCALE_CODES=['countStatScale','graveNamedScale','raceFieldGraveScale','battleAttributeScale','battleImmuneAtkThreshold','attributeFieldAura','raceAuraGuard'];
export const PASSIVE_SCOPES={own:'自分',opponent:'相手',both:'お互い'};
export const COUNT_STAT_ZONES={field:'表側フィールド',grave:'墓地',banished:'除外'};
export const COUNT_MONSTER_KINDS={normal:'通常モンスター',effect:'効果モンスター',ritual:'儀式モンスター',fusion:'融合モンスター',token:'トークン'};
const COUNT_STAT_KEYS=new Set(['kind','code','scope','zones','stat','amount','names','attribute','race','level','monsterKind']);

function validCountStatScale(e){
  const {scope,zones,stat,amount,names,attribute,race,level,monsterKind}=e;
  return e.kind==='continuous'&&Object.keys(e).every(key=>COUNT_STAT_KEYS.has(key))&&
    Object.hasOwn(PASSIVE_SCOPES,scope)&&['atk','def'].includes(stat)&&
    Number.isInteger(amount)&&amount>=50&&amount<=2000&&
    Array.isArray(zones)&&zones.length>0&&zones.length<=3&&new Set(zones).size===zones.length&&
    zones.every(zone=>Object.hasOwn(COUNT_STAT_ZONES,zone))&&
    (names===undefined||Array.isArray(names)&&names.length>=1&&names.length<=3&&new Set(names).size===names.length&&
      names.every(name=>typeof name==='string'&&name.trim()===name&&name.length>=1&&name.length<=32))&&
    (attribute===undefined||ATTRIBUTE_NAMES.includes(normalizeAttribute(attribute)))&&
    (race===undefined||RACE_NAMES.includes(normalizeRace(race)))&&
    (level===undefined||Number.isInteger(level)&&level>=1&&level<=12)&&
    (monsterKind===undefined||Object.hasOwn(COUNT_MONSTER_KINDS,monsterKind))&&
    (monsterKind!=='token'||zones.includes('field'));
}
const PASSIVE_RACES_EN={dragon:'ドラゴン',warrior:'戦士',spellcaster:'魔法使い',machine:'機械',fiend:'悪魔',fairy:'天使',beast:'獣','beast-warrior':'獣戦士','winged-beast':'鳥獣',aqua:'水',insect:'昆虫',rock:'岩石',plant:'植物',zombie:'アンデット',reptile:'爬虫類',pyro:'炎',fish:'魚',thunder:'雷',dinosaur:'恐竜','sea-serpent':'海竜',psychic:'サイキック',wyrm:'幻竜',cyberse:'サイバース',illusion:'幻想魔','divine-beast':'幻神獣'};
export const normalizeRace=r=>PASSIVE_RACES_EN[r]||r;
const PASSIVE_ATTRIBUTES_EN={dark:'闇',light:'光',earth:'地',water:'水',fire:'炎',wind:'風',divine:'神'};
export const normalizeAttribute=a=>PASSIVE_ATTRIBUTES_EN[a]||a;
export function defaultPassiveConfig(code){
  const shared={kind:'continuous',code,amount:500};
  if(code==='preventBattleDamage')return {kind:'hand',code};
  if(code==='specialByThreeNames')return {kind:'hand',code,names:['磁石の戦士α','磁石の戦士β','磁石の戦士γ']};
  if(code==='weakenOpponentOnGrave')return {kind:'grave',code};
  if(code==='reviveMaterialOnDestroy')return {kind:'grave',code,names:['幻獣王ガゼル','バフォメット']};
  if(code==='countStatScale')return {...shared,amount:300,stat:'atk',scope:'both',zones:['grave']};
  if(code==='graveNamedScale')return {...shared,amount:300,names:['ブラック・マジシャン'],scope:'both'};
  if(code==='raceFieldGraveScale')return {...shared,race:'ドラゴン',scope:'opponent'};
  if(code==='battleAttributeScale')return {...shared,attribute:'闇'};
  if(code==='battleImmuneAtkThreshold')return {kind:'continuous',code,threshold:1900};
  if(code==='attributeFieldAura')return {...shared,amount:500,attribute:'地',negativeAttribute:'風',negativeAmount:400,scope:'both'};
  if(code==='raceAuraGuard')return {...shared,amount:400,race:'戦士'};
  if(code==='destroyOpponentOnFlip'||code==='recoverOwnSpellOnFlip')return {kind:'flip',code};
  if(code==='returnOpponentOnFlip')return {kind:'flip',code,amount:2};
  if(code==='searchStatOnGrave')return {kind:'grave',code,stat:'atk',threshold:1500};
  if(code==='destroyOnAttackToDefense')return {kind:'position',code};
  if(code==='millOpponentDeck')return {kind:'flip',code,amount:5};
  if(code==='scoutDrawDiscardSpells')return {kind:'flip',code,amount:3};
  if(code==='cyberJarRevealFive'||code==='morphingJarTwo')return {kind:'flip',code};
  if(code==='searchDeckOnSummon')return {kind:'trigger',code,filter:'ritualMonster'};
  if(code==='copyOpponentPrintedStats')return {kind:'trigger',code};
  if(code==='recruitOnBattleDestroy')return {kind:'battle',code,attribute:'地',threshold:1500};
  if(code==='destroyAttachedEquip'||code==='trapSuppression'||code==='rocketAssault'||code==='dragonTargetGuard')return {kind:'continuous',code};
  if(code==='fusionFromExtraPay5000')return {kind:'ignition',code};
  if(code==='soloHandNoTribute'||code==='doubleLightTribute')return {kind:'summonRule',code};
  if(code==='doubleOriginalAtkEndDestroy')return {kind:'ignition',code};
  if(code==='selfReturnHand')return {kind:'endPhase',code};
  if(code==='postAttackDefenseLock')return {kind:'continuous',code};
  if(code==='multiAttack')return {kind:'continuous',code,count:2};
  return null;
}
export function validMonsterEffect(e){
  if(!e||typeof e!=='object'||!Object.hasOwn(MONSTER_EFFECTS,e.kind)||!Object.hasOwn(MONSTER_EFFECTS[e.kind],e.code))return false;
  if(e.code==='countStatScale')return validCountStatScale(e);
  if(['soloHandNoTribute','doubleLightTribute'].includes(e.code))return e.kind==='summonRule'&&Object.keys(e).length===2;
  if(e.code==='copyOpponentPrintedStats')return e.kind==='trigger'&&
    Object.keys(e).length===(e.scope===undefined?2:3)&&(e.scope===undefined||Object.hasOwn(PASSIVE_SCOPES,e.scope));
  if(e.kind==='battle')return e.code==='recruitOnBattleDestroy'&&Object.keys(e).length===4&&
    ATTRIBUTE_NAMES.includes(normalizeAttribute(e.attribute))&&Number.isInteger(e.threshold)&&e.threshold>=0&&e.threshold<=5000;
  if(e.code==='searchDeckOnSummon')return e.kind==='trigger'&&
    ['ritualMonster','ritualSpell','named'].includes(e.filter)&&
    (e.filter==='named'?typeof e.name==='string'&&e.name.trim()===e.name&&e.name.length>=1&&e.name.length<=32&&
      (e.normalOrFlipOnly===undefined||e.normalOrFlipOnly===true)&&Object.keys(e).length===(e.normalOrFlipOnly===true?5:4):
      e.name===undefined&&e.normalOrFlipOnly===undefined&&Object.keys(e).length===3);
  if(e.kind==='hand')return (e.code==='preventBattleDamage'&&Object.keys(e).length===2)||
   (e.code==='specialByThreeNames'&&Object.keys(e).length===3&&Array.isArray(e.names)&&e.names.length===3&&
    new Set(e.names).size===3&&e.names.every(n=>typeof n==='string'&&n.trim()===n&&n.length>=1&&n.length<=32));
  if(e.kind==='grave'&&e.code==='weakenOpponentOnGrave')return Object.keys(e).length===2||
    Object.keys(e).length===4&&Object.hasOwn(PASSIVE_SCOPES,e.scope)&&Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=2000;
  if(e.kind==='grave'&&e.code==='reviveMaterialOnDestroy')return Object.keys(e).length===(e.position===undefined?3:4)&&
   (e.position===undefined||['atk','def'].includes(e.position))&&Array.isArray(e.names)&&e.names.length===2&&
   new Set(e.names).size===2&&e.names.every(n=>typeof n==='string'&&n.trim()===n&&n.length>=1&&n.length<=32);
  if(e.kind==='grave')return e.code==='searchStatOnGrave'&&
    Object.keys(e).length===(e.restrictActivation===true?5:4)&&
    (e.restrictActivation===undefined||e.restrictActivation===true)&&
    ['atk','def'].includes(e.stat)&&Number.isInteger(e.threshold)&&e.threshold>=0&&e.threshold<=5000;
  if(e.kind==='position')return e.code==='destroyOnAttackToDefense'&&Object.keys(e).length===2;
  if(e.kind==='flip'&&['returnOpponentOnFlip','destroyOpponentOnFlip'].includes(e.code)){
    const bounce=e.code==='returnOpponentOnFlip';
    return (e.scope===undefined||Object.hasOwn(PASSIVE_SCOPES,e.scope))&&
      Object.keys(e).length===(bounce?3:2)+(e.scope===undefined?0:1)&&
      (!bounce||Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=2);
  }
  if(e.kind==='flip')return (['recoverOwnSpellOnFlip','cyberJarRevealFive','morphingJarTwo'].includes(e.code)&&Object.keys(e).length===2)|| (e.code==='millOpponentDeck'&&Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=10)||
    (e.code==='scoutDrawDiscardSpells'&&Number.isInteger(e.amount)&&e.amount>=1&&e.amount<=5&&Object.keys(e).length===3);
  if(e.kind==='endPhase')return e.code==='selfReturnHand'&&Object.keys(e).length===2;
  if(['destroyAttachedEquip','doubleOriginalAtkEndDestroy','trapSuppression','rocketAssault','fusionFromExtraPay5000','dragonTargetGuard'].includes(e.code))return (['doubleOriginalAtkEndDestroy','fusionFromExtraPay5000'].includes(e.code)?e.kind==='ignition':e.kind==='continuous')&&Object.keys(e).length===2;
  if(e.code==='postAttackDefenseLock')return e.kind==='continuous'&&Object.keys(e).length===2;
  if(e.code==='multiAttack')return e.kind==='continuous'&&Object.keys(e).length===3&&Number.isInteger(e.count)&&e.count>=2&&e.count<=5;
  if(!PASSIVE_SCALE_CODES.includes(e.code))return true;
  if(e.kind!=='continuous')return false;
  if(e.code==='battleImmuneAtkThreshold')return Number.isInteger(e.threshold)&&e.threshold>=100&&e.threshold<=5000;
  if(!Number.isInteger(e.amount)||e.amount<50||e.amount>2000)return false;
  if(e.code==='raceAuraGuard')return RACE_NAMES.includes(normalizeRace(e.race));
  if(e.code==='attributeFieldAura')return Object.hasOwn(PASSIVE_SCOPES,e.scope)&&
    ATTRIBUTE_NAMES.includes(normalizeAttribute(e.attribute))&&
    ATTRIBUTE_NAMES.includes(normalizeAttribute(e.negativeAttribute))&&
    normalizeAttribute(e.attribute)!==normalizeAttribute(e.negativeAttribute)&&
    Number.isInteger(e.negativeAmount)&&e.negativeAmount>=50&&e.negativeAmount<=2000;
  if(e.code==='graveNamedScale')return Object.hasOwn(PASSIVE_SCOPES,e.scope)&&Array.isArray(e.names)&&e.names.length>=1&&e.names.length<=2&&e.names.every(n=>typeof n==='string'&&n.length>0&&n.length<=32&&n===n.trim());
  if(e.code==='raceFieldGraveScale')return Object.hasOwn(PASSIVE_SCOPES,e.scope)&&RACE_NAMES.includes(normalizeRace(e.race));
  if(e.code==='battleAttributeScale')return ATTRIBUTE_NAMES.includes(normalizeAttribute(e.attribute));
  return false;
}
export function effectText(c){
  const e=c?.monsterEffect;
  if(!e&&!c?.ability)return '';
  if(c.ability)return abilityText(c.ability);
  if(e?.kind==='hand'&&e.code==='preventBattleDamage')return '相手の攻撃への対応中に手札から捨て、自分へのその戦闘のダメージを0にする（専用ボタンで発動）。';
  if(e?.kind==='hand'&&e.code==='specialByThreeNames')return `自分フィールドの「${e.names.join('」「')}」を各1体リリースして手札から特殊召喚する（手動選択省略）。`;
  if(e?.kind==='grave'&&e.code==='weakenOpponentOnGrave')return `フィールドから墓地へ送られた時、${PASSIVE_SCOPES[e.scope]||'相手'}の表側モンスター1体のATKを${e.amount??500}下げる。場を離れるか裏側表示になるまで有効（自動選択・装備カード化省略）。`;
  if(e?.kind==='grave'&&e.code==='reviveMaterialOnDestroy')return `フィールドで破壊された時、墓地の「${e.names.join('」か「')}」1体を${e.position==='def'?'表側守備':'攻撃'}表示で特殊召喚（自動選択）。`;
  if(e?.kind==='summonRule'&&e.code==='soloHandNoTribute')return '手札がこのカード1枚だけの場合、リリースなしで通常召喚・セットできる（条件を満たした場合はリリースなしを優先）。';
  if(e?.kind==='summonRule'&&e.code==='doubleLightTribute')return '光属性・レベル7以上のモンスターをアドバンス召喚・セットする場合、このカード1体を2体分のリリースにできる。';
  if(e?.kind==='trigger'&&e.code==='searchDeckOnSummon'){
    const target=e.filter==='ritualMonster'?'儀式モンスター':e.filter==='ritualSpell'?'儀式魔法':`「${e.name||''}」`;
    const extra=e.filter==='named'&&!e.normalOrFlipOnly?'、または指定名効果で手札から特殊召喚したとき':'';
    return `通常召喚・反転召喚したとき${extra}、自分のデッキから${target}1枚を手札に加える（自動選択）。`;
  }
  if(e?.kind==='battle'&&e.code==='recruitOnBattleDestroy')return `戦闘で破壊され墓地へ送られたとき、自分のデッキの${normalizeAttribute(e.attribute)}属性・元々のATK${e.threshold}以下のモンスター1体を攻撃表示で特殊召喚（自動選択・チェーン簡略化）`;
  if(e?.kind==='trigger'&&e.code==='copyOpponentPrintedStats')return `通常召喚・反転召喚・特殊召喚時、${PASSIVE_SCOPES[e.scope]||'相手'}の表側モンスターの元々のATK・DEFをコピー（自動選択・チェーン応答は省略）`;
  if(e?.kind==='flip'&&e.code==='cyberJarRevealFive')return 'リバース時、フィールドの全モンスターを破壊。お互いのデッキ上から最大5枚を公開し、その中のレベル4以下の通常召喚可能なモンスターを攻撃表示で特殊召喚、残りを手札へ（表示形式の選択・個別チェーン省略）。';
  if(e?.kind==='flip'&&e.code==='morphingJarTwo')return 'リバース時、全モンスターを持ち主のデッキへ戻し、戻した数だけデッキからモンスターを公開。レベル4以下の通常召喚可能なモンスターは裏側守備で特殊召喚し、残りはデッキへ戻す（選択・個別チェーン省略）。トークンは消滅し融合モンスターはEXデッキに戻る。';
  if(e?.kind==='flip'&&e.code==='returnOpponentOnFlip')return `リバース時、${PASSIVE_SCOPES[e.scope]||'相手'}の有効なモンスターを左端から最大${e.amount}体、持ち主の手札へ戻す（相手側を優先して自動選択。チェーン応答は省略）`;
  if(e?.kind==='flip'&&e.code==='destroyOpponentOnFlip')return `リバース時、${PASSIVE_SCOPES[e.scope]||'相手'}の有効なモンスター1体を破壊する（相手側を優先して自動選択。チェーン応答は省略）`;
  if(e?.kind==='grave'&&e.code==='searchStatOnGrave')return `フィールドから墓地へ送られたとき、デッキの${e.stat==='def'?'DEF':'ATK'}${e.threshold}以下のモンスター1体を手札に加える（自動選択）。${e.restrictActivation?'同名のサーチはターン中1回。加えたカードと同名の発動する効果はターン終了まで使えない。':''}`;
  if(e?.kind==='flip'&&e.code==='recoverOwnSpellOnFlip')return 'リバース時、自分の墓地の魔法カード1枚を手札に戻す（最初の候補を自動選択・チェーン簡略化）';
  if(e?.kind==='position'&&e.code==='destroyOnAttackToDefense')return '攻撃表示から表側守備表示に手動変更したとき、相手のモンスター1体を破壊する（左端を自動選択。カード効果による表示変更・チェーンは未対応）';
  if(e?.kind==='flip'&&e.code==='millOpponentDeck')return `リバース時、相手のデッキの上から${e.amount}枚を墓地へ送る`;
  if(e?.kind==='flip'&&e.code==='scoutDrawDiscardSpells')return `リバース時、相手は${e.amount}枚ドローし、その中の魔法カードを墓地へ捨てる（公開演出・チェーンは簡略化）`;
  if(e?.kind==='continuous'&&e.code==='destroyAttachedEquip')return 'このカードに装備カードが装備されたとき、その装備カードを破壊する（チェーンは簡略化）';
  if(e?.kind==='continuous'&&e.code==='rocketAssault')return '自分バトルフェイズにこのカードで攻撃する場合、戦闘破壊されず自分への戦闘ダメージは0。戦闘後、相手モンスターが残ればATKを500下げる（ターン終了まで・簡易処理）';
  if(e?.kind==='ignition'&&e.code==='fusionFromExtraPay5000')return '5000LPを払って発動。EXデッキの先頭の融合モンスター1体を攻撃表示で特殊召喚（LPは5000より多い必要あり。簡易処理）';
  if(e?.kind==='continuous'&&e.code==='dragonTargetGuard')return '表側表示の間、相手はフィールドのドラゴン族を効果の対象に選べない（対象を取らない効果は有効）。';
  if(e?.kind==='continuous'&&e.code==='trapSuppression')return '表側表示で存在する限り、お互いの罠カードを発動できず、罠のチェーン効果を解決時に無効化する（簡易処理）';
  if(e?.kind==='ignition'&&e.code==='doubleOriginalAtkEndDestroy')return '1ターンに1度、元々のATKの2倍にし、そのエンドフェイズに自身を破壊する（チェーンは簡略化）';
  if(e?.kind==='endPhase'&&e.code==='selfReturnHand')return '自分のエンドフェイズに、表側表示のこのカードを持ち主の手札に戻す（チェーン応答は簡略化）';
  if(e?.kind==='continuous'&&e.code==='postAttackDefenseLock')return '攻撃した場合、バトルフェイズ終了時に守備表示になり、次の自分ターン終了時まで手動で表示形式を変更できない（カード効果による変更は可能）';
  if(e?.kind==='continuous'&&e.code==='multiAttack')return `1度のバトルフェイズ中に${e.count}回まで攻撃できる`;
  if(e?.kind==='continuous'){
    if(e.code==='countStatScale'){
      const conditions=[
        e.names?.map(name=>`「${name}」`).join('または'),e.attribute&&`${normalizeAttribute(e.attribute)}属性`,
        e.race&&`${normalizeRace(e.race)}族`,e.level&&`レベル${e.level}`,COUNT_MONSTER_KINDS[e.monsterKind]
      ].filter(Boolean);
      return `${PASSIVE_SCOPES[e.scope]}の${(e.zones||[]).map(zone=>COUNT_STAT_ZONES[zone]).join('・')}にある${conditions.length?`${conditions.join('／')}に該当する`:''}モンスター1体につき、自身の${e.stat==='def'?'DEF':'ATK'}＋${e.amount}`;
    }
    if(e.code==='graveNamedScale')return `${PASSIVE_SCOPES[e.scope]||'お互い'}の墓地の「${(e.names||[]).join('」「')}」1枚につきATK＋${e.amount}`;
    if(e.code==='raceFieldGraveScale')return `${PASSIVE_SCOPES[e.scope]||'相手'}の表側表示フィールド・墓地の${normalizeRace(e.race)}族1体につきATK＋${e.amount}`;
    if(e.code==='battleAttributeScale')return `${normalizeAttribute(e.attribute)}属性モンスターとのダメージ計算中だけATK＋${e.amount}`;
    if(e.code==='battleImmuneAtkThreshold')return `攻撃力${e.threshold}以上のモンスターとの戦闘では破壊されない（戦闘ダメージは受ける）`;
    if(e.code==='attributeFieldAura')return `${PASSIVE_SCOPES[e.scope]||'お互い'}の表側表示${normalizeAttribute(e.attribute)}属性モンスターのATK＋${e.amount}／${normalizeAttribute(e.negativeAttribute)}属性モンスターのATK－${e.negativeAmount}`;
    if(e.code==='raceAuraGuard')return `自分フィールドの表側表示${normalizeRace(e.race)}族モンスターのATK＋${e.amount}。自分フィールドにこのカード以外のモンスターがいる間、相手はこのカードを攻撃対象にできない。`;
  }
  return MONSTER_EFFECTS[e.kind]?.[e.code]||'';
}
/** Firebase の共有カード帳から更新。既存カードは上書き表示可能、削除時には初期値に戻す。 */
export function replaceCustomCards(cards) {
  const all=ORIGINAL_CARDS.map(c=>({...c}));
  const indexes=new Map(all.map((c,i)=>[c.id,i]));
  for(const c of Object.values(cards||{})){
    if(!isSafeCustomCard(c))continue;
    const copy={...c};
    if(indexes.has(c.id))all[indexes.get(c.id)]=copy;
    else {indexes.set(c.id,all.length);all.push(copy);}
  }
  for(const id of Object.keys(CARD))delete CARD[id];
  CARDS.splice(0,CARDS.length,...all);
  for(const c of CARDS)CARD[c.id]=c;
  CARD[SHEEP_TOKEN_ID]=SHEEP_TOKEN;
  CARD[KURIBOH_TOKEN_ID]=KURIBOH_TOKEN; // Preserve both token definitions after custom-card refresh.
}
export function isSafeCustomCard(c){
  if(!c || typeof c!=='object'||!/^([a-z][0-9]{2}|u_[0-9a-f]{16,32})$/.test(c.id||''))return false;
  if(typeof c.name!=='string'||!c.name.trim()||c.name.length>32||typeof c.desc!=='string'||c.desc.length>250)return false;
  if(typeof c.owner!=='string'||c.owner.length<2||c.owner.length>150)return false;
  if(c.rarity!==undefined&&!Object.hasOwn(RARITIES,c.rarity))return false;
  if(c.limit!==undefined&&!Object.hasOwn(LIMITS,c.limit))return false;
  if(c.cost!==undefined&&(!Number.isInteger(c.cost)||c.cost<1||c.cost>20))return false;
  if(c.attribute!==undefined&&c.attribute!==''&&!ATTRIBUTE_NAMES.includes(c.attribute)&&!['dark','light','earth','water','fire','wind','divine'].includes(c.attribute))return false;
  if(c.race!==undefined&&c.race!==''&&!RACE_NAMES.includes(c.race)&&!['dragon','warrior','spellcaster','machine','fiend','fairy','beast','beast-warrior','winged-beast','aqua','insect','rock','plant','zombie','reptile','pyro','fish','thunder','dinosaur','sea-serpent','psychic','wyrm','cyberse','illusion','divine-beast'].includes(c.race))return false;
  if(c.ability!==undefined&&!isValidAbility(c.ability,c.type,c.spellKind||'normal'))return false;
  if(c.responseGuard!==undefined&&!(c.type==='trap'&&['spell','targetedSpell'].includes(c.responseGuard)&&c.ability?.when==='response'&&c.ability?.operation==='negateEffect'))return false;
  if(c.type==='spell'&&c.spellKind!==undefined&&!Object.hasOwn(SPELL_KINDS,c.spellKind))return false;
  if(c.type==='spell'&&c.spellKind==='ritual'&&c.ritualFor!==undefined&&c.ritualFor!==''&&!/^([a-z][0-9]{2}|u_[0-9a-f]{16,32})$/.test(c.ritualFor))return false;
  if(c.fx && (typeof c.fx!=='object'||!['auto','flame','lightning','slash','aqua','shadow','star','heal','ritual','fusion','none'].includes(c.fx.visual)||!['auto','slash','spark','boom','chime','water','heal','none'].includes(c.fx.sound)))return false;
  if(c.image && (typeof c.image!=='string'||!/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(c.image)||c.image.length>90000))return false;
  if(c.type==='monster'){
    if(!Number.isInteger(c.level)||c.level<1||c.level>12||![c.atk,c.def].every(n=>Number.isInteger(n)&&n>=0&&n<=5000))return false;
    if(c.summonKind!==undefined&&!Object.hasOwn(SUMMON_KINDS,c.summonKind))return false;
    if(summonKind(c)==='fusion'&&(!Array.isArray(c.fusionMaterials)||![2,3].includes(c.fusionMaterials.length)||!c.fusionMaterials.every(id=>typeof id==='string'&&/^([a-z][0-9]{2}|u_[0-9a-f]{16,32})$/.test(id))))return false;
    if(c.subtype==='effect')return !!(c.ability||validMonsterEffect(c.monsterEffect));
    return c.subtype==='normal';
  }
  if(c.type==='spell')return ['ritual','fusion'].includes(spellKind(c))?c.effect===(spellKind(c)==='ritual'?'ritualSummon':'fusionSummon'):!!c.ability||['draw2','heal1000','destroy','boost500','burn800'].includes(c.effect);
  if(c.type==='trap')return !!c.ability||['negate','counterdestroy','counterburn'].includes(c.effect);
  return false;
}
export const ORIGINAL_IDS = new Set(ORIGINAL_CARDS.map(c=>c.id));

// 各デッキ40枚・同一カード3枚まで。
const RED_COUNTS = {
  m01:2,m02:3,m03:3,m04:2,m05:3,m06:3,m12:1,m25:1,
  m13:2,m14:2,m17:1,m19:1,
  s01:3,s02:2,s03:2,s04:1,s10:1,s11:1,
  t01:2,t02:2,t03:2,
};
const BLUE_COUNTS = {
  m07:2,m08:3,m09:2,m10:3,m11:3,m12:3,m03:1,m25:1,
  m15:2,m16:2,m18:1,m20:1,
  s01:3,s02:2,s03:2,s04:1,s10:1,s11:1,
  t01:2,t02:2,t03:2,
};
export const PRESETS = {
  red: {name:'紅蓮デッキ',counts:RED_COUNTS},
  blue:{name:'蒼海デッキ',counts:BLUE_COUNTS},
  ...Object.fromEntries(Object.entries(HISTORICAL_PRESETS).map(([key,p])=>[key,{name:p.name,counts:p.counts,extraCounts:p.extraCounts,sideCounts:p.sideCounts,releaseDate:p.releaseDate}])),
};
export function expandDeck(counts) {
  return Object.entries(counts).flatMap(([id,n])=>Array(Number(n)||0).fill(id));
}
export function validExtraDeck(counts={}){
  if(!counts||typeof counts!=='object'||Array.isArray(counts))return false;
  const entries=Object.entries(counts);
  return entries.length<=15&&entries.reduce((n,[,qty])=>n+qty,0)<=15&&
    entries.every(([id,qty])=>CARD[id]&&summonKind(CARD[id])==='fusion'&&[2,3].includes(CARD[id].fusionMaterials?.length)&&Number.isInteger(qty)&&qty>=1&&qty<=cardLimit(CARD[id]));
}
export function validDeck(counts,rules={deckSize:40},extraCounts={}) {
  if(!counts||typeof counts!=='object')return false;
  return Object.values(counts).reduce((a,b)=>a+Number(b||0),0)===(rules.deckSize||40) &&
    Object.entries(counts).every(([id,n]) => !!CARD[id] && !CARD[id].isToken && summonKind(CARD[id])!=='fusion' && Number.isInteger(n) && n>=1 && n<=cardLimit(CARD[id])) &&
    validExtraDeck(extraCounts) &&
    (!rules.costLimit || deckCost(counts,CARD)<=rules.costLimit);
}
export function copyPreset(id) { return {...PRESETS[id].counts}; }
export function shuffle(xs) {
  const a=[...xs]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
