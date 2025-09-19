/*
 Servidor Express para el lanzador de apps
 - Recibe archivos .zip con Multer
 - Extrae en /apps, detecta tipo de app (node, php, estatica)
 - Para apps node: instala deps, opcionalmente build, y luego start en un puerto libre
 - Para apps php: usa servidor embebido de PHP en un puerto libre
 - Sirve apps estaticas desde /static/:name
*/
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import AdmZip from 'adm-zip'
import mime from 'mime-types'
import getPort from 'get-port'
import spawn from 'cross-spawn'
import kill from 'tree-kill'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 4000
const ROOT_DIR = path.resolve(__dirname, '..')
const APPS_DIR = path.join(ROOT_DIR, 'apps')
// Archivo de registro de aplicaciones
const REGISTRY_FILE = path.join(ROOT_DIR, 'registry.json')

// Crear directorio de aplicaciones si no existe
if (!fs.existsSync(APPS_DIR)) fs.mkdirSync(APPS_DIR, { recursive: true })

// Habilitar CORS
app.use(cors())
// Configuracion de Multer: usar almacenamiento en memoria y luego extraer
app.use(express.json())

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Solo permitir archivos .zip
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return cb(new Error('Solo se permiten archivos .zip'))
    }
    cb(null, true)
  },
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
})

let registry = loadRegistry()
pruneRegistry()
const processes = new Map()

// Cargar registro de aplicaciones
function loadRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
      // Resetear campos transitorios (mantener valores en ingles para compatibilidad)
      for (const k of Object.keys(data)) {
        data[k].status = 'stopped'
        delete data[k].port
        delete data[k].pid
        delete data[k].url
      }
      return data
    }
  } catch (e) {
    console.error('Error al cargar registro:', e)
  }
  return {}
}

// Guardar registro de aplicaciones
function saveRegistry() {
  try {
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2))
  } catch (e) {
    console.error('Error al guardar registro:', e)
  }
}

// Eliminar aplicaciones no existentes del registro
function pruneRegistry() {
  let changed = false
  for (const name of Object.keys(registry)) {
    const appDir = path.join(APPS_DIR, name)
    if (!fs.existsSync(appDir)) {
      delete registry[name]
      changed = true
    }
  }
  if (changed) saveRegistry()
}

// Normalizar nombre de aplicacion para uso en directorio
function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .substring(0, 64) || 'app'
}

// Detectar tipo de aplicacion en base a su contenido
function detectAppType(appPath) {
  // App node si tiene package.json con scripts.start
  const pkgPath = path.join(appPath, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.scripts && pkg.scripts.start) return 'node'
    } catch {}
  }
  // App php si contiene archivos .php
  if (hasPhpFiles(appPath)) return 'php'
  // App estatica si tiene index.html en raiz o en dist/build/public
  const staticCandidates = [
    path.join(appPath, 'index.html'),
    path.join(appPath, 'public', 'index.html'),
    path.join(appPath, 'dist', 'index.html'),
    path.join(appPath, 'build', 'index.html'),
  ]
  for (const p of staticCandidates) if (fs.existsSync(p)) return 'static'
  // Alternativa: si contiene algun .html, tratar como estatica
  const hasHtml = fs
    .readdirSync(appPath, { withFileTypes: true })
    .some((d) => d.isFile() && d.name.toLowerCase().endsWith('.html'))
  return hasHtml ? 'static' : 'node'
}

// Verificar si un directorio contiene archivos .php
function hasPhpFiles(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.php')) return true
    }
    // Revisar subdirectorios comunes
    const subdirs = ['public', 'src', 'app', 'www', 'htdocs']
    for (const s of subdirs) {
      const p = path.join(dir, s)
      if (fs.existsSync(p)) {
        const has = fs.readdirSync(p, { withFileTypes: true }).some((d) => d.isFile() && d.name.toLowerCase().endsWith('.php'))
        if (has) return true
      }
    }
  } catch {}
  return false
}

