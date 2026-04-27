"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Providers = dynamic(
  () => import("./Providers").then((m) => ({ default: m.Providers })),
  { ssr: false, loading: () => null }
);

export function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
