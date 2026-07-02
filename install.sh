#!/usr/bin/env sh
# FrameForge scene-mcp 安裝器（Linux / macOS）。
# 從 GitHub Release 下載自包單檔，放進 PATH。無需 npm。
#
#   sh -c "$(curl -fsSL https://raw.githubusercontent.com/raybird/FrameForge/main/install.sh)"
#
# 可用環境變數：
#   FRAMEFORGE_REPO     GitHub 的 owner/repo（預設 raybird/FrameForge）
#   FRAMEFORGE_BIN_DIR  安裝目錄（預設 ~/.local/bin）
#   第一個參數          指定版本 tag（預設 latest），例：sh install.sh v0.1.0
set -e

REPO="${FRAMEFORGE_REPO:-raybird/FrameForge}"
BIN_DIR="${FRAMEFORGE_BIN_DIR:-$HOME/.local/bin}"
NAME="frameforge-scene-mcp"
VERSION="${1:-latest}"

# 產物是 #!/usr/bin/env node 腳本 → 目標機需要 Node。
if ! command -v node >/dev/null 2>&1; then
  echo "✋ 未偵測到 Node.js。scene-mcp 產物需要 Node 20+，請先安裝。" >&2
  exit 1
fi

if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/$REPO/releases/latest/download/$NAME"
else
  URL="https://github.com/$REPO/releases/download/$VERSION/$NAME"
fi

mkdir -p "$BIN_DIR"
echo "⬇️  $URL"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$BIN_DIR/$NAME"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$BIN_DIR/$NAME" "$URL"
else
  echo "✋ 需要 curl 或 wget" >&2
  exit 1
fi
chmod +x "$BIN_DIR/$NAME"
echo "✅ 已安裝：$BIN_DIR/$NAME"

# PATH 檢查
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo "⚠️  $BIN_DIR 不在 PATH。加入後重開 shell，例如："
    echo "    echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.profile"
    ;;
esac

echo ""
echo "在各家 MCP 客戶端設定："
echo "  command = \"$NAME\"   （已在 PATH，無需 args）"
