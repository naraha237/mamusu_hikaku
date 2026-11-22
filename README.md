# ウマ娘 比較ノート(mamusu_hikaku)

『ウマ娘 プリティーダービー』PC版(DMM GAMES / Steam)の殿堂入りウマ娘を最大5人並べて、
ステータス・適性・スキルの違いをひと目で比べる Windows 用アプリです。

> いまは **段階1(ひな形と配布の仕組み)** までできています。比較の機能はこれから作ります。

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
