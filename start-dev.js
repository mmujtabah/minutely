const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const concurrently = require('concurrently');

// --- Helper Functions ---

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyFiles(srcDir, destDir, pattern) {
    if (!fs.existsSync(srcDir)) {
        console.warn(`Warning: Source directory ${srcDir} does not exist.`);
        return;
    }
    ensureDir(destDir);
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
        if (pattern.test(file)) {
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        }
    });
}

function copyDirRecursive(src, dest) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// --- Setup Step ---

console.log('--- Setting up assets ---');

ensureDir('libs');
ensureDir(path.join('libs', 'excalidraw'));

// Copy fonts
const excalidrawFonts = path.join('node_modules', '@jitsi', 'excalidraw', 'dist', 'dev', 'fonts');
if (fs.existsSync(excalidrawFonts)) {
    copyDirRecursive(excalidrawFonts, path.join('libs', 'excalidraw', 'fonts'));
}

// Copy other libs
copyFiles(path.join('node_modules', 'lib-jitsi-meet', 'dist', 'umd'), 'libs', /^lib-jitsi-meet\..*$/);
copyFiles(path.join('node_modules', '@matrix-org', 'olm'), 'libs', /^olm\.wasm$/);
copyFiles(path.join('node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist'), 'libs', /\.wasm$/);
copyFiles(path.join('node_modules', '@jitsi', 'rnnoise-wasm', 'dist'), 'libs', /^rnnoise\.wasm$/);
copyFiles(path.join('react', 'features', 'stream-effects', 'virtual-background', 'vendor', 'tflite'), 'libs', /\.wasm$/);
copyFiles(path.join('react', 'features', 'stream-effects', 'virtual-background', 'vendor', 'models'), 'libs', /\.tflite$/);
copyFiles(path.join('node_modules', '@vladmandic', 'human-models', 'models'), 'libs', /^(blazeface-front|emotion)\.(bin|json)$/);

// Compile SCSS
console.log('--- Compiling SCSS ---');
try {
    const result = sass.renderSync({
        file: path.join('css', 'main.scss'),
        outputStyle: 'compressed',
        includePaths: ['node_modules']
    });
    fs.writeFileSync(path.join('css', 'all.css'), result.css);
    console.log('SCSS compiled successfully.');
} catch (err) {
    console.error('Sass compilation failed:', err);
}

// --- Run Services Concurrently ---

console.log('--- Starting Services ---');

concurrently([
    { 
        command: 'npx webpack serve --mode development --progress', 
        name: 'frontend', 
        prefixColor: 'blue' 
    },
    { 
        command: 'go run cmd/api/main.go', 
        cwd: path.join(__dirname, 'minutely-api'), 
        name: 'api', 
        prefixColor: 'green' 
    },
    { 
        command: 'python app.py', 
        cwd: path.join(__dirname, 'ai-service'), 
        name: 'ai-service', 
        prefixColor: 'magenta' 
    }
], {
    prefix: 'name',
    killOthers: ['failure', 'success'],
    restartTries: 3,
}).result.then(
    () => console.log('All services stopped.'),
    (err) => console.error('One or more services failed:', err)
);
