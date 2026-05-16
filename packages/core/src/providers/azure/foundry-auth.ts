// ============================================================
// Azure Entra ID authentication helper for Azure Foundry.
// Tries multiple methods before falling back to @azure/identity:
//   1. Environment variables (AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_TENANT_ID)
//   2. Azure CLI (az account get-access-token)
//   3. Managed identity (if running on Azure) — via @azure/identity
// ============================================================

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ENTRA_TOKEN_URL = 'https://login.microsoftonline.com';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Attempt to get a token via Azure CLI.
 */
async function getTokenViaAzureCli(resource: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'az',
      [
        'account',
        'get-access-token',
        '--resource',
        resource,
        '--query',
        'accessToken',
        '--output',
        'tsv',
      ],
      { timeout: 10000, windowsHide: true },
    );

    const token = stdout.trim();
    if (token && token.length > 20) {
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Attempt to get a token via client credentials flow using env variables.
 */
async function getTokenViaClientCredentials(resource: string): Promise<string | null> {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    return null;
  }

  const url = `${ENTRA_TOKEN_URL}/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: `${resource}/.default`,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Get an Entra ID token for Azure Foundry authentication.
 *
 * Tries, in order:
 *   1. Client credentials via AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID env vars
 *   2. Azure CLI (az account get-access-token)
 *   3. Falls back to null (@azure/identity SDK required for managed identity)
 */
export async function getEntraIdToken(
  resource: string = 'https://cognitiveservices.azure.com',
): Promise<string | null> {
  // Method 1: Environment variables (client credentials flow)
  const envToken = await getTokenViaClientCredentials(resource);
  if (envToken) {
    return envToken;
  }

  // Method 2: Azure CLI
  const cliToken = await getTokenViaAzureCli(resource);
  if (cliToken) {
    return cliToken;
  }

  // Method 3: @azure/identity (requires SDK — not bundled)
  return null;
}
