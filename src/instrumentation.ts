export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateProductionEnv } = await import("@/lib/env");
    validateProductionEnv();
  }

  if (process.env.SENTRY_DSN) {
    try {
      await import("../sentry.server.config");
    } catch {
      /* Sentry optional */
    }
  }

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SYNC_ENABLED !== "false") {
    const { bootstrapSyncIfNeeded } = await import("@/lib/sync/bootstrap");
    void bootstrapSyncIfNeeded();
  }
}
