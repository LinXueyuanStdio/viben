/**
 * Cron Executor
 *
 * Executor implementations for running cron jobs.
 * The GatewayCronExecutor integrates with the Gateway's Channel and Agent systems.
 */

import type { CronJob, CronExecutor } from './types';

/**
 * Console executor - simply logs the job execution
 * Useful for testing and debugging
 */
export class ConsoleCronExecutor implements CronExecutor {
  async execute(job: CronJob): Promise<void> {
    console.log(`[CronExecutor] Executing job: ${job.name} (${job.id})`);
    console.log(`[CronExecutor] Message: ${job.message}`);
    if (job.channel) {
      console.log(`[CronExecutor] Target channel: ${job.channel}`);
    }
    if (job.agent) {
      console.log(`[CronExecutor] Using agent: ${job.agent}`);
    }
    console.log(`[CronExecutor] Job ${job.id} executed successfully`);
  }
}

/**
 * Gateway Cron Executor
 *
 * Integrates with the Gateway's ChannelManager and AgentLoop.
 * When a job runs, it:
 * 1. If channel is specified: sends the message to the channel via the agent
 * 2. If no channel: executes the agent with the message (CLI mode)
 *
 * This is a placeholder implementation. The actual implementation
 * will be added when the Gateway module is available.
 */
export class GatewayCronExecutor implements CronExecutor {
  // These will be injected when the Gateway module is ready
  // private channelManager: ChannelManager;
  // private agentLoop: AgentLoop;

  constructor() {
    // Placeholder - will accept channelManager and agentLoop
  }

  async execute(job: CronJob): Promise<void> {
    console.log(`[GatewayCronExecutor] Executing job: ${job.name} (${job.id})`);

    if (job.channel) {
      // With channel: send to channel
      console.log(`[GatewayCronExecutor] Would send to channel: ${job.channel}`);
      console.log(`[GatewayCronExecutor] Message: ${job.message}`);
      console.log(`[GatewayCronExecutor] Agent: ${job.agent ?? 'main'}`);

      // TODO: Implement when Gateway is ready
      // const channel = this.channelManager.getChannel(job.channel);
      // if (!channel) {
      //   throw new Error(`Channel ${job.channel} not found`);
      // }
      //
      // const response = await this.agentLoop.processMessage({
      //   content: job.message,
      //   agentId: job.agent || 'main',
      // });
      //
      // await channel.sendMessage({
      //   chatId: job.channel,
      //   content: response,
      // });
    } else {
      // Without channel: CLI mode (just execute agent)
      console.log(`[GatewayCronExecutor] Would execute agent in CLI mode`);
      console.log(`[GatewayCronExecutor] Message: ${job.message}`);
      console.log(`[GatewayCronExecutor] Agent: ${job.agent ?? 'main'}`);

      // TODO: Implement when Gateway is ready
      // await this.agentLoop.processMessage({
      //   content: job.message,
      //   agentId: job.agent || 'main',
      // });
    }

    console.log(`[GatewayCronExecutor] Job ${job.id} completed`);
  }
}
