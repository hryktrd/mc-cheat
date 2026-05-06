# 設計書 — mc-cheat

**バージョン**: 2.0  
**作成日**: 2026-05-06

---

## 1. アーキテクチャ概要

```
Windows Minecraft クライアント
        │
        │ UDP 19132（WSL2ポートフォワード経由）
        ▼
┌────────────────────────────────────────┐
│  WSL2 (Ubuntu 22.04)                   │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  Bedrock Dedicated Server (BDS)  │  │
│  │                                  │  │
│  │  ┌────────────────────────────┐  │  │
│  │  │  Behavior Pack (TypeScript)│  │  │
│  │  │                            │  │  │
│  │  │  main.ts                   │  │  │
│  │  │   └─ チャットイベント監視   │  │  │
│  │  │                            │  │  │
│  │  │  planner.ts                │  │  │
│  │  │   └─ OCP HTTP呼び出し      │──┼──┼──► https://ocp.pontium.org/v1
│  │  │      @minecraft/server-net │  │  │
│  │  │                            │  │  │
│  │  │  executor.ts               │  │  │
│  │  │   └─ アクション実行ループ   │  │  │
│  │  │                            │  │  │
│  │  │  actions.ts                │  │  │
│  │  │   └─ 個別ハンドラ          │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**ポイント: 外部ブリッジ不要。** BDS内のScript APIが直接OCPにHTTPリクエストを送る。

---

## 2. WSL2セットアップ

### 2.1 BDSインストール (`setup/install_bds.sh`)

```bash
#!/bin/bash
# BDS最新版をダウンロードして展開
BDS_VERSION="1.21.x.x"
wget "https://minecraft.azureedge.net/bin-linux/bedrock-server-${BDS_VERSION}.zip"
unzip bedrock-server-${BDS_VERSION}.zip -d ~/bds
chmod +x ~/bds/bedrock_server

# server.properties 設定
sed -i 's/allow-cheats=false/allow-cheats=true/' ~/bds/server.properties
sed -i 's/online-mode=true/online-mode=false/' ~/bds/server.properties
```

### 2.2 ポートフォワード (`setup/port_forward.ps1`)

WSL2はNAT構成のため、Windowsから `localhost:19132` でBDSに繋ぐにはポート転送が必要。

```powershell
# 管理者権限で実行
$wslIp = (wsl hostname -I).Trim().Split(" ")[0]
netsh interface portproxy add v4tov4 `
  listenport=19132 listenaddress=0.0.0.0 `
  connectport=19132 connectaddress=$wslIp protocol=udp
Write-Host "ポートフォワード設定完了: localhost:19132 -> ${wslIp}:19132"
```

> WSL2再起動のたびにIPが変わるため、BDS起動時に自動実行するか、WSLのミラーモードを検討。

### 2.3 ビヘイビアパックの配置

```bash
# BDSのビヘイビアパックディレクトリにコピー
cp -r behavior_pack/ ~/bds/behavior_packs/mc-cheat/

# world_behaviorpacks.json に追加
# （manifest.jsonのUUIDを参照）
```

---

## 3. ビヘイビアパック構成

### 3.1 `manifest.json`

```json
{
  "format_version": 2,
  "header": {
    "name": "mc-cheat",
    "description": "Natural language AI agent",
    "uuid": "<<生成したUUID>>",
    "version": [1, 0, 0],
    "min_engine_version": [1, 21, 0]
  },
  "modules": [
    {
      "type": "script",
      "language": "javascript",
      "uuid": "<<生成したUUID>>",
      "version": [1, 0, 0],
      "entry": "scripts/main.js"
    }
  ],
  "dependencies": [
    { "module_name": "@minecraft/server",     "version": "1.14.0-beta" },
    { "module_name": "@minecraft/server-net", "version": "1.0.0-beta"  }
  ]
}
```

### 3.2 `permissions.json`

```json
{
  "allowed_modules": [
    "@minecraft/server-net"
  ]
}
```

> これがないと `server-net` が動作しない。BDSのルートディレクトリに配置。

---

## 4. モジュール設計

### 4.1 `scripts/main.ts` — エントリーポイント

```typescript
import { world } from "@minecraft/server";
import { handleChatCommand } from "./executor";

// チャットイベントを監視してトリガーワードを検知
world.beforeEvents.chatSend.subscribe((event) => {
  const { message, sender } = event;

  if (!message.startsWith("!ai ")) return;

  // デフォルトのチャット送信をキャンセル（コマンド入力を隠す）
  event.cancel = true;

  const instruction = message.slice(4).trim();
  handleChatCommand(sender, instruction);
});
```

### 4.2 `scripts/planner.ts` — AI呼び出し

```typescript
import { http, HttpRequest, HttpRequestMethod } from "@minecraft/server-net";

const OCP_BASE_URL = "%%OCP_BASE_URL%%";  // esbuild defineで差し替え
const OCP_API_KEY  = "%%OCP_API_KEY%%";
const OCP_MODEL    = "%%OCP_MODEL%%";

export interface Action {
  type: "command" | "teleport" | "message" | "impulse" | "wait" | "title";
  [key: string]: unknown;
}

