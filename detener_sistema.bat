@echo off
chcp 65001 >nul
echo ========================================================
echo  Deteniendo Sistema Web Veterinaria VetSalud
echo ========================================================

echo Deteniendo servidor Node.js...
taskkill /F /IM node.exe 2>nul

echo Deteniendo base de datos MariaDB...
taskkill /F /IM mariadbd.exe 2>nul

echo [OK] Todos los servicios han sido detenidos.
pause

