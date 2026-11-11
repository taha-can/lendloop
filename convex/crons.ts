import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "retry notification outbox",
  { minutes: 5 },
  internal.automation.retryPending,
);

export default crons;
