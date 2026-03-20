import { createServerSupabaseClient } from "@/lib/supabase/server"
import { SettingsForm } from "./settings-form"

const DEFAULTS = {
  daily_new_limit: 20,
  daily_review_limit: 200,
  default_session_size: 50,
  fsrs_desired_retention: 0.9,
  timezone: "America/Chicago",
  day_start_hour: 4,
  theme: "system" as const,
  exam_time_multiplier: "1",
}

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let settings = DEFAULTS

  if (user) {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (data) {
      settings = {
        daily_new_limit: data.daily_new_limit ?? DEFAULTS.daily_new_limit,
        daily_review_limit:
          data.daily_review_limit ?? DEFAULTS.daily_review_limit,
        default_session_size:
          data.default_session_size ?? DEFAULTS.default_session_size,
        fsrs_desired_retention:
          data.fsrs_desired_retention ?? DEFAULTS.fsrs_desired_retention,
        timezone: data.timezone ?? DEFAULTS.timezone,
        day_start_hour: data.day_start_hour ?? DEFAULTS.day_start_hour,
        theme: data.theme ?? DEFAULTS.theme,
        exam_time_multiplier:
          data.exam_time_multiplier ?? DEFAULTS.exam_time_multiplier,
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your study preferences.
        </p>
      </div>
      <SettingsForm initialValues={settings} />
    </div>
  )
}
