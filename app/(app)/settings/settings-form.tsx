"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  daily_new_limit: z.number().int().min(1).max(999),
  daily_review_limit: z.number().int().min(1).max(9999),
  default_session_size: z.number().int().min(5).max(500),
  fsrs_desired_retention: z.number().min(0.8).max(0.95),
  timezone: z.string(),
  day_start_hour: z.number().int().min(0).max(6),
  theme: z.enum(["system", "light", "dark"]),
  exam_time_multiplier: z.string(),
})

type SettingsValues = z.infer<typeof settingsSchema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEZONES = [
  { label: "Eastern (ET)", value: "America/New_York" },
  { label: "Central (CT)", value: "America/Chicago" },
  { label: "Mountain (MT)", value: "America/Denver" },
  { label: "Pacific (PT)", value: "America/Los_Angeles" },
  { label: "Alaska (AKT)", value: "America/Anchorage" },
  { label: "Hawaii (HT)", value: "Pacific/Honolulu" },
]

const DAY_START_OPTIONS = [
  { label: "Midnight", value: 0 },
  { label: "1:00 AM", value: 1 },
  { label: "2:00 AM", value: 2 },
  { label: "3:00 AM", value: 3 },
  { label: "4:00 AM", value: 4 },
  { label: "5:00 AM", value: 5 },
  { label: "6:00 AM", value: 6 },
]

const THEME_OPTIONS = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const

const TIME_MULTIPLIERS = [
  { label: "1x", value: "1" },
  { label: "1.5x", value: "1.5" },
  { label: "2x", value: "2" },
  { label: "No limit", value: "0" },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SettingsFormProps {
  initialValues: SettingsValues
}

export function SettingsForm({ initialValues }: SettingsFormProps) {
  const { setTheme } = useTheme()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initialValues,
  })

  const retentionValue = watch("fsrs_desired_retention")
  const selectedTheme = watch("theme")
  const selectedMultiplier = watch("exam_time_multiplier")

  async function onSubmit(values: SettingsValues) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast.error("You must be signed in to save settings.")
      return
    }

    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        ...values,
      },
      { onConflict: "user_id" }
    )

    if (error) {
      toast.error("Failed to save settings. Please try again.")
      return
    }

    setTheme(values.theme)
    toast.success("Settings saved.")
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
    >
      {/* Study limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Study Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup label="Daily new card limit" error={errors.daily_new_limit?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              {...register("daily_new_limit", { valueAsNumber: true })}
            />
          </FieldGroup>

          <FieldGroup label="Daily review limit" error={errors.daily_review_limit?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              {...register("daily_review_limit", { valueAsNumber: true })}
            />
          </FieldGroup>

          <FieldGroup label="Default session size" error={errors.default_session_size?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={5}
              max={500}
              {...register("default_session_size", { valueAsNumber: true })}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* FSRS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">FSRS Algorithm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Desired retention
            </span>
            <span className="tabular-nums text-sm font-medium">
              {(retentionValue * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0.8}
            max={0.95}
            step={0.01}
            className="w-full accent-primary"
            {...register("fsrs_desired_retention", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Higher values mean more reviews but better long-term retention.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Timezone and day start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup label="Timezone" error={errors.timezone?.message}>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              {...register("timezone")}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </FieldGroup>

          <FieldGroup label="Day starts at" error={errors.day_start_hour?.message}>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              {...register("day_start_hour", { valueAsNumber: true })}
            >
              {DAY_START_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                  "hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  value={opt.value}
                  className="sr-only"
                  {...register("theme")}
                  checked={selectedTheme === opt.value}
                  onChange={() => setValue("theme", opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exam time multiplier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exam Time Multiplier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TIME_MULTIPLIERS.map((tm) => (
              <label
                key={tm.value}
                className={cn(
                  "flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
                  "hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  value={tm.value}
                  className="sr-only"
                  {...register("exam_time_multiplier")}
                  checked={selectedMultiplier === tm.value}
                  onChange={() => setValue("exam_time_multiplier", tm.value)}
                />
                {tm.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button type="submit" className="h-12 w-full text-base" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Field group helper
// ---------------------------------------------------------------------------

function FieldGroup({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
