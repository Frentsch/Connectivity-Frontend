import type { ReactNode } from "react";
import Link from "next/link";
import { ClientProviders } from "@/components/ClientProviders";
import "./globals.css";

export const metadata = {
  title: "SUI Service Marketplace",
  description: "Buy and sell access to services using SUI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          <header style={{ padding: "1rem 2rem", borderBottom: "1px solid #eee", display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <strong style={{ marginRight: "auto" }}>SUI Marketplace</strong>
            <Link href="/">Buy</Link>
            <Link href="/sell">Sell</Link>
            <Link href="/my-listings">My Listings</Link>
            <Link href="/tokens">My Tokens</Link>
          </header>
          <main style={{ padding: "2rem" }}>{children}</main>
        </ClientProviders>
      </body>
    </html>
  );
}
