# SAHOVERSE v1.9.3 — 共通管理パスワード

## 1. GitHubへの更新
GitHubの `duel-craft` リポジトリの直下に `index.html`、`app.js`、`style.css` を上書きし、Commit changes。

## 2. Firebaseルールへの更新【必須】
同時に提供する別ファイル「SAHOVERSE_v1.9.3_Firebaseルール_非公開.json」をFirebaseコンソールの Realtime Database → ルールに全文貼り付けて「公開」。
**このルールファイルは公開GitHubリポジトリへアップロードしないでください。管理パスワードを含みます。**

## 3. 編集・削除
Safariで `https://michisamichi.github.io/duel-craft/?v=193` を開き、「カード管理」から管理パスワードを入力して解除。
新規カードだけでなく、以前ほかの端末で作成したカードもIDそのままで編集・削除できます。

## 注意
- `firebase-config.js` は削除・編集しないでください。
- Firebaseの「匿名」認証が有効である必要があります（従来の設定のまま）。
- パスワードはアプリの公開JSに書き込まずFirebaseルールで照合しますが、短いパスワードのため高度なセキュリティではありません。
- 解除した端末では「ロック」を押すと管理操作を終了できます。
- 元の `owner` / `id` を維持し、カードの画像・効果・デッキへの紐付けも残します。
- v1.9.1を基準とした差分更新。v1.9.2を未適用でも使用できます。
- iPhone実機2台での操作は未検証。
