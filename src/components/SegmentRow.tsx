"use client"

import { memo, useState, useEffect, useRef, useCallback } from "react"
import type { Segment, TMEntry, TMMatch, TermbaseEntry, QAIssue } from "@/types"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

interface SegmentRowProps {
  segment: Segment
  index: number
  isActive: boolean
  matchRate: number
  sourceLang: string
  targetLang: string
  tmMatches: TMMatch[]
  termMatches: TermbaseEntry[]
  qaIssues: QAIssue[]
  onSelect: (index: number) => void
  onUpdate: (id: number, target: string) => void
  onConfirm: (id: number) => void
  onApplyTm: (segId: number, tmEntry: TMEntry) => void
  onNavigate: (direction: "prev" | "next") => void
}

export const SegmentRow = memo(function SegmentRow({
  segment,
  index,
  isActive,
  matchRate,
  sourceLang,
  targetLang,
  tmMatches,
  termMatches,
  qaIssues,
  onSelect,
  onUpdate,
  onConfirm,
  onApplyTm,
  onNavigate,
}: SegmentRowProps) {
  // Local state for input - completely isolated from parent
  const [localTarget, setLocalTarget] = useState(segment.target)
  const prevActiveRef = useRef(isActive)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync from parent only when segment.target changes externally (TM apply)
  useEffect(() => {
    setLocalTarget(segment.target)
  }, [segment.target])

  // Save to parent when becoming inactive (user moved to another segment)
  useEffect(() => {
    if (prevActiveRef.current && !isActive && localTarget !== segment.target) {
      onUpdate(segment.id, localTarget)
    }
    prevActiveRef.current = isActive
  }, [isActive, localTarget, segment.id, segment.target, onUpdate])

  // Focus textarea when becoming active
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isActive])

  const handleConfirm = useCallback(() => {
    // Save current value before confirming
    if (localTarget !== segment.target) {
      onUpdate(segment.id, localTarget)
    }
    // Use requestAnimationFrame to ensure state is committed
    requestAnimationFrame(() => {
      onConfirm(segment.id)
    })
  }, [localTarget, segment.id, segment.target, onUpdate, onConfirm])

  const handleBlur = () => {
    // Save to parent when losing focus
    if (localTarget !== segment.target) {
      onUpdate(segment.id, localTarget)
    }
  }

  const handleApplyTm = (e: React.MouseEvent, match: TMMatch) => {
    e.stopPropagation()
    setLocalTarget(match.target)
    onApplyTm(segment.id, match)
  }

  // Copy source to target
  const handleCopySource = useCallback(() => {
    setLocalTarget(segment.source)
    onUpdate(segment.id, segment.source)
  }, [segment.id, segment.source, onUpdate])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+Enter: Confirm and go to next
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault()
        if (localTarget) {
          handleConfirm()
        }
        return
      }

      // Ctrl+Insert: Copy source to target
      if (e.ctrlKey && e.key === "Insert") {
        e.preventDefault()
        handleCopySource()
        return
      }

      // Ctrl+Up: Previous segment
      if (e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault()
        if (localTarget !== segment.target) {
          onUpdate(segment.id, localTarget)
        }
        onNavigate("prev")
        return
      }

      // Ctrl+Down: Next segment
      if (e.ctrlKey && e.key === "ArrowDown") {
        e.preventDefault()
        if (localTarget !== segment.target) {
          onUpdate(segment.id, localTarget)
        }
        onNavigate("next")
        return
      }

      // Ctrl+1~5: Insert TM match
      if (e.ctrlKey && e.key >= "1" && e.key <= "5") {
        e.preventDefault()
        const matchIndex = parseInt(e.key) - 1
        if (tmMatches[matchIndex]) {
          setLocalTarget(tmMatches[matchIndex].target)
          onApplyTm(segment.id, tmMatches[matchIndex])
        }
        return
      }
    },
    [
      localTarget,
      segment.id,
      segment.target,
      tmMatches,
      handleConfirm,
      handleCopySource,
      onUpdate,
      onNavigate,
      onApplyTm,
    ]
  )

  return (
    <div
      className={cn(
        "rounded-xl border-2 transition-all",
        isActive
          ? "border-teal-500 bg-slate-800 shadow-lg shadow-teal-500/10"
          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
      )}
      onClick={() => onSelect(index)}
    >
      <div className="flex items-start gap-4 p-4">
        {/* Segment Number */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold",
              segment.status === "confirmed"
                ? "bg-green-600"
                : segment.status === "translated"
                ? "bg-yellow-600"
                : "bg-slate-600"
            )}
          >
            {segment.status === "confirmed" ? "✓" : index + 1}
          </div>
          {/* QA Issue Indicator */}
          {qaIssues.length > 0 && (
            <div
              className={cn(
                "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white",
                qaIssues.some((i) => i.severity === "error")
                  ? "bg-red-500"
                  : "bg-yellow-500"
              )}
              title={qaIssues.map((i) => i.message).join("\n")}
            >
              {qaIssues.length}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          {/* Source */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500 font-medium">
                Source ({sourceLang})
              </span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-bold",
                  matchRate === 100
                    ? "bg-green-600"
                    : matchRate >= 85
                    ? "bg-yellow-600"
                    : matchRate >= 75
                    ? "bg-orange-600"
                    : "bg-red-600"
                )}
              >
                {matchRate}%
              </span>
            </div>
            <div className="text-slate-200 leading-relaxed">{segment.source}</div>
            {termMatches.length > 0 && isActive && (
              <div className="mt-3 flex flex-wrap gap-1">
                {termMatches.map((term, i) => (
                  <span
                    key={i}
                    className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded-full border border-purple-700"
                  >
                    {term.source} → {term.target}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Target */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">
                Target ({targetLang})
              </span>
              {isActive && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopySource()
                  }}
                  className="text-xs text-slate-400 hover:text-teal-400 transition"
                  title="Copy source (Ctrl+Insert)"
                >
                  Copy Source
                </button>
              )}
            </div>
            {isActive ? (
              <Textarea
                ref={textareaRef}
                value={localTarget}
                onChange={(e) => setLocalTarget(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="Enter translation..."
                rows={3}
              />
            ) : (
              <div
                className={
                  segment.target ? "text-slate-200" : "text-slate-500 italic"
                }
              >
                {segment.target || "Not translated"}
              </div>
            )}
            {isActive && (
              <div className="mt-1 text-xs text-slate-500">
                {localTarget.length} chars
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleConfirm()
            }}
            disabled={!localTarget}
            className="px-5 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium shrink-0 transition"
            title="Confirm (Ctrl+Enter)"
          >
            Confirm ✓
          </button>
        )}
      </div>

      {/* TM Matches */}
      {isActive && tmMatches.length > 0 && (
        <div className="border-t border-slate-700 p-4 bg-slate-800/50 rounded-b-xl">
          <div className="text-xs text-slate-500 mb-3 font-medium">
            TM Matches (Ctrl+1~5 to insert)
          </div>
          <div className="space-y-2">
            {tmMatches.map((match, i) => (
              <div
                key={i}
                onClick={(e) => handleApplyTm(e, match)}
                className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 transition border border-transparent hover:border-teal-500/50"
              >
                <span className="text-xs text-slate-500 font-mono w-4">
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    match.matchRate === 100
                      ? "bg-green-600"
                      : match.matchRate >= 85
                      ? "bg-yellow-600"
                      : "bg-orange-600"
                  )}
                >
                  {match.matchRate}%
                </span>
                <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
                  <span className="text-slate-400">{match.source}</span>
                  <span className="text-slate-200">{match.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