export async function plan(
  instruction: string,
  gameState: GameState
): Promise<Action[]> {

  const body = JSON.stringify({
    model: OCP_MODEL,
    messages: [
      { role: "system", content: buildSystemPrompt(gameState) },
      { role: "user",   content: instruction },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const req = new HttpRequest(`${OCP_BASE_URL}/chat/completions`)
    .setMethod(HttpRequestMethod.Post)
    .addHeader("Content-Type",  "application/json")
    .addHeader("Authorization", `Bearer ${OCP_API_KEY}`)
    .setBody(body)
    .setTimeout(30);

  const res = await http.request(req);

  if (res.status !== 200) {
    throw new Error(`OCP API error: ${res.status} ${res.body}`);
  }

  const parsed = JSON.parse(res.body);
  const content = parsed.choices[0].message.content;
  const actions = JSON.parse(content) as { actions: Action[] };

  return actions.actions;
}
```

### 4.3 `scripts/executor.ts` — アクション実行

```typescript
import { Player } from "@minecraft/server";
import { plan } from "./planner";
import { executeAction, getGameState } from "./actions";

export async function handleChatCommand(
  player: Player,
  instruction: string
): Promise<void> {
  player.sendMessage("§e考え中...");

  try {
    const gameState = getGameState(player);
    const actions   = await plan(instruction, gameState);

    console.log(`[mc-cheat] actions: ${JSON.stringify(actions)}`);

    for (const action of actions) {
      await executeAction(player, action);
    }

    player.sendMessage("§a完了しました");

  } catch (err) {
    console.error(`[mc-cheat] error: ${err}`);
    player.sendMessage(`§cエラー: ${err}`);
  }
}
```

### 4.4 `scripts/actions.ts` — アクションハンドラ

```typescript
import { Player, system } from "@minecraft/server";
import type { Action } from "./planner";

// ゲーム状態をLLMに渡すために収集
export function getGameState(player: Player): GameState {
  const health = player.getComponent("minecraft:health");
  return {
    location:  player.location,
    rotation:  player.getRotation(),
    gameMode:  player.getGameMode(),
    health:    health?.currentValue ?? 0,
    maxHealth: health?.effectiveMax ?? 20,
    dimension: player.dimension.id,
  };
}

// アクションタイプ別ハンドラのディスパッチ
export async function executeAction(
  player: Player,
  action: Action
): Promise<void> {
  switch (action.type) {

    case "command":
      await player.dimension.runCommandAsync(action.value as string);
      break;

    case "teleport":
      player.teleport({ x: action.x as number, y: action.y as number, z: action.z as number });
      break;

    case "message":
      player.sendMessage(action.text as string);
      break;

    case "title":
      player.onScreenDisplay.setTitle(action.text as string);
      break;

    case "impulse":
      player.applyImpulse({ x: action.x as number, y: action.y as number, z: action.z as number });
      break;

    case "wait":
      // system.runTimeout は ticks 単位（20ticks = 1秒）
      await new Promise<void>((resolve) =>
        system.runTimeout(() => resolve(), Math.round((action.duration as number) * 20))
      );
      break;

    default:
      console.warn(`[mc-cheat] 未知のアクションタイプ: ${action.type}`);
  }
}
```

---

## 5. LLMアクションスキーマ

LLMが出力するJSON形式:

```json
{
  "actions": [
    { "type": "command",  "value": "/gamemode creative @s",        "description": "クリエイティブモードに変更" },
    { "type": "command",  "value": "/give @s diamond 64",          "description": "ダイヤモンド64個付与" },
    { "type": "wait",     "duration": 0.5,                         "description": "コマンド処理待ち" },
    { "type": "title",    "text": "§bダイヤモンド付与完了！",       "description": "タイトル表示" },
    { "type": "teleport", "x": 0, "y": 64, "z": 0,                "description": "原点にTP" },
    { "type": "impulse",  "x": 0, "y": 0.5, "z": 0,              "description": "上方向に打ち上げ" },
    { "type": "message",  "text": "現在地: {x}, {y}, {z}",         "description": "座標通知" }
  ]
}
```

---

## 6. ビルドパイプライン

### `esbuild.config.mjs`

```javascript
import { build } from "esbuild";
import { config } from "dotenv";

config({ path: "../.env" });  // プロジェクトルートの.envを読む

await build({
  entryPoints: ["scripts/main.ts"],
  bundle: true,
  outfile: "scripts/main.js",
  format: "esm",
  external: ["@minecraft/server", "@minecraft/server-net"],  // BDS提供なので外部扱い
  define: {
    "%%OCP_BASE_URL%%": JSON.stringify(process.env.OCP_BASE_URL),
    "%%OCP_API_KEY%%":  JSON.stringify(process.env.OCP_API_KEY),
    "%%OCP_MODEL%%":    JSON.stringify(process.env.OCP_MODEL),
  },
});
```

> APIキーはビルド時にJSバンドルに埋め込まれる。ブログ公開用コードはダミーキーでビルドすること。

---

## 7. システムプロンプト構造

```
あなたはMinecraft Bedrock Editionを操作するAIです。
ユーザーの指示をJSON形式のアクションリストに変換してください。

## 利用可能なアクションタイプ
[アクション定義]

## 現在のゲーム状態
座標: {x}, {y}, {z}
ゲームモード: {gameMode}
体力: {health}/{maxHealth}
ディメンション: {dimension}

## ルール
1. JSONのみ返す（{ "actions": [...] } 形式）
2. 最大20アクション
3. コマンド実行後は wait 0.5 を挿入
4. 座標を答えるときは message アクションを使う
```

---

## 8. 開発ロードマップ

| フェーズ | 内容 | 優先度 |
|---|---|---|
| Phase 1 | WSL2 + BDS セットアップ + パック読み込み確認 | 必須 |
| Phase 2 | チャットイベント検知 + OCP呼び出し + コマンド実行 | 必須 |
| Phase 3 | Script API直接操作（teleport, impulse, title）追加 | 必須 |
| Phase 4 | エラーハンドリング・リトライ・ホワイトリスト検証 | 中 |
| Phase 5 | ゲーム状態をLLMに渡して文脈理解を強化 | 中 |
| Phase 6 | 音声入力（Whisper連携） | 任意 |
