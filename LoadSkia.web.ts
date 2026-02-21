import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

export const loadSkia = (startApp: () => void) => {
    LoadSkiaWeb({
        locateFile: (file: string) => {
            if (file.endsWith('.wasm')) {
                return 'https://unpkg.com/canvaskit-wasm@0.39.1/bin/full/canvaskit.wasm';
            }
            return `https://unpkg.com/canvaskit-wasm@0.39.1/bin/full/${file}`;
        },
    }).then(startApp).catch(console.error);
};
