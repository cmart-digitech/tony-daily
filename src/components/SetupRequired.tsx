/**
 * Shown when the application cannot reach its database. A deployment that
 * is merely missing configuration should say so plainly rather than
 * returning an opaque server error — the same honesty rule the product
 * applies to missing news and market data.
 */
export default function SetupRequired({ detail }: { detail: string }) {
  const tursoUrlSet = Boolean(process.env.TURSO_DATABASE_URL);
  const tursoTokenSet = Boolean(process.env.TURSO_AUTH_TOKEN);

  const vars: { name: string; set: boolean; note: string }[] = [
    {
      name: "TURSO_DATABASE_URL",
      set: tursoUrlSet,
      note: "The libsql:// address of your hosted database.",
    },
    {
      name: "TURSO_AUTH_TOKEN",
      set: tursoTokenSet,
      note: "A current auth token for that database.",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
        Tony Daily
      </p>
      <h1 className="mb-4 font-serif text-3xl text-ink">Setup required</h1>
      <p className="mb-8 text-ink-2">
        The application is running, but it cannot reach its database, so there is
        nothing it can honestly show you yet.
      </p>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
        Environment variables
      </h2>
      <ul className="mb-8 divide-y divide-line border-y border-line">
        {vars.map((v) => (
          <li key={v.name} className="flex items-baseline gap-3 py-3">
            <span
              aria-hidden
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${v.set ? "bg-up" : "bg-down"}`}
            />
            <span className="min-w-0">
              <code className="font-mono text-sm text-ink">{v.name}</code>
              <span className="ml-2 text-xs text-ink-3">
                {v.set ? "set" : "missing"}
              </span>
              <span className="block text-sm text-ink-2">{v.note}</span>
            </span>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
        What the server reported
      </h2>
      <p className="mb-8 border-l-2 border-down bg-subtle px-4 py-3 font-mono text-xs break-words text-ink-2">
        {detail}
      </p>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
        How to fix it
      </h2>
      <ol className="mb-8 list-decimal space-y-2 pl-5 text-sm text-ink-2">
        <li>
          Open your hosting project&rsquo;s <strong className="text-ink">Settings →
          Environment&nbsp;Variables</strong>.
        </li>
        <li>
          Add any variable marked <em>missing</em> above, for the Production
          environment.
        </li>
        <li>
          Redeploy — environment variables are only read at deploy time, so an
          existing deployment will not pick them up.
        </li>
      </ol>
      <p className="text-sm text-ink-3">
        <code className="font-mono">/api/health</code> returns the same
        information as JSON, without exposing any secret values.
      </p>
    </div>
  );
}
