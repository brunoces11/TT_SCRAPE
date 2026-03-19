@echo off
cd /d C:\Users\Bruno\Desktop\VIBE\TT_SCRAPE
echo Compilando o projeto...
call npm run build
echo Build concluido. Iniciando o servidor...
start http://localhost:3000
npm run start
