"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { toast } from "sonner"
import Image from "next/image"
import { useAuth } from "@/components/auth/AuthProvider"
import {
  fetchAllTMEntriesForMatching,
  type TranslationMemory,
  type DBTMEntry,
} from "@/lib/supabase/tm-service"
import {
  useTMList,
  useTMEntries,
  useCreateTM,
  useDeleteTM,
  useAddTMEntry,
  useDeleteTMEntry,
  useImportTMEntries,
} from "@/lib/hooks/use-tm"
import {
  fetchUserTermbase,
  fetchUserTermbaseWithDetails,
  addTermbaseEntry,
  deleteTermbaseEntryById,
} from "@/lib/supabase/termbase-service"
import {
  fetchUserClients,
  createClientEntry,
  type Client,
} from "@/lib/supabase/client-service"
import type { DBTermbaseEntry } from "@/lib/supabase/termbase-service"
import type {
  Segment,
  TMEntry,
  TMMatch,
  TermbaseEntry,
  LanguageCode,
  DelimiterType,
  ViewType,
  TranslationStats,
  AnalysisData,
  MatchTierResult,
  QAIssue,
  QACheck,
  QAIssueType,
} from "@/types"
import { MATCH_TIERS } from "@/lib/constants"
import {
  ISO_639_1_LANGUAGES,
  COMMON_LANGUAGES,
  getLanguageByCode,
} from "@/lib/languages"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { calculateMatchRate, cn, countWords } from "@/lib/utils"
import {
  calculateContextMatchRate,
  createTMEntryWithContext,
  getMatchRateColorWithContext,
} from "@/lib/context-match"
import {
  processFile,
  exportToXlsx,
  exportToTmx,
  parseTmxFile,
  exportAnalysisToXlsx,
  exportToXliff,
  parseXliffFile,
} from "@/lib/file-handlers"
import { SegmentRow } from "@/components/SegmentRow"
import {
  DEFAULT_QA_CHECKS,
  runFullQA,
  runSegmentQA,
  getIssueTypeName,
  getIssueSeverityColor,
} from "@/lib/qa-checks"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

type StatusFilter = "all" | "new" | "translated" | "confirmed"

// Delete confirmation state type
type DeleteConfirmState = {
  type: 'tm' | 'tm-entry' | null;
  id: string | null;
  name?: string;
  tmId?: string;
}

