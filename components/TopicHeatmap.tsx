"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopicAccuracyData {
  topic: string
  accuracy: number // 0-1
  totalCount: number
  correctCount: number
}

interface TopicHeatmapProps {
  data: TopicAccuracyData[]
}

// ---------------------------------------------------------------------------
// Blue-orange diverging palette (colorblind accessible)
// ---------------------------------------------------------------------------

function getAccuracyColor(accuracy: number): string {
  // 0% => deep orange, 50% => neutral, 100% => deep blue
  if (accuracy >= 0.9) return "bg-blue-600 text-white"
  if (accuracy >= 0.8) return "bg-blue-500 text-white"
  if (accuracy >= 0.7) return "bg-blue-400 text-white"
  if (accuracy >= 0.6) return "bg-sky-300 text-slate-900"
  if (accuracy >= 0.5) return "bg-slate-200 text-slate-900"
  if (accuracy >= 0.4) return "bg-amber-300 text-slate-900"
  if (accuracy >= 0.3) return "bg-orange-400 text-white"
  if (accuracy >= 0.2) return "bg-orange-500 text-white"
  return "bg-orange-600 text-white"
}

function getShapeIcon(accuracy: number): string {
  if (accuracy >= 0.7) return "\u2713" // check
  if (accuracy >= 0.4) return "\u26A0" // warning triangle (text)
  return "\u2717" // X
}

function getShapeLabel(accuracy: number): string {
  if (accuracy >= 0.7) return "Strong"
  if (accuracy >= 0.4) return "Needs work"
  return "Weak"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopicHeatmap({ data }: TopicHeatmapProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No topic data yet. Complete some reviews to see your accuracy by topic.
      </p>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Topic Accuracy
        </h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
          aria-label={
            viewMode === "grid" ? "View as table" : "View as grid"
          }
        >
          {viewMode === "grid" ? "View as table" : "View as grid"}
        </Button>
      </div>

      {viewMode === "grid" ? (
        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4"
          role="list"
          aria-label="Topic accuracy heatmap"
        >
          {data.map((item) => (
            <Link
              key={item.topic}
              href={`/browse?topic=${encodeURIComponent(item.topic)}`}
              role="listitem"
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg p-3 text-center transition-opacity hover:opacity-80",
                getAccuracyColor(item.accuracy)
              )}
            >
              <span className="text-lg" aria-hidden="true">
                {getShapeIcon(item.accuracy)}
              </span>
              <span className="text-xs font-medium leading-tight line-clamp-2">
                {item.topic}
              </span>
              <span className="text-sm font-bold tabular-nums">
                {Math.round(item.accuracy * 100)}%
              </span>
              <span className="sr-only">
                {item.topic}: {Math.round(item.accuracy * 100)}% accuracy -{" "}
                {getShapeLabel(item.accuracy)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic</TableHead>
              <TableHead className="text-right">Accuracy</TableHead>
              <TableHead className="text-right">Correct</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.topic}>
                <TableCell>
                  <Link
                    href={`/browse?topic=${encodeURIComponent(item.topic)}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {item.topic}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Math.round(item.accuracy * 100)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.correctCount}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.totalCount}
                </TableCell>
                <TableCell>{getShapeLabel(item.accuracy)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
