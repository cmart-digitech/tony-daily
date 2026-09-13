import { runIngest } from "./index";

/**
 * Keep the news fresh without depending on a scheduler.
 *
 * The 30-minute GitHub Actions refresh was measured running a median of 292
 * minutes apart across 363 runs. GitHub's own documentation names the cause:
 * scheduled runs are delayed at high-load times, which "include the start of
 * every hour", and queued runs "may be dropped" — and our cron fired exactly
 * on :00 and :30. Between runs the news simply went stale.
 *
 * Moving the cron off those minutes helps, but a scheduler is still a thing
 * that can be late. This makes freshness self-healing instead: when someone
 * opens the dashboard and the news is older than STALE_AFTER_MS, a refresh
 * starts in the background. The page renders immediately from what is
 * already held — nobody waits for the fetch — and the next page view has the
 * new stories.
 */
export const STALE_AFTER_MS = 30 * 60 * 1000;

/** True when the news has not been refreshed recently enough to trust. */
export function isStale(lastRefreshedAt: number | null, now = Date.now()): boolean {
  // Never refreshed at all is the stalest possible state.
  if (lastRefreshedAt == null) return true;
  return now - lastRefreshedAt > STALE_AFTER_MS;
}

/**
 * One refresh in flight per server instance at most.
 *
 * Several page views landing while the news is stale would otherwise each
 * start their own fetch of all 25 publishers. This guard keeps it to one per
 * instance; across instances, the per-source 15-minute cooldown stored in the
 * database stops a second instance re-fetching a publisher the first has just
 * finished with. Duplicate items that do slip through are rejected by the
 * canonical-URL and content-hash de-duplication, so a race costs a little
 * bandwidth and never produces a duplicate story.
 */
let inFlight: Promise<unknown> | null = null;

export function refreshIfStale(lastRefreshedAt: number | null): Promise<unknown> | null {
  if (!isStale(lastRefreshedAt)) return null;
  if (inFlight) return inFlight;

  inFlight = runIngest()
    .catch((err) => {
      // A background refresh must never surface as a page error. The next
      // stale visit simply tries again.
      console.warn(
        `Background refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Test seam — no production caller resets this. */
export function resetRefreshGuard(): void {
  inFlight = null;
}
