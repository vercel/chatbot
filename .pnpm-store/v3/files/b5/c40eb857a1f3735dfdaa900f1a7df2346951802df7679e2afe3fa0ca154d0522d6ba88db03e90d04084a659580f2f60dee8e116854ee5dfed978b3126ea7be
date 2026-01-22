import { LanguageModelV3, ProviderV3, EmbeddingModelV3, ImageModelV3, TypeValidationError } from '@ai-sdk/provider';
import * as _ai_sdk_provider_utils from '@ai-sdk/provider-utils';
import { FetchFunction, InferSchema } from '@ai-sdk/provider-utils';

type GatewayModelId = 'alibaba/qwen-3-14b' | 'alibaba/qwen-3-235b' | 'alibaba/qwen-3-30b' | 'alibaba/qwen-3-32b' | 'alibaba/qwen3-235b-a22b-thinking' | 'alibaba/qwen3-coder' | 'alibaba/qwen3-coder-30b-a3b' | 'alibaba/qwen3-coder-plus' | 'alibaba/qwen3-max' | 'alibaba/qwen3-max-preview' | 'alibaba/qwen3-next-80b-a3b-instruct' | 'alibaba/qwen3-next-80b-a3b-thinking' | 'alibaba/qwen3-vl-instruct' | 'alibaba/qwen3-vl-thinking' | 'amazon/nova-2-lite' | 'amazon/nova-lite' | 'amazon/nova-micro' | 'amazon/nova-pro' | 'anthropic/claude-3-haiku' | 'anthropic/claude-3-opus' | 'anthropic/claude-3.5-haiku' | 'anthropic/claude-3.5-sonnet' | 'anthropic/claude-3.5-sonnet-20240620' | 'anthropic/claude-3.7-sonnet' | 'anthropic/claude-haiku-4.5' | 'anthropic/claude-opus-4' | 'anthropic/claude-opus-4.1' | 'anthropic/claude-opus-4.5' | 'anthropic/claude-sonnet-4' | 'anthropic/claude-sonnet-4.5' | 'arcee-ai/trinity-mini' | 'bytedance/seed-1.6' | 'cohere/command-a' | 'deepseek/deepseek-r1' | 'deepseek/deepseek-v3' | 'deepseek/deepseek-v3.1' | 'deepseek/deepseek-v3.1-terminus' | 'deepseek/deepseek-v3.2' | 'deepseek/deepseek-v3.2-exp' | 'deepseek/deepseek-v3.2-thinking' | 'google/gemini-2.0-flash' | 'google/gemini-2.0-flash-lite' | 'google/gemini-2.5-flash' | 'google/gemini-2.5-flash-image' | 'google/gemini-2.5-flash-image-preview' | 'google/gemini-2.5-flash-lite' | 'google/gemini-2.5-flash-lite-preview-09-2025' | 'google/gemini-2.5-flash-preview-09-2025' | 'google/gemini-2.5-pro' | 'google/gemini-3-flash' | 'google/gemini-3-pro-image' | 'google/gemini-3-pro-preview' | 'inception/mercury-coder-small' | 'kwaipilot/kat-coder-pro-v1' | 'meituan/longcat-flash-chat' | 'meituan/longcat-flash-thinking' | 'meta/llama-3.1-70b' | 'meta/llama-3.1-8b' | 'meta/llama-3.2-11b' | 'meta/llama-3.2-1b' | 'meta/llama-3.2-3b' | 'meta/llama-3.2-90b' | 'meta/llama-3.3-70b' | 'meta/llama-4-maverick' | 'meta/llama-4-scout' | 'minimax/minimax-m2' | 'minimax/minimax-m2.1' | 'minimax/minimax-m2.1-lightning' | 'mistral/codestral' | 'mistral/devstral-2' | 'mistral/devstral-small' | 'mistral/devstral-small-2' | 'mistral/magistral-medium' | 'mistral/magistral-small' | 'mistral/ministral-14b' | 'mistral/ministral-3b' | 'mistral/ministral-8b' | 'mistral/mistral-large-3' | 'mistral/mistral-medium' | 'mistral/mistral-nemo' | 'mistral/mistral-small' | 'mistral/mixtral-8x22b-instruct' | 'mistral/pixtral-12b' | 'mistral/pixtral-large' | 'moonshotai/kimi-k2' | 'moonshotai/kimi-k2-0905' | 'moonshotai/kimi-k2-thinking' | 'moonshotai/kimi-k2-thinking-turbo' | 'moonshotai/kimi-k2-turbo' | 'morph/morph-v3-fast' | 'morph/morph-v3-large' | 'nvidia/nemotron-3-nano-30b-a3b' | 'nvidia/nemotron-nano-12b-v2-vl' | 'nvidia/nemotron-nano-9b-v2' | 'openai/codex-mini' | 'openai/gpt-3.5-turbo' | 'openai/gpt-3.5-turbo-instruct' | 'openai/gpt-4-turbo' | 'openai/gpt-4.1' | 'openai/gpt-4.1-mini' | 'openai/gpt-4.1-nano' | 'openai/gpt-4o' | 'openai/gpt-4o-mini' | 'openai/gpt-5' | 'openai/gpt-5-chat' | 'openai/gpt-5-codex' | 'openai/gpt-5-mini' | 'openai/gpt-5-nano' | 'openai/gpt-5-pro' | 'openai/gpt-5.1-codex' | 'openai/gpt-5.1-codex-max' | 'openai/gpt-5.1-codex-mini' | 'openai/gpt-5.1-instant' | 'openai/gpt-5.1-thinking' | 'openai/gpt-5.2' | 'openai/gpt-5.2-chat' | 'openai/gpt-5.2-pro' | 'openai/gpt-oss-120b' | 'openai/gpt-oss-20b' | 'openai/gpt-oss-safeguard-20b' | 'openai/o1' | 'openai/o3' | 'openai/o3-deep-research' | 'openai/o3-mini' | 'openai/o3-pro' | 'openai/o4-mini' | 'perplexity/sonar' | 'perplexity/sonar-pro' | 'perplexity/sonar-reasoning' | 'perplexity/sonar-reasoning-pro' | 'prime-intellect/intellect-3' | 'stealth/sonoma-dusk-alpha' | 'stealth/sonoma-sky-alpha' | 'vercel/v0-1.0-md' | 'vercel/v0-1.5-md' | 'xai/grok-2' | 'xai/grok-2-vision' | 'xai/grok-3' | 'xai/grok-3-fast' | 'xai/grok-3-mini' | 'xai/grok-3-mini-fast' | 'xai/grok-4' | 'xai/grok-4-fast-non-reasoning' | 'xai/grok-4-fast-reasoning' | 'xai/grok-4.1-fast-non-reasoning' | 'xai/grok-4.1-fast-reasoning' | 'xai/grok-code-fast-1' | 'xiaomi/mimo-v2-flash' | 'zai/glm-4.5' | 'zai/glm-4.5-air' | 'zai/glm-4.5v' | 'zai/glm-4.6' | 'zai/glm-4.6v' | 'zai/glm-4.6v-flash' | 'zai/glm-4.7' | (string & {});

