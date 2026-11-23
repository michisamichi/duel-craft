/** A small, declarative user effect-recipe library. No script execution, no engine extensions. */
import {effectText,validMonsterEffect} from './cards.js?v=2047';
import {HISTORICAL_CARDS} from './historical-data.js?v=2047';
import {isValidAbility,abilityText} from './rules.js?v=2047';

export const EFFECT_TEMPLATE_KEY='saho-effect-templates-v1';
export const EFFECT_TEMPLATE_LIMIT=40;
const MAX_BYTES=35000;
const MAX_NAME=32;
const MAX_ENTRY=1200;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const COPY=x=>JSON.parse(JSON.stringify(x));
const ALLOWED_SPELL_KINDS=['normal','quick','continuous','equip','field'];

export function templateFromCard(card,name,id){
 const trimmed=typeof name==='string'?name.trim():'';
 if(!isObject(card)||!trimmed||trimmed.length>MAX_NAME||!['monster','spell','trap'].includes(card.type))return null;
 if(typeof id!=='string'||!/^et_[a-z0-9_]{1,40}$/.test(id))return null;
 const t={id,name:trimmed,type:card.type};
 if(card.responseGuard!==undefined){
  if(card.type!=='trap'||!['spell','targetedSpell'].includes(card.responseGuard)||card.ability?.when!=='response'||card.ability?.operation!=='negateEffect')return null;
  t.responseGuard=card.responseGuard;
 }
 if(card.type==='monster'){
  if(card.subtype!=='effect')return null;
  if(card.ability){if(!isValidAbility(card.ability,'monster'))return null;t.ability=COPY(card.ability);}
  else {if(!validMonsterEffect(card.monsterEffect))return null;t.monsterEffect=COPY(card.monsterEffect);}
 }else{
  if(card.type==='spell'){
   const kind=card.spellKind||'normal';
   if(!ALLOWED_SPELL_KINDS.includes(kind))return null;
   t.spellKind=kind;
  }
  if(!isValidAbility(card.ability,card.type,t.spellKind||'normal'))return null;
  t.ability=COPY(card.ability);
 }
 return JSON.stringify(t).length<=MAX_ENTRY?t:null;
}
// Built-in, read-only recipes share the same validated four-field vocabulary as
// user recipes. No storage cost and no extra engine execution path.
export const BUILTIN_EFFECT_TEMPLATES=Object.freeze([
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'sealEnemyAttacks',target:'none',amount:0}},'光の護封剣式：3ターン攻撃禁止','et_builtin_swords'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'summonSheepTokens',target:'self',amount:4}},'スケープ・ゴート式：羊4体','et_builtin_sheep'),
 templateFromCard({type:'trap',ability:{when:'main',operation:'graveRevive',target:'self',amount:1}},'リビングデッド式：墓地蘇生','et_builtin_haunted'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'preventEquipAttack',target:'enemyMonster',amount:0}},'ブラックダスト式：2ターン後破壊','et_builtin_virus'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'grave',code:'weakenOpponentOnGrave'}},'ギルファー式：墓地でATK－500','et_builtin_gilfer'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'selfSpecialFromHandGiveRevive',target:'self',amount:0}},'ギラザウルス式：双方特殊召喚','et_builtin_gilasa'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'lockWhileSourceFaceUp',target:'enemyMonster',amount:0}},'ルシファー式：継続攻撃禁止','et_builtin_lucifer'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'timeWizardCoin',target:'self',amount:0}},'時の魔術師式：コイントス','et_builtin_wizard'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'negateAndLockAttacker',target:'attacker',amount:0}},'六芒星式：永続攻撃禁止','et_builtin_spellbinding'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'negateWeakenAttacker',target:'attacker',amount:700}},'闇の呪縛式：永続ATK－700','et_builtin_shadow'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banish',target:'enemyFaceDownMonster',amount:0}},'抹殺式：伏せ・同名除外','et_builtin_crossout'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banishSetBackrow',target:'enemyBackrow',amount:0}},'撲滅式：伏せ罠・同名除外','et_builtin_nobleman'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'recoverNormalAtk',target:'self',amount:3}},'補充要員式：通常モンスター回収','et_builtin_backup'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'borrowOpponentSpell',target:'self',amount:0}},'墓荒らし式：相手墓地の魔法回収','et_builtin_graverobber'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'destroyThenSetBackrow',target:'enemyBackrow',amount:0}},'砂塵式：破壊後に魔法・罠をセット','et_builtin_tornado'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'healPerFieldMonster',target:'self',amount:300}},'ホーリー・エルフ式：場の数×LP回復','et_builtin_holyelf'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'crushVirus',target:'none',amount:0,before:{operation:'sendOwnMonsterGrave',amount:1}}},'死のデッキ破壊ウイルス式：闇属性1体をコスト','et_builtin_crushvirus'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'revealSetMonsters',target:'none',amount:0}},'聖なる輝き式：裏側モンスター公開','et_builtin_sanctity'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'diceStats',target:'ownAllMonsters',amount:0}},'天使のサイコロ式：全体強化','et_builtin_angeldice'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'diceStats',target:'enemyAllMonsters',amount:0}},'悪魔のサイコロ式：全体弱体化','et_builtin_devildice'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'redirectAttack',target:'none',amount:0}},'シフトチェンジ式：攻撃先を変更','et_builtin_shift'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'concealDefender',target:'none',amount:0}},'シルクハット式：対象を裏守備','et_builtin_hat'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'redirectToAttackerAlly',target:'none',amount:0}},'マジックアーム式：味方へ変更','et_builtin_arm'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'setAttackerDefense',target:'attacker',amount:0}},'鎖付きブーメラン式：守備変更','et_builtin_boomerang'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'summonKuribohTokens',target:'self',amount:0}},'増殖式：クリボートークン','et_builtin_multiply'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'summonRaceFromHand',target:'self',amount:2,match:'race',query:'ドラゴン',requiredFaceUpName:'ロード・オブ・ドラゴン－ドラゴンの支配者－'}},'ドラゴンの笛式：手札から2体','et_builtin_flute'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroy',target:'enemyMonster',amount:0,before:{operation:'discardOwnHand',amount:1}}},'死者への手向け式：手札を捨て破壊','et_builtin_offering'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:1000}},'デーモンの斧式：装備ATK＋1000','et_builtin_axe'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'removeSpellBackrow',target:'enemyBackrow',amount:0}},'魔法除去式：伏せ確認・魔法破壊','et_builtin_magicremoval'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'destroyBackrow',target:'enemyBackrow',amount:0}},'サイクロン式：魔法・罠1枚破壊','et_builtin_cyclone'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroy',target:'bothMonsters',amount:0}},'ブラック・ホール式：全モンスター破壊','et_builtin_blackhole'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'reviveBothSet',target:'none',amount:0}},'浅すぎた墓穴式：双方裏守備蘇生','et_builtin_shallow'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'draw',target:'self',amount:3,then:{operation:'discardNewest',target:'self',amount:2}}},'天使の施し式：3枚引いて2枚捨てる','et_builtin_graceful'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroyGiveOwn',target:'enemyMonster',amount:0}},'マジック・ボックス式：破壊して譲る','et_builtin_magicbox'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'swapPrintedStats',target:'bothMonsters',amount:0}},'右手に盾式：ATKとDEFを交換','et_builtin_shield_sword'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'pierce',target:'ownMonster',amount:0}},'メテオ・ストライク式：貫通付与','et_builtin_meteor'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'replaceHands',target:'none',amount:0}},'手札抹殺式：双方の手札を交換','et_builtin_handexchange'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveRevive',target:'self',amount:1,before:{operation:'payLP',amount:800}}},'早すぎた埋葬式：800LPで蘇生','et_builtin_burial'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'lpRelativeEquip',target:'ownMonster',amount:0}},'巨大化式：LP差でATK増減','et_builtin_megamorph'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'reflectAttack',target:'none',amount:0}},'魔法の筒式：攻撃を反射','et_builtin_cylinder'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'destroy',target:'enemyAttackMonsters',amount:0}},'ミラーフォース式：攻撃表示を全破壊','et_builtin_mirrorforce'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'negateEndBattle',target:'none',amount:0}},'攻撃の無力化式：バトル終了','et_builtin_negatebattle'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'blastAttacker',target:'attacker',amount:0}},'破壊輪式：攻撃者破壊・双方にダメージ','et_builtin_ring'),
 templateFromCard({type:'trap',ability:{when:'summon',operation:'destroyOnEnemySummon',target:'enemyMonster',amount:1000}},'落とし穴式：召喚時に自動破壊','et_builtin_traphole'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'negateEffect',target:'none',amount:0,before:{operation:'discardOwnHand',amount:1}}},'ジャマー式：手札を捨て魔法無効','et_builtin_jammer'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'redirectSpellTarget',target:'none',amount:0}},'天使の手鏡式：魔法対象変更','et_builtin_handmirror'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'protectOwnTraps',target:'none',amount:0}},'偽物のわな式：罠破壊を防止','et_builtin_faketrap'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'lockPositionNextTurn',target:'opponent',amount:0}},'催眠術式：次ターン表示変更禁止','et_builtin_hypnosis'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'trigger',code:'searchDeckOnSummon',filter:'named',name:'幻獣王ガゼル'}},'バフォメット式：召喚時に指定名サーチ','et_builtin_baphomet'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'summonNamedFromHand',target:'self',amount:0,match:'exact',query:'ランプの魔精・ラ・ジーン'}},'マジック・ランプ式：手札から特殊召喚','et_builtin_lamp'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'ignition',code:'fusionFromExtraPay5000'}},'デビル・フランケン式：5000LPで融合召喚','et_builtin_franken'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'ignition',code:'doubleOriginalAtkEndDestroy'}},'カラテマン式：ATK倍化と自壊','et_builtin_karate'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'reviveSelected',target:'eitherGraveMonster',amount:0}},'死者蘇生式：双方の墓地から選んで蘇生','et_builtin_reborn'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroy',target:'enemyLowestAtk',amount:0}},'地割れ式：相手の最低ATKを破壊','et_builtin_fissure'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchNamed',target:'self',amount:1,match:'exact',query:'融合'}},'融合賢者式：指定カードをサーチ','et_builtin_sage'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'draw',target:'self',amount:2}},'強欲な壺式：カードを2枚ドロー','et_builtin_pot'),
 templateFromCard(HISTORICAL_CARDS.find(card=>card.name==='クリッター'),'クリッター式：墓地でATK1500以下サーチ','et_builtin_sangan'),
 templateFromCard(HISTORICAL_CARDS.find(card=>card.name==='黒き森のウィッチ'),'ウィッチ式：墓地でDEF1500以下サーチ','et_builtin_witch'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'battle',code:'recruitOnBattleDestroy',attribute:'地',threshold:1500}},'巨大ネズミ式：戦闘破壊で地属性を募集','et_builtin_giantrat'),
 templateFromCard(HISTORICAL_CARDS.find(card=>card.name==='ペンギン・ソルジャー'),'ペンギン式：リバースで最大2体手札へ','et_builtin_penguin'),
 templateFromCard(HISTORICAL_CARDS.find(card=>card.name==='人喰い虫'),'人喰い虫式：リバースで1体破壊','et_builtin_maneater'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'millOpponentDeck',amount:5}},'ニードルワーム式：リバースで5枚墓地へ','et_builtin_needle'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'scoutDrawDiscardSpells',amount:3}},'悪魔の偵察者式：相手3枚ドロー魔法捨て','et_builtin_scout'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'returnBackrow',target:'bothAllBackrow',amount:0}},'ハリケーン式：場の魔法・罠を全返却','et_builtin_hurricane'),
 templateFromCard(HISTORICAL_CARDS.find(card=>card.name==='ブラック・マジシャン・ガール'),'ブラック・マジシャン・ガール式：墓地ATK上昇','et_builtin_bmg'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'summonRule',code:'soloHandNoTribute'}},'疾風の暗黒騎士ガイア式：手札1枚ならリリース不要','et_builtin_gaia'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'battleImmuneAtkThreshold',threshold:1900}},'翻弄するエルフの剣士式：高ATK戦闘で破壊されない','et_builtin_celtic'),
 templateFromCard(HISTORICAL_CARDS.find(card=>card.name==='バスター・ブレイダー'),'バスター・ブレイダー式：相手ドラゴンの数でATK上昇','et_builtin_buster'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'hand',code:'specialByThreeNames',names:['磁石の戦士α','磁石の戦士β','磁石の戦士γ']}},'磁石の戦士マグネット・バルキリオン式：指定名3体をリリースして','et_builtin_valkyrion'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'hand',code:'preventBattleDamage'}},'クリボー式：手札から戦闘ダメージ0','et_builtin_kuriboh'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'cyberJarRevealFive'}},'サイバーポッド式：リバースでモンスター破壊と公開','et_builtin_cyberjar'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'grave',code:'reviveMaterialOnDestroy',names:['幻獣王ガゼル','バフォメット']}},'有翼幻獣キマイラ式：破壊時に指定素材を蘇生','et_builtin_chimera'),
 templateFromCard(HISTORICAL_CARDS.find(card=>card.name==='太陽の戦士'),'太陽の戦士式：闇属性との戦闘時ATK上昇','et_builtin_sunwarrior'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'raceAuraGuard',race:'戦士',amount:400}},'コマンド・ナイト式：戦士強化と攻撃対象制限','et_builtin_command'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'trapSuppression'}},'人造人間－サイコ・ショッカー式：表側の間罠無効','et_builtin_jinzo'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'trigger',code:'copyOpponentPrintedStats'}},'ものマネ幻想師式：召喚時に元々のATK・DEFコピー','et_builtin_copycat'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'rocketAssault'}},'ロケット戦士式：自分攻撃時の戦闘耐性と弱体化','et_builtin_rocket'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'destroyAttachedEquip'}},'鉄の騎士 ギア・フリード式：自身の装備カード破壊','et_builtin_gearfried'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'multiAttack',count:2}},'隼の騎士式：バトルフェイズ2回攻撃','et_builtin_hayabusa'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'postAttackDefenseLock'}},'ゴブリン突撃部隊式：攻撃後に守備表示','et_builtin_goblin'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'continuous',operation:'fusionMaterialSubstitute',target:'self',amount:0}},'心眼の女神式：融合素材の代用','et_builtin_goddess'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'continuous',operation:'directEarthWaterFire',target:'self',amount:0}},'ドラゴンに乗るワイバーン式：条件付き直接攻撃','et_builtin_wyvern'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'attributeFieldAura',attribute:'地',amount:500,negativeAttribute:'風',negativeAmount:400,scope:'both'}},'ミリス・レディエント式：地属性強化・風属性弱体化','et_builtin_milus'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'summonRule',code:'doubleLightTribute'}},'カイザー・シーホース式：光属性上級の2体分リリース','et_builtin_kaiser'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'battleDamage',operation:'millFirstType',target:'opponent',amount:0,match:'monster'}},'ヴァンパイア・ロード式：戦闘ダメージ時の選択種別デッキ破棄','et_builtin_vampire'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'continuous',operation:'fusionMaterialSubstitute',target:'self',amount:0}},'破壊神 ヴァサーゴ式：融合素材の代用','et_builtin_versago'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'endPhase',code:'selfReturnHand'}},'邪悪なるワーム・ビースト式：エンドフェイズに手札へ戻る','et_builtin_wormbeast'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'morphingJarTwo'}},'カオスポッド式：リバースで双方のモンスターをデッキへ','et_builtin_morphjar2'),
 templateFromCard({type:'spell',spellKind:'field',ability:{when:'continuous',operation:'earthAura',target:'bothMonsters',amount:500}},'ガイアパワー式：地属性のATK＋500','et_builtin_gaia_field'),
 templateFromCard({type:'trap',ability:{when:'continuous',operation:'extraNormalSummon',target:'self',amount:500}},'血の代償式：LP500で追加通常召喚','et_builtin_ultimate_offering'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'continuous',operation:'tributeOtherToAttack',target:'self',amount:0}},'パンサーウォリアー式：攻撃時に1体リリース','et_builtin_panther'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'dragonTargetGuard'}},'ロード・オブ・ドラゴン式：ドラゴンを対象保護','et_builtin_dragonlord'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroyBackrow',target:'bothAllBackrow',amount:0}},'大嵐式：魔法・罠を全破壊','et_builtin_heavystorm'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'negateEffect',target:'none',amount:0},responseGuard:'targetedSpell'},'フォースフィールド式：対象魔法を無効','et_builtin_forcefield'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:300}},'強奪・現行代替式：ATK＋300','et_builtin_snatch_proxy'),
].filter(Boolean).map(Object.freeze));

