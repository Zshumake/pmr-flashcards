"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

export function TopBar() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      // Clear IndexedDB
      if (typeof indexedDB !== "undefined") {
        indexedDB.deleteDatabase("pmr-flashcards");
      }

      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight">
          PM&R Flashcards
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-9 items-center justify-center rounded-full border bg-muted transition-colors hover:bg-accent"
          aria-label="User menu"
        >
          <User className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuItem
            onSelect={() => router.push("/settings")}
            className="min-h-[44px]"
          >
            <User className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={handleLogout}
            variant="destructive"
            className="min-h-[44px]"
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
