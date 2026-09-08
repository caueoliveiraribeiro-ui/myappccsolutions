export type FoodEntry = { id: string; category: string; food_name: string; grams: number; calories: number; consumed_at: string }

export function foodTimestamp(day: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  // Noon keeps a historical meal on its selected local day across DST changes.
  const date = new Date(`${day}T12:00:00`)
  if (foodDayKey(date) !== day || day > foodDayKey(now)) return null
  return day === foodDayKey(now) ? now.toISOString() : date.toISOString()
}

// Use the user's local calendar day, not the UTC date in the stored timestamp.
export function foodDayKey(value: string | Date): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "unknown"
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function groupFoodHistory(entries: FoodEntry[]) {
  const groups = new Map<string, { day: string; calories: number; grams: number; entries: FoodEntry[] }>()
  for (const entry of entries) {
    const day = foodDayKey(entry.consumed_at)
    const group = groups.get(day) ?? { day, calories: 0, grams: 0, entries: [] }
    group.calories += Number(entry.calories) || 0
    group.grams += Number(entry.grams) || 0
    group.entries.push(entry)
    groups.set(day, group)
  }
  return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day)).map(group => ({
    ...group,
    entries: [...group.entries].sort((a, b) => new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime()),
  }))
}
