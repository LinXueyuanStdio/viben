import { runAdapterConformanceTests } from '../../../core/adapter-primitives/__tests__/adapter-conformance.js'
import { MessagingAdapter } from '../../../core/adapter-primitives/messaging-adapter.js'
import { BaseRenderer } from '../../../core/adapter-primitives/rendering/renderer.js'
import type { AdapterCapabilities } from '../../../core/channel.js'

class TestAdapter extends MessagingAdapter {
  readonly name = 'telegram'
  readonly renderer = new BaseRenderer()
  readonly capabilities: AdapterCapabilities = {
    streaming: true, richFormatting: true, threads: true,
    reactions: false, fileUpload: false, voice: false,
  }
  async start() {}
  async stop() {}
  async createSessionThread() { return 'thread-1' }
  async renameSessionThread() {}
  async sendPermissionRequest() {}
  async sendNotification() {}
}

runAdapterConformanceTests(
  () => new TestAdapter(
    { configManager: { get: () => ({}) } },
    { enabled: true, maxMessageLength: 4096 },
  ),
)
