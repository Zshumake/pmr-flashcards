import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { ExamConfigForm } from "./exam-config-form"

// ---------------------------------------------------------------------------
// All 12 PM&R board topics
// ---------------------------------------------------------------------------

const PMR_TOPICS = [
  "Musculoskeletal Medicine & Pain",
  "Neuromuscular Medicine",
  "Brain Injury Medicine",
  "Spinal Cord Injury Medicine",
  "Pediatric Rehabilitation",
  "Stroke Rehabilitation",
  "Cardiac & Pulmonary Rehabilitation",
  "Cancer Rehabilitation",
  "Prosthetics & Orthotics",
  "Electrodiagnostic Medicine",
  "General Rehabilitation",
  "Medical Ethics & Patient Safety",
] as const

const QUESTION_COUNTS = [10, 25, 50, 100, 325] as const
const TIME_MULTIPLIERS = [
  { label: "1x (72 sec/q)", value: "1" },
  { label: "1.5x", value: "1.5" },
  { label: "2x", value: "2" },
  { label: "No limit", value: "none" },
] as const

// ---------------------------------------------------------------------------
// Server action: create session and redirect
// ---------------------------------------------------------------------------

async function createExamSession(formData: FormData) {
  "use server"

  const supabase = await createServerSupabaseClient()

  const questionCount = Number(formData.get("questionCount")) || 25
  const timeMultiplier = formData.get("timeMultiplier") as string
  const selectedTopics = formData.getAll("topics") as string[]

  // Single-user mode: use a fixed UUID. When auth is re-enabled, use user.id.
  const userId = "00000000-0000-0000-0000-000000000001"

  // Create the study session
  const { data: session, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: userId,
      mode: "exam",
      topic_filter: selectedTopics.length > 0 ? selectedTopics : null,
      session_state: {
        questionCount,
        timeMultiplier,
        selectedTopics,
      },
    })
    .select("id")
    .single()

  if (error || !session) {
    throw new Error("Failed to create exam session")
  }

  redirect(`/exam/${session.id}`)
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic"

export default function ExamPage() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        Exam Simulation
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Configure your practice exam and test your knowledge under timed
        conditions.
      </p>

      <ExamConfigForm
        action={createExamSession}
        topics={PMR_TOPICS as unknown as string[]}
        questionCounts={QUESTION_COUNTS as unknown as number[]}
        timeMultipliers={TIME_MULTIPLIERS as unknown as Array<{ label: string; value: string }>}
      />
    </div>
  )
}
