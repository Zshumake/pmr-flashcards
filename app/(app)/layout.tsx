import { TopBar } from "@/components/app-shell/top-bar";
import { Sidebar } from "@/components/app-shell/sidebar";
import { BottomNav } from "@/components/app-shell/bottom-nav";
import { ShortcutHelp } from "@/components/ShortcutHelp";
import { StoreProvider } from "@/stores/store-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <div className="flex min-h-dvh flex-col">
        <TopBar />
        <div className="flex flex-1">
          <Sidebar />
          <main
            id="main-content"
            className="flex flex-1 flex-col overflow-y-auto pb-20 md:pb-0"
          >
            {children}
          </main>
        </div>
        <BottomNav />
        <ShortcutHelp />
      </div>
    </StoreProvider>
  );
}
