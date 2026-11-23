# 初期デッキの効果改善

遊戯編・城之内編・海馬編のメイン、EX、サイドの収録記録から、カードIDで重複を除いた130枚を調査対象とした。作業開始時のコードには再現済み10枚、簡易再現86枚、代替効果4枚、効果保留1枚、効果の再現区分がないカード29枚があった。この分類は開始時の実装上の表示区分。カード効果の比較には現行のOCGデータベースも参照した。対応済みの作成用レシピ96件について、標準テンプレートとの一致を自動検査した。

[遊戯編](https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&pid=2201000&request_locale=ja) · [城之内編](https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&pid=2201001&request_locale=ja) · [海馬編](https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&pid=2201002&request_locale=ja)

## 効果と簡略化

### 攻守と戦闘

- ブラック・マジシャン・ガール、バスター・ブレイダーは参照先を設定できる共通集計を使う。前者は双方の墓地にある指定名、後者は相手の表側フィールドと墓地にあるドラゴン族を数える。
- 太陽の戦士の属性別補正は戦闘時だけ適用する。直接攻撃や通常の表示ATKには加算しない。
- 翻弄するエルフの剣士の戦闘破壊耐性は、攻撃対象が攻撃側の別モンスターに切り替わった場合も、実際に戦闘する相手のコントローラーでATKを計算する。

[ブラック・マジシャン・ガール](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4766&ope=2&request_locale=ja) · [バスター・ブレイダー](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4983&ope=2&request_locale=ja) · [太陽の戦士](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=5015&ope=2&request_locale=ja) · [翻弄するエルフの剣士](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=5244&ope=2&request_locale=ja)

### リバースと墓地

- クリッター、黒き森のウィッチは同名効果を1ターンに1回にし、手札に加えたカードと同名の発動する効果をそのターン中制限する。サーチ先はデッキ内の最初の候補を使い、独立した応答チェーンは省略する。
- 人喰い虫は相手の場を優先して有効な対象を自動で破壊する。候補が自分の場にしかいなければ、自分のモンスターや自身も対象になる。
- ペンギン・ソルジャーは相手の有効な対象を左端から最大2体返す。標準カードの任意選択と自分側の指定は省略し、派生カードでは対象の側を変更できる。両リバース効果とも対象耐性を確認する。

[クリッター](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4054&ope=2&request_locale=ja) · [黒き森のウィッチ](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4580&ope=2&request_locale=ja) · [人喰い虫](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4507&ope=2&request_locale=ja) · [ペンギン・ソルジャー](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4608&ope=2&request_locale=ja)

### 魔法・罠

- 心変わりは相手モンスターのコントロールをエンドフェイズまで得る。強奪は表側モンスターを対象とする装備を使い、装備を失った時に返却する。相手ターン開始時にLPを回復する方式でスタンバイフェイズを近似する。貸し借りの重ね掛けを制限し、返却先が満杯なら破壊する。
- サイクロンは両者の魔法・罠ゾーンとフィールドゾーンから1枚を選べる。死者への手向けは手札を捨てるコストを選んだ後、両者のモンスターから1体を選べる。対象のインスタンスを解決時に確認する。
- マジック・ジャマーの標準テンプレートは魔法への応答制限も引き継ぐ。対応範囲の変更は応答で発動する無効化効果に限る。
- 死のデッキ破壊ウイルスは空き枠がある場でもコスト選択を開始できる。発動元とコスト選択を保持し、確定時に元の罠の処理を呼ぶ。破壊範囲と相手の後続ドローに関する既存の簡略化はカード画面に記載している。

[心変わり](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4860&ope=2&request_locale=ja) · [強奪](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4898&ope=2&request_locale=ja) · [サイクロン](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4909&ope=2&request_locale=ja) · [死者への手向け](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4856&ope=2&request_locale=ja) · [マジック・ジャマー](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4862&ope=2&request_locale=ja) · [死のデッキ破壊ウイルス](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4667&ope=2&request_locale=ja)

### 召喚と追加の墓地効果

- バフォメットのサーチは通常召喚・反転召喚で処理する。デッキ内の最初の候補を使う。ものマネ幻想師は召喚時に対象耐性を避け、有効な表側モンスターの元々の攻守をコピーする。両方とも対象の選択と専用の応答チェーンを省略する。
- 暗黒魔族ギルファー・デーモンは場から墓地へ送られたとき有効な表側対象を自動で弱体化し、対象が場を離れるか裏側表示になると補正を解除する。装備化、他のゾーンからの墓地送り、任意発動を簡略化した。
- 有翼幻獣キマイラは破壊後に指定名を蘇生し、蘇生先の対応する特殊召喚時効果を処理する。候補と表示形式はテンプレートの設定を使い、デュエル中の選択は省略する。

[バフォメット](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4755&ope=2&request_locale=ja) · [ものマネ幻想師](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4795&ope=2&request_locale=ja) · [暗黒魔族ギルファー・デーモン](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=5091&ope=2&request_locale=ja) · [有翼幻獣キマイラ](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4756&ope=2&request_locale=ja)

## 作成できる派生効果

- 公開ゾーンのモンスターを数え、1体につき自身のATKまたはDEFを上げる。自分・相手・双方、表側フィールド・墓地・除外、完全一致のカード名を最大3件、属性、種族、レベル、モンスターの種類、上昇値を組み合わせられる。手札・デッキと裏側カードを集計から外し、公開ステータスから非公開カードが判明するのを避ける。
- リバースで戻す・破壊する対象の側、戻す枚数、墓地サーチの能力値とターン中の制限、戦闘時の対象属性とATK上昇値を調整できる。装備コントロールでは回復量、対象を選ぶ破壊では対応している側を調整できる。
- 召喚時のサーチ条件、コピー対象の側、墓地効果の弱体化量、蘇生対象名と表示形式を変更できる。クリボーと磁石の戦士マグネット・バルキリオンの手札効果は編集時にも選択が保持され、後者ではリリース名を変更できる。
- 選んだテンプレートはエディターで変更して保存できる。既存の組み合わせ式のコストと追加効果は、対象と発動条件が対応する組み合わせで利用する。マイ効果と作成カードは端末バックアップから復元できる。

## 検証と残課題

リポジトリのルートで `node --test --test-isolation=none tests/*.test.mjs` を実行する。テストはブラウザと共通のデュエルエンジンを使用する。対象不在・置き換え、デッキ切れ、戦闘と攻守の計算、持続効果の解除、コストと対象の順序、同時発生、保存形式とリビジョンの再現を含む。iPhone縦、iPad縦・横相当の画面をタッチ入力を有効にしたChromiumで操作し、通信はFirebaseの応答を模擬した。

ブラウザテストは `python -m pip install playwright` と `python -m playwright install chromium` の後に `python tests/browser-smoke.py` で実行できる。既存のChromiumを使う場合は実行ファイルを `SAHOVERSE_CHROMIUM` に指定する。テストはローカルのファイルと模擬Firebaseだけを読み込む。

真実の眼の手札公開と継続回復、クロス・ソウルの相手モンスターのリリース、幻想召喚師のリバース召喚と遅延破壊を保留した。任意選択や複雑なチェーン裁定、非公開ゾーンの参照には個別の設計が必要。本番Firebaseでの2端末対戦、切断からの復帰、iPhone・iPadの実機Safariと長時間対戦は追加検証が必要。
