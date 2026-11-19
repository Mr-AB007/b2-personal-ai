@echo off
rem =============================================================
rem  Build a version of the B2 model into Ollama.
rem  Usage:   build_model.bat v1      (reads models\v1\Modelfile)
rem  Creates:  b2:v1   and points  b2:latest  at it.
rem =============================================================
cd /d "%~dp0"
set OLLAMA="%LOCALAPPDATA%\Programs\Ollama\ollama.exe"

if "%~1"=="" (
  echo Usage: build_model.bat v1
  echo Available versions:
  dir /b models
  exit /b 1
)
if not exist "models\%~1\Modelfile" (
  echo No Modelfile found at models\%~1\Modelfile
  exit /b 1
)

echo Building b2:%~1 ...
%OLLAMA% create b2:%~1 -f "models\%~1\Modelfile" || exit /b 1

rem "latest" is just a nickname. Moving it lets the app use the newest
rem version, and lets you roll back by pointing it at an older one.
%OLLAMA% cp b2:%~1 b2:latest || exit /b 1

echo.
echo Done. Installed B2 models:
%OLLAMA% list | findstr /i "b2"
