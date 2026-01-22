"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// src/helpers.ts
function getTokenFromOptionsOrEnv(options) {
  if (options == null ? void 0 : options.token) {
    return options.token;
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }
  throw new BlobError(
    "No token found. Either configure the `BLOB_READ_WRITE_TOKEN` environment variable, or pass a `token` option to your calls."
  );
}
var BlobError = class extends Error {
  constructor(message) {
    super(`Vercel Blob: ${message}`);
  }
};
function getDownloadUrl(blobUrl) {
  const url = new URL(blobUrl);
  url.searchParams.set("download", "1");
  return url.toString();
}
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}

// src/api.ts
var _undici = require('undici');
var _asyncretry = require('async-retry'); var _asyncretry2 = _interopRequireDefault(_asyncretry);

// src/debug.ts
var debugIsActive = false;
var _a, _b;
try {
  if (((_a = process.env.DEBUG) == null ? void 0 : _a.includes("blob")) || ((_b = process.env.NEXT_PUBLIC_DEBUG) == null ? void 0 : _b.includes("blob"))) {
    debugIsActive = true;
  }
} catch (error) {
}
function debug(message, ...args) {
  if (debugIsActive) {
    console.debug(`vercel-blob: ${message}`, ...args);
  }
}

// src/api.ts
var MAXIMUM_PATHNAME_LENGTH = 950;
var BlobAccessError = class extends BlobError {
  constructor() {
    super("Access denied, please provide a valid token for this resource.");
  }
};
var BlobContentTypeNotAllowed = class extends BlobError {
  constructor(message) {
    super(`Content type mismatch, ${message}`);
  }
};
var BlobStoreNotFoundError = class extends BlobError {
  constructor() {
    super("This store does not exist.");
  }
};
var BlobStoreSuspendedError = class extends BlobError {
  constructor() {
    super("This store has been suspended.");
  }
};
var BlobUnknownError = class extends BlobError {
  constructor() {
    super("Unknown error, please visit https://vercel.com/help.");
  }
};
var BlobNotFoundError = class extends BlobError {
  constructor() {
    super("The requested blob does not exist");
  }
};
var BlobServiceNotAvailable = class extends BlobError {
  constructor() {
    super("The blob service is currently not available. Please try again.");
  }
};
var BlobServiceRateLimited = class extends BlobError {
  constructor(seconds) {
    super(
      `Too many requests please lower the number of concurrent requests ${seconds ? ` - try again in ${seconds} seconds` : ""}.`
    );
    this.retryAfter = seconds != null ? seconds : 0;
  }
};
var BlobRequestAbortedError = class extends BlobError {
  constructor() {
    super("The request was aborted.");
  }
};
var BLOB_API_VERSION = 7;
function getApiVersion() {
  let versionOverride = null;
  try {
    versionOverride = process.env.VERCEL_BLOB_API_VERSION_OVERRIDE || process.env.NEXT_PUBLIC_VERCEL_BLOB_API_VERSION_OVERRIDE;
  } catch (e) {
  }
  return `${versionOverride != null ? versionOverride : BLOB_API_VERSION}`;
}
function getApiUrl(pathname = "") {
  let baseUrl = null;
  try {
    baseUrl = process.env.VERCEL_BLOB_API_URL || process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL;
  } catch (e2) {
  }
  return `${baseUrl || "https://blob.vercel-storage.com"}${pathname}`;
}
function getRetries() {
  try {
    const retries = process.env.VERCEL_BLOB_RETRIES || "10";
    return parseInt(retries, 10);
  } catch (e3) {
    return 10;
  }
}
function createBlobServiceRateLimited(response) {
  const retryAfter = response.headers.get("retry-after");
  return new BlobServiceRateLimited(
    retryAfter ? parseInt(retryAfter, 10) : void 0
  );
}
async function getBlobError(response) {
  var _a2, _b2, _c;
  let code;
  let message;
  try {
    const data = await response.json();
    code = (_b2 = (_a2 = data.error) == null ? void 0 : _a2.code) != null ? _b2 : "unknown_error";
    message = (_c = data.error) == null ? void 0 : _c.message;
  } catch (e4) {
    code = "unknown_error";
  }
  if ((message == null ? void 0 : message.includes("contentType")) && message.includes("is not allowed")) {
    code = "content_type_not_allowed";
  }
  let error;
  switch (code) {
    case "store_suspended":
      error = new BlobStoreSuspendedError();
      break;
    case "forbidden":
      error = new BlobAccessError();
      break;
    case "content_type_not_allowed":
      error = new BlobContentTypeNotAllowed(message);
      break;
    case "not_found":
      error = new BlobNotFoundError();
      break;
    case "store_not_found":
      error = new BlobStoreNotFoundError();
      break;
    case "bad_request":
      error = new BlobError(message != null ? message : "Bad request");
      break;
    case "service_unavailable":
      error = new BlobServiceNotAvailable();
      break;
    case "rate_limited":
      error = createBlobServiceRateLimited(response);
      break;
    case "unknown_error":
    case "not_allowed":
    default:
      error = new BlobUnknownError();
      break;
  }
  return { code, error };
}
async function requestApi(pathname, init, commandOptions) {
  const apiVersion = getApiVersion();
  const token = getTokenFromOptionsOrEnv(commandOptions);
  const extraHeaders = getProxyThroughAlternativeApiHeaderFromEnv();
  const [, , , storeId = ""] = token.split("_");
  const requestId = `${storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  let retryCount = 0;
  const apiResponse = await _asyncretry2.default.call(void 0, 
    async (bail) => {
      let res;
      try {
        res = await _undici.fetch.call(void 0, getApiUrl(pathname), {
          ...init,
          headers: {
            "x-api-blob-request-id": requestId,
            "x-api-blob-request-attempt": String(retryCount),
            "x-api-version": apiVersion,
            authorization: `Bearer ${token}`,
            ...extraHeaders,
            ...init.headers
          }
        });
      } catch (error2) {
        if (error2 instanceof DOMException && error2.name === "AbortError") {
          bail(new BlobRequestAbortedError());
          return;
        }
        throw error2;
      }
      if (res.ok) {
        return res;
      }
      const { code, error } = await getBlobError(res);
      if (code === "unknown_error" || code === "service_unavailable" || code === "internal_server_error") {
        throw error;
      }
      bail(error);
    },
    {
      retries: getRetries(),
      onRetry: (error) => {
        debug(`retrying API request to ${pathname}`, error.message);
        retryCount = retryCount + 1;
      }
    }
  );
  if (!apiResponse) {
    throw new BlobUnknownError();
  }
  return await apiResponse.json();
}
function getProxyThroughAlternativeApiHeaderFromEnv() {
  const extraHeaders = {};
  try {
    if ("VERCEL_BLOB_PROXY_THROUGH_ALTERNATIVE_API" in process.env) {
      extraHeaders["x-proxy-through-alternative-api"] = // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we know it's here from the if
      process.env.VERCEL_BLOB_PROXY_THROUGH_ALTERNATIVE_API;
    } else if ("NEXT_PUBLIC_VERCEL_BLOB_PROXY_THROUGH_ALTERNATIVE_API" in process.env) {
      extraHeaders["x-proxy-through-alternative-api"] = // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we know it's here from the if
      process.env.NEXT_PUBLIC_VERCEL_BLOB_PROXY_THROUGH_ALTERNATIVE_API;
    }
  } catch (e5) {
  }
  return extraHeaders;
}

// src/put-helpers.ts
var putOptionHeaderMap = {
  cacheControlMaxAge: "x-cache-control-max-age",
  addRandomSuffix: "x-add-random-suffix",
  contentType: "x-content-type"
};
function createPutHeaders(allowedOptions, options) {
  const headers = {};
  if (allowedOptions.includes("contentType") && options.contentType) {
    headers[putOptionHeaderMap.contentType] = options.contentType;
  }
  if (allowedOptions.includes("addRandomSuffix") && options.addRandomSuffix !== void 0) {
    headers[putOptionHeaderMap.addRandomSuffix] = options.addRandomSuffix ? "1" : "0";
  }
  if (allowedOptions.includes("cacheControlMaxAge") && options.cacheControlMaxAge !== void 0) {
    headers[putOptionHeaderMap.cacheControlMaxAge] = options.cacheControlMaxAge.toString();
  }
  return headers;
}
async function createPutOptions({
  pathname,
  options,
  extraChecks,
  getToken
}) {
  if (!pathname) {
    throw new BlobError("pathname is required");
  }
  if (pathname.length > MAXIMUM_PATHNAME_LENGTH) {
    throw new BlobError(
      `pathname is too long, maximum length is ${MAXIMUM_PATHNAME_LENGTH}`
    );
  }
  if (!options) {
    throw new BlobError("missing options, see usage");
  }
  if (options.access !== "public") {
    throw new BlobError('access must be "public"');
  }
  if (extraChecks) {
    extraChecks(options);
  }
  if (getToken) {
    options.token = await getToken(pathname, options);
  }
  return options;
}

// src/multipart/complete.ts
function createCompleteMultipartUploadMethod({ allowedOptions, getToken, extraChecks }) {
  return async (pathname, parts, optionsInput) => {
    const options = await createPutOptions({
      pathname,
      options: optionsInput,
      extraChecks,
      getToken
    });
    const headers = createPutHeaders(allowedOptions, options);
    return completeMultipartUpload({
      uploadId: options.uploadId,
      key: options.key,
      pathname,
      headers,
      options,
      parts
    });
  };
}
async function completeMultipartUpload({
  uploadId,
  key,
  pathname,
  parts,
  headers,
  options
}) {
  try {
    const response = await requestApi(
      `/mpu/${pathname}`,
      {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-mpu-action": "complete",
          "x-mpu-upload-id": uploadId,
          // key can be any utf8 character so we need to encode it as HTTP headers can only be us-ascii
          // https://www.rfc-editor.org/rfc/rfc7230#swection-3.2.4
          "x-mpu-key": encodeURI(key)
        },
        body: JSON.stringify(parts),
        signal: options.abortSignal
      },
      options
    );
    debug("mpu: complete", response);
    return response;
  } catch (error) {
    if (error instanceof TypeError && (error.message === "Failed to fetch" || error.message === "fetch failed")) {
      throw new BlobServiceNotAvailable();
    } else {
      throw error;
    }
  }
}

// src/multipart/create.ts
function createCreateMultipartUploadMethod({ allowedOptions, getToken, extraChecks }) {
  return async (pathname, optionsInput) => {
    const options = await createPutOptions({
      pathname,
      options: optionsInput,
      extraChecks,
      getToken
    });
    const headers = createPutHeaders(allowedOptions, options);
    const createMultipartUploadResponse = await createMultipartUpload(
      pathname,
      headers,
      options
    );
    return {
      key: createMultipartUploadResponse.key,
      uploadId: createMultipartUploadResponse.uploadId
    };
  };
}
async function createMultipartUpload(pathname, headers, options) {
  debug("mpu: create", "pathname:", pathname);
  try {
    const response = await requestApi(
      `/mpu/${pathname}`,
      {
        method: "POST",
        headers: {
          ...headers,
          "x-mpu-action": "create"
        },
        signal: options.abortSignal
      },
      options
    );
    debug("mpu: create", response);
    return response;
  } catch (error) {
    if (error instanceof TypeError && (error.message === "Failed to fetch" || error.message === "fetch failed")) {
      throw new BlobServiceNotAvailable();
    } else {
      throw error;
    }
  }
}

// src/multipart/upload.ts
var _bytes = require('bytes'); var _bytes2 = _interopRequireDefault(_bytes);
function createUploadPartMethod({ allowedOptions, getToken, extraChecks }) {
  return async (pathname, body, optionsInput) => {
    const options = await createPutOptions({
      pathname,
      options: optionsInput,
      extraChecks,
      getToken
    });
    const headers = createPutHeaders(allowedOptions, options);
    if (isPlainObject(body)) {
      throw new BlobError(
        "Body must be a string, buffer or stream. You sent a plain JavaScript object, double check what you're trying to upload."
      );
    }
    const result = await uploadPart({
      uploadId: options.uploadId,
      key: options.key,
      pathname,
      part: { blob: body, partNumber: options.partNumber },
      headers,
      options
    });
    return {
      etag: result.etag,
      partNumber: options.partNumber
    };
  };
}
async function uploadPart({
  uploadId,
  key,
  pathname,
  headers,
  options,
  internalAbortController = new AbortController(),
  part
}) {
  var _a2, _b2, _c;
  const responsePromise = requestApi(
    `/mpu/${pathname}`,
    {
      signal: internalAbortController.signal,
      method: "POST",
      headers: {
        ...headers,
        "x-mpu-action": "upload",
        "x-mpu-key": encodeURI(key),
        "x-mpu-upload-id": uploadId,
        "x-mpu-part-number": part.partNumber.toString()
      },
      // weird things between undici types and native fetch types
      body: part.blob,
      // required in order to stream some body types to Cloudflare
      // currently only supported in Node.js, we may have to feature detect this
      // note: this doesn't send a content-length to the server
      duplex: "half"
    },
    options
  );
  function handleAbort() {
    internalAbortController.abort();
  }
  if ((_a2 = options.abortSignal) == null ? void 0 : _a2.aborted) {
    handleAbort();
  } else {
    (_b2 = options.abortSignal) == null ? void 0 : _b2.addEventListener("abort", handleAbort);
  }
  const response = await responsePromise;
  (_c = options.abortSignal) == null ? void 0 : _c.removeEventListener("abort", handleAbort);
  return response;
}
var maxConcurrentUploads = typeof window !== "undefined" ? 6 : 8;
var partSizeInBytes = 8 * 1024 * 1024;
var maxBytesInMemory = maxConcurrentUploads * partSizeInBytes * 2;
function uploadAllParts({
  uploadId,
  key,
  pathname,
  stream,
  headers,
  options
}) {
  debug("mpu: upload init", "key:", key);
  const internalAbortController = new AbortController();
  return new Promise((resolve, reject) => {
    const partsToUpload = [];
    const completedParts = [];
    const reader = stream.getReader();
    let activeUploads = 0;
    let reading = false;
    let currentPartNumber = 1;
    let rejected = false;
    let currentBytesInMemory = 0;
    let doneReading = false;
    let bytesSent = 0;
    let arrayBuffers = [];
    let currentPartBytesRead = 0;
    read().catch(cancel);
    async function read() {
      debug(
        "mpu: upload read start",
        "activeUploads:",
        activeUploads,
        "currentBytesInMemory:",
        `${_bytes2.default.call(void 0, currentBytesInMemory)}/${_bytes2.default.call(void 0, maxBytesInMemory)}`,
        "bytesSent:",
        _bytes2.default.call(void 0, bytesSent)
      );
      reading = true;
      while (currentBytesInMemory < maxBytesInMemory && !rejected) {
        try {
          const { value, done } = await reader.read();
          if (done) {
            doneReading = true;
            debug("mpu: upload read consumed the whole stream");
            if (arrayBuffers.length > 0) {
              partsToUpload.push({
                partNumber: currentPartNumber++,
                blob: new Blob(arrayBuffers, {
                  type: "application/octet-stream"
                })
              });
              sendParts();
            }
            reading = false;
            return;
          }
          currentBytesInMemory += value.byteLength;
          let valueOffset = 0;
          while (valueOffset < value.byteLength) {
            const remainingPartSize = partSizeInBytes - currentPartBytesRead;
            const endOffset = Math.min(
              valueOffset + remainingPartSize,
              value.byteLength
            );
            const chunk = value.slice(valueOffset, endOffset);
            arrayBuffers.push(chunk);
            currentPartBytesRead += chunk.byteLength;
            valueOffset = endOffset;
            if (currentPartBytesRead === partSizeInBytes) {
              partsToUpload.push({
                partNumber: currentPartNumber++,
                blob: new Blob(arrayBuffers, {
                  type: "application/octet-stream"
                })
              });
              arrayBuffers = [];
              currentPartBytesRead = 0;
              sendParts();
            }
          }
        } catch (error) {
          cancel(error);
        }
      }
      debug(
        "mpu: upload read end",
        "activeUploads:",
        activeUploads,
        "currentBytesInMemory:",
        `${_bytes2.default.call(void 0, currentBytesInMemory)}/${_bytes2.default.call(void 0, maxBytesInMemory)}`,
        "bytesSent:",
        _bytes2.default.call(void 0, bytesSent)
      );
      reading = false;
    }
    async function sendPart(part) {
      activeUploads++;
      debug(
        "mpu: upload send part start",
        "partNumber:",
        part.partNumber,
        "size:",
        part.blob.size,
        "activeUploads:",
        activeUploads,
        "currentBytesInMemory:",
        `${_bytes2.default.call(void 0, currentBytesInMemory)}/${_bytes2.default.call(void 0, maxBytesInMemory)}`,
        "bytesSent:",
        _bytes2.default.call(void 0, bytesSent)
      );
      try {
        const completedPart = await uploadPart({
          uploadId,
          key,
          pathname,
          headers,
          options,
          internalAbortController,
          part
        });
        debug(
          "mpu: upload send part end",
          "partNumber:",
          part.partNumber,
          "activeUploads",
          activeUploads,
          "currentBytesInMemory:",
          `${_bytes2.default.call(void 0, currentBytesInMemory)}/${_bytes2.default.call(void 0, maxBytesInMemory)}`,
          "bytesSent:",
          _bytes2.default.call(void 0, bytesSent)
        );
        if (rejected) {
          return;
        }
        completedParts.push({
          partNumber: part.partNumber,
          etag: completedPart.etag
        });
        currentBytesInMemory -= part.blob.size;
        activeUploads--;
        bytesSent += part.blob.size;
        if (partsToUpload.length > 0) {
          sendParts();
        }
        if (doneReading) {
          if (activeUploads === 0) {
            reader.releaseLock();
            resolve(completedParts);
          }
          return;
        }
        if (!reading) {
          read().catch(cancel);
        }
      } catch (error) {
        cancel(error);
      }
    }
    function sendParts() {
      if (rejected) {
        return;
      }
      debug(
        "send parts",
        "activeUploads",
        activeUploads,
        "partsToUpload",
        partsToUpload.length
      );
      while (activeUploads < maxConcurrentUploads && partsToUpload.length > 0) {
        const partToSend = partsToUpload.shift();
        if (partToSend) {
          void sendPart(partToSend);
        }
      }
    }
    function cancel(error) {
      if (rejected) {
        return;
      }
      rejected = true;
      internalAbortController.abort();
      reader.releaseLock();
      if (error instanceof TypeError && (error.message === "Failed to fetch" || error.message === "fetch failed")) {
        reject(new BlobServiceNotAvailable());
      } else {
        reject(error);
      }
    }
  });
}

// src/multipart/helpers.ts
var _stream = require('stream');
var _isbuffer = require('is-buffer'); var _isbuffer2 = _interopRequireDefault(_isbuffer);
function toReadableStream(value) {
  if (value instanceof ReadableStream) {
    return value;
  }
  if (value instanceof Blob) {
    return value.stream();
  }
  if (isNodeJsReadableStream(value)) {
    return _stream.Readable.toWeb(value);
  }
  let streamValue;
  if (value instanceof ArrayBuffer) {
    streamValue = value;
  } else if (isNodeJsBufferOrString(value)) {
    streamValue = value.buffer;
  } else {
    streamValue = stringToUint8Array(value);
  }
  return new ReadableStream({
    start(controller) {
      controller.enqueue(streamValue);
      controller.close();
    }
  });
}
function isNodeJsReadableStream(value) {
  return typeof value === "object" && typeof value.pipe === "function" && value.readable && typeof value._read === "function" && // @ts-expect-error _readableState does exists on Readable
  typeof value._readableState === "object";
}
function stringToUint8Array(s) {
  const enc = new TextEncoder();
  return enc.encode(s);
}
function isNodeJsBufferOrString(input) {
  return _isbuffer2.default.call(void 0, input);
}

// src/multipart/uncontrolled.ts
async function uncontrolledMultipartUpload(pathname, body, headers, options) {
  debug("mpu: init", "pathname:", pathname, "headers:", headers);
  const stream = toReadableStream(body);
  const createMultipartUploadResponse = await createMultipartUpload(
    pathname,
    headers,
    options
  );
  const parts = await uploadAllParts({
    uploadId: createMultipartUploadResponse.uploadId,
    key: createMultipartUploadResponse.key,
    pathname,
    stream,
    headers,
    options
  });
  const blob = await completeMultipartUpload({
    uploadId: createMultipartUploadResponse.uploadId,
    key: createMultipartUploadResponse.key,
    pathname,
    parts,
    headers,
    options
  });
  return blob;
}

// src/put.ts
function createPutMethod({
  allowedOptions,
  getToken,
  extraChecks
}) {
  return async function put(pathname, body, optionsInput) {
    if (!body) {
      throw new BlobError("body is required");
    }
    if (isPlainObject(body)) {
      throw new BlobError(
        "Body must be a string, buffer or stream. You sent a plain JavaScript object, double check what you're trying to upload."
      );
    }
    const options = await createPutOptions({
      pathname,
      options: optionsInput,
      extraChecks,
      getToken
    });
    const headers = createPutHeaders(allowedOptions, options);
    if (options.multipart === true) {
      return uncontrolledMultipartUpload(pathname, body, headers, options);
    }
    const response = await requestApi(
      `/${pathname}`,
      {
        method: "PUT",
        body,
        headers,
        // required in order to stream some body types to Cloudflare
        // currently only supported in Node.js, we may have to feature detect this
        // note: this doesn't send a content-length to the server
        duplex: "half",
        signal: options.abortSignal
      },
      options
    );
    return {
      url: response.url,
      downloadUrl: response.downloadUrl,
      pathname: response.pathname,
      contentType: response.contentType,
      contentDisposition: response.contentDisposition
    };
  };
}

// src/multipart/create-uploader.ts
function createCreateMultipartUploaderMethod({ allowedOptions, getToken, extraChecks }) {
  return async (pathname, optionsInput) => {
    const options = await createPutOptions({
      pathname,
      options: optionsInput,
      extraChecks,
      getToken
    });
    const headers = createPutHeaders(allowedOptions, options);
    const createMultipartUploadResponse = await createMultipartUpload(
      pathname,
      headers,
      options
    );
    return {
      key: createMultipartUploadResponse.key,
      uploadId: createMultipartUploadResponse.uploadId,
      async uploadPart(partNumber, body) {
        if (isPlainObject(body)) {
          throw new BlobError(
            "Body must be a string, buffer or stream. You sent a plain JavaScript object, double check what you're trying to upload."
          );
        }
        const result = await uploadPart({
          uploadId: createMultipartUploadResponse.uploadId,
          key: createMultipartUploadResponse.key,
          pathname,
          part: { partNumber, blob: body },
          headers,
          options
        });
        return {
          etag: result.etag,
          partNumber
        };
      },
      async complete(parts) {
        return completeMultipartUpload({
          uploadId: createMultipartUploadResponse.uploadId,
          key: createMultipartUploadResponse.key,
          pathname,
          parts,
          headers,
          options
        });
      }
    };
  };
}

// src/create-folder.ts
async function createFolder(pathname, options = {}) {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const headers = {};
  headers[putOptionHeaderMap.addRandomSuffix] = "0";
  const response = await requestApi(
    `/${path}`,
    {
      method: "PUT",
      headers,
      signal: options.abortSignal
    },
    options
  );
  return {
    url: response.url,
    pathname: response.pathname
  };
}






















exports.getTokenFromOptionsOrEnv = getTokenFromOptionsOrEnv; exports.BlobError = BlobError; exports.getDownloadUrl = getDownloadUrl; exports.MAXIMUM_PATHNAME_LENGTH = MAXIMUM_PATHNAME_LENGTH; exports.BlobAccessError = BlobAccessError; exports.BlobContentTypeNotAllowed = BlobContentTypeNotAllowed; exports.BlobStoreNotFoundError = BlobStoreNotFoundError; exports.BlobStoreSuspendedError = BlobStoreSuspendedError; exports.BlobUnknownError = BlobUnknownError; exports.BlobNotFoundError = BlobNotFoundError; exports.BlobServiceNotAvailable = BlobServiceNotAvailable; exports.BlobServiceRateLimited = BlobServiceRateLimited; exports.BlobRequestAbortedError = BlobRequestAbortedError; exports.requestApi = requestApi; exports.createCompleteMultipartUploadMethod = createCompleteMultipartUploadMethod; exports.createCreateMultipartUploadMethod = createCreateMultipartUploadMethod; exports.createUploadPartMethod = createUploadPartMethod; exports.createPutMethod = createPutMethod; exports.createCreateMultipartUploaderMethod = createCreateMultipartUploaderMethod; exports.createFolder = createFolder;
//# sourceMappingURL=chunk-GW6DNZ7I.cjs.map