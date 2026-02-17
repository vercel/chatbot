"use strict";Object.defineProperty(exports, "__esModule", {value: true});



















var _chunkGW6DNZ7Icjs = require('./chunk-GW6DNZ7I.cjs');

// src/del.ts
async function del(url, options) {
  await _chunkGW6DNZ7Icjs.requestApi.call(void 0, 
    "/delete",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls: Array.isArray(url) ? url : [url] }),
      signal: options == null ? void 0 : options.abortSignal
    },
    options
  );
}

// src/head.ts
async function head(url, options) {
  const searchParams = new URLSearchParams({ url });
  const response = await _chunkGW6DNZ7Icjs.requestApi.call(void 0, 
    `?${searchParams.toString()}`,
    // HEAD can't have body as a response, so we use GET
    {
      method: "GET",
      signal: options == null ? void 0 : options.abortSignal
    },
    options
  );
  return {
    url: response.url,
    downloadUrl: response.downloadUrl,
    pathname: response.pathname,
    size: response.size,
    contentType: response.contentType,
    contentDisposition: response.contentDisposition,
    cacheControl: response.cacheControl,
    uploadedAt: new Date(response.uploadedAt)
  };
}

// src/list.ts
async function list(options) {
  var _a;
  const searchParams = new URLSearchParams();
  if (options == null ? void 0 : options.limit) {
    searchParams.set("limit", options.limit.toString());
  }
  if (options == null ? void 0 : options.prefix) {
    searchParams.set("prefix", options.prefix);
  }
  if (options == null ? void 0 : options.cursor) {
    searchParams.set("cursor", options.cursor);
  }
  if (options == null ? void 0 : options.mode) {
    searchParams.set("mode", options.mode);
  }
  const response = await _chunkGW6DNZ7Icjs.requestApi.call(void 0, 
    `?${searchParams.toString()}`,
    {
      method: "GET",
      signal: options == null ? void 0 : options.abortSignal
    },
    options
  );
  if ((options == null ? void 0 : options.mode) === "folded") {
    return {
      folders: (_a = response.folders) != null ? _a : [],
      cursor: response.cursor,
      hasMore: response.hasMore,
      blobs: response.blobs.map(mapBlobResult)
    };
  }
  return {
    cursor: response.cursor,
    hasMore: response.hasMore,
    blobs: response.blobs.map(mapBlobResult)
  };
}
function mapBlobResult(blobResult) {
  return {
    url: blobResult.url,
    downloadUrl: blobResult.downloadUrl,
    pathname: blobResult.pathname,
    size: blobResult.size,
    uploadedAt: new Date(blobResult.uploadedAt)
  };
}

// src/copy.ts
async function copy(fromUrl, toPathname, options) {
  if (!options) {
    throw new (0, _chunkGW6DNZ7Icjs.BlobError)("missing options, see usage");
  }
  if (options.access !== "public") {
    throw new (0, _chunkGW6DNZ7Icjs.BlobError)('access must be "public"');
  }
  if (toPathname.length > _chunkGW6DNZ7Icjs.MAXIMUM_PATHNAME_LENGTH) {
    throw new (0, _chunkGW6DNZ7Icjs.BlobError)(
      `pathname is too long, maximum length is ${_chunkGW6DNZ7Icjs.MAXIMUM_PATHNAME_LENGTH}`
    );
  }
  const headers = {};
  if (options.addRandomSuffix !== void 0) {
    headers["x-add-random-suffix"] = options.addRandomSuffix ? "1" : "0";
  }
  if (options.contentType) {
    headers["x-content-type"] = options.contentType;
  }
  if (options.cacheControlMaxAge !== void 0) {
    headers["x-cache-control-max-age"] = options.cacheControlMaxAge.toString();
  }
  const response = await _chunkGW6DNZ7Icjs.requestApi.call(void 0, 
    `/${toPathname}?fromUrl=${fromUrl}`,
    {
      method: "PUT",
      headers,
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
}

// src/index.ts
var put = _chunkGW6DNZ7Icjs.createPutMethod.call(void 0, {
  allowedOptions: ["cacheControlMaxAge", "addRandomSuffix", "contentType"]
});
var createMultipartUpload = _chunkGW6DNZ7Icjs.createCreateMultipartUploadMethod.call(void 0, {
  allowedOptions: ["cacheControlMaxAge", "addRandomSuffix", "contentType"]
});
var createMultipartUploader = _chunkGW6DNZ7Icjs.createCreateMultipartUploaderMethod.call(void 0, {
  allowedOptions: ["cacheControlMaxAge", "addRandomSuffix", "contentType"]
});
var uploadPart = _chunkGW6DNZ7Icjs.createUploadPartMethod.call(void 0, {
  allowedOptions: ["cacheControlMaxAge", "addRandomSuffix", "contentType"]
});
var completeMultipartUpload = _chunkGW6DNZ7Icjs.createCompleteMultipartUploadMethod.call(void 0, {
  allowedOptions: ["cacheControlMaxAge", "addRandomSuffix", "contentType"]
});






















exports.BlobAccessError = _chunkGW6DNZ7Icjs.BlobAccessError; exports.BlobContentTypeNotAllowedError = _chunkGW6DNZ7Icjs.BlobContentTypeNotAllowed; exports.BlobError = _chunkGW6DNZ7Icjs.BlobError; exports.BlobNotFoundError = _chunkGW6DNZ7Icjs.BlobNotFoundError; exports.BlobRequestAbortedError = _chunkGW6DNZ7Icjs.BlobRequestAbortedError; exports.BlobServiceNotAvailable = _chunkGW6DNZ7Icjs.BlobServiceNotAvailable; exports.BlobServiceRateLimited = _chunkGW6DNZ7Icjs.BlobServiceRateLimited; exports.BlobStoreNotFoundError = _chunkGW6DNZ7Icjs.BlobStoreNotFoundError; exports.BlobStoreSuspendedError = _chunkGW6DNZ7Icjs.BlobStoreSuspendedError; exports.BlobUnknownError = _chunkGW6DNZ7Icjs.BlobUnknownError; exports.completeMultipartUpload = completeMultipartUpload; exports.copy = copy; exports.createFolder = _chunkGW6DNZ7Icjs.createFolder; exports.createMultipartUpload = createMultipartUpload; exports.createMultipartUploader = createMultipartUploader; exports.del = del; exports.getDownloadUrl = _chunkGW6DNZ7Icjs.getDownloadUrl; exports.head = head; exports.list = list; exports.put = put; exports.uploadPart = uploadPart;
//# sourceMappingURL=index.cjs.map