export function isValidTemplate(t){
 if(!isObject(t)||typeof t.id!=='string'||typeof t.name!=='string')return false;
 const card={type:t.type,subtype:'effect',spellKind:t.spellKind,ability:t.ability,monsterEffect:t.monsterEffect,responseGuard:t.responseGuard};
 const check=templateFromCard(card,t.name,t.id);
 return !!check&&JSON.stringify(check)===JSON.stringify(t);
}
export function normalizeTemplates(data){
 if(!Array.isArray(data)||data.length>EFFECT_TEMPLATE_LIMIT)return null;
 const found=new Set(),output=[];
 for(const t of data){
  if(!isValidTemplate(t)||found.has(t.id))return null;
  found.add(t.id);output.push(COPY(t));
 }
 return JSON.stringify(output).length<=MAX_BYTES?output:null;
}
export function readTemplates(storage){
 try{
  const value=storage.getItem(EFFECT_TEMPLATE_KEY);
  if(!value||value.length>MAX_BYTES)return [];
  return normalizeTemplates(JSON.parse(value))||[];
 }catch{return [];}
}
export function saveTemplate(storage,card,name){
 const list=readTemplates(storage);
 if(list.length>=EFFECT_TEMPLATE_LIMIT)throw Error(`保存できる効果は${EFFECT_TEMPLATE_LIMIT}件までです`);
 // Stable short identifier; collision handling requires no additional persistent counter.
 const seed=Date.now().toString(36);
 let index=0,id;
 do{id=`et_${seed}_${(index++).toString(36)}`;}while(list.some(t=>t.id===id));
 const created=templateFromCard(card,name,id);
 if(!created)throw Error('効果の設定または名前が正しくありません。条件や数値を確認してください');
 const next=[...list,created];
 if(!normalizeTemplates(next))throw Error('登録できる効果データの上限を超えました');
 storage.setItem(EFFECT_TEMPLATE_KEY,JSON.stringify(next));
 return COPY(created);
}
export function deleteTemplate(storage,id){
 const list=readTemplates(storage),next=list.filter(t=>t.id!==id);
 if(next.length===list.length)return false;
 storage.setItem(EFFECT_TEMPLATE_KEY,JSON.stringify(next));return true;
}
export function canApplyTemplate(template,card){
 if(!isValidTemplate(template)||!isObject(card)||template.type!==card.type)return false;
 return card.type!=='spell'||(card.spellKind||'normal')===template.spellKind;
}
export function applyTemplate(card,template){
 if(!canApplyTemplate(template,card))throw Error('このカードの種類には適用できません');
 const next={...card};
 delete next.ability;delete next.monsterEffect;delete next.responseGuard;
 if(template.responseGuard)next.responseGuard=template.responseGuard;
 if(next.type==='monster')next.subtype='effect';
 if(template.ability){next.ability=COPY(template.ability);if(next.type!=='monster')delete next.effect;}
 else next.monsterEffect=COPY(template.monsterEffect);
 return next;
}
export function templateDescription(t){
 if(!isValidTemplate(t))return '';
 if(t.ability)return abilityText(t.ability)+(t.responseGuard==='targetedSpell'?'（モンスター1体を対象とする魔法限定）':t.responseGuard==='spell'?'（魔法限定）':'');
 const e=t.monsterEffect;
 if(['countStatScale','battleAttributeScale','searchStatOnGrave','returnOpponentOnFlip','destroyOpponentOnFlip'].includes(e.code))return effectText(t);
 const n=e.amount!==undefined?`（${e.amount}）`:e.threshold!==undefined?`（ATK ${e.threshold}以上）`:'';
 const base={destroyAttachedEquip:'装備されたカードを破壊',multiAttack:'1度のバトルフェイズで複数回攻撃',copyOpponentPrintedStats:'召喚時相手の元々の攻撃力と守備力をコピー',millFirstType:'戦闘ダメージ時指定種別のデッキ破棄',directEarthWaterFire:'条件付き直接攻撃',fusionMaterialSubstitute:'融合素材の代用',morphingJarTwo:'リバース時双方のモンスターをデッキへ戻す',cyberJarRevealFive:'リバース時双方の場を破壊しデッキ5枚公開',darkBattle500:'闇属性との戦闘中にATK上昇',enemyDragon500:'相手のドラゴン族の数に応じてATK上昇',darkMagicianGrave300:'墓地のブラック・マジシャン系の数に応じてATK上昇',preventBattleDamage:'手札から捨て、戦闘ダメージ0',specialByThreeNames:'指定名3体をリリースして手札から特殊召喚',weakenOpponentOnGrave:'墓地へ送られたとき相手ATK－500（場を離れるまで）',reviveMaterialOnDestroy:'効果・戦闘破壊時に墓地の指定名モンスターを蘇生',rocketAssault:'攻撃時の戦闘破壊・ダメージ防止＋相手ATK－500',fusionFromExtraPay5000:'5000LPを払いEXデッキから融合モンスターを特殊召喚',soloHandNoTribute:'手札が自身1枚ならリリース不要',doubleLightTribute:'光属性の上級召喚時に2体分のリリース',graveNamedScale:'墓地の指定名でATK変化',raceFieldGraveScale:'場・墓地の指定種族でATK変化',battleAttributeScale:'特定属性との戦闘時にATK変化',battleImmuneAtkThreshold:'戦闘破壊耐性',attributeFieldAura:'属性別の全体ATK変化',raceAuraGuard:'種族強化＋攻撃対象制限',returnOpponentOnFlip:'リバース時に相手モンスターを手札へ戻す',searchStatOnGrave:'フィールドから墓地へ送られた際に指定ATK/DEF以下をサーチ',millOpponentDeck:'リバース時のデッキ破棄',selfReturnHand:'自分エンドフェイズに自身を手札へ戻す',postAttackDefenseLock:'攻撃後に守備表示＋次の自分ターン終了まで手動変更不可',trapSuppression:'表側表示で罠の発動・効果を封じる',dragonTargetGuard:'表側表示で相手がドラゴン族を効果対象にできない'};
 return (base[e.code]||`${e.kind}・${e.code}`)+n;
}
