"use client";

import { memo } from "react";
import type { ProviderUsage, CostItem } from "@/lib/types";
import ProviderStatus from "./ProviderStatus";
import LimitStatusBars from "./LimitStatusBars";
import LimitLineGraph from "./LimitLineGraph";
import CreditsCost from "./CreditsCost";
import ActionMenu from "./ActionMenu";
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

  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-2 font-outfit">
      <ProviderStatus
        provider={provider}
        onOpenAddAccountModal={openAddAccount}
      />

      <LimitStatusBars
        provider={provider}
        onOpenAddAccountModal={openAddAccount}
      />

      <LimitLineGraph provider={provider} />

      <CreditsCost
        provider={provider}
        costItem={costItem}
      />

      <ActionMenu
        provider={provider}
        onOpenAddAccountModal={openAddAccount}
        onOpenSettingsModal={openSettings}
        onOpenAboutModal={openAbout}
      />
    </div>
  );
});
