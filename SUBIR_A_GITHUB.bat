@echo off
title Subiendo ThaiChat a GitHub
color 0B
echo.
echo  ========================================
echo    SUBIENDO THAICHAT A GITHUB
echo  ========================================
echo.

set GIT="C:\Program Files\Git\cmd\git.exe"

:: Configurar email y nombre si no existen
%GIT% config --global user.name "Alvaro"
%GIT% config --global user.email "alvaro73200-prog@users.noreply.github.com"

:: Inicializar git
echo Iniciando repositorio...
%GIT% init

:: Agregar archivos
echo Agregando archivos...
%GIT% add .

:: Crear primer commit
echo Creando versión inicial...
%GIT% commit -m "Versión 1.0 - ThaiChat PWA"

:: Cambiar rama a main
%GIT% branch -M main

:: Eliminar origen anterior por si acaso
%GIT% remote remove origin 2>nul

:: Conectar con tu GitHub
echo Conectando con tu cuenta de GitHub (alvaro73200-prog)...
%GIT% remote add origin https://github.com/alvaro73200-prog/thaichat.git

:: Subir el código
echo.
echo IMPORTANTE: Si se abre una ventana del navegador o de GitHub,
echo inicia sesión y dale permisos ("Authorize GitCredentialManager").
echo.
echo Subiendo archivos...
%GIT% push -u origin main

echo.
echo  ========================================
echo    PROCESO TERMINADO
echo  ========================================
echo.
echo Si no salio ningun error rojo arriba, el codigo ya esta en GitHub.
pause
