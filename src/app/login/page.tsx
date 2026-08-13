import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  // With no password configured the app is open; there is nothing to log
  // into and the page would only confuse.
  if (!authEnabled()) redirect("/");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
        Private dashboard
      </p>
      <h1 className="mb-10 font-serif text-4xl font-bold tracking-tight text-ink">
        TONY<span className="text-accent">·</span>DAILY
      </h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
