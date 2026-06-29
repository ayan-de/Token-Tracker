"use client";

import { memo } from "react";
import type { ProviderUsage, CostItem } from "@/lib/types";
import ProviderStatus from "./ProviderStatus";
import LimitStatusBars from "./LimitStatusBars";
import CreditsCost from "./CreditsCost";
import ActionMenu from "./ActionMenu";
import ErrorBoundary from "./ErrorBoundary";
import { useModals } from "@/app/page";

interface ProviderDetailProps {
  provider: ProviderUsage;
  costItem?: CostItem;
}

export default memo(function ProviderDetail({
  provider,
  costItem,
}: ProviderDetailProps) {
  const { openAddAccount, openSettings, openAbout } = useModals();

  const statusLoader = <div className="animate-pulse h-16 bg-[var(--color-border)] rounded-lg" />;
  const limitLoader = <div className="animate-pulse h-24 bg-[var(--color-border)] rounded-lg" />;
  const costLoader = <div className="animate-pulse h-20 bg-[var(--color-border)] rounded-lg" />;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-2 font-outfit">
      <ErrorBoundary loader={statusLoader}>
        <ProviderStatus
          provider={provider}
          onOpenAddAccountModal={openAddAccount}
        />
      </ErrorBoundary>

      <ErrorBoundary loader={limitLoader}>
        <LimitStatusBars
          provider={provider}
          onOpenAddAccountModal={openAddAccount}
        />
      </ErrorBoundary>


      <ErrorBoundary loader={costLoader}>
        <CreditsCost
          provider={provider}
          costItem={costItem}
        />
      </ErrorBoundary>

      <ActionMenu
        provider={provider}
        onOpenAddAccountModal={openAddAccount}
        onOpenSettingsModal={openSettings}
        onOpenAboutModal={openAbout}
      />
    </div>
  );
});
