#!/bin/bash
#
# 生成「素材工作台.app」启动器
#
# 用法：
#   ./scripts/make-app.sh              # 输出到桌面
#   ./scripts/make-app.sh ~/Applications
#   APP_NAME=我的工作台 ./scripts/make-app.sh
#
# 生成后双击该 App 即可：启动后台服务 → 自动打开默认浏览器
# 路径与 node 位置会自动探测，换机器也能用

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_NAME="${APP_NAME:-素材工作台}"
OUT_DIR="${1:-${HOME}/Desktop}"
APP_PATH="${OUT_DIR}/${APP_NAME}.app"

# ---------- 定位 node（GUI 启动时 PATH 很干净，必须写绝对路径） ----------
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  for c in "${HOME}/.local/bin/node" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "${c}" ]; then NODE_BIN="${c}"; break; fi
  done
fi
if [ -z "${NODE_BIN}" ] || [ ! -x "${NODE_BIN}" ]; then
  echo "错误：找不到 node，请先安装 Node.js（>=18）" >&2
  exit 1
fi

# ---------- 读取端口 ----------
PORT=""
if [ -f "${PROJECT_DIR}/.env" ]; then
  PORT="$(grep -E '^[[:space:]]*PORT[[:space:]]*=' "${PROJECT_DIR}/.env" | tail -1 | cut -d= -f2 | tr -d ' ')"
fi
PORT="${PORT:-5178}"

if [ ! -d "${PROJECT_DIR}/node_modules" ]; then
  echo "提示：未找到 node_modules，请先执行  npm install"
fi

echo "项目目录 : ${PROJECT_DIR}"
echo "node     : ${NODE_BIN}"
echo "端口     : ${PORT}"
echo "输出     : ${APP_PATH}"

# ---------- 骨架 ----------
rm -rf "${APP_PATH}"
mkdir -p "${APP_PATH}/Contents/MacOS" "${APP_PATH}/Contents/Resources"

# ---------- Info.plist ----------
cat > "${APP_PATH}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>__APP_NAME__</string>
    <key>CFBundleDisplayName</key>
    <string>__APP_NAME__</string>
    <key>CFBundleIdentifier</key>
    <string>local.gongzuozhan.launcher</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>appicon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

# ---------- 启动脚本 ----------
cat > "${APP_PATH}/Contents/MacOS/launcher" <<'LAUNCHER'
#!/bin/bash
# 素材工作台 启动器（由 scripts/make-app.sh 生成，请勿手改）

PROJECT="__PROJECT__"
NODE="__NODE__"
PORT="__PORT__"
URL="http://localhost:${PORT}"
LOG_DIR="${PROJECT}/logs"
LOG="${LOG_DIR}/launcher.log"

export PATH="$(dirname "${NODE}"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p "${LOG_DIR}"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${LOG}"; }
notify() { /usr/bin/osascript -e "display notification \"$1\" with title \"__APP_NAME__\"" >/dev/null 2>&1; }

[ -x "${NODE}" ] || { log "找不到 node: ${NODE}"; notify "找不到 node"; exit 1; }
[ -d "${PROJECT}" ] || { log "找不到项目目录: ${PROJECT}"; notify "找不到项目目录"; exit 1; }

cd "${PROJECT}" || exit 1

# 服务已在运行 → 只打开浏览器
if /usr/bin/curl -s -o /dev/null -m 2 "${URL}/"; then
  log "服务已在运行，打开浏览器"
  /usr/bin/open "${URL}"
  exit 0
fi

log "启动服务"
nohup "${NODE}" server/index.js >> "${LOG}" 2>&1 &
log "服务进程 PID=$!"

# 等待端口就绪（最多 30 秒）
for _ in $(/usr/bin/seq 1 60); do
  if /usr/bin/curl -s -o /dev/null -m 1 "${URL}/"; then
    log "服务就绪，打开浏览器"
    /usr/bin/open "${URL}"
    exit 0
  fi
  /bin/sleep 0.5
done

log "启动超时，请查看 ${LOG}"
notify "启动超时，请查看 logs/launcher.log"
exit 1
LAUNCHER

# 注入变量
/usr/bin/sed -i '' \
  -e "s|__PROJECT__|${PROJECT_DIR}|g" \
  -e "s|__NODE__|${NODE_BIN}|g" \
  -e "s|__PORT__|${PORT}|g" \
  -e "s|__APP_NAME__|${APP_NAME}|g" \
  "${APP_PATH}/Contents/MacOS/launcher" \
  "${APP_PATH}/Contents/Info.plist"

chmod +x "${APP_PATH}/Contents/MacOS/launcher"

# ---------- 图标 ----------
ICON="${PROJECT_DIR}/assets/icon.icns"
if [ -f "${ICON}" ]; then
  cp "${ICON}" "${APP_PATH}/Contents/Resources/appicon.icns"
  echo "图标     : 已应用"
else
  echo "图标     : 未找到 ${ICON}，使用系统默认图标"
fi

# ---------- 校验 ----------
/usr/bin/plutil -lint "${APP_PATH}/Contents/Info.plist" >/dev/null || {
  echo "错误：Info.plist 校验失败" >&2
  exit 1
}

# 刷新 Finder 图标缓存
/usr/bin/touch "${APP_PATH}"
if [ -x /usr/bin/SetFile ]; then /usr/bin/SetFile -a C "${APP_PATH}" 2>/dev/null || true; fi

echo
echo "完成。双击「${APP_NAME}.app」即可启动。"
echo "启动日志：${PROJECT_DIR}/logs/launcher.log"
