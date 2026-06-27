"use client";

import ErrorBoundary from "@/components/ErrorBoundary";
import type { ReactNode } from "react";

interface Props { children: ReactNode; }

export default function RootErrorBoundary({ children }: Props) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
