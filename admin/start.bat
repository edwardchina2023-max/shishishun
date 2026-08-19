@echo off
REM 事事顺酒 · 网站 DIY 后台 启动脚本（Windows）
cd /d "%~dp0"
where python3 >nul 2>nul && python3 server.py || python server.py
pause
