import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { echoGatewayPlugin } from './src/server/echoGateway';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), echoGatewayPlugin()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      '.trycloudflare.com',
    ],
  },
});
