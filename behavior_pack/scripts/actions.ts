import { Player, system, GameMode } from "@minecraft/server";
import type { Action, GameState } from "./types";

// ─── ゲーム状態の取得 ───────────────────────────────────────────────────────

export function getGameState(player: Player): GameState {
  const health = player.getComponent("minecraft:health");

  // ゲームモードを文字列に変換
  const modeMap: Record<GameMode, string> = {
    [GameMode.survival]:  "survival",
    [GameMode.creative]:  "creative",
    [GameMode.adventure]: "adventure",
    [GameMode.spectator]: "spectator",
  };

  return {
    location:  player.location,
    rotation:  player.getRotation(),
    gameMode:  modeMap[player.getGameMode()] ?? "unknown",
    health:    health?.currentValue    ?? 0,
    maxHealth: health?.effectiveMax    ?? 20,
    dimension: player.dimension.id,
  };
}

// ─── アクション実行ディスパッチャ ──────────────────────────────────────────

export async function executeAction(
  player: Player,
  action: Action,
): Promise<void> {
  console.log(`[mc-cheat] 実行: ${JSON.stringify(action)}`);

  switch (action.type) {

    case "command": {
      // /give, /tp, /gamemode 等をサーバーコマンドとして実行
      await player.dimension.runCommandAsync(action.value);
      break;
    }

    case "teleport": {
      player.teleport(
        { x: action.x, y: action.y, z: action.z },
        { dimension: player.dimension },
      );
      break;
    }

    case "message": {
      // §カラーコード対応
      player.sendMessage(action.text);
      break;
    }

    case "title": {
      player.onScreenDisplay.setTitle(action.text);
      break;
    }

    case "impulse": {
      // プレイヤーに速度ベクトルを加算（y正で上昇）
      player.applyImpulse({ x: action.x, y: action.y, z: action.z });
      break;
    }

    case "wait": {
      // 1秒 = 20ティック
      const ticks = Math.max(1, Math.round(action.duration * 20));
      await waitTicks(ticks);
      break;
    }
  }
}

// ─── ユーティリティ ─────────────────────────────────────────────────────────

function waitTicks(ticks: number): Promise<void> {
  return new Promise((resolve) => system.runTimeout(resolve, ticks));
}
