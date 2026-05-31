const esbuild = require('esbuild')

const configDev = {
    entryPoints: ['src/js/brs/index.ts'],
    outfile: 'dist/js/index.dev.js',
    bundle: true,
    minify: false,
    platform: 'browser',
    sourcemap: 'inline',
    target: 'es2025'
}
const configMin = {
    entryPoints: ['src/js/brs/index.ts'],
    outfile: 'dist/js/index.min.js',
    bundle: true,
    minify: true,
    platform: 'browser',
    sourcemap: false,
    target: 'es2025'
}

esbuild.build(configDev)
    .then(() => {
        return esbuild.build(configMin)
    })
    .catch(() => process.exit(1))
