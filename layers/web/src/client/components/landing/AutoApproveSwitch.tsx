import { ShieldCheck } from '@phosphor-icons/react';
import { Switch } from '@/components/ui/switch';
import { useTaskStore } from '@/stores/taskStore';

export function AutoApproveSwitch() {
  const autoApprovePermissions = useTaskStore((state) => state.autoApprovePermissions);
  const setAutoApprovePermissions = useTaskStore((state) => state.setAutoApprovePermissions);
  const respondToPermission = useTaskStore((state) => state.respondToPermission);

  const handleCheckedChange = (checked: boolean) => {
    setAutoApprovePermissions(checked);
    if (!checked) {
      return;
    }
    const pendingRequests = Object.values(useTaskStore.getState().permissionRequests).filter(
      (request) => request.type !== 'question',
    );
    for (const request of pendingRequests) {
      void respondToPermission({
        requestId: request.id,
        taskId: request.taskId,
        decision: 'allow',
      });
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
      title="Auto-approve tool and file permission prompts"
    >
      <ShieldCheck className="h-4 w-4" weight={autoApprovePermissions ? 'fill' : 'regular'} />
      <Switch
        size="sm"
        checked={autoApprovePermissions}
        onCheckedChange={handleCheckedChange}
        ariaLabel="Auto-approve permissions"
        data-testid="auto-approve-switch"
      />
    </div>
  );
}
