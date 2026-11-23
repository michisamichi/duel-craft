// 2001-2002 OCG structure decks: historical card identities and printed stats.
// Text-only, deterministic IDs, no network requests, images or runtime polling.
// N normal, E effect, O Toon, R ritual, F fusion monster;
// S normal spell, Q quick spell, C continuous spell, U equip, D field, I ritual spell;
// T normal trap, P continuous trap, K counter trap.
// Multiplicity is the final field (default 1); Blue-Eyes language variants share an identity.
const RAW = {
 YU: `
01|ブラック・マジシャン・ガール|E|闇|魔法使い|6|2000|1700
02|疾風の暗黒騎士ガイア|E|闇|戦士|7|2300|2100
03|翻弄するエルフの剣士|E|地|戦士|4|1400|1200
04|暗黒魔族ギルファー・デーモン|E|闇|悪魔|6|2200|2500
05|バスター・ブレイダー|E|地|戦士|7|2600|2300
06|磁石の戦士マグネット・バルキリオン|E|地|岩石|8|3500|3850
07|クリボー|E|闇|悪魔|1|300|200
08|バフォメット|E|闇|悪魔|5|1400|1800
09|巨大ネズミ|E|地|獣|4|1400|1450|2
10|サイバーポッド|E|闇|岩石|3|900|900
11|ペンギン・ソルジャー|E|水|水|2|750|500
12|磁石の戦士α|N|地|岩石|4|1400|1700
13|磁石の戦士β|N|地|岩石|4|1700|1600
14|磁石の戦士γ|N|地|岩石|4|1500|1800
15|ブラック・マジシャン|N|闇|魔法使い|7|2500|2100
16|幻獣王ガゼル|N|地|獣|4|1500|1200
17|岩石の巨兵|N|地|岩石|3|1300|2000|2
18|手札抹殺|S
19|光の護封剣|S
20|死者蘇生|S
21|強欲な壺|S
22|心変わり|S
23|天使の施し|S
24|地割れ|S|||||2
25|サイクロン|Q
26|融合|S
27|増殖|Q
28|ブラック・ホール|S
29|死のマジック・ボックス|S
30|早すぎた埋葬|U
31|魔法の筒|T
32|聖なるバリア －ミラーフォース－|T
33|マジカルシルクハット|T
34|シフトチェンジ|T
35|六芒星の呪縛|P
36|補充要員|T
37|マジック・ジャマー|K
38|有翼幻獣キマイラ|F|風|獣|6|2100|1800
39|シルバー・フォング|N|地|獣|3|1200|800
40|ルイーズ|N|地|獣戦士|4|1200|1500
41|マジシャン・オブ・ブラックカオス|R|闇|魔法使い|8|2800|2600
42|カオス－黒魔術の儀式|I
43|魔法除去|S
44|ガイアパワー|D|||||2
45|抹殺の使徒|S
46|ハリケーン|S|||||2
47|真実の眼|P
48|血の代償|P`,
 JY: `
01|真紅眼の黒竜|N|闇|ドラゴン|7|2400|2000
02|ランドスターの剣士|N|地|戦士|3|500|1200
03|太陽の戦士|E|光|戦士|5|2100|1400
04|コマンド・ナイト|E|炎|戦士|4|1200|1900
05|漆黒の豹戦士パンサーウォリアー|E|地|獣戦士|4|2000|1600
06|人造人間－サイコ・ショッカー|E|闇|機械|6|2400|1500
07|時の魔術師|E|光|魔法使い|2|500|400
08|格闘戦士アルティメーター|N|地|戦士|3|700|1000
09|ワイバーンの戦士|N|地|獣|4|1500|1200
10|ベビードラゴン|N|風|ドラゴン|3|1200|700|2
11|アックス・レイダー|N|地|戦士|4|1700|1150
12|ものマネ幻想師|E|光|魔法使い|1|0|0
13|ロケット戦士|E|光|戦士|4|1500|1300
14|鉄の騎士 ギア・フリード|E|地|戦士|4|1800|1600
15|隼の騎士|E|地|戦士|3|1000|700
16|ゴブリン突撃部隊|E|地|戦士|4|2300|0
17|カラテマン|E|地|戦士|3|1000|1000
18|クリッター|E|闇|悪魔|3|1000|600
19|黒き森のウィッチ|E|闇|魔法使い|4|1100|1200
20|ペンギン・ソルジャー|E|水|水|2|750|500
21|心眼の女神|E|光|天使|4|1200|1000
22|スケープ・ゴート|Q
23|デーモンの斧|U
24|強欲な壺|S
25|ハリケーン|S
26|融合|S|||||2
27|ブラック・ホール|S
28|天使のサイコロ|Q
29|悪魔のサイコロ|T
30|落とし穴|T|||||2
31|鎖付きブーメラン|T
32|墓荒らし|T
33|リビングデッドの呼び声|P
34|砂塵の大竜巻|T|||||2
35|天使の手鏡|T
36|マジックアーム・シールド|T
37|千年竜|F|風|ドラゴン|7|2400|2000
38|ドラゴンに乗るワイバーン|F|風|ドラゴン|5|1700|1500
39|岩窟魔人オーガ・ロック|N|地|岩石|3|800|1200
40|鎧蜥蜴|N|地|爬虫類|4|1500|1200
41|ガルーザス|N|炎|獣戦士|5|1800|1500
42|タイガー・アックス|N|地|獣戦士|4|1300|1100
43|ミリス・レディエント|E|地|獣|1|300|250
44|右手に盾を左手に剣を|S
45|ガイアパワー|D
46|融合賢者|S
47|抹殺の使徒|S|||||2
48|偽物のわな|T|||||2
49|血の代償|P`,
 KA: `
01|カイザー・シーホース|E|光|海竜|4|1700|1650
02|ヴァンパイア・ロード|E|闇|アンデット|5|2000|1500
03|青眼の白龍|N|光|ドラゴン|8|3000|2500
04|青眼の白龍|N|光|ドラゴン|8|3000|2500
05|青眼の白龍|N|光|ドラゴン|8|3000|2500
06|ブラッド・ヴォルス|N|闇|獣戦士|4|1900|1200
07|鉄腕ゴーレム|N|地|機械|6|1900|2200
08|ランプの魔精・ラ・ジーン|N|闇|悪魔|4|1800|1000|2
09|ミノタウルス|N|地|獣戦士|4|1700|1000
10|闇・道化師のサギー|N|闇|魔法使い|3|600|1500
11|ガーゴイル・パワード|N|闇|悪魔|4|1600|1200
12|デビル・フランケン|E|闇|機械|2|700|500
13|クリッター|E|闇|悪魔|3|1000|600|2
14|俊足のギラザウルス|E|地|恐竜|3|1400|400
15|暗黒の眠りを誘うルシファー|E|闇|魔法使い|5|1500|1800
16|マジック・ランプ|E|風|魔法使い|3|900|1400
17|大嵐|S
18|死者蘇生|S
19|早すぎた埋葬|U
20|天使の施し|S|||||2
21|死者への手向け|S
22|催眠術|S
23|巨大化|U
24|クロス・ソウル|S
25|疫病ウィルス ブラックダスト|U
26|浅すぎた墓穴|S
27|撲滅の使徒|S|||||2
28|抹殺の使徒|S
29|ブラック・ホール|S
30|強奪|U
31|ホーリー・エルフの祝福|T
32|フォースフィールド|K
33|攻撃の無力化|K
34|破壊輪|T
35|闇の呪縛|P
36|死のデッキ破壊ウイルス|T
37|青眼の究極竜|F|光|ドラゴン|12|4500|3800
38|ガジェット・ソルジャー|N|炎|機械|6|1800|2000
39|破壊神 ヴァサーゴ|E|闇|悪魔|3|1100|900
40|ニードルワーム|E|地|昆虫|2|750|600|2
41|邪悪なるワーム・ビースト|E|地|獣|3|1400|700
42|悪魔の偵察者|E|闇|悪魔|2|650|500|2
43|カオスポッド|E|地|岩石|3|800|700
44|幻想召喚師|E|光|魔法使い|3|800|900
45|ロード・オブ・ドラゴン－ドラゴンの支配者－|E|闇|魔法使い|4|1200|1100
46|人喰い虫|E|地|昆虫|2|450|600
47|ドラゴンを呼ぶ笛|S
48|メテオ・ストライク|U
49|融合|S
50|聖なる輝き|P`,
 PE: `
01|弓を引くマーメイド|N|水|水|4|1400|1500
02|千眼の邪教神|N|闇|魔法使い|1|0|0
03|幻想師・ノー・フェイス|N|闇|魔法使い|5|1200|2200
04|パロット・ドラゴン|N|風|ドラゴン|5|2000|1300
05|ダーク・ラビット|N|闇|獣|4|1100|1500
06|ホーリー・ドール|N|光|魔法使い|4|1600|1000
07|トゥーン・アリゲーター|N|水|爬虫類|4|800|1600
08|トゥーン・ゴブリン突撃部隊|O|地|戦士|4|2300|0
09|トゥーン・キャノン・ソルジャー|O|闇|機械|4|1400|1300
10|トゥーン・ヂェミナイ・エルフ|O|地|魔法使い|4|1900|900
11|トゥーン・仮面魔道士|O|闇|魔法使い|4|900|1400
12|トゥーン・デーモン|O|闇|悪魔|6|2500|1200
13|トゥーン・マーメイド|O|水|水|4|1400|1500
14|ブルーアイズ・トゥーン・ドラゴン|O|光|ドラゴン|8|3000|2500
15|クリッター|E|闇|悪魔|3|1000|600
16|黒き森のウィッチ|E|闇|魔法使い|4|1100|1200
17|聖なる魔術師|E|光|魔法使い|1|300|400
18|センジュ・ゴッド|E|光|天使|4|1400|1000
19|キラー・トマト|E|闇|植物|4|1400|1100
20|タイム・ボマー|E|炎|炎|2|200|1000
21|ソニックバード|E|風|鳥獣|4|1400|1000
22|サクリファイス|R|闇|魔法使い|1|0|0
23|強奪|U
24|トゥーン・ワールド|C|||||2
25|サンダー・ボルト|S
26|大嵐|S
27|クロス・ソウル|S
28|心変わり|S
29|地割れ|S
30|死者蘇生|S
31|融合|S
32|融合賢者|S
33|ハリケーン|S
34|悪夢の鉄檻|S
35|イリュージョンの儀式|I
36|怨霊の湿地帯|C
37|トゥーンのもくじ|S
38|トゥーン・ディフェンス|P
39|強欲な瓶|T
40|サウザンド・アイズ・サクリファイス|F|闇|魔法使い|1|0|0
41|ドラゴン・エッガー|N|炎|ドラゴン|7|2200|2600
42|トゥーン・ドラゴン・エッガー|O|炎|ドラゴン|7|2200|2600
43|幻想召喚師|E|光|魔法使い|3|800|900
44|ダーク・アイズ・イリュージョニスト|E|闇|魔法使い|2|0|1400
45|ドリーム・ピエロ|E|地|戦士|3|1200|900
46|壺魔人|E|炎|炎|3|200|1800
47|融合解除|Q
48|ワーム・ホール|S
49|シャイン・キャッスル|U
50|真実の眼|P
51|ドラゴン族・封印の壺|P
52|不吉な占い|P
53|生命吸収装置|P
54|フォースフィールド|K
55|正々堂々|P`
};

