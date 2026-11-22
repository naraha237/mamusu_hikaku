# ウマ娘 比較ノート(mamusu_hikaku)

『ウマ娘 プリティーダービー』PC版(DMM GAMES / Steam)の殿堂入りウマ娘を最大5人並べて、
ステータス・適性・スキルの違いをひと目で比べる Windows 用アプリです。

> いまは **段階5(ライブキャプチャ)** までできています。共有・バックアップ・初回の案内はこれから作ります。

## 使い方(いまできること)

1. 「ウマ娘一覧」→「新しく登録する」で、ウマ娘を手で入れます(スキルはひらがなでも候補が出ます)。
   試すだけなら、一覧が空のときに出る「お試し用のウマ娘を5人入れてみる」を押します。
2. 一覧で比べたい人にチェックを付け(5人まで)、「くらべる」を押します。
3. 「ステータス・適性」「スキル」「2人のスキルの差」のタブで比べます。
   列の見出しの ⠿ をドラッグすると並べ替えられ、「この組み合わせを保存」で組み合わせを残せます。

### ゲームの画面から取り込む(ライブキャプチャ)

1. ゲームで殿堂入りウマ娘の「ウマ娘詳細」を開きます。
2. アプリの「画像から取り込む」→「取り込み開始」を押します(または Ctrl+Alt+U)。
   初めてのときだけ、見つけたゲームの画面を出して「このウィンドウで合っていますか?」と確認します。
3. 小さな案内の窓が出るので、その速さを目安に、スキル欄を自分の手で下へスクロールします。
4. 「停止」を押すか、画面が5秒間変わらないと自動で止まり、確認・修正画面が開きます。

取り込み中は、Windows がゲームの窓のまわりに黄色い枠を表示します。アプリはゲームの画面を見るだけで、
操作はしません(使っている Windows API の一覧は [docs/capture.md](docs/capture.md))。

### スクリーンショットから取り込む

1. ゲームで殿堂入りウマ娘の「ウマ娘詳細」を開き、スキル欄を少しずつスクロールしながら何枚か撮ります
   (Steam の F12、または Win+Shift+S)。
2. 「画像から取り込む」に、画像をドラッグ&ドロップ/「画像を選ぶ」/Ctrl+V で貼り付け/フォルダをまとめて読み込み します。
3. 「読み取って確認する」を押すと、名前・評価点・ステータス・適性・スキル・顔の画像を読み取ります。
4. 確認画面で黄色(要確認)の項目を、左の画像と見比べて直し、「保存する」を押します。
   - ◎・○ の記号は小さい画面だと読めないことがあります。候補のボタンで選び直せます。
   - 一覧にないスキルは「自分のスキルとして登録」できます(設定画面で編集・削除も可能)。
   - 評価ランク(UG など)は絵なので読み取れません。手で入れてください。

ゲームの窓が大きいほど正しく読み取れます(全画面だとほぼそのまま使えます)。
読み取りは PC の中(Windows 標準の文字認識)で行い、画像を外に送ることはありません。

データは `%APPDATA%\com.naraha237.mamusuhikaku\mamusu.db`(SQLite)に保存されます。
スキルのアイコンは GameTora から取得して、同じフォルダの `icons\` に保存します。

## このアプリがしないこと

アカウント停止のおそれがあるため、ゲームについて次のことは一切しません。

- ゲームへの入力の送出(クリック・キー入力など)
- ゲームのプロセスへのアクセス(メモリの読み書き、注入、フックなど)
- ゲームの通信やファイルへのアクセス
- ゲームのウィンドウへの描画や、ウィンドウの移動・サイズ変更・前面化

ゲームの画面は、ユーザーが「取り込み開始」を押してから「停止」を押すまでの間だけ、
Windows 標準の画面取り込みの仕組みで受け取ります(段階5で実装)。

## 必要な環境

- 使う人:Windows 10(1903 以降)/ 11(64bit)
- 開発する人:
  - Node.js 22 / npm 10
  - Rust(rustup で入れた stable)
  - Visual Studio 2022 Build Tools(「C++ によるデスクトップ開発」)

## 開発のしかた

```powershell
npm install
```

```powershell
npm run tauri dev
```

画面だけをブラウザで確かめるとき(Tauri の代わりに `src/devMock.ts` が動き、データはブラウザの中に保存されます):

```powershell
npm run dev
```

その後、ブラウザで <http://localhost:1420> を開きます。
画像の読み取りを試すときは、先に試験用の読み取りプログラムを作っておきます(開発サーバーがこれを呼びます)。

```powershell
cargo build --release --manifest-path src-tauri\Cargo.toml --example analyze
```

読み取りだけをコマンドで試す(`MAMUSU_DEBUG_DIR` を指定すると、切り出した画像も保存されます):

```powershell
.\src-tauri\target\release\examples\analyze.exe samples\fullsc1.jpg
```

`samples\` に置いたゲームの画像は、git に入りません。

インストーラーを手元で作るとき(`src-tauri\target\release\bundle\nsis\` にできます):

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .secrets\updater.key -Raw; npm run tauri build
```

## 設定ファイル

既定の設定は `src-tauri/resources/default-config.json` にあります(ビルド時に exe に埋め込みます)。

| 項目 | 内容 |
|---|---|
| `gameWindow.candidates` | ゲームのウィンドウを探す条件(タイトルとクラス名) |
| `capture` | 取り込みの頻度、自動停止までの秒数、ホットキー |
| `skillMaster` | スキル一覧の配信URL、Wiki のURL、キャッシュ時間 |
| `update.releasesPageUrl` | 単体版で更新があったときに開くページ |

