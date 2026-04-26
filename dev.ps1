mkdir -Force libs
mkdir -Force libs\excalidraw

Copy-Item node_modules\@jitsi\excalidraw\dist\dev\fonts -Destination libs\excalidraw\ -Recurse -Force
Copy-Item node_modules\lib-jitsi-meet\dist\umd\lib-jitsi-meet.* -Destination libs\ -Force
Copy-Item node_modules\@matrix-org\olm\olm.wasm -Destination libs\ -Force
Copy-Item node_modules\@tensorflow\tfjs-backend-wasm\dist\*.wasm -Destination libs\ -Force
Copy-Item node_modules\@jitsi\rnnoise-wasm\dist\rnnoise.wasm -Destination libs\ -Force
Copy-Item react\features\stream-effects\virtual-background\vendor\tflite\*.wasm -Destination libs\ -Force
Copy-Item react\features\stream-effects\virtual-background\vendor\models\*.tflite -Destination libs\ -Force
Copy-Item node_modules\@vladmandic\human-models\models\blazeface-front.bin -Destination libs\ -Force
Copy-Item node_modules\@vladmandic\human-models\models\blazeface-front.json -Destination libs\ -Force
Copy-Item node_modules\@vladmandic\human-models\models\emotion.bin -Destination libs\ -Force
Copy-Item node_modules\@vladmandic\human-models\models\emotion.json -Destination libs\ -Force

npx sass css/main.scss css/all.bundle.css
npx cleancss --skip-rebase css/all.bundle.css > css/all.css
Remove-Item css/all.bundle.css

npx webpack serve --mode development --progress
