@echo off
chcp 65001 >nul
title 城市生活圈监测平台 - 本地服务器
echo.
echo ╔══════════════════════════════════════╗
echo ║   城市"生活圈"品质动态监测与评估平台   ║
echo ║        Local Dev Server               ║
echo ╚══════════════════════════════════════╝
echo.
echo   正在启动服务器...
echo   浏览器将自动打开 http://localhost:8080
echo.
echo   按 Ctrl+C 可停止服务器
echo.

cd /d "%~dp0"

python -m http.server 8080 --bind 127.0.0.1

pause
