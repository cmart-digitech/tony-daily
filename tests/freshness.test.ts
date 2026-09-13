import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Replace the real ingest so these tests never fetch a publisher.
const runIngest = vi.fn();
vi.mock("@/lib/ingest/index", () => ({ runIngest: () => runIngest() }));

const { isStale, refreshIfStale, resetRefreshGuard, STALE_AFTER_MS } = await import(
  "@/lib/ingest/freshness"
);

beforeEach(() => {
  runIngest.mockReset();
  resetRefreshGuard();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isStale", () => {
  const now = 1_000_000_000_000;

  it("treats news that has never been refreshed as stale", () => {
    expect(isStale(null, now)).toBe(true);
  });

  it("does not refresh news that is still recent", () => {
    expect(isStale(now - 5 * 60 * 1000, now)).toBe(false);
  });

  it("refreshes once the news is older than the threshold", () => {
    expect(isStale(now - STALE_AFTER_MS - 1, now)).toBe(true);
  });

  it("uses a threshold matching the intended half-hour cadence", () => {
    expect(STALE_AFTER_MS).toBe(30 * 60 * 1000);
  });
});

describe("refreshIfStale", () => {
  it("does nothing when the news is fresh", () => {
    expect(refreshIfStale(Date.now())).toBeNull();
    expect(runIngest).not.toHaveBeenCalled();
  });

  it("starts a refresh when the news is stale", async () => {
    runIngest.mockResolvedValue([]);
    const p = refreshIfStale(Date.now() - STALE_AFTER_MS - 60_000);
    expect(p).not.toBeNull();
    await p;
    expect(runIngest).toHaveBeenCalledTimes(1);
  });

  it("runs only one refresh however many visits arrive while stale", async () => {
    // Several page views landing together must not each fetch every
    // publisher -- that is how a polite refresh becomes a burst.
    let finish: () => void = () => {};
    runIngest.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const stale = Date.now() - STALE_AFTER_MS - 60_000;

    const a = refreshIfStale(stale);
    const b = refreshIfStale(stale);
    const c = refreshIfStale(stale);
    expect(runIngest).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(c).toBe(a);

    finish();
    await a;
  });

  it("allows a new refresh once the previous one has finished", async () => {
    runIngest.mockResolvedValue([]);
    const stale = Date.now() - STALE_AFTER_MS - 60_000;
    await refreshIfStale(stale);
    await refreshIfStale(stale);
    expect(runIngest).toHaveBeenCalledTimes(2);
  });

  it("never lets a failed refresh surface as a page error", async () => {
    runIngest.mockRejectedValue(new Error("publisher unreachable"));
    const p = refreshIfStale(Date.now() - STALE_AFTER_MS - 60_000);
    await expect(p).resolves.toBeUndefined();
  });

  it("recovers after a failure, so the next stale visit tries again", async () => {
    runIngest.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce([]);
    const stale = Date.now() - STALE_AFTER_MS - 60_000;
    await refreshIfStale(stale);
    await refreshIfStale(stale);
    expect(runIngest).toHaveBeenCalledTimes(2);
  });
});
