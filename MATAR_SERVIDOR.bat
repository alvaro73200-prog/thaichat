@echo off
title Matando servidores...
color 0C
echo.
echo  ========================================
echo    CERRANDO TODOS LOS SERVIDORES
echo  ========================================
echo.

echo Buscando procesos en puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    if not "%%a"=="0" (
        echo Cerrando PID %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo Cerrando procesos de Node.js y npx...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM npx.cmd >nul 2>&1

echo.
echo  ========================================
echo    LISTO - Todos los servidores cerrados
echo  ========================================
echo.
echo Puedes cerrar esta ventana o...
echo Presiona cualquier tecla para abrir el servidor de nuevo.
pause >nul

echo.
echo Iniciando servidor limpio...
start "" cmd /k "cd /d "%~dp0" && npx serve . -l 3000"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
