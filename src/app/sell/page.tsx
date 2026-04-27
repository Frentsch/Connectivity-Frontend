"use client";

import { ConnectButton } from "@/components/ConnectButton";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { CreateListingForm } from "@/components/CreateListingForm";

export default function SellPage() {
  const account = useCurrentAccount();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Create a Listing</h1>
        <ConnectButton />
      </div>

      {!account ? (
        <p>Connect your wallet to create a service listing.</p>
      ) : (
        <CreateListingForm />
      )}
    </div>
  );
}
