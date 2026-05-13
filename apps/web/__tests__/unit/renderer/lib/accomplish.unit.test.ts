/**
 * Unit tests for Accomplish API library
 *
 * Tests the Electron detection and shell utilities:
 * - isRunningInElectron() detection
 * - getShellVersion() retrieval
 * - getShellPlatform() retrieval
 * - getNestCafe() and useNestCafe() API access
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original window
const originalWindow = globalThis.window;

describe('Accomplish API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    (globalThis as unknown as { window: Record<string, unknown> }).window = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { window: typeof window }).window = originalWindow;
  });

  describe('isRunningInElectron', () => {
    it('should return true when nestcafeShell.isElectron is true', async () => {
      (globalThis as unknown as { window: { nestcafeShell: { isElectron: boolean } } }).window = {
        nestcafeShell: { isElectron: true },
      };

      const { isRunningInElectron } = await import('@/lib/nestcafe');
      expect(isRunningInElectron()).toBe(true);
    });

    it('should return false when nestcafeShell.isElectron is false', async () => {
      (globalThis as unknown as { window: { nestcafeShell: { isElectron: boolean } } }).window = {
        nestcafeShell: { isElectron: false },
      };

      const { isRunningInElectron } = await import('@/lib/nestcafe');
      expect(isRunningInElectron()).toBe(false);
    });

    it('should return false when nestcafeShell is unavailable', async () => {
      // Test undefined, null, missing property, and empty object
      const unavailableScenarios = [
        { nestcafeShell: undefined },
        { nestcafeShell: null },
        { nestcafeShell: { version: '1.0.0' } }, // missing isElectron
        {}, // no nestcafeShell at all
      ];

      for (const scenario of unavailableScenarios) {
        vi.resetModules();
        (globalThis as unknown as { window: Record<string, unknown> }).window = scenario;
        const { isRunningInElectron } = await import('@/lib/nestcafe');
        expect(isRunningInElectron()).toBe(false);
      }
    });

    it('should use strict equality for isElectron check', async () => {
      // Truthy but not true should return false
      (globalThis as unknown as { window: { nestcafeShell: { isElectron: number } } }).window = {
        nestcafeShell: { isElectron: 1 },
      };

      const { isRunningInElectron } = await import('@/lib/nestcafe');
      expect(isRunningInElectron()).toBe(false);
    });
  });

  describe('getShellVersion', () => {
    it('should return version when available', async () => {
      (globalThis as unknown as { window: { nestcafeShell: { version: string } } }).window = {
        nestcafeShell: { version: '1.2.3' },
      };

      const { getShellVersion } = await import('@/lib/nestcafe');
      expect(getShellVersion()).toBe('1.2.3');
    });

    it('should return null when version is unavailable', async () => {
      const unavailableScenarios = [
        { nestcafeShell: undefined },
        { nestcafeShell: { isElectron: true } }, // no version property
        {},
      ];

      for (const scenario of unavailableScenarios) {
        vi.resetModules();
        (globalThis as unknown as { window: Record<string, unknown> }).window = scenario;
        const { getShellVersion } = await import('@/lib/nestcafe');
        expect(getShellVersion()).toBeNull();
      }
    });

    it('should handle various version formats', async () => {
      const versions = ['0.0.1', '1.0.0', '2.5.10', '1.0.0-beta.1', '1.0.0-rc.2'];

      for (const version of versions) {
        vi.resetModules();
        (globalThis as unknown as { window: { nestcafeShell: { version: string } } }).window = {
          nestcafeShell: { version },
        };
        const { getShellVersion } = await import('@/lib/nestcafe');
        expect(getShellVersion()).toBe(version);
      }
    });
  });

  describe('getShellPlatform', () => {
    it('should return platform when available', async () => {
      const platforms = ['darwin', 'linux', 'win32'];

      for (const platform of platforms) {
        vi.resetModules();
        (globalThis as unknown as { window: { nestcafeShell: { platform: string } } }).window = {
          nestcafeShell: { platform },
        };
        const { getShellPlatform } = await import('@/lib/nestcafe');
        expect(getShellPlatform()).toBe(platform);
      }
    });

    it('should return null when platform is unavailable', async () => {
      const unavailableScenarios = [
        { nestcafeShell: undefined },
        { nestcafeShell: { isElectron: true } }, // no platform property
        {},
      ];

      for (const scenario of unavailableScenarios) {
        vi.resetModules();
        (globalThis as unknown as { window: Record<string, unknown> }).window = scenario;
        const { getShellPlatform } = await import('@/lib/nestcafe');
        expect(getShellPlatform()).toBeNull();
      }
    });
  });

  describe('getNestCafe', () => {
    it('should return accomplish API when available', async () => {
      const mockApi = {
        getVersion: vi.fn(),
        startTask: vi.fn(),
        validateBedrockCredentials: vi.fn(),
        saveBedrockCredentials: vi.fn(),
        getBedrockCredentials: vi.fn(),
      };
      (globalThis as unknown as { window: { nestcafe: typeof mockApi } }).window = {
        nestcafe: mockApi,
      };

      const { getNestCafe } = await import('@/lib/nestcafe');
      const result = getNestCafe();
      // getNestCafe returns a wrapper object with spread methods + Bedrock wrappers
      expect(result.getVersion).toBeDefined();
      expect(result.startTask).toBeDefined();
      expect(result.validateBedrockCredentials).toBeDefined();
      expect(result.saveBedrockCredentials).toBeDefined();
      expect(result.getBedrockCredentials).toBeDefined();
    });

    it('should throw when accomplish API is not available', async () => {
      const unavailableScenarios = [{ nestcafe: undefined }, {}];

      for (const scenario of unavailableScenarios) {
        vi.resetModules();
        (globalThis as unknown as { window: Record<string, unknown> }).window = scenario;
        const { getNestCafe } = await import('@/lib/nestcafe');
        expect(() => getNestCafe()).toThrow(
          'Accomplish API not available - not running in Electron',
        );
      }
    });
  });

  describe('useNestCafe', () => {
    it('should return accomplish API when available', async () => {
      const mockApi = { getVersion: vi.fn(), startTask: vi.fn() };
      (globalThis as unknown as { window: { nestcafe: typeof mockApi } }).window = {
        nestcafe: mockApi,
      };

      const { useNestCafe } = await import('@/lib/nestcafe');
      expect(useNestCafe()).toBe(mockApi);
    });

    it('should throw when accomplish API is not available', async () => {
      (globalThis as unknown as { window: { accomplish?: unknown } }).window = {
        nestcafe: undefined,
      };

      const { useNestCafe } = await import('@/lib/nestcafe');
      expect(() => useNestCafe()).toThrow(
        'Accomplish API not available - not running in Electron',
      );
    });
  });

  describe('Complete Shell Object', () => {
    it('should recognize complete shell object with all properties', async () => {
      const completeShell = {
        version: '1.0.0',
        platform: 'darwin',
        isElectron: true as const,
      };
      (globalThis as unknown as { window: { nestcafeShell: typeof completeShell } }).window = {
        nestcafeShell: completeShell,
      };

      const { isRunningInElectron, getShellVersion, getShellPlatform } =
        await import('@/lib/nestcafe');

      expect(isRunningInElectron()).toBe(true);
      expect(getShellVersion()).toBe('1.0.0');
      expect(getShellPlatform()).toBe('darwin');
    });

    it('should handle partial shell object gracefully', async () => {
      const partialShell = { version: '1.0.0', isElectron: true as const };
      (globalThis as unknown as { window: { nestcafeShell: typeof partialShell } }).window = {
        nestcafeShell: partialShell,
      };

      const { isRunningInElectron, getShellVersion, getShellPlatform } =
        await import('@/lib/nestcafe');

      expect(isRunningInElectron()).toBe(true);
      expect(getShellVersion()).toBe('1.0.0');
      expect(getShellPlatform()).toBeNull();
    });
  });
});
