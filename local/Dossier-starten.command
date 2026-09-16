#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null; then
  echo 'Bitte Node.js 24 LTS von https://nodejs.org installieren und danach erneut starten.'
  read -r 'reply?Mit Enter schliessen.'
  exit 1
fi
if [[ ! -d '/Applications/Microsoft Word.app' ]]; then
  echo 'Für die Originalausgabe muss Microsoft Word auf diesem Mac installiert sein.'
  read -r 'reply?Mit Enter schliessen.'
  exit 1
fi
node server.mjs --open
read -r 'reply?Mit Enter schliessen.'
