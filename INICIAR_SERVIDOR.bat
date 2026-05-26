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

:: Abre el navegador automaticamente despues de 2 segundos
start "" timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

:: Inicia el servidor
npx -y serve . -l 3000

echo.
echo  Servidor detenido. Puedes cerrar esta ventana.
pause
