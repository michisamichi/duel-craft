/** A small, declarative user effect-recipe library. No script execution, no engine extensions. */
import {validMonsterEffect} from './cards.js?v=2351';
import {isValidAbility,abilityText} from './rules.js?v=2351';

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
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'grave',code:'searchStatOnGrave',stat:'atk',threshold:1500}},'クリッター式：墓地でATK1500以下サーチ','et_builtin_sangan'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'grave',code:'searchStatOnGrave',stat:'def',threshold:1500}},'ウィッチ式：墓地でDEF1500以下サーチ','et_builtin_witch'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'battle',code:'recruitOnBattleDestroy',attribute:'地',threshold:1500}},'巨大ネズミ式：戦闘破壊で地属性を募集','et_builtin_giantrat'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'returnOpponentOnFlip',amount:2}},'ペンギン式：リバースで最大2体手札へ','et_builtin_penguin'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'destroyOpponentOnFlip'}},'人喰い虫式：リバースで1体破壊','et_builtin_maneater'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'millOpponentDeck',amount:5}},'ニードルワーム式：リバースで5枚墓地へ','et_builtin_needle'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'scoutDrawDiscardSpells',amount:3}},'悪魔の偵察者式：相手3枚ドロー魔法捨て','et_builtin_scout'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'returnBackrow',target:'bothAllBackrow',amount:0}},'ハリケーン式：場の魔法・罠を全返却','et_builtin_hurricane'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'darkMagicianGrave300'}},'ブラック・マジシャン・ガール式：墓地ATK上昇','et_builtin_bmg'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'summonRule',code:'soloHandNoTribute'}},'疾風の暗黒騎士ガイア式：手札1枚ならリリース不要','et_builtin_gaia'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'battleImmuneAtkThreshold',threshold:1900}},'翻弄するエルフの剣士式：高ATK戦闘で破壊されない','et_builtin_celtic'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'enemyDragon500'}},'バスター・ブレイダー式：相手ドラゴンの数でATK上昇','et_builtin_buster'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'hand',code:'specialByThreeNames',names:['磁石の戦士α','磁石の戦士β','磁石の戦士γ']}},'磁石の戦士マグネット・バルキリオン式：指定名3体をリリースして','et_builtin_valkyrion'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'hand',code:'preventBattleDamage'}},'クリボー式：手札から戦闘ダメージ0','et_builtin_kuriboh'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'cyberJarRevealFive'}},'サイバーポッド式：リバースでモンスター破壊と公開','et_builtin_cyberjar'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'grave',code:'reviveMaterialOnDestroy',names:['幻獣王ガゼル','バフォメット']}},'有翼幻獣キマイラ式：破壊時に指定素材を蘇生','et_builtin_chimera'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'darkBattle500'}},'太陽の戦士式：闇属性との戦闘時ATK上昇','et_builtin_sunwarrior'),
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
 // Optional parametric counterparts leave the original printed-card recipes untouched.
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'graveNamedScale',names:['ブラック・マジシャン','マジシャン・オブ・ブラックカオス'],scope:'both',amount:300}},'墓地指定名式：名前・枚数あたりのATKを編集','et_builtin_grave_names_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'raceFieldGraveScale',race:'ドラゴン',scope:'opponent',amount:500}},'種族の場・墓地式：種族・上昇値を編集','et_builtin_race_scale_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'battleAttributeScale',attribute:'闇',amount:500}},'戦闘属性式：属性・上昇値を編集','et_builtin_battle_attribute_edit'),
 // Editable recipes use the SAME native effect engine; originals remain unchanged.
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'ignition',code:'doubleOriginalAtkEndDestroy',multiplier:3}},'カラテマン汎用式：倍率2～4とターン末自壊','et_builtin_karate_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'destroyOpponentOnFlip',amount:2}},'人喰い虫汎用式：リバース破壊1～3体','et_builtin_maneater_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'trigger',code:'copyOpponentPrintedStats',selection:'highest'}},'ものマネ幻想師汎用式：最高ATKをコピー','et_builtin_copycat_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'cyberJarRevealFive',amount:3}},'サイバーポッド汎用式：公開枚数を変更','et_builtin_cyberjar_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'returnOpponentOnFlip',amount:3}},'ペンギン汎用式：戻す枚数1～5体','et_builtin_penguin_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'scoutDrawDiscardSpells',amount:3,discardType:'trap'}},'悪魔の偵察者汎用式：捨てる種類を変更','et_builtin_scout_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'battle',code:'recruitOnBattleDestroy',attribute:'地',threshold:1500,race:'獣'}},'巨大ネズミ汎用式：属性・種族でリクルート','et_builtin_giantrat_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'grave',code:'searchStatOnGrave',stat:'atk',threshold:1500,race:'戦士'}},'クリッター汎用式：種族指定付きサーチ','et_builtin_sangan_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'summonRule',code:'soloHandNoTribute',maxHand:2}},'疾風ガイア汎用式：手札枚数でリリース不要','et_builtin_gaia_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'summonRule',code:'doubleLightTribute',attribute:'闇'}},'カイザー汎用式：リリースの属性指定','et_builtin_kaiser_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'trigger',code:'searchDeckOnSummon',filter:'named',name:'幻獣王ガゼル',count:2}},'バフォメット汎用式：最大2枚サーチ','et_builtin_baphomet_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'grave',code:'reviveMaterialOnDestroy',names:['幻獣王ガゼル','バフォメット'],count:2}},'キマイラ汎用式：指定名を最大2体蘇生','et_builtin_chimera_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'ignition',code:'fusionFromExtraPay5000',cost:2500,selection:'highest'}},'フランケン汎用式：LPとEXの選択を編集','et_builtin_franken_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'endPhase',code:'selfReturnHand',phase:'both'}},'ワーム・ビースト汎用式：双方エンドフェイズに帰還','et_builtin_wormbeast_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'postAttackDefenseLock',lockTurns:2}},'ゴブリン突撃部隊汎用式：表示変更を2ターン禁止','et_builtin_goblin_edit'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'summonSheepTokens',target:'self',amount:2}},'スケープ・ゴート汎用式：羊を1～4体','et_builtin_sheep_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'raceAuraGuard',race:'魔法使い',amount:600}},'コマンド・ナイト汎用式：種族と強化値を変更','et_builtin_command_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'continuous',code:'battleImmuneAtkThreshold',threshold:2500}},'翻弄するエルフ汎用式：戦闘破壊耐性のATK閾値','et_builtin_celtic_edit'),
 templateFromCard({type:'monster',subtype:'effect',monsterEffect:{kind:'flip',code:'millOpponentDeck',amount:3}},'ニードルワーム汎用式：墓地送り枚数を調整','et_builtin_needle_edit'),
 templateFromCard({type:'trap',ability:{when:'response',operation:'healPerFieldMonster',target:'self',amount:500}},'ホーリー・エルフ汎用式：1体あたり回復量を調整','et_builtin_holyelf_edit'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'negateWeakenAttacker',target:'attacker',amount:900}},'闇の呪縛汎用式：ATK低下値を調整','et_builtin_shadow_edit'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:1500}},'デーモンの斧汎用式：装備ATK上昇値','et_builtin_axe_edit'),
 templateFromCard({type:'trap',ability:{when:'summon',operation:'destroyOnEnemySummon',target:'enemyMonster',amount:1500}},'落とし穴汎用式：召喚時ATK閾値を調整','et_builtin_traphole_edit'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'draw',target:'self',amount:2,then:{operation:'discardNewest',target:'self',amount:1}}},'天使の施し汎用式：2枚引いて1枚捨てる','et_builtin_graceful_edit'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'draw',target:'self',amount:1}},'強欲な壺系：1枚ドロー','et_builtin_draw_one'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'heal',target:'self',amount:1200}},'治療系：LP1200回復','et_builtin_heal_1200'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'damage',target:'opponent',amount:800}},'火炎系：相手に800ダメージ','et_builtin_burn_800'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'boostDef',target:'ownMonster',amount:800}},'守備強化装備：DEF＋800','et_builtin_equip_def'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'weakenDef',target:'enemyMonster',amount:800}},'守備弱体装備：DEF－800','et_builtin_equip_def_down'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'returnHand',target:'enemyMonster',amount:0}},'バウンス系：相手1体を手札へ','et_builtin_bounce_hand'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'returnDeck',target:'enemyMonster',amount:0}},'デッキ帰還系：相手1体を戻す','et_builtin_bounce_deck'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchMonster',target:'self',amount:2}},'モンスター探索系：2枚サーチ','et_builtin_search_two'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'draw',target:'self',amount:2}},'2枚ドロー：シンプルな手札補充','et_builtin_draw_simple_two'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'heal',target:'self',amount:2000}},'LP回復：2000回復','et_builtin_heal_2000'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'damage',target:'opponent',amount:1500}},'直接ダメージ：1500','et_builtin_burn_1500'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:500}},'装備強化：ATK＋500','et_builtin_equip_atk_500'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'boostDef',target:'ownMonster',amount:1200}},'装備強化：DEF＋1200','et_builtin_equip_def_1200'),
 templateFromCard({type:'spell',spellKind:'equip',ability:{when:'continuous',operation:'weakenDef',target:'enemyMonster',amount:1200}},'装備弱体化：DEF－1200','et_builtin_equip_def_down_1200'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchMonster',target:'self',amount:1}},'モンスター探索：1枚','et_builtin_search_one'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveRevive',target:'self',amount:1}},'墓地蘇生：1体（LPコストなし）','et_builtin_revive_one'),
 // v1.9.160: Four distinct, existing-engine retrieval and recycling recipes.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchSpell',target:'self',amount:1}},'魔法探索：デッキから1枚手札へ','et_builtin_search_spell_one'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchTrap',target:'self',amount:1}},'罠探索：デッキから1枚手札へ','et_builtin_search_trap_one'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveRecover',target:'self',amount:1}},'墓地回収：最新1枚を手札へ','et_builtin_recover_grave_one'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveRecycle',target:'self',amount:1}},'墓地循環：最新1枚をデッキへ','et_builtin_recycle_grave_one'),
 // v1.9.161: Four interaction recipes using existing deterministic engine actions.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'discardNewest',target:'opponent',amount:1}},'手札妨害：相手の末尾1枚を捨てる','et_builtin_discard_enemy_one'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'mill',target:'opponent',amount:2}},'デッキ削り：相手の上から2枚墓地へ','et_builtin_mill_enemy_two'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banish',target:'enemyMonster',amount:0}},'モンスター除外：相手の1体を除外','et_builtin_banish_enemy_monster'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'negateAttack',target:'none',amount:0}},'攻撃無効：攻撃を1回止める','et_builtin_negate_one_attack'),

 // v1.9.162: four additional existing-engine recipes; no new effect interpreter.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'weaken',target:'enemyMonster',amount:700}},'相手1体のATKを700下げる','et_builtin_s162_weaken_enemy'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'sendGrave',target:'enemyMonster',amount:0}},'相手1体を破壊せず墓地へ送る','et_builtin_s162_send_grave'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'changePosition',target:'enemyMonster',amount:0}},'相手1体の表示形式を変更する','et_builtin_s162_change_position'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'setAtk',target:'ownMonster',amount:2500}},'自分1体のATKを2500にする','et_builtin_s162_set_atk'),

 // v1.9.163: four additional existing-engine recipes; no new effect interpreter.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'setDef',target:'ownMonster',amount:3000}},'自分1体のDEFを3000にする','et_builtin_s163_set_def'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'lockAttack',target:'enemyMonster',amount:0}},'相手1体を一時的に攻撃禁止','et_builtin_s163_lock_attack'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'lockEffect',target:'enemyMonster',amount:0}},'相手1体の起動効果を一時禁止','et_builtin_s163_lock_effect'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banishBackrow',target:'enemyBackrow',amount:0}},'相手の魔法・罠1枚を除外','et_builtin_s163_banish_backrow'),

 // v1.9.164: four additional existing-engine recipes; no new effect interpreter.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banishDeck',target:'opponent',amount:2}},'相手のデッキ上2枚を除外','et_builtin_s164_banish_deck'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveBanish',target:'opponent',amount:2}},'相手墓地の新しい2枚を除外','et_builtin_s164_banish_grave'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banishedRecover',target:'self',amount:1}},'自分の除外カードを1枚回収','et_builtin_s164_recover_banished'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'setLP',target:'self',amount:4000}},'自分のLPを4000に設定','et_builtin_s164_set_lp'),

 // v1.9.165: four additional existing-engine recipes; no new effect interpreter.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'halfLP',target:'opponent',amount:0}},'相手LPを半分にする（切り上げ）','et_builtin_s165_half_lp'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'selfSpecialFromHand',target:'self',amount:0}},'手札から自分を特殊召喚する','et_builtin_s165_special_self'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'draw',target:'self',amount:1,then:{operation:'heal',target:'self',amount:800}}},'1枚ドロー後にLP800回復','et_builtin_s165_draw_heal'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'damage',target:'opponent',amount:600,then:{operation:'heal',target:'self',amount:600}}},'相手へ600ダメージ＋自分を600回復','et_builtin_s165_drain_lp'),
 // v1.9.166: four validated recipes based on the existing effect engine.
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"boost","target":"ownAllMonsters","amount":400}},"全体ATK強化：自分全体＋400",'et_builtin_s166_boost_own_all'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"weaken","target":"enemyAllMonsters","amount":400}},"全体ATK弱体化：相手全体－400",'et_builtin_s166_weaken_enemy_all'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroy","target":"enemyAttackMonsters","amount":0}},"攻撃表示の相手モンスターを全破壊",'et_builtin_s166_destroy_attackers'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"banish","target":"enemyAllMonsters","amount":0}},"相手モンスターを全体除外",'et_builtin_s166_banish_all'),
 // v1.9.167: four validated recipes based on the existing effect engine.
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"returnBackrow","target":"enemyBackrow","amount":0}},"敵の魔法・罠を1枚手札へ戻す",'et_builtin_s167_bounce_backrow'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroyBackrow","target":"enemyAllBackrow","amount":0}},"相手の魔法・罠を全破壊",'et_builtin_s167_clear_backrows'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"banishBackrow","target":"enemyAllBackrow","amount":0}},"相手の魔法・罠をすべて除外",'et_builtin_s167_banish_backrows'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"returnBackrow","target":"ownBackrow","amount":0}},"自分の魔法・罠を1枚手札へ戻す",'et_builtin_s167_recover_backrow'),
 // v1.9.168: four validated recipes based on the existing effect engine.
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"searchNamed","target":"self","amount":1,"match":"exact","query":"ブラック・マジシャン"}},"ブラック・マジシャンを1枚探索",'et_builtin_s168_search_dm'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"summonNamedFromHand","target":"self","amount":0,"match":"exact","query":"青眼の白龍"}},"手札の青眼の白龍1体を特殊召喚",'et_builtin_s168_summon_blue'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"draw","target":"self","amount":2,"before":{"operation":"payLP","amount":800}}},"800LP払って2枚ドロー",'et_builtin_s168_pay_draw'),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"graveRecover","target":"self","amount":2,"before":{"operation":"discardOwnHand","amount":1}}},"1枚捨て墓地の新しい2枚を回収",'et_builtin_s168_discard_recover'),
 // v1.9.169: four validated recipes based on the existing effect engine.
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"battleDamage","operation":"draw","target":"self","amount":1}},"戦闘ダメージを与えると1枚ドロー",'et_builtin_s169_battle_draw'),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"battleDamage","operation":"discardNewest","target":"opponent","amount":1}},"戦闘ダメージを与えると相手の手札1枚を捨てる",'et_builtin_s169_battle_discard'),
 templateFromCard({"type":"trap","ability":{"when":"attack","operation":"negateWeakenAttacker","target":"attacker","amount":1200}},"攻撃を無効にして攻撃者のATKを1200下げる",'et_builtin_s169_weaken_attacker'),
 templateFromCard({"type":"spell","spellKind":"field","ability":{"when":"continuous","operation":"earthAura","target":"bothMonsters","amount":600,"attribute":"闇","defDecrease":300}},"闇のフィールド：ATK＋600／DEF－300",'et_builtin_s169_dark_field'),

 // v1.9.170: four summon-trigger recipes. All effects resolve synchronously.
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'draw',target:'self',amount:1}},'召喚成功時：カード1枚ドロー','et_builtin_s170_summon_draw'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'searchSpell',target:'self',amount:1}},'召喚成功時：デッキから魔法1枚サーチ','et_builtin_s170_summon_spell'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'weaken',target:'enemyMonster',amount:600}},'召喚成功時：相手1体のATK－600','et_builtin_s170_summon_weaken'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'heal',target:'self',amount:1000}},'召喚成功時：LP1000回復','et_builtin_s170_summon_heal'),
 // v1.9.171: costs reuse the existing validated payBefore path.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroy',target:'enemyMonster',amount:0,before:{operation:'sendOwnMonsterGrave',amount:1}}},'自分1体を墓地へ送り相手1体を破壊','et_builtin_s171_tribute_destroy'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveRevive',target:'self',amount:1,before:{operation:'discardOwnHand',amount:1}}},'手札1枚を捨てて墓地から1体蘇生','et_builtin_s171_discard_revival'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchTrap',target:'self',amount:1,before:{operation:'payLP',amount:500}}},'500LPを払いデッキから罠1枚サーチ','et_builtin_s171_lpcost_trapsearch'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'boost',target:'ownAllMonsters',amount:500,before:{operation:'sendOwnMonsterGrave',amount:1}}},'自分1体を墓地へ送り残り全体ATK＋500','et_builtin_s171_tribute_teamboost'),
 // v1.9.172: four distinct attack responses, no extra waiting step.
 templateFromCard({type:'trap',ability:{when:'attack',operation:'heal',target:'self',amount:1500}},'攻撃宣言に対応してLP1500回復','et_builtin_s172_attack_heal'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'returnHand',target:'attacker',amount:0}},'攻撃してきたモンスターを手札へ戻す','et_builtin_s172_attack_bounce'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'returnDeck',target:'attacker',amount:0}},'攻撃してきたモンスターをデッキへ戻す','et_builtin_s172_attack_deck'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'weaken',target:'attacker',amount:1000}},'攻撃してきたモンスターのATK－1000','et_builtin_s172_attack_weaken'),
 // v1.9.173: follow-up recipes reuse the bounded two-stage interpreter.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchMonster',target:'self',amount:1,then:{operation:'heal',target:'self',amount:500}}},'モンスター1枚サーチ後LP500回復','et_builtin_s173_search_heal'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroy',target:'enemyMonster',amount:0,then:{operation:'damage',target:'opponent',amount:700}}},'相手1体を破壊した後700ダメージ','et_builtin_s173_destroy_burn'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'mill',target:'opponent',amount:2,then:{operation:'draw',target:'self',amount:1}}},'相手デッキを2枚削り自分は1枚ドロー','et_builtin_s173_mill_draw'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'boost',target:'ownMonster',amount:500,then:{operation:'boostDef',target:'ownMonster',amount:500}}},'自分1体のATKとDEFを500強化','et_builtin_s173_boost_bothstats'),

 // v1.9.174: Four deterministic, validated recipe variants.
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"summon","operation":"searchTrap","target":"self","amount":1}},"召喚時：罠1枚をデッキから加える","et_builtin_s174_summon_trap"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"summon","operation":"graveRecover","target":"self","amount":1}},"召喚時：墓地の最新1枚を回収","et_builtin_s174_summon_recover"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"summon","operation":"boostDef","target":"ownAllMonsters","amount":400}},"召喚時：味方全体のDEFを400強化","et_builtin_s174_summon_def"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"summon","operation":"banish","target":"enemyMonster","amount":0}},"召喚時：相手モンスター1体を除外","et_builtin_s174_summon_banish"),
 // v1.9.175: Four deterministic, validated recipe variants.
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"graveRevive","target":"self","amount":1}},"起動効果：墓地のモンスター1体を蘇生","et_builtin_s175_ignition_revival"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"searchSpell","target":"self","amount":1}},"起動効果：デッキから魔法1枚を手札へ","et_builtin_s175_ignition_spellsearch"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"graveBanish","target":"opponent","amount":2}},"起動効果：相手墓地の最新2枚を除外","et_builtin_s175_ignition_gravebanish"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"destroyBackrow","target":"enemyBackrow","amount":0}},"起動効果：相手魔法・罠1枚を破壊","et_builtin_s175_ignition_backrow"),
 // v1.9.176: Four deterministic, validated recipe variants.
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"boostDef","target":"ownAllMonsters","amount":600}},"速攻：味方全体のDEFを600強化","et_builtin_s176_quick_def"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"changePosition","target":"enemyMonster","amount":0}},"速攻：相手1体の表示形式を変更","et_builtin_s176_quick_position"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"banishBackrow","target":"enemyBackrow","amount":0}},"速攻：相手魔法・罠1枚を除外","et_builtin_s176_quick_banish_backrow"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"damage","target":"opponent","amount":500}},"速攻：相手LPへ500ダメージ","et_builtin_s176_quick_burn"),
 // v1.9.177: Four deterministic, validated recipe variants.
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"searchSpell","target":"self","amount":1,"then":{"operation":"draw","target":"self","amount":1}}},"魔法1枚サーチ後に1枚ドロー","et_builtin_s177_spell_search_draw"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"banish","target":"enemyMonster","amount":0,"then":{"operation":"heal","target":"self","amount":700}}},"相手1体を除外した後LP700回復","et_builtin_s177_banish_heal"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"heal","target":"self","amount":900,"then":{"operation":"draw","target":"self","amount":1}}},"LP900回復できたら1枚ドロー","et_builtin_s177_heal_draw"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"graveRecover","target":"self","amount":1,"then":{"operation":"damage","target":"opponent","amount":400}}},"墓地1枚回収後に相手へ400ダメージ","et_builtin_s177_recover_burn"),
 // v1.9.178: Four independent recipes using only existing engine operations.
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"summon",operation:"searchMonster",target:"self",amount:1}},"召喚時：モンスター1枚をデッキから加える","et_builtin_s178_summon_search_monster"),
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"summon",operation:"destroyBackrow",target:"enemyBackrow",amount:0}},"召喚時：相手の魔法・罠1枚を破壊","et_builtin_s178_summon_destroy_backrow"),
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"summon",operation:"graveBanish",target:"opponent",amount:1}},"召喚時：相手墓地の最新1枚を除外","et_builtin_s178_summon_grave_banish"),
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"summon",operation:"boost",target:"ownAllMonsters",amount:400}},"召喚時：味方全体のATKを400強化","et_builtin_s178_summon_team_atk"),
 // v1.9.179: Four independent recipes using only existing engine operations.
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"main",operation:"searchTrap",target:"self",amount:1}},"起動効果：デッキから罠1枚サーチ","et_builtin_s179_ignition_search_trap"),
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"main",operation:"banishedRecover",target:"self",amount:1}},"起動効果：除外カードの最新1枚を回収","et_builtin_s179_ignition_recover_banished"),
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"main",operation:"returnHand",target:"enemyMonster",amount:0}},"起動効果：相手モンスター1体を手札へ","et_builtin_s179_ignition_bounce_enemy"),
 templateFromCard({type:"monster",subtype:"effect",ability:{when:"main",operation:"mill",target:"opponent",amount:3}},"起動効果：相手デッキを3枚削る","et_builtin_s179_ignition_mill_enemy"),
 // v1.9.180: Four independent recipes using only existing engine operations.
 templateFromCard({type:"spell",spellKind:"quick",ability:{when:"main",operation:"boost",target:"ownAllMonsters",amount:500}},"速攻：味方全体のATKを500強化","et_builtin_s180_quick_boost_all"),
 templateFromCard({type:"spell",spellKind:"quick",ability:{when:"main",operation:"weaken",target:"enemyAllMonsters",amount:300}},"速攻：相手全体のATKを300弱体化","et_builtin_s180_quick_weaken_all"),
 templateFromCard({type:"spell",spellKind:"quick",ability:{when:"main",operation:"returnHand",target:"enemyMonster",amount:0}},"速攻：相手モンスター1体を手札に戻す","et_builtin_s180_quick_bounce_enemy"),
 templateFromCard({type:"spell",spellKind:"quick",ability:{when:"main",operation:"lockAttack",target:"enemyMonster",amount:0}},"速攻：相手モンスター1体の攻撃を禁止","et_builtin_s180_quick_lock_enemy"),
 // v1.9.181: Four independent recipes using only existing engine operations.
 templateFromCard({type:"spell",spellKind:"normal",ability:{when:"main",operation:"searchTrap",target:"self",amount:1,then:{operation:"draw",target:"self",amount:1}}},"罠1枚を探索後に1枚ドロー","et_builtin_s181_trap_search_draw"),
 templateFromCard({type:"spell",spellKind:"normal",ability:{when:"main",operation:"graveRecover",target:"self",amount:1,then:{operation:"heal",target:"self",amount:800}}},"墓地の最新1枚回収後LP800回復","et_builtin_s181_grave_heal"),
 templateFromCard({type:"spell",spellKind:"normal",ability:{when:"main",operation:"damage",target:"opponent",amount:600,then:{operation:"draw",target:"self",amount:1}}},"600ダメージ後に自分は1枚ドロー","et_builtin_s181_damage_draw"),
 templateFromCard({type:"spell",spellKind:"normal",ability:{when:"main",operation:"banishBackrow",target:"enemyBackrow",amount:0,then:{operation:"draw",target:"self",amount:1}}},"相手の魔法・罠1枚を除外後ドロー","et_builtin_s181_banish_backrow_draw"),
 // v1.9.182: Cost-bearing utility recipes; costs are paid by the existing engine before activation.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchMonster',target:'self',amount:1,before:{operation:'discardOwnHand',amount:1}}},'手札1枚を捨ててモンスター1枚探索','et_builtin_s182_discard_search'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banish',target:'enemyMonster',amount:0,before:{operation:'payLP',amount:1000}}},'1000LP払って相手1体を除外','et_builtin_s182_pay_banish'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'draw',target:'self',amount:2,before:{operation:'banishOwnGrave',amount:1}}},'墓地1枚除外して2枚ドロー','et_builtin_s182_grave_draw'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroyBackrow',target:'enemyBackrow',amount:0,before:{operation:'returnOwnMonsterHand',amount:1}}},'味方1体を手札に戻して相手の魔法・罠破壊','et_builtin_s182_return_destroy'), // v1.9.183: Summon triggers require no modal picker; targets use the established leftmost rule.
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'returnHand',target:'enemyMonster',amount:0}},'召喚時：相手の左端モンスターを手札へ','et_builtin_s183_summon_bounce'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'banishBackrow',target:'enemyBackrow',amount:0}},'召喚時：相手の左端の魔法・罠を除外','et_builtin_s183_summon_banish_backrow'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'banishedRecover',target:'self',amount:1}},'召喚時：除外の最新1枚を手札に戻す','et_builtin_s183_summon_recover_banished'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'damage',target:'opponent',amount:500,then:{operation:'heal',target:'self',amount:500}}},'召喚時：相手に500ダメージ＋自身500回復','et_builtin_s183_summon_drain'), // v1.9.184: Quick spells use only the existing main/chain paths and automatic follow-ups.
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'destroyBackrow',target:'enemyBackrow',amount:0,before:{operation:'payLP',amount:500}}},'速攻：500LPで魔法・罠1枚を破壊','et_builtin_s184_quick_pay_break'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'returnBackrow',target:'ownBackrow',amount:0}},'速攻：自分の魔法・罠1枚を手札へ戻す','et_builtin_s184_quick_recover_backrow'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'banish',target:'enemyMonster',amount:0}},'速攻：相手モンスター1体を除外','et_builtin_s184_quick_banish_enemy'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'boostDef',target:'ownAllMonsters',amount:600,then:{operation:'heal',target:'self',amount:400}}},'速攻：味方全体DEF＋600とLP400回復','et_builtin_s184_quick_def_heal'), // v1.9.185: Distinctive tactical returns, recycling, effects and counterplay.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'returnDeck',target:'ownMonster',amount:0}},'自分モンスター1体をデッキへ戻す','et_builtin_s185_recycle_own_monster'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveRevive',target:'self',amount:1,then:{operation:'draw',target:'self',amount:1}}},'墓地のモンスター1体を蘇生し1枚ドロー','et_builtin_s185_revive_draw'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'returnDeck',target:'enemyMonster',amount:0}},'起動効果：相手モンスター1体をデッキへ戻す','et_builtin_s185_ignition_return_enemy'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'negateAttack',target:'none',amount:0,before:{operation:'discardOwnHand',amount:1}}},'攻撃時：手札1枚を捨てて攻撃を無効化','et_builtin_s185_discard_negate_attack'), // v1.9.186: tested safe recipe batch; reuse existing engine vocabulary.
 templateFromCard({type:'trap',ability:{when:'attack',operation:'damage',target:'opponent',amount:700}},'攻撃時：相手に700ダメージ','et_builtin_s186_attack_damage'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'heal',target:'self',amount:1200}},'攻撃時：自分LPを1200回復','et_builtin_s186_attack_heal'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'weaken',target:'attacker',amount:700}},'攻撃時：攻撃者のATKを700下げる','et_builtin_s186_attack_weaken'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'negateAttack',target:'none',amount:0,before:{operation:'payLP',amount:700}}},'攻撃時：700LP払って攻撃を無効化','et_builtin_s186_attack_pay_negate'),
 // v1.9.187: tested safe recipe batch; reuse existing engine vocabulary.
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'boost',target:'ownAllMonsters',amount:300}},'召喚時：味方モンスター全体ATK＋300','et_builtin_s187_summon_boost_all'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'heal',target:'self',amount:800}},'召喚時：自分LPを800回復','et_builtin_s187_summon_heal'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'weaken',target:'enemyAllMonsters',amount:300}},'召喚時：敵モンスター全体ATK－300','et_builtin_s187_summon_weaken_all'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'banishDeck',target:'opponent',amount:2}},'召喚時：相手デッキ上から2枚を除外','et_builtin_s187_summon_banish_deck'),
 // v1.9.188: tested safe recipe batch; reuse existing engine vocabulary.
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'draw',target:'self',amount:1,before:{operation:'discardOwnHand',amount:1}}},'起動：手札1枚を捨てて1枚ドロー','et_builtin_s188_ignition_discard_draw'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'sendGrave',target:'enemyMonster',amount:0}},'起動：相手1体を破壊せず墓地へ','et_builtin_s188_ignition_send_grave'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'changePosition',target:'enemyMonster',amount:0}},'起動：相手1体の表示形式を変更','et_builtin_s188_ignition_switch_position'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'graveRecover',target:'self',amount:1}},'起動：自分の墓地の最新1枚を回収','et_builtin_s188_ignition_recover'),
 // v1.9.189: tested safe recipe batch; reuse existing engine vocabulary.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'searchSpell',target:'self',amount:1,before:{operation:'discardOwnHand',amount:1}}},'手札1枚を捨てて魔法1枚探索','et_builtin_s189_spell_discard_search'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'graveRecycle',target:'self',amount:2,then:{operation:'draw',target:'self',amount:1}}},'墓地2枚をデッキに戻し1枚ドロー','et_builtin_s189_spell_recycle_draw'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'boost',target:'ownMonster',amount:800,then:{operation:'heal',target:'self',amount:300}}},'速攻：自分1体ATK＋800、LP300回復','et_builtin_s189_quick_boost_heal'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'lockEffect',target:'enemyMonster',amount:0}},'速攻：相手1体の起動効果を封じる','et_builtin_s189_quick_lock_effect'),
 // v1.9.190: stable, deterministic existing-engine effect recipes.
 templateFromCard({type:'trap',ability:{when:'attack',operation:'sendGrave',target:'attacker',amount:0}},'攻撃時：攻撃モンスターを破壊せず墓地へ','et_builtin_s190_attack_send_grave'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'changePosition',target:'attacker',amount:0}},'攻撃時：攻撃モンスターを守備表示へ','et_builtin_s190_attack_switch'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'boostDef',target:'ownAllMonsters',amount:600}},'攻撃時：自分モンスター全体のDEF＋600','et_builtin_s190_attack_def_team'),
 templateFromCard({type:'trap',ability:{when:'attack',operation:'weaken',target:'attacker',amount:500,then:{operation:'heal',target:'self',amount:400}}},'攻撃時：攻撃者ATK－500とLP400回復','et_builtin_s190_attack_weaken_heal'),
 // v1.9.191: stable, deterministic existing-engine effect recipes.
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'draw',target:'self',amount:2}},'召喚時：カードを2枚ドロー','et_builtin_s191_summon_draw_two'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'mill',target:'opponent',amount:3}},'召喚時：相手デッキ上3枚を墓地へ','et_builtin_s191_summon_mill_three'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'boostDef',target:'ownAllMonsters',amount:500}},'召喚時：味方全体のDEF＋500','et_builtin_s191_summon_def_team'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'summon',operation:'graveRecover',target:'self',amount:1,then:{operation:'heal',target:'self',amount:400}}},'召喚時：墓地の最新1枚回収とLP400回復','et_builtin_s191_summon_recover_heal'),
 // v1.9.192: stable, deterministic existing-engine effect recipes.
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'searchSpell',target:'self',amount:1,then:{operation:'heal',target:'self',amount:400}}},'起動：魔法1枚を探してLP400回復','et_builtin_s192_ignition_spell_heal'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'weakenDef',target:'enemyMonster',amount:700}},'起動：相手モンスター1体のDEF－700','et_builtin_s192_ignition_weaken_def'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'graveBanish',target:'opponent',amount:1,then:{operation:'heal',target:'self',amount:300}}},'起動：相手墓地の最新1枚を除外しLP300回復','et_builtin_s192_ignition_grave_banish_heal'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'boost',target:'ownMonster',amount:500,then:{operation:'draw',target:'self',amount:1}}},'起動：味方1体のATK＋500と1枚ドロー','et_builtin_s192_ignition_boost_draw'),
 // v1.9.193: stable, deterministic existing-engine effect recipes.
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'banishDeck',target:'opponent',amount:3}},'相手デッキ上3枚を除外','et_builtin_s193_spell_banish_deck'),
 templateFromCard({type:'spell',spellKind:'normal',ability:{when:'main',operation:'destroyBackrow',target:'enemyBackrow',amount:0,then:{operation:'heal',target:'self',amount:500}}},'相手魔法・罠1枚破壊とLP500回復','et_builtin_s193_spell_break_heal'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'returnDeck',target:'enemyMonster',amount:0}},'速攻：相手モンスター1体をデッキへ戻す','et_builtin_s193_quick_return_deck'),
 templateFromCard({type:'spell',spellKind:'quick',ability:{when:'main',operation:'banishedRecover',target:'self',amount:1,then:{operation:'heal',target:'self',amount:500}}},'速攻：除外カード1枚を回収しLP500回復','et_builtin_s193_quick_banished_heal'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'grave',operation:'searchMonster',target:'self',amount:1,filter:{atkMax:1500}}},'クリッター式：墓地に送られた時、ATK1500以下を手札へ','et_builtin_sangan_tree'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'grave',operation:'searchMonster',target:'self',amount:1,filter:{defMax:1500}}},'黒き森のウィッチ式：墓地へ送られた時、DEF1500以下を手札へ','et_builtin_witch_tree'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'destroyed',operation:'summonMonsterDeck',target:'self',amount:1,filter:{attribute:'地',atkMax:1500}}},'巨大ネズミ式：破壊された時、地属性ATK1500以下を特殊召喚','et_builtin_rat_tree'),
 templateFromCard({type:'monster',subtype:'effect',ability:{when:'main',operation:'coinBranch',target:'none',amount:0,heads:{operation:'destroy',target:'enemyAllMonsters',amount:0},tails:{operation:'damage',target:'self',amount:500}}},'時の魔術師式：表は相手全体破壊、裏は500LPダメージ','et_builtin_wizard_tree'),

 // v1.9.195: progressive tree effects; old presets remain unchanged.
 templateFromCard({"type":"monster","ability":{"when":"destroyed","operation":"summonMonsterDeck","target":"self","amount":1,"filter":{"attribute":"闇","atkMax":1500}},"subtype":"effect"},"キラー・トマト式：破壊時に闇属性ATK1500以下を特殊召喚","et_builtin_s195_dark_recruit"),
 templateFromCard({"type":"monster","ability":{"when":"destroyed","operation":"summonMonsterDeck","target":"self","amount":1,"filter":{"attribute":"光","atkMax":1500}},"subtype":"effect"},"シャインエンジェル式：破壊時に光属性ATK1500以下を特殊召喚","et_builtin_s195_light_recruit"),
 templateFromCard({"type":"monster","ability":{"when":"destroyed","operation":"summonMonsterDeck","target":"self","amount":1,"filter":{"race":"アンデット","defMax":2000}},"subtype":"effect"},"ピラミッド・タートル式：アンデット族DEF2000以下を特殊召喚","et_builtin_s195_zombie_recruit"),
 templateFromCard({"type":"monster","ability":{"when":"summon","operation":"searchMonster","target":"self","amount":1,"filter":{"race":"機械","levelMax":4}},"subtype":"effect"},"ガジェット式：召喚時に機械族レベル4以下をサーチ","et_builtin_s195_machine_search"),

 // v1.9.196: progressive tree effects; old presets remain unchanged.
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveRecover","target":"self","amount":1,"filter":{"race":"戦士"}},"spellKind":"normal"},"戦士の生還式：墓地の戦士族1体を回収","et_builtin_s196_warrior_recover"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveRevive","target":"self","amount":1,"filter":{"race":"ドラゴン","levelMin":5}},"spellKind":"normal"},"蘇生：墓地のレベル5以上ドラゴン族を特殊召喚","et_builtin_s196_dragon_revive"),
 templateFromCard({"type":"monster","ability":{"when":"flip","operation":"graveRecover","target":"self","amount":1,"filter":{"race":"魔法使い","atkMax":1500}},"subtype":"effect"},"リバース：墓地のATK1500以下魔法使い族を回収","et_builtin_s196_flip_mage_recover"),
 templateFromCard({"type":"monster","ability":{"when":"summon","operation":"graveRevive","target":"self","amount":1,"filter":{"race":"アンデット","levelMax":4}},"subtype":"effect"},"召喚時：墓地のレベル4以下アンデット族を蘇生","et_builtin_s196_summon_zombie_revive"),

 // v1.9.197: progressive tree effects; old presets remain unchanged.
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"searchMonster","target":"self","amount":1,"filter":{"attribute":"光"}},"tails":{"operation":"damage","target":"self","amount":500}},"subtype":"effect"},"分岐：表は光属性サーチ／裏は自分に500ダメージ","et_builtin_s197_coin_light_search"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"graveRevive","target":"self","amount":1,"filter":{"race":"戦士"}},"tails":{"operation":"damage","target":"self","amount":1000}},"subtype":"effect"},"分岐：表は戦士族を蘇生／裏は自分に1000ダメージ","et_builtin_s197_coin_warrior_revive"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"graveRecover","target":"self","amount":1,"filter":{"race":"魔法使い"}},"tails":{"operation":"mill","target":"opponent","amount":2}},"subtype":"effect"},"分岐：表は魔法使い族回収／裏は相手デッキ2枚墓地","et_builtin_s197_coin_mage_recover"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"searchMonster","target":"self","amount":1,"filter":{"levelMax":1}},"tails":{"operation":"heal","target":"self","amount":700}},"subtype":"effect"},"分岐：表はレベル1をサーチ／裏はLP700回復","et_builtin_s197_coin_low_search"),

 // v1.9.198: progressive tree effects; old presets remain unchanged.
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"searchMonster","target":"self","amount":1,"filter":{"attribute":"闇"},"then":{"operation":"heal","target":"self","amount":400}},"spellKind":"normal"},"闇属性サーチが成功したらLP400回復","et_builtin_s198_dark_search_heal"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveRevive","target":"self","amount":1,"filter":{"race":"ドラゴン"},"then":{"operation":"draw","target":"self","amount":1}},"spellKind":"normal"},"ドラゴン族を蘇生できたら1枚ドロー","et_builtin_s198_dragon_revive_draw"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":1,"then":{"operation":"graveRecover","target":"self","amount":1,"filter":{"race":"魔法使い"}}},"spellKind":"normal"},"1枚ドロー後、墓地の魔法使い族1体を回収","et_builtin_s198_draw_mage_recover"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":300,"then":{"operation":"searchMonster","target":"self","amount":1,"filter":{"attribute":"地","atkMin":1000}}},"spellKind":"normal"},"相手LPに300ダメージ後、地属性ATK1000以上を探索","et_builtin_s198_burn_earth_search"),

 // v1.9.199: reusable card-type and zone filters.
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveRecover","target":"self","amount":3,"filter":{"subtype":"normal","atkMax":1500}},"spellKind":"normal"},"補充要員式：通常・ATK1500以下を最大3枚回収","et_builtin_s199_normal_recover"),
 templateFromCard({"type":"monster","ability":{"when":"battleDamage","operation":"mill","target":"opponent","amount":1,"filter":{"cardType":"spell"}},"subtype":"effect"},"ヴァンパイア・ロード式：戦闘ダメージ時に相手の魔法を墓地へ","et_builtin_s199_vampire_mill"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveRevive","target":"self","amount":1,"filter":{"subtype":"normal"},"before":{"operation":"payLP","amount":800}},"spellKind":"normal"},"早すぎた埋葬式：800LPで通常モンスター蘇生","et_builtin_s199_burial_normal"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveBanish","target":"opponent","amount":2,"filter":{"cardType":"spell"}},"spellKind":"normal"},"墓地操作：相手墓地の魔法2枚を除外","et_builtin_s199_grave_spell_banish"),

 // v1.9.200: filtered group field effects.
 templateFromCard({"type":"trap","ability":{"when":"attack","operation":"destroy","target":"enemyAttackMonsters","amount":0,"filter":{"atkMin":1500}}},"ミラーフォース式：相手の攻撃表示・ATK1500以上を破壊","et_builtin_s200_mirror_atk"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"destroy","target":"bothMonsters","amount":0,"filter":{"levelMin":5}},"spellKind":"normal"},"ブラック・ホール式：お互いの表側レベル5以上を破壊","et_builtin_s200_hole_level"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"returnHand","target":"enemyAllMonsters","amount":0,"filter":{"levelMax":4}},"spellKind":"normal"},"ペンギン・ソルジャー式：相手の表側レベル4以下を手札へ","et_builtin_s200_penguin_return"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"boost","target":"ownAllMonsters","amount":500,"filter":{"race":"戦士"}},"spellKind":"normal"},"強化魔法式：自分の戦士族全体のATKを500上げる","et_builtin_s200_axe_boost"),

 // v1.9.201: bounded, deterministic field auto-selection.
 templateFromCard({"type":"monster","ability":{"when":"flip","operation":"returnHand","target":"enemyAllMonsters","amount":0,"filter":{"maxCount":2}},"subtype":"effect"},"ペンギン・ソルジャー式：リバース時に表側最大2体を戻す","et_builtin_s201_penguin_flip"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"maxCount":1,"order":"atkLow"}},"spellKind":"normal"},"地割れ式：元々のATK最低の表側1体を破壊","et_builtin_s201_fissure_printed"),
 templateFromCard({"type":"monster","ability":{"when":"summon","operation":"lockAttack","target":"enemyAllMonsters","amount":0,"filter":{"maxCount":1,"order":"atkHigh"}},"subtype":"effect"},"ルシファー式：召喚時に相手のATK最高1体の攻撃を封じる","et_builtin_s201_lucifer_lock"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"banish","target":"enemyAllMonsters","amount":0,"filter":{"maxCount":2,"order":"defHigh"}},"tails":{"operation":"destroy","target":"ownAllMonsters","amount":0,"filter":{"maxCount":1,"order":"atkHigh"}}},"subtype":"effect"},"時の魔術師式：表DEF上位2体除外／裏ATK上位1体破壊","et_builtin_s201_coin_top_two"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"searchSpell","target":"self","amount":1,"filter":{"cardType":"spell","spellKind":"fusion","nameContains":"融合"}},"spellKind":"normal"},"融合賢者式：名前に融合を含む融合魔法をサーチ","et_builtin_s202_fusion_search"),
 templateFromCard({"type":"monster","ability":{"when":"summon","operation":"searchSpell","target":"self","amount":1,"filter":{"cardType":"spell","spellKind":"ritual"}},"subtype":"effect"},"ソニックバード式：召喚時に儀式魔法をサーチ","et_builtin_s202_ritual_search"),
 templateFromCard({"type":"monster","ability":{"when":"flip","operation":"graveRecover","target":"self","amount":1,"filter":{"cardType":"spell","spellKind":"quick"}},"subtype":"effect"},"聖なる魔術師式：リバース時に速攻魔法を回収","et_builtin_s202_spell_recovery"),
 templateFromCard({"type":"monster","ability":{"when":"grave","operation":"searchTrap","target":"self","amount":1,"filter":{"cardType":"trap","nameContains":"魔法"}},"subtype":"effect"},"クリッター式応用：墓地送り時に名前指定の罠をサーチ","et_builtin_s202_trap_search"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":3,"then":{"operation":"discardNewest","target":"self","amount":2,"filter":{"cardType":"monster"}}},"spellKind":"normal"},"天使の施し式：3枚ドロー後にモンスターを最大2枚捨てる","et_builtin_s203_graceful_filtered"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"discardNewest","target":"self","amount":2,"filter":{"cardType":"spell"},"then":{"operation":"draw","target":"self","amount":2}},"spellKind":"normal"},"手札抹殺式応用：魔法を最大2枚捨て、成功時に2枚ドロー","et_builtin_s203_hand_exchange"),
 templateFromCard({"type":"monster","ability":{"when":"summon","operation":"searchMonster","target":"self","amount":1,"filter":{"summonKind":"ritual"}},"subtype":"effect"},"センジュ・ゴッド式：召喚時に儀式モンスターをサーチ","et_builtin_s203_senju_search"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveRevive","target":"self","amount":1,"filter":{"summonKind":"normal"},"before":{"operation":"payLP","amount":800}},"spellKind":"normal"},"早すぎた埋葬式：通常召喚可能なモンスターを800LPで蘇生","et_builtin_s203_burial_normal_kind"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"summonMonsterHand","target":"self","amount":2,"filter":{"race":"ドラゴン"}},"spellKind":"normal"},"ドラゴンを呼ぶ笛式応用：手札のドラゴン族を最大2体特殊召喚","et_builtin_s204_flute_dragon"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"summonMonsterHand","target":"self","amount":1,"filter":{"levelMin":5,"subtype":"normal"}},"spellKind":"normal"},"古のルール式：手札のレベル5以上の通常モンスターを特殊召喚","et_builtin_s204_ancient_rules"),
 templateFromCard({"type":"monster","ability":{"when":"destroyed","operation":"summonMonsterDeck","target":"self","amount":1,"filter":{"attribute":"地","atkMax":1500,"summonPosition":"def"}},"subtype":"effect"},"巨大ネズミ式応用：地属性ATK1500以下を守備で召喚","et_builtin_s204_rat_def"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"graveRevive","target":"self","amount":1,"filter":{"summonPosition":"def"}},"spellKind":"normal"},"死者蘇生式応用：自分の墓地から守備表示で蘇生","et_builtin_s204_reborn_def"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":2,"then":{"operation":"banishOwnHand","target":"self","amount":1,"filter":{"attribute":"闇"}}},"spellKind":"normal"},"天使の施し式応用：2枚ドロー後に闇属性1枚除外","et_builtin_s205_graceful_banish"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"returnOwnHandToDeck","target":"self","amount":2,"filter":{"cardType":"spell","deckPlacement":"bottom"},"then":{"operation":"draw","target":"self","amount":2}},"spellKind":"normal"},"手札抹殺式応用：魔法を2枚までデッキ下へ戻す","et_builtin_s205_exchange_return"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"heal","target":"self","amount":500},"tails":{"operation":"returnOwnHandToDeck","target":"self","amount":1,"filter":{"cardType":"monster","deckPlacement":"top"}}},"subtype":"effect"},"時の魔術師式応用：表は回復・裏は手札をデッキ上へ","et_builtin_s205_wizard_return"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"banishOwnHand","target":"self","amount":1,"filter":{"cardType":"trap"},"then":{"operation":"searchSpell","target":"self","amount":1,"filter":{"cardType":"spell","spellKind":"fusion"}}},"spellKind":"normal"},"融合賢者式応用：罠を除外後に融合魔法をサーチ","et_builtin_s205_recycle_search"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"def","maxCount":1}},"spellKind":"normal"},"シールドクラッシュ式応用：表側守備表示1体を破壊","et_builtin_s206_shield_crush"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"banish","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"set","maxCount":1}},"spellKind":"normal"},"抹殺の使徒式応用：裏側守備表示1体を除外（同名除外なし）","et_builtin_s206_nobleman"),
 templateFromCard({"type":"trap","ability":{"when":"attack","operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"atk","atkMin":1800}}},"ミラーフォース式応用：ATK1800以上の攻撃表示を破壊","et_builtin_s206_mirror"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"def"}},"tails":{"operation":"destroy","target":"ownAllMonsters","amount":0,"filter":{"fieldPosition":"atk"}}},"subtype":"effect"},"時の魔術師式応用：表は守備表示破壊・裏は自分の攻撃表示破壊","et_builtin_s206_wizard"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":2,"requirement":{"zone":"ownField","kind":"all","comparison":"equal","count":0}},"spellKind":"normal"},"強欲な壺式応用：自分の場にモンスターがいない時2枚ドロー","et_builtin_s207_pot_empty"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":1000,"requirement":{"zone":"ownGrave","kind":"monster","comparison":"atLeast","count":5}},"spellKind":"normal"},"補充要員式応用：自分の墓地にモンスター5体以上で1000回復","et_builtin_s207_reinforce_grave"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":800,"requirement":{"zone":"enemyField","kind":"atk","comparison":"atLeast","count":2}},"spellKind":"normal"},"仕込みマシンガン式応用：相手の攻撃表示2体以上で800ダメージ","et_builtin_s207_burn_attack"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"requirement":{"zone":"bothGrave","kind":"spell","comparison":"atLeast","count":3}},"subtype":"effect"},"聖なる魔術師式応用：双方の墓地の魔法3枚以上で1枚ドロー","et_builtin_s207_magician_grave"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"damage","target":"opponent","amount":800,"before":{"operation":"banishOwnGrave","amount":1,"filter":{"race":"悪魔"}}},"subtype":"effect"},"ネクロフィア式応用：悪魔族1体を除外し800ダメージ","et_builtin_s208_necrofear_cost"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":2,"before":{"operation":"recycleOwnGrave","amount":3,"filter":{"cardType":"monster","subtype":"normal"}}},"spellKind":"normal"},"貪欲な壺式応用：通常モンスター3体を戻して2枚ドロー","et_builtin_s208_avarice_cost"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":1000,"before":{"operation":"banishOwnGrave","amount":2,"filter":{"attribute":"光"}}},"spellKind":"normal"},"魂の解放式応用：墓地の光属性2体を除外して1000回復","et_builtin_s208_release_cost"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"before":{"operation":"recycleOwnGrave","amount":1,"filter":{"cardType":"spell","spellKind":"normal"}}},"subtype":"effect"},"聖なる魔術師式応用：通常魔法1枚を戻して1枚ドロー","et_builtin_s208_magician_cost"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":2,"before":{"operation":"discardOwnHand","amount":1,"filter":{"cardType":"spell"}}},"spellKind":"normal"},"魔法石の採掘式応用：手札の魔法1枚を捨てて2枚ドロー","et_builtin_s209_spell_discard"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"damage","target":"opponent","amount":700,"before":{"operation":"discardOwnHand","amount":1,"filter":{"race":"ドラゴン"}}},"subtype":"effect"},"竜の尖兵式応用：ドラゴン族を捨てて700ダメージ","et_builtin_s209_dragon_discard"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":900,"before":{"operation":"discardOwnHand","amount":2,"filter":{"attribute":"光"}}},"spellKind":"normal"},"天使の施し式応用：光属性2枚を捨てて900回復","et_builtin_s209_light_discard"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"before":{"operation":"returnOwnHandDeck","amount":1,"filter":{"cardType":"trap"}}},"subtype":"effect"},"手札交換式応用：罠1枚をデッキに戻して1枚ドロー","et_builtin_s209_trap_return"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":500,"before":{"operation":"sendOwnMonsterGrave","amount":1,"filter":{"race":"戦士"}}},"spellKind":"normal"},"キャノン式：戦士族1体を墓地へ送り500ダメージ","et_builtin_s210_warrior_send"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"heal","target":"self","amount":800,"before":{"operation":"banishOwnMonster","amount":1,"filter":{"attribute":"光","fieldPosition":"def"}}},"subtype":"effect"},"魂の解放式：光の守備表示1体を除外し800回復","et_builtin_s210_light_def"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":2,"before":{"operation":"returnOwnMonsterHand","amount":1,"filter":{"race":"ドラゴン","levelMin":5}}},"spellKind":"normal"},"脱出式：Lv5以上のドラゴン族を戻し2枚ドロー","et_builtin_s210_dragon_return"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"before":{"operation":"returnOwnMonsterDeck","amount":2,"filter":{"atkMax":1500,"fieldPosition":"atk"}}},"subtype":"effect"},"貪欲式：ATK1500以下攻撃表示2体を戻し1ドロー","et_builtin_s210_atk_return"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":1,"requirement":{"zone":"ownField","kind":"faceup","comparison":"atLeast","count":2,"filter":{"race":"ドラゴン"}}},"spellKind":"normal"},"ドラゴン族が2体以上なら1枚ドロー","et_builtin_s211_dragon_field"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"damage","target":"opponent","amount":600,"requirement":{"zone":"enemyField","kind":"atk","comparison":"atLeast","count":1,"filter":{"atkMin":2000}}},"subtype":"effect"},"相手のATK2000以上の攻撃表示で600ダメージ","et_builtin_s211_atk_condition"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":800,"requirement":{"zone":"ownGrave","kind":"monster","comparison":"atLeast","count":3,"filter":{"attribute":"闇"}}},"spellKind":"normal"},"墓地に闇属性3体以上なら800回復","et_builtin_s211_dark_grave"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"requirement":{"zone":"bothGrave","kind":"spell","comparison":"atLeast","count":2,"filter":{"cardType":"spell","spellKind":"quick"}}},"subtype":"effect"},"双方の墓地に速攻魔法2枚以上で1枚ドロー","et_builtin_s211_quick_grave"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":2,"before":{"operation":"sendOwnBackrowGrave","amount":1,"filter":{"cardType":"spell","spellKind":"equip"}}},"spellKind":"normal"},"装備解除式：表側装備魔法を墓地へ送り2枚ドロー","et_builtin_s212_equip_send"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"damage","target":"opponent","amount":900,"before":{"operation":"banishOwnBackrow","amount":1,"filter":{"cardType":"spell","spellKind":"continuous"}}},"subtype":"effect"},"永続魔法を除外して900ダメージ","et_builtin_s212_continuous_banish"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":1200,"before":{"operation":"sendOwnBackrowGrave","amount":2,"filter":{"cardType":"trap"}}},"spellKind":"normal"},"表側罠2枚を墓地へ送り1200回復","et_builtin_s212_trap_send"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"before":{"operation":"banishOwnBackrow","amount":1,"filter":{"cardType":"trap","nameContains":"六芒星"}}},"subtype":"effect"},"表側の六芒星罠を除外して1枚ドロー","et_builtin_s212_named_banish"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":2,"before":{"operation":"payLP","amount":500},"requirement":{"zone":"ownGrave","kind":"all","comparison":"atLeast","count":3}},"spellKind":"normal"},"墓地3枚以上で500LPを払い2枚ドロー","et_builtin_s213_grave_lp"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"heal","target":"self","amount":700,"before":{"operation":"banishOwnGrave","amount":1,"filter":{"attribute":"闇"}},"requirement":{"zone":"ownGrave","kind":"monster","comparison":"atLeast","count":2,"filter":{"attribute":"闇"}}},"subtype":"effect"},"闇属性2体以上なら墓地の闇1体を除外し700回復","et_builtin_s213_dark_spend"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":800,"before":{"operation":"discardOwnHand","amount":1,"filter":{"cardType":"spell"}},"requirement":{"zone":"enemyField","kind":"all","comparison":"atLeast","count":2}},"spellKind":"normal"},"相手の場2体以上なら手札の魔法を捨て800ダメージ","et_builtin_s213_field_hand"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"before":{"operation":"sendOwnMonsterGrave","amount":1,"filter":{"race":"戦士"}},"requirement":{"zone":"ownField","kind":"faceup","comparison":"atLeast","count":2,"filter":{"race":"戦士"}},"then":{"operation":"heal","target":"self","amount":300}},"subtype":"effect"},"戦士族2体以上なら1体を墓地へ送り1ドロー","et_builtin_s213_own_tribute"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":3000},"heads":{"operation":"heal","target":"self","amount":1000},"tails":{"operation":"damage","target":"opponent","amount":500}}},"LP3000以下で回復、そうでなければダメージ","et_builtin_s214_low_lp"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"relativeLP","kind":"lp","comparison":"atMost","count":-1},"heads":{"operation":"draw","target":"self","amount":1},"tails":{"operation":"heal","target":"self","amount":500}}},"相手よりLPが低ければドロー、他は回復","et_builtin_s214_relative_lp"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyField","kind":"all","comparison":"atLeast","count":2},"heads":{"operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"atk","maxCount":1}},"tails":{"operation":"draw","target":"self","amount":1}}},"相手が2体以上なら攻撃表示破壊、他はドロー","et_builtin_s214_enemy_field"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownGrave","kind":"spell","comparison":"atLeast","count":1},"heads":{"operation":"graveRecover","target":"self","amount":1,"filter":{"cardType":"spell"}},"tails":{"operation":"searchSpell","target":"self","amount":1,"filter":{"cardType":"spell","spellKind":"normal"}}}},"墓地に魔法があれば回収、なければサーチ","et_builtin_s214_grave_spell"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownHand","kind":"all","comparison":"equal","count":0},"heads":{"operation":"draw","target":"self","amount":2},"tails":{"operation":"heal","target":"self","amount":500}}},"手札0枚なら2ドロー、他は500回復","et_builtin_s215_empty_hand"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyHand","kind":"all","comparison":"atLeast","count":4},"heads":{"operation":"damage","target":"opponent","amount":800},"tails":{"operation":"draw","target":"self","amount":1}}},"相手手札4枚以上なら800ダメージ、他は1ドロー","et_builtin_s215_enemy_hand"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownDeck","kind":"all","comparison":"atMost","count":5},"heads":{"operation":"graveRecover","target":"self","amount":1},"tails":{"operation":"draw","target":"self","amount":1}}},"デッキ5枚以下なら墓地回収、他は1ドロー","et_builtin_s215_low_deck"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"bothDeck","kind":"all","comparison":"atMost","count":20},"heads":{"operation":"heal","target":"self","amount":1000},"tails":{"operation":"damage","target":"opponent","amount":500}}},"双方デッキ20枚以下なら1000回復、他は500ダメージ","et_builtin_s215_both_deck"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyBackrow","kind":"set","comparison":"atLeast","count":2},"heads":{"operation":"damage","target":"opponent","amount":800},"tails":{"operation":"draw","target":"self","amount":1}}},"相手のセット2枚以上なら800ダメージ、他は1ドロー","et_builtin_s216_enemy_set"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownBackrow","kind":"spell","comparison":"atLeast","count":2},"heads":{"operation":"draw","target":"self","amount":2},"tails":{"operation":"heal","target":"self","amount":400}}},"自分の表側魔法2枚以上なら2ドロー、他は400回復","et_builtin_s216_own_spell"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"bothBackrow","kind":"trap","comparison":"atLeast","count":1},"heads":{"operation":"heal","target":"self","amount":700},"tails":{"operation":"damage","target":"opponent","amount":300}}},"双方の表側罠1枚以上なら700回復、他は300ダメージ","et_builtin_s216_both_trap"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyBackrow","kind":"all","comparison":"equal","count":0},"heads":{"operation":"damage","target":"opponent","amount":1000},"tails":{"operation":"heal","target":"self","amount":500}}},"相手の魔法罠ゾーン0枚なら1000ダメージ、他は500回復","et_builtin_s216_no_backrow"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":1,"requirement":{"zone":"ownHand","kind":"all","comparison":"atMost","count":3},"before":{"operation":"payLP","amount":500},"then":{"operation":"heal","target":"self","amount":500}},"spellKind":"normal"},"手札3枚以下なら500LPを払い1ドローし500回復","et_builtin_s217_hand_lp"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"heal","target":"self","amount":600,"requirement":{"zone":"ownDeck","kind":"all","comparison":"atMost","count":10},"before":{"operation":"recycleOwnGrave","amount":1,"filter":{"cardType":"spell"}},"then":{"operation":"draw","target":"self","amount":1}},"subtype":"effect"},"残り10枚以下・墓地魔法を戻して回復とドロー","et_builtin_s217_deck_grave"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":800,"requirement":{"zone":"enemyBackrow","kind":"set","comparison":"atLeast","count":2},"before":{"operation":"discardOwnHand","amount":1,"filter":{"cardType":"spell"}},"then":{"operation":"heal","target":"self","amount":400}},"spellKind":"normal"},"相手セット2枚以上・魔法を捨てダメージと回復","et_builtin_s217_backrow_cost"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"requirement":{"zone":"ownBackrow","kind":"spell","comparison":"atLeast","count":1},"before":{"operation":"sendOwnBackrowGrave","amount":1,"filter":{"cardType":"spell","spellKind":"equip"}},"then":{"operation":"heal","target":"self","amount":300}},"subtype":"effect"},"表側魔法あり・装備を墓地へ送りドローと回復","et_builtin_s217_public_cost"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":200,"scale":{"zone":"enemyHand","kind":"all"}},"spellKind":"normal"},"仕込みマシンガン式：相手手札×200ダメージ","et_builtin_s218_burn_hand"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":300,"scale":{"zone":"bothField","kind":"faceup"}},"spellKind":"normal"},"ホーリー・エルフ式：場の表側×300回復","et_builtin_s218_heal_field"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"boost","target":"ownAllMonsters","amount":300,"scale":{"zone":"ownGrave","kind":"monster","filter":{"race":"ドラゴン"}},"filter":{"race":"ドラゴン"}},"spellKind":"normal"},"ドラゴン族の墓地枚数×300全体強化","et_builtin_s218_dragon_boost"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"weaken","target":"enemyAllMonsters","amount":200,"scale":{"zone":"enemyBackrow","kind":"set"}},"spellKind":"normal"},"魔法罠のセット数×200全体弱体化","et_builtin_s218_weaken_backrow"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"damage","target":"opponent","amount":300,"scale":{"zone":"enemyHand","kind":"all"}},"tails":{"operation":"damage","target":"self","amount":200,"scale":{"zone":"ownGrave","kind":"monster"}}},"subtype":"effect"},"時の魔術師式：表は相手手札×300、裏は自分墓地×200","et_builtin_s219_coin_counts"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":3000},"heads":{"operation":"heal","target":"self","amount":400,"scale":{"zone":"bothField","kind":"faceup"}},"tails":{"operation":"damage","target":"opponent","amount":200,"scale":{"zone":"enemyHand","kind":"all"}}},"subtype":"effect"},"低LPなら場の数で回復、他は相手手札でダメージ","et_builtin_s219_lp_counts"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"draw","target":"self","amount":1,"then":{"operation":"damage","target":"opponent","amount":100,"scale":{"zone":"ownHand","kind":"all"}}},"spellKind":"normal"},"ドロー後、自分の手札枚数×100ダメージ","et_builtin_s219_draw_scale"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"discardNewest","target":"self","amount":1,"filter":{"cardType":"spell"},"then":{"operation":"heal","target":"self","amount":300,"scale":{"zone":"ownGrave","kind":"spell"}}},"spellKind":"normal"},"手札を捨てた後、墓地の魔法枚数×300回復","et_builtin_s219_discard_scale"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":3000},"requirement2":{"zone":"ownHand","kind":"all","comparison":"equal","count":0}},"subtype":"effect"},"低LPかつ手札0枚なら1ドロー","et_builtin_s220_low_empty"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":800,"requirement":{"zone":"ownField","kind":"faceup","comparison":"atLeast","count":1,"filter":{"race":"ドラゴン"}},"requirement2":{"zone":"ownGrave","kind":"spell","comparison":"atLeast","count":1}},"spellKind":"normal"},"場のドラゴンと墓地の魔法があれば800回復","et_builtin_s220_dragon_grave"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyField","kind":"all","comparison":"atLeast","count":2},"requirement2":{"zone":"enemyHand","kind":"all","comparison":"atLeast","count":3},"heads":{"operation":"damage","target":"opponent","amount":200,"scale":{"zone":"enemyHand","kind":"all"}},"tails":{"operation":"heal","target":"self","amount":400}},"subtype":"effect"},"相手の場と手札が多い場合だけダメージ分岐","et_builtin_s220_double_branch"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":1000,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":3000},"requirement2":{"zone":"ownGrave","kind":"monster","comparison":"atLeast","count":2},"before":{"operation":"payLP","amount":500},"then":{"operation":"draw","target":"self","amount":1}},"spellKind":"normal"},"LPと墓地の条件を満たし500LPで回復・ドロー","et_builtin_s220_double_cost"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":200,"scale":{"zone":"ownBanished","kind":"all"}},"spellKind":"normal"},"除外された自分のカード数×200ダメージ","et_builtin_s221_banished_damage"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"heal","target":"self","amount":300,"scale":{"zone":"enemyBanished","kind":"spell"}},"spellKind":"normal"},"相手の除外魔法数×300回復","et_builtin_s221_banished_heal"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"boost","target":"ownAllMonsters","amount":250,"scale":{"zone":"bothBanished","kind":"monster","filter":{"race":"ドラゴン"}}},"subtype":"effect"},"双方の除外ドラゴン族数×250 ATK強化","et_builtin_s221_banished_boost"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownBanished","kind":"all","comparison":"atLeast","count":2},"heads":{"operation":"banishedRecover","target":"self","amount":1},"tails":{"operation":"draw","target":"self","amount":1}},"subtype":"effect"},"自分の除外カード2枚以上なら回収・それ以外はドロー","et_builtin_s221_banished_branch"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"draw","target":"self","amount":1,"then":{"operation":"damage","target":"opponent","amount":400}},"tails":{"operation":"heal","target":"self","amount":500,"then":{"operation":"searchMonster","target":"self","amount":1,"filter":{"race":"ドラゴン"}}}},"subtype":"effect"},"表はドロー成功後にダメージ・裏は回復成功後にサーチ","et_builtin_s222_coin_draw_damage"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"graveBanish","target":"self","amount":1,"filter":{"cardType":"spell"},"then":{"operation":"damage","target":"opponent","amount":250,"scale":{"zone":"ownBanished","kind":"all"}}},"tails":{"operation":"banishedRecover","target":"self","amount":1,"filter":{"cardType":"spell"},"then":{"operation":"heal","target":"self","amount":600}}},"subtype":"effect"},"表は墓地除外後に枚数ダメージ・裏は除外回収後に回復","et_builtin_s222_coin_banish_recover"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":3000},"heads":{"operation":"heal","target":"self","amount":800,"then":{"operation":"draw","target":"self","amount":1}},"tails":{"operation":"damage","target":"opponent","amount":500,"then":{"operation":"banishOwnHand","target":"self","amount":1,"filter":{"cardType":"monster"}}}},"subtype":"effect"},"低LPなら回復後にドロー・それ以外はダメージ後に手札除外","et_builtin_s222_lp_branch"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownBanished","kind":"all","comparison":"atLeast","count":2},"heads":{"operation":"banishedRecover","target":"self","amount":1,"then":{"operation":"boost","target":"ownAllMonsters","amount":200,"scale":{"zone":"ownBanished","kind":"all"}}},"tails":{"operation":"banishDeck","target":"self","amount":1,"then":{"operation":"heal","target":"self","amount":300,"scale":{"zone":"ownBanished","kind":"all"}}}},"subtype":"effect"},"除外2枚以上なら回収後に強化・それ以外はデッキ除外後に回復","et_builtin_s222_banished_branch"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"draw","target":"self","amount":1,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":2500},"requirement2":{"zone":"ownHand","kind":"all","comparison":"equal","count":0},"requirementMode":"or"},"subtype":"effect"},"低LPまたは手札0枚なら1ドロー","et_builtin_s223_or_draw"),
 templateFromCard({"type":"spell","ability":{"when":"main","operation":"damage","target":"opponent","amount":700,"requirement":{"zone":"ownGrave","kind":"spell","comparison":"atLeast","count":1},"requirement2":{"zone":"ownBanished","kind":"monster","comparison":"atLeast","count":2},"requirementMode":"or","before":{"operation":"payLP","amount":500}},"spellKind":"normal"},"墓地魔法または除外モンスターがあればLPを払ってダメージ","et_builtin_s223_or_cost"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyHand","kind":"all","comparison":"atLeast","count":3},"requirement2":{"zone":"enemyField","kind":"faceup","comparison":"atLeast","count":2},"requirementMode":"or","heads":{"operation":"damage","target":"opponent","amount":300,"then":{"operation":"heal","target":"self","amount":200}},"tails":{"operation":"heal","target":"self","amount":600}},"subtype":"effect"},"相手の手札・場のどちらかが多ければダメージ、他は回復","et_builtin_s223_or_branch"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownGrave","kind":"spell","comparison":"atLeast","count":1},"requirement2":{"zone":"ownBanished","kind":"spell","comparison":"atLeast","count":1},"requirementMode":"or","heads":{"operation":"heal","target":"self","amount":300,"then":{"operation":"banishedRecover","target":"self","amount":1,"filter":{"cardType":"spell"}}},"tails":{"operation":"draw","target":"self","amount":1,"then":{"operation":"damage","target":"opponent","amount":100,"scale":{"zone":"ownHand","kind":"all"}}}},"subtype":"effect"},"墓地または除外に魔法があれば回復後に魔法回収分岐","et_builtin_s223_or_recover"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyField","kind":"all","comparison":"atLeast","count":1},"heads":{"operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"atk","maxCount":2},"then":{"operation":"draw","target":"self","amount":1}},"tails":{"operation":"heal","target":"self","amount":100}}},"攻撃表示を破壊後ドロー","et_builtin_s224_destroy_draw"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyField","kind":"all","comparison":"atLeast","count":1},"heads":{"operation":"banish","target":"enemyAllMonsters","amount":0,"filter":{"attribute":"闇","maxCount":2},"then":{"operation":"heal","target":"self","amount":600}},"tails":{"operation":"heal","target":"self","amount":100}}},"闇属性を除外後回復","et_builtin_s224_banish_heal"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyField","kind":"all","comparison":"atLeast","count":1},"heads":{"operation":"sendGrave","target":"enemyAllMonsters","amount":0,"filter":{"race":"ドラゴン","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":500}},"tails":{"operation":"heal","target":"self","amount":100}}},"ドラゴン族を墓地へ送った後ダメージ","et_builtin_s224_grave_damage"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyField","kind":"all","comparison":"atLeast","count":1},"heads":{"operation":"returnHand","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"def","maxCount":2},"then":{"operation":"draw","target":"self","amount":1}},"tails":{"operation":"heal","target":"self","amount":100}}},"守備表示を手札へ戻した後ドロー","et_builtin_s224_bounce_draw"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyLP","kind":"lp","comparison":"atLeast","count":1},"heads":{"operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"atk","maxCount":3},"then":{"operation":"damage","target":"opponent","amount":400,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"heal","target":"self","amount":100}}},"攻撃表示の破壊数×400ダメージ","et_builtin_s225_destroy_count"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"banish","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":3},"then":{"operation":"heal","target":"self","amount":300,"scale":{"zone":"previousMoved","kind":"all"}}}},"場の除外数×300回復","et_builtin_s225_banish_count"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"graveBanish","target":"self","amount":3,"filter":{"cardType":"monster","race":"ドラゴン"},"then":{"operation":"damage","target":"opponent","amount":500,"scale":{"zone":"previousMoved","kind":"all"}}}},"墓地ドラゴン族の除外数×500ダメージ","et_builtin_s225_grave_count"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyLP","kind":"lp","comparison":"atLeast","count":1},"heads":{"operation":"mill","target":"opponent","amount":3,"then":{"operation":"heal","target":"self","amount":200,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"heal","target":"self","amount":100}}},"デッキから墓地へ送った枚数×200回復","et_builtin_s225_mill_count"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyLP","kind":"lp","comparison":"atLeast","count":1},"heads":{"operation":"destroyBackrow","target":"enemyAllBackrow","amount":0,"filter":{"fieldPosition":"set","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":300,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"heal","target":"self","amount":100}}},"セット魔法・罠の破壊枚数×300ダメージ","et_builtin_s226_backrow_destroy"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"banishBackrow","target":"bothAllBackrow","amount":0,"filter":{"cardType":"spell","spellKind":"continuous","maxCount":3},"then":{"operation":"heal","target":"self","amount":400,"scale":{"zone":"previousMoved","kind":"all"}}}},"表側永続魔法を除外した枚数×400回復","et_builtin_s226_backrow_banish"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyLP","kind":"lp","comparison":"atLeast","count":1},"heads":{"operation":"returnBackrow","target":"enemyAllBackrow","amount":0,"filter":{"cardType":"trap","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":200,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"heal","target":"self","amount":100}}},"表側罠を戻した枚数×200ダメージ","et_builtin_s226_backrow_return"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"enemyLP","kind":"lp","comparison":"atLeast","count":1},"heads":{"operation":"destroyBackrow","target":"bothAllBackrow","amount":0,"filter":{"cardType":"spell","spellKind":"field"},"then":{"operation":"draw","target":"self","amount":1}},"tails":{"operation":"heal","target":"self","amount":100}}},"双方のフィールド魔法破壊後にドロー","et_builtin_s226_backrow_field"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"summonMonsterHand","target":"self","amount":2,"filter":{"race":"ドラゴン","summonPosition":"def"},"then":{"operation":"heal","target":"self","amount":500,"scale":{"zone":"previousMoved","kind":"all"}}}},"手札から特殊召喚した体数×500回復","et_builtin_s227_hand_summon"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"summonMonsterDeck","target":"self","amount":2,"filter":{"attribute":"地","atkMax":1500},"then":{"operation":"damage","target":"opponent","amount":350,"scale":{"zone":"previousMoved","kind":"all"}}}},"デッキから特殊召喚した体数×350ダメージ","et_builtin_s227_deck_summon"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"graveRevive","target":"self","amount":3,"filter":{"race":"ドラゴン"},"then":{"operation":"heal","target":"self","amount":400,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"summonMonsterDeck","target":"self","amount":1,"filter":{"levelMax":4},"then":{"operation":"damage","target":"opponent","amount":200,"scale":{"zone":"previousMoved","kind":"all"}}}}},"コイントス：蘇生した体数×400回復","et_builtin_s227_grave_summon"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"draw","target":"self","amount":3,"then":{"operation":"damage","target":"opponent","amount":250,"scale":{"zone":"previousMoved","kind":"all"}}}},"ドローした枚数×250ダメージ","et_builtin_s227_draw_count"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"returnDeck","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":350,"scale":{"zone":"previousMoved","kind":"all"}}}},"場からデッキ・EXへ戻した数×350ダメージ","et_builtin_s228_deck_return"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atLeast","count":1},"heads":{"operation":"returnDeck","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"set","maxCount":2},"then":{"operation":"heal","target":"self","amount":400,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"heal","target":"self","amount":100}}},"裏側モンスターのデッキ戻し数×400回復","et_builtin_s228_set_return"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atLeast","count":1},"heads":{"operation":"boostDef","target":"ownAllMonsters","amount":500,"filter":{"race":"ドラゴン"}},"tails":{"operation":"weakenDef","target":"enemyAllMonsters","amount":300,"filter":{"fieldPosition":"def"}}}},"条件分岐：ドラゴン族DEF強化／守備DEF低下","et_builtin_s228_def_branch"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"coinBranch","target":"none","amount":0,"heads":{"operation":"returnDeck","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"boostDef","target":"ownAllMonsters","amount":200,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"weakenDef","target":"enemyAllMonsters","amount":200,"scale":{"zone":"ownGrave","kind":"monster"}}}},"表：デッキ戻し数に応じDEF強化／裏：DEF低下","et_builtin_s228_coin_def"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"discardNewest","target":"self","amount":3,"filter":{"cardType":"monster","race":"ドラゴン"},"then":{"operation":"draw","target":"self","amount":1,"scale":{"zone":"previousMoved","kind":"all"}}}},"手札から捨てたドラゴン族の数だけドロー","et_builtin_s229_discard_draw"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"graveBanish","target":"self","amount":3,"filter":{"attribute":"闇"},"then":{"operation":"draw","target":"self","amount":2,"scale":{"zone":"previousMoved","kind":"all"}}}},"墓地の闇属性を除外した枚数×2ドロー","et_builtin_s229_grave_draw"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroyBackrow","target":"enemyAllBackrow","amount":0,"filter":{"fieldPosition":"set","maxCount":3},"then":{"operation":"draw","target":"self","amount":1,"scale":{"zone":"previousMoved","kind":"all"}}}},"相手のセット魔法罠の破壊数だけドロー","et_builtin_s229_backrow_draw"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":4000},"heads":{"operation":"returnDeck","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":3},"then":{"operation":"draw","target":"self","amount":1,"scale":{"zone":"previousMoved","kind":"all"}}},"tails":{"operation":"summonMonsterHand","target":"self","amount":2,"filter":{"levelMax":4,"summonPosition":"def"},"then":{"operation":"draw","target":"self","amount":2,"scale":{"zone":"previousMoved","kind":"all"}}}}},"LP分岐：デッキ戻し数／特殊召喚数に応じてドロー","et_builtin_s229_branch_draw"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"boostBoth","target":"ownAllMonsters","amount":600,"filter":{"race":"戦士"}}},"味方の戦士族ATK・DEF同時強化","et_builtin_s230_team_boost"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"weakenBoth","target":"enemyAllMonsters","amount":400,"filter":{"fieldPosition":"atk","maxCount":2,"order":"atkHigh"}}},"相手の攻撃表示ATK・DEF同時低下","et_builtin_s230_team_weaken"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":3000},"heads":{"operation":"boostBoth","target":"ownAllMonsters","amount":500,"filter":{"race":"ドラゴン"},"then":{"operation":"draw","target":"self","amount":1}},"tails":{"operation":"weakenBoth","target":"enemyAllMonsters","amount":300,"then":{"operation":"heal","target":"self","amount":400}}}},"LP条件：攻守強化後ドロー／攻守低下後回復","et_builtin_s230_branch_stats"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"graveBanish","target":"self","amount":2,"filter":{"attribute":"闇"},"then":{"operation":"boostBoth","target":"ownAllMonsters","amount":200,"scale":{"zone":"previousMoved","kind":"all"}}}},"墓地から除外した枚数×攻守強化","et_builtin_s230_scaled_stats"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":50,"scale":{"zone":"previousDestroyedAtk","kind":"all"}}}},"破壊した表側モンスターの記載ATK合計の半分のダメージ","et_builtin_s231_atk_burn"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroy","target":"ownAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":1,"order":"atkLow"},"then":{"operation":"heal","target":"self","amount":100,"scale":{"zone":"previousDestroyedAtk","kind":"all"}}}},"自分の表側モンスター破壊後、記載ATK合計の100%回復","et_builtin_s231_atk_heal"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"atk","maxCount":1},"then":{"operation":"boostBoth","target":"ownAllMonsters","amount":25,"scale":{"zone":"previousDestroyedAtk","kind":"all"}}}},"破壊した相手モンスターの記載ATKの25%で味方の攻守強化","et_builtin_s231_atk_boost"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":4000},"heads":{"operation":"destroy","target":"ownAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":1},"then":{"operation":"heal","target":"self","amount":100,"scale":{"zone":"previousDestroyedAtk","kind":"all"}}},"tails":{"operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":50,"scale":{"zone":"previousDestroyedAtk","kind":"all"}}}}},"条件分岐：破壊した記載ATK合計から回復／ダメージ","et_builtin_s231_atk_branch"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"changeStats","target":"ownAllMonsters","amount":700,"defAmount":-300,"filter":{"race":"戦士"}}},"戦士族ATK上昇・DEF低下","et_builtin_s232_warrior"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"changeStats","target":"enemyAllMonsters","amount":-500,"defAmount":200,"filter":{"fieldPosition":"atk","maxCount":2}}},"相手攻撃表示のATK低下・DEF上昇","et_builtin_s232_enemy"),
 templateFromCard({"type":"monster","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":3000},"heads":{"operation":"changeStats","target":"ownAllMonsters","amount":300,"defAmount":900,"then":{"operation":"heal","target":"self","amount":200}},"tails":{"operation":"changeStats","target":"enemyAllMonsters","amount":-200,"defAmount":-600}},"subtype":"effect"},"LP条件別の独立した攻守変化","et_builtin_s232_branch"),
 templateFromCard({"type":"spell","spellKind":"quick","ability":{"when":"main","operation":"draw","target":"self","amount":1,"then":{"operation":"changeStats","target":"ownAllMonsters","amount":0,"defAmount":800,"filter":{"race":"ドラゴン"}}}},"ドロー後にドラゴン族のDEF強化","et_builtin_s232_follow"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":50,"scale":{"zone":"previousDestroyedDef","kind":"all"}}}},"破壊した表側モンスターの記載DEF合計の50%ダメージ","et_builtin_s233_def_burn"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroy","target":"ownAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":1},"then":{"operation":"heal","target":"self","amount":100,"scale":{"zone":"previousDestroyedDef","kind":"all"}}}},"自分の表側モンスター破壊後、記載DEF合計で回復","et_builtin_s233_def_heal"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":200,"scale":{"zone":"previousDestroyedLevel","kind":"all"}}}},"破壊した表側モンスターのレベル合計×200ダメージ","et_builtin_s233_level_burn"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":4000},"heads":{"operation":"destroy","target":"ownAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":1},"then":{"operation":"heal","target":"self","amount":300,"scale":{"zone":"previousDestroyedLevel","kind":"all"}}},"tails":{"operation":"destroy","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":1},"then":{"operation":"boostBoth","target":"ownAllMonsters","amount":25,"scale":{"zone":"previousDestroyedDef","kind":"all"}}}}},"条件分岐：破壊レベルで回復／記載DEFで攻守強化","et_builtin_s233_stat_branch"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"banish","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":50,"scale":{"zone":"previousMovedAtk","kind":"all"}}}},"表側除外ATK合計の50%ダメージ","et_builtin_s234_banish_atk"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"sendGrave","target":"ownAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"heal","target":"self","amount":100,"scale":{"zone":"previousMovedDef","kind":"all"}}}},"表側墓地送りDEF合計で回復","et_builtin_s234_grave_def"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"returnHand","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"damage","target":"opponent","amount":200,"scale":{"zone":"previousMovedLevel","kind":"all"}}}},"表側手札戻しレベル合計×200ダメージ","et_builtin_s234_hand_level"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"returnDeck","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"boostBoth","target":"ownAllMonsters","amount":25,"scale":{"zone":"previousMovedDef","kind":"all"}}}},"表側デッキ戻しDEF合計の25%攻守強化","et_builtin_s234_deck_def"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"changeStats","target":"ownAllMonsters","amount":250,"defAmount":-100,"scale":{"zone":"enemyHand","kind":"all"}}},"相手手札数で自分のATK上昇・DEF低下","et_builtin_s235_hand"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"changeStats","target":"enemyAllMonsters","amount":-200,"defAmount":300,"scale":{"zone":"ownGrave","kind":"monster"}}},"墓地モンスター数で相手攻守を個別変化","et_builtin_s235_grave"),
 templateFromCard({"type":"spell","spellKind":"normal","ability":{"when":"main","operation":"banish","target":"enemyAllMonsters","amount":0,"filter":{"fieldPosition":"faceup","maxCount":2},"then":{"operation":"changeStats","target":"ownAllMonsters","amount":50,"defAmount":-25,"scale":{"zone":"previousMovedAtk","kind":"all"}}}},"除外ATK合計で攻守を個別変化","et_builtin_s235_move"),
 templateFromCard({"type":"monster","subtype":"effect","ability":{"when":"main","operation":"conditionBranch","target":"none","amount":0,"requirement":{"zone":"ownLP","kind":"lp","comparison":"atMost","count":4000},"heads":{"operation":"changeStats","target":"ownAllMonsters","amount":0,"defAmount":300,"scale":{"zone":"ownGrave","kind":"monster"}},"tails":{"operation":"returnHand","target":"enemyAllMonsters","amount":0,"filter":{"maxCount":2},"then":{"operation":"changeStats","target":"enemyAllMonsters","amount":-100,"defAmount":200,"scale":{"zone":"previousMovedLevel","kind":"all"}}}}},"条件分岐：DEF強化／戻したレベルで攻守変化","et_builtin_s235_branch"),
].filter(Boolean).map(Object.freeze));

