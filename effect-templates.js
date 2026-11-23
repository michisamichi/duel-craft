/** A small, declarative user effect-recipe library. No script execution, no engine extensions. */
import {validMonsterEffect} from './cards.js?v=2080';
import {isValidAbility,abilityText} from './rules.js?v=2080';

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
 if(['boost','weaken','boostDef','weakenDef','setAtk','setDef','changePosition','lockAttack','lockEffect'].includes(a.operation))return '攻守・行動';
 if(['draw','searchMonster','searchSpell','searchTrap','searchNamed','discardNewest','graveRecover','graveRevive','graveRecycle','banishedRecover','summonRaceFromHand','summonNamedFromHand'].includes(a.operation))return '手札・展開・墓地';
 if(['destroy','banish','sendGrave','destroyBackrow','banishBackrow','returnHand','returnDeck','returnBackrow','graveBanish','banishDeck'].includes(a.operation))return '破壊・除外・帰還';
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
