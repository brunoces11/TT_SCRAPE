@echo off
cd /d C:\Users\Bruno\Desktop\VIBE\TT_SCRAPE

:: Prevenir sleep/idle do Windows enquanto o app roda
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0

echo Compilando o projeto...
call npm run build
echo Build concluido. Iniciando o servidor...
start http://localhost:3000
npm run start

:: Restaurar configuracoes padrao ao fechar
powercfg /change standby-timeout-ac 30
powercfg /change standby-timeout-dc 15
powercfg /change monitor-timeout-ac 10
