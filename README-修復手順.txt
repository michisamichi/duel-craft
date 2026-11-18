DUEL CRAFT v0.6.1  起動できない場合の修復用ファイル

1. 既存のGitHubリポジトリ https://github.com/michisamichi/duel-craft を開く。
2. ZIPを解凍し、README以外の9ファイルをすべてリポジトリ直下へアップロードして上書きする。
3. Commit changesをタップする。
4. https://michisamichi.github.io/duel-craft/?v=61 をSafariで開く。

重要：firebase-config.jsを上書きしたり削除したりしないこと。
保存済みカードやデッキを保護するため、Safariの履歴・Webサイトデータを消さないこと。
Firebase Databaseルールの再設定は不要。

修復内容：v0.5/v0.6で使う依存ファイル9個を一式同梱、JS/CSSバージョン統一で古いキャッシュを回避、起動できない場合はエラー画面を表示。
