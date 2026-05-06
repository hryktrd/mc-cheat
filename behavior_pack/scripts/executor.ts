import { Player } from "@minecraft/server";
import { plan } from "./planner";
import { getGameState, executeAction } from "./actions";

// ─── チャットコマンドのメイン処理 ───────────────────────────────────────────

export async function handleChatCommand(
  player: Player,
  instruction: string,
): Promise<void> {

  // ヘルプ表示
  if (instruction.trim() === "help") {
    showHelp(player);
    return;
  }

  player.sendMessage("§e[mc-cheat] 考え中...");

  let actions;
  try {
    const state = getGameState(player);
    actions = await plan(instruction, state);
  } catch (err) {
    player.sendMessage(`§c[mc-cheat] AIエラー: ${err}`);
    console.error(`[mc-cheat] plan() 失敗: ${err}`);
    return;
  }

  if (actions.length === 0) {
    player.sendMessage("§7[mc-cheat] 実行するアクションがありませんでした");
    return;
  }

  player.sendMessage(`§a[mc-cheat] ${actions.length}個のアクションを実行します`);

  // アクションを順番に実行
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    try {
      await executeAction(player, action);
    } catch (err) {
      player.sendMessage(`§c[mc-cheat] アクション${i + 1}でエラー: ${err}`);
      console.error(`[mc-cheat] executeAction() 失敗 (index=${i}): ${err}`);
      // エラーが出ても残りのアクションは続ける
    }
  }

  player.sendMessage("§a[mc-cheat] 完了しました ✓");
}

// ─── ヘルプメッセージ ───────────────────────────────────────────────────────

function showHelp(player: Player): void {
  player.sendMessage([
    "§b=== mc-cheat ヘルプ ===",
    "§f使い方: §e!ai <自然言語で指示>",
    "",
    "§f例:",
    "§7  !ai ダイヤモンドを64個ちょうだい",
    "§7  !ai クリエイティブモードにして",
    "§7  !ai 昼にして晴れにして",
    "§7  !ai 体力を全回復して",
    "§7  !ai 座標0,64,0にテレポートして",
    "§7  !ai 周りのモブを全部消して",
    "§7  !ai 今の座標を教えて",
  ].join("\n"));
}