// Iniciar aplicacion node
async function ensureNodeAppRunning(name) {
  const info = registry[name]
  if (!info || info.type !== 'node') throw new Error('No es una aplicacion node')
  if (info.status === 'running' && info.port && processes.has(name)) return info

  const appPath = path.join(APPS_DIR, name)
  info.status = 'starting'

  // Instalar dependencias si no existe node_modules
  const nodeModulesPath = path.join(appPath, 'node_modules')
  const needsInstall = !fs.existsSync(nodeModulesPath)
  if (needsInstall) {
    await runInstall(appPath)
  }

  const port = await getPort()
  // Evitar que servidores de dev (por ejemplo CRA) abran el navegador
  const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), BROWSER: 'none' }

  // Si el app tiene scripts build y start, ejecutar build antes para un inicio tipo produccion
  if (shouldBuild(appPath)) {
    await runBuild(appPath)
  }

  const { bin, args } = getStartCommand(appPath)
  const child = spawn(bin, args, {
    cwd: appPath,
    env,
    stdio: 'inherit',
  })

  processes.set(name, child)
  info.port = port
  info.pid = child.pid

  // Heuristica: esperar un poco para que levante el servidor; idealmente proberiamos la URL
  await waitFor(6000)

  info.status = 'running'
  info.url = `http://localhost:${port}`
  saveRegistry()
  return info
}

// Iniciar aplicacion php
async function ensurePhpAppRunning(name) {
  const info = registry[name]
  if (!info || info.type !== 'php') throw new Error('No es una aplicacion php')
  if (info.status === 'running' && info.port && processes.has(name)) return info

  const appPath = path.join(APPS_DIR, name)
  info.status = 'starting'

  const port = await getPort()
  const env = { ...process.env }
  const docRoot = getPhpDocRoot(appPath)
  const { bin, args } = getPhpCommand(port, docRoot)

  const child = spawn(bin, args, {
    cwd: appPath,
    env,
    stdio: 'inherit',
  })

  processes.set(name, child)
  info.port = port
  info.pid = child.pid

  await waitFor(2000)
  info.status = 'running'
  info.url = `http://localhost:${port}`
  saveRegistry()
  return info
}

// Obtener directorio raiz de aplicacion php
function getPhpDocRoot(appPath) {
  const candidates = [
    path.join(appPath, 'public'),
    path.join(appPath, 'www'),
    path.join(appPath, 'htdocs'),
    appPath,
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c
  }
  return appPath
}

// Comando para iniciar PHP embebido en el puerto indicado
function getPhpCommand(port, docRoot) {
  const isWin = /^win/.test(process.platform)
  const phpBin = isWin ? 'php.exe' : 'php'
  return { bin: phpBin, args: ['-S', `127.0.0.1:${port}`, '-t', docRoot] }
}

// Detener aplicacion node
function stopNodeApp(name) {
  const child = processes.get(name)
  if (child) {
    try {
      kill(child.pid)
    } catch (e) {
      console.warn('Error al detener proceso', e)
    }
    processes.delete(name)
  }
  const info = registry[name]
  if (info) {
    info.status = 'stopped'
    delete info.port
    delete info.pid
    delete info.url
    saveRegistry()
  }
}

// Obtener administrador de paquetes
function getPackageManager(cwd) {
  const hasYarn = fs.existsSync(path.join(cwd, 'yarn.lock'))
  const hasPnpm = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))
  if (hasYarn) return 'yarn'
  if (hasPnpm) return 'pnpm'
  return 'npm'
}

// Obtener comando de instalacion
function getInstallCommand(cwd) {
  const pm = getPackageManager(cwd)
  const isWin = /^win/.test(process.platform)
  if (pm === 'yarn') return { bin: isWin ? 'yarn.cmd' : 'yarn', args: ['install'] }
  if (pm === 'pnpm') return { bin: isWin ? 'pnpm.cmd' : 'pnpm', args: ['install'] }
  // npm: use legacy peer deps to avoid CRA peer issues on modern npm
  return { bin: isWin ? 'npm.cmd' : 'npm', args: ['install', '--legacy-peer-deps'] }
}

