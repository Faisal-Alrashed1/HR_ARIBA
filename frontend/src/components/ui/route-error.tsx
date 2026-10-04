"use client";

import { ErrorState } from "./states";

/** Shared body for every route's error.tsx boundary. */
export function RouteError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState onRetry={() => retry()} />;
}
