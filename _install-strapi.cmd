@echo off
cd /d "D:\scorp\Cloude\???? new\variant-c"
echo n| npx --yes create-strapi-app@5 cms-admin --use-npm --no-run --skip-cloud --skip-db --no-example --typescript --install
echo === exit=%ERRORLEVEL% %DATE% %TIME% ===
