import { useTranslation } from 'react-i18next';
import type { ProviderId, ConnectedProvider } from '@nestcafe_ai/agent-core/common';
import { PROVIDER_META } from '@nestcafe_ai/agent-core/common';
import {
  ClassicProviderForm,
  BedrockProviderForm,
  AzureFoundryProviderForm,
  OllamaProviderForm,
  OpenRouterProviderForm,
  LiteLLMProviderForm,
  LMStudioProviderForm,
  VertexProviderForm,
  HuggingFaceProviderForm,
  CustomProviderForm,
  NimProviderForm,
  CopilotProviderForm,
  NestcafeAiProviderForm,
} from './providers';
import { ZaiProviderForm } from './providers/ZaiProviderForm';

interface ProviderFormSelectorProps {
  providerId: ProviderId;
  connectedProvider?: ConnectedProvider;
  onConnect: (provider: ConnectedProvider) => void;
  onUpdateProvider?: (provider: ConnectedProvider) => void;
  onDisconnect: () => void;
  onModelChange: (modelId: string) => void;
  showModelError: boolean;
  onDelete?: () => void;
}

export function ProviderFormSelector({
  providerId,
  connectedProvider,
  onConnect,
  onUpdateProvider,
  onDisconnect,
  onModelChange,
  showModelError,
  onDelete,
}: ProviderFormSelectorProps) {
  const { t } = useTranslation('settings');
  const meta = providerId.startsWith('custom:') ? PROVIDER_META.custom : PROVIDER_META[providerId];

  if (providerId.startsWith('custom:')) {
    return (
      <CustomProviderForm
        providerId={providerId}
        connectedProvider={connectedProvider}
        onConnect={onConnect}
        onUpdateProvider={onUpdateProvider}
        onDisconnect={onDisconnect}
        onModelChange={onModelChange}
        showModelError={showModelError}
        onDelete={onDelete}
      />
    );
  }

  // Handle GitHub Copilot separately (device OAuth flow, no API key)
  if (providerId === 'copilot') {
    return (
      <CopilotProviderForm
        connectedProvider={connectedProvider}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onModelChange={onModelChange}
        showModelError={showModelError}
      />
    );
  }

  // Handle NVIDIA NIM separately (has custom endpoint + API key)
  if (providerId === 'nim') {
    return (
      <NimProviderForm
        connectedProvider={connectedProvider}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onModelChange={onModelChange}
        showModelError={showModelError}
      />
    );
  }

  // Handle Accomplish AI separately (device fingerprint flow, no API key)
  if (providerId === 'nestcafe-ai') {
    return (
      <NestcafeAiProviderForm
        connectedProvider={connectedProvider}
        onConnect={onConnect}
        onUpdateProvider={onUpdateProvider}
        onDisconnect={onDisconnect}
        onModelChange={onModelChange}
        showModelError={showModelError}
      />
    );
  }

  // Handle Z.AI separately (has region selector)
  if (providerId === 'zai') {
    return (
      <ZaiProviderForm
        connectedProvider={connectedProvider}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onModelChange={onModelChange}
        showModelError={showModelError}
      />
    );
  }

  switch (meta.category) {
    case 'classic':
      return (
        <ClassicProviderForm
          providerId={providerId}
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'aws':
      return (
        <BedrockProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'gcp':
      return (
        <VertexProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'azure':
      return (
        <AzureFoundryProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'local':
      if (providerId === 'lmstudio') {
        return (
          <LMStudioProviderForm
            connectedProvider={connectedProvider}
            onConnect={onConnect}
            onUpdateProvider={onUpdateProvider}
            onDisconnect={onDisconnect}
            onModelChange={onModelChange}
            showModelError={showModelError}
          />
        );
      }
      if (providerId === 'huggingface-local') {
        return (
          <HuggingFaceProviderForm
            connectedProvider={connectedProvider}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onModelChange={onModelChange}
            showModelError={showModelError}
          />
        );
      }
      return (
        <OllamaProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onUpdateProvider={onUpdateProvider}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'proxy':
      return (
        <OpenRouterProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    case 'hybrid':
      if (providerId === 'custom') {
        return (
          <CustomProviderForm
            providerId={providerId}
            connectedProvider={connectedProvider}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onModelChange={onModelChange}
            showModelError={showModelError}
          />
        );
      }
      // Default to LiteLLM for other hybrid providers
      return (
        <LiteLLMProviderForm
          connectedProvider={connectedProvider}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onModelChange={onModelChange}
          showModelError={showModelError}
        />
      );

    default:
      return <div>{t('providers.unknownType')}</div>;
  }
}
