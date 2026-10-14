#!/usr/bin/env bash
# Deploy the ranking Worker. Credentials live outside the repo in
# ~/.config/pippopoppi/cloudflare.env (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
set -euo pipefail
cd "$(dirname "$0")/.."
. ~/.config/pippopoppi/cloudflare.env
node --check worker.js
npx -y wrangler@3 deploy 2>&1 | grep -v "WARNING\|out-of-date\|npm install\|After installation\|update available\|^$\|^---"
