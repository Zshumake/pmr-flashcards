"use client"

import { useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CircleHelp } from "lucide-react"

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

interface Shortcut {
  keys: string
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: Shortcut[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: "?", description: "Open shortcut help" },
      { keys: "Cmd + K", description: "Open search" },
    ],
  },
  {
    title: "Review Mode",
    shortcuts: [
      { keys: "Space", description: "Flip card" },
      { keys: "1", description: "Rate: Again" },
      { keys: "2", description: "Rate: Hard" },
      { keys: "3", description: "Rate: Good" },
      { keys: "4", description: "Rate: Easy" },
      { keys: "Z", description: "Undo last rating" },
    ],
  },
  {
    title: "Exam Mode",
    shortcuts: [
      { keys: "1-4", description: "Select answer" },
      { keys: "N / Enter", description: "Next question" },
      { keys: "T", description: "Check remaining time" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShortcutHelp() {
  const [open, setOpen] = useState(false)

  useHotkeys(
    "shift+/",
    (e) => {
      e.preventDefault()
      setOpen((prev) => !prev)
    },
    {
      enableOnFormTags: false,
    }
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Keyboard shortcuts"
            className="fixed right-4 bottom-24 z-40 size-10 rounded-full shadow-lg md:bottom-4"
          />
        }
      >
        <CircleHelp className="size-5" />
      </DialogTrigger>

      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Quick reference for keyboard navigation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between gap-4 py-1.5"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
