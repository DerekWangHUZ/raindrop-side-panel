# 目录完整性标签守卫（raindrop-side-panel）
# 构建 / 发行前调用：目录被标成 Low Mandatory Level 时，Windows 会把其中的
# 可执行文件一律按 Internet 区对待（安全警告弹窗），产物不可信。
# 用法（仓库根目录）：
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\integrity-guard.ps1
# 检测到 Low 时自动校正为 Medium；校正失败或仍为 Low 时以非零码退出。

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

$label = (icacls $repo 2>&1 | Select-String 'Mandatory Label\Low' -SimpleMatch)
if ($label) {
    Write-Host '== 完整性标签：检测到 Low，正在校正为 Medium ==' -ForegroundColor Yellow
    cmd /c "icacls `"$repo`" /setintegritylevel (OI)(CI)Medium /C /Q" | Out-Null
    if ((icacls $repo 2>&1 | Select-String 'Mandatory Label\Low' -SimpleMatch)) {
        Write-Error '目录完整性标签仍为 Low，校正失败。请手动执行：icacls "<目录>" /setintegritylevel (OI)(CI)Medium'
        exit 1
    }
    Write-Host '   已校正为 Medium' -ForegroundColor Green
}

exit 0
