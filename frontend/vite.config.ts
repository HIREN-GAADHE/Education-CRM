import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // For ngrok mode, set VITE_NGROK_MODE=true when running dev
    const isNgrokMode = mode === 'ngrok';
    const ngrokHost = 'mariana-technical-delila.ngrok-free.dev';

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'src'),
                '@/components': resolve(__dirname, 'src/components'),
                '@/pages': resolve(__dirname, 'src/pages'),
                '@/store': resolve(__dirname, 'src/store'),
                '@/core': resolve(__dirname, 'src/core'),
                '@/types': resolve(__dirname, 'src/types'),
                '@/modules': resolve(__dirname, 'src/modules'),
            },
        },
        server: {
            port: 3000,
            host: true,
            allowedHosts: ['all', '.ngrok-free.dev'],
            // Only apply ngrok HMR config when in ngrok mode
            ...(isNgrokMode && {
                hmr: {
                    clientPort: 443,
                    protocol: 'wss',
                    host: ngrokHost,
                },
            }),
            proxy: {
                '/api': {
                    target: 'http://localhost:8000',
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: 'dist',
            sourcemap: true,
        },
    };
});
