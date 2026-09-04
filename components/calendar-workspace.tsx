"use client"

import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from "react"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Link2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type R = Record<string, any>

type ViewMode = "day" | "week" | "month" | "year" | "agenda"

type EventCategory =
  | "google"
  | "meeting"
  | "client"
  | "project"
  | "task"
  | "followup"
  | "payment"

type CalendarEvent = {
  id: string
  title: string
  start: string
  end?: string
  description?: string
  location?: string
  link?: string
  meetingLink?: string
  category: EventCategory
  source: "google" | "crm"
  clientId?: string
  clientName?: string
  leadId?: string
  leadName?: string
  projectId?: string
  projectName?: string
  taskId?: string
  taskName?: string
  reminderMinutes?: number
  recurrence?: string
  completed?: boolean
  raw?: R
}

type Props = {
  tasks?: R[]
  leads?: R[]
  clients?: R[]
  projects?: R[]
  payments?: R[]
  language?: string

  editTask?: (id: string, values: R) => Promise<any> | any
  editLead?: (id: string, values: R) => Promise<any> | any
  editProject?: (id: string, values: R) => Promise<any> | any
}

const CATEGORY_STYLE: Record<EventCategory, string> = {
  google:
    "border-cyan-300/20 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15",
  meeting:
    "border-blue-300/20 bg-blue-300/10 text-blue-100 hover:bg-blue-300/15",
  client:
    "border-violet-300/20 bg-violet-300/10 text-violet-100 hover:bg-violet-300/15",
  project:
    "border-emerald-300/20 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15",
  task:
    "border-amber-300/20 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15",
  followup:
    "border-fuchsia-300/20 bg-fuchsia-300/10 text-fuchsia-100 hover:bg-fuchsia-300/15",
  payment:
    "border-rose-300/20 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15",
}

const CATEGORY_DOT: Record<EventCategory, string> = {
  google: "bg-cyan-300",
  meeting: "bg-blue-300",
  client: "bg-violet-300",
  project: "bg-emerald-300",
  task: "bg-amber-300",
  followup: "bg-fuchsia-300",
  payment: "bg-rose-300",
}

const CATEGORY_LABEL: Record<EventCategory, string> = {
  google: "Google Calendar",
  meeting: "Meetings",
  client: "Clients",
  project: "Projects",
  task: "Tasks",
  followup: "Follow-ups",
  payment: "Payments",
}

const FILTERS: EventCategory[] = [
  "google",
  "meeting",
  "client",
  "project",
  "task",
  "followup",
  "payment",
]

