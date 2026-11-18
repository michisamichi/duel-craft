DUEL CRAFT v0.6.2 起動修復版

■ 変更点
・Firebase設定ファイルを読み込めなくても、ホーム画面とお試し対戦が起動
・iPhoneのアプリ内ブラウザで保存領域が禁止されても画面が止まらないよう対処
・JavaScript読み込み失敗時に、8秒以内に診断メッセージを表示
・9つのJS/HTML/CSSファイルのキャッシュ版を揃えた
・エラー表示時のみ、ゲームの端末データ初期化ボタンを用意（自動削除しない）

■ 更新方法
1. 解凍して、 index.html / app.js / cards.js / decks.js / engine.js / fx.js / packs.js / rules.js / style.css の9ファイルをGitHubリポジトリのトップにアップロードして上書き。
2. Commit changesを押す。
3. https://michisamichi.github.io/duel-craft/?v=62 をSafariで開く。

■ とても重要
firebase-config.js、database.rules.json、manifest.webmanifestは触らないでください。
端末のカードやデッキは自動で削除しません。初期化は起動エラー画面でユーザーが明示的に押したときのみです。
更新後、ホームが表示されてもオンライン対戦が未設定と出る場合はfirebase-config.jsの内容を確認してください。
