"use client";

import { memo } from "react";
import type { ProviderUsage, CostItem } from "@/lib/types";
import ProviderStatus from "./ProviderStatus";
import LimitStatusBars from "./LimitStatusBars";
import LimitLineGraph from "./LimitLineGraph";
import CreditsCost from "./CreditsCost";
import ActionMenu from "./ActionMenu";

interface ProviderDetailProps {
  provider: ProviderUsage;
  costItem?: CostItem;
  theme: 'dark' | 'light';
  onOpenAddAccountModal: (provider: string) => void;
  onOpenSettingsModal: () => void;
  onOpenAboutModal: () => void;
}

export default memo(function ProviderDetail({
  provider,
  costItem,
  theme,
  onOpenAddAccountModal,
  onOpenSettingsModal,
  onOpenAboutModal,
}: ProviderDetailProps) {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-2 font-outfit">
      <ProviderStatus
        provider={provider}
        theme={theme}
        onOpenAddAccountModal={onOpenAddAccountModal}
      />

      <LimitStatusBars
        provider={provider}
        onOpenAddAccountModal={onOpenAddAccountModal}
      />

      <LimitLineGraph provider={provider} />

      <CreditsCost
        provider={provider}
        costItem={costItem}
      />

      <ActionMenu
        provider={provider}
        onOpenAddAccountModal={onOpenAddAccountModal}
        onOpenSettingsModal={onOpenSettingsModal}
        onOpenAboutModal={onOpenAboutModal}
      />
    </div>
  );
});
