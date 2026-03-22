"use client";

import { OfflineIndicator } from "@/components/OfflineIndicator";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/90 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-2.5">
        {/* Copper dot accent */}
        <span className="hidden size-2 rounded-full bg-primary md:block" aria-hidden="true" />
        <span className="font-heading text-lg font-semibold tracking-tight">
          PM&R Board Study
        </span>
      </div>
      <div className="flex items-center gap-3">
        <OfflineIndicator />
      </div>
    </header>
  );
}
