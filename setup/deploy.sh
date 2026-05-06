#!/bin/bash
# ビルド済みビヘイビアパックをBDSに再デプロイするスクリプト
# npm run deploy から呼び出される

BDS_DIR="${BDS_DIR:-${HOME}/bds}"
PACK_DIR="$(dirname "$(realpath "$0")")/../behavior_pack"
DEST="${BDS_DIR}/behavior_packs/mc-cheat"

if [ ! -d "${BDS_DIR}" ]; then
  echo "エラー: BDSディレクトリが見つかりません: ${BDS_DIR}"
  echo "先に setup/install_bds.sh を実行してください"
  exit 1
fi

echo ">>> デプロイ中: ${DEST}"
mkdir -p "${DEST}"
cp -r "${PACK_DIR}/manifest.json" \
      "${PACK_DIR}/scripts/main.js" \
      "${DEST}/"

# scriptsディレクトリごとコピー
mkdir -p "${DEST}/scripts"
cp "${PACK_DIR}/scripts/main.js" "${DEST}/scripts/"

echo ">>> デプロイ完了。BDSを再起動してください（またはワールドをリロード）"
