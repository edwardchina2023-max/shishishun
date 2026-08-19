#!/usr/bin/env bash
# 事事顺酒 · 网站 DIY 后台 启动脚本（macOS / Linux）
# 用法：在终端运行  bash start.sh   或直接  ./start.sh
cd "$(dirname "$0")"
PY=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo python3)
echo "使用 Python：$PY"
"$PY" server.py
