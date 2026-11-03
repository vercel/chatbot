import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { generateUUID } from "@/lib/utils";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUUID", () => {
  const originalCrypto = globalThis.crypto;
  const originalMathRandom = Math.random;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    Math.random = originalMathRandom;
  });

  it("generates a string matching the canonical UUID v4 format", () => {
    const uuid = generateUUID();
    assert.equal(typeof uuid, "string");
    assert.equal(uuid.length, 36);
    assert.match(uuid, UUID_V4_REGEX);
  });

  it("sets the version digit to 4", () => {
    for (let i = 0; i < 50; i += 1) {
      const uuid = generateUUID();
      assert.equal(uuid.charAt(14), "4");
    }
  });

  it("sets the variant digit to 8, 9, a, or b", () => {
    for (let i = 0; i < 50; i += 1) {
      const uuid = generateUUID();
      assert.match(uuid.charAt(19), /^[89ab]$/i);
    }
  });

  it("prefers native crypto.randomUUID when available", () => {
    let nativeCalled = false;
    const mockUUID = "12345678-1234-4234-8234-123456789abc";

    try {
      const mockCrypto = {
        getRandomValues: <T extends ArrayBufferView | null>(array: T): T =>
          originalCrypto.getRandomValues(array),
        randomUUID: () => {
          nativeCalled = true;
          return mockUUID;
        },
      };

      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: mockCrypto,
      });

      const result = generateUUID();
      assert.equal(nativeCalled, true);
      assert.equal(result, mockUUID);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("falls back to crypto.getRandomValues when randomUUID is unavailable", () => {
    let fallbackCalled = false;

    try {
      const mockCrypto = {
        getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
          fallbackCalled = true;
          return originalCrypto.getRandomValues(array);
        },
      };

      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: mockCrypto,
      });

      const result = generateUUID();
      assert.equal(fallbackCalled, true);
      assert.match(result, UUID_V4_REGEX);
      assert.equal(result.charAt(14), "4");
      assert.match(result.charAt(19), /^[89ab]$/i);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("does not call Math.random in fallback mode", () => {
    let mathRandomCalled = false;
    let byteLength = 0;

    try {
      Math.random = () => {
        mathRandomCalled = true;
        return 0.5;
      };

      const mockCrypto = {
        getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
          if (array instanceof Uint8Array) {
            byteLength = array.length;
          }
          return originalCrypto.getRandomValues(array);
        },
      };

      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: mockCrypto,
      });

      const result = generateUUID();
      assert.equal(mathRandomCalled, false, "Math.random must not be called");
      assert.equal(
        byteLength,
        16,
        "Must request 16 cryptographically secure bytes"
      );
      assert.match(result, UUID_V4_REGEX);
    } finally {
      Math.random = originalMathRandom;
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  describe("deterministic bit manipulation in fallback mode", () => {
    it("correctly sets version (4) and variant (8) with all-zero input bytes", () => {
      try {
        const mockCrypto = {
          getRandomValues: (array: Uint8Array) => {
            array.fill(0x00);
            return array;
          },
        };

        Object.defineProperty(globalThis, "crypto", {
          configurable: true,
          value: mockCrypto,
        });

        const result = generateUUID();
        assert.equal(result, "00000000-0000-4000-8000-000000000000");
      } finally {
        Object.defineProperty(globalThis, "crypto", {
          configurable: true,
          value: originalCrypto,
        });
      }
    });

    it("correctly sets version (4) and variant (b) with all-0xff input bytes", () => {
      try {
        const mockCrypto = {
          getRandomValues: (array: Uint8Array) => {
            array.fill(0xff);
            return array;
          },
        };

        Object.defineProperty(globalThis, "crypto", {
          configurable: true,
          value: mockCrypto,
        });

        const result = generateUUID();
        assert.equal(result, "ffffffff-ffff-4fff-bfff-ffffffffffff");
      } finally {
        Object.defineProperty(globalThis, "crypto", {
          configurable: true,
          value: originalCrypto,
        });
      }
    });

    it("correctly sets version and variant with sequential bytes", () => {
      try {
        const mockCrypto = {
          getRandomValues: (array: Uint8Array) => {
            for (let i = 0; i < 16; i += 1) {
              array[i] = i;
            }
            return array;
          },
        };

        Object.defineProperty(globalThis, "crypto", {
          configurable: true,
          value: mockCrypto,
        });

        // Byte 6 (0x06): (0x06 & 0x0f) | 0x40 = 0x46
        // Byte 8 (0x08): (0x08 & 0x3f) | 0x80 = 0x88
        const result = generateUUID();
        assert.equal(result, "00010203-0405-4607-8809-0a0b0c0d0e0f");
      } finally {
        Object.defineProperty(globalThis, "crypto", {
          configurable: true,
          value: originalCrypto,
        });
      }
    });
  });

  it("fails explicitly when no cryptographically secure source is available", () => {
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: undefined,
      });

      assert.throws(
        () => {
          generateUUID();
        },
        {
          message:
            "No cryptographically secure random number generator available.",
          name: "Error",
        }
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("fails explicitly when crypto object has neither randomUUID nor getRandomValues", () => {
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {},
      });

      assert.throws(
        () => {
          generateUUID();
        },
        {
          message:
            "No cryptographically secure random number generator available.",
          name: "Error",
        }
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });
});
