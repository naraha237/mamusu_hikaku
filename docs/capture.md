# 画面の取り込み(ライブキャプチャ)で使っている Windows API

このアプリは、ゲームの画面を **見るだけ** です。ゲームへの入力、ゲームのプロセスへのアクセス、
ゲームのウィンドウの操作・描画は一切しません。

ウィンドウの検出と取り込みの処理は、すべて `src-tauri/src/capture/` にあります。

| ファイル | 役割 |
|---|---|
| `capture/window.rs` | ゲームのウィンドウを探す(タイトルとクラス名だけで判定)、閉じたか・最小化されたかを調べる |
| `capture/wgc.rs` | Windows Graphics Capture で映像を受け取る |
| `capture/mod.rs` | 間引き・重複の除去・自動停止・読み取りへの受け渡し・アプリの画面への知らせ |

## 使っている API

### ウィンドウを探す・様子を見る(`capture/window.rs`)

すべて「読むだけ」の API です。

| API | 使い道 |
|---|---|
| `EnumWindows` | OS のトップレベルウィンドウの一覧を得る |
| `IsWindowVisible` | 表示中のウィンドウだけにしぼる |
| `GetWindowTextW` | ウィンドウのタイトルを読む |
| `GetClassNameW` | ウィンドウのクラス名を読む |
| `IsWindow` | ゲームのウィンドウが閉じられていないかを調べる |
| `IsIconic` | ゲームのウィンドウが最小化されていないかを調べる(最小化中は取り込みを一時停止する) |

プロセスのハンドルは開きません(`OpenProcess` も `GetWindowThreadProcessId` も使いません)。

### 映像を受け取る(`capture/wgc.rs`)

| API | 使い道 |
|---|---|
| `IGraphicsCaptureItemInterop::CreateForWindow` | 見つけたウィンドウ(HWND)から取り込み対象を作る |
| `GraphicsCaptureItem.Size` | 取り込み対象の大きさを得る |
| `D3D11CreateDevice` | 映像を受け取るための GPU のデバイスを作る(アプリ自身のもの) |
| `CreateDirect3D11DeviceFromDXGIDevice` | 上のデバイスを Windows Graphics Capture で使える形にする |
| `Direct3D11CaptureFramePool.CreateFreeThreaded` / `Recreate` / `TryGetNextFrame` / `FrameArrived` / `Close` | 映像を受け取る(ウィンドウの大きさが変わったら受け取る側を作り直す) |
| `Direct3D11CaptureFramePool.CreateCaptureSession` | 取り込みの開始の準備 |
| `GraphicsCaptureSession.SetIsCursorCaptureEnabled(false)` | マウスカーソルを写さない |
| `GraphicsCaptureSession.StartCapture` / `Close` | 取り込みを始める・止める |
| `IDirect3DDxgiInterfaceAccess::GetInterface` | 受け取った映像を GPU の画像として扱う |
| `ID3D11Device::CreateTexture2D`、`ID3D11DeviceContext::CopyResource` / `Map` / `Unmap` | 受け取った映像を、アプリのメモリにコピーして読む |

取り込み中は、Windows がゲームのウィンドウのまわりに黄色い枠を表示します。これは OS の機能で、
アプリはゲームのウィンドウに何も描いていません(枠を消す `IsBorderRequired` も使っていません)。

### 自分で選ぶ(`capture/mod.rs`)

ゲームのウィンドウが自動で見つからないときだけ使います。

| API | 使い道 |
|---|---|
| `GraphicsCapturePicker.PickSingleItemAsync` | Windows 標準のウィンドウ選択画面を出す |
| `IInitializeWithWindow::Initialize` | 上の選択画面を、**このアプリの** 窓の上に出す |

## 使っていないもの(レビューの確認用)

次の API は、このアプリのどこでも使っていません。

- 入力の送出:`SendInput`、`PostMessage`、`SendMessage`、`keybd_event`、`mouse_event`
- プロセスへのアクセス:`OpenProcess`、`ReadProcessMemory`、`WriteProcessMemory`、`CreateRemoteThread`、`SetWindowsHookEx`
- ウィンドウの操作:`SetWindowPos`、`MoveWindow`、`SetForegroundWindow`、`BringWindowToTop`、`ShowWindow`、`SetWindowLong`

次のコマンドで、ソースコードに含まれていないことを確かめられます(何も表示されなければ OK)。

```powershell
Get-ChildItem -Recurse src-tauri\src -Filter *.rs | Select-String -Pattern 'SendInput|PostMessage|SendMessage|keybd_event|mouse_event|OpenProcess|ReadProcessMemory|WriteProcessMemory|CreateRemoteThread|SetWindowsHookEx|SetWindowPos|MoveWindow|SetForegroundWindow|BringWindowToTop|ShowWindow|SetWindowLong'
```

## キー(ホットキー)について

取り込みの開始・停止のキー(既定は Ctrl+Alt+U)は、`tauri-plugin-global-shortcut`(Windows の `RegisterHotKey`)で
**OS にキーを登録して、押されたことを受け取るだけ** です。ゲームにキーを送ることはありません。

## 取り込んだ映像の扱い

- 映像はメモリの中でだけ扱い、秒間 2〜4 枚(設定ファイルの `capture.framesPerSecond`)に間引きます。
- 前の画像とほぼ同じものは捨てます。読み取りは1枚ずつ順番に行います(PC が重くならないように)。
- 確認・修正画面を閉じると捨てます。PC の外には送りません。
