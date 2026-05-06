import { world, system } from "@minecraft/server";
import { handleChatCommand } from "./executor";

// チャットイベントを監視して "!ai " プレフィックスを検知する
world.beforeEvents.chatSend.subscribe((event) => {
  const { message, sender } = event;

  if (!message.startsWith("!ai ") && message !== "!ai help") return;

  // イベントをキャンセルしてチャットログに流れないようにする
  event.cancel = true;

  const instruction = message.startsWith("!ai ")
    ? message.slice(4).trim()
    : "help";

  if (!instruction) {
    // system.run でないと beforeEvents のコールバック内で sendMessage できない
    system.run(() => sender.sendMessage("§c[mc-cheat] 指示が空です。例: !ai ダイヤを64個ちょうだい"));
    return;
  }

  // 非同期処理は system.run で次ティック以降に実行する
  system.run(async () => {
    await handleChatCommand(sender, instruction);
  });
});

console.log("[mc-cheat] 起動しました。チャットで !ai <指示> と入力してください。");