export function CalendarWorkspace({
  tasks = [],
  leads = [],
  clients = [],
  projects = [],
  payments = [],
  language = "en",
  editTask,
  editLead,
  editProject,
}: Props) {
  const [view, setView] = useState<ViewMode>("month")
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))

  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [calendarError, setCalendarError] = useState("")

  const [search, setSearch] = useState("")
  const [quickAdd, setQuickAdd] = useState("")

  const [clientFilter, setClientFilter] = useState("")
  const [projectFilter, setProjectFilter] = useState("")
  const [taskFilter, setTaskFilter] = useState("")

  const [enabled, setEnabled] = useState<Record<EventCategory, boolean>>({
    google: true,
    meeting: true,
    client: true,
    project: true,
    task: true,
    followup: true,
    payment: true,
  })

  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [editor, setEditor] = useState<Partial<CalendarEvent> | null>(null)
  const [saving, setSaving] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const range = useMemo(() => getRange(view, cursor), [view, cursor])

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setView("agenda")
    }
  }, [])

  useEffect(() => {
    loadGoogleEvents()
  }, [range.from.getTime(), range.to.getTime()])

  async function loadGoogleEvents() {
    setLoading(true)
    setCalendarError("")

    try {
      const params = new URLSearchParams({
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      })

      const response = await fetch(`/api/calendar/events?${params}`, {
        cache: "no-store",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Calendar unavailable.")
      }

      setConnected(Boolean(data.connected))

      const mapped: CalendarEvent[] = (data.events || []).map((x: R) => ({
        id: String(x.id),
        title: x.title || "Untitled event",
        start: x.start,
        end: x.end,
        description: x.description || "",
        location: x.location || "",
        link: x.link || "",
        meetingLink: x.meetingLink || x.hangoutLink || "",
        category: "google",
        source: "google",
        reminderMinutes: x.reminderMinutes,
        recurrence: x.recurrence,
        raw: x,
      }))

      setGoogleEvents(mapped)
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : "Calendar unavailable."
      )
    } finally {
      setLoading(false)
    }
  }

  const crmEvents = useMemo(
    () =>
      buildCrmEvents({
        tasks,
        leads,
        clients,
        projects,
        payments,
      }),
    [tasks, leads, clients, projects, payments]
  )

  const allEvents = useMemo(
    () =>
      [...googleEvents, ...crmEvents]
        .map((event) => ({
          ...event,
          completed:
            event.completed || completedIds.includes(eventKey(event)),
        }))
        .sort(
          (a, b) =>
            new Date(a.start).getTime() - new Date(b.start).getTime()
        ),
    [googleEvents, crmEvents, completedIds]
  )

  const visibleEvents = useMemo(() => {
    const q = search.trim().toLowerCase()

    return allEvents.filter((event) => {
      if (!enabled[event.category]) return false

      if (clientFilter && event.clientId !== clientFilter) return false
      if (projectFilter && event.projectId !== projectFilter) return false
      if (taskFilter && event.taskId !== taskFilter) return false

      if (q) {
        const haystack = [
          event.title,
          event.description,
          event.location,
          event.clientName,
          event.projectName,
          event.taskName,
          event.leadName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [
    allEvents,
    enabled,
    search,
    clientFilter,
    projectFilter,
    taskFilter,
  ])

  function movePeriod(direction: -1 | 1) {
    setCursor((current) => {
      const next = new Date(current)

      if (view === "day") {
        next.setDate(next.getDate() + direction)
      } else if (view === "week") {
        next.setDate(next.getDate() + direction * 7)
      } else if (view === "year") {
        next.setFullYear(next.getFullYear() + direction)
      } else {
        next.setMonth(next.getMonth() + direction)
      }

      return next
    })
  }

  function goToday() {
    setCursor(startOfDay(new Date()))
  }

  function createAt(date: Date) {
    const start = new Date(date)
    start.setHours(9, 0, 0, 0)

    const end = new Date(start)
    end.setHours(10, 0, 0, 0)

    setEditor({
      title: "",
      start: toLocalDateTimeValue(start),
      end: toLocalDateTimeValue(end),
      category: "meeting",
      source: "google",
      reminderMinutes: 30,
      recurrence: "none",
    })
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    const id = String(form.get("id") || "")
    const title = String(form.get("title") || "").trim()
    const start = String(form.get("start") || "")
    const end = String(form.get("end") || "")
    const description = String(form.get("description") || "")
    const location = String(form.get("location") || "")
    const meetingLink = String(form.get("meetingLink") || "")
    const category = String(form.get("category") || "meeting") as EventCategory
    const clientId = String(form.get("clientId") || "")
    const leadId = String(form.get("leadId") || "")
    const projectId = String(form.get("projectId") || "")
    const taskId = String(form.get("taskId") || "")
    const recurrence = String(form.get("recurrence") || "none")
    const reminderMinutes = Number(form.get("reminderMinutes") || 0)

    if (!title || !start) return

    const linkedClient = clients.find((x: R) => String(x.id) === clientId)
    const linkedLead = leads.find((x: R) => String(x.id) === leadId)
    const linkedProject = projects.find(
      (x: R) => String(x.id) === projectId
    )
    const linkedTask = tasks.find((x: R) => String(x.id) === taskId)

    const payload = {
      id: id || undefined,
      title,
      start: new Date(start).toISOString(),
      end: end ? new Date(end).toISOString() : undefined,
      description,
      location,
      meetingLink,
      category,
      reminderMinutes,
      recurrence,
      clientId: clientId || undefined,
      clientName:
        linkedClient?.name || linkedClient?.company_name || undefined,
      leadId: leadId || undefined,
      leadName:
        linkedLead?.contact_name || linkedLead?.company || undefined,
      projectId: projectId || undefined,
      projectName: linkedProject?.name || undefined,
      taskId: taskId || undefined,
      taskName: linkedTask?.title || undefined,
    }

    setSaving(true)

    try {
      const response = await fetch("/api/calendar/events", {
        method: id ? "PATCH" : "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Google Calendar write support has not been enabled yet."
        )
      }

      setEditor(null)
      setSelected(null)
      await loadGoogleEvents()
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The event could not be saved."
      )
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(item: CalendarEvent) {
    if (!confirm(`Delete "${item.title}"?`)) return

    if (item.source === "crm") {
      alert(
        "This item comes from CRM data. Delete or change it from the linked CRM record."
      )
      return
    }

    setSaving(true)

    try {
      const response = await fetch("/api/calendar/events", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: item.id }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Google Calendar delete support has not been enabled yet."
        )
      }

      setSelected(null)
      await loadGoogleEvents()
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The event could not be deleted."
      )
    } finally {
      setSaving(false)
    }
  }

  async function markComplete(item: CalendarEvent) {
    const key = eventKey(item)

    if (item.taskId && editTask) {
      await editTask(item.taskId, { status: "Done" })
    } else {
      setCompletedIds((current) =>
        current.includes(key)
          ? current.filter((x) => x !== key)
          : [...current, key]
      )
    }

    setSelected({
      ...item,
      completed: true,
    })
  }

  async function rescheduleEvent(item: CalendarEvent, newStart: Date) {
    const originalStart = new Date(item.start)

    const duration =
      item.end && !Number.isNaN(new Date(item.end).getTime())
        ? new Date(item.end).getTime() - originalStart.getTime()
        : 60 * 60 * 1000

    const newEnd = new Date(newStart.getTime() + duration)

    if (item.source === "crm") {
      if (item.taskId && editTask) {
        await editTask(item.taskId, {
          due_date: dateKey(newStart),
        })
        return
      }

      if (item.projectId && editProject) {
        await editProject(item.projectId, {
          due_date: dateKey(newStart),
        })
        return
      }

      if (item.leadId && editLead) {
        await editLead(item.leadId, {
          follow_up_date: dateKey(newStart),
        })
        return
      }

      alert(
        "This CRM record cannot be rescheduled from Calendar until its linked editor is connected."
      )

      return
    }

    try {
      const response = await fetch("/api/calendar/events", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: item.id,
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))

        throw new Error(
          data.error ||
            "Google Calendar rescheduling has not been enabled yet."
        )
      }

      await loadGoogleEvents()
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "The event could not be rescheduled."
      )
    }
  }

  function handleQuickAdd() {
    const parsed = parseQuickAdd(quickAdd)

    if (!parsed) {
      alert(
        'Try something like "Meeting with John tomorrow at 3 PM".'
      )
      return
    }

    setQuickAdd("")

    setEditor({
      title: parsed.title,
      start: toLocalDateTimeValue(parsed.start),
      end: toLocalDateTimeValue(parsed.end),
      category: "meeting",
      source: "google",
      reminderMinutes: 30,
      recurrence: "none",
    })
  }

  const heading = periodTitle(view, cursor, language)

  return (
    <>
      <div className="grid min-h-[720px] gap-4 xl:grid-cols-[270px_minmax(0,1fr)]">
        <aside>
          <Card className="sticky top-4 overflow-hidden border-white/10 bg-white/[.045] text-white shadow-2xl shadow-black/20">
            <div className="border-b border-white/10 p-4">
              <Button
                className="w-full justify-center gap-2"
                onClick={() => createAt(cursor)}
              >
                <Plus size={16} />
                New Event
              </Button>

              <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToday}
                  className="border-white/10 bg-white/[.04]"
                >
                  Today
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => movePeriod(-1)}
                  className="border-white/10 bg-white/[.04]"
                >
                  <ChevronLeft size={16} />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => movePeriod(1)}
                  className="border-white/10 bg-white/[.04]"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            <div className="calendar-workspace-scroll max-h-[calc(100vh-190px)] overflow-y-auto p-4">
              <MiniCalendar
                cursor={cursor}
                events={visibleEvents}
                onSelect={(date) => {
                  setCursor(date)
                  if (view === "year") setView("month")
                }}
              />

              <SidebarSection title="View">
                <select
                  value={view}
                  onChange={(event) =>
                    setView(event.target.value as ViewMode)
                  }
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="agenda">Agenda</option>
                </select>
              </SidebarSection>

              <SidebarSection title="Google Calendar">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-cyan-300" />
                    <span className="text-xs text-slate-300">
                      Connection
                    </span>
                  </div>

                  {connected ? (
                    <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                      Connected
                    </Badge>
                  ) : (
                    <a
                      href="/api/calendar/connect"
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      Connect
                    </a>
                  )}
                </div>
              </SidebarSection>

              <SidebarSection title="Search">
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="John, website, invoice..."
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
                  />
                </div>
              </SidebarSection>

              <SidebarSection title="Quick add">
                <div className="space-y-2">
                  <input
                    value={quickAdd}
                    onChange={(event) => setQuickAdd(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleQuickAdd()
                    }}
                    placeholder="Meeting tomorrow at 3 PM"
                    className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/10 bg-white/[.04]"
                    onClick={handleQuickAdd}
                  >
                    Add to editor
                  </Button>
                </div>
              </SidebarSection>

              <SidebarSection title="My Calendars">
                <div className="space-y-1">
                  {FILTERS.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() =>
                        setEnabled((current) => ({
                          ...current,
                          [category]: !current[category],
                        }))
                      }
                      className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-xs transition hover:bg-white/[.05]"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT[category]}`}
                        />

                        {CATEGORY_LABEL[category]}
                      </span>

                      <span
                        className={
                          enabled[category]
                            ? "flex h-5 w-5 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                            : "flex h-5 w-5 items-center justify-center rounded-md border border-white/10 text-transparent"
                        }
                      >
                        <Check size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              </SidebarSection>

              <SidebarSection title="CRM Filters">
                <FilterSelect
                  value={clientFilter}
                  onChange={setClientFilter}
                  placeholder="All clients"
                  rows={clients}
                  label={(x) =>
                    x.name || x.company_name || "Unnamed client"
                  }
                />

                <FilterSelect
                  value={projectFilter}
                  onChange={setProjectFilter}
                  placeholder="All projects"
                  rows={projects}
                  label={(x) => x.name || "Unnamed project"}
                />

                <FilterSelect
                  value={taskFilter}
                  onChange={setTaskFilter}
                  placeholder="All tasks"
                  rows={tasks}
                  label={(x) => x.title || "Untitled task"}
                />

                {(clientFilter || projectFilter || taskFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setClientFilter("")
                      setProjectFilter("")
                      setTaskFilter("")
                    }}
                    className="text-xs text-cyan-300 hover:text-cyan-200"
                  >
                    Clear CRM filters
                  </button>
                )}
              </SidebarSection>

              <SidebarSection title="Team Calendars">
                <div className="rounded-xl border border-dashed border-white/10 bg-black/10 p-3">
                  <p className="text-xs text-slate-500">
                    Team-member calendars can be added here when Orbit
                    collaboration is enabled.
                  </p>
                </div>
              </SidebarSection>
            </div>
          </Card>
        </aside>

        <main className="min-w-0">
          <Card className="overflow-hidden border-white/10 bg-white/[.045] text-white shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:px-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/70">
                  Orbit Calendar
                </p>

                <h1 className="mt-1 text-xl font-semibold">
                  {heading}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {loading && (
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <RefreshCw size={13} className="animate-spin" />
                    Syncing
                  </span>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/[.04]"
                  onClick={() => movePeriod(-1)}
                >
                  <ChevronLeft size={15} />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/[.04]"
                  onClick={goToday}
                >
                  Today
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 bg-white/[.04]"
                  onClick={() => movePeriod(1)}
                >
                  <ChevronRight size={15} />
                </Button>

                <select
                  value={view}
                  onChange={(event) =>
                    setView(event.target.value as ViewMode)
                  }
                  className="h-9 rounded-lg border border-white/10 bg-[#0f172a] px-3 text-sm text-white outline-none md:hidden"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                  <option value="agenda">Agenda</option>
                </select>
              </div>
            </div>

            {calendarError && (
              <div className="border-b border-amber-300/10 bg-amber-300/[.04] px-5 py-3 text-xs text-amber-200">
                {calendarError}
              </div>
            )}

            {view === "month" && (
              <MonthView
                cursor={cursor}
                events={visibleEvents}
                onSelectEvent={setSelected}
                onCreate={createAt}
                onDropEvent={rescheduleEvent}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
                language={language}
              />
            )}

            {view === "week" && (
              <WeekView
                cursor={cursor}
                events={visibleEvents}
                onSelectEvent={setSelected}
                onCreate={createAt}
                onDropEvent={rescheduleEvent}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
                language={language}
              />
            )}

            {view === "day" && (
              <DayView
                cursor={cursor}
                events={visibleEvents}
                onSelectEvent={setSelected}
                onCreate={createAt}
                onDropEvent={rescheduleEvent}
                draggingId={draggingId}
                setDraggingId={setDraggingId}
                language={language}
              />
            )}

            {view === "year" && (
              <YearView
                cursor={cursor}
                events={visibleEvents}
                onOpenMonth={(month) => {
                  setCursor(month)
                  setView("month")
                }}
                language={language}
              />
            )}

            {view === "agenda" && (
              <AgendaView
                cursor={cursor}
                events={visibleEvents}
                onSelectEvent={setSelected}
                language={language}
              />
            )}
          </Card>
        </main>
      </div>

      {selected && (
        <EventDrawer
          event={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditor({
              ...selected,
              start: toLocalDateTimeValue(new Date(selected.start)),
              end: selected.end
                ? toLocalDateTimeValue(new Date(selected.end))
                : "",
            })

            setSelected(null)
          }}
          onDelete={() => deleteEvent(selected)}
          onComplete={() => markComplete(selected)}
          saving={saving}
          language={language}
        />
      )}

      {editor && (
        <EventEditor
          value={editor}
          clients={clients}
          leads={leads}
          projects={projects}
          tasks={tasks}
          saving={saving}
          onClose={() => setEditor(null)}
          onSubmit={saveEvent}
        />
      )}
    </>
  )
}

function SidebarSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>

      <div className="space-y-2">{children}</div>
    </section>
  )
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  rows,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows: R[]
  label: (row: R) => string
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-xl border border-white/10 bg-[#0f172a] px-3 text-xs text-white outline-none"
    >
      <option value="">{placeholder}</option>

      {rows.map((row) => (
        <option key={String(row.id)} value={String(row.id)}>
          {label(row)}
        </option>
      ))}
    </select>
  )
}

function MiniCalendar({
  cursor,
  events,
  onSelect,
}: {
  cursor: Date
  events: CalendarEvent[]
  onSelect: (date: Date) => void
}) {
  const cells = monthGrid(cursor)
  const month = cursor.getMonth()
  const today = dateKey(new Date())

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {cursor.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>

        <CalendarDays size={15} className="text-cyan-300" />
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-600">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const key = dateKey(date)
          const hasEvent = events.some(
            (event) => dateKey(new Date(event.start)) === key
          )

          const isToday = key === today
          const muted = date.getMonth() !== month

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              className={[
                "relative flex aspect-square items-center justify-center rounded-lg text-[11px] transition",
                muted ? "text-slate-700" : "text-slate-300",
                isToday
                  ? "border border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                  : "hover:bg-white/[.06]",
              ].join(" ")}
            >
              {date.getDate()}

              {hasEvent && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-cyan-300" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({
  cursor,
  events,
  onSelectEvent,
  onCreate,
  onDropEvent,
  draggingId,
  setDraggingId,
  language,
}: R) {
  const cells = monthGrid(cursor)
  const currentMonth = cursor.getMonth()
  const today = dateKey(new Date())

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-7 border-b border-white/10">
          {weekDayNames(language).map((day) => (
            <div
              key={day}
              className="border-r border-white/[.06] px-3 py-3 text-xs font-medium text-slate-500 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date) => {
            const key = dateKey(date)

            const dayEvents = events.filter(
              (event: CalendarEvent) =>
                dateKey(new Date(event.start)) === key
            )

            const isToday = key === today
            const outside = date.getMonth() !== currentMonth

            return (
              <div
                key={key}
                onClick={() => onCreate(date)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()

                  const id = event.dataTransfer.getData("text/calendar-id")
                  const item = events.find(
                    (x: CalendarEvent) => eventKey(x) === id
                  )

                  if (!item) return

                  const old = new Date(item.start)
                  const next = new Date(date)
                  next.setHours(old.getHours(), old.getMinutes(), 0, 0)

                  onDropEvent(item, next)
                  setDraggingId(null)
                }}
                className={[
                  "group min-h-[145px] border-b border-r border-white/[.06] p-2 transition last:border-r-0",
                  outside ? "bg-black/[.10]" : "bg-white/[.008]",
                  isToday ? "bg-cyan-300/[.035]" : "",
                  draggingId ? "hover:bg-cyan-300/[.045]" : "",
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs",
                      isToday
                        ? "bg-cyan-300 text-slate-950"
                        : outside
                          ? "text-slate-700"
                          : "text-slate-400",
                    ].join(" ")}
                  >
                    {date.getDate()}
                  </span>

                  <Plus
                    size={13}
                    className="text-transparent transition group-hover:text-slate-600"
                  />
                </div>

                <div
                  className="calendar-day-scroll max-h-[104px] space-y-1 overflow-y-auto pr-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {dayEvents.map((item: CalendarEvent) => (
                    <EventChip
                      key={eventKey(item)}
                      event={item}
                      onClick={() => onSelectEvent(item)}
                      onDragStart={setDraggingId}
                      language={language}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeekView({
  cursor,
  events,
  onSelectEvent,
  onCreate,
  onDropEvent,
  setDraggingId,
  language,
}: R) {
  const start = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const hourHeight = 58

  return (
    <div className="calendar-workspace-scroll max-h-[720px] overflow-auto">
      <div className="min-w-[960px]">
        <div className="sticky top-0 z-20 grid grid-cols-[70px_repeat(7,minmax(120px,1fr))] border-b border-white/10 bg-[#0b111d]">
          <div />

          {days.map((day) => (
            <button
              key={dateKey(day)}
              type="button"
              onClick={() => onCreate(day)}
              className="border-l border-white/[.06] px-2 py-3 text-center hover:bg-white/[.03]"
            >
              <p className="text-[10px] uppercase text-slate-500">
                {day.toLocaleDateString(locale(language), {
                  weekday: "short",
                })}
              </p>

              <b
                className={
                  dateKey(day) === dateKey(new Date())
                    ? "mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-300 text-xs text-slate-950"
                    : "mt-1 inline-flex h-7 w-7 items-center justify-center text-xs text-slate-300"
                }
              >
                {day.getDate()}
              </b>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[70px_repeat(7,minmax(120px,1fr))]">
          <div>
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                style={{ height: hourHeight }}
                className="border-b border-white/[.05] pr-2 text-right text-[10px] text-slate-600"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = events.filter(
              (event: CalendarEvent) =>
                dateKey(new Date(event.start)) === dateKey(day)
            )

            return (
              <div
                key={dateKey(day)}
                className="relative border-l border-white/[.06]"
                style={{ height: hourHeight * 24 }}
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className="border-b border-white/[.05]"
                    style={{ height: hourHeight }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()

                      const id =
                        event.dataTransfer.getData("text/calendar-id")

                      const item = events.find(
                        (x: CalendarEvent) => eventKey(x) === id
                      )

                      if (!item) return

                      const next = new Date(day)
                      next.setHours(hour, 0, 0, 0)

                      onDropEvent(item, next)
                      setDraggingId(null)
                    }}
                    onDoubleClick={() => {
                      const date = new Date(day)
                      date.setHours(hour, 0, 0, 0)
                      onCreate(date)
                    }}
                  />
                ))}

                {dayEvents.map((item: CalendarEvent) => {
                  const start = new Date(item.start)

                  const end = item.end
                    ? new Date(item.end)
                    : new Date(start.getTime() + 60 * 60 * 1000)

                  const top =
                    (start.getHours() + start.getMinutes() / 60) *
                    hourHeight

                  const durationHours = Math.max(
                    0.45,
                    (end.getTime() - start.getTime()) /
                      (60 * 60 * 1000)
                  )

                  const height = Math.max(26, durationHours * hourHeight)

                  return (
                    <button
                      key={eventKey(item)}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "text/calendar-id",
                          eventKey(item)
                        )

                        setDraggingId(eventKey(item))
                      }}
                      onClick={() => onSelectEvent(item)}
                      style={{
                        top,
                        height,
                      }}
                      className={[
                        "absolute left-1 right-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left text-[10px] shadow-lg",
                        CATEGORY_STYLE[item.category],
                      ].join(" ")}
                    >
                      <b className="block truncate">{item.title}</b>

                      <span className="opacity-70">
                        {timeLabel(item.start, language)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DayView({
  cursor,
  events,
  onSelectEvent,
  onCreate,
  onDropEvent,
  setDraggingId,
  language,
}: R) {
  const hourHeight = 64

  const dayEvents = events.filter(
    (event: CalendarEvent) =>
      dateKey(new Date(event.start)) === dateKey(cursor)
  )

  return (
    <div className="calendar-workspace-scroll max-h-[720px] overflow-y-auto">
      <div className="grid min-w-[620px] grid-cols-[80px_1fr]">
        <div>
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              style={{ height: hourHeight }}
              className="border-b border-white/[.05] pr-3 text-right text-[10px] text-slate-600"
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div
          className="relative border-l border-white/[.06]"
          style={{ height: hourHeight * 24 }}
        >
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              style={{ height: hourHeight }}
              className="border-b border-white/[.05] transition hover:bg-white/[.018]"
              onDoubleClick={() => {
                const date = new Date(cursor)
                date.setHours(hour, 0, 0, 0)
                onCreate(date)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()

                const id =
                  event.dataTransfer.getData("text/calendar-id")

                const item = events.find(
                  (x: CalendarEvent) => eventKey(x) === id
                )

                if (!item) return

                const next = new Date(cursor)
                next.setHours(hour, 0, 0, 0)

                onDropEvent(item, next)
                setDraggingId(null)
              }}
            />
          ))}

          {dayEvents.map((item: CalendarEvent) => {
            const start = new Date(item.start)

            const end = item.end
              ? new Date(item.end)
              : new Date(start.getTime() + 60 * 60 * 1000)

            const top =
              (start.getHours() + start.getMinutes() / 60) * hourHeight

            const durationHours = Math.max(
              0.5,
              (end.getTime() - start.getTime()) /
                (60 * 60 * 1000)
            )

            const height = Math.max(30, durationHours * hourHeight)

            return (
              <button
                key={eventKey(item)}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "text/calendar-id",
                    eventKey(item)
                  )

                  setDraggingId(eventKey(item))
                }}
                onClick={() => onSelectEvent(item)}
                style={{ top, height }}
                className={[
                  "absolute left-3 right-3 z-10 overflow-hidden rounded-xl border px-3 py-2 text-left text-xs shadow-xl",
                  CATEGORY_STYLE[item.category],
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <b className="truncate">{item.title}</b>

                  <span className="shrink-0 text-[10px] opacity-70">
                    {timeLabel(item.start, language)}
                  </span>
                </div>

                {item.clientName && (
                  <p className="mt-1 truncate opacity-70">
                    {item.clientName}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function YearView({
  cursor,
  events,
  onOpenMonth,
  language,
}: R) {
  const year = cursor.getFullYear()

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const month = new Date(year, monthIndex, 1)
        const cells = monthGrid(month)

        return (
          <button
            key={monthIndex}
            type="button"
            onClick={() => onOpenMonth(month)}
            className="rounded-2xl border border-white/10 bg-black/15 p-4 text-left transition hover:border-cyan-300/20 hover:bg-cyan-300/[.025]"
          >
            <h3 className="mb-3 font-medium text-slate-200">
              {month.toLocaleDateString(locale(language), {
                month: "long",
              })}
            </h3>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["M", "T", "W", "T", "F", "S", "S"].map(
                (day, index) => (
                  <span
                    key={`${day}-${index}`}
                    className="text-[9px] text-slate-600"
                  >
                    {day}
                  </span>
                )
              )}

              {cells.map((date) => {
                const inside = date.getMonth() === monthIndex

                const eventCount = events.filter(
                  (event: CalendarEvent) =>
                    dateKey(new Date(event.start)) === dateKey(date)
                ).length

                return (
                  <span
                    key={dateKey(date)}
                    className={[
                      "relative flex aspect-square items-center justify-center rounded-md text-[10px]",
                      inside ? "text-slate-400" : "text-slate-800",
                      dateKey(date) === dateKey(new Date())
                        ? "bg-cyan-300/10 text-cyan-200"
                        : "",
                    ].join(" ")}
                  >
                    {date.getDate()}

                    {eventCount > 0 && inside && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-cyan-300" />
                    )}
                  </span>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function AgendaView({
  cursor,
  events,
  onSelectEvent,
  language,
}: R) {
  const sorted = [...events]
    .filter(
      (event: CalendarEvent) =>
        new Date(event.start).getTime() >=
        startOfDay(new Date()).getTime()
    )
    .sort(
      (a: CalendarEvent, b: CalendarEvent) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
    )

  const groups = agendaGroups(sorted)

  return (
    <div className="space-y-6 p-4 md:p-5">
      {groups.map((group) => (
        <section key={group.label}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-300">
              {group.label}
            </h3>

            <div className="h-px flex-1 bg-white/[.06]" />
          </div>

          {group.events.length ? (
            <div className="space-y-2">
              {group.events.map((item) => (
                <button
                  key={eventKey(item)}
                  type="button"
                  onClick={() => onSelectEvent(item)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/15 p-4 text-left transition hover:bg-white/[.04]"
                >
                  <div className="w-14 shrink-0 text-center">
                    <b className="block text-lg text-white">
                      {new Date(item.start).getDate()}
                    </b>

                    <span className="text-[10px] uppercase text-slate-500">
                      {new Date(item.start).toLocaleDateString(
                        locale(language),
                        { month: "short" }
                      )}
                    </span>
                  </div>

                  <span
                    className={`h-9 w-1 rounded-full ${CATEGORY_DOT[item.category]}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b
                        className={
                          item.completed
                            ? "truncate text-sm text-slate-500 line-through"
                            : "truncate text-sm text-slate-200"
                        }
                      >
                        {item.title}
                      </b>

                      <Badge
                        className={[
                          "border text-[9px]",
                          CATEGORY_STYLE[item.category],
                        ].join(" ")}
                      >
                        {CATEGORY_LABEL[item.category]}
                      </Badge>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      {dateTimeLabel(item.start, language)}

                      {item.clientName
                        ? ` · ${item.clientName}`
                        : ""}
                    </p>
                  </div>

                  <ChevronRight
                    size={16}
                    className="shrink-0 text-slate-600"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-xs text-slate-600">
              Nothing scheduled.
            </div>
          )}
        </section>
      ))}

      {!sorted.length && (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="text-center">
            <CalendarDays
              size={36}
              className="mx-auto text-slate-700"
            />

            <p className="mt-3 text-sm text-slate-500">
              No upcoming schedule items.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function EventChip({
  event,
  onClick,
  onDragStart,
  language,
}: {
  event: CalendarEvent
  onClick: () => void
  onDragStart: (id: string | null) => void
  language: string
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(dragEvent) => {
        const id = eventKey(event)

        dragEvent.dataTransfer.setData("text/calendar-id", id)

        onDragStart(id)
      }}
      onDragEnd={() => onDragStart(null)}
      onClick={onClick}
      className={[
        "block w-full rounded-lg border px-2 py-1.5 text-left text-[10px] transition",
        CATEGORY_STYLE[event.category],
        event.completed ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[event.category]}`}
        />

        <b className="truncate">{event.title}</b>
      </div>

      <p className="mt-0.5 truncate opacity-60">
        {timeLabel(event.start, language)}
      </p>
    </button>
  )
}

function EventDrawer({
  event,
  onClose,
  onEdit,
  onDelete,
  onComplete,
  saving,
  language,
}: {
  event: CalendarEvent
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onComplete: () => void
  saving: boolean
  language: string
}) {
  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close event"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <aside className="calendar-workspace-scroll absolute bottom-0 right-0 top-0 w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0b111d] p-5 text-white shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge
              className={[
                "mb-3 border",
                CATEGORY_STYLE[event.category],
              ].join(" ")}
            >
              {CATEGORY_LABEL[event.category]}
            </Badge>

            <h2 className="text-xl font-semibold">{event.title}</h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          <DetailRow
            icon={<Clock3 size={16} />}
            title="Date & time"
            value={
              event.end
                ? `${dateTimeLabel(event.start, language)} – ${timeLabel(
                    event.end,
                    language
                  )}`
                : dateTimeLabel(event.start, language)
            }
          />

          {event.location && (
            <DetailRow
              icon={<MapPin size={16} />}
              title="Location"
              value={event.location}
            />
          )}

          {event.meetingLink && (
            <DetailRow
              icon={<Link2 size={16} />}
              title="Meeting link"
              value={event.meetingLink}
            />
          )}

          {event.clientName && (
            <DetailRow
              title="Client"
              value={event.clientName}
            />
          )}

          {event.leadName && (
            <DetailRow title="Lead" value={event.leadName} />
          )}

          {event.projectName && (
            <DetailRow
              title="Project"
              value={event.projectName}
            />
          )}

          {event.taskName && (
            <DetailRow title="Task" value={event.taskName} />
          )}

          {event.description && (
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">
                Notes
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                {event.description}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Reminder
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {event.reminderMinutes
                ? reminderLabel(event.reminderMinutes)
                : "Default calendar reminder"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Recurrence
            </p>

            <p className="mt-2 text-sm capitalize text-slate-300">
              {event.recurrence && event.recurrence !== "none"
                ? event.recurrence
                : "Does not repeat"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2">
          <Button
            onClick={onEdit}
            disabled={event.source === "crm" && !event.taskId}
          >
            <Pencil size={15} />
            Edit / Reschedule
          </Button>

          <Button
            variant="outline"
            onClick={onComplete}
            className="border-white/10 bg-white/[.03]"
          >
            <Check size={15} />
            {event.completed ? "Completed" : "Mark complete"}
          </Button>

          {event.link && (
            <Button
              variant="outline"
              asChild
              className="border-white/10 bg-white/[.03]"
            >
              <a
                href={event.link}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} />
                Open in Google Calendar
              </a>
            </Button>
          )}

          {event.source === "google" && (
            <Button
              variant="outline"
              disabled={saving}
              onClick={onDelete}
              className="border-rose-300/20 bg-rose-300/[.05] text-rose-200 hover:bg-rose-300/10"
            >
              <Trash2 size={15} />
              Delete event
            </Button>
          )}
        </div>
      </aside>
    </div>
  )
}

function DetailRow({
  icon,
  title,
  value,
}: {
  icon?: React.ReactNode
  title: string
  value: string
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      {icon && <span className="mt-0.5 text-cyan-300">{icon}</span>}

      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">
          {title}
        </p>

        <p className="mt-1 break-words text-sm text-slate-300">
          {value}
        </p>
      </div>
    </div>
  )
}

function EventEditor({
  value,
  clients,
  leads,
  projects,
  tasks,
  saving,
  onClose,
  onSubmit,
}: {
  value: Partial<CalendarEvent>
  clients: R[]
  leads: R[]
  projects: R[]
  tasks: R[]
  saving: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        aria-label="Close editor"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <Card className="calendar-workspace-scroll relative z-10 max-h-[94vh] w-full max-w-3xl overflow-y-auto border-white/10 bg-[#0b111d] p-5 text-white shadow-2xl shadow-black md:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300/70">
              Orbit Calendar
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              {value.id ? "Edit event" : "New event"}
            </h2>
          </div>

          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={value.id || ""} />

          <Field label="Title" wide>
            <input
              name="title"
              required
              defaultValue={value.title || ""}
              placeholder="Client Strategy Meeting"
              className={inputClass}
            />
          </Field>

          <Field label="Start">
            <input
              name="start"
              type="datetime-local"
              required
              defaultValue={String(value.start || "")}
              className={inputClass}
            />
          </Field>

          <Field label="End">
            <input
              name="end"
              type="datetime-local"
              defaultValue={String(value.end || "")}
              className={inputClass}
            />
          </Field>

          <Field label="Category">
            <select
              name="category"
              defaultValue={value.category || "meeting"}
              className={inputClass}
            >
              <option value="meeting">Meeting</option>
              <option value="client">Client</option>
              <option value="project">Project</option>
              <option value="task">Task</option>
              <option value="followup">Follow-up</option>
              <option value="payment">Payment</option>
              <option value="google">Personal / Google Calendar</option>
            </select>
          </Field>

          <Field label="Reminder">
            <select
              name="reminderMinutes"
              defaultValue={String(value.reminderMinutes ?? 30)}
              className={inputClass}
            >
              <option value="0">No reminder</option>
              <option value="10">10 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </Field>

          <Field label="Repeat">
            <select
              name="recurrence"
              defaultValue={value.recurrence || "none"}
              className={inputClass}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Every month</option>
              <option value="yearly">Every year</option>
            </select>
          </Field>

          <Field label="Client">
            <select
              name="clientId"
              defaultValue={value.clientId || ""}
              className={inputClass}
            >
              <option value="">No client</option>

              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name ||
                    client.company_name ||
                    "Unnamed client"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Lead">
            <select
              name="leadId"
              defaultValue={value.leadId || ""}
              className={inputClass}
            >
              <option value="">No lead</option>

              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.contact_name ||
                    lead.company ||
                    "Unnamed lead"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Project">
            <select
              name="projectId"
              defaultValue={value.projectId || ""}
              className={inputClass}
            >
              <option value="">No project</option>

              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || "Unnamed project"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Task">
            <select
              name="taskId"
              defaultValue={value.taskId || ""}
              className={inputClass}
            >
              <option value="">No task</option>

              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title || "Untitled task"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location" wide>
            <input
              name="location"
              defaultValue={value.location || ""}
              placeholder="Office, Zoom, client address..."
              className={inputClass}
            />
          </Field>

          <Field label="Google Meet / Meeting link" wide>
            <input
              name="meetingLink"
              type="url"
              defaultValue={value.meetingLink || ""}
              placeholder="https://meet.google.com/..."
              className={inputClass}
            />
          </Field>

          <Field label="Description / Notes" wide>
            <textarea
              name="description"
              defaultValue={value.description || ""}
              placeholder="Meeting notes, preparation, objectives..."
              className={`${inputClass} min-h-28 py-3`}
            />
          </Field>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-white/[.03]"
            >
              Cancel
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <CalendarDays size={15} />
              )}

              {value.id ? "Save changes" : "Create event"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function Field({
  label,
  children,
  wide,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <label
      className={`text-xs text-slate-400 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      {label}

      <div className="mt-1.5">{children}</div>
    </label>
  )
}

const inputClass =
  "h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-300/20"

function buildCrmEvents({
  tasks,
  leads,
  clients,
  projects,
  payments,
}: {
  tasks: R[]
  leads: R[]
  clients: R[]
  projects: R[]
  payments: R[]
}) {
  const rows: CalendarEvent[] = []

  for (const task of tasks) {
    const date = task.due_date

    if (!validDate(date)) continue
    if (String(task.status || "").toLowerCase() === "done") continue

    const followup =
      String(task.kind || "")
        .toLowerCase()
        .includes("follow") ||
      String(task.title || "")
        .toLowerCase()
        .includes("follow")

    rows.push({
      id: `task:${task.id}`,
      title: task.title || "Task",
      start: normalizeDate(date, 9),
      description: task.notes || "",
      category: followup ? "followup" : "task",
      source: "crm",
      taskId: String(task.id),
      taskName: task.title,
      clientId: task.billing_client_id
        ? String(task.billing_client_id)
        : undefined,
      completed: false,
      raw: task,
    })
  }

  for (const lead of leads) {
    const date =
      lead.follow_up_date ||
      lead.next_follow_up_date ||
      lead.next_follow_up

    if (!validDate(date)) continue

    rows.push({
      id: `lead:${lead.id}`,
      title: `Follow-up · ${
        lead.contact_name || lead.company || "Lead"
      }`,
      start: normalizeDate(date, 10),
      description: lead.notes || lead.description || "",
      category: "followup",
      source: "crm",
      leadId: String(lead.id),
      leadName: lead.contact_name || lead.company,
      raw: lead,
    })
  }

  for (const client of clients) {
    const date =
      client.next_call_date ||
      client.follow_up_date ||
      client.renewal_date

    if (!validDate(date)) continue

    rows.push({
      id: `client:${client.id}`,
      title: client.renewal_date
        ? `Renewal · ${client.name || client.company_name || "Client"}`
        : `Client call · ${
            client.name || client.company_name || "Client"
          }`,
      start: normalizeDate(date, 10),
      description: client.notes || client.description || "",
      category: "client",
      source: "crm",
      clientId: String(client.id),
      clientName: client.name || client.company_name,
      raw: client,
    })
  }

  for (const project of projects) {
    const date =
      project.due_date ||
      project.deadline ||
      project.end_date ||
      project.delivery_date

    if (!validDate(date)) continue

    rows.push({
      id: `project:${project.id}`,
      title: `Project deadline · ${project.name || "Project"}`,
      start: normalizeDate(date, 17),
      description: project.notes || project.description || "",
      category: "project",
      source: "crm",
      projectId: String(project.id),
      projectName: project.name,
      clientName: project.client,
      raw: project,
    })
  }

  for (const payment of payments) {
    const date =
      payment.due_date ||
      payment.payment_due_date ||
      payment.invoice_due_date

    if (!validDate(date)) continue

    rows.push({
      id: `payment:${payment.id}`,
      title:
        payment.title ||
        payment.invoice_number ||
        "Payment due",
      start: normalizeDate(date, 9),
      description: payment.notes || "",
      category: "payment",
      source: "crm",
      projectId: payment.project_id
        ? String(payment.project_id)
        : undefined,
      clientId: payment.client_id
        ? String(payment.client_id)
        : undefined,
      raw: payment,
    })
  }

  return rows
}

function getRange(view: ViewMode, cursor: Date) {
  if (view === "day") {
    const from = startOfDay(cursor)
    const to = addDays(from, 1)

    return { from, to }
  }

  if (view === "week") {
    const from = startOfWeek(cursor)
    const to = addDays(from, 7)

    return { from, to }
  }

  if (view === "year") {
    const from = new Date(cursor.getFullYear(), 0, 1)
    const to = new Date(cursor.getFullYear() + 1, 0, 1)

    return { from, to }
  }

  if (view === "agenda") {
    const from = startOfDay(new Date())
    const to = addDays(from, 365)

    return { from, to }
  }

  const cells = monthGrid(cursor)

  return {
    from: startOfDay(cells[0]),
    to: addDays(startOfDay(cells[cells.length - 1]), 1),
  }
}

function monthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstDay = first.getDay()
  const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay
  const gridStart = addDays(first, mondayOffset)

  return Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index)
  )
}

function startOfWeek(date: Date) {
  const value = startOfDay(date)
  const day = value.getDay()
  const difference = day === 0 ? -6 : 1 - day

  value.setDate(value.getDate() + difference)

  return value
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)

  return value
}

function addDays(date: Date, amount: number) {
  const value = new Date(date)
  value.setDate(value.getDate() + amount)

  return value
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function eventKey(event: CalendarEvent) {
  return `${event.source}:${event.id}`
}

function normalizeDate(value: any, hour = 9) {
  const raw = String(value || "")

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T${String(hour).padStart(2, "0")}:00:00`
  }

  const parsed = new Date(raw)

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString()
}

function validDate(value: any) {
  if (!value) return false

  const parsed = new Date(value)

  return !Number.isNaN(parsed.getTime())
}

function periodTitle(
  view: ViewMode,
  cursor: Date,
  language: string
) {
  if (view === "year") {
    return String(cursor.getFullYear())
  }

  if (view === "day") {
    return cursor.toLocaleDateString(locale(language), {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  if (view === "week") {
    const start = startOfWeek(cursor)
    const end = addDays(start, 6)

    return `${start.toLocaleDateString(locale(language), {
      month: "short",
      day: "numeric",
    })} – ${end.toLocaleDateString(locale(language), {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`
  }

  if (view === "agenda") {
    return "Schedule"
  }

  return cursor.toLocaleDateString(locale(language), {
    month: "long",
    year: "numeric",
  })
}

function weekDayNames(language: string) {
  const monday = new Date(2026, 7, 3)

  return Array.from({ length: 7 }, (_, index) =>
    addDays(monday, index).toLocaleDateString(locale(language), {
      weekday: "short",
    })
  )
}

function timeLabel(value: string, language: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleTimeString(locale(language), {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function dateTimeLabel(value: string, language: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleString(locale(language), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toLocalDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)

  return local.toISOString().slice(0, 16)
}

function reminderLabel(minutes: number) {
  if (minutes === 1440) return "1 day before"
  if (minutes === 60) return "1 hour before"

  return `${minutes} minutes before`
}

function agendaGroups(events: CalendarEvent[]) {
  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)
  const afterTomorrow = addDays(today, 2)
  const endWeek = addDays(today, 7)

  return [
    {
      label: "Today",
      events: events.filter(
        (event) =>
          dateKey(new Date(event.start)) === dateKey(today)
      ),
    },
    {
      label: "Tomorrow",
      events: events.filter(
        (event) =>
          dateKey(new Date(event.start)) === dateKey(tomorrow)
      ),
    },
    {
      label: "This week",
      events: events.filter((event) => {
        const value = new Date(event.start)

        return value >= afterTomorrow && value < endWeek
      }),
    },
    {
      label: "Later",
      events: events.filter(
        (event) => new Date(event.start) >= endWeek
      ),
    },
  ]
}

function parseQuickAdd(text: string) {
  const raw = text.trim()

  if (!raw) return null

  const lower = raw.toLowerCase()
  const now = new Date()

  let date = startOfDay(now)

  if (lower.includes("tomorrow")) {
    date = addDays(date, 1)
  }

  const timeMatch = raw.match(
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
  )

  let hour = 9
  let minute = 0

  if (timeMatch) {
    hour = Number(timeMatch[1])
    minute = Number(timeMatch[2] || 0)

    const meridian = String(timeMatch[3] || "").toLowerCase()

    if (meridian === "pm" && hour < 12) hour += 12
    if (meridian === "am" && hour === 12) hour = 0
  }

  date.setHours(hour, minute, 0, 0)

  const end = new Date(date.getTime() + 60 * 60 * 1000)

  const title =
    raw
      .replace(/\btomorrow\b/gi, "")
      .replace(/\btoday\b/gi, "")
      .replace(
        /\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi,
        ""
      )
      .replace(/\s+/g, " ")
      .trim() || "New event"

  return {
    title,
    start: date,
    end,
  }
}

function locale(language: string) {
  return (
    ({
      pt: "pt-BR",
      es: "es-ES",
      de: "de-DE",
      fr: "fr-FR",
      it: "it-IT",
      nl: "nl-NL",
      ja: "ja-JP",
      ko: "ko-KR",
    } as R)[language] || "en-US"
  )
}