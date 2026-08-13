import { t, type UiLanguage } from "@/lib/i18n";

export default function VerificationBadge({
  status,
  lang,
}: {
  status: string;
  lang: UiLanguage;
}) {
  const label =
    status === "PRIMARY_VERIFIED"
      ? t(lang, "primaryVerified")
      : status === "CORROBORATED"
        ? t(lang, "corroborated")
        : t(lang, "singleSource");
  const tone =
    status === "PRIMARY_VERIFIED"
      ? "text-up border-up/40"
      : status === "CORROBORATED"
        ? "text-accent border-accent/40"
        : "text-ink-3 border-line-2";
  return (
    <span
      className={`inline-block rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}
