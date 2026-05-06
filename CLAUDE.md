# mc-cheat — Minecraft Bedrock 自然言語自動操作ツール

## プロジェクト概要

WSL2上のMinecraft Bedrock Dedicated Server (BDS) で動作するビヘイビアパック。
チャット欄に自然言語で指示を入力すると、Script APIが直接OCPを呼び出してゲーム内アクションを実行する。
会社ブログ向けのデモ・教育コンテンツとして制作。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| ランタイム | Minecraft Bedrock Dedicated Server (BDS) on WSL2 |
| 言語 | TypeScript → esbuild でバンドル |
| Script API | `@minecraft/server` + `@minecraft/server-net` |
| AI推論 | Ollama Control Plane (OCP) — OpenAI互換API |
| クライアント | Windows版Minecraft（Windowsからlocalhost:19132で接続） |

## ディレクトリ構成

```
mc-cheat/
├── CLAUDE.md
├── .env                        # APIキー（gitignore済み）
├── .env.example
├── .gitignore
├── docs/
│   ├── requirements.md
│   └── design.md
├── behavior_pack/              # Minecraftビヘイビアパック本体
│   ├── manifest.json
│   ├── pack_icon.png
│   ├── permissions.json        # server-net有効化
│   ├── package.json
│   ├── tsconfig.json
│   ├── esbuild.config.mjs
│   └── scripts/
│       ├── main.ts             # エントリーポイント（チャットイベント登録）
│       ├── planner.ts          # OCP API呼び出し → アクションリスト生成
│       ├── executor.ts         # アクションリスト実行ループ
│       └── actions.ts          # 個別アクションハンドラ
└── setup/
    ├── install_bds.sh          # BDS + WSL2 セットアップスクリプト
    └── port_forward.ps1        # Windowsポートフォワード設定
```

## 開発コマンド（WSL2内で実行）

```bash
# セットアップ
cd behavior_pack
npm install

# ビルド（scriptsディレクトリにバンドル生成）
npm run build

# BDS起動
cd ~/bds
./bedrock_server

# ビルド＆BDSリスタート
npm run deploy
```

## BDS接続設定

WindowsのMinecraftクライアントから接続:
- サーバーアドレス: `localhost` (または WSL2 IP: `172.x.x.x`)
- ポート: `19132`

WSL2ポートフォワード（PowerShellを管理者で実行）:
```powershell
.\setup\port_forward.ps1
```

## 重要な制約

- `@minecraft/server-net` は BDS 上でのみ動作（Windowsクライアント単体不可）
- `permissions.json` に `@minecraft/server-net` の許可が必要
- ビヘイビアパックは実験的機能「Beta APIs」を有効にする必要がある
- チートコマンドは BDS の `server.properties` で `allow-cheats=true` が前提

## AIモデル設定

- エンドポイント: `https://ocp.pontium.org/v1`（`@minecraft/server-net` から直接呼び出し）
- APIキーはビルド時に環境変数から埋め込む（`esbuild define`）
- デフォルトモデル: 環境変数 `OCP_MODEL` で指定

## コーディング規則

- コメントは日本語OK（ブログ記事向け可読性を優先）
- 関数名は英語キャメルケース（TypeScript慣習）
- アクション定義は `actions.ts` に集約
- エラーはプレイヤーにチャットメッセージで通知（`player.sendMessage()`）
