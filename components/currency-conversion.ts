"use client"

import { useEffect, useState } from "react"

type Row = Record<string, any>

export function recordCurrency(row: Row, fallback: string) {
  return String(row.quote_currency || row.currency || fallback).toUpperCase()
}

export function useCurrencyRates(rows: Row[], targetCurrency: string) {
  const [rates, setRates] = useState<Record<string, number>>({})
  const sourceKey = [...new Set(rows.map(row => recordCurrency(row, targetCurrency)).filter(source => source !== targetCurrency))].sort().join(",")

  useEffect(() => {
    const sources = sourceKey ? sourceKey.split(",") : []
    if (!sources.length) {
      setRates({})
      return
    }

    Promise.all(sources.map(async source => {
      try {
        const response = await fetch(`/api/fx?from=${encodeURIComponent(source)}&to=${encodeURIComponent(targetCurrency)}`)
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !Number.isFinite(Number(data.rate))) throw new Error()
        return [source, Number(data.rate)] as const
      } catch {
        return [source, 1] as const
      }
    })).then(entries => setRates(Object.fromEntries(entries)))
  }, [sourceKey, targetCurrency])

  return (amount: unknown, row: Row) => {
    const source = recordCurrency(row, targetCurrency)
    return Number(amount || 0) * (source === targetCurrency ? 1 : rates[source] || 1)
  }
}

