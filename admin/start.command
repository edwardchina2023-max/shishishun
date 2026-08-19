#!/usr/bin/env bash
# 事事顺酒 · 网站 DIY 后台（macOS 双击启动）
cd "$(dirname "$0")"
PY=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || echo python3)
"$PY" server.py
