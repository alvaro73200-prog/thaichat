@echo off
title REINICIAR SERVIDOR - ThaiChat
color 0A
echo.
echo  ==============================
echo    CERRANDO SERVIDOR VIEJO
echo  ==============================
echo.

rem Matar procesos en el puerto 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    if not "%%a"=="0" (
        echo  Cerrando PID %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
)

rem Matar node y npx por si quedaron huerfanos
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM npx.cmd  >nul 2>&1

echo.
echo  ==============================
echo    INICIANDO SERVIDOR LIMPIO
echo  ==============================
echo.

start "" cmd /k "cd /d "%~dp0" && npx serve . -l 3000"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000

echo  Servidor listo en http://localhost:3000
echo  (Esta ventana se puede cerrar)
timeout /t 3 /nobreak >nul
