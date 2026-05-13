import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const graphqlUrl =
    rootEnv.UNRAID_GRAPHQL?.trim() ||
    `http://${rootEnv.UNRAID_IP || '127.0.0.1'}:${rootEnv.UNRAID_GRAPHQL_PORT || '8081'}/graphql`
  const apiKey = rootEnv.UNRAID_KEY || ''
  const webguiUrl =
    rootEnv.UNRAID_WEBGUI?.trim() ||
    (rootEnv.UNRAID_IP ? `http://${rootEnv.UNRAID_IP}` : 'http://127.0.0.1')
  let webguiOrigin: string
  try {
    webguiOrigin = new URL(webguiUrl.includes('://') ? webguiUrl : `http://${webguiUrl}`).origin
  } catch {
    webguiOrigin = 'http://127.0.0.1'
  }

  let graphqlOrigin: string
  let graphqlPath: string
  try {
    const u = new URL(graphqlUrl)
    graphqlOrigin = u.origin
    graphqlPath = u.pathname || '/graphql'
  } catch {
    graphqlOrigin = 'http://127.0.0.1:8081'
    graphqlPath = '/graphql'
  }

  return {
    base: '/plugins/undockerui/dist/',
    envDir: '..',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: '../plugin/dist',
      emptyOutDir: true,
    },
    server: {
      proxy: {
        '/plugins/undockerui/dist/compose_api.php': {
          target: webguiOrigin,
          changeOrigin: true,
        },
        '/plugins/undockerui/compose_api.php': {
          target: webguiOrigin,
          changeOrigin: true,
        },
        '/graphql': {
          target: graphqlOrigin,
          changeOrigin: true,
          rewrite: () => graphqlPath,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) proxyReq.setHeader('x-api-key', apiKey)
            })
          },
        },
      },
    },
  }
})
