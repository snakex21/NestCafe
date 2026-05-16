// ============================================================
// Auth domain types — API key and credential configurations
// for all supported AI providers.
// ============================================================

// ---- Generic API key ----

export interface ApiKeyConfig {
  provider: string;
  key: string;
  label?: string;
  createdAt: string;
}

// ---- AWS Bedrock credentials ----

export interface BedrockAccessKeyCredentials {
  type: 'access-key';
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

export interface BedrockProfileCredentials {
  type: 'profile';
  profileName: string;
  region?: string;
}

export interface BedrockApiKeyCredentials {
  type: 'api-key';
  apiKey: string;
  region?: string;
}

export type BedrockCredentials =
  | BedrockAccessKeyCredentials
  | BedrockProfileCredentials
  | BedrockApiKeyCredentials;

// ---- Google Vertex credentials ----

export interface VertexServiceAccountCredentials {
  type: 'service-account';
  projectId: string;
  clientEmail: string;
  privateKey: string;
  location?: string;
}

export interface VertexAdcCredentials {
  type: 'adc';
  projectId: string;
  location?: string;
}

export type VertexCredentials = VertexServiceAccountCredentials | VertexAdcCredentials;
