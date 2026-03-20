import { TopBar } from "@/components/app-shell/top-bar";
import { Sidebar } from "@/components/app-shell/sidebar";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto pb-20 md:pb-0"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