// Check if the project is a Svelte app
function isSvelteApp(cwd) {
  const pkgPath = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return pkg.dependencies && (pkg.dependencies['@sveltejs/kit'] || pkg.dependencies['svelte'])
    } catch (e) {
      console.error('Error reading package.json:', e)
    }
  }
  return false
}

// Obtener comando de inicio
function getStartCommand(cwd) {
  const pm = getPackageManager(cwd)
  const isWin = /^win/.test(process.platform)
  const bin = isWin ? `${pm}.cmd` : pm
  
  // Check if it's a Svelte app
  if (isSvelteApp(cwd)) {
    if (pm === 'yarn') return { bin: isWin ? 'yarn.cmd' : 'yarn', args: ['dev'] }
    if (pm === 'pnpm') return { bin: isWin ? 'pnpm.cmd' : 'pnpm', args: ['dev'] }
    return { bin: isWin ? 'npm.cmd' : 'npm', args: ['run', 'dev'] }
  }
  
  // Default to start script for other apps
  if (pm === 'yarn') return { bin: isWin ? 'yarn.cmd' : 'yarn', args: ['start'] }
  if (pm === 'pnpm') return { bin: isWin ? 'pnpm.cmd' : 'pnpm', args: ['start'] }
  return { bin: isWin ? 'npm.cmd' : 'npm', args: ['start'] }
}

// Obtener comando de construccion
function getBuildCommand(cwd) {
  const pm = getPackageManager(cwd)
  const isWin = /^win/.test(process.platform)
  if (pm === 'yarn') return { bin: isWin ? 'yarn.cmd' : 'yarn', args: ['build'] }
  if (pm === 'pnpm') return { bin: isWin ? 'pnpm.cmd' : 'pnpm', args: ['build'] }
  return { bin: isWin ? 'npm.cmd' : 'npm', args: ['run', 'build'] }
}

// Instalar dependencias
function runInstall(cwd) {
  return new Promise((resolve, reject) => {
    try {
      const { bin, args } = getInstallCommand(cwd)
      console.log(`Running: ${bin} ${args.join(' ')} in ${cwd}`)
      
      const child = spawn(bin, args, {
        cwd,
        stdio: 'inherit',
        env: process.env,
        shell: true,
        windowsHide: true
      })
      
      child.on('error', (err) => {
        console.error('Error spawning process:', err)
        reject(new Error(`Failed to start installation: ${err.message}`))
      })
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log('Installation completed successfully')
          resolve()
        } else {
          reject(new Error(`Installation failed with code ${code}`))
        }
      })
    } catch (err) {
      console.error('Error in runInstall:', err)
      reject(err)
    }
  })
}

// Construir aplicacion
function runBuild(cwd) {
  return new Promise((resolve, reject) => {
    const { bin, args } = getBuildCommand(cwd)
    const child = spawn(bin, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`build failed with code ${code}`))
    })
  })
}

