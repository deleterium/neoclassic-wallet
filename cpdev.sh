cp -r src/css src/fonts src/img dist/
cp dist/index.html dist/index.dev.html
sed -i 's/index.min.js/index.dev.js/g' dist/index.dev.html
