import { createServerSupabaseClient } from "@/lib/supabase/server"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const [totalCardsRes, dueCardsRes] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }),
    supabase
      .from("user_progress")
      .select("id", { count: "exact", head: true })
      .lte("due", new Date().toISOString()),
  ])

  const totalCards = totalCardsRes.count ?? 0
  const dueCards = dueCardsRes.count ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 md:p-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your PM&amp;R board preparation at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-3xl font-bold tabular-nums">{totalCards.toLocaleString()}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Total Cards
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-3xl font-bold tabular-nums text-primary">{dueCards}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Due Now
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/review"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Review Due Cards
        </Link>
        <Link
          href="/exam"
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-card font-semibold text-sm transition-all hover:bg-accent active:scale-[0.98]"
        >
          Practice Exam
        </Link>
      </div>
    </div>
  )
}