interface GatewayLanguageModelEntry {
    /**
     * The model id used by the remote provider in model settings and for specifying the
     * intended model for text generation.
     */
    id: string;
    /**
     * The display name of the model for presentation in user-facing contexts.
     */
    name: string;
    /**
     * Optional description of the model.
     */
    description?: string | null;
    /**
     * Optional pricing information for the model.
     */
    pricing?: {
        /**
         * Cost per input token in USD.
         */
        input: string;
        /**
         * Cost per output token in USD.
         */
        output: string;
        /**
         * Cost per cached input token in USD.
         * Only present for providers/models that support prompt caching.
         */
        cachedInputTokens?: string;
        /**
         * Cost per input token to create/write cache entries in USD.
         * Only present for providers/models that support prompt caching.
         */
        cacheCreationInputTokens?: string;
    } | null;
    /**
     * Additional AI SDK language model specifications for the model.
     */
    specification: GatewayLanguageModelSpecification;
    /**
     * Optional field to differentiate between model types.
     */
    modelType?: 'language' | 'embedding' | 'image' | null;
}
type GatewayLanguageModelSpecification = Pick<LanguageModelV3, 'specificationVersion' | 'provider' | 'modelId'>;

interface GatewayFetchMetadataResponse {
    models: GatewayLanguageModelEntry[];
}
interface GatewayCreditsResponse {
    /** The remaining gateway credit balance available for API usage */
    balance: string;
    /** The total amount of gateway credits that have been consumed */
    totalUsed: string;
}

