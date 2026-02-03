import type {
  OAuthTokenResponse,
  GetUsersOptions,
  GetFormsOptions,
  FormsResponse,
  RecordByIdResponse,
  FormFieldsResponse,
} from './models/apricot-models';

// Re-export types for convenience
export type {
  OAuthTokenResponse,
  UserAttributes,
  UserLinks,
  UserData,
  UsersResponse,
  GetUsersOptions,
  FormAttributes,
  FormData,
  FormsResponse,
  GetFormsOptions,
  RecordAttributes,
  RecordLinks,
  RecordData,
  RecordByIdResponse,
  FieldProperty,
  FieldOption,
  FormFieldData,
  FormFieldsResponse,
} from './models/apricot-models';

// ===== Configuration =====
// Use 'api' for production only (ENVIRONMENT=prod), 'sandbox' for all other environments including dev
const env = process.env.ENVIRONMENT === 'prod' ? 'api' : 'sandbox';

// API configuration from environment variables
const baseUrl = process.env.APRICOT_API_BASE_URL;
const clientId = process.env.APRICOT_CLIENT_ID;
const clientSecret = process.env.APRICOT_CLIENT_SECRET;

// Retry configuration
const MAX_RETRIES = 1;

// ===== Token Management =====
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

// Helper function to invalidate cached token
export const invalidateToken = (): void => {
  cachedToken = null;
  tokenExpiry = null;
};

// Helper function to build query string
const buildQueryString = (options?: GetUsersOptions | GetFormsOptions): string => {
  if (!options) return '';

  const params = new URLSearchParams();

  if (options.pageSize !== undefined) {
    params.append('page[size]', options.pageSize.toString());
  }

  if (options.pageNumber !== undefined) {
    params.append('page[number]', options.pageNumber.toString());
  }

  if (options.sort) {
    params.append('sort', options.sort);
  }

  if (options.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      params.append(`filter[${key}]`, value);
    });
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

// Authentication function
export const authenticate = async (): Promise<string> => {
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: APRICOT_API_BASE_URL, APRICOT_CLIENT_ID, or APRICOT_CLIENT_SECRET'
    );
  }

  try {
    const response = await fetch(`${baseUrl}/${env}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Authentication failed with status ${response.status}: ${errorText}`
      );
    }

    const data: OAuthTokenResponse = await response.json();

    if (!data.access_token) {
      throw new Error('No access_token received from Apricot API');
    }

    // Cache the token
    cachedToken = data.access_token;

    // Set expiry time (default to 1 hour if not provided)
    const expiresInMs = (data.expires_in || 3600) * 1000;
    // Subtract 60 seconds as a buffer to avoid using expired tokens
    tokenExpiry = Date.now() + expiresInMs - 60000;

    return cachedToken;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to authenticate with Apricot API: ${error.message}`, { cause: error });
    }
    throw new Error('Failed to authenticate with Apricot API: Unknown error');
  }
};

// Get Forms function
export const getForms = async (options?: GetFormsOptions): Promise<FormsResponse> => {
  if (!baseUrl) {
    throw new Error('Missing required environment variable: APRICOT_API_BASE_URL');
  }

  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      const accessToken = await authenticate();
      const queryString = buildQueryString(options);
      const url = `${baseUrl}/${env}/forms${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401 && retryCount < MAX_RETRIES) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch forms with status ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retryCount < MAX_RETRIES && error instanceof Error && error.message.includes('401')) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (error instanceof Error) {
        throw new Error(`Failed to get forms from Apricot API: ${error.message}`);
      }
      throw new Error('Failed to get forms from Apricot API: Unknown error');
    }
  }

  throw new Error('Failed to get forms after retries');
};

// Get Record by ID function
export const getRecordById = async (recordId: number): Promise<RecordByIdResponse> => {
  if (!baseUrl) {
    throw new Error('Missing required environment variable: APRICOT_API_BASE_URL');
  }

  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      const accessToken = await authenticate();
      const url = `${baseUrl}/${env}/records/${recordId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401 && retryCount < MAX_RETRIES) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch record with status ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retryCount < MAX_RETRIES && error instanceof Error && error.message.includes('401')) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (error instanceof Error) {
        throw new Error(`Failed to get record from Apricot API: ${error.message}`);
      }
      throw new Error('Failed to get record from Apricot API: Unknown error');
    }
  }

  throw new Error('Failed to get record after retries');
};

// Get Form Fields function
export const getFormFields = async (formId: number): Promise<FormFieldsResponse> => {
  if (!baseUrl) {
    throw new Error('Missing required environment variable: APRICOT_API_BASE_URL');
  }

  let retryCount = 0;

  while (retryCount <= MAX_RETRIES) {
    try {
      const accessToken = await authenticate();
      const url = `${baseUrl}/${env}/forms/${formId}/fields`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401 && retryCount < MAX_RETRIES) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch form fields with status ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (retryCount < MAX_RETRIES && error instanceof Error && error.message.includes('401')) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (error instanceof Error) {
        throw new Error(`Failed to get form fields from Apricot API: ${error.message}`);
      }
      throw new Error('Failed to get form fields from Apricot API: Unknown error');
    }
  }

  throw new Error('Failed to get form fields after retries');
};
