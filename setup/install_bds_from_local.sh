#!/bin/bash
# Windowsでダウンロード済みの /tmp/bds.zip からBDSをセットアップする
# 事前にWindows側で以下を実行してください:
#   Invoke-WebRequest -Uri "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.20.5.zip" -OutFile "$env:TEMP\bds.zip"
#   Copy-Item "$env:TEMP\bds.zip" "\\wsl$\Ubuntu\tmp\bds.zip"

set -e

BDS_VERSION="${1:-1.26.20.5}"
BDS_DIR="${HOME}/bds"
PACK_DIR="$(dirname "$(realpath "$0")")/../behavior_pack"
ZIP="/tmp/bds.zip"

if [ ! -f "${ZIP}" ]; then
  echo "エラー: ${ZIP} が見つかりません。"
  echo "Windows PowerShellで先に以下を実行してください:"
  echo '  Invoke-WebRequest -Uri "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.26.20.5.zip" -OutFile "$env:TEMP\bds.zip"'
  echo '  Copy-Item "$env:TEMP\bds.zip" "\\wsl$\Ubuntu\tmp\bds.zip"'
  exit 1
fi

echo "=== BDS ${BDS_VERSION} のセットアップを開始します ==="

# ── 依存パッケージ ─────────────────────────────────────────────────────────
echo ">>> 依存パッケージのインストール..."
sudo apt-get update -qq
sudo apt-get install -y -qq unzip libcurl4 libssl-dev jq

# ── 展開 ──────────────────────────────────────────────────────────────────
echo ">>> 展開中..."
mkdir -p "${BDS_DIR}"
unzip -q -o "${ZIP}" -d "${BDS_DIR}"
chmod +x "${BDS_DIR}/bedrock_server"

# ── server.properties 設定 ────────────────────────────────────────────────
echo ">>> server.properties を設定..."
PROPS="${BDS_DIR}/server.properties"
sed -i 's/^allow-cheats=false/allow-cheats=true/' "${PROPS}"
sed -i 's/^online-mode=true/online-mode=false/' "${PROPS}"
sed -i 's/^gamemode=survival/gamemode=creative/' "${PROPS}"
sed -i 's/^view-distance=32/view-distance=12/' "${PROPS}"

# ── permissions.json（server-net有効化） ──────────────────────────────────
echo ">>> permissions.json を配置..."
cat > "${BDS_DIR}/permissions.json" <<'EOF'
{
  "allowed_modules": [
    "@minecraft/server-net"
  ]
}
EOF

# ── ビヘイビアパックのビルドと配置 ────────────────────────────────────────
echo ">>> ビヘイビアパックをビルド..."
cd "${PACK_DIR}"
npm install --silent
npm run build

echo ">>> ビヘイビアパックを BDS に配置..."
DEST="${BDS_DIR}/behavior_packs/mc-cheat"
mkdir -p "${DEST}/scripts"
cp manifest.json "${DEST}/"
cp scripts/main.js "${DEST}/scripts/"

# ── world_behavior_packs.json 設定 ────────────────────────────────────────
echo ">>> ワールドにビヘイビアパックを登録..."
WORLD_DIR="${BDS_DIR}/worlds/Bedrock level"
mkdir -p "${WORLD_DIR}"

PACK_UUID=$(jq -r '.header.uuid' "${DEST}/manifest.json")
cat > "${WORLD_DIR}/world_behavior_packs.json" <<EOF
[
  {
    "pack_id": "${PACK_UUID}",
    "version": [1, 0, 0]
  }
]
EOF

echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "BDS起動方法:"
echo "  cd ${BDS_DIR} && LD_LIBRARY_PATH=. ./bedrock_server"
echo ""
echo "Windows側でポートフォワードを設定してください（管理者PowerShell）:"
echo "  .\\setup\\port_forward.ps1"
echo ""
echo "Minecraftで接続: サーバーアドレス = localhost, ポート = 19132"
