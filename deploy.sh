#!/bin/bash
set -e
cd ~/work/my_finary
echo "--- Pulling latest ---"
git pull origin main
echo "--- Installing dependencies ---"
npm install --production=false
echo "--- Generating Prisma client ---"
npx prisma generate
echo "--- Applying migrations ---"
npx prisma migrate deploy
echo "--- Building ---"
npm run build
echo "--- Restarting ---"
pm2 restart my_finary
echo "--- Done ---"