// Leer archivo package.json
function readPackageJson(cwd) {
  try {
    const pkgPath = path.join(cwd, 'package.json')
    if (!fs.existsSync(pkgPath)) return null
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch {
    return null
  }
}

// Verificar si se debe construir la aplicacion
function shouldBuild(cwd) {
  const pkg = readPackageJson(cwd)
  if (!pkg || !pkg.scripts) return false
  // Solo construir si ambos build y start existen para evitar romper plantillas de desarrollo
  return Boolean(pkg.scripts.build && pkg.scripts.start)
}

// Esperar un tiempo determinado
function waitFor(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// API: Listar aplicaciones
app.get('/api/apps', (req, res) => {
  pruneRegistry()
  const list = Object.entries(registry).map(([name, info]) => {
    const computedUrl = info.type === 'static' ? `${req.protocol}://${req.get('host')}/static/${name}/` : info.url || null
    return { name, ...info, url: computedUrl }
  })
  res.json(list)
})

// API: Subir archivo zip
app.post('/api/apps/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subio archivo' })
    const original = req.file.originalname
    const base = sanitizeName(path.basename(original, '.zip'))

    let name = base
    let idx = 1
    while (fs.existsSync(path.join(APPS_DIR, name))) {
      name = `${base}-${idx++}`
    }

    const extractDir = path.join(APPS_DIR, name)
    fs.mkdirSync(extractDir, { recursive: true })

    const zip = new AdmZip(req.file.buffer)
    zip.extractAllTo(extractDir, true)

    // Si el zip tenia una sola carpeta en la raiz, aplanar
    const entries = fs.readdirSync(extractDir)
    if (entries.length === 1) {
      const sole = path.join(extractDir, entries[0])
      try {
        const stat = fs.statSync(sole)
        if (stat.isDirectory()) {
          // Mover contenido hacia arriba
          for (const f of fs.readdirSync(sole)) {
            fs.renameSync(path.join(sole, f), path.join(extractDir, f))
          }
          fs.rmdirSync(sole)
        }
      } catch {}
    }

    const type = detectAppType(extractDir)
    registry[name] = { type, status: 'detenido' }
    saveRegistry()

    res.json({ name, type })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'Error al subir archivo' })
  }
})

// API: Iniciar aplicacion (node o php) las estaticas devuelven URL directa
app.post('/api/apps/:name/start', async (req, res) => {
  const { name } = req.params
  const info = registry[name]
  if (!info) return res.status(404).json({ error: 'Aplicacion no encontrada' })
  try {
    if (info.type === 'static') {
      const url = `${req.protocol}://${req.get('host')}/static/${name}/`
      return res.json({ name, url, status: 'ready' })
    }
    const running = info.type === 'node' ? await ensureNodeAppRunning(name) : await ensurePhpAppRunning(name)
    res.json({ name, url: running.url, status: running.status })
  } catch (e) {
    console.error(e)
    info.status = 'error'
    saveRegistry()
    res.status(500).json({ error: e.message || 'Error al iniciar aplicacion' })
  }
})

// API: Detener aplicacion (solo aplica a procesos en ejecucion)
app.post('/api/apps/:name/stop', (req, res) => {
  const { name } = req.params
  if (!registry[name]) return res.status(404).json({ error: 'Aplicacion no encontrada' })
  stopNodeApp(name)
  res.json({ ok: true })
})

// Servir aplicaciones estaticas bajo /static/:name/*
app.get('/static/:name/*', (req, res) => {
  const { name } = req.params
  const subpath = req.params[0] || ''
  const baseDir = path.join(APPS_DIR, name)

  if (!fs.existsSync(baseDir)) return res.status(404).send('No encontrado')

  // Probar raices estaticas comunes
  const roots = [
    baseDir,
    path.join(baseDir, 'public'),
    path.join(baseDir, 'dist'),
    path.join(baseDir, 'build'),
  ]

  let filePath
  for (const root of roots) {
    const candidate = path.join(root, subpath)
    const candidateIndex = path.join(root, 'index.html')
    if (subpath && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      filePath = candidate
      break
    }
    if (!subpath && fs.existsSync(candidateIndex)) {
      filePath = candidateIndex
      break
    }
  }

  if (!filePath) {
    // Fallback SPA a index.html si existe
    for (const root of roots) {
      const idx = path.join(root, 'index.html')
      if (fs.existsSync(idx)) {
        filePath = idx
        break
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) return res.status(404).send('Not found')

  const ctype = mime.lookup(path.extname(filePath)) || 'application/octet-stream'
  res.setHeader('Content-Type', ctype)
  fs.createReadStream(filePath).pipe(res)
})

app.get('/', (req, res) => {
  res.send('Server running. Use the Svelte client to interact.')
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
