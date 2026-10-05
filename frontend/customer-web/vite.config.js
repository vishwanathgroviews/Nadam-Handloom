import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function crawlerMetaPlugin() {
  return {
    name: 'crawler-meta-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlMatch = req.url?.match(/^\/product\/([^?/#]+)/)
        const userAgent = req.headers['user-agent'] || ''
        const isCrawler = /facebookexternalhit|WhatsApp|Facebot|Twitterbot|TelegramBot|LinkedInBot|Discordbot/i.test(userAgent) || req.url?.includes('crawler=1')

        if (urlMatch && isCrawler) {
          const slug = urlMatch[1]
          try {
            const apiRes = await fetch(`http://localhost:4000/api/v1/catalog/products/${encodeURIComponent(slug)}`)
            if (apiRes.ok) {
              const body = await apiRes.json()
              const product = body?.data
              if (product) {
                let html = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8')
                html = await server.transformIndexHtml(req.url, html)
                const name = product.name || 'Handloom Product'
                const rawDesc = product.shortDescription || product.description || product.subcategory?.description || ''
                const shortDesc = rawDesc.length > 80 ? `${rawDesc.slice(0, 80).replace(/\s+\S*$/, '').replace(/[.,;:\-\s]+$/, '')} ...` : (rawDesc || `View ${name} at Groviews.`)
                const img = product.images?.[0]?.url || ''
                const prodUrl = `https://groviews.com/product/${product.slug}`
                const metaTags = `
    <title>${name} | Groviews</title>
    <meta property="og:title" content="${name}" />
    <meta property="og:description" content="${shortDesc}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${name}" />
    <meta property="og:url" content="${prodUrl}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="Groviews" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${name}" />
    <meta name="twitter:description" content="${shortDesc}" />
    <meta name="twitter:image" content="${img}" />`
                html = html.replace(/<title>[\s\S]*?<\/title>/i, '')
                html = html.replace('</head>', `${metaTags}\n  </head>`)
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                res.end(html)
                return
              }
            }
          } catch {
            // fallback to next()
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crawlerMetaPlugin()],
  server: {
    port: 5174,
    strictPort: false,
    // Bind every interface, not just loopback, so the dev server is reachable
    // at the machine's LAN address too (e.g. testing from a phone alongside
    // the admin app) — Vite defaults to localhost-only otherwise.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

