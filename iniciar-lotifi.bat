@echo off
setlocal
title LOTIFI - Iniciar Servidor

cd /d "%~dp0frontend"

if not exist "package.json" (
  echo [ERROR] No se encontro frontend\package.json
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  echo Instalando dependencias del frontend...
  call npm install
  if errorlevel 1 (
    echo [ERROR] No se pudieron instalar las dependencias del frontend.
    pause
    exit /b 1
  )
)

echo Construyendo frontend React...
call npm run build
if errorlevel 1 (
  echo [ERROR] No se pudo construir el frontend.
  pause
  exit /b 1
)

cd /d "%~dp0backend"

if not exist "server.js" (
  echo [ERROR] No se encontro backend\server.js
  echo Cierre esta ventana y revise la ubicacion del archivo .bat
  pause
  exit /b 1
)

echo Iniciando LOTIFI en http://localhost:3002 ...
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3002"

node server.js

echo.
echo El servidor se detuvo.
pause