自動更新の確認先(`latest.json` のURL)と公開鍵は `src-tauri/tauri.conf.json` の `plugins.updater` にあります。

## イベントの予定

- 取得元:[ウマ娘 プリティーダービー 公式ポータルサイト「お知らせ」](https://umamusume.jp/news/)。
  お知らせの一覧(ページが自分で読み込んでいる `/api/ajax/pr_info_index`)の1ページ目から、
  「○月～○月対戦レースイベント」(半年分の予定)と、最近のチャンピオンズミーティング・リーグ オブ ヒーローズの開催のお知らせ(最大6件)を読み、
  開催期間・コース・特殊ルールを `data/events.json` にまとめます(`scripts/sync-events.ts`)。
- スキル一覧と同じ GitHub Actions で毎日取得し、アプリは起動時に GitHub の `data/events.json` を確認します。
- アプリの「イベント」画面で、これからのイベントと、コースに合う(バ場・距離の適性が A 以上の)登録ウマ娘を表示します。

手元で取得し直すとき:

```powershell
npm run sync-events -- --force
```

## スキルの一覧

- 取得元:
  - [Umamusume Wiki「Game:List of Skills」](https://umamusu.wiki/Game:List_of_Skills)(CC BY-SA)。
    記事ページのHTMLだけを取得します(robots.txt で禁止されている `/w/` 以下や API は使いません)。
  - [GameTora](https://gametora.com/umamusume/skills)。スキルのデータ(`/data/umamusume/skills.<版>.json`)から
    日本語の説明・進化スキル・アイコン番号を取り、名前の読み(ひらがな検索用)は kuromoji で付けます。
- 同じスキル ID なら GameTora の内容を優先し、英語名などを Wiki でおぎないます。
- `data/skills.json` が配布用の一覧です。アプリにも同梱され、オフラインのときに使われます。
- GitHub Actions(`.github/workflows/sync-skills.yml`)が毎日 日本時間 3:15 に Wiki を確認し、
  変わっていればコミットします。**件数が1割以上減ったときは更新せずに失敗します**(GitHub からメールが届きます)。
  そのときは Wiki のページの形が変わっていないか確かめ、`src/lib/skills/wikiParser.ts` を直してください。
- アプリは起動時に GitHub の `data/skills.json` を取得します。取得できないときだけ Wiki から直接取得し(24時間に1回まで)、
  それもできなければ前回の分か同梱の分を使います。

手元で取得し直すとき(24時間以内でも取得するなら `-- --force` を付けます):

```powershell
npm run sync-skills
```

Actions の画面から手動で動かすこともできます:<https://github.com/naraha237/mamusu_hikaku/actions/workflows/sync-skills.yml> の「Run workflow」。

---

## 配布する人向けの手順

コマンドは PowerShell にそのまま貼り付けて実行できます。

### 1. GitHub にリポジトリを作る(最初の1回だけ)

1. ブラウザで <https://github.com/new> を開く
2. Repository name に `mamusu_hikaku` と入力し、**Public** を選ぶ
   (自動更新とスキル一覧の配信に、公開リポジトリが必要です)
3. 「Add a README」などのチェックは**付けずに**「Create repository」を押す
4. このフォルダで、次を実行する

```powershell
git remote add origin https://github.com/naraha237/mamusu_hikaku.git
```

```powershell
git push -u origin main
```

### 2. 自動更新用の署名鍵を GitHub に登録する(最初の1回だけ)

署名鍵は `.secrets\updater.key` にあります(git には入れていません)。

> **重要**:この鍵をなくすと、配ったアプリを自動更新できなくなります。
> `.secrets` フォルダを USB メモリなど、別の場所にもコピーしておいてください。

1. 次のコマンドで鍵の中身をクリップボードにコピーする

```powershell
Get-Content .secrets\updater.key -Raw | Set-Clipboard
```

2. ブラウザで <https://github.com/naraha237/mamusu_hikaku/settings/secrets/actions> を開く
3. 「New repository secret」を押し、Name に `TAURI_SIGNING_PRIVATE_KEY`、Secret に貼り付けて「Add secret」
4. 鍵にはパスワードを付けていないので、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` の登録は不要です

### 3. リリースを出す

変更をすべてコミットしてから、バージョンを上げてタグを push します。

```powershell
npm version patch
```

```powershell
git push --follow-tags
```

- `npm version patch` は 0.1.0 → 0.1.1 のように上げ、コミットとタグ(v0.1.1)を作ります。
  大きめの更新なら `minor`(0.1.0 → 0.2.0)にします。
- タグを push すると GitHub Actions が動き、10〜20分ほどで Releases に次の2つが公開されます。
  - `MamusuHikaku_0.1.1_x64-setup.exe`(インストーラー版)
  - `MamusuHikaku_0.1.1_portable.exe`(単体版)
- 進み具合は <https://github.com/naraha237/mamusu_hikaku/actions> で見られます。

### 4. 家族にダウンロード先を伝える

いつでも最新版を指す、次のURLを LINE などで送ってください。

<https://github.com/naraha237/mamusu_hikaku/releases/latest>

インストーラー版を入れた人は、次から新しい版を出すとアプリに「新しいバージョンがあります」と出て、
ボタン1つで更新できます。単体版の人には、ダウンロードページを開くボタンが出ます。

### 単体版について

- インストール不要ですが、自動更新(ボタン1つでの更新)と、共有ファイルのダブルクリックでの読み込みは使えません。
- Windows 10 で WebView2 が入っていない PC では起動できません。その場合はインストーラー版を使ってください
  (インストーラーが WebView2 を自動で入れます)。
- データの保存場所はどちらの版も同じなので、版を変えてもデータは引き継がれます。