type GatewayEmbeddingModelId = 'alibaba/qwen3-embedding-0.6b' | 'alibaba/qwen3-embedding-4b' | 'alibaba/qwen3-embedding-8b' | 'amazon/titan-embed-text-v2' | 'cohere/embed-v4.0' | 'google/gemini-embedding-001' | 'google/text-embedding-005' | 'google/text-multilingual-embedding-002' | 'mistral/codestral-embed' | 'mistral/mistral-embed' | 'openai/text-embedding-3-large' | 'openai/text-embedding-3-small' | 'openai/text-embedding-ada-002' | 'voyage/voyage-3-large' | 'voyage/voyage-3.5' | 'voyage/voyage-3.5-lite' | 'voyage/voyage-code-2' | 'voyage/voyage-code-3' | 'voyage/voyage-finance-2' | 'voyage/voyage-law-2' | (string & {});

type GatewayImageModelId = 'bfl/flux-kontext-max' | 'bfl/flux-kontext-pro' | 'bfl/flux-pro-1.0-fill' | 'bfl/flux-pro-1.1' | 'bfl/flux-pro-1.1-ultra' | 'google/imagen-4.0-fast-generate-001' | 'google/imagen-4.0-generate-001' | 'google/imagen-4.0-ultra-generate-001' | (string & {});

interface PerplexitySearchConfig {
    /**
     * Default maximum number of search results to return (1-20, default: 10).
     */
    maxResults?: number;
    /**
     * Default maximum tokens to extract per search result page (256-2048, default: 2048).
     */
    maxTokensPerPage?: number;
    /**
     * Default maximum total tokens across all search results (default: 25000, max: 1000000).
     */
    maxTokens?: number;
    /**
     * Default two-letter ISO 3166-1 alpha-2 country code for regional search results.
     * Examples: 'US', 'GB', 'FR'
     */
    country?: string;
    /**
     * Default list of domains to include or exclude from search results (max 20).
     * To include: ['nature.com', 'science.org']
     * To exclude: ['-example.com', '-spam.net']
     */
    searchDomainFilter?: string[];
    /**
     * Default list of ISO 639-1 language codes to filter results (max 10, lowercase).
     * Examples: ['en', 'fr', 'de']
     */
    searchLanguageFilter?: string[];
    /**
     * Default recency filter for results.
     * Cannot be combined with searchAfterDate/searchBeforeDate at runtime.
     */
    searchRecencyFilter?: 'day' | 'week' | 'month' | 'year';
}
interface PerplexitySearchResult {
    /** Title of the search result */
    title: string;
    /** URL of the search result */
    url: string;
    /** Text snippet/preview of the content */
    snippet: string;
    /** Publication date of the content */
    date?: string;
    /** Last updated date of the content */
    lastUpdated?: string;
}
interface PerplexitySearchResponse {
    /** Array of search results */
    results: PerplexitySearchResult[];
    /** Unique identifier for this search request */
    id: string;
}
interface PerplexitySearchError {
    /** Error type */
    error: 'api_error' | 'rate_limit' | 'timeout' | 'invalid_input' | 'unknown';
    /** HTTP status code if applicable */
    statusCode?: number;
    /** Human-readable error message */
    message: string;
}
interface PerplexitySearchInput {
    /**
     * Search query (string) or multiple queries (array of up to 5 strings).
     * Multi-query searches return combined results from all queries.
     */
    query: string | string[];
    /**
     * Maximum number of search results to return (1-20, default: 10).
     */
    max_results?: number;
    /**
     * Maximum number of tokens to extract per search result page (256-2048, default: 2048).
     */
    max_tokens_per_page?: number;
    /**
     * Maximum total tokens across all search results (default: 25000, max: 1000000).
     */
    max_tokens?: number;
    /**
     * Two-letter ISO 3166-1 alpha-2 country code for regional search results.
     * Examples: 'US', 'GB', 'FR'
     */
    country?: string;
    /**
     * List of domains to include or exclude from search results (max 20).
     * To include: ['nature.com', 'science.org']
     * To exclude: ['-example.com', '-spam.net']
     */
    search_domain_filter?: string[];
    /**
     * List of ISO 639-1 language codes to filter results (max 10, lowercase).
     * Examples: ['en', 'fr', 'de']
     */
    search_language_filter?: string[];
    /**
     * Include only results published after this date.
     * Format: 'MM/DD/YYYY' (e.g., '3/1/2025')
     * Cannot be used with search_recency_filter.
     */
    search_after_date?: string;
    /**
     * Include only results published before this date.
     * Format: 'MM/DD/YYYY' (e.g., '3/15/2025')
     * Cannot be used with search_recency_filter.
     */
    search_before_date?: string;
    /**
     * Include only results last updated after this date.
     * Format: 'MM/DD/YYYY' (e.g., '3/1/2025')
     * Cannot be used with search_recency_filter.
     */
    last_updated_after_filter?: string;
    /**
     * Include only results last updated before this date.
     * Format: 'MM/DD/YYYY' (e.g., '3/15/2025')
     * Cannot be used with search_recency_filter.
     */
    last_updated_before_filter?: string;
    /**
     * Filter results by relative time period.
     * Cannot be used with search_after_date or search_before_date.
     */
    search_recency_filter?: 'day' | 'week' | 'month' | 'year';
}
type PerplexitySearchOutput = PerplexitySearchResponse | PerplexitySearchError;
declare const perplexitySearchToolFactory: _ai_sdk_provider_utils.ProviderToolFactoryWithOutputSchema<PerplexitySearchInput, PerplexitySearchOutput, PerplexitySearchConfig>;

