'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PuzzlePiece, Plus, FolderOpen, FolderSimplePlus } from '@phosphor-icons/react';
import { useModuleStore } from '@/stores/moduleStore';
import { getNestCafe } from '@/lib/nestcafe';
import type { ModuleInstance } from '@nestcafe_ai/agent-core';
import ModuleCard from './ModuleCard';

interface ModuleManagerProps {
  onSelectModule: (moduleId: string) => void;
}

export default function ModuleManager({ onSelectModule }: ModuleManagerProps) {
  const {
    installedModules,
    activeModuleId,
    loadModules,
    enableModule,
    uninstallModule,
    installModule,
    discoverModules,
  } = useModuleStore();
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [available, setAvailable] = useState<
    Array<{
      name: string;
      title: string;
      version: string;
      description: string;
      sourcePath: string;
      alreadyInstalled: boolean;
    }>
  >([]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const handleDiscover = async () => {
    setDiscoverOpen(true);
    const list = await discoverModules();
    setAvailable(list);
  };

  const handleInstallFromPath = async (sourcePath: string) => {
    setInstalling(true);
    try {
      await installModule(sourcePath);
      setDiscoverOpen(false);
    } catch {
      // error handled by store
    } finally {
      setInstalling(false);
    }
  };

  const handlePickFolder = async () => {
    const nestcafe = getNestCafe();
    const folderPath = await nestcafe.pickFolder();
    if (folderPath) {
      await handleInstallFromPath(folderPath);
    }
  };

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-1 py-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <PuzzlePiece className="h-3.5 w-3.5" />
          <span>Moduły</span>
        </div>
        <Dialog open={discoverOpen} onOpenChange={setDiscoverOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleDiscover}
              title="Wgraj moduł"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Wgraj moduł
              </DialogTitle>
            </DialogHeader>

            {/* Pick folder button - opens native Windows dialog */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-10"
              onClick={handlePickFolder}
              disabled={installing}
            >
              <FolderSimplePlus className="h-5 w-5" />
              <div className="text-left">
                <div className="text-sm font-medium">Wybierz folder z dysku</div>
                <div className="text-xs text-muted-foreground">
                  Otwórz dialog Windows i wskaż folder modułu
                </div>
              </div>
            </Button>

            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">lub wykryte automatycznie</span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  Wrzuć folder modułu do katalogu modules/ lub wybierz go z dysku.
                </p>
              ) : (
                available.map((mod) => (
                  <div key={mod.name} className="flex items-center gap-3 rounded-lg border p-3">
                    <PuzzlePiece className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{mod.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {mod.name} v{mod.version}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{mod.description}</div>
                    </div>
                    {mod.alreadyInstalled ? (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        zainstalowany
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleInstallFromPath(mod.sourcePath)}
                      >
                        Instaluj
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {installedModules.length === 0 ? (
        <p className="px-1 py-2 text-[10px] text-muted-foreground text-center">
          Brak modułów. Kliknij + by wgrać.
        </p>
      ) : (
        <div className="space-y-0.5">
          {installedModules.map((mod: ModuleInstance) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              isActive={mod.id === activeModuleId}
              onSelect={(id) => {
                onSelectModule(id);
              }}
              onToggle={(id, enabled) => enableModule(id, enabled)}
              onUninstall={(id) => uninstallModule(id)}
            />
          ))}
        </div>
      )}
      <Separator className="mt-1.5" />
    </div>
  );
}
