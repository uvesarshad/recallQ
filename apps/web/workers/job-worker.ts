import dotenv from "dotenv";
dotenv.config();

import {
  markArchiveJobFailed,
  processArchiveJob,
  sweepArchiveRetention,
  type ArchiveJob,
} from "../lib/archive-assets";
import {
  importCsvExport,
  importLinkwardenExport,
  importOmnivoreExport,
  importPocketExport,
} from "../lib/import-export-db";
import { claimJobs, markJobFailed, markJobSucceeded, type ClaimedJob } from "../lib/jobs";
import { logger } from "../lib/logger";
import { recordOperationLog } from "../lib/operation-logs";
import { enqueueDueRssFeeds, syncRssFeed } from "../lib/rss";
import { deliverWebhookJob } from "../lib/webhooks";
import { installCrashHandlers, startHeartbeat } from "../lib/worker-heartbeat";

const WORKER_ID = `job-${process.pid}`;
const ARCHIVE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let nextArchiveSweepAt = 0;

async function handleJob(job: ClaimedJob) {
  if (job.type === "import" && job.payload?.kind === "rss_feed") {
    const feedId = String(job.payload.feedId ?? "");
    if (!feedId) throw new Error("RSS job missing feedId");
    return syncRssFeed(feedId);
  }

  if (job.type === "import" && job.payload?.kind === "external_import") {
    return handleExternalImportJob(job);
  }

  if (job.type === "archive") {
    return processArchiveJob(job as ArchiveJob);
  }

  if (job.type === "webhook") {
    return deliverWebhookJob(job);
  }

  throw new Error(`Unsupported job type: ${job.type}`);
}

async function handleExternalImportJob(job: ClaimedJob) {
  const source = String(job.payload?.source ?? "");
  const userId = job.user_id;
  const content = typeof job.payload?.content === "string" ? job.payload.content : "";
  const fileName = typeof job.payload?.fileName === "string" ? job.payload.fileName : null;
  const dryRun = job.payload?.dryRun === true;
  if (!userId || !content) throw new Error("External import job missing user/content payload");

  if (source === "pocket") return importPocketExport({ userId, content, fileName, dryRun });
  if (source === "omnivore") return importOmnivoreExport({ userId, content, fileName, dryRun });
  if (source === "linkwarden") return importLinkwardenExport({ userId, content, fileName, dryRun });
  if (source === "csv") return importCsvExport({ userId, content, fileName, dryRun });
  throw new Error(`Unsupported external import source: ${source}`);
}

async function startWorker() {
  installCrashHandlers("jobs");
  startHeartbeat("jobs");
  logger.info("jobs", "Job worker started", { pid: process.pid });

  while (true) {
    try {
      await enqueueDueRssFeeds();
      if (Date.now() >= nextArchiveSweepAt) {
        nextArchiveSweepAt = Date.now() + ARCHIVE_SWEEP_INTERVAL_MS;
        const result = await sweepArchiveRetention({ limit: 100 });
        if (result.deletedRows > 0) {
          logger.info("jobs", "Archive retention sweep cleaned assets", result);
        }
      }
      const jobs = await claimJobs({ workerId: WORKER_ID, types: ["import", "archive", "webhook"], limit: 10 });

      for (const job of jobs) {
        const startedAt = Date.now();
        try {
          const result = await handleJob(job);
          await markJobSucceeded(job.id, result);
          await recordOperationLog({
            userId: job.user_id,
            itemId: job.item_id,
            jobId: job.id,
            operation: `job:${job.type}`,
            status: "succeeded",
            attemptCount: job.attempt_count,
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          if (job.type === "archive") {
            await markArchiveJobFailed(job as ArchiveJob, error);
          } else {
            await markJobFailed(job, error);
          }
          await recordOperationLog({
            userId: job.user_id,
            itemId: job.item_id,
            jobId: job.id,
            operation: `job:${job.type}`,
            status: "failed",
            attemptCount: job.attempt_count,
            durationMs: Date.now() - startedAt,
            failureReason: error instanceof Error ? error.message : String(error),
          });
          logger.warn("jobs", `Job failed ${job.id}`, { error: String(error), type: job.type });
        }
      }
    } catch (error) {
      logger.error("jobs", "Batch failed", { error: String(error) });
    }

    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
}

void startWorker();
