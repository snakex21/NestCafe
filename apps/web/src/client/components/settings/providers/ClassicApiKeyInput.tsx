import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Eye, EyeSlash, Trash } from '@phosphor-icons/react';

interface ClassicApiKeyInputProps {
  apiKey: string;
  onChange: (value: string) => void;
  onClear: () => void;
  connecting: boolean;
  error?: string | null;
  isConnected?: boolean;
  savedApiKey?: string | null;
}

export function ClassicApiKeyInput({
  apiKey,
  onChange,
  onClear,
  connecting,
  error,
  isConnected,
  savedApiKey,
}: ClassicApiKeyInputProps) {
  const { t } = useTranslation('settings');
  const [showApiKey, setShowApiKey] = useState(false);
  const [editingSavedKey, setEditingSavedKey] = useState<string | null>(null);
  const isEditingSavedKey = isConnected && editingSavedKey === (savedApiKey ?? '');
  const displayValue = isConnected && !isEditingSavedKey ? (savedApiKey ?? '') : apiKey;

  let status: { label: string; className: string } | null = null;
  if (connecting) {
    status = { label: 'Scanning…', className: 'text-muted-foreground' };
  } else if (error) {
    status = { label: 'Invalid key', className: 'text-destructive' };
  } else if (isConnected) {
    status = { label: 'Valid key', className: 'text-emerald-500' };
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={showApiKey ? 'text' : 'password'}
          value={displayValue}
          onChange={(e) => {
            if (isConnected && !isEditingSavedKey) {
              setEditingSavedKey(savedApiKey ?? '');
            }
            onChange(e.target.value);
          }}
          placeholder={t('apiKey.enterKey')}
          data-testid="api-key-input"
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 pr-28 text-sm disabled:opacity-50"
        />
        {status && (
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
        )}
      </div>
      <button
        onClick={() => setShowApiKey((current) => !current)}
        className="rounded-md border border-border p-2.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={!displayValue}
        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
        title={showApiKey ? 'Hide API key' : 'Show API key'}
      >
        {showApiKey ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button
        onClick={() => {
          if (isConnected && !isEditingSavedKey) {
            setEditingSavedKey(savedApiKey ?? '');
          }
          onClear();
        }}
        className="rounded-md border border-border p-2.5 text-muted-foreground hover:text-foreground transition-colors"
        type="button"
        aria-label="Clear API key"
        title="Clear API key"
        disabled={!displayValue}
      >
        <Trash className="h-4 w-4" />
      </button>
    </div>
  );
}
