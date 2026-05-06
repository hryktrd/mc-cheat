import { build, context } from "esbuild";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// プロジェクトルートの .env を読み込む
config({ path: resolve(__dirname, "../.env") });

const required = ["OCP_BASE_URL", "OCP_API_KEY", "OCP_MODEL"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`.env に ${key} が設定されていません`);
}

const options = {
  entryPoints: ["scripts/main.ts"],
  bundle: true,
  outfile: "scripts/main.js",
  format: "esm",
  // Minecraftランタイムが提供するモジュールはバンドルしない
  external: ["@minecraft/server", "@minecraft/server-net"],
  define: {
    // APIキー等をビルド時に埋め込む（ソースに直書きしない）
    __OCP_BASE_URL__: JSON.stringify(process.env.OCP_BASE_URL),
    __OCP_API_KEY__:  JSON.stringify(process.env.OCP_API_KEY),
    __OCP_MODEL__:    JSON.stringify(process.env.OCP_MODEL),
  },
};

const isWatch = process.argv.includes("--watch");

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("ビルド監視中... (Ctrl+C で終了)");
} else {
  await build(options);
  console.log("ビルド完了: scripts/main.js");
}
