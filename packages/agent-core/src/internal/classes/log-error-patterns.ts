export interface OpenCodeLogError {
  timestamp: string;
  service: string;
  providerID?: string;
  modelID?: string;
  sessionID?: string;
  errorName: string;
  statusCode?: number;
  message?: string;
  raw: string;
  isAuthError?: boolean;
}

const OPENAI_PROVIDER_CONTEXT =
  /(?:\bproviderID=openai(?![\w-])|\bprovider=openai(?![\w-])|"providerID"\s*:\s*"openai"|"provider"\s*:\s*"openai"|api\.openai\.com)/i;

export const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  extract: (match: RegExpMatchArray, line: string) => Partial<OpenCodeLogError>;
}> = [
  {
    pattern: /ThrottlingException.*?"message":"([^"]+)"/,
    extract: (match) => ({
      errorName: 'ThrottlingException',
      statusCode: 429,
      message: match[1] || 'Rate limit exceeded. Please wait before trying again.',
    }),
  },
  {
    pattern: /"name":"AI_APICallError".*?"statusCode":(\d+).*?"message":"([^"]+)"/,
    extract: (match) => ({
      errorName: 'AI_APICallError',
      statusCode: parseInt(match[1], 10),
      message: match[2],
    }),
  },
  {
    pattern: /"name":"AI_APICallError".*?"message":"([^"]+)".*?"statusCode":(\d+)/,
    extract: (match) => ({
      errorName: 'AI_APICallError',
      statusCode: parseInt(match[2], 10),
      message: match[1],
    }),
  },
  {
    pattern: /"name":"AI_APICallError".*?"statusCode":(\d+)/,
    extract: (match) => ({
      errorName: 'AI_APICallError',
      statusCode: parseInt(match[1], 10),
      message: `API call failed with status ${match[1]}`,
    }),
  },
  {
    pattern: /(?:invalid_api_key|invalid_token|token.*expired|oauth.*invalid|Incorrect API key)/i,
    extract: (_match, line) => ({
      errorName: 'OAuthExpiredError',
      statusCode: 401,
      message: OPENAI_PROVIDER_CONTEXT.test(line)
        ? 'Your OpenAI session has expired. Please re-authenticate.'
        : 'Authentication failed. Please check your API credentials in Settings.',
      providerID: OPENAI_PROVIDER_CONTEXT.test(line) ? 'openai' : undefined,
      isAuthError: OPENAI_PROVIDER_CONTEXT.test(line),
    }),
  },
  {
    pattern: /(?:"status":\s*401|statusCode.*401|401.*Unauthorized)/i,
    extract: (_match, line) => ({
      errorName: 'OAuthUnauthorizedError',
      statusCode: 401,
      message: OPENAI_PROVIDER_CONTEXT.test(line)
        ? 'Your OpenAI session has expired. Please re-authenticate.'
        : 'Authentication failed. Please check your API credentials in Settings.',
      providerID: OPENAI_PROVIDER_CONTEXT.test(line) ? 'openai' : undefined,
      isAuthError: OPENAI_PROVIDER_CONTEXT.test(line),
    }),
  },
  {
    pattern: /authentication.*failed/i,
    extract: (_match, line) => ({
      errorName: 'OAuthAuthenticationError',
      statusCode: 401,
      message: OPENAI_PROVIDER_CONTEXT.test(line)
        ? 'OpenAI authentication failed. Please re-authenticate.'
        : 'Authentication failed. Please check your API credentials in Settings.',
      providerID: OPENAI_PROVIDER_CONTEXT.test(line) ? 'openai' : undefined,
      isAuthError: OPENAI_PROVIDER_CONTEXT.test(line),
    }),
  },
  {
    pattern: /AccessDeniedException|UnauthorizedException|InvalidSignatureException/,
    extract: () => ({
      errorName: 'AuthenticationError',
      statusCode: 403,
      message: 'Authentication failed. Please check your credentials.',
    }),
  },
  {
    pattern: /ModelNotFoundError|ResourceNotFoundException.*model/i,
    extract: () => ({
      errorName: 'ModelNotFoundError',
      statusCode: 404,
      message: 'The requested model was not found or is not available in your region.',
    }),
  },
  {
    pattern: /ValidationException.*?"message":"([^"]+)"/,
    extract: (match) => ({
      errorName: 'ValidationError',
      statusCode: 400,
      message: match[1] || 'Invalid request parameters.',
    }),
  },
];

export function getErrorMessage(error: OpenCodeLogError): string {
  switch (error.errorName) {
    case 'OAuthExpiredError':
    case 'OAuthUnauthorizedError':
    case 'OAuthAuthenticationError':
      return error.message || 'Your session has expired. Please re-authenticate.';
    case 'ThrottlingException':
      return `Rate limit exceeded: ${error.message || 'Please wait before trying again.'}`;
    case 'AuthenticationError':
      return 'Authentication failed. Please check your API credentials in Settings.';
    case 'ModelNotFoundError':
      return `Model not available: ${error.modelID || 'unknown'}. Please select a different model.`;
    case 'ValidationError':
      return `Invalid request: ${error.message ?? 'Unknown validation error'}`;
    case 'AI_APICallError':
      if (error.statusCode === 429) {
        return `Rate limit exceeded: ${error.message || 'Please wait before trying again.'}`;
      }
      if (error.statusCode === 503) {
        return 'Service temporarily unavailable. Please try again later.';
      }
      return `API error (${error.statusCode}): ${error.message || 'Unknown error'}`;
    default:
      return error.message || `Error: ${error.errorName}`;
  }
}
