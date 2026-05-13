import type { ProviderId } from '@nestcafe_ai/agent-core/common';
import anthropicLogo from '/assets/ai-logos/anthropic.svg';
import openaiLogo from '/assets/ai-logos/openai.svg';
import googleLogo from '/assets/ai-logos/google.svg';
import xaiLogo from '/assets/ai-logos/xai.svg';
import deepseekLogo from '/assets/ai-logos/deepseek.svg';
import moonshotLogo from '/assets/ai-logos/moonshot.png';
import zaiLogo from '/assets/ai-logos/zai.svg';
import bedrockLogo from '/assets/ai-logos/bedrock.svg';
import vertexLogo from '/assets/ai-logos/vertex.svg';
import azureLogo from '/assets/ai-logos/azure.svg';
import ollamaLogo from '/assets/ai-logos/ollama.svg';
import openrouterLogo from '/assets/ai-logos/openrouter.svg';
import litellmLogo from '/assets/ai-logos/litellm.svg';
import minimaxLogo from '/assets/ai-logos/minimax.svg';
import lmstudioLogo from '/assets/ai-logos/lmstudio.png';
import huggingfaceLogo from '/assets/ai-logos/huggingface.png';
import nebiusLogo from '/assets/ai-logos/nebius.png';
import togetherLogo from '/assets/ai-logos/together.png';
import fireworksLogo from '/assets/ai-logos/fireworks.png';
import groqLogo from '/assets/ai-logos/groq.png';
import veniceLogo from '/assets/ai-logos/venice.svg';
import customLogo from '/assets/ai-logos/custom.svg';
import nimLogo from '/assets/ai-logos/nim.png';
import copilotLogo from '/assets/ai-logos/copilot.svg';
import accomplishLogo from '/assets/ai-logos/nestcafe.svg';
import qwenChinaLogo from '/assets/ai-logos/qwen-china.png';
import qwenInternationalLogo from '/assets/ai-logos/qwen-international.png';
import xiaomiLogo from '/assets/ai-logos/xiaomi.png';
import perplexityLogo from '/assets/ai-logos/perplexity.png';

export const PROVIDER_LOGOS: Record<string, string> = {
  anthropic: anthropicLogo,
  openai: openaiLogo,
  google: googleLogo,
  xai: xaiLogo,
  deepseek: deepseekLogo,
  moonshot: moonshotLogo,
  zai: zaiLogo,
  bedrock: bedrockLogo,
  vertex: vertexLogo,
  'azure-foundry': azureLogo,
  ollama: ollamaLogo,
  openrouter: openrouterLogo,
  litellm: litellmLogo,
  minimax: minimaxLogo,
  lmstudio: lmstudioLogo,
  'huggingface-local': huggingfaceLogo,
  nebius: nebiusLogo,
  together: togetherLogo,
  fireworks: fireworksLogo,
  groq: groqLogo,
  venice: veniceLogo,
  nim: nimLogo,
  custom: customLogo,
  copilot: copilotLogo,
  'nestcafe-ai': accomplishLogo,
  'qwen-china': qwenChinaLogo,
  'qwen-international': qwenInternationalLogo,
  xiaomi: xiaomiLogo,
  perplexity: perplexityLogo,
};

export const DARK_INVERT_PROVIDERS = new Set<ProviderId>([
  'openai',
  'xai',
  'ollama',
  'openrouter',
  'together',
]);

export function getProviderLogo(providerId: ProviderId): string | undefined {
  // For custom:uuid providers, return the generic custom logo
  if (typeof providerId === 'string' && providerId.startsWith('custom:')) {
    return customLogo;
  }
  return PROVIDER_LOGOS[providerId];
}
