import { Worker } from "bullmq";
import { getBullMqConnectionOptions } from "./connection";

const connection = getBullMqConnectionOptions();

/** Run with `tsx src/jobs/worker.ts` as a standalone process (not part of the Next.js server). */
const notificationWorker = new Worker(
  "notifications",
  async (job) => {
    console.log(`[worker] processing notification job ${job.id}`, job.data);
  },
  { connection }
);

const trialLifecycleWorker = new Worker(
  "trial-lifecycle",
  async (job) => {
    console.log(`[worker] processing trial-lifecycle job ${job.id}`, job.data);
  },
  { connection }
);

const invoiceHookWorker = new Worker(
  "invoice-hooks",
  async (job) => {
    console.log(`[worker] processing invoice-hook job ${job.id}`, job.data);
  },
  { connection }
);

for (const worker of [notificationWorker, trialLifecycleWorker, invoiceHookWorker]) {
  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} in queue "${worker.name}" failed:`, err);
  });
}

console.log("[worker] Skola Alumni background workers started.");
