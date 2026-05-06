# 要件定義書 — mc-cheat

**バージョン**: 2.0  
**作成日**: 2026-05-06  
**対象**: Minecraft Bedrock Dedicated Server (BDS) on WSL2  
**目的**: 会社ブログ向けデモ・教育コンテンツ

---

## 1. 背景・目的

LLMがゲームを自律操作するデモとして、Minecraft BDSを題材にした自然言語チートツールを開発する。  
Script APIの `@minecraft/server-net` モジュールを使ってBDS内から直接OCPを呼び出すことで、外部ブリッジなしにゲームとAIを連携させる。

**旧設計（v1）との違い:**

| 項目 | v1（廃止） | v2（本設計） |
|---|---|---|
| 実行環境 | Windows Python | WSL2上のBDS |
| 入力操作 | pyautogui（画面操作） | Script API（内部制御） |
| ゲーム状態取得 | OCRスクリーンキャプチャ | `@minecraft/server` API |
| AI呼び出し | Python → HTTP | Script API → `@minecraft/server-net` |
| 追加依存 | pywin32, mss, pytesseract | なし（全てBDS内で完結） |

---

## 2. スコープ

### 2.1 対象環境

| 項目 | 内容 |
|---|---|
| サーバー環境 | WSL2 (Ubuntu 22.04+) |
| BDSバージョン | 最新安定版 |
| クライアント | Windows版Minecraft（Storeアプリ） |
| 接続方式 | localhost:19132（WSL2ポートフォワード経由） |
| 前提 | BDS側で `allow-cheats=true` |

### 2.2 対象外

- Windowsクライアント単体での動作（`server-net` 非対応のため）
- Java Edition
- Realmsサーバー（`server-net` 非対応）
- マルチプレイ公開サーバーへの適用

---

## 3. 機能要件

### 3.1 チャットコマンドインターフェース

| ID | 要件 |
|---|---|
| F-01 | プレイヤーが `!ai <自然言語>` をチャットに入力すると処理が始まる |
| F-02 | `!ai` プレフィックスのないチャットは通常通り処理され干渉しない |
| F-03 | 処理開始時に「考え中...」メッセージをプレイヤーに送信する |
| F-04 | 実行完了または失敗時に結果メッセージをプレイヤーに送信する |
| F-05 | `!ai help` で利用可能な指示の例を表示する |

### 3.2 AIプランニング

| ID | 要件 |
|---|---|
| F-10 | `@minecraft/server-net` でOCPにHTTP POSTリクエストを送信する |
| F-11 | LLMへのプロンプトには指示文 + 現在のゲーム状態（座標・HP・ゲームモード）を含める |
| F-12 | LLMの出力はJSON形式のアクションリストとする |
| F-13 | JSON解析失敗時は最大2回リトライし、それでも失敗したらエラーメッセージを表示する |
| F-14 | 1回の指示で最大20アクションを生成する |

### 3.3 ゲーム状態取得

Script API経由で取得できる情報:

| ID | 情報 | 取得方法 |
|---|---|---|
| F-20 | プレイヤー座標 | `player.location` |
| F-21 | 現在のゲームモード | `world.gameMode` / `player.getGameMode()` |
| F-22 | 体力 | `player.getComponent('minecraft:health').currentValue` |
| F-23 | 満腹度 | `player.getComponent('minecraft:player.hunger').currentValue` |
| F-24 | 向いている方向 | `player.getRotation()` |
| F-25 | 現在いるディメンション | `player.dimension.id` |

### 3.4 実行可能アクション

#### コマンド系（`dimension.runCommandAsync()`）

| ID | アクション | コマンド例 |
|---|---|---|
| A-01 | ゲームモード変更 | `/gamemode creative @s` |
| A-02 | アイテム付与 | `/give @s diamond 64` |
| A-03 | テレポート | `/tp @s 0 64 0` |
| A-04 | 時刻変更 | `/time set day` |
| A-05 | 天候変更 | `/weather clear` |
| A-06 | 体力回復 | `/effect @s instant_health 1 255 true` |
| A-07 | 経験値付与 | `/xp 100L @s` |
| A-08 | 難易度変更 | `/difficulty peaceful` |
| A-09 | エンティティ削除 | `/kill @e[type=!player]` |
| A-10 | ブロック設置 | `/setblock <x> <y> <z> <block>` |
| A-11 | 任意コマンド | ユーザー指示の文字列をそのまま実行 |

#### Script API直接操作系

| ID | アクション | API |
|---|---|---|
| A-20 | テレポート（精密） | `player.teleport(location)` |
| A-21 | プレイヤーへのメッセージ | `player.sendMessage(text)` |
| A-22 | 速度ベクトル付与 | `player.applyImpulse(vector)` |
| A-23 | タイトル表示 | `player.onScreenDisplay.setTitle(text)` |
| A-24 | 遅延実行 | `system.runTimeout(callback, ticks)` |

### 3.5 ログ・デバッグ

| ID | 要件 |
|---|---|
| F-30 | 実行したアクションリストをBDSコンソールに出力する |
| F-31 | OCP APIのリクエスト・レスポンスをコンソールに出力する（デバッグ時） |
| F-32 | エラー発生時のスタックトレースをコンソールに出力する |

---

## 4. 非機能要件

| 項目 | 要件 |
|---|---|
| 応答性 | チャット送信からアクション開始まで5秒以内（LLM推論時間を除く） |
| 安全性 | APIキーはビルド時に埋め込む（ソースコードにハードコーディングしない） |
| 可読性 | ブログ記事として公開できるよう、主要部分にコメントを付ける |
| 拡張性 | `actions.ts` に関数を追加するだけで新アクションを追加できる |

---

## 5. 自然言語指示の例

| ユーザー入力 | 期待されるAI解釈 |
|---|---|
| `!ai ダイヤモンドを64個ちょうだい` | `/give @s diamond 64` |
| `!ai クリエイティブモードにして` | `/gamemode creative @s` |
| `!ai 昼にして晴れにして` | time set day → weather clear |
| `!ai 体力を全回復して` | instant_health effect |
| `!ai 座標0,64,0にテレポートして` | `player.teleport({x:0, y:64, z:0})` |
| `!ai 周りのモブを全部消して` | `/kill @e[type=!player]` |
| `!ai 今の座標を教えて` | `player.sendMessage(player.location)` |

---

## 6. 制約・リスク

| リスク | 対策 |
|---|---|
| `server-net` のHTTPはHTTPSのみ対応の可能性 | OCPエンドポイントがHTTPS前提なので問題なし |
| LLMが不正なコマンドを生成する | 許可コマンドのホワイトリスト検証を実装 |
| WSL2のポートフォワードが再起動で失われる | スタートアップスクリプトに登録する手順を提供 |
| BDSバージョン更新でScript APIの破壊的変更 | `package.json` でバージョン固定 |
| `server-net` のリクエストタイムアウト | 30秒でタイムアウト設定、ユーザーにフィードバック |
