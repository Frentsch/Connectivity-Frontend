import type { ReactNode } from "react";

export default function SellLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      backgroundColor: "#ffffff",
      margin: "-2rem",
      padding: "2rem",
      minHeight: "100%",
    }}>
      {children}
    </div>
  );
}
