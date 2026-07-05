import { Queue } from "bullmq";
import { getBullMqConnectionOptions } from "./connection";

// BullMQ requires its own connection with maxRetriesPerRequest disabled (for blocking commands),
// so this is separate from the general-purpose cache client in src/lib/redis.ts.
const connection = getBullMqConnectionOptions();

export const notificationQueue = new Queue("notifications", { connection });
export const trialLifecycleQueue = new Queue("trial-lifecycle", { connection });
export const invoiceHookQueue = new Queue("invoice-hooks", { connection });
