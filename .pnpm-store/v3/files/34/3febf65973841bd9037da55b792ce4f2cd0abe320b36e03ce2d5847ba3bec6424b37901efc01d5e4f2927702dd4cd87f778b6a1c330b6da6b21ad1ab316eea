"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isOfficiallySupportedPlatform = exports.hostPlatform = void 0;
var _os = _interopRequireDefault(require("os"));
var _linuxUtils = require("./linuxUtils");
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

function calculatePlatform() {
  if (process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
    return {
      hostPlatform: process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE,
      isOfficiallySupportedPlatform: false
    };
  }
  const platform = _os.default.platform();
  if (platform === 'darwin') {
    const ver = _os.default.release().split('.').map(a => parseInt(a, 10));
    let macVersion = '';
    if (ver[0] < 18) {
      // Everything before 10.14 is considered 10.13.
      macVersion = 'mac10.13';
    } else if (ver[0] === 18) {
      macVersion = 'mac10.14';
    } else if (ver[0] === 19) {
      macVersion = 'mac10.15';
    } else {
      // ver[0] >= 20
      const LAST_STABLE_MACOS_MAJOR_VERSION = 15;
      // Best-effort support for MacOS beta versions.
      macVersion = 'mac' + Math.min(ver[0] - 9, LAST_STABLE_MACOS_MAJOR_VERSION);
      // BigSur is the first version that might run on Apple Silicon.
      if (_os.default.cpus().some(cpu => cpu.model.includes('Apple'))) macVersion += '-arm64';
    }
    return {
      hostPlatform: macVersion,
      isOfficiallySupportedPlatform: true
    };
  }
  if (platform === 'linux') {
    if (!['x64', 'arm64'].includes(_os.default.arch())) return {
      hostPlatform: '<unknown>',
      isOfficiallySupportedPlatform: false
    };
    const archSuffix = '-' + _os.default.arch();
    const distroInfo = (0, _linuxUtils.getLinuxDistributionInfoSync)();

    // Pop!_OS is ubuntu-based and has the same versions.
    // KDE Neon is ubuntu-based and has the same versions.
    // TUXEDO OS is ubuntu-based and has the same versions.
    if ((distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'ubuntu' || (distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'pop' || (distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'neon' || (distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'tuxedo') {
      const isUbuntu = (distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'ubuntu';
      const version = distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.version;
      const major = parseInt(distroInfo.version, 10);
      if (major < 20) return {
        hostPlatform: 'ubuntu18.04' + archSuffix,
        isOfficiallySupportedPlatform: false
      };
      if (major < 22) return {
        hostPlatform: 'ubuntu20.04' + archSuffix,
        isOfficiallySupportedPlatform: isUbuntu && version === '20.04'
      };
      if (major < 24) return {
        hostPlatform: 'ubuntu22.04' + archSuffix,
        isOfficiallySupportedPlatform: isUbuntu && version === '22.04'
      };
      if (major < 26) return {
        hostPlatform: 'ubuntu24.04' + archSuffix,
        isOfficiallySupportedPlatform: isUbuntu && version === '24.04'
      };
      return {
        hostPlatform: 'ubuntu' + distroInfo.version + archSuffix,
        isOfficiallySupportedPlatform: false
      };
    }
    // Linux Mint is ubuntu-based but does not have the same versions
    if ((distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'linuxmint') {
      const mintMajor = parseInt(distroInfo.version, 10);
      if (mintMajor <= 20) return {
        hostPlatform: 'ubuntu20.04' + archSuffix,
        isOfficiallySupportedPlatform: false
      };
      if (mintMajor === 21) return {
        hostPlatform: 'ubuntu22.04' + archSuffix,
        isOfficiallySupportedPlatform: false
      };
      return {
        hostPlatform: 'ubuntu24.04' + archSuffix,
        isOfficiallySupportedPlatform: false
      };
    }
    if ((distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'debian' || (distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'raspbian') {
      const isOfficiallySupportedPlatform = (distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.id) === 'debian';
      if ((distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.version) === '11') return {
        hostPlatform: 'debian11' + archSuffix,
        isOfficiallySupportedPlatform
      };
      if ((distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.version) === '12') return {
        hostPlatform: 'debian12' + archSuffix,
        isOfficiallySupportedPlatform
      };
      // use most recent supported release for 'debian testing' and 'unstable'.
      // they never include a numeric version entry in /etc/os-release.
      if ((distroInfo === null || distroInfo === void 0 ? void 0 : distroInfo.version) === '') return {
        hostPlatform: 'debian12' + archSuffix,
        isOfficiallySupportedPlatform
      };
    }
    return {
      hostPlatform: 'ubuntu20.04' + archSuffix,
      isOfficiallySupportedPlatform: false
    };
  }
  if (platform === 'win32') return {
    hostPlatform: 'win64',
    isOfficiallySupportedPlatform: true
  };
  return {
    hostPlatform: '<unknown>',
    isOfficiallySupportedPlatform: false
  };
}
const {
  hostPlatform,
  isOfficiallySupportedPlatform
} = calculatePlatform();
exports.isOfficiallySupportedPlatform = isOfficiallySupportedPlatform;
exports.hostPlatform = hostPlatform;