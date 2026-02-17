"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isRegExp = exports.isPlainObject = exports.isDate = exports.BidiSerializer = void 0;
/**
 * @license
 * Copyright 2024 Google Inc.
 * Modifications copyright (c) Microsoft Corporation.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable curly, indent */

/**
 * @internal
 */
class UnserializableError extends Error {}

/**
 * @internal
 */
class BidiSerializer {
  static serialize(arg) {
    switch (typeof arg) {
      case 'symbol':
      case 'function':
        throw new UnserializableError(`Unable to serializable ${typeof arg}`);
      case 'object':
        return BidiSerializer._serializeObject(arg);
      case 'undefined':
        return {
          type: 'undefined'
        };
      case 'number':
        return BidiSerializer._serializeNumber(arg);
      case 'bigint':
        return {
          type: 'bigint',
          value: arg.toString()
        };
      case 'string':
        return {
          type: 'string',
          value: arg
        };
      case 'boolean':
        return {
          type: 'boolean',
          value: arg
        };
    }
  }
  static _serializeNumber(arg) {
    let value;
    if (Object.is(arg, -0)) {
      value = '-0';
    } else if (Object.is(arg, Infinity)) {
      value = 'Infinity';
    } else if (Object.is(arg, -Infinity)) {
      value = '-Infinity';
    } else if (Object.is(arg, NaN)) {
      value = 'NaN';
    } else {
      value = arg;
    }
    return {
      type: 'number',
      value
    };
  }
  static _serializeObject(arg) {
    if (arg === null) {
      return {
        type: 'null'
      };
    } else if (Array.isArray(arg)) {
      const parsedArray = arg.map(subArg => {
        return BidiSerializer.serialize(subArg);
      });
      return {
        type: 'array',
        value: parsedArray
      };
    } else if (isPlainObject(arg)) {
      try {
        JSON.stringify(arg);
      } catch (error) {
        if (error instanceof TypeError && error.message.startsWith('Converting circular structure to JSON')) {
          error.message += ' Recursive objects are not allowed.';
        }
        throw error;
      }
      const parsedObject = [];
      for (const key in arg) {
        parsedObject.push([BidiSerializer.serialize(key), BidiSerializer.serialize(arg[key])]);
      }
      return {
        type: 'object',
        value: parsedObject
      };
    } else if (isRegExp(arg)) {
      return {
        type: 'regexp',
        value: {
          pattern: arg.source,
          flags: arg.flags
        }
      };
    } else if (isDate(arg)) {
      return {
        type: 'date',
        value: arg.toISOString()
      };
    }
    throw new UnserializableError('Custom object serialization not possible. Use plain objects instead.');
  }
}

/**
 * @internal
 */
exports.BidiSerializer = BidiSerializer;
const isPlainObject = obj => {
  return typeof obj === 'object' && (obj === null || obj === void 0 ? void 0 : obj.constructor) === Object;
};

/**
 * @internal
 */
exports.isPlainObject = isPlainObject;
const isRegExp = obj => {
  return typeof obj === 'object' && (obj === null || obj === void 0 ? void 0 : obj.constructor) === RegExp;
};

/**
 * @internal
 */
exports.isRegExp = isRegExp;
const isDate = obj => {
  return typeof obj === 'object' && (obj === null || obj === void 0 ? void 0 : obj.constructor) === Date;
};
exports.isDate = isDate;