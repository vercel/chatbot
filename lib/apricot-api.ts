import type {
  OAuthTokenResponse,
  GetUsersOptions,
  UsersResponse,
  GetFormsOptions,
  FormsResponse,
  RecordByIdResponse,
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
} from './models/apricot-models';

// ===== Token Management =====
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

// Helper function to invalidate cached token
export const invalidateToken = (): void => {
  cachedToken = null;
  tokenExpiry = null;
};

// Helper function to build query string
const buildQueryString = (
  options?: GetUsersOptions | GetFormsOptions
): string => {
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

  // Get environment variables
  const baseUrl = process.env.APRICOT_API_BASE_URL;
  const clientId = process.env.APRICOT_CLIENT_ID;
  const clientSecret = process.env.APRICOT_CLIENT_SECRET;

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      'Missing required environment variables: APRICOT_API_BASE_URL, APRICOT_CLIENT_ID, or APRICOT_CLIENT_SECRET'
    );
  }

  try {
    const response = await fetch(`${baseUrl}/sandbox/oauth/token`, {
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
      throw new Error(
        `Failed to authenticate with Apricot API: ${error.message}`,
        { cause: error }
      );
    }
    throw new Error('Failed to authenticate with Apricot API: Unknown error');
  }
};

// Get Users function
export const getUsers = async (
  options?: GetUsersOptions
): Promise<UsersResponse> => {
  const baseUrl = process.env.APRICOT_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      'Missing required environment variable: APRICOT_API_BASE_URL'
    );
  }

  // Get access token (with retry logic)
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      const accessToken = await authenticate();

      const queryString = buildQueryString(options);
      const url = `${baseUrl}/sandbox/users${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Handle 401 errors by invalidating token and retrying once
      if (response.status === 401 && retryCount < maxRetries) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch users with status ${response.status}: ${errorText}`
        );
      }

      const data: UsersResponse = await response.json();
      return data;
    } catch (error) {
      // If it's a 401 and we haven't retried yet, continue the loop
      if (
        retryCount < maxRetries &&
        error instanceof Error &&
        error.message.includes('401')
      ) {
        invalidateToken();
        retryCount++;
        continue;
      }

      // Otherwise, throw the error
      if (error instanceof Error) {
        throw new Error(
          `Failed to get users from Apricot API: ${error.message}`
        );
      }
      throw new Error('Failed to get users from Apricot API: Unknown error');
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Failed to get users after retries');
};

// Get Forms function
export const getForms = async (
  options?: GetFormsOptions
): Promise<FormsResponse> => {
  const baseUrl = process.env.APRICOT_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      'Missing required environment variable: APRICOT_API_BASE_URL'
    );
  }

  // Get access token (with retry logic)
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      const accessToken = await authenticate();

      const queryString = buildQueryString(options);
      const url = `${baseUrl}/sandbox/forms${queryString}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Handle 401 errors by invalidating token and retrying once
      if (response.status === 401 && retryCount < maxRetries) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch forms with status ${response.status}: ${errorText}`
        );
      }

      const data: FormsResponse = await response.json();
      return data;
    } catch (error) {
      // If it's a 401 and we haven't retried yet, continue the loop
      if (
        retryCount < maxRetries &&
        error instanceof Error &&
        error.message.includes('401')
      ) {
        invalidateToken();
        retryCount++;
        continue;
      }

      // Otherwise, throw the error
      if (error instanceof Error) {
        throw new Error(
          `Failed to get forms from Apricot API: ${error.message}`
        );
      }
      throw new Error('Failed to get forms from Apricot API: Unknown error');
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Failed to get forms after retries');
};

// Get Record by ID function
export const getRecordById = async (
  recordId: number
): Promise<RecordByIdResponse> => {
  const baseUrl = process.env.APRICOT_API_BASE_URL;

  if (!baseUrl) {
    throw new Error(
      'Missing required environment variable: APRICOT_API_BASE_URL'
    );
  }

  // Get access token (with retry logic)
  let retryCount = 0;
  const maxRetries = 1;

  while (retryCount <= maxRetries) {
    try {
      const accessToken = await authenticate();

      const url = `${baseUrl}/sandbox/records/${recordId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Handle 401 errors by invalidating token and retrying once
      if (response.status === 401 && retryCount < maxRetries) {
        invalidateToken();
        retryCount++;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch record with status ${response.status}: ${errorText}`
        );
      }

      const data: RecordByIdResponse = await response.json();
      return data;
    } catch (error) {
      // If it's a 401 and we haven't retried yet, continue the loop
      if (
        retryCount < maxRetries &&
        error instanceof Error &&
        error.message.includes('401')
      ) {
        invalidateToken();
        retryCount++;
        continue;
      }

      // Otherwise, throw the error
      if (error instanceof Error) {
        throw new Error(
          `Failed to get record from Apricot API: ${error.message}`
        );
      }
      throw new Error('Failed to get record from Apricot API: Unknown error');
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Failed to get record after retries');
};
