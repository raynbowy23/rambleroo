// Preview-only server: cache stays in this worktree; baseline modules come from HEAD without checkout/stash.
import config from '../vite.config'
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { relative } from 'node:path'

const baseline = new Set(['src/features/map/ReliefControls.tsx', 'src/features/map/car3d.ts', 'src/components/ui/RouteMapCanvas.tsx'])
export default {
  ...config,
  cacheDir: '.route3d-cache.local/vite',
  server: { ...config.server, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
  plugins: [
    ...(config.plugins ?? []),
    {
      name: 'route3d-baseline',
      enforce: 'pre' as const,
      load(id: string) {
        const path = relative(process.cwd(), id.split('?')[0])
        if (process.env.ROUTE3D_BASELINE === '1' && baseline.has(path))
          return execFileSync('git', ['show', `${process.env.ROUTE3D_BASE_REF ?? 'HEAD'}:${path}`], { encoding: 'utf8' })
      },
    },
  ],
}
