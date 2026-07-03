rm -Rf dist/
mkdir -p dist dist/js/3rdparty/ dist/css/
cp -r src/css src/fonts src/img dist/
cp node_modules/admin-lte/dist/js/adminlte.* dist/js/3rdparty/
cp node_modules/admin-lte/plugins/bootstrap/js/bootstrap.bundle.* dist/js/3rdparty/
cp node_modules/admin-lte/dist/css/adminlte.* dist/css/