import { http, HttpRequest, HttpRequestMethod } from "@minecraft/server-net";
import type { Action, GameState } from "./types";
import { __OCP_BASE_URL__, __OCP_API_KEY__, __OCP_MODEL__, ALLOWED_TYPES } from "./types";

// ─── システムプロンプト ─────────────────────────────────────────────────────

function buildSystemPrompt(state: GameState): string {
  return `あなたはMinecraft Bedrock Editionを操作するAIエージェントです。
ユーザーの指示を JSON 形式のアクションリストに変換してください。

## 利用可能なアクションタイプ

\`\`\`json
{ "type": "command",  "value": "/give @s diamond 64"        }
{ "type": "teleport", "x": 0, "y": 64, "z": 0              }
{ "type": "message",  "text": "メッセージ"                   }
{ "type": "title",    "text": "§b画面中央に表示"             }
{ "type": "impulse",  "x": 0, "y": 0.5, "z": 0             }
{ "type": "wait",     "duration": 0.5                       }
\`\`\`

## よく使うMinecraftコマンド

- /gamemode creative|survival|adventure|spectator @s
- /give @s <item_id> <count>
- /tp @s <x> <y> <z>
- /time set day|night|noon|midnight
- /weather clear|rain|thunder
- /effect @s instant_health 1 255 true
- /effect @s saturation 10 255 true
- /xp <amount>L @s
- /difficulty peaceful|easy|normal|hard
- /kill @e[type=!player]
- /setblock <x> <y> <z> <block_id>

## 現在のゲーム状態

座標: x=${state.location.x.toFixed(1)}, y=${state.location.y.toFixed(1)}, z=${state.location.z.toFixed(1)}
向き: yaw=${state.rotation.y.toFixed(1)}, pitch=${state.rotation.x.toFixed(1)}
ゲームモード: ${state.gameMode}
体力: ${state.health}/${state.maxHealth}
ディメンション: ${state.dimension}

## ルール

1. 必ず JSON のみ返す（説明文・コードブロック不要）
2. 出力形式: { "actions": [ ... ] }
3. 最大 20 アクション
4. command 実行後は必ず wait 0.5 を挿入する
5. 座標を答えるときは message アクションで通知する
6. クリエイティブで飛ぶ場合は gamemode creative の後に impulse y:0.5 を使う`;
}

// ─── OCPへのリクエスト ──────────────────────────────────────────────────────

export async function plan(
  instruction: string,
  state: GameState,
): Promise<Action[]> {
  const body = JSON.stringify({
    model: __OCP_MODEL__,
    messages: [
      { role: "system", content: buildSystemPrompt(state) },
      { role: "user",   content: instruction },
    ],
    temperature: 0.2,
    // JSON出力を強制（モデルが対応していれば使う）
    response_format: { type: "json_object" },
  });

  const req = new HttpRequest(`${__OCP_BASE_URL__}/chat/completions`)
    .setMethod(HttpRequestMethod.Post)
    .addHeader("Content-Type",  "application/json")
    .addHeader("Authorization", `Bearer ${__OCP_API_KEY__}`)
    .setBody(body)
    .setTimeout(30);

  console.log(`[mc-cheat] OCP リクエスト: ${instruction}`);

  let res;
  try {
    res = await http.request(req);
  } catch (e) {
    throw new Error(`OCP への接続に失敗しました: ${e}`);
  }

  if (res.status !== 200) {
    throw new Error(`OCP API エラー: HTTP ${res.status}\n${res.body}`);
  }

  // レスポンスのJSONパース
  let parsed: { choices: { message: { content: string } }[] };
  try {
    parsed = JSON.parse(res.body) as typeof parsed;
  } catch {
    throw new Error(`OCP レスポンスのJSONパースに失敗: ${res.body.slice(0, 200)}`);
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new Error("OCP レスポンスにコンテンツがありません");

  console.log(`[mc-cheat] OCP レスポンス: ${content.slice(0, 300)}`);

  // アクションリストのパースと検証
  let result: { actions: Action[] };
  try {
    result = JSON.parse(content) as typeof result;
  } catch {
    // コードブロックに囲まれている場合は除去して再試行
    const stripped = content.replace(/```json\n?|\n?```/g, "").trim();
    result = JSON.parse(stripped) as typeof result;
  }

  if (!Array.isArray(result.actions)) {
    throw new Error("OCP レスポンスに actions 配列がありません");
  }

  // 許可されていないアクションタイプを除去
  const valid = result.actions.filter((a) => {
    if (!ALLOWED_TYPES.includes(a.type)) {
      console.warn(`[mc-cheat] 不明なアクションタイプをスキップ: ${a.type}`);
      return false;
    }
    return true;
  });

  return valid.slice(0, 20); // 最大20アクション
}
