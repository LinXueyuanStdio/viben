/**
 * Cron Service Tests
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { CronService } from "./cron";
import { EventService } from "./events";

describe("CronService", () => {
  let service: CronService;
  let events: EventService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-cron-test-"));
    events = new EventService();
    service = new CronService(events, join(tempDir, "cron.yaml"));
    await service.load();
  });

  afterEach(async () => {
    await service.shutdown();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("createJob", () => {
    it("should create a new cron job with cron expression", async () => {
      const job = await service.createJob({
        name: "Test Job",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo test",
      });

      expect(job.id).toBeDefined();
      expect(job.name).toBe("Test Job");
      expect(job.jobType).toBe("script");
      expect(job.cron).toBe("0 * * * *");
      expect(job.enabled).toBe(true);
      // lastStatus could be "Success", "Failure", "Running" or undefined for new jobs
      expect(job.lastStatus === undefined || ["Success", "Failure", "Running"].includes(job.lastStatus)).toBe(true);
    });

    it("should create job with every interval", async () => {
      const job = await service.createJob({
        name: "Interval Job",
        jobType: "script",
        every: 300, // 5 minutes
        script: "echo interval",
      });

      expect(job.every).toBe(300);
    });

    it("should create disabled job", async () => {
      const job = await service.createJob({
        name: "Disabled Job",
        jobType: "script",
        cron: "*/5 * * * *",
        script: "echo hello",
        enabled: false,
      });

      expect(job.enabled).toBe(false);
    });

    it("should create job with notification settings", async () => {
      const job = await service.createJob({
        name: "Notify Job",
        jobType: "script",
        cron: "0 0 * * *",
        script: "echo daily",
        notifications: {
          inApp: true,
          system: true,
          channelIds: ["telegram"],
        },
      });

      expect(job.notifications?.inApp).toBe(true);
      expect(job.notifications?.system).toBe(true);
      expect(job.notifications?.channelIds).toEqual(["telegram"]);
    });
  });

  describe("getJob", () => {
    it("should get job by id", async () => {
      const created = await service.createJob({
        name: "Get Test",
        jobType: "script",
        cron: "0 * * * *",
        script: "ls",
      });

      const found = await service.getJob(created.id);
      expect(found?.name).toBe("Get Test");
    });

    it("should return undefined for non-existent job", async () => {
      const found = await service.getJob("non-existent");
      expect(found).toBeUndefined();
    });
  });

  describe("listJobs", () => {
    it("should list all jobs", async () => {
      await service.createJob({
        name: "Job 1",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo 1",
      });
      await service.createJob({
        name: "Job 2",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo 2",
      });

      const jobs = await service.listJobs();
      expect(jobs).toHaveLength(2);
    });

    it("should return empty array when no jobs", async () => {
      const jobs = await service.listJobs();
      expect(jobs).toEqual([]);
    });
  });

  describe("updateJob", () => {
    it("should update job name", async () => {
      const job = await service.createJob({
        name: "Original",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo",
      });

      const updated = await service.updateJob(job.id, { name: "Updated" });
      expect(updated.name).toBe("Updated");
    });

    it("should update job cron expression", async () => {
      const job = await service.createJob({
        name: "Cron Test",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo",
      });

      const updated = await service.updateJob(job.id, {
        cron: "*/30 * * * *",
      });
      expect(updated.cron).toBe("*/30 * * * *");
    });

    it("should throw when updating non-existent job", async () => {
      await expect(
        service.updateJob("non-existent", { name: "New" })
      ).rejects.toThrow();
    });
  });

  describe("deleteJob", () => {
    it("should delete job", async () => {
      const job = await service.createJob({
        name: "To Delete",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo",
      });

      await service.deleteJob(job.id);

      const found = await service.getJob(job.id);
      expect(found).toBeUndefined();
    });

    it("should throw when deleting non-existent job", async () => {
      await expect(service.deleteJob("non-existent")).rejects.toThrow();
    });
  });

  describe("enableJob / disableJob", () => {
    it("should enable a disabled job", async () => {
      const job = await service.createJob({
        name: "Enable Test",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo",
        enabled: false,
      });

      const enabled = await service.enableJob(job.id);
      expect(enabled.enabled).toBe(true);
    });

    it("should disable an enabled job", async () => {
      const job = await service.createJob({
        name: "Disable Test",
        jobType: "script",
        cron: "0 * * * *",
        script: "echo",
        enabled: true,
      });

      const disabled = await service.disableJob(job.id);
      expect(disabled.enabled).toBe(false);
    });
  });

  describe("runJob", () => {
    it("should run script job immediately", async () => {
      const job = await service.createJob({
        name: "Run Test",
        jobType: "script",
        cron: "0 0 1 1 *", // Never runs automatically
        script: "echo hello",
      });

      // This should not throw
      await expect(service.runJob(job.id)).resolves.not.toThrow();
    });

    it("should throw when running non-existent job", async () => {
      await expect(service.runJob("non-existent")).rejects.toThrow();
    });
  });

  describe("job types", () => {
    it("should create script type job", async () => {
      const job = await service.createJob({
        name: "Script Job",
        jobType: "script",
        cron: "0 * * * *",
        script: "npm run build",
      });

      expect(job.jobType).toBe("script");
      expect(job.script).toBe("npm run build");
    });

    it("should create agent type job", async () => {
      const job = await service.createJob({
        name: "Agent Job",
        jobType: "agent",
        cron: "0 * * * *",
        agent: "claude-1",
        message: "Do something",
      });

      expect(job.jobType).toBe("agent");
      expect(job.agent).toBe("claude-1");
      expect(job.message).toBe("Do something");
    });
  });
});
