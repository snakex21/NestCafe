'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PuzzlePiece, Trash } from '@phosphor-icons/react';
import type { ModuleInstance } from '@nestcafe_ai/agent-core';

interface ModuleCardProps {
  module: ModuleInstance;
  isActive: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onUninstall: (id: string) => void;
}

export default function ModuleCard({
  module,
  isActive,
  onSelect,
  onToggle,
  onUninstall,
}: ModuleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
      }`}
      onClick={() => onSelect(module.id)}
    >
      <PuzzlePiece className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{module.title}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          v{module.version} — {module.name}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Switch
          checked={module.enabled}
          onCheckedChange={(checked) => onToggle(module.id, checked)}
          className="scale-75"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            onUninstall(module.id);
          }}
        >
          <Trash className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}