/**
 * Gateway-specific provider-defined tools.
 */
declare const gatewayTools: {
    /**
     * Search the web using Perplexity's Search API for real-time information,
     * news, research papers, and articles.
     *
     * Provides ranked search results with advanced filtering options including
     * domain, language, date range, and recency filters.
     */
    perplexitySearch: (config?: PerplexitySearchConfig) => ReturnType<typeof perplexitySearchToolFactory>;
};

interface GatewayProvider extends ProviderV3 {
    (modelId: GatewayModelId): LanguageModelV3;
    /**
  Creates a model for text generation.
  */
    languageModel(modelId: GatewayModelId): LanguageModelV3;
    /**
  Returns available providers and models for use with the remote provider.
   */
    getAvailableModels(): Promise<GatewayFetchMetadataResponse>;
    /**
  Returns credit information for the authenticated user.
   */
    getCredits(): Promise<GatewayCreditsResponse>;
    /**
  Creates a model for generating text embeddings.
  */
    embeddingModel(modelId: GatewayEmbeddingModelId): EmbeddingModelV3;
    /**
     * @deprecated Use `embeddingModel` instead.
     */
    textEmbeddingModel(modelId: GatewayEmbeddingModelId): EmbeddingModelV3;
    /**
  Creates a model for generating images.
  */
    imageModel(modelId: GatewayImageModelId): ImageModelV3;
    /**
  Gateway-specific tools executed server-side.
  */
    tools: typeof gatewayTools;
}
interface GatewayProviderSettings {
    /**
  The base URL prefix for API calls. Defaults to `https://ai-gateway.vercel.sh/v1/ai`.
     */
    baseURL?: string;
    /**
  API key that is being sent using the `Authorization` header.
     */
    apiKey?: string;
    /**
  Custom headers to include in the requests.
       */
    headers?: Record<string, string>;
    /**
  Custom fetch implementation. You can use it as a middleware to intercept requests,
  or to provide a custom fetch implementation for e.g. testing.
      */
    fetch?: FetchFunction;
    /**
  How frequently to refresh the metadata cache in milliseconds.
     */
    metadataCacheRefreshMillis?: number;
}
/**
Create a remote provider instance.
 */
declare function createGatewayProvider(options?: GatewayProviderSettings): GatewayProvider;
declare const gateway: GatewayProvider;

declare const gatewayProviderOptions: _ai_sdk_provider_utils.LazySchema<{
    only?: string[] | undefined;
    order?: string[] | undefined;
    user?: string | undefined;
    tags?: string[] | undefined;
    models?: string[] | undefined;
    byok?: Record<string, Record<string, unknown>[]> | undefined;
    zeroDataRetention?: boolean | undefined;
}>;
type GatewayProviderOptions = InferSchema<typeof gatewayProviderOptions>;

