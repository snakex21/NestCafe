import { useState } from 'react';
import { Eye, EyeSlash, Trash } from '@phosphor-icons/react';
import { FormError } from '../shared';

const MAX_ICON_SOURCE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ICON_DATA_URL_LENGTH = 48 * 1024;
const ICON_MAX_SIZE = 128;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read image'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = dataUrl;
  });
}

async function resizeIconDataUrl(file: File): Promise<string> {
  const sourceDataUrl = await readFileAsDataUrl(file);

  if (sourceDataUrl.length <= MAX_ICON_DATA_URL_LENGTH) {
    return sourceDataUrl;
  }

  const image = await loadImageFromDataUrl(sourceDataUrl);
  const scale = Math.min(ICON_MAX_SIZE / image.width, ICON_MAX_SIZE / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to resize image');
  }
  context.drawImage(image, 0, 0, width, height);

  const webpDataUrl = canvas.toDataURL('image/webp', 0.82);
  if (webpDataUrl.length <= MAX_ICON_DATA_URL_LENGTH) {
    return webpDataUrl;
  }

  const jpegQualities = [0.72, 0.6, 0.48, 0.36];
  for (const quality of jpegQualities) {
    const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
    if (jpegDataUrl.length <= MAX_ICON_DATA_URL_LENGTH) {
      return jpegDataUrl;
    }
  }

  return canvas.toDataURL('image/jpeg', 0.28);
}

interface CustomProviderInputsProps {
  baseUrl: string;
  apiKey: string;
  displayName: string;
  iconUrl: string;
  connecting: boolean;
  error: string | null;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onIconUrlChange: (value: string) => void;
}

export function CustomProviderInputs({
  baseUrl,
  apiKey,
  displayName,
  iconUrl,
  connecting,
  error,
  onBaseUrlChange,
  onApiKeyChange,
  onDisplayNameChange,
  onIconUrlChange,
}: CustomProviderInputsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const [resizingIcon, setResizingIcon] = useState(false);

  const handleIconFileChange = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (file.size > MAX_ICON_SOURCE_FILE_BYTES) {
      setIconError('Icon image must be smaller than 5 MB.');
      return;
    }

    setIconError(null);
    setResizingIcon(true);

    try {
      const dataUrl = await resizeIconDataUrl(file);
      if (dataUrl.length > MAX_ICON_DATA_URL_LENGTH) {
        setIconError('Icon is still too large after resizing. Try a simpler image.');
        return;
      }
      onIconUrlChange(dataUrl);
    } catch (err) {
      setIconError(err instanceof Error ? err.message : 'Failed to resize icon image.');
    } finally {
      setResizingIcon(false);
    }
  };

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label
            htmlFor="custom-display-name"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Provider Name
          </label>
          <input
            id="custom-display-name"
            type="text"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="My Custom Provider"
            data-testid="custom-display-name"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="custom-icon-file"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Icon Image <span className="text-muted-foreground">(Optional)</span>
          </label>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt="Custom provider icon"
                  onError={() =>
                    setIconError('Icon preview failed to load. Try another image file.')
                  }
                  className="h-full w-full object-cover"
                />
              ) : resizingIcon ? (
                <span className="text-[10px] text-muted-foreground">...</span>
              ) : (
                <span className="text-xs text-muted-foreground">IMG</span>
              )}
            </div>
            <input
              id="custom-icon-file"
              type="file"
              accept="image/*"
              onChange={(e) => void handleIconFileChange(e.target.files?.[0])}
              data-testid="custom-icon-file"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground"
            />
            {iconUrl && (
              <button
                type="button"
                onClick={() => {
                  setIconError(null);
                  onIconUrlChange('');
                }}
                className="rounded-md border border-border px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="custom-base-url" className="mb-2 block text-sm font-medium text-foreground">
          Base URL
        </label>
        <input
          id="custom-base-url"
          type="text"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="https://api.example.com/v1"
          data-testid="custom-base-url"
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Base URL ending in /v1 (the SDK appends /chat/completions)
        </p>
      </div>

      <div>
        <label htmlFor="custom-api-key" className="mb-2 block text-sm font-medium text-foreground">
          API Key <span className="text-muted-foreground">(Optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            id="custom-api-key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Optional API key"
            data-testid="custom-api-key"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm"
          />
          <button
            onClick={() => setShowApiKey((current) => !current)}
            className="rounded-md border border-border p-2.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!apiKey}
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            title={showApiKey ? 'Hide API key' : 'Show API key'}
          >
            {showApiKey ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onApiKeyChange('')}
            className="rounded-md border border-border p-2.5 text-muted-foreground hover:text-foreground transition-colors"
            type="button"
            disabled={!apiKey}
            aria-label="Clear API key"
            title="Clear API key"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </div>

      <FormError error={iconError || error} />
      <p className="min-h-5 text-sm text-muted-foreground">
        {connecting ? 'Scanning endpoint models…' : ' '}
      </p>
    </>
  );
}
