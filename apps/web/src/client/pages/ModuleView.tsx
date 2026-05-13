'use client';

import { useParams, useNavigate } from 'react-router';
import { useEffect } from 'react';
import ModulePanel from '@/components/modules/ModulePanel';
import { useModuleStore } from '@/stores/moduleStore';

export function ModuleView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setActiveModule = useModuleStore((s) => s.setActiveModule);

  useEffect(() => {
    if (id) {
      setActiveModule(id);
    }
  }, [id, setActiveModule]);

  if (!id) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Nie wybrano modułu.
      </div>
    );
  }

  return (
    <ModulePanel
      moduleId={id}
      onClose={() => {
        setActiveModule(null);
        navigate('/');
      }}
    />
  );
}
