@echo off
cd /d "%~dp0"

rem First run only: install React packages and build the chat UI.
if not exist "frontend\dist\index.html" (
  echo Building the React UI for the first time...
  pushd frontend
  call npm install
  call npm run build
  popd
)

start "" http://localhost:8000
py server.py
