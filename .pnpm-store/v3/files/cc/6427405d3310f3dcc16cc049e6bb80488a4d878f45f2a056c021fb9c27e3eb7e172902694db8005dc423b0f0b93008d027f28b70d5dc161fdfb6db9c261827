"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calculateSha1 = calculateSha1;
exports.createGuid = createGuid;
exports.generateSelfSignedCertificate = generateSelfSignedCertificate;
var _crypto = _interopRequireDefault(require("crypto"));
var _assert = require("../../utils/isomorphic/assert");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function createGuid() {
  return _crypto.default.randomBytes(16).toString('hex');
}
function calculateSha1(buffer) {
  const hash = _crypto.default.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}

// Variable-length quantity encoding aka. base-128 encoding
function encodeBase128(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (bytes.length > 0) byte |= 0x80;
    bytes.push(byte);
  } while (value > 0);
  return Buffer.from(bytes.reverse());
}

// ASN1/DER Speficiation:   https://www.itu.int/rec/T-REC-X.680-X.693-202102-I/en
class DER {
  static encodeSequence(data) {
    return this._encode(0x30, Buffer.concat(data));
  }
  static encodeInteger(data) {
    (0, _assert.assert)(data >= -128 && data <= 127);
    return this._encode(0x02, Buffer.from([data]));
  }
  static encodeObjectIdentifier(oid) {
    const parts = oid.split('.').map(v => Number(v));
    // Encode the second part, which could be large, using base-128 encoding if necessary
    const output = [encodeBase128(40 * parts[0] + parts[1])];
    for (let i = 2; i < parts.length; i++) output.push(encodeBase128(parts[i]));
    return this._encode(0x06, Buffer.concat(output));
  }
  static encodeNull() {
    return Buffer.from([0x05, 0x00]);
  }
  static encodeSet(data) {
    (0, _assert.assert)(data.length === 1, 'Only one item in the set is supported. We\'d need to sort the data to support more.');
    // We expect the data to be already sorted.
    return this._encode(0x31, Buffer.concat(data));
  }
  static encodeExplicitContextDependent(tag, data) {
    return this._encode(0xa0 + tag, data);
  }
  static encodePrintableString(data) {
    return this._encode(0x13, Buffer.from(data));
  }
  static encodeBitString(data) {
    // The first byte of the content is the number of unused bits at the end
    const unusedBits = 0; // Assuming all bits are used
    const content = Buffer.concat([Buffer.from([unusedBits]), data]);
    return this._encode(0x03, content);
  }
  static encodeDate(date) {
    const year = date.getUTCFullYear();
    const isGeneralizedTime = year >= 2050;
    const parts = [isGeneralizedTime ? year.toString() : year.toString().slice(-2), (date.getUTCMonth() + 1).toString().padStart(2, '0'), date.getUTCDate().toString().padStart(2, '0'), date.getUTCHours().toString().padStart(2, '0'), date.getUTCMinutes().toString().padStart(2, '0'), date.getUTCSeconds().toString().padStart(2, '0')];
    const encodedDate = parts.join('') + 'Z';
    const tag = isGeneralizedTime ? 0x18 : 0x17; // 0x18 for GeneralizedTime, 0x17 for UTCTime
    return this._encode(tag, Buffer.from(encodedDate));
  }
  static _encode(tag, data) {
    const lengthBytes = this._encodeLength(data.length);
    return Buffer.concat([Buffer.from([tag]), lengthBytes, data]);
  }
  static _encodeLength(length) {
    if (length < 128) {
      return Buffer.from([length]);
    } else {
      const lengthBytes = [];
      while (length > 0) {
        lengthBytes.unshift(length & 0xFF);
        length >>= 8;
      }
      return Buffer.from([0x80 | lengthBytes.length, ...lengthBytes]);
    }
  }
}

// X.509 Specification: https://datatracker.ietf.org/doc/html/rfc2459#section-4.1
function generateSelfSignedCertificate() {
  const {
    privateKey,
    publicKey
  } = _crypto.default.generateKeyPairSync('rsa', {
    modulusLength: 2048
  });
  const publicKeyDer = publicKey.export({
    type: 'pkcs1',
    format: 'der'
  });
  const oneYearInMilliseconds = 365 * 24 * 60 * 60 * 1_000;
  const notBefore = new Date(new Date().getTime() - oneYearInMilliseconds);
  const notAfter = new Date(new Date().getTime() + oneYearInMilliseconds);

  // List of fields / structure: https://datatracker.ietf.org/doc/html/rfc2459#section-4.1
  const tbsCertificate = DER.encodeSequence([DER.encodeExplicitContextDependent(0, DER.encodeInteger(1)),
  // version
  DER.encodeInteger(1),
  // serialNumber
  DER.encodeSequence([DER.encodeObjectIdentifier('1.2.840.113549.1.1.11'),
  // sha256WithRSAEncryption PKCS #1
  DER.encodeNull()]),
  // signature
  DER.encodeSequence([DER.encodeSet([DER.encodeSequence([DER.encodeObjectIdentifier('2.5.4.3'),
  // commonName X.520 DN component
  DER.encodePrintableString('localhost')])]), DER.encodeSet([DER.encodeSequence([DER.encodeObjectIdentifier('2.5.4.10'),
  // organizationName X.520 DN component
  DER.encodePrintableString('Playwright Client Certificate Support')])])]),
  // issuer
  DER.encodeSequence([DER.encodeDate(notBefore),
  // notBefore
  DER.encodeDate(notAfter) // notAfter
  ]),
  // validity
  DER.encodeSequence([DER.encodeSet([DER.encodeSequence([DER.encodeObjectIdentifier('2.5.4.3'),
  // commonName X.520 DN component
  DER.encodePrintableString('localhost')])]), DER.encodeSet([DER.encodeSequence([DER.encodeObjectIdentifier('2.5.4.10'),
  // organizationName X.520 DN component
  DER.encodePrintableString('Playwright Client Certificate Support')])])]),
  // subject
  DER.encodeSequence([DER.encodeSequence([DER.encodeObjectIdentifier('1.2.840.113549.1.1.1'),
  // rsaEncryption PKCS #1
  DER.encodeNull()]), DER.encodeBitString(publicKeyDer)]) // SubjectPublicKeyInfo
  ]);
  const signature = _crypto.default.sign('sha256', tbsCertificate, privateKey);
  const certificate = DER.encodeSequence([tbsCertificate, DER.encodeSequence([DER.encodeObjectIdentifier('1.2.840.113549.1.1.11'),
  // sha256WithRSAEncryption PKCS #1
  DER.encodeNull()]), DER.encodeBitString(signature)]);
  const certPem = ['-----BEGIN CERTIFICATE-----',
  // Split the base64 string into lines of 64 characters
  certificate.toString('base64').match(/.{1,64}/g).join('\n'), '-----END CERTIFICATE-----'].join('\n');
  return {
    cert: certPem,
    key: privateKey.export({
      type: 'pkcs1',
      format: 'pem'
    })
  };
}