// Deterministic content address based solely on normalized Japanese printed name.
// This preserves shared identities across sets and across device installations.
function cardId(name){
  let a=2166136261,b=2246822519;
  for(const ch of name){const n=ch.codePointAt(0);a=Math.imul(a^n,16777619);b=Math.imul(b^(n+8191),3266489917);}
  return 'u_'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export const ATTRIBUTE_NAMES=['闇','光','地','水','炎','風','神'];
export const RACE_NAMES=['戦士','機械','悪魔','魔法使い','ドラゴン','天使','獣','鳥獣','水','昆虫','岩石','獣戦士','植物','アンデット','爬虫類','炎','魚','雷','恐竜','海竜','サイキック','幻竜','サイバース','幻想魔','幻神獣'];
const SPECIAL={
  '有翼幻獣キマイラ':['幻獣王ガゼル','バフォメット'],
  '千年竜':['時の魔術師','ベビードラゴン'],
  'ドラゴンに乗るワイバーン':['ベビードラゴン','ワイバーンの戦士'],
  '青眼の究極竜':['青眼の白龍','青眼の白龍','青眼の白龍'],
  'サウザンド・アイズ・サクリファイス':['サクリファイス','千眼の邪教神'],
};
const RITUALS={'マジシャン・オブ・ブラックカオス':'カオス－黒魔術の儀式','サクリファイス':'イリュージョンの儀式'};
const SPELLS={
 '心変わり':{ability:{when:'main',operation:'stealUntilEnd',target:'enemyMonster',amount:0},status:'simplified',note:'相手モンスター1体を選び、エンドフェイズまでコントロールを得る。自分の場に空きが必要。返却先に空きがなければ破壊。重複するコントロール変更は簡略化'},
 '強奪':{ability:{when:'continuous',operation:'stealWithEquip',target:'enemyMonster',amount:1000},status:'simplified',note:'相手の表側モンスター1体に装備し、装備中はコントロールを得る。相手ターン開始時に相手は1000LP回復。返却先に空きがなければ破壊。重複するコントロール変更は簡略化'},
 '血の代償':{ability:{when:'continuous',operation:'extraNormalSummon',target:'self',amount:500},status:'simplified',note:'セットした次のターン以降、自分メインフェイズに表にできる。通常召喚済みでも追加で通常召喚・セットでき、その都度500LPを払う。相手バトルフェイズでの召喚とチェーン応答は省略'},
 '強欲な壺':{effect:'draw2',ability:{when:'main',operation:'draw',target:'self',amount:2},status:'exact',note:'カードを2枚ドローする（デッキに2枚以上ある場合のみ発動可能）。カード作成の既存「強欲な壺式」と同じ宣言型処理'},
 '手札抹殺':{ability:{when:'main',operation:'replaceHands',target:'none',amount:0},status:'simplified',note:'双方の手札（発動したこのカードを除く）を墓地へ送り、同じ枚数ドロー。交換する手札がない・いずれかのデッキが不足するときは発動候補を表示しない（チェーン裁定は省略）'},
 '闇の呪縛':{ability:{when:'attack',operation:'negateWeakenAttacker',target:'attacker',amount:700},status:'simplified',note:'攻撃を無効化し、対象モンスターをこの永続罠が表側で残る間攻撃禁止、ATK－700とする（発動時は攻撃者を自動選択。チェーン・任意発動タイミングは簡略化）'},
 '疫病ウィルス ブラックダスト':{ability:{when:'continuous',operation:'preventEquipAttack',target:'enemyMonster',amount:0},status:'simplified',note:'相手モンスター1体に装備し攻撃を禁止。装備モンスターのコントローラーの2回目のエンドフェイズで破壊し、装備魔法は持ち主の手札へ戻す（チェーン・複雑な装備裁定を省略）'},
 '六芒星の呪縛':{ability:{when:'attack',operation:'negateAndLockAttacker',target:'attacker',amount:0},status:'simplified',note:'攻撃宣言時に攻撃を無効化し、この永続罠が表側で残る間、同一モンスターの攻撃を禁止する（対象自動選択・複雑なチェーン裁定は省略）'},
 '巨大化':{ability:{when:'continuous',operation:'lpRelativeEquip',target:'ownMonster',amount:0},status:'simplified',note:'装備可能な自分の表側モンスターとゾーンの空きが必要。LPが少なければ元々のATKを2倍、多ければ半分（等しいときは変化なし）。特殊なATK上書き・多重装備の裁定は簡略化'},
 '死のマジック・ボックス':{ability:{when:'main',operation:'destroyGiveOwn',target:'enemyMonster',amount:0},status:'simplified',note:'双方のフィールドに対象モンスターが揃う場合のみ発動可能。相手モンスターを破壊し、自分の左端モンスター1体のコントロールを相手に移す（自分側選択を自動化）'},
 '早すぎた埋葬':{spellKind:'normal',ability:{when:'main',operation:'graveRevive',target:'self',amount:1,before:{operation:'payLP',amount:800}},status:'simplified',note:'墓地にモンスターと空きゾーンがあり、LP800超のときのみ発動可能。800LPを支払い、墓地の新しいモンスター1体を攻撃表示で蘇生。装備維持・破壊連動は省略した1回きりの通常魔法扱い'},
 '墓荒らし':{ability:{when:'response',operation:'borrowOpponentSpell',target:'self',amount:0},status:'simplified',note:'相手の墓地の新しい魔法カード1枚を自分の手札に加える。セットした次のターン以降は自分メインフェイズでも発動可能。原作の使用時2000ダメージ・未使用時の返却は省略'},
 '鎖付きブーメラン':{ability:{when:'attack',operation:'setAttackerDefense',target:'attacker',amount:0},status:'simplified',note:'攻撃宣言に対応して攻撃モンスターを守備表示にし、その攻撃を中断する。対象を取れない場合は発動候補を出さない。装備カード化とATK＋500は省略'},
 '催眠術':{ability:{when:'main',operation:'lockPositionNextTurn',target:'opponent',amount:0},status:'simplified',note:'次の相手ターン、手動の反転召喚・表示形式変更を禁止。効果による変更は妨げず、ターンが終われば自動解除（待機処理なし）'},
 '右手に盾を左手に剣を':{ability:{when:'main',operation:'swapPrintedStats',target:'bothMonsters',amount:0},status:'simplified',note:'表側表示モンスターが1体以上いる場合のみ発動可能。発動時の表側モンスターの元々のATKとDEFをターン終了まで入れ替える。重複適用・特殊な元々の数値の裁定は簡略化'},
 '補充要員':{ability:{when:'response',operation:'recoverNormalAtk',target:'self',amount:3},status:'simplified',note:'自分の墓地にモンスター5体以上、回収対象が1体以上の場合のみ発動可能。元々のATK1500以下の通常モンスターを新しい順に最大3枚手札へ戻す（対象選択は自動化）。セットした次のターン以降は自分メインフェイズでも発動できる'},
 '増殖':{ability:{when:'main',operation:'summonKuribohTokens',target:'self',amount:0},status:'simplified',note:'発動に必要な表側クリボーがいなければ操作を提示しない。表側表示のクリボー1体を発動時に自動リリースし、空きモンスターゾーンへクリボートークンを可能な限り守備表示で生成。左端のクリボーを選択し、追加の選択待ちなし。トークンは場を離れると消滅し、アドバンス召喚のリリース不可'},
 'スケープ・ゴート':{ability:{when:'main',operation:'summonSheepTokens',target:'self',amount:4},status:'simplified',note:'羊トークン4体を守備表示で特殊召喚。4枠必要。通常召喚済みなら発動できず、発動したターンは通常召喚・反転召喚と主要な特殊召喚を禁止。複雑な特殊召喚の例外は簡略化'},
 '天使のサイコロ':{ability:{when:'main',operation:'diceStats',target:'ownAllMonsters',amount:0},status:'simplified',note:'通信対戦での再現性を優先した決定論的な擬似サイコロ（1～6）。自分の表側モンスターのATK/DEFを出目×100だけターン終了までアップ。表側モンスター不在時は発動不可'},
 '悪魔のサイコロ':{ability:{when:'attack',operation:'diceStats',target:'enemyAllMonsters',amount:0},status:'simplified',note:'通信対戦での再現性を優先した決定論的な擬似サイコロ（1～6）。相手の表側モンスターのATK/DEFを出目×100だけターン終了までダウン。相手に表側モンスターがいる攻撃時に限定'},
 '攻撃の無力化':{ability:{when:'attack',operation:'negateEndBattle',target:'none',amount:0},status:'simplified',note:'相手の攻撃が有効なときだけ発動可能。攻撃を無効にし、バトルフェイズを終了（複雑なチェーン裁定は省略）'},
 '死のデッキ破壊ウイルス':{ability:{when:'response',operation:'crushVirus',target:'none',amount:0,before:{operation:'sendOwnMonsterGrave',amount:1}},status:'simplified',note:'闇属性・ATK1000以下の自分の表側モンスター1体をコストとして墓地へ送り、相手の場と手札のATK1500以上のモンスターを墓地へ送る。セットした次のターン以降は自分メインフェイズでも発動可能。3ターンの継続効果と追加デッキ破壊は省略'},
 '聖なる輝き':{ability:{when:'response',operation:'revealSetMonsters',target:'none',amount:0},status:'simplified',note:'セットした次のターン以降は自分メインフェイズでも発動可能。場の裏側守備モンスターを全て表側守備表示にする（リバース効果を処理。永続的なセット制限は省略した単発処理）'},
 '破壊輪':{ability:{when:'attack',operation:'blastAttacker',target:'attacker',amount:0},status:'simplified',note:'相手の有効な攻撃にのみ発動。攻撃者を破壊し、現在のATK分を双方へ与える（旧カード文言に基づく簡易再現。現在のエラッタ制限は省略）'},
 'メテオ・ストライク':{ability:{when:'continuous',operation:'pierce',target:'ownMonster',amount:0},status:'simplified',note:'装備可能な表側モンスターと魔法・罠ゾーンの空きが必要。装備モンスターが守備表示モンスターに攻撃した際、ATKがDEFを上回れば差分の貫通ダメージ。装備対象は自分モンスターに限定'},
 '光の護封剣':{ability:{when:'main',operation:'sealEnemyAttacks',target:'none',amount:0},status:'simplified',note:'発動後、相手の次の3ターンは後から召喚されたモンスターも攻撃できない。フィールド上での3ターン維持・破壊時の解除・裏側公開は省略'},
 'リビングデッドの呼び声':{ability:{when:'main',operation:'graveRevive',target:'self',amount:1},status:'simplified',note:'セットした次のターン以降、自分メインフェイズにも発動でき、自分の墓地から新しいモンスター1体を特殊召喚（対象選択・相手ターンの任意発動・永続罠との破壊連動は省略）'},
 '浅すぎた墓穴':{ability:{when:'main',operation:'reviveBothSet',target:'none',amount:0},status:'simplified',note:'双方の墓地の蘇生可能モンスターと空きゾーンが揃わない場合は発動候補を表示しない。双方の墓地から通常召喚可能なモンスターを新しい順に1体ずつ裏側守備表示で特殊召喚。両者の墓地と空きゾーンが揃う場合のみ発動（選択・複雑な特殊召喚制限を省略）'},
 'ドラゴンを呼ぶ笛':{ability:{when:'main',operation:'summonRaceFromHand',target:'self',amount:2,match:'race',query:'ドラゴン',requiredFaceUpName:'ロード・オブ・ドラゴン－ドラゴンの支配者－'},status:'simplified',note:'発動条件を満たさない場合は発動操作を提示しない。フィールドに表側の「ロード・オブ・ドラゴン－ドラゴンの支配者－」が存在する場合のみ、手札の通常召喚可能なドラゴン族を先頭から最大2体特殊召喚。選択・特殊召喚後の複雑な裁定は省略'},
 'シャイン・キャッスル':{ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:700},status:'simplified',note:'自分の装備モンスターの攻撃力を700アップ（相手への装備指定は簡略化）'},

 '天使の施し':{ability:{when:'main',operation:'draw',target:'self',amount:3,then:{operation:'discardNewest',target:'self',amount:2}},status:'simplified',note:'デッキに3枚以上ある場合のみ発動可能。3枚ドローした後、手札末尾の2枚を自動で捨てる（選択操作のみ省略）'},
 '融合賢者':{ability:{when:'main',operation:'searchNamed',target:'self',amount:1,match:'exact',query:'融合'},status:'simplified',note:'デッキ内に「融合」が存在する場合のみ発動し、1枚を手札へ加える（最初の候補を自動選択）'},
 'トゥーンのもくじ':{ability:{when:'main',operation:'searchNamed',target:'self',amount:1,match:'contains',query:'トゥーン'},status:'simplified',note:'名前に「トゥーン」を含むカード1枚をデッキから手札へ加える（カード名以外の記載・選択は省略）'},
 '死者蘇生':{ability:{when:'main',operation:'reviveSelected',target:'eitherGraveMonster',amount:0},status:'simplified',note:'自分のモンスターゾーンに空きがあり、どちらかの墓地に蘇生可能なモンスターがいる場合のみ発動。対象選択とカード同一性確認を維持（守備表示蘇生などは簡略化）'},
 '地割れ':{ability:{when:'main',operation:'destroy',target:'enemyLowestAtk',amount:0},status:'simplified',note:'相手の表側モンスターがいる場合のみ発動。現在ATKが最も低い1体を破壊。同値は左端優先。裏側のみの場合の空撃ちを防止'},
 'サンダー・ボルト':{ability:{when:'main',operation:'destroy',target:'enemyAllMonsters',amount:0},status:'exact',note:'相手フィールドのモンスターをすべて破壊する'},
 'ブラック・ホール':{ability:{when:'main',operation:'destroy',target:'bothMonsters',amount:0},status:'exact',note:'お互いのモンスターが0体なら発動候補を表示しない。フィールドのモンスターをすべて破壊する'},
 'サイクロン':{ability:{when:'main',operation:'destroyBackrow',target:'eitherBackrow',amount:0},status:'simplified',note:'自分・相手の場の魔法・罠（フィールド魔法を含む）1枚を選んで破壊する。使用中の単発魔法・罠はチェーン内にあり、選択対象から外れる'},
 '魔法除去':{ability:{when:'main',operation:'removeSpellBackrow',target:'enemyBackrow',amount:0},status:'simplified',note:'相手の対象にできるセット魔法・罠または表側魔法がない場合は発動候補を表示しない。相手の表側魔法かセットされた魔法・罠1枚を選ぶ。魔法なら破壊、裏側の罠なら確認だけで破壊しない（自分側を対象にする選択は省略）'},
 '大嵐':{ability:{when:'main',operation:'destroyBackrow',target:'bothAllBackrow',amount:0},status:'simplified',note:'お互いの魔法・罠（フィールド魔法も含む）を全て破壊。破壊時の個別チェーン裁定は簡略化'},
 'ハリケーン':{ability:{when:'main',operation:'returnBackrow',target:'bothAllBackrow',amount:0},status:'simplified',note:'フィールドに戻せる魔法・罠がある場合のみ発動し、お互いの魔法・罠（フィールド魔法を含む）を全て持ち主の手札へ戻す。個別チェーン裁定は簡略化'},
 '撲滅の使徒':{ability:{when:'main',operation:'banishSetBackrow',target:'enemyBackrow',amount:0},status:'simplified',note:'相手のセット魔法・罠1枚を除外。罠なら双方のデッキから同名カードも除外する（手札・墓地の同名は対象外。チェーン裁定は簡略化）'},
 '抹殺の使徒':{ability:{when:'main',operation:'banish',target:'enemyFaceDownMonster',amount:0},status:'simplified',note:'相手の裏側守備モンスターを左端優先で除外。リバース効果モンスターなら双方のデッキの同名カードも除外する（解決時の位置・個体照合あり。対象選択とチェーン裁定は簡略化）'},
 '死者への手向け':{ability:{when:'main',operation:'destroy',target:'eitherMonster',amount:0,before:{operation:'discardOwnHand',amount:1}},status:'exact',note:'手札を1枚捨て、自分・相手の場からモンスター1体を選んで破壊する。捨てる手札か対象がないときは発動できない'},
 '融合':{effect:'fusionSummon',spellKind:'fusion',status:'simplified',note:'融合素材は2体まで。青眼の究極竜は保留'},
 'カオス－黒魔術の儀式':{effect:'ritualSummon',spellKind:'ritual',status:'simplified'},
 'イリュージョンの儀式':{effect:'ritualSummon',spellKind:'ritual',status:'simplified'},
 'デーモンの斧':{ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:1000},status:'simplified',note:'装備可能な表側モンスターがいない場合は発動操作を提示しない。裏側守備への装備を拒否する。墓地から回収する効果は省略'},
 'ガイアパワー':{ability:{when:'continuous',operation:'earthAura',target:'bothMonsters',amount:500},status:'simplified',note:'双方の表側・地属性モンスターのATKを500アップ、DEFを400ダウン。補正値の特殊な上書き裁定は簡略化'},
 '砂塵の大竜巻':{ability:{when:'response',operation:'destroyThenSetBackrow',target:'enemyBackrow',amount:0},status:'simplified',note:'相手の魔法・罠1枚を破壊した後、自分の手札の最初の通常の魔法・罠1枚を空きゾーンにセットできる（自動選択。フィールド魔法のセット・相手ターンの自由な発動タイミングは省略）。自分メインフェイズでの発動にも対応'},
 '強欲な瓶':{ability:{when:'response',operation:'draw',target:'self',amount:1},status:'simplified',note:'効果へのチェーン時に発動する代替'},
 '聖なるバリア －ミラーフォース－':{ability:{when:'attack',operation:'destroy',target:'enemyAttackMonsters',amount:0},status:'simplified',note:'相手の有効な攻撃宣言時、相手の攻撃表示モンスターを全て破壊。攻撃が無効・中断済みなら発動不可。チェーン裁定は簡略化'},
 '落とし穴':{ability:{when:'summon',operation:'destroyOnEnemySummon',target:'enemyMonster',amount:1000},status:'simplified',note:'相手がATK1000以上を通常召喚・反転召喚した時、次のターン以降に使える伏せた左端の罠を自動発動して破壊。表側の罠は再発動しない。特殊召喚・任意選択は対象外'},
 '偽物のわな':{ability:{when:'response',operation:'protectOwnTraps',target:'none',amount:0},status:'simplified',note:'相手の直前の罠破壊効果から自分の罠を守れる場合に限り発動（身代わり破壊ではなく直前の効果を一括無効化する簡易再現）'},
 'マジカルシルクハット':{ability:{when:'attack',operation:'concealDefender',target:'none',amount:0},status:'simplified',note:'相手が自分の表側モンスターを攻撃したとき、そのモンスターを裏側守備に変更してその攻撃を無効にする。直接攻撃・裏守備にできない攻撃対象では発動候補を出さない。デッキの魔法・罠2枚をモンスター扱いで置く処理・シャッフル・終了時破壊は省略'},
 'シフトチェンジ':{ability:{when:'attack',operation:'redirectAttack',target:'none',amount:0},status:'simplified',note:'相手の攻撃対象となった自分のモンスターを、場に残る別の自分のモンスター（左端から自動選択）へ変更する。相手の魔法・罠効果の対象変更は保留。直接攻撃・別のモンスターがいない場合は発動不可。無効な攻撃応答ボタンを表示しない'},
 '魔法の筒':{ability:{when:'attack',operation:'reflectAttack',target:'none',amount:0},status:'simplified',note:'攻撃を無効にし、攻撃モンスターの現在ATK分を攻撃側へ反射。チェーン上で先に攻撃が無効・中断されている場合は発動候補を出さない（チェーン解決中に対象が消えた場合は不発）'},
 'マジックアーム・シールド':{ability:{when:'attack',operation:'redirectToAttackerAlly',target:'none',amount:0},status:'simplified',note:'相手の攻撃時、相手側の別の表側モンスターを左端から自動選択し、そのモンスターを一時的な攻撃対象として戦闘計算。適切な別モンスターがいない攻撃時は発動候補を出さない。コントロールの移動表示・複雑な継続処理は省略'},
 '天使の手鏡':{ability:{when:'response',operation:'redirectSpellTarget',target:'none',amount:0},status:'simplified',note:'相手の魔法がモンスター1体を対象にし、同じ側に変更可能な別の対象がある場合のみ発動できる（左端優先。複雑な耐性裁定は省略）'},
 'トゥーン・ディフェンス':{effect:'negate',status:'proxy',note:'攻撃を無効化する代替'},
 'マジック・ジャマー':{ability:{when:'response',operation:'negateEffect',target:'none',amount:0,before:{operation:'discardOwnHand',amount:1}},responseGuard:'spell',status:'simplified',note:'魔法の発動への応答時のみ表示。手札1枚をコストに捨て、直前の魔法効果を無効化する。作成カードも同じ判定（チェーン裁定を簡略化）'},
 'フォースフィールド':{ability:{when:'response',operation:'negateEffect',target:'none',amount:0},responseGuard:'targetedSpell',status:'simplified',note:'モンスター1体を対象とする魔法の発動を無効にする。対象を取る魔法かどうかは効果定義から判定（チェーン裁定簡略化）'},
 'ホーリー・エルフの祝福':{ability:{when:'response',operation:'healPerFieldMonster',target:'self',amount:300},status:'simplified',note:'お互いのフィールドのモンスター数×300LP回復。セットした次のターン以降は自分メインフェイズでも発動可能（相手ターンの任意タイミングは保留）'},
};
// Verified native passive effects. Keep the historical ids and base stats unchanged.
// These codes are interpreted by the duel engine, not by the proxy spell system.
const HISTORICAL_MONSTER_ABILITIES={
 '漆黒の豹戦士パンサーウォリアー':{ability:{when:'continuous',operation:'tributeOtherToAttack',target:'self',amount:0},status:'simplified',desc:'攻撃宣言時に自分のほかのモンスターを左端から1体リリースする（選択を自動化）。ほかのモンスターがいなければ攻撃できない。'},
 '時の魔術師':{ability:{when:'main',operation:'timeWizardCoin',target:'self',amount:0},status:'simplified',desc:'1ターンに1回、決定論的な擬似コイントスで成功なら相手、失敗なら自分のモンスターを全破壊。失敗時は破壊した元々のATK合計の半分のダメージ（ダメージは破壊したモンスターの元々のATK合計の半分で算出。チェーン・コイントス演出省略）。'},
 '俊足のギラザウルス':{ability:{when:'main',operation:'selfSpecialFromHandGiveRevive',target:'self',amount:0},status:'simplified',desc:'手札から特殊召喚したとき、相手の墓地に通常召喚可能なモンスターがあり相手のゾーンに空きがあれば、相手の最新の1体を攻撃表示で自動蘇生する。相手の選択・辞退は簡略化。通常召喚権は使わない。'},
 '心眼の女神':{ability:{when:'continuous',operation:'fusionMaterialSubstitute',target:'self',amount:0},status:'simplified',desc:'融合素材2体のうち1体の代わりとして使用できる（融合素材を2体使用する融合召喚のみ、代用は1体まで）。'},
 '破壊神 ヴァサーゴ':{ability:{when:'continuous',operation:'fusionMaterialSubstitute',target:'self',amount:0},status:'simplified',desc:'融合素材2体のうち1体の代わりとして使用できる（融合素材を2体使用する融合召喚のみ、代用は1体まで）。'},
 'ドラゴンに乗るワイバーン':{ability:{when:'continuous',operation:'directEarthWaterFire',target:'self',amount:0},status:'simplified',desc:'相手フィールドに表側表示の地・水・炎属性モンスターしかいない場合に直接攻撃できる（表側が最低1体必要。対象が変化した場合は解決時に再判定）。'},
 '暗黒の眠りを誘うルシファー':{
  ability:{when:'summon',operation:'lockWhileSourceFaceUp',target:'enemyMonster',amount:0},
  status:'simplified',desc:'通常召喚・反転召喚したとき相手の左端のモンスター1体を選び、このカードが表側で存在する間、そのモンスターの攻撃を禁止。対象選択・チェーンは簡略化。'
 },
 'ヴァンパイア・ロード':{
  ability:{when:'battleDamage',operation:'millFirstType',target:'opponent',amount:0,match:'monster'},
  status:'simplified',desc:'相手に戦闘ダメージを与えたとき、相手デッキの最初のモンスター1枚を墓地へ送る（指定種類をモンスターで固定、相手によるカード選択を自動化。効果破壊された場合の次のスタンバイフェイズでの自己再生は保留）。'
 },
 // Toon-wide summon, attack and Toon World rules are intentionally NOT applied.
 // Only standalone battle-damage triggers use the ordinary effect composer.
 'トゥーン・仮面魔道士':{
  ability:{when:'battleDamage',operation:'draw',target:'self',amount:1},
  status:'simplified',desc:'このモンスターが相手に戦闘ダメージを与えたとき、自分はカードを1枚ドローする（トゥーン共通ルール・別チェーンは適用しない）。'
 },
 'トゥーン・ヂェミナイ・エルフ':{
  ability:{when:'battleDamage',operation:'discardNewest',target:'opponent',amount:1},
  status:'simplified',desc:'このモンスターが相手に戦闘ダメージを与えたとき、相手の手札を1枚捨てる（ランダム選択ではなく末尾から自動選択。トゥーン共通ルール・別チェーンは適用しない）。'
 },
 'トゥーン・キャノン・ソルジャー':{
  ability:{when:'main',operation:'damage',target:'opponent',amount:500,before:{operation:'sendOwnMonsterGrave',amount:1}},
  status:'simplified',desc:'自分のモンスター1体を発動時に墓地へ送り、相手に500ダメージ（リリースを墓地送りとして代用、起動は1ターンに1度。トゥーン固有の直接攻撃・召喚ターン攻撃不可・トゥーン・ワールド破壊連動は保留）。'
 },
 'マジック・ランプ':{
  ability:{when:'main',operation:'summonNamedFromHand',target:'self',amount:0,match:'exact',query:'ランプの魔精・ラ・ジーン'},
  status:'simplified',desc:'自分メインフェイズに手札の「ランプの魔精・ラ・ジーン」1体を攻撃表示で特殊召喚。対象か空きゾーンがない場合は発動不可（先頭候補を自動選択・1ターンに1度。裏側守備への攻撃対象変更は保留）。'
 },
};
const NATIVE_MONSTER_EFFECTS={
 'ロード・オブ・ドラゴン－ドラゴンの支配者－':{kind:'continuous',code:'dragonTargetGuard',status:'simplified',desc:'このカードが表側表示でいる間、相手はフィールドのドラゴン族モンスターを効果の対象にできない（対象を取らない効果には適用しない）。'},
 'クリボー':{kind:'hand',code:'preventBattleDamage',status:'simplified',desc:'相手の攻撃に対応し、このカードを手札から捨てると、その戦闘で自分が受ける戦闘ダメージを0にする（ダメージ計算時の細かなチェーン裁定は省略）。'},
 '暗黒魔族ギルファー・デーモン':{kind:'grave',code:'weakenOpponentOnGrave',params:{scope:'opponent',amount:500},status:'simplified',desc:'フィールドから墓地へ送られた時、相手の有効な表側モンスター1体を自動で選び、場を離れるか裏側表示になるまでATKを500下げる。装備カード化、他の領域からの墓地送り、任意発動・チェーン応答は省略。'},
 '磁石の戦士マグネット・バルキリオン':{kind:'hand',code:'specialByThreeNames',params:{names:['磁石の戦士α','磁石の戦士β','磁石の戦士γ']},status:'simplified',desc:'自分フィールドのα・β・γを各1体ずつリリースし、手札から特殊召喚（分離効果・墓地からの特殊召喚は省略）。'},
 '有翼幻獣キマイラ':{kind:'grave',code:'reviveMaterialOnDestroy',params:{names:['幻獣王ガゼル','バフォメット'],position:'atk'},status:'simplified',desc:'フィールドで破壊され墓地へ送られた時、自分の墓地のガゼルかバフォメットを左端に攻撃表示で特殊召喚。候補・表示形式の選択とチェーン応答は省略。'},

 'ロケット戦士':{kind:'continuous',code:'rocketAssault',status:'simplified',desc:'自分のバトルフェイズに攻撃する場合、このカードは戦闘破壊されず自分への戦闘ダメージは0。戦闘後、相手のモンスターが場に残っていればそのATKをターン終了まで500下げる（チェーン処理は簡略化）。'},
 'デビル・フランケン':{kind:'ignition',code:'fusionFromExtraPay5000',status:'simplified',desc:'自分メインフェイズに5000LPを支払い、EXデッキの融合モンスター1体を攻撃表示で特殊召喚。LP5000以下・空きゾーンなし・融合候補なしの場合は発動不可（自動選択・召喚裁定は簡略化）。'},
 '疾風の暗黒騎士ガイア':{kind:'summonRule',code:'soloHandNoTribute',status:'simplified',desc:'手札がこのカード1枚だけならリリースなしで通常召喚・セットできる。簡易UIでは条件を満たしたとき、リリースなしを優先する。'},
 'カイザー・シーホース':{kind:'summonRule',code:'doubleLightTribute',status:'simplified',desc:'光属性・レベル7以上のモンスターをアドバンス召喚・セットするとき、1体で2体分のリリースに使用できる（1体で使う場合は自動で2体分扱い）。'},
 '人造人間－サイコ・ショッカー':{kind:'continuous',code:'trapSuppression',status:'simplified',desc:'このカードが表側表示で存在する限り、お互いの罠カードを新たに発動できず、解決時に存在する罠カードの効果を無効化する（複雑な永続罠の再評価・特殊なチェーン裁定は省略）。'},
 '巨大ネズミ':{kind:'battle',code:'recruitOnBattleDestroy',params:{attribute:'地',threshold:1500},status:'simplified',desc:'戦闘で破壊され墓地へ送られたとき、デッキ内の地属性・元々のATK1500以下を1体特殊召喚（自動選択）。デッキ候補なし・ゾーン満杯なら安全に終了。'},
 'キラー・トマト':{kind:'battle',code:'recruitOnBattleDestroy',params:{attribute:'闇',threshold:1500},status:'simplified',desc:'戦闘で破壊され墓地へ送られたとき、デッキ内の闇属性・元々のATK1500以下のモンスターを攻撃表示で1体特殊召喚（最初の候補を自動選択。チェーン省略）。'},
 'ものマネ幻想師':{kind:'trigger',code:'copyOpponentPrintedStats',params:{scope:'opponent'},status:'simplified',desc:'召喚・反転召喚・特殊召喚時、相手の有効な表側モンスター1体の元々の攻撃力・守備力をコピー。左端を自動選択し、チェーン応答は省略。'},
 'センジュ・ゴッド':{kind:'trigger',code:'searchDeckOnSummon',params:{filter:'ritualMonster'},status:'simplified',desc:'召喚・反転召喚時、デッキの儀式モンスター1体を手札に加える（候補の選択とチェーンは簡略化）。'},
 'ソニックバード':{kind:'trigger',code:'searchDeckOnSummon',params:{filter:'ritualSpell'},status:'simplified',desc:'召喚・反転召喚時、デッキの儀式魔法1枚を手札に加える（候補の選択とチェーンは簡略化）。'},
 'バフォメット':{kind:'trigger',code:'searchDeckOnSummon',params:{filter:'named',name:'幻獣王ガゼル',normalOrFlipOnly:true},status:'simplified',desc:'通常召喚・反転召喚時、デッキに「幻獣王ガゼル」があれば先頭候補を自動で1枚サーチ。特殊召喚時は発動しない。候補の選択・チェーン応答は省略。'},
 'サイバーポッド':{kind:'flip',code:'cyberJarRevealFive',status:'simplified',desc:'リバース時に双方のフィールドのモンスターを破壊し、各デッキの上から最大5枚を公開。レベル4以下の通常召喚可能なモンスターを攻撃表示で特殊召喚し、その他を手札に加える（表示形式の選択・個別チェーンは省略）。'},
 'カオスポッド':{kind:'flip',code:'morphingJarTwo',status:'simplified',desc:'リバース時に双方のモンスターを持ち主のデッキに戻し、各自が戻したモンスターの数だけモンスターをデッキから公開する。レベル4以下の通常召喚可能なモンスターは裏側守備表示で特殊召喚し、残りはデッキへ戻す（選択・シャッフルの詳細裁定・個別チェーンは省略）。トークンは消滅し、融合モンスターはEXデッキへ戻す。'},
 '鉄の騎士 ギア・フリード':{
   kind:'continuous',code:'destroyAttachedEquip',status:'simplified',
   desc:'このカードに装備された装備カードを破壊（チェーンでの効果無効化・細かいタイミングは簡略化）。'
 },
 'カラテマン':{
   kind:'ignition',code:'doubleOriginalAtkEndDestroy',status:'simplified',
   desc:'1ターンに1度、自身の元々のATKをエンドフェイズまで2倍にし、エンドフェイズに自壊する。表側表示の自分メインフェイズのみ発動可能（攻撃力の上書き裁定は簡略化）。'
 },
 '悪魔の偵察者':{
   kind:'flip',code:'scoutDrawDiscardSpells',params:{amount:3},status:'simplified',
   desc:'リバース時、相手が3枚ドローし、その中の魔法カードのみ墓地へ送る。デッキ不足時はドローによる敗北判定に従う（公開演出・チェーンは簡略化）。'
 },
 '人喰い虫':{kind:'flip',code:'destroyOpponentOnFlip',params:{scope:'both'},status:'simplified',desc:'リバース時、フィールドのモンスター1体を破壊する。相手側、自分側の順で左端の有効な対象を自動選択し、他にいなければ場に残っている自身も対象になる。チェーン応答は省略。'},
 '聖なる魔術師':{kind:'flip',code:'recoverOwnSpellOnFlip',status:'simplified',desc:'リバース時、自分の墓地の魔法カード1枚を手札に戻す（最初の候補を自動選択。対象選択とチェーンは簡略化）。'},
 'ドリーム・ピエロ':{kind:'position',code:'destroyOnAttackToDefense',status:'simplified',desc:'攻撃表示から表側守備表示に手動変更した場合、相手のモンスター1体を破壊する（左端を自動選択。カード効果による表示変更とチェーンは保留）。'},
 'ペンギン・ソルジャー':{kind:'flip',code:'returnOpponentOnFlip',params:{amount:2,scope:'opponent'},status:'simplified',desc:'リバース時、相手の有効な対象を左端から最大2体、持ち主の手札へ戻す。装備カードは解除。対象の任意選択・自分のモンスターの指定・チェーン応答は省略。'},
 'クリッター':{kind:'grave',code:'searchStatOnGrave',params:{stat:'atk',threshold:1500,restrictActivation:true},status:'simplified',desc:'フィールドから墓地へ送られたとき、持ち主のデッキからATK1500以下のモンスターを自動で1体手札に加える。同名のサーチはターン中1回。加えたカードと同名の発動する効果は、そのターン中使えない。チェーン応答は省略。'},
 '黒き森のウィッチ':{kind:'grave',code:'searchStatOnGrave',params:{stat:'def',threshold:1500,restrictActivation:true},status:'simplified',desc:'フィールドから墓地へ送られたとき、持ち主のデッキからDEF1500以下のモンスターを自動で1体手札に加える。同名のサーチはターン中1回。加えたカードと同名の発動する効果は、そのターン中使えない。チェーン応答は省略。'},
 '隼の騎士':{
   kind:'continuous',code:'multiAttack',params:{count:2},status:'exact',
   desc:'このカードは1度のバトルフェイズ中に2回攻撃できる。'
 },
 'ゴブリン突撃部隊':{
   kind:'continuous',code:'postAttackDefenseLock',status:'exact',
   desc:'このカードが攻撃した場合、バトルフェイズ終了時に守備表示になり、次の自分ターン終了時までプレイヤーの操作で表示形式を変更できない。カード効果による変更は可能。'
 },
 '邪悪なるワーム・ビースト':{
   kind:'endPhase',code:'selfReturnHand',status:'simplified',
   desc:'自分のエンドフェイズに表側表示のこのカードを持ち主の手札に戻す（チェーン応答は簡略化）。'
 },
 'ニードルワーム':{
   kind:'flip',code:'millOpponentDeck',params:{amount:5},status:'simplified',
   desc:'リバース時に相手のデッキ上から最大5枚を墓地へ送る。5枚未満なら残り枚数だけ送る（チェーン応答は簡略化）。'
 },
 'ブラック・マジシャン・ガール':{
   code:'countStatScale',params:{scope:'both',zones:['grave'],stat:'atk',amount:300,names:['ブラック・マジシャン','マジシャン・オブ・ブラックカオス']},
   desc:'お互いの墓地の「ブラック・マジシャン」「マジシャン・オブ・ブラックカオス」1枚につき攻撃力300アップ。'
 },
 'バスター・ブレイダー':{
   code:'countStatScale',params:{scope:'opponent',zones:['field','grave'],stat:'atk',amount:500,race:'ドラゴン'},
   desc:'相手フィールドの表側表示・相手墓地のドラゴン族モンスター1体につき攻撃力500アップ。'
 },
 '太陽の戦士':{
   code:'battleAttributeScale',params:{attribute:'闇',amount:500},
   desc:'闇属性モンスターとの戦闘中、ダメージ計算で攻撃力500アップ。'
 },
 '翻弄するエルフの剣士':{
   code:'battleImmuneAtkThreshold',params:{threshold:1900},
   desc:'攻撃力1900以上のモンスターとの戦闘では破壊されない。戦闘ダメージは受ける。'
 },
 'コマンド・ナイト':{
   code:'raceAuraGuard',params:{race:'戦士',amount:400},
   desc:'表側表示で存在する間、自分の戦士族モンスターの攻撃力＋400。自分の場にほかのモンスターが存在する場合、相手はこのカードを攻撃対象に選べない。'
 },
 'ミリス・レディエント':{
   code:'attributeFieldAura',params:{attribute:'地',amount:500,negativeAttribute:'風',negativeAmount:400,scope:'both'},
   desc:'フィールドの表側表示の地属性モンスターの攻撃力＋500、風属性モンスターの攻撃力－400。'
 },
};
function kindToCard(name,kind,rest){
 const monster='NEORF'.includes(kind);
 const base={id:cardId(name),name,rarity:'N',emoji:monster?'✦':kind==='T'||kind==='P'||kind==='K'?'◇':'✧',historicalKind:kind};
 if(monster){
   const [attribute,race,level,atk,def]=rest;
   const custom={...base,type:'monster',subtype:'normal',attribute,race,level:Number(level),atk:Number(atk),def:Number(def),summonKind:kind==='F'?'fusion':kind==='R'?'ritual':'normal'};
   const recipe=HISTORICAL_MONSTER_ABILITIES[name];
   const native=NATIVE_MONSTER_EFFECTS[name];
   if(recipe){
     custom.subtype='effect';custom.ability=recipe.ability;custom.status=recipe.status;
     custom.desc='簡易再現：'+recipe.desc;
   }else if(native){
     custom.subtype='effect';
     custom.monsterEffect={kind:native.kind||'continuous',code:native.code,...(native.params||{})};
     custom.status=native.status||'exact';
     custom.desc=(custom.status==='exact'?'再現済み':'簡易再現')+'：'+native.desc;
   }else if(kind==='E'||kind==='O'||(kind==='R'&&name==='サクリファイス')||kind==='F'&&name!=='千年竜'&&name!=='青眼の究極竜'){
     custom.historicalEffectPending=true;
     custom.historicalOriginalKind=kind==='O'?'トゥーン':kind==='F'?'融合・効果':kind==='R'?'儀式・効果':'効果';
     custom.desc='原作の効果は再現待ち。現在は基本能力値のみで対戦します。';
   }else custom.desc='原作の能力値を再現したモンスター。';
   if(kind==='F'&&SPECIAL[name])custom.fusionMaterials=SPECIAL[name].map(cardId);
   if(kind==='R')custom.ritualSpellId=cardId(RITUALS[name]);
   if(kind==='F'&&![2,3].includes(custom.fusionMaterials?.length))custom.historicalEffectPending=true;
   return custom;
 }
 const def=SPELLS[name];
 const type=['T','P','K'].includes(kind)?'trap':'spell';
 const spellKindMap={S:'normal',Q:'quick',C:'continuous',U:'equip',D:'field',I:'ritual'};
 const spellKind=type==='spell'?(def?.spellKind||spellKindMap[kind]):undefined;
 const playable=def|| (type==='spell' ? {effect:'heal1000',status:'proxy',note:'原作効果を保留。代わりにLP1000回復'} : {effect:'negate',status:'proxy',note:'原作効果を保留。代わりに攻撃を無効化'});
 // Unsupported persistent/equip/field cards cannot use one-shot effects in the engine.
 // Give them a genuine supported continuous ability, with a visible proxy label.
 const result={...base,type, ...(type==='spell'?{spellKind}:{}),...playable};
 if(type==='spell'&&['continuous','equip','field'].includes(spellKind)&&!result.ability){
   delete result.effect;
   result.ability={when:'continuous',operation:'boost',target:spellKind==='field'?'ownAllMonsters':'ownMonster',amount:300};
   result.status='proxy';result.note='原作効果は保留。ATK＋300の代替';
 }
 if(kind==='I'){result.ritualFor=cardId(name==='イリュージョンの儀式'?'サクリファイス':'マジシャン・オブ・ブラックカオス');}
 if(result.ability&&type==='spell'&&['continuous','equip','field'].includes(spellKind)&&result.ability.when!=='continuous')result.spellKind='normal';
 // Text matches only the deliberately implemented simplified/substitute behavior.
 result.desc=(result.status==='exact'?'再現済み':result.status==='simplified'?'簡易再現':'代替効果')+'：'+(result.note||'現在のゲーム仕様に合わせて処理');
 return result;
}
function make(){
  const byName=new Map(),presets={};
  const cutoffs={YU:[37,38],JY:[36,38],KA:[36,37],PE:[39,40]};
  const labels={YU:['2001 遊戯編','2001-06-28'],JY:['2001 城之内編','2001-10-25'],KA:['2002 海馬編','2002-01-24'],PE:['2002 ペガサス編','2002-03-21']};
  const sideDuplicates={YU:['ブラック・マジシャン','サイクロン','補充要員'],JY:['心眼の女神','ハリケーン'],KA:[],PE:[]};
  for(const [set,raw] of Object.entries(RAW)){
    const [mainEnd,extraEnd]=cutoffs[set];
    const counts={},extraCounts={},sideCounts={};
    const records=[];
    for(const line of raw.trim().split('\n')){
      const [num,name,kind,...rest]=line.split('|');
      const numeric=Number(num);// Monster rows have five mandatory fields; other rows have none.
      const monster='NEORF'.includes(kind);
      const actualQty=Number(rest.at(-1))>0&&rest.length>=(monster?6:5)?Number(rest.at(-1)):1;
      let card=byName.get(name);
      if(!card){card=kindToCard(name,kind,rest);byName.set(name,card);}
      const zone=numeric<=mainEnd?'main':numeric<=extraEnd?'extra':'side';
      const target=zone==='main'?counts:zone==='extra'?extraCounts:sideCounts;
      target[card.id]=(target[card.id]||0)+actualQty;
      records.push({code:`${set}-${num}`,name,kind,zone,quantity:actualQty,id:card.id});
    }
    for(const name of sideDuplicates[set]){const id=cardId(name);sideCounts[id]=(sideCounts[id]||0)+1;records.push({code:'additional',name,zone:'side',quantity:1,id});}
    presets[set.toLowerCase()]={code:set,name:labels[set][0],releaseDate:labels[set][1],counts,extraCounts,sideCounts,records};
  }
  return {cards:[...byName.values()],presets};
}
const built=make();
export const HISTORICAL_CARDS=built.cards;
export const HISTORICAL_PRESETS=built.presets;
export const historicalCardId=cardId;
