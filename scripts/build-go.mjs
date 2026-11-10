import { spawnSync } from 'node:child_process'
import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const goRoot = path.join(root, 'go')
const site = path.join(goRoot, 'internal/web/static/site')
const output = path.join(root, 'dist/bin')
const supportedTargets = ['darwin/arm64', 'darwin/amd64', 'windows/amd64', 'windows/arm64', 'linux/amd64']

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status})`)
}

function parseTargets(args) {
  if (args.length === 0) return supportedTargets
  if (args.length !== 2 || args[0] !== '--target' || !supportedTargets.includes(args[1])) {
    throw new Error(`Usage: npm run build:go -- --target <${supportedTargets.join('|')}>`)
  }
  return [args[1]]
}

async function main() {
  const targets = parseTargets(process.argv.slice(2))
  // Fail before the expensive frontend build if the Go toolchain is unavailable.
  run('go', ['version'], { cwd: goRoot })
  // Invoke npm's JS entrypoint to avoid a shell and Windows npm.cmd quoting issues.
  if (!process.env.npm_execpath) throw new Error('Run this script using npm run build:go')
  run(process.execPath, [process.env.npm_execpath, 'run', 'build:web'])

  // Keep the tracked placeholder and replace only generated files in the embed root.
  for (const entry of await readdir(site)) {
    if (entry !== '.gitkeep') await rm(path.join(site, entry), { recursive: true, force: true })
  }
  await cp(path.join(root, 'dist/web'), site, { recursive: true })
  await mkdir(output, { recursive: true })

  for (const target of targets) {
    const [goos, goarch] = target.split('/')
    const filename = `forge-${goos}-${goarch}${goos === 'windows' ? '.exe' : ''}`
    console.log(`\nBuilding ${filename}`)
    run('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', path.join(output, filename), './cmd/forge'], {
      cwd: goRoot,
      env: { ...process.env, CGO_ENABLED: '0', GOOS: goos, GOARCH: goarch },
    })
  }
  console.log(`\nBinaries written to ${output}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
