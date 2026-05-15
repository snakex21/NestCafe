import { defineConfig } from 'vite';
import electronPlugin from 'vite-plugin-electron';
import path from 'path';
import { builtinModules } from 'module';
import { fileURLToPath } from 'url';
import { existsSync, rmSync, statSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import esbuild from 'esbuild';
import pkg from './package.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nodeExternals = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

let electronProcess: ChildProcess | null = null;
let didCleanMainDist = false;
let isRestartingElectron = false;

async function stopElectronProcess(): Promise<void> {
  const processToStop = electronProcess;
  if (!processToStop?.pid || processToStop.exitCode !== null) {
    electronProcess = null;
    return;
  }

  isRestartingElectron = true;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    processToStop.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${processToStop.pid} /T /F`, { stdio: 'ignore' });
      } else {
        processToStop.kill('SIGTERM');
      }
    } catch {
      try {
        processToStop.kill('SIGTERM');
      } catch {
        // The process may already be gone, or Windows may refuse to kill a detached child.
      }
      resolve();
    }
  });

  if (electronProcess === processToStop) {
    electronProcess = null;
  }
  isRestartingElectron = false;
}

async function startElectron(argv: string[]): Promise<void> {
  await stopElectronProcess();

  const electronModule = await import('electron');
  const electronPath = (electronModule.default ?? electronModule) as unknown as string;
  const stdio =
    process.platform === 'linux'
      ? (['inherit', 'inherit', 'inherit', 'ignore', 'ipc'] as const)
      : (['inherit', 'inherit', 'inherit', 'ipc'] as const);

  electronProcess = spawn(electronPath, argv, { stdio });
  const spawnedProcess = electronProcess;
  electronProcess.once('exit', (code) => {
    if (electronProcess === spawnedProcess) {
      electronProcess = null;
    }
    if (!isRestartingElectron) {
      process.exit(typeof code === 'number' ? code : 0);
    }
  });
}

async function launchDesktopApp(): Promise<void> {
  const inspectArg = process.env.ELECTRON_DEBUG
    ? `--inspect=${process.env.ELECTRON_DEBUG_PORT || '9229'}`
    : undefined;
  const argv = ['.', '--no-sandbox', ...(inspectArg ? [inspectArg] : [])];

  // Ensure the compiled entry point is fully on disk before launching
  // Electron. Under heavy I/O, antivirus scanning, or when preload finishes
  // after main, the file can briefly be missing.
  const entryPath = path.resolve(__dirname, 'dist-electron/main/index.js');
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      if (existsSync(entryPath) && statSync(entryPath).size > 0) {
        await startElectron(argv);
        return;
      }
    } catch {
      // file not ready yet
    }
    await sleep(50);
  }

  throw new Error(`Electron main entry was not built in time: ${entryPath}`);
}

process.once('exit', () => {
  void stopElectronProcess();
});

// Externalize all node_modules — only bundle local source files.
// Vite 8 (rolldown) does not auto-convert CJS require() to ESM imports,
// so any bundled third-party package that internally calls require() for
// Node built-ins will fail at runtime in an ESM context.
// Workspace packages (@nestcafe_ai/*) are aliased to local source and must be bundled.
const externalizeNodeModules = (id: string) => {
  if (id.startsWith('@nestcafe_ai/') || id.startsWith('@main/')) {
    return false;
  }
  return !id.startsWith('.') && !id.startsWith('/') && !id.includes('\0') && !path.isAbsolute(id);
};

/**
 * Compile theme-core.ts → public/theme-init.js for the desktop renderer dev server.
 * Mirrors the same plugin in apps/web/vite.config.ts.
 */
function buildThemeInit(): import('vite').Plugin {
  const outfile = path.resolve(__dirname, 'public/theme-init.js');

  async function generate() {
    await esbuild.build({
      stdin: {
        contents: `import { initEarlyTheme } from '../web/src/client/lib/theme-core.ts'; initEarlyTheme();`,
        resolveDir: __dirname,
        loader: 'ts',
      },
      bundle: true,
      format: 'iife',
      outfile,
      platform: 'browser',
      minify: false,
    });
  }

  return {
    name: 'build-theme-init',
    async buildStart() {
      await generate();
    },
    configureServer(server) {
      const pending = generate().catch((e) => {
        server.config.logger.error(`[build-theme-init] Failed to generate theme-init.js: ${e}`);
      });
      server.middlewares.use('/theme-init.js', async (_req, _res, next) => {
        await pending;
        next();
      });
    },
  };
}

export default defineConfig(() => ({
  plugins: [
    buildThemeInit(),
    electronPlugin([
      {
        entry: 'src/main/index.ts',
        async onstart() {
          await launchDesktopApp();
        },
        vite: {
          plugins: [
            {
              name: 'clean-main-dist-once',
              buildStart() {
                if (didCleanMainDist) {
                  return;
                }
                didCleanMainDist = true;
                rmSync(path.resolve(__dirname, 'dist-electron/main'), {
                  recursive: true,
                  force: true,
                });
              },
            },
          ],
          resolve: {
            alias: {
              '@main': path.resolve(__dirname, 'src/main'),
              '@nestcafe_ai/agent-core': path.resolve(__dirname, '../../packages/agent-core/src'),
            },
          },
          build: {
            sourcemap: true,
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: externalizeNodeModules,
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        async onstart() {
          await launchDesktopApp();
        },
        vite: {
          define: {
            'process.env.npm_package_version': JSON.stringify(pkg.version),
          },
          build: {
            outDir: 'dist-electron/preload',
            lib: {
              entry: 'src/preload/index.ts',
              formats: ['cjs'],
              fileName: (format, entryName) =>
                format === 'cjs' ? `${entryName}.cjs` : `${entryName}.mjs`,
            },
            rollupOptions: {
              external: ['electron', ...nodeExternals],
              output: {
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@nestcafe_ai/agent-core/common': path.resolve(
        __dirname,
        '../../packages/agent-core/src/common',
      ),
      '@nestcafe_ai/agent-core': path.resolve(__dirname, '../../packages/agent-core/src'),
    },
  },
}));