export default function CATToolPage() {
  const { user, signOut, loading: authLoading, isConfigured } = useAuth()

  // State
  const [segments, setSegments] = useState<Segment[]>([])

  // TM State (container structure) - Using TanStack Query
  const [selectedTM, setSelectedTM] = useState<TranslationMemory | null>(null)
  const [tm, setTm] = useState<TMEntry[]>([]) // For matching (all entries from selected TMs)
  const [showTMModal, setShowTMModal] = useState(false)
  const [newTMName, setNewTMName] = useState("")
  const [newTMNote, setNewTMNote] = useState("")
  const [newTMTargetLangs, setNewTMTargetLangs] = useState<string[]>([])
  const [targetLangDropdown, setTargetLangDropdown] = useState<
    string | undefined
  >(undefined)
  const [tmEditMode, setTmEditMode] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    type: null,
    id: null,
  })

  // Termbase State
  const [termbase, setTermbase] = useState<TermbaseEntry[]>([])
  const [termbaseDB, setTermbaseDB] = useState<DBTermbaseEntry[]>([])

  // Client State
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientDesc, setNewClientDesc] = useState("")

  // TanStack Query - TM List & Entries
  const {
    data: tmList = [],
    isLoading: tmListLoading,
    refetch: refetchTMList,
  } = useTMList(user && isConfigured ? selectedClient : undefined)

  const {
    data: tmEntries = [],
    isLoading: tmEntriesLoading,
  } = useTMEntries(selectedTM?.id || null)

  // TM Mutations
  const createTMMutation = useCreateTM()
  const deleteTMMutation = useDeleteTM()
  const addTMEntryMutation = useAddTMEntry()
  const deleteTMEntryMutation = useDeleteTMEntry()
  const importTMEntriesMutation = useImportTMEntries()

  const dataLoading = tmListLoading

  // Fetch clients and Termbase from Supabase when logged in
  useEffect(() => {
    async function loadData() {
      if (user && isConfigured) {
        try {
          // Fetch clients
          const userClients = await fetchUserClients()
          setClients(userClients)

          // Fetch Termbase (filtered by selected client)
          const userTermbase = await fetchUserTermbase(selectedClient)
          setTermbase(userTermbase)

          // Fetch Termbase with details for deletion by ID
          const userTermbaseDB = await fetchUserTermbaseWithDetails(
            selectedClient
          )
          setTermbaseDB(userTermbaseDB)
        } catch (error) {
          console.error("Failed to load data:", error)
        }
      } else {
        // Clear data when logged out
        setSelectedTM(null)
        setTm([])
        setTermbase([])
        setTermbaseDB([])
        setClients([])
      }
    }
    loadData()
  }, [user, isConfigured, selectedClient])

  // Load TM entries for matching when TM list changes
  useEffect(() => {
    async function loadTMForMatching() {
      if (tmList.length > 0) {
        const allEntries = await fetchAllTMEntriesForMatching(
          tmList.map((t) => t.id)
        )
        setTm(allEntries)
      } else {
        setTm([])
      }
    }
    loadTMForMatching()
  }, [tmList])
  const [activeSegment, setActiveSegment] = useState<number>(0)
  const [view, setView] = useState<ViewType>("editor")
  const [fileName, setFileName] = useState<string>("")
  const [sourceLang, setSourceLang] = useState<LanguageCode>("en")
  const [targetLang, setTargetLang] = useState<LanguageCode>("ko")
  const [delimiter, setDelimiter] = useState<DelimiterType>("sentence")
  const [loading, setLoading] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [newTerm, setNewTerm] = useState<TermbaseEntry>({
    source: "",
    target: "",
    note: "",
  })
  const [newTmEntry, setNewTmEntry] = useState<{
    source: string
    target: string
  }>({
    source: "",
    target: "",
  })
  const [wordRate, setWordRate] = useState<number>(500)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [autoPropagation, setAutoPropagation] = useState<boolean>(true)
  const [qaChecks, setQaChecks] = useState<QACheck[]>(DEFAULT_QA_CHECKS)
  const [qaIssues, setQaIssues] = useState<QAIssue[]>([])
  const [instantQA, setInstantQA] = useState<boolean>(true)

  // Find best TM match rate for a segment (without context)
  const findBestMatch = useCallback(
    (source: string): number => {
      let bestMatch = 0
      tm.forEach((entry) => {
        const rate = calculateMatchRate(source, entry.source)
        if (rate > bestMatch) bestMatch = rate
      })
      return bestMatch
    },
    [tm]
  )

  // Calculate match rates with context for all segments
  const calculateAllMatchRates = useCallback(
    (segs: { source: string }[]): number[] => {
      return segs.map((_, idx) => {
        // Create temporary segments array for context calculation
        const tempSegments = segs.map((s, i) => ({
          id: i,
          source: s.source,
          target: "",
          status: "new" as const,
          matchRate: 0,
        }))
        return calculateContextMatchRate(idx, tempSegments, tm)
      })
    },
    [tm]
  )

  // Calculate analysis data (uses stored matchRate from load time)
  const analysisData = useMemo((): AnalysisData | null => {
    if (segments.length === 0) return null

    const results: MatchTierResult[] = MATCH_TIERS.map((tier) => ({
      ...tier,
      segments: 0,
      words: 0,
      cost: 0,
    }))

    let totalWords = 0

    segments.forEach((seg) => {
      const words = countWords(seg.source)
      totalWords += words

      for (const tier of results) {
        if (seg.matchRate >= tier.min && seg.matchRate <= tier.max) {
          tier.segments++
          tier.words += words
          tier.cost += words * (tier.rate / 100) * wordRate
          break
        }
      }
    })

    const totalCost = results.reduce((sum, tier) => sum + tier.cost, 0)
    const fullCost = totalWords * wordRate
    const savings = fullCost - totalCost
    const savingsPercent =
      fullCost > 0 ? Math.round((savings / fullCost) * 100) : 0

    return {
      tiers: results,
      totalSegments: segments.length,
      totalWords,
      totalCost,
      fullCost,
      savings,
      savingsPercent,
    }
  }, [segments, wordRate])

  // Find TM matches for a segment
  const findTmMatches = useCallback(
    (source: string): TMMatch[] => {
      return tm
        .map((entry) => ({
          ...entry,
          matchRate: calculateMatchRate(source, entry.source),
        }))
        .filter((entry) => entry.matchRate >= 50)
        .sort((a, b) => b.matchRate - a.matchRate)
        .slice(0, 5)
    },
    [tm]
  )

  // Find termbase matches in text
  const findTermMatches = useCallback(
    (text: string): TermbaseEntry[] => {
      return termbase.filter((term) =>
        text.toLowerCase().includes(term.source.toLowerCase())
      )
    },
    [termbase]
  )

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setFileName(file.name)

    try {
      const texts = await processFile(file, delimiter)
      // Calculate match rates with context at load time (101% support)
      const matchRates = calculateAllMatchRates(
        texts.map((source) => ({ source }))
      )
      setSegments(
        texts.map((source, idx) => ({
          id: idx,
          source,
          target: "",
          status: "new",
          matchRate: matchRates[idx],
        }))
      )
      setActiveSegment(0)
    } catch (error) {
      console.error("File processing error:", error)
      alert("파일을 처리하는 중 오류가 발생했습니다.")
    }

    setLoading(false)
  }

  // Update segment translation
  const updateSegment = (id: number, target: string) => {
    setSegments((prev) =>
      prev.map((seg) =>
        seg.id === id
          ? { ...seg, target, status: target ? "translated" : "new" }
          : seg
      )
    )
  }

  // Confirm segment and add to TM
  const confirmSegment = (id: number) => {
    const seg = segments.find((s) => s.id === id)
    if (seg && seg.target) {
      // Auto-propagate to identical source segments
      let updatedSegments: Segment[]
      if (autoPropagation) {
        updatedSegments = segments.map((s) => {
          if (s.id === id) {
            return { ...s, status: "confirmed" as const }
          }
          // Auto-propagate to segments with identical source (only if not confirmed)
          if (s.source === seg.source && s.status !== "confirmed") {
            return { ...s, target: seg.target, status: "translated" as const }
          }
          return s
        })
        setSegments(updatedSegments)
      } else {
        updatedSegments = segments.map((s) =>
          s.id === id ? { ...s, status: "confirmed" as const } : s
        )
        setSegments(updatedSegments)
      }

      // Run instant QA on confirmed segment
      if (instantQA) {
        const enabledTypes = qaChecks
          .filter((c) => c.enabled)
          .map((c) => c.type)
        const confirmedSeg = updatedSegments.find((s) => s.id === id)
        if (confirmedSeg) {
          const newIssues = runSegmentQA(
            confirmedSeg,
            updatedSegments,
            termbase,
            enabledTypes
          )
          // Remove old issues for this segment and add new ones
          setQaIssues((prev) => [
            ...prev.filter((i) => i.segmentId !== id),
            ...newIssues,
          ])
        }
      }

      // Add to TM with context if not already exists
      if (!tm.find((entry) => entry.source === seg.source)) {
        const segIndex = segments.findIndex((s) => s.id === id)
        const tmEntryWithContext = createTMEntryWithContext(segIndex, segments)
        setTm((prev) => [...prev, tmEntryWithContext])

        // Save to Supabase if user is logged in and a TM is selected
        if (user && isConfigured && selectedTM) {
          addTMEntryMutation.mutate({
            tmId: selectedTM.id,
            entry: tmEntryWithContext,
            targetLang,
          })
        }
      }

      // Move to next unconfirmed segment
      const currentIndex = segments.findIndex((s) => s.id === id)
      const nextUnconfirmed = segments.findIndex(
        (s, idx) => idx > currentIndex && s.status !== "confirmed"
      )
      if (nextUnconfirmed !== -1) {
        setActiveSegment(nextUnconfirmed)
      } else if (currentIndex < segments.length - 1) {
        setActiveSegment(currentIndex + 1)
      }
    }
  }

  // Navigate between segments
  const navigateSegment = useCallback(
    (direction: "prev" | "next") => {
      if (direction === "prev" && activeSegment > 0) {
        setActiveSegment(activeSegment - 1)
      } else if (direction === "next" && activeSegment < segments.length - 1) {
        setActiveSegment(activeSegment + 1)
      }
    },
    [activeSegment, segments.length]
  )

  // Apply TM match
  const applyTmMatch = (segId: number, tmEntry: TMEntry) => {
    updateSegment(segId, tmEntry.target)
  }

  // Apply all 100%+ TM matches (includes 101% context matches)
  const applyAll100Matches = () => {
    // Calculate count first before state update
    const segmentsToApply = segments.filter((seg) => {
      if (seg.matchRate >= 100 && seg.status === "new") {
        const exactMatch = tm.find(
          (entry) => calculateMatchRate(seg.source, entry.source) === 100
        )
        return !!exactMatch
      }
      return false
    })

    if (segmentsToApply.length === 0) return 0

    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.matchRate >= 100 && seg.status === "new") {
          const exactMatch = tm.find(
            (entry) => calculateMatchRate(seg.source, entry.source) === 100
          )
          if (exactMatch) {
            return {
              ...seg,
              target: exactMatch.target,
              status: "translated" as const,
            }
          }
        }
        return seg
      })
    )

    return segmentsToApply.length
  }

  // Import TMX file
  const importTmx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string
      const imported = parseTmxFile(content)
      setTm((prev) => [...prev, ...imported])

      // Save imported entries to Supabase if user is logged in and TM is selected
      if (user && isConfigured && selectedTM && imported.length > 0) {
        const savedCount = await importTMEntriesMutation.mutateAsync({
          tmId: selectedTM.id,
          entries: imported,
          targetLang,
        })
        toast.success(`${savedCount}개 TM 항목이 저장되었습니다`)
      }
    }
    reader.readAsText(file)
  }

  // Import XLIFF file
  const importXliff = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const imported = parseXliffFile(content)
      // Calculate match rates with context at import time (101% support)
      const matchRates = calculateAllMatchRates(
        imported.map((seg) => ({ source: seg.source }))
      )
      setSegments(
        imported.map((seg, idx) => ({
          ...seg,
          matchRate: matchRates[idx],
        }))
      )
      setActiveSegment(0)
    }
    reader.readAsText(file)
  }

  // Statistics
  const stats: TranslationStats = {
    total: segments.length,
    translated: segments.filter((s) => s.status === "translated").length,
    confirmed: segments.filter((s) => s.status === "confirmed").length,
    new: segments.filter((s) => s.status === "new").length,
  }

  const progress =
    stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0

  // Total word count
  const totalWords = useMemo(
    () => segments.reduce((sum, seg) => sum + countWords(seg.source), 0),
    [segments]
  )

  // Filtered segments for display
  const filteredSegments = useMemo(() => {
    if (statusFilter === "all") return segments
    return segments.filter((seg) => seg.status === statusFilter)
  }, [segments, statusFilter])

  // Filtered TM/Termbase
  const filteredTm = tm.filter(
    (entry) =>
      entry.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.target.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredTermbase = termbase.filter(
    (term) =>
      term.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      term.target.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-teal-400">CAT Tool</h1>
            {fileName && (
              <span className="text-sm text-slate-400 bg-slate-700 px-3 py-1 rounded">
                {fileName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {(["editor", "analysis", "qa", "tm", "termbase"] as const).map(
                (v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setView(v)
                      setSearchTerm("")
                    }}
                    className={cn(
                      "px-4 py-2 rounded transition",
                      view === v
                        ? "bg-teal-600"
                        : "bg-slate-700 hover:bg-slate-600",
                      v === "qa" &&
                        qaIssues.filter((i) => !i.ignored).length > 0 &&
                        view !== v &&
                        "ring-2 ring-yellow-500"
                    )}
                  >
                    {v === "editor" && "Editor"}
                    {v === "analysis" && "Analysis"}
                    {v === "qa" &&
                      `QA ${
                        qaIssues.filter((i) => !i.ignored).length > 0
                          ? `(${qaIssues.filter((i) => !i.ignored).length})`
                          : ""
                      }`}
                    {v === "tm" && `TM (${tm.length})`}
                    {v === "termbase" && `TB (${termbase.length})`}
                  </button>
                )
              )}
            </div>

            {/* User Info */}
            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-600">
                <div className="flex items-center gap-2">
                  {user.user_metadata?.avatar_url && (
                    <Image
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-sm text-slate-300">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                </div>
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <aside className="w-72 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* File Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              File Upload
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.docx,.txt"
              onChange={handleFileUpload}
              className="w-full text-sm file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:bg-teal-600 file:text-white hover:file:bg-teal-500 file:cursor-pointer"
            />
            <p className="text-xs text-slate-500">
              Supported: .xlsx, .docx, .txt
            </p>
          </div>

          {/* Language Settings */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Source
              </label>
              <Select
                value={sourceLang}
                onValueChange={(value) => setSourceLang(value)}
              >
                <SelectTrigger className="w-full bg-slate-700 border-slate-600 text-sm h-9">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                  <SelectGroup>
                    <SelectLabel className="text-slate-400">Common</SelectLabel>
                    {COMMON_LANGUAGES.map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        className="text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        {lang.name}{" "}
                        <span className="text-slate-400 ml-1">
                          ({lang.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-slate-400">
                      All Languages
                    </SelectLabel>
                    {ISO_639_1_LANGUAGES.filter(
                      (l) => !COMMON_LANGUAGES.find((c) => c.code === l.code)
                    ).map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        className="text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        {lang.name}{" "}
                        <span className="text-slate-400 ml-1">
                          ({lang.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Target
              </label>
              <Select
                value={targetLang}
                onValueChange={(value) => setTargetLang(value)}
              >
                <SelectTrigger className="w-full bg-slate-700 border-slate-600 text-sm h-9">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                  <SelectGroup>
                    <SelectLabel className="text-slate-400">Common</SelectLabel>
                    {COMMON_LANGUAGES.map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        className="text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        {lang.name}{" "}
                        <span className="text-slate-400 ml-1">
                          ({lang.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-slate-400">
                      All Languages
                    </SelectLabel>
                    {ISO_639_1_LANGUAGES.filter(
                      (l) => !COMMON_LANGUAGES.find((c) => c.code === l.code)
                    ).map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        className="text-slate-200 focus:bg-slate-700 focus:text-white"
                      >
                        {lang.name}{" "}
                        <span className="text-slate-400 ml-1">
                          ({lang.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segmentation */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Segmentation
            </label>
            <select
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value as DelimiterType)}
              className="w-full bg-slate-700 rounded px-3 py-2 text-sm"
            >
              <option value="sentence">Sentence (.!?)</option>
              <option value="newline">Newline</option>
              <option value="paragraph">Paragraph</option>
            </select>
          </div>

          {/* Client Selector */}
          {user && isConfigured && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Client
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedClient || ""}
                  onChange={(e) => setSelectedClient(e.target.value || null)}
                  className="flex-1 bg-slate-700 rounded px-3 py-2 text-sm"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowClientModal(true)}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded text-sm"
                  title="Add new client"
                >
                  +
                </button>
              </div>
              {dataLoading && (
                <p className="text-xs text-slate-500 mt-1">Loading...</p>
              )}
            </div>
          )}

          {/* Word Rate */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Word Rate
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={wordRate}
                onChange={(e) => {
                  const val = e.target.value.replace(/^0+/, "") || "0"
                  const num = parseInt(val, 10)
                  if (!isNaN(num) && num >= 0) {
                    setWordRate(num)
                  }
                }}
                className="flex-1 bg-slate-700 rounded px-3 py-2 text-sm"
              />
              <span className="text-slate-400 text-sm">원/word</span>
            </div>
          </div>

          {/* Progress */}
          {segments.length > 0 && (
            <div className="space-y-2 bg-slate-700/50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Progress</span>
                <span className="text-teal-400 font-bold">{progress}%</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-slate-700 rounded-lg py-2">
                  <div className="text-2xl font-bold text-red-400">
                    {stats.new}
                  </div>
                  <div className="text-slate-500">New</div>
                </div>
                <div className="bg-slate-700 rounded-lg py-2">
                  <div className="text-2xl font-bold text-yellow-400">
                    {stats.translated}
                  </div>
                  <div className="text-slate-500">Draft</div>
                </div>
                <div className="bg-slate-700 rounded-lg py-2">
                  <div className="text-2xl font-bold text-green-400">
                    {stats.confirmed}
                  </div>
                  <div className="text-slate-500">Done</div>
                </div>
              </div>
            </div>
          )}

          {/* Resource Stats */}
          <div className="bg-slate-700/50 p-3 rounded-lg">
            <p className="text-sm font-medium text-slate-300 mb-2">Resources</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-slate-700 rounded p-2 text-center">
                <div className="text-xl font-bold text-blue-400">
                  {tm.length}
                </div>
                <div className="text-xs text-slate-500">TM Entries</div>
              </div>
              <div className="bg-slate-700 rounded p-2 text-center">
                <div className="text-xl font-bold text-purple-400">
                  {termbase.length}
                </div>
                <div className="text-xs text-slate-500">Terms</div>
              </div>
            </div>
          </div>

          {/* Project Import/Export (XLIFF) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">
              Project (XLIFF)
            </label>
            <input
              type="file"
              accept=".xliff,.xlf"
              onChange={importXliff}
              className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer"
            />
            <button
              onClick={() =>
                exportToXliff(segments, sourceLang, targetLang, fileName)
              }
              disabled={segments.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded text-sm font-medium"
            >
              Export XLIFF
            </button>
          </div>

          {/* TM Import/Export (TMX) */}
          <div className="space-y-2 mt-auto">
            <label className="block text-sm font-medium text-slate-300">
              TM (TMX)
            </label>
            <input
              type="file"
              accept=".tmx"
              onChange={importTmx}
              className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-600 file:text-white hover:file:bg-slate-500 file:cursor-pointer"
            />
            <button
              onClick={() => exportToTmx(tm, sourceLang, targetLang)}
              disabled={tm.length === 0}
              className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded text-sm"
            >
              Export TMX
            </button>
          </div>

          {/* Quick Export */}
          <div className="pt-2 border-t border-slate-700">
            <button
              onClick={() => exportToXlsx(segments, fileName)}
              disabled={segments.length === 0}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded text-sm font-medium"
            >
              Export XLSX
            </button>
          </div>
        </aside>

        {/* Main Area */}
        <main className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4 animate-spin">⏳</div>
                <p className="text-xl text-slate-400">Processing file...</p>
              </div>
            </div>
          )}

          {!loading && view === "editor" && (
            <div className="h-full flex flex-col">
              {segments.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <div className="text-8xl mb-6">📄</div>
                    <p className="text-2xl font-medium mb-2">
                      Upload a file to start
                    </p>
                    <p className="text-sm">
                      Supported: .xlsx, .docx, .txt, .xliff
                    </p>
                    <div className="mt-6 p-4 bg-slate-800 rounded-lg text-left max-w-md">
                      <p className="text-sm text-slate-400 mb-2">Tips:</p>
                      <ul className="text-xs text-slate-500 space-y-1">
                        <li>• Excel files: extracts text from all cells</li>
                        <li>• Word files: segments by sentence</li>
                        <li>
                          • XLIFF files: resume previous translation projects
                        </li>
                        <li>• TM matches are shown automatically</li>
                      </ul>
                      <p className="text-sm text-slate-400 mt-4 mb-2">
                        Shortcuts:
                      </p>
                      <ul className="text-xs text-slate-500 space-y-1">
                        <li>• Ctrl+Enter: Confirm segment</li>
                        <li>• Ctrl+↑/↓: Navigate segments</li>
                        <li>• Ctrl+Insert: Copy source to target</li>
                        <li>• Ctrl+1~5: Insert TM match</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Filter Bar */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Filter:</span>
                      {(["all", "new", "translated", "confirmed"] as const).map(
                        (filter) => (
                          <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={cn(
                              "px-3 py-1 rounded text-xs font-medium transition",
                              statusFilter === filter
                                ? "bg-teal-600 text-white"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            )}
                          >
                            {filter === "all"
                              ? `All (${stats.total})`
                              : filter === "new"
                              ? `New (${stats.new})`
                              : filter === "translated"
                              ? `Draft (${stats.translated})`
                              : `Done (${stats.confirmed})`}
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          const count = applyAll100Matches()
                          if (count > 0) {
                            toast.success(
                              `${count}개 세그먼트에 100%+ TM 매치 적용됨`
                            )
                          }
                        }}
                        disabled={
                          segments.filter(
                            (s) => s.matchRate >= 100 && s.status === "new"
                          ).length === 0
                        }
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-medium transition"
                        title="Apply all 100%+ TM matches (including 101% context) to untranslated segments"
                      >
                        Apply 100%+ (
                        {
                          segments.filter(
                            (s) => s.matchRate >= 100 && s.status === "new"
                          ).length
                        }
                        )
                      </button>
                      <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoPropagation}
                          onChange={(e) => setAutoPropagation(e.target.checked)}
                          className="rounded bg-slate-700 border-slate-600"
                        />
                        Auto-propagate
                      </label>
                    </div>
                  </div>

                  {/* Segments */}
                  <div className="flex-1 overflow-auto space-y-4">
                    {filteredSegments.map((seg) => {
                      const originalIndex = segments.findIndex(
                        (s) => s.id === seg.id
                      )
                      const isActive = originalIndex === activeSegment
                      const segmentQaIssues = qaIssues.filter(
                        (i) => i.segmentId === seg.id && !i.ignored
                      )
                      return (
                        <SegmentRow
                          key={seg.id}
                          segment={seg}
                          index={originalIndex}
                          isActive={isActive}
                          matchRate={seg.matchRate}
                          sourceLang={sourceLang}
                          targetLang={targetLang}
                          tmMatches={isActive ? findTmMatches(seg.source) : []}
                          termMatches={
                            isActive ? findTermMatches(seg.source) : []
                          }
                          qaIssues={segmentQaIssues}
                          onSelect={setActiveSegment}
                          onUpdate={updateSegment}
                          onConfirm={confirmSegment}
                          onApplyTm={applyTmMatch}
                          onNavigate={navigateSegment}
                        />
                      )
                    })}
                  </div>

                  {/* Status Bar */}
                  <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-6 text-slate-400">
                      <span>
                        Segments:{" "}
                        <span className="text-white font-medium">
                          {stats.confirmed}/{stats.total}
                        </span>
                      </span>
                      <span>
                        Words:{" "}
                        <span className="text-white font-medium">
                          {totalWords.toLocaleString()}
                        </span>
                      </span>
                    </div>
                    <div className="text-slate-500 text-xs">
                      Segment {activeSegment + 1} of {segments.length}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Analysis View */}
          {!loading && view === "analysis" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-teal-400">
                  Analysis Report
                </h2>
                {analysisData && (
                  <button
                    onClick={() =>
                      exportAnalysisToXlsx(analysisData, wordRate, fileName)
                    }
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium"
                  >
                    Export Analysis
                  </button>
                )}
              </div>

              {!analysisData ? (
                <div className="h-96 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <div className="text-8xl mb-6">📊</div>
                    <p className="text-2xl font-medium mb-2">
                      Upload a file to see analysis
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                      <div className="text-slate-400 text-sm mb-1">
                        Total Segments
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {analysisData.totalSegments}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                      <div className="text-slate-400 text-sm mb-1">
                        Total Words
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {analysisData.totalWords.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                      <div className="text-slate-400 text-sm mb-1">
                        Estimated Cost
                      </div>
                      <div className="text-3xl font-bold text-teal-400">
                        {Math.round(analysisData.totalCost).toLocaleString()}원
                      </div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                      <div className="text-slate-400 text-sm mb-1">
                        TM Savings
                      </div>
                      <div className="text-3xl font-bold text-green-400">
                        {Math.round(analysisData.savings).toLocaleString()}원
                      </div>
                      <div className="text-sm text-green-400">
                        ({analysisData.savingsPercent}% saved)
                      </div>
                    </div>
                  </div>

                  {/* Match Breakdown Chart */}
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-200 mb-4">
                      Match Rate Distribution
                    </h3>
                    <div className="flex h-8 rounded-lg overflow-hidden mb-4">
                      {analysisData.tiers.map((tier, idx) => {
                        const width =
                          analysisData.totalWords > 0
                            ? (tier.words / analysisData.totalWords) * 100
                            : 0
                        if (width === 0) return null
                        return (
                          <div
                            key={idx}
                            className={`${tier.color} flex items-center justify-center text-xs font-bold text-white`}
                            style={{ width: `${width}%` }}
                            title={`${tier.name}: ${tier.words} words`}
                          >
                            {width > 8 && `${Math.round(width)}%`}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {analysisData.tiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${tier.color}`} />
                          <span className="text-sm text-slate-400">
                            {tier.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Table */}
                  <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                    <table className="w-full">
                      <thead className="bg-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm text-slate-300">
                            Match Rate
                          </th>
                          <th className="px-4 py-3 text-left text-sm text-slate-300">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right text-sm text-slate-300">
                            Segments
                          </th>
                          <th className="px-4 py-3 text-right text-sm text-slate-300">
                            Words
                          </th>
                          <th className="px-4 py-3 text-right text-sm text-slate-300">
                            Rate
                          </th>
                          <th className="px-4 py-3 text-right text-sm text-slate-300">
                            Cost (원)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisData.tiers.map((tier, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-slate-700 hover:bg-slate-700/50"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-3 h-3 rounded ${tier.color}`}
                                />
                                <span className="font-medium">{tier.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-400 text-sm">
                              {tier.label}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {tier.segments}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {tier.words.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {tier.rate}%
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {Math.round(tier.cost).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-600 bg-slate-700/50 font-bold">
                          <td className="px-4 py-3" colSpan={2}>
                            Total
                          </td>
                          <td className="px-4 py-3 text-right">
                            {analysisData.totalSegments}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {analysisData.totalWords.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">-</td>
                          <td className="px-4 py-3 text-right text-teal-400">
                            {Math.round(
                              analysisData.totalCost
                            ).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Cost Comparison */}
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-slate-200 mb-4">
                      Cost Comparison
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">
                            Without TM (100%)
                          </span>
                          <span className="text-slate-200">
                            {analysisData.fullCost.toLocaleString()}원
                          </span>
                        </div>
                        <div className="h-4 bg-red-500/30 rounded-full">
                          <div
                            className="h-full bg-red-500 rounded-full"
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">With TM</span>
                          <span className="text-teal-400 font-bold">
                            {Math.round(
                              analysisData.totalCost
                            ).toLocaleString()}
                            원
                          </span>
                        </div>
                        <div className="h-4 bg-teal-500/30 rounded-full">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{
                              width: `${
                                (analysisData.totalCost /
                                  analysisData.fullCost) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-lg text-slate-200">
                            Total Savings
                          </span>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-green-400">
                              {Math.round(
                                analysisData.savings
                              ).toLocaleString()}
                              원
                            </span>
                            <span className="text-green-400 ml-2">
                              ({analysisData.savingsPercent}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {!loading && view === "tm" && (
            <div className="flex gap-6 h-full">
              {/* TM List Panel */}
              <div className="w-80 flex-shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-teal-400">TM List</h2>
                  <button
                    onClick={() => {
                      setNewTMTargetLangs([targetLang])
                      setShowTMModal(true)
                    }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded text-sm"
                  >
                    + New TM
                  </button>
                </div>

                <div className="flex-1 overflow-auto space-y-2">
                  {tmList.length === 0 ? (
                    <div className="text-slate-500 text-center py-8">
                      <div className="text-4xl mb-2">📚</div>
                      <p className="text-sm">No TMs yet</p>
                      <p className="text-xs mt-1">Create your first TM</p>
                    </div>
                  ) : (
                    tmList.map((tmItem) => (
                      <div
                        key={tmItem.id}
                        onClick={() => {
                          setSelectedTM(tmItem)
                          setTmEditMode(false) // Reset edit mode when switching TM
                          // tmEntries are automatically fetched via useTMEntries hook
                        }}
                        className={cn(
                          "p-3 rounded-lg cursor-pointer transition border",
                          selectedTM?.id === tmItem.id
                            ? "bg-teal-600/20 border-teal-500"
                            : "bg-slate-800 border-slate-700 hover:border-slate-600"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">
                              {tmItem.name}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              {tmItem.source_lang.toUpperCase()} →{" "}
                              {tmItem.target_langs
                                .map((l) => l.toUpperCase())
                                .join(", ")}
                            </p>
                            {tmItem.note && (
                              <p className="text-xs text-slate-500 mt-1 truncate">
                                {tmItem.note}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-2">
                            <span className="text-sm font-medium text-teal-400">
                              {tmItem.entry_count}
                            </span>
                            <p className="text-xs text-slate-500">entries</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
                          <span className="text-xs text-slate-500">
                            {new Date(tmItem.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({
                                type: 'tm',
                                id: tmItem.id,
                                name: tmItem.name,
                              })
                            }}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* TM Detail Panel */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {!selectedTM ? (
                  <div className="flex-1 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                      <div className="text-6xl mb-4">👈</div>
                      <p className="text-lg">Select a TM to view details</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto">
                    {/* Basic Info Section */}
                    <div className="bg-slate-800 rounded-xl p-6 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="text-2xl font-bold text-teal-400">
                            {selectedTM.name}
                          </h2>
                          {selectedTM.note && (
                            <p className="text-slate-400 mt-1">
                              {selectedTM.note}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTmEditMode(!tmEditMode)}
                            className={cn(
                              "px-4 py-1.5 rounded text-sm font-medium transition",
                              tmEditMode
                                ? "bg-teal-600 hover:bg-teal-500 text-white"
                                : "bg-slate-700 hover:bg-slate-600"
                            )}
                          >
                            {tmEditMode ? "Done" : "Edit"}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">
                            Source Language
                          </p>
                          <p className="font-medium text-teal-300">
                            {getLanguageByCode(selectedTM.source_lang)?.name ||
                              selectedTM.source_lang.toUpperCase()}
                          </p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">
                            Target Languages
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {selectedTM.target_langs.map((lang) => (
                              <span
                                key={lang}
                                className="text-sm font-medium text-teal-300"
                              >
                                {getLanguageByCode(lang)?.name ||
                                  lang.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Entries</p>
                          <p className="font-medium text-2xl text-white">
                            {selectedTM.entry_count}
                          </p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Created</p>
                          <p className="font-medium text-slate-300">
                            {new Date(
                              selectedTM.created_at
                            ).toLocaleDateString()}
                          </p>
                          {selectedTM.updated_at !== selectedTM.created_at && (
                            <p className="text-xs text-slate-500 mt-1">
                              Updated:{" "}
                              {new Date(
                                selectedTM.updated_at
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedTM.client_id && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                          <p className="text-xs text-slate-500 mb-1">
                            Associated Client
                          </p>
                          <p className="font-medium text-slate-300">
                            {clients.find((c) => c.id === selectedTM.client_id)
                              ?.name || "Unknown Client"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* TM Entries Section */}
                    <div className="bg-slate-800 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">
                            TM Entries
                          </h3>
                          {tmEditMode && (
                            <span className="px-2 py-0.5 bg-teal-600/30 text-teal-300 text-xs rounded">
                              Edit Mode
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Search entries..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="bg-slate-700 rounded-lg px-4 py-2 text-sm w-64"
                        />
                      </div>

                      {/* Add Entry Form & TMX Import - Only in Edit Mode */}
                      {tmEditMode && (
                        <div className="space-y-3 mb-4">
                          <div className="flex gap-2 bg-slate-700/50 p-4 rounded-xl">
                            <input
                              type="text"
                              placeholder={`Source (${selectedTM.source_lang})`}
                              value={newTmEntry.source}
                              onChange={(e) =>
                                setNewTmEntry((prev) => ({
                                  ...prev,
                                  source: e.target.value,
                                }))
                              }
                              className="flex-1 bg-slate-700 rounded-lg px-4 py-2 text-sm"
                            />
                            <input
                              type="text"
                              placeholder={`Target (${
                                selectedTM.target_langs[0] || targetLang
                              })`}
                              value={newTmEntry.target}
                              onChange={(e) =>
                                setNewTmEntry((prev) => ({
                                  ...prev,
                                  target: e.target.value,
                                }))
                              }
                              className="flex-1 bg-slate-700 rounded-lg px-4 py-2 text-sm"
                            />
                            <button
                              onClick={async () => {
                                if (
                                  newTmEntry.source &&
                                  newTmEntry.target &&
                                  selectedTM
                                ) {
                                  const tmEntry: TMEntry = {
                                    source: newTmEntry.source,
                                    target: newTmEntry.target,
                                  }
                                  const success = await addTMEntryMutation.mutateAsync({
                                    tmId: selectedTM.id,
                                    entry: tmEntry,
                                    targetLang: selectedTM.target_langs[0] || targetLang,
                                  })
                                  if (success) {
                                    setTm((prev) => [...prev, tmEntry])
                                    toast.success("Entry added")
                                  }
                                  setNewTmEntry({ source: "", target: "" })
                                }
                              }}
                              className="px-6 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium"
                            >
                              + Add
                            </button>
                          </div>

                          {/* TMX Import */}
                          <div className="flex items-center gap-3 bg-slate-700/30 p-3 rounded-xl">
                            <span className="text-sm text-slate-400">
                              Import from file:
                            </span>
                            <label className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm cursor-pointer transition">
                              📁 Upload TMX
                              <input
                                type="file"
                                accept=".tmx"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0]
                                  if (!file || !selectedTM) return

                                  const reader = new FileReader()
                                  reader.onload = async (event) => {
                                    const content = event.target?.result as string
                                    const imported = parseTmxFile(content)

                                    if (imported.length === 0) {
                                      toast.error("No entries found in TMX file")
                                      return
                                    }

                                    const savedCount = await importTMEntriesMutation.mutateAsync({
                                      tmId: selectedTM.id,
                                      entries: imported,
                                      targetLang: selectedTM.target_langs[0] || targetLang,
                                    })

                                    setTm((prev) => [...prev, ...imported])
                                    toast.success(`${savedCount} entries imported from TMX`)
                                  }
                                  reader.readAsText(file)
                                  e.target.value = ""
                                }}
                              />
                            </label>
                            <span className="text-xs text-slate-500">
                              Supports standard TMX format
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Entries Table */}
                      {tmEntries.filter(
                        (e) =>
                          e.source
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          e.target
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase())
                      ).length === 0 ? (
                        <div className="text-slate-500 text-center py-12">
                          <div className="text-6xl mb-4">📝</div>
                          <p className="text-lg">
                            {searchTerm ? "No entries found" : "No entries yet"}
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-auto bg-slate-700/30 rounded-xl">
                          <table className="w-full">
                            <thead className="bg-slate-700 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm text-slate-300 w-12">
                                  #
                                </th>
                                <th className="px-4 py-3 text-left text-sm text-slate-300">
                                  Source ({selectedTM.source_lang})
                                </th>
                                <th className="px-4 py-3 text-left text-sm text-slate-300">
                                  Target ({selectedTM.target_langs.join(", ")})
                                </th>
                                {tmEditMode && (
                                  <th className="px-4 py-3 text-right text-sm text-slate-300 w-20">
                                    Actions
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {tmEntries
                                .filter(
                                  (e) =>
                                    e.source
                                      .toLowerCase()
                                      .includes(searchTerm.toLowerCase()) ||
                                    e.target
                                      .toLowerCase()
                                      .includes(searchTerm.toLowerCase())
                                )
                                .map((entry, idx) => (
                                  <tr
                                    key={entry.id}
                                    className="border-t border-slate-700 hover:bg-slate-700/50"
                                  >
                                    <td className="px-4 py-3 text-slate-500 text-sm">
                                      {idx + 1}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      {entry.source}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-300">
                                      {entry.target}
                                    </td>
                                    {tmEditMode && (
                                      <td className="px-4 py-3 text-right">
                                        <button
                                          onClick={() => {
                                            setDeleteConfirm({
                                              type: 'tm-entry',
                                              id: entry.id,
                                              name: entry.source,
                                              tmId: selectedTM.id,
                                            })
                                          }}
                                          className="text-red-400 hover:text-red-300 text-sm"
                                        >
                                          🗑️
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && view === "termbase" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-teal-400">Termbase</h2>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-700 rounded-lg px-4 py-2 text-sm w-64"
                />
              </div>

              {/* Add Term Form */}
              <div className="flex gap-2 bg-slate-800 p-4 rounded-xl">
                <input
                  type="text"
                  placeholder="Source term"
                  value={newTerm.source}
                  onChange={(e) =>
                    setNewTerm((prev) => ({ ...prev, source: e.target.value }))
                  }
                  className="flex-1 bg-slate-700 rounded-lg px-4 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Target term"
                  value={newTerm.target}
                  onChange={(e) =>
                    setNewTerm((prev) => ({ ...prev, target: e.target.value }))
                  }
                  className="flex-1 bg-slate-700 rounded-lg px-4 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={newTerm.note}
                  onChange={(e) =>
                    setNewTerm((prev) => ({ ...prev, note: e.target.value }))
                  }
                  className="w-40 bg-slate-700 rounded-lg px-4 py-2 text-sm"
                />
                <button
                  onClick={async () => {
                    if (newTerm.source && newTerm.target) {
                      setTermbase((prev) => [...prev, newTerm])
                      // Save to Supabase if user is logged in
                      if (user && isConfigured) {
                        const success = await addTermbaseEntry(
                          newTerm,
                          selectedClient
                        )
                        if (success) {
                          // Refresh termbaseDB to get the new entry with ID
                          const userTermbaseDB =
                            await fetchUserTermbaseWithDetails(selectedClient)
                          setTermbaseDB(userTermbaseDB)
                          toast.success("Term added")
                        }
                      }
                      setNewTerm({ source: "", target: "", note: "" })
                    }
                  }}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm font-medium"
                >
                  + Add
                </button>
              </div>

              {/* Terms List */}
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm text-slate-300">
                        Source ({sourceLang})
                      </th>
                      <th className="px-4 py-3 text-left text-sm text-slate-300">
                        Target ({targetLang})
                      </th>
                      <th className="px-4 py-3 text-left text-sm text-slate-300">
                        Note
                      </th>
                      <th className="px-4 py-3 text-right text-sm text-slate-300 w-20">
                        Delete
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTermbase.map((term, idx) => (
                      <tr
                        key={idx}
                        className="border-t border-slate-700 hover:bg-slate-700/50"
                      >
                        <td className="px-4 py-3 text-purple-300 font-medium">
                          {term.source}
                        </td>
                        <td className="px-4 py-3">{term.target}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {term.note}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              // Find the DB entry with ID
                              const dbEntry = termbaseDB.find(
                                (e) => e.source === term.source
                              )
                              setTermbase((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                              setTermbaseDB((prev) =>
                                prev.filter((e) => e.source !== term.source)
                              )
                              // Delete from Supabase if user is logged in
                              if (user && isConfigured && dbEntry) {
                                const success = await deleteTermbaseEntryById(
                                  dbEntry.id
                                )
                                if (success) {
                                  toast.success("Term deleted")
                                }
                              }
                            }}
                            className="text-red-400 hover:text-red-300"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* QA View */}
          {!loading && view === "qa" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-teal-400">
                  Quality Assurance
                </h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={instantQA}
                      onChange={(e) => setInstantQA(e.target.checked)}
                      className="rounded bg-slate-700 border-slate-600"
                    />
                    Instant QA on confirm
                  </label>
                  <button
                    onClick={() => {
                      const enabledTypes = qaChecks
                        .filter((c) => c.enabled)
                        .map((c) => c.type)
                      const issues = runFullQA(segments, termbase, enabledTypes)
                      setQaIssues(issues)
                    }}
                    disabled={segments.length === 0}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium"
                  >
                    Run QA Check
                  </button>
                </div>
              </div>

              {/* QA Checks Toggle */}
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <h3 className="text-sm font-medium text-slate-300 mb-3">
                  QA Checks
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {qaChecks.map((check) => (
                    <label
                      key={check.type}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={check.enabled}
                        onChange={(e) =>
                          setQaChecks((prev) =>
                            prev.map((c) =>
                              c.type === check.type
                                ? { ...c, enabled: e.target.checked }
                                : c
                            )
                          )
                        }
                        className="rounded bg-slate-700 border-slate-600"
                      />
                      <span
                        className={
                          check.enabled ? "text-slate-200" : "text-slate-500"
                        }
                      >
                        {check.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          check.severity === "error"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-yellow-900/50 text-yellow-400"
                        )}
                      >
                        {check.severity}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* QA Results Summary */}
              {qaIssues.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="text-slate-400 text-sm mb-1">
                      Total Issues
                    </div>
                    <div className="text-3xl font-bold text-white">
                      {qaIssues.length}
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4 border border-red-900/50">
                    <div className="text-slate-400 text-sm mb-1">Errors</div>
                    <div className="text-3xl font-bold text-red-400">
                      {
                        qaIssues.filter(
                          (i) => i.severity === "error" && !i.ignored
                        ).length
                      }
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4 border border-yellow-900/50">
                    <div className="text-slate-400 text-sm mb-1">Warnings</div>
                    <div className="text-3xl font-bold text-yellow-400">
                      {
                        qaIssues.filter(
                          (i) => i.severity === "warning" && !i.ignored
                        ).length
                      }
                    </div>
                  </div>
                </div>
              )}

              {/* QA Issues List */}
              {segments.length === 0 ? (
                <div className="h-96 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <div className="text-8xl mb-6">🔍</div>
                    <p className="text-2xl font-medium mb-2">
                      Upload a file to run QA
                    </p>
                  </div>
                </div>
              ) : qaIssues.length === 0 ? (
                <div className="h-96 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <div className="text-8xl mb-6">✅</div>
                    <p className="text-2xl font-medium mb-2">No issues found</p>
                    <p className="text-sm">
                      Click &quot;Run QA Check&quot; to analyze your translation
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                  <table className="w-full">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm text-slate-300 w-16">
                          Seg
                        </th>
                        <th className="px-4 py-3 text-left text-sm text-slate-300 w-28">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-sm text-slate-300">
                          Message
                        </th>
                        <th className="px-4 py-3 text-left text-sm text-slate-300">
                          Source
                        </th>
                        <th className="px-4 py-3 text-left text-sm text-slate-300">
                          Target
                        </th>
                        <th className="px-4 py-3 text-right text-sm text-slate-300 w-24">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {qaIssues
                        .filter((issue) => !issue.ignored)
                        .map((issue, idx) => {
                          const segment = segments.find(
                            (s) => s.id === issue.segmentId
                          )
                          return (
                            <tr
                              key={idx}
                              className="border-t border-slate-700 hover:bg-slate-700/50"
                            >
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    const segIdx = segments.findIndex(
                                      (s) => s.id === issue.segmentId
                                    )
                                    if (segIdx !== -1) {
                                      setActiveSegment(segIdx)
                                      setView("editor")
                                    }
                                  }}
                                  className="text-teal-400 hover:text-teal-300 font-medium"
                                >
                                  #{issue.segmentId + 1}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "text-xs px-2 py-1 rounded font-medium",
                                    issue.severity === "error"
                                      ? "bg-red-900/50 text-red-400"
                                      : "bg-yellow-900/50 text-yellow-400"
                                  )}
                                >
                                  {getIssueTypeName(issue.type)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-300">
                                {issue.message}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">
                                {segment?.source || "-"}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">
                                {segment?.target || "-"}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() =>
                                    setQaIssues((prev) =>
                                      prev.map((i, iIdx) =>
                                        iIdx === idx
                                          ? { ...i, ignored: true }
                                          : i
                                      )
                                    )
                                  }
                                  className="text-slate-500 hover:text-slate-300 text-xs"
                                  title="Ignore this issue"
                                >
                                  Ignore
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Ignored Issues */}
              {qaIssues.filter((i) => i.ignored).length > 0 && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-500">
                      {qaIssues.filter((i) => i.ignored).length} ignored issues
                    </span>
                    <button
                      onClick={() =>
                        setQaIssues((prev) =>
                          prev.map((i) => ({ ...i, ignored: false }))
                        )
                      }
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      Show all
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Client Creation Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-96 border border-slate-700">
            <h3 className="text-lg font-bold text-teal-400 mb-4">
              Create New Client
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g., Samsung Electronics"
                  className="w-full bg-slate-700 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newClientDesc}
                  onChange={(e) => setNewClientDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full bg-slate-700 rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                <div>Source: {sourceLang}</div>
                <div>Target: {targetLang}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowClientModal(false)
                  setNewClientName("")
                  setNewClientDesc("")
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (newClientName.trim()) {
                    const newClient = await createClientEntry(
                      newClientName.trim(),
                      sourceLang,
                      targetLang,
                      newClientDesc.trim() || undefined
                    )
                    if (newClient) {
                      setClients((prev) => [newClient, ...prev])
                      setSelectedClient(newClient.id)
                      toast.success(`Client "${newClientName}" created`)
                    } else {
                      toast.error("Failed to create client")
                    }
                    setShowClientModal(false)
                    setNewClientName("")
                    setNewClientDesc("")
                  }
                }}
                disabled={!newClientName.trim()}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TM Creation Modal */}
      {showTMModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-[500px] max-h-[90vh] overflow-y-auto border border-slate-700">
            <h3 className="text-lg font-bold text-teal-400 mb-4">
              Create New Translation Memory
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  TM Name *
                </label>
                <input
                  type="text"
                  value={newTMName}
                  onChange={(e) => setNewTMName(e.target.value)}
                  placeholder="e.g., Marketing Materials TM"
                  className="w-full bg-slate-700 rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Source Language *
                </label>
                <Select value={sourceLang} onValueChange={setSourceLang}>
                  <SelectTrigger className="w-full bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Select source language" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                    <SelectGroup>
                      <SelectLabel className="text-slate-400">
                        Common Languages
                      </SelectLabel>
                      {COMMON_LANGUAGES.map((lang) => (
                        <SelectItem
                          key={lang.code}
                          value={lang.code}
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          {lang.name} ({lang.nativeName})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-slate-400">
                        All Languages
                      </SelectLabel>
                      {ISO_639_1_LANGUAGES.filter(
                        (lang) =>
                          !COMMON_LANGUAGES.some((c) => c.code === lang.code)
                      ).map((lang) => (
                        <SelectItem
                          key={lang.code}
                          value={lang.code}
                          className="text-slate-200 focus:bg-slate-700"
                        >
                          {lang.name} ({lang.nativeName})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Target Languages *
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {newTMTargetLangs.map((langCode) => {
                      const lang = getLanguageByCode(langCode)
                      return (
                        <span
                          key={langCode}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-teal-600/30 text-teal-300 rounded text-sm"
                        >
                          {lang?.name || langCode}
                          <button
                            onClick={() =>
                              setNewTMTargetLangs((prev) =>
                                prev.filter((l) => l !== langCode)
                              )
                            }
                            className="hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                  <Select
                    value={targetLangDropdown}
                    onValueChange={(value) => {
                      if (value && !newTMTargetLangs.includes(value)) {
                        setNewTMTargetLangs((prev) => [...prev, value])
                      }
                      setTargetLangDropdown(undefined)
                    }}
                  >
                    <SelectTrigger className="w-full bg-slate-700 border-slate-600">
                      <SelectValue placeholder="Add target language..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                      <SelectGroup>
                        <SelectLabel className="text-slate-400">
                          Common Languages
                        </SelectLabel>
                        {COMMON_LANGUAGES.filter(
                          (lang) => !newTMTargetLangs.includes(lang.code)
                        ).map((lang) => (
                          <SelectItem
                            key={lang.code}
                            value={lang.code}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            {lang.name} ({lang.nativeName})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="text-slate-400">
                          All Languages
                        </SelectLabel>
                        {ISO_639_1_LANGUAGES.filter(
                          (lang) =>
                            !COMMON_LANGUAGES.some(
                              (c) => c.code === lang.code
                            ) && !newTMTargetLangs.includes(lang.code)
                        ).map((lang) => (
                          <SelectItem
                            key={lang.code}
                            value={lang.code}
                            className="text-slate-200 focus:bg-slate-700"
                          >
                            {lang.name} ({lang.nativeName})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Client (Optional)
                </label>
                <Select
                  value={selectedClient || "__none__"}
                  onValueChange={(value) =>
                    setSelectedClient(value === "__none__" ? null : value)
                  }
                >
                  <SelectTrigger className="w-full bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Select client (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem
                      value="__none__"
                      className="text-slate-400 focus:bg-slate-700"
                    >
                      No client
                    </SelectItem>
                    {clients.map((client) => (
                      <SelectItem
                        key={client.id}
                        value={client.id}
                        className="text-slate-200 focus:bg-slate-700"
                      >
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">
                  Note (Optional)
                </label>
                <textarea
                  value={newTMNote}
                  onChange={(e) => setNewTMNote(e.target.value)}
                  placeholder="Description or notes about this TM..."
                  rows={3}
                  className="w-full bg-slate-700 rounded px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowTMModal(false)
                  setNewTMName("")
                  setNewTMNote("")
                  setNewTMTargetLangs([])
                  setTargetLangDropdown(undefined)
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (newTMName.trim() && newTMTargetLangs.length > 0) {
                    const newTM = await createTMMutation.mutateAsync({
                      name: newTMName.trim(),
                      sourceLang,
                      targetLangs: newTMTargetLangs,
                      clientId: selectedClient,
                      note: newTMNote.trim() || undefined,
                    })
                    if (newTM) {
                      setSelectedTM(newTM)
                      toast.success(`TM "${newTMName}" created`)
                    } else {
                      toast.error("Failed to create TM")
                    }
                    setShowTMModal(false)
                    setNewTMName("")
                    setNewTMNote("")
                    setNewTMTargetLangs([])
                    setTargetLangDropdown(undefined)
                  }
                }}
                disabled={!newTMName.trim() || newTMTargetLangs.length === 0 || createTMMutation.isPending}
                className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium"
              >
                {createTMMutation.isPending ? "Creating..." : "Create TM"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.type !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirm({ type: null, id: null })
          }
        }}
        title={
          deleteConfirm.type === 'tm'
            ? `Delete "${deleteConfirm.name}"?`
            : "Delete this entry?"
        }
        description={
          deleteConfirm.type === 'tm'
            ? "This will permanently delete this TM and all its entries."
            : `Are you sure you want to delete "${deleteConfirm.name}"?`
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          const { type, id, name, tmId } = deleteConfirm
          if (type === 'tm' && id) {
            await deleteTMMutation.mutateAsync(id)
            if (selectedTM?.id === id) {
              setSelectedTM(null)
            }
            toast.success("TM deleted")
          } else if (type === 'tm-entry' && id && tmId) {
            await deleteTMEntryMutation.mutateAsync({
              entryId: id,
              tmId: tmId,
            })
            setTm((prev) => prev.filter((e) => e.source !== name))
            toast.success("Entry deleted")
          }
        }}
      />
    </div>
  )
}
