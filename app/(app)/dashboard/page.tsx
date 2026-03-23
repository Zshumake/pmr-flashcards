import Link from "next/link"

export default function DashboardPage() {
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

      <div className="flex gap-3">
        <Link
          href="/review"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
        >
          Review Cards
        </Link>
        <Link
          href="/exam"
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-card font-semibold text-sm"
        >
          Practice Exam
        </Link>
      </div>
    </div>
  )
}
