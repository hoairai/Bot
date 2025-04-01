@echo off
title
color 0A

cd %~dp0

echo Checking configuration files...

(for %%F in (tokens.txt proxies.txt) do (
    if not exist %%F (
        type nul > %%F
        echo Created %%F
    )
))

echo Configuration files checked.

echo Checking dependencies...
if exist "..\node_modules" (
    echo Using node_modules from parent directory...
    cd ..
    CALL npm install axios user-agents amazon-cognito-identity-js https-proxy-agent socks-proxy-agent
    cd %~dp0
) else (
    echo Installing dependencies in current directory...
    CALL npm install axios user-agents amazon-cognito-identity-js https-proxy-agent socks-proxy-agent
)
echo Dependencies installation completed!

echo Starting the bot...
node index.js

pause
exit
