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
 '強欲な壺':{effect:'draw2',status:'exact',note:'カードを2枚ドローする'},
 '天使の施し':{ability:{when:'main',operation:'draw',target:'self',amount:3,then:{operation:'discardNewest',target:'self',amount:2}},status:'simplified',note:'3枚ドローした後、手札末尾の2枚を自動で捨てる（選択操作のみ省略）'},
 '融合賢者':{ability:{when:'main',operation:'searchNamed',target:'self',amount:1,match:'exact',query:'融合'},status:'simplified',note:'デッキから「融合」1枚を手札に加える（最初の候補を自動選択）'},
 'トゥーンのもくじ':{ability:{when:'main',operation:'searchNamed',target:'self',amount:1,match:'contains',query:'トゥーン'},status:'simplified',note:'名前に「トゥーン」を含むカード1枚をデッキから手札へ加える（カード名以外の記載・選択は省略）'},
 '死者蘇生':{ability:{when:'main',operation:'reviveSelected',target:'eitherGraveMonster',amount:0},status:'simplified',note:'守備表示蘇生などは簡略化'},
 '地割れ':{ability:{when:'main',operation:'destroy',target:'enemyLowestAtk',amount:0},status:'simplified',note:'相手の表側モンスターのうち現在ATKが最も低い1体を破壊。同値は左端優先。裏側のみの場合は不発'},
 'サンダー・ボルト':{ability:{when:'main',operation:'destroy',target:'enemyAllMonsters',amount:0},status:'exact',note:'相手フィールドのモンスターをすべて破壊する'},
 'ブラック・ホール':{ability:{when:'main',operation:'destroy',target:'bothMonsters',amount:0},status:'exact',note:'フィールドのモンスターをすべて破壊する'},
 'サイクロン':{ability:{when:'main',operation:'destroyBackrow',target:'enemyBackrow',amount:0},status:'simplified',note:'自分の魔法・罠を対象にする選択は省略'},
 '魔法除去':{ability:{when:'main',operation:'destroyBackrow',target:'enemyBackrow',amount:0},status:'simplified'},
 '大嵐':{ability:{when:'main',operation:'destroyBackrow',target:'bothAllBackrow',amount:0},status:'simplified',note:'お互いの魔法・罠（フィールド魔法も含む）を全て破壊。破壊時の個別チェーン裁定は簡略化'},
 'ハリケーン':{ability:{when:'main',operation:'returnBackrow',target:'bothAllBackrow',amount:0},status:'simplified',note:'お互いの魔法・罠（フィールド魔法も含む）を全て持ち主の手札へ戻す。個別チェーン裁定は簡略化'},
 '撲滅の使徒':{ability:{when:'main',operation:'banishBackrow',target:'enemyBackrow',amount:0},status:'simplified',note:'相手の魔法・罠を1枚除外する簡易効果。セット限定条件・罠カード同名除外・個別チェーン裁定は保留'},
 '抹殺の使徒':{ability:{when:'main',operation:'banish',target:'enemyFaceDownMonster',amount:0},status:'simplified',note:'相手の裏側守備モンスターを左端から1体除外。自分側対象選択・リバースモンスター同名除外・チェーン裁定は保留'},
 '死者への手向け':{ability:{when:'main',operation:'destroy',target:'enemyMonster',amount:0,before:{operation:'discardOwnHand',amount:1}},status:'simplified',note:'相手のモンスター限定の処理'},
 '融合':{effect:'fusionSummon',spellKind:'fusion',status:'simplified',note:'融合素材は2体まで。青眼の究極竜は保留'},
 'カオス－黒魔術の儀式':{effect:'ritualSummon',spellKind:'ritual',status:'simplified'},
 'イリュージョンの儀式':{effect:'ritualSummon',spellKind:'ritual',status:'simplified'},
 'デーモンの斧':{ability:{when:'continuous',operation:'boost',target:'ownMonster',amount:1000},status:'simplified',note:'墓地から回収する効果は省略'},
 'ガイアパワー':{ability:{when:'continuous',operation:'boost',target:'ownAllMonsters',amount:500},status:'simplified',note:'属性限定・守備力低下は省略'},
 '砂塵の大竜巻':{ability:{when:'response',operation:'destroyBackrow',target:'enemyBackrow',amount:0},status:'simplified',note:'効果発動条件と追加セットは省略'},
 '強欲な瓶':{ability:{when:'response',operation:'draw',target:'self',amount:1},status:'simplified',note:'効果へのチェーン時に発動する代替'},
 '攻撃の無力化':{effect:'negate',status:'simplified',note:'バトルフェイズ終了は省略'},
 '聖なるバリア －ミラーフォース－':{ability:{when:'attack',operation:'destroy',target:'enemyAllMonsters',amount:0},status:'simplified',note:'攻撃表示に限定する処理は省略'},
 '落とし穴':{effect:'counterdestroy',status:'proxy',note:'召喚時でなく攻撃時に破壊する代替'},
 '魔法の筒':{effect:'negate',status:'proxy',note:'攻撃を無効化。反射ダメージは保留'},
 'マジックアーム・シールド':{effect:'negate',status:'proxy',note:'攻撃を無効化する代替'},
 '偽物のわな':{effect:'negate',status:'proxy',note:'攻撃を無効化する代替'},
 '鎖付きブーメラン':{effect:'negate',status:'proxy',note:'攻撃を無効化する代替'},
 '天使の手鏡':{effect:'negate',status:'proxy',note:'攻撃を無効化する代替'},
 'トゥーン・ディフェンス':{effect:'negate',status:'proxy',note:'攻撃を無効化する代替'},
 '破壊輪':{effect:'counterdestroy',status:'proxy',note:'攻撃モンスター破壊。両者へのダメージは保留'},
 'ホーリー・エルフの祝福':{ability:{when:'response',operation:'healPerFieldMonster',target:'self',amount:300},status:'simplified',note:'お互いのフィールドのモンスター数×300LP回復。発動可能な場面はチェーン応答時に簡略化'},
};
// Verified native passive effects. Keep the historical ids and base stats unchanged.
// These codes are interpreted by the duel engine, not by the proxy spell system.
const NATIVE_MONSTER_EFFECTS={
 '巨大ネズミ':{kind:'battle',code:'recruitOnBattleDestroy',params:{attribute:'地',threshold:1500},status:'simplified',desc:'戦闘で破壊され墓地へ送られたとき、デッキ内の地属性・元々のATK1500以下のモンスターを攻撃表示で1体特殊召喚（最初の候補を自動選択。チェーン省略）。'},
 'キラー・トマト':{kind:'battle',code:'recruitOnBattleDestroy',params:{attribute:'闇',threshold:1500},status:'simplified',desc:'戦闘で破壊され墓地へ送られたとき、デッキ内の闇属性・元々のATK1500以下のモンスターを攻撃表示で1体特殊召喚（最初の候補を自動選択。チェーン省略）。'},
 'ものマネ幻想師':{kind:'trigger',code:'copyOpponentPrintedStats',status:'simplified',desc:'召喚・反転召喚・特殊召喚時、相手の表側モンスター1体の元々の攻撃力・守備力をコピー（左端を自動選択。チェーン省略）。'},
 'センジュ・ゴッド':{kind:'trigger',code:'searchDeckOnSummon',params:{filter:'ritualMonster'},status:'simplified',desc:'召喚・反転召喚時、デッキの儀式モンスター1体を手札に加える（候補の選択とチェーンは簡略化）。'},
 'ソニックバード':{kind:'trigger',code:'searchDeckOnSummon',params:{filter:'ritualSpell'},status:'simplified',desc:'召喚・反転召喚時、デッキの儀式魔法1枚を手札に加える（候補の選択とチェーンは簡略化）。'},
 'バフォメット':{kind:'trigger',code:'searchDeckOnSummon',params:{filter:'named',name:'幻獣王ガゼル'},status:'simplified',desc:'召喚・反転召喚時、デッキの「幻獣王ガゼル」1体を手札に加える（候補の選択とチェーンは簡略化）。'},
 '鉄の騎士 ギア・フリード':{
   kind:'continuous',code:'destroyAttachedEquip',status:'simplified',
   desc:'このカードに装備された装備カードを破壊（チェーンでの効果無効化・細かいタイミングは簡略化）。'
 },
 'カラテマン':{
   kind:'ignition',code:'doubleOriginalAtkEndDestroy',status:'simplified',
   desc:'1ターンに1度、自身の元々のATKをエンドフェイズまで2倍にする。エンドフェイズに自壊（攻撃力の上書き裁定は簡略化）。'
 },
 '悪魔の偵察者':{
   kind:'flip',code:'scoutDrawDiscardSpells',params:{amount:3},status:'simplified',
   desc:'リバース時、相手が3枚ドローし、その中の魔法カードを墓地へ捨てる（公開演出・チェーンは簡略化）。'
 },
 '人喰い虫':{kind:'flip',code:'destroyOpponentOnFlip',status:'simplified',desc:'リバース時、相手のモンスター1体を破壊する（左端の候補を自動選択。対象選択とチェーンは簡略化）。'},
 '聖なる魔術師':{kind:'flip',code:'recoverOwnSpellOnFlip',status:'simplified',desc:'リバース時、自分の墓地の魔法カード1枚を手札に戻す（最初の候補を自動選択。対象選択とチェーンは簡略化）。'},
 'ドリーム・ピエロ':{kind:'position',code:'destroyOnAttackToDefense',status:'simplified',desc:'攻撃表示から表側守備表示に手動変更した場合、相手のモンスター1体を破壊する（左端を自動選択。カード効果による表示変更とチェーンは保留）。'},
 'ペンギン・ソルジャー':{kind:'flip',code:'returnOpponentOnFlip',params:{amount:2},status:'simplified',desc:'リバース時、相手モンスターを左端から最大2体、持ち主の手札へ戻す（対象選択・自分のカードを戻す選択・チェーンは保留）。'},
 'クリッター':{kind:'grave',code:'searchStatOnGrave',params:{stat:'atk',threshold:1500},status:'simplified',desc:'フィールドから墓地へ送られたとき、持ち主のデッキからATK1500以下のモンスターを1体手札へ加える（最初の候補を自動選択。チェーン・検索後の発動制限は保留）。'},
 '黒き森のウィッチ':{kind:'grave',code:'searchStatOnGrave',params:{stat:'def',threshold:1500},status:'simplified',desc:'フィールドから墓地へ送られたとき、持ち主のデッキからDEF1500以下のモンスターを1体手札へ加える（最初の候補を自動選択。チェーン・検索後の発動制限は保留）。'},
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
   desc:'リバース時に相手のデッキ上から5枚を墓地へ送る（チェーンによる応答は簡略化）。'
 },
 'ブラック・マジシャン・ガール':{
   code:'darkMagicianGrave300',
   desc:'お互いの墓地の「ブラック・マジシャン」「マジシャン・オブ・ブラックカオス」1枚につき攻撃力300アップ。'
 },
 'バスター・ブレイダー':{
   code:'enemyDragon500',
   desc:'相手フィールドの表側表示・相手墓地のドラゴン族モンスター1体につき攻撃力500アップ。'
 },
 '太陽の戦士':{
   code:'darkBattle500',
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
   const native=NATIVE_MONSTER_EFFECTS[name];
   if(native){
     custom.subtype='effect';
     custom.monsterEffect={kind:native.kind||'continuous',code:native.code,...(native.params||{})};
     custom.status=native.status||'exact';
     custom.desc=(custom.status==='exact'?'再現済み':'簡易再現')+'：'+native.desc;
   }else if(kind==='E'||kind==='O'||(kind==='R'&&name==='サクリファイス')||kind==='F'&&name!=='千年竜'){
     custom.historicalEffectPending=true;
     custom.historicalOriginalKind=kind==='O'?'トゥーン':kind==='F'?'融合・効果':kind==='R'?'儀式・効果':'効果';
     custom.desc='原作の効果は再現待ち。現在は基本能力値のみで対戦します。';
   }else custom.desc='原作の能力値を再現したモンスター。';
   if(kind==='F'&&SPECIAL[name])custom.fusionMaterials=SPECIAL[name].map(cardId);
   if(kind==='R')custom.ritualSpellId=cardId(RITUALS[name]);
   if(kind==='F'&&custom.fusionMaterials?.length!==2)custom.historicalEffectPending=true;
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
