// esbuild の define で埋め込まれるビルド時定数
declare const __OCP_BASE_URL__: string;
declare const __OCP_API_KEY__:  string;
declare const __OCP_MODEL__:    string;

export { __OCP_BASE_URL__, __OCP_API_KEY__, __OCP_MODEL__ };

// ─── ゲーム状態（LLMに渡すコンテキスト） ───────────────────────────────────

export interface GameState {
  location:  { x: number; y: number; z: number };
  rotation:  { x: number; y: number };
  gameMode:  string;
  health:    number;
  maxHealth: number;
  dimension: string;
}

// ─── アクション型定義 ───────────────────────────────────────────────────────

export interface CommandAction {
  type: "command";
  value: string;        // Minecraftコマンド (/give, /tp, /gamemode 等)
  description?: string;
}

export interface TeleportAction {
  type: "teleport";
  x: number;
  y: number;
  z: number;
  description?: string;
}

export interface MessageAction {
  type: "message";
  text: string;         // プレイヤーへのチャットメッセージ
  description?: string;
}

export interface ImpulseAction {
  type: "impulse";
  x: number;
  y: number;
  z: number;            // ベクトル（y正で上方向）
  description?: string;
}

export interface WaitAction {
  type: "wait";
  duration: number;     // 秒
  description?: string;
}

export interface TitleAction {
  type: "title";
  text: string;         // 画面中央のタイトル表示
  description?: string;
}

export type Action =
  | CommandAction
  | TeleportAction
  | MessageAction
  | ImpulseAction
  | WaitAction
  | TitleAction;

export const ALLOWED_TYPES: Action["type"][] = [
  "command", "teleport", "message", "impulse", "wait", "title",
];
