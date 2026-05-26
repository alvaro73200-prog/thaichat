@echo off
title ThaiChat — Servidor Local
color 0A
echo.
echo  ========================================
echo    THAICHAT TRANSLATOR — Servidor Local
echo  ========================================
echo.
echo  Iniciando servidor en http://localhost:3000
echo.
echo  Abre tu navegador en:
echo  ^> http://localhost:3000
echo.
echo  Para DETENER el servidor: cierra esta ventana
echo  o presiona Ctrl+C
echo.
echo  ========================================
echo.

:: Inicia el servidor en segundo plano
start "" cmd /k "cd /d "%~dp0" && npx -y serve . -l 3000 --no-cache"

:: Espera 2 segundos a que el servidor arranque
timeout /t 2 /nobreak >nul

:: Abre el navegador
start "" "http://localhost:3000"

echo  Servidor corriendo. Esta ventana se puede cerrar.
timeout /t 3 /nobreak >nul

echo.
echo  Servidor detenido. Puedes cerrar esta ventana.
pause
