@echo off
title Forzando actualizacion segura en GitHub
color 0C
echo.
echo  ========================================
echo    BORRANDO HISTORIAL Y RESUBIENDO
echo  ========================================
echo.

set GIT="C:\Program Files\Git\cmd\git.exe"

:: Borrar carpeta .git oculta para destruir el historial viejo
echo 1. Borrando historial local...
rd /s /q .git 2>nul

:: Volver a crear el repositorio desde cero
echo 2. Creando historial limpio...
%GIT% init
%GIT% add .
%GIT% commit -m "Version Segura - API Key removida"
%GIT% branch -M main

:: Conectar y forzar subida
echo 3. Sobrescribiendo repositorio publico...
%GIT% remote add origin https://github.com/alvaro73200-prog/thaichat.git
%GIT% push -u --force origin main

echo.
echo  ========================================
echo    LISTO. Tu codigo ahora es seguro.
echo  ========================================
pause
