'use client';

import * as React from 'react';
import { Suspense, useState, useEffect, useCallback } from 'react';
import { X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useModuleStore } from '@/stores/moduleStore';
import { getNestCafe } from '@/lib/nestcafe';

interface ModulePanelProps {
  moduleId: string;
  onClose: () => void;
}

/**
 * Global registry for loaded module components.
 * Each module registers itself on `window.__module_<name>`.
 */
function getModuleGlobalName(moduleName: string): string {
  return `__module_${moduleName.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export default function ModulePanel({ moduleId, onClose }: ModulePanelProps) {
  const module = useModuleStore((s) => s.installedModules.find((m) => m.id === moduleId));
  const [Component, setComponent] = useState<React.ComponentType<Record<string, never>> | null>(
    null,
  );
  const [componentModuleId, setComponentModuleId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{ moduleId: string; message: string } | null>(null);

  const loadModuleScript = useCallback(async (mod: typeof module) => {
    if (!mod) {
      return;
    }

    const globalName = getModuleGlobalName(mod.name);
    const globals = window as unknown as Record<string, unknown>;
    globals.React = React;

    const existing = globals[globalName];
    if (typeof existing === 'function') {
      setComponent(() => existing as React.ComponentType<Record<string, never>>);
      setComponentModuleId(mod.id);
      return;
    }

    // Remove any previous script for this module
    const prevScript = document.querySelector(`script[data-module="${mod.name}"]`);
    if (prevScript) {
      prevScript.remove();
    }

    let url: string | null = null;
    try {
      const { source } = await getNestCafe().getModuleSource(mod.id);
      url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    } catch (err) {
      setLoadError({
        moduleId: mod.id,
        message: err instanceof Error ? err.message : 'Nie można odczytać pliku modułu',
      });
      return;
    }

    // Expose module ID so the renderer can access its own settings
    (window as unknown as Record<string, unknown>).__module_current_id = mod.id;

    const script = document.createElement('script');
    script.src = url;
    script.dataset.module = mod.name;
    script.async = true;
    script.onload = () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
      const comp = globals[globalName];
      if (typeof comp === 'function') {
        setComponent(() => comp as React.ComponentType<Record<string, never>>);
        setComponentModuleId(mod.id);
      } else {
        setLoadError({ moduleId: mod.id, message: `Moduł nie zarejestrował window.${globalName}` });
      }
    };
    script.onerror = () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
      setLoadError({ moduleId: mod.id, message: `Nie można załadować modułu: ${mod.entry}` });
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!module) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void loadModuleScript(module);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [module, loadModuleScript]);

  if (!module) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Moduł nie znaleziony.
      </div>
    );
  }

  const currentError = loadError?.moduleId === module.id ? loadError.message : null;
  const LoadedComponent = componentModuleId === module.id ? Component : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{module.title}</span>
          <span className="text-xs text-muted-foreground">v{module.version}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        {currentError ? (
          <div className="p-8 text-center">
            <p className="text-destructive text-sm">Błąd: {currentError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => loadModuleScript(module)}
            >
              Spróbuj ponownie
            </Button>
          </div>
        ) : LoadedComponent ? (
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <LoadedComponent />
          </Suspense>
        ) : (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
