// ============================================================
// HuggingFace Local provider — ONNX-based local inference.
// Uses HuggingFace Hub API for model discovery and download.
// ============================================================

export const HF_LOCAL_DEFAULT_URL = 'http://127.0.0.1:8765';
export const HF_HUB_API_BASE = 'https://huggingface.co/api';

export interface HuggingFaceHubModel {
  id: string;
  displayName: string;
  downloads: number;
  likes: number;
  sizeBytes?: number;
}

interface HfHubSearchResult {
  id: string;
  modelId?: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag?: string;
  siblings?: Array<{ rfilename: string; size?: number }>;
}

/**
 * Recommended ONNX-compatible models for local inference.
 */
export const HF_RECOMMENDED_MODELS: HuggingFaceHubModel[] = [
  {
    id: 'microsoft/Phi-3.5-mini-instruct-onnx',
    displayName: 'Phi-3.5 Mini',
    downloads: 0,
    likes: 0,
  },
  {
    id: 'onnx-community/Llama-3.2-1B-Instruct',
    displayName: 'Llama 3.2 1B',
    downloads: 0,
    likes: 0,
  },
];

/**
 * Search HuggingFace Hub for models matching the query.
 * Returns top results sorted by downloads, with ONNX-compatible models
 * boosted to the top when available.
 */
export async function searchHuggingFaceHubModels(query: string): Promise<HuggingFaceHubModel[]> {
  const params = new URLSearchParams({
    search: query || 'text-generation',
    sort: 'downloads',
    direction: '-1',
    limit: '20',
    full: 'false',
  });
  const url = `${HF_HUB_API_BASE}/models?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return HF_RECOMMENDED_MODELS;
    }

    const results: HfHubSearchResult[] = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return HF_RECOMMENDED_MODELS;
    }

    const mapped: HuggingFaceHubModel[] = results.map((r) => {
      const modelId = r.modelId ?? r.id;
      const totalSize = r.siblings?.reduce((sum, s) => sum + (s.size ?? 0), 0);
      return {
        id: modelId,
        displayName: modelId.split('/').pop() ?? modelId,
        downloads: r.downloads ?? 0,
        likes: r.likes ?? 0,
        sizeBytes: totalSize && totalSize > 0 ? totalSize : undefined,
      };
    });

    // Boost ONNX-compatible models to the top
    const onnx = mapped.filter(
      (m) => m.id.toLowerCase().includes('onnx') || m.displayName.toLowerCase().includes('onnx'),
    );
    const rest = mapped.filter(
      (m) => !m.id.toLowerCase().includes('onnx') && !m.displayName.toLowerCase().includes('onnx'),
    );
    return [...onnx, ...rest].slice(0, 20);
  } catch {
    return HF_RECOMMENDED_MODELS;
  }
}

/**
 * Test connection to a local HuggingFace inference server
 * by hitting its health endpoint.
 */
export async function testHuggingFaceLocalConnection(
  baseUrl: string = HF_LOCAL_DEFAULT_URL,
): Promise<{ connected: boolean; error?: string }> {
  const endpoints = ['/health', '/', '/v1/models'];

  for (const endpoint of endpoints) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return { connected: true };
      }
    } catch {
      // Try next endpoint
    }
  }

  return { connected: false, error: `No response from ${baseUrl}` };
}
