@echo off
chcp 65001 >nul
echo ========================================================
echo  🐾 Iniciando Sistema Web Interno - Veterinaria VetSalud
echo ========================================================

REM 1. Verificar si MariaDB/MySQL está corriendo
tasklist /FI "IMAGENAME eq mariadbd.exe" 2>NUL | find /I /N "mariadbd.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Base de datos MariaDB ya está en ejecución.
) else (
    echo [*] Iniciando motor MariaDB...
    start /B "" "C:\Program Files\MariaDB 13.0\bin\mariadbd.exe" --console
    timeout /t 3 /nobreak >nul
)

REM 2. Iniciar el servidor Backend de Node.js
echo [*] Iniciando Servidor Backend (Node.js Express + Prisma)...
cd /d "%~dp0backend-node"

set "PATH=C:\Program Files\nodejs;%PATH%"

start "Backend Veterinaria VetSalud" cmd /k "node src/index.js"

REM 3. Esperar 2 segundos y abrir en el navegador
timeout /t 2 /nobreak >nul
echo [OK] Abriendo el sistema en tu navegador: http://localhost:4000/
start http://localhost:4000/

echo ========================================================
echo  Sistema iniciado con éxito. Deja abierta la ventana del Backend.
echo ========================================================

