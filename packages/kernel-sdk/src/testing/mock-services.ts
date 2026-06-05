import type {
  SecurityService,
  FileServiceInterface,
  NotificationService,
  UsageService,
  SpeechServiceInterface,
  TunnelServiceInterface,
  ContextService,
} from '@viben/kernel'

/**
 * Factory functions that create mock implementations of Viben service interfaces.
 * Each returns an object matching the service contract with sensible defaults.
 */
export const mockServices = {
  security(overrides?: Partial<SecurityService>): SecurityService {
    return {
      async checkAccess() { return { allowed: true } },
      async checkSessionLimit() { return { allowed: true } },
      async getUserRole() { return 'user' },
      ...overrides,
    }
  },

  fileService(overrides?: Partial<FileServiceInterface>): FileServiceInterface {
    return {
      async saveFile(_sessionId, fileName, _data, mimeType) {
        return { type: 'file', filePath: `/tmp/${fileName}`, fileName, mimeType, size: 0 }
      },
      async resolveFile() { return null },
      async readTextFileWithRange() { return '' },
      extensionFromMime() { return '.bin' },
      async convertOggToWav(data) { return data },
      ...overrides,
    }
  },

  notifications(overrides?: Partial<NotificationService>): NotificationService {
    return {
      async notify() {},
      async notifyAll() {},
      ...overrides,
    }
  },

  usage(overrides?: Partial<UsageService>): UsageService {
    return {
      async trackUsage() {},
      async checkBudget() { return { ok: true, percent: 0 } },
      ...overrides,
    }
  },

  speech(overrides?: Partial<SpeechServiceInterface>): SpeechServiceInterface {
    return {
      async textToSpeech() { return Buffer.alloc(0) },
      async speechToText() { return '' },
      registerTTSProvider() {},
      registerSTTProvider() {},
      ...overrides,
    }
  },

  tunnel(overrides?: Partial<TunnelServiceInterface>): TunnelServiceInterface {
    return {
      getPublicUrl() { return 'http://localhost:0' },
      async start() { return 'http://localhost:0' },
      async stop() {},
      getStore() {
        return {
          storeFile() { return null },
          storeDiff() { return null },
          storeOutput() { return null },
        }
      },
      fileUrl(id) { return `http://localhost:0/file/${id}` },
      diffUrl(id) { return `http://localhost:0/diff/${id}` },
      outputUrl(id) { return `http://localhost:0/output/${id}` },
      ...overrides,
    }
  },

  context(overrides?: Partial<ContextService>): ContextService {
    return {
      async buildContext() { return '' },
      registerProvider() {},
      ...overrides,
    }
  },
}
