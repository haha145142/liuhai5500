import { defineEventHandler } from "h3";

export default defineEventHandler(() => ({
  ok: true,
  service: "Fund AI Pro",
  timestamp: new Date().toISOString(),
}));
