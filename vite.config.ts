import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * SEO + hosting plugin.
 *
 * SITE_URL is the public, absolute URL of the deployed site (with trailing
 * slash), e.g. https://<user>.github.io/<repo>/ . The GitHub Pages workflow
 * sets it automatically. When it is unset (local builds), absolute-URL tags
 * (canonical, og:url, og:image, sitemap) are simply omitted rather than
 * emitted with a wrong host.
 *
 * In production builds it also adds a strict Content-Security-Policy whose
 * `connect-src 'self'` means the page *cannot* upload a file anywhere: the
 * "no uploads" promise is enforced by the browser, not just by our code.
 */
function seo(siteUrl: string): Plugin {
  const base = siteUrl ? (siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`) : ''
  let isBuild = false
  return {
    name: 'seo-and-hosting',
    configResolved(c) {
      isBuild = c.command === 'build'
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
      const abs = base
        ? [
            `<link rel="canonical" href="${base}" />`,
            `<meta property="og:url" content="${base}" />`,
            `<meta property="og:image" content="${base}og-image.png" />`,
            `<meta name="twitter:image" content="${base}og-image.png" />`,
          ].join('\n    ')
        : ''
      const csp = isBuild
        ? `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'sha256-__THEME_HASH__'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'none'" />`
        : ''
      return html
        .replace('<!-- %ABSOLUTE_URL_TAGS% -->', abs)
        .replace('<!-- %CSP% -->', csp)
        .replace(/^\s*"url": "%SITE_URL%",\n/m, base ? `        "url": "${base}",\n` : '')
        // Allow exactly the inline theme script (and nothing else) via its hash.
        .replace(/sha256-__THEME_HASH__([\s\S]*?)<script>([\s\S]*?)<\/script>/, (_m, mid: string, code: string) =>
          `sha256-${createHash('sha256').update(code).digest('base64')}${mid}<script>${code}</script>`)
      },
    },
    // Offline support: after the build is on disk, list every file the app
    // needs and bake that list (and a content hash as version) into sw.js.
    writeBundle(options) {
      if (!isBuild || !options.dir) return
      const outDir = options.dir
      const SKIP = new Set(['sw.js', 'robots.txt', 'sitemap.xml', '.nojekyll', 'og-image.png'])
      const files: string[] = []
      const walk = (dir: string, rel = '') => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name)
          const r = rel ? `${rel}/${name}` : name
          if (statSync(full).isDirectory()) walk(full, r)
          else if (!SKIP.has(r) && !r.endsWith('.map')) files.push(r)
        }
      }
      walk(outDir)
      files.sort()
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)))
      const version = hash.digest('hex').slice(0, 12)
      const precache = ['./', ...files.map((f) => `./${f}`)]
      const template = readFileSync(resolve(__dirname, 'scripts/sw.template.js'), 'utf8')
      writeFileSync(
        join(outDir, 'sw.js'),
        template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache, null, 2)),
      )
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', base ? `Sitemap: ${base}sitemap.xml` : ''].filter(Boolean).join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots + '\n' })
      if (base) {
        const today = new Date().toISOString().slice(0, 10)
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`,
        })
      }
      // GitHub Pages: skip Jekyll processing so every file is served as-is.
      this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' })
    },
  }
}

// Static SPA. `base: './'` keeps asset URLs relative so the build works on
// GitHub Pages (project or user site), Cloudflare Pages, Vercel, or any folder.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    // ES-module worker so it can lazy-load pdf-lib only when a PDF is processed.
    worker: { format: 'es' },
    plugins: [react(), tailwindcss(), seo(env.SITE_URL || 'https://abdul97233.github.io/synthid-remover/')],
    build: {
      target: 'es2020',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
  }
})