declare const symbol$6: unique symbol;
declare abstract class GatewayError extends Error {
    private readonly [symbol$6];
    abstract readonly name: string;
    abstract readonly type: string;
    readonly statusCode: number;
    readonly cause?: unknown;
    constructor({ message, statusCode, cause, }: {
        message: string;
        statusCode?: number;
        cause?: unknown;
    });
    /**
     * Checks if the given error is a Gateway Error.
     * @param {unknown} error - The error to check.
     * @returns {boolean} True if the error is a Gateway Error, false otherwise.
     */
    static isInstance(error: unknown): error is GatewayError;
    static hasMarker(error: unknown): error is GatewayError;
}

declare const gatewayErrorResponseSchema: _ai_sdk_provider_utils.LazySchema<{
    error: {
        message: string;
        type?: string | null | undefined;
        param?: unknown;
        code?: string | number | null | undefined;
    };
}>;
type GatewayErrorResponse = InferSchema<typeof gatewayErrorResponseSchema>;

declare const symbol$5: unique symbol;
/**
 * Authentication failed - invalid API key or OIDC token
 */
declare class GatewayAuthenticationError extends GatewayError {
    private readonly [symbol$5];
    readonly name = "GatewayAuthenticationError";
    readonly type = "authentication_error";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayAuthenticationError;
    /**
     * Creates a contextual error message when authentication fails
     */
    static createContextualError({ apiKeyProvided, oidcTokenProvided, message, statusCode, cause, }: {
        apiKeyProvided: boolean;
        oidcTokenProvided: boolean;
        message?: string;
        statusCode?: number;
        cause?: unknown;
    }): GatewayAuthenticationError;
}

declare const symbol$4: unique symbol;
/**
 * Internal server error from the Gateway
 */
declare class GatewayInternalServerError extends GatewayError {
    private readonly [symbol$4];
    readonly name = "GatewayInternalServerError";
    readonly type = "internal_server_error";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayInternalServerError;
}

declare const symbol$3: unique symbol;
/**
 * Invalid request - missing headers, malformed data, etc.
 */
declare class GatewayInvalidRequestError extends GatewayError {
    private readonly [symbol$3];
    readonly name = "GatewayInvalidRequestError";
    readonly type = "invalid_request_error";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayInvalidRequestError;
}

declare const symbol$2: unique symbol;
/**
 * Model not found or not available
 */
declare class GatewayModelNotFoundError extends GatewayError {
    private readonly [symbol$2];
    readonly name = "GatewayModelNotFoundError";
    readonly type = "model_not_found";
    readonly modelId?: string;
    constructor({ message, statusCode, modelId, cause, }?: {
        message?: string;
        statusCode?: number;
        modelId?: string;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayModelNotFoundError;
}

declare const symbol$1: unique symbol;
/**
 * Rate limit exceeded.
 */
declare class GatewayRateLimitError extends GatewayError {
    private readonly [symbol$1];
    readonly name = "GatewayRateLimitError";
    readonly type = "rate_limit_exceeded";
    constructor({ message, statusCode, cause, }?: {
        message?: string;
        statusCode?: number;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayRateLimitError;
}

declare const symbol: unique symbol;
/**
 * Gateway response parsing error
 */
declare class GatewayResponseError extends GatewayError {
    private readonly [symbol];
    readonly name = "GatewayResponseError";
    readonly type = "response_error";
    readonly response?: unknown;
    readonly validationError?: TypeValidationError;
    constructor({ message, statusCode, response, validationError, cause, }?: {
        message?: string;
        statusCode?: number;
        response?: unknown;
        validationError?: TypeValidationError;
        cause?: unknown;
    });
    static isInstance(error: unknown): error is GatewayResponseError;
}

export { GatewayAuthenticationError, type GatewayCreditsResponse, GatewayError, type GatewayErrorResponse, GatewayInternalServerError, GatewayInvalidRequestError, type GatewayLanguageModelEntry, type GatewayLanguageModelSpecification, type GatewayLanguageModelEntry as GatewayModelEntry, type GatewayModelId, GatewayModelNotFoundError, type GatewayProvider, type GatewayProviderOptions, type GatewayProviderSettings, GatewayRateLimitError, GatewayResponseError, createGatewayProvider as createGateway, createGatewayProvider, gateway };