/** Presentation-only categories; never change recipe identifiers or effect semantics. */
export function templateCategory(t){
 if(t?.monsterEffect)return '固有効果・召喚ルール';
 const a=t?.ability;
 if(!a)return 'その他';
 if(a.when==='summon')return '召喚したとき';
 if(a.when==='battleDamage')return '戦闘ダメージ時';
 if(a.when==='attack'||a.when==='response')return '攻撃・チェーン対応';
 if(a.when==='continuous')return '永続・装備・フィールド';
 if(a.before)return 'コスト付き';
 if(a.then)return '連続効果';
 if(['damage','heal','halfLP','setLP','healPerFieldMonster'].includes(a.operation))return 'LP操作';
 if(['boost','weaken','boostDef','weakenDef','boostBoth','weakenBoth','changeStats','setAtk','setDef','changePosition','lockAttack','lockEffect'].includes(a.operation))return '攻守・行動';
 if(['draw','searchMonster','searchSpell','searchTrap','searchNamed','discardNewest','graveRecover','graveRevive','graveRecycle','banishedRecover','summonRaceFromHand','summonNamedFromHand','summonMonsterHand','returnOwnHandToDeck'].includes(a.operation))return '手札・展開・墓地';
 if(['destroy','banish','sendGrave','destroyBackrow','banishBackrow','returnHand','returnDeck','returnBackrow','graveBanish','banishDeck','banishOwnHand'].includes(a.operation))return '破壊・除外・帰還';
 return 'その他の効果';
}
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
 const n=e.cost!==undefined?`（${e.cost}LP）`:e.multiplier!==undefined?`（${e.multiplier}倍）`:e.selection!==undefined?`（${e.selection==='highest'?'最高ATK':'左端'}）`:e.discardType!==undefined?`（${{spell:'魔法',trap:'罠',monster:'モンスター'}[e.discardType]}）`:e.race!==undefined?`（${e.race}族）`:e.amount!==undefined?`（${e.amount}）`:e.threshold!==undefined?`（ATK ${e.threshold}以上）`:'';
 const base={destroyAttachedEquip:'装備されたカードを破壊',multiAttack:'1度のバトルフェイズで複数回攻撃',copyOpponentPrintedStats:'召喚時相手の元々の攻撃力と守備力をコピー',millFirstType:'戦闘ダメージ時指定種別のデッキ破棄',directEarthWaterFire:'条件付き直接攻撃',fusionMaterialSubstitute:'融合素材の代用',morphingJarTwo:'リバース時双方のモンスターをデッキへ戻す',cyberJarRevealFive:'リバース時双方の場を破壊しデッキ5枚公開',darkBattle500:'闇属性との戦闘中にATK上昇',enemyDragon500:'相手のドラゴン族の数に応じてATK上昇',darkMagicianGrave300:'墓地のブラック・マジシャン系の数に応じてATK上昇',preventBattleDamage:'手札から捨て、戦闘ダメージ0',specialByThreeNames:'指定名3体をリリースして手札から特殊召喚',weakenOpponentOnGrave:'墓地へ送られたとき相手ATK－500（場を離れるまで）',reviveMaterialOnDestroy:'効果・戦闘破壊時に墓地の指定名モンスターを蘇生',rocketAssault:'攻撃時の戦闘破壊・ダメージ防止＋相手ATK－500',fusionFromExtraPay5000:'5000LPを払いEXデッキから融合モンスターを特殊召喚',soloHandNoTribute:'手札が自身1枚ならリリース不要',doubleLightTribute:'光属性の上級召喚時に2体分のリリース',graveNamedScale:'墓地の指定名でATK変化',raceFieldGraveScale:'場・墓地の指定種族でATK変化',battleAttributeScale:'特定属性との戦闘時にATK変化',battleImmuneAtkThreshold:'戦闘破壊耐性',attributeFieldAura:'属性別の全体ATK変化',raceAuraGuard:'種族強化＋攻撃対象制限',returnOpponentOnFlip:'リバース時に相手モンスターを手札へ戻す',searchStatOnGrave:'フィールドから墓地へ送られた際に指定ATK/DEF以下をサーチ',millOpponentDeck:'リバース時のデッキ破棄',selfReturnHand:'自分エンドフェイズに自身を手札へ戻す',postAttackDefenseLock:'攻撃後に守備表示＋次の自分ターン終了まで手動変更不可',trapSuppression:'表側表示で罠の発動・効果を封じる',dragonTargetGuard:'表側表示で相手がドラゴン族を効果対象にできない'};
 return (base[e.code]||`${e.kind}・${e.code}`)+n;
}
