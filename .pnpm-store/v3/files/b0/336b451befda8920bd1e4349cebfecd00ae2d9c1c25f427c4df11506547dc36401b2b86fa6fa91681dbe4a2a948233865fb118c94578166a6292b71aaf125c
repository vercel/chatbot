"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BidiDeserializer = void 0;
/**
 * @license
 * Copyright 2024 Google Inc.
 * Modifications copyright (c) Microsoft Corporation.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable object-curly-spacing */

/**
 * @internal
 */
class BidiDeserializer {
  static deserialize(result) {
    var _result$value, _result$value2, _result$value3, _result$value4;
    if (!result) return undefined;
    switch (result.type) {
      case 'array':
        return (_result$value = result.value) === null || _result$value === void 0 ? void 0 : _result$value.map(value => {
          return BidiDeserializer.deserialize(value);
        });
      case 'set':
        return (_result$value2 = result.value) === null || _result$value2 === void 0 ? void 0 : _result$value2.reduce((acc, value) => {
          return acc.add(BidiDeserializer.deserialize(value));
        }, new Set());
      case 'object':
        return (_result$value3 = result.value) === null || _result$value3 === void 0 ? void 0 : _result$value3.reduce((acc, tuple) => {
          const {
            key,
            value
          } = BidiDeserializer._deserializeTuple(tuple);
          acc[key] = value;
          return acc;
        }, {});
      case 'map':
        return (_result$value4 = result.value) === null || _result$value4 === void 0 ? void 0 : _result$value4.reduce((acc, tuple) => {
          const {
            key,
            value
          } = BidiDeserializer._deserializeTuple(tuple);
          return acc.set(key, value);
        }, new Map());
      case 'promise':
        return {};
      case 'regexp':
        return new RegExp(result.value.pattern, result.value.flags);
      case 'date':
        return new Date(result.value);
      case 'undefined':
        return undefined;
      case 'null':
        return null;
      case 'number':
        return BidiDeserializer._deserializeNumber(result.value);
      case 'bigint':
        return BigInt(result.value);
      case 'boolean':
        return Boolean(result.value);
      case 'string':
        return result.value;
    }
    throw new Error(`Deserialization of type ${result.type} not supported.`);
  }
  static _deserializeNumber(value) {
    switch (value) {
      case '-0':
        return -0;
      case 'NaN':
        return NaN;
      case 'Infinity':
        return Infinity;
      case '-Infinity':
        return -Infinity;
      default:
        return value;
    }
  }
  static _deserializeTuple([serializedKey, serializedValue]) {
    const key = typeof serializedKey === 'string' ? serializedKey : BidiDeserializer.deserialize(serializedKey);
    const value = BidiDeserializer.deserialize(serializedValue);
    return {
      key,
      value
    };
  }
}
exports.BidiDeserializer = BidiDeserializer;