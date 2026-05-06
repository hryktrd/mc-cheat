#!/bin/bash
# WSL2上にMinecraft Bedrock Dedicated Server (BDS) をセットアップするスクリプト
# バージョン省略時は Bedrock-OSS/BDS-Versions から自動取得します

set -e

BDS_DIR="${HOME}/bds"
PACK_DIR="$(dirname "$(realpath "$0")")/../behavior_pack"

# ── 依存パッケージ ─────────────────────────────────────────────────────────
echo ">>> 依存パッケージのインストール..."
sudo apt-get update -qq
sudo apt-get install -y -qq curl unzip libcurl4 libssl-dev jq

# ── BDSバージョン・ダウンロードURL の取得 ──────────────────────────────────
# 引数でバージョン指定があればそれを使い、なければ最新安定版を自動取得
if [ -n "$1" ]; then
  BDS_VERSION="$1"
  BDS_URL="https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-${BDS_VERSION}.zip"
else
  echo ">>> 最新BDSバージョンを取得中..."
  VERSIONS_JSON=$(curl -fsSL --http1.1 "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json")
  BDS_VERSION=$(echo "${VERSIONS_JSON}" | jq -r '.linux.stable')
  META_JSON=$(curl -fsSL --http1.1 "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/linux/${BDS_VERSION}.json")
  BDS_URL=$(echo "${META_JSON}" | jq -r '.download_url')
fi

echo "=== BDS ${BDS_VERSION} のセットアップを開始します ==="
echo "URL: ${BDS_URL}"

# ── BDSダウンロード ────────────────────────────────────────────────────────
echo ">>> BDS ${BDS_VERSION} をダウンロード中..."
mkdir -p "${BDS_DIR}"
curl -fsSL --http1.1 "${BDS_URL}" -o /tmp/bds.zip

echo ">>> 展開中..."
unzip -q -o /tmp/bds.zip -d "${BDS_DIR}"
chmod +x "${BDS_DIR}/bedrock_server"
rm /tmp/bds.zip

# ── server.properties 設定 ────────────────────────────────────────────────
echo ">>> server.properties を設定..."
PROPS="${BDS_DIR}/server.properties"

# チートを有効化
sed -i 's/^allow-cheats=false/allow-cheats=true/' "${PROPS}"
# オフラインモード（ローカルテスト用）
sed -i 's/^online-mode=true/online-mode=false/' "${PROPS}"
# ゲームモード: クリエイティブ（デモ用）
sed -i 's/^gamemode=survival/gamemode=creative/' "${PROPS}"
# ビューディスタンス削減（WSL2の負荷軽減）
sed -i 's/^view-distance=32/view-distance=12/' "${PROPS}"

echo ">>> server.properties 設定完了"

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
mkdir -p "${DEST}"
cp -r manifest.json permissions.json scripts/ "${DEST}/"

# ── world_behaviorpacks.json 設定 ─────────────────────────────────────────
echo ">>> ワールドにビヘイビアパックを登録..."
WORLD_DIR="${BDS_DIR}/worlds/Bedrock level"
mkdir -p "${WORLD_DIR}"

# manifest.jsonからUUIDとバージョンを取得
PACK_UUID=$(grep -o '"uuid": "[^"]*"' "${DEST}/manifest.json" | head -1 | grep -o '[0-9a-f-]*')
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
echo "Windows側でポートフォワードを設定してください:"
echo "  PowerShellを管理者で開いて: .\\setup\\port_forward.ps1"
echo ""
echo "Minecraftで接続: サーバーアドレス = localhost, ポート = 19132"
