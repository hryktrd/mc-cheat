# WSL2上のBDSにWindowsのMinecraftクライアントから接続するためのポートフォワード設定
# 管理者権限のPowerShellで実行してください
#
# 注意: WSL2はNATを使うためIPが起動のたびに変わります。
#       BDSを起動し直すたびにこのスクリプトを再実行してください。

$ErrorActionPreference = "Stop"

# WSL2のIPアドレスを取得
$wslIp = (wsl hostname -I).Trim().Split(" ")[0]
if (-not $wslIp) {
    Write-Error "WSL2のIPアドレスを取得できませんでした。WSLが起動しているか確認してください。"
    exit 1
}

Write-Host "WSL2 IP: $wslIp"

# 既存のポートフォワードを削除（再設定のため）
netsh interface portproxy delete v4tov4 listenport=19132 listenaddress=0.0.0.0 2>$null
Write-Host "既存のポートフォワードを削除しました（なければ無視）"

# 新しいポートフォワードを追加
netsh interface portproxy add v4tov4 `
    listenport=19132 `
    listenaddress=0.0.0.0 `
    connectport=19132 `
    connectaddress=$wslIp

# Windowsファイアウォールでポート19132(UDP)を許可
$ruleName = "Minecraft BDS WSL2 (UDP 19132)"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol UDP `
        -LocalPort 19132 `
        -Action Allow | Out-Null
    Write-Host "ファイアウォールルールを追加しました"
}

Write-Host ""
Write-Host "=== ポートフォワード設定完了 ==="
Write-Host "localhost:19132 -> ${wslIp}:19132"
Write-Host ""
Write-Host "Minecraftで以下のサーバーに接続してください:"
Write-Host "  アドレス: localhost"
Write-Host "  ポート:   19132"
