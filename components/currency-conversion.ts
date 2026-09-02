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

export function useHoldingQuotes(holdings: Row[], targetCurrency: string, country = "US") {
  const [quotes, setQuotes] = useState<Record<string, number>>({})
  const key = [...new Set(holdings.map(row => `${row.asset_type}:${String(row.symbol || "").toUpperCase()}`).filter(value => !value.endsWith(":")))].sort().join(",")

  useEffect(() => {
    const assets = key ? key.split(",") : []
    if (!assets.length) {
      setQuotes({})
      return
    }
    Promise.all(assets.map(async asset => {
      const [assetType, symbol] = asset.split(":")
      try {
        const response = await fetch(`/api/market-price?type=${assetType.toLowerCase()}&symbol=${encodeURIComponent(symbol)}&currency=${encodeURIComponent(targetCurrency)}&country=${encodeURIComponent(country)}`)
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !Number.isFinite(Number(data.price))) throw new Error()
        return [asset, Number(data.price)] as const
      } catch {
        return [asset, Number.NaN] as const
      }
    })).then(entries => setQuotes(Object.fromEntries(entries)))
  }, [key, targetCurrency, country])

  return quotes
}

export function holdingMarketTotal(
  holdings: Row[],
  quotes: Record<string, number>,
  convert: (amount: unknown, row: Row) => number,
) {
  const assets = new Map<string, { quantity: number; fallback: Row }>()

  for (const holding of holdings) {
    const key = `${holding.asset_type}:${String(holding.symbol || "").toUpperCase()}`
    const quantity = Number(holding.remaining_quantity ?? holding.quantity ?? 0)
    if (!key.endsWith(":") && quantity > 0) {
      const existing = assets.get(key)
      const currentDate = String(holding.updated_at || holding.created_at || holding.purchased_at || "")
      const fallbackDate = String(existing?.fallback?.updated_at || existing?.fallback?.created_at || existing?.fallback?.purchased_at || "")
      assets.set(key, {
        quantity: Number(existing?.quantity || 0) + quantity,
        fallback: !existing || currentDate >= fallbackDate ? holding : existing.fallback,
      })
    }
  }

  return [...assets.entries()].reduce((total, [key, asset]) => {
    const livePrice = quotes[key]
    const currentPrice = Number.isFinite(livePrice)
      ? livePrice
      : convert(asset.fallback.current_price, asset.fallback)
    return total + asset.quantity * Number(currentPrice || 0)
  }, 0)
}

