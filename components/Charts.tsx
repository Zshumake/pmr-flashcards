"use client"

import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
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

export interface ReviewHistoryPoint {
  date: string // YYYY-MM-DD
  count: number
}

export interface CardStateDistribution {
  name: string // "New" | "Learning" | "Review" | "Mature"
  value: number
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const PIE_COLORS = [
  "var(--color-muted-foreground)", // New - gray
  "var(--color-chart-1, #3b82f6)", // Learning - blue
  "var(--color-chart-2, #8b5cf6)", // Review - purple
  "var(--color-chart-3, #10b981)", // Mature - green
]

// ---------------------------------------------------------------------------
// Review History Line Chart
// ---------------------------------------------------------------------------

interface ReviewHistoryChartProps {
  data: ReviewHistoryPoint[]
}

export function ReviewHistoryChart({ data }: ReviewHistoryChartProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart")

  const total = data.reduce((s, d) => s + d.count, 0)
  const textSummary = `Review history: ${total} reviews over the last ${data.length} days. Average ${data.length > 0 ? Math.round(total / data.length) : 0} reviews per day.`

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Reviews per Day (Last 30 Days)
        </h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={() =>
            setViewMode(viewMode === "chart" ? "table" : "chart")
          }
          aria-label={
            viewMode === "chart" ? "View as table" : "View as chart"
          }
        >
          {viewMode === "chart" ? "View as table" : "View as chart"}
        </Button>
      </div>

      {viewMode === "chart" ? (
        <div
          role="img"
          aria-label={textSummary}
          className="h-48 w-full md:h-56"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => {
                  const parts = v.split("-")
                  return `${parts[1]}/${parts[2]}`
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                labelFormatter={(v) => {
                  const d = new Date(String(v) + "T12:00:00")
                  return d.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }}
                formatter={(value) => [String(value), "Reviews"]}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--color-chart-1, #3b82f6)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Reviews</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{d.date}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card State Pie Chart
// ---------------------------------------------------------------------------

interface CardStatePieChartProps {
  data: CardStateDistribution[]
}

export function CardStatePieChart({ data }: CardStatePieChartProps) {
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart")

  const total = data.reduce((s, d) => s + d.value, 0)
  const textSummary = data
    .map(
      (d) =>
        `${d.name}: ${d.value} (${total > 0 ? Math.round((d.value / total) * 100) : 0}%)`
    )
    .join(", ")

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Card States
        </h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={() =>
            setViewMode(viewMode === "chart" ? "table" : "chart")
          }
          aria-label={
            viewMode === "chart" ? "View as table" : "View as chart"
          }
        >
          {viewMode === "chart" ? "View as table" : "View as chart"}
        </Button>
      </div>

      {viewMode === "chart" ? (
        <div
          role="img"
          aria-label={`Card state distribution: ${textSummary}`}
          className="h-48 w-full md:h-56"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="70%"
                paddingAngle={2}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ""} ${Math.round((percent ?? 0) * 100)}%`
                }
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell
                    key={index}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [String(value), "Cards"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.name}>
                <TableCell>{d.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {d.value}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {total > 0 ? Math.round((d.value / total) * 100) : 0}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
