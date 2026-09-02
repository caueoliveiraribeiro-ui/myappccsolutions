"use client"

import { useEffect, useState } from "react"

type Row = Record<string, any>

export function recordCurrency(row: Row, fallback: string) {
  return String(row.quote_currency || row.currency || fallback).toUpperCase()
}

const rateCache: Record<string, Record<string, number>> = {}
export function useCurrencyRates(rows: Row[], targetCurrency: string) {
  const target = targetCurrency.toUpperCase()
  const [state, setState] = useState<{target:string; rates:Record<string,number>}>({target, rates:rateCache[target] || {}})
  const sourceKey = [...new Set(rows.map(row => recordCurrency(row, target)).filter(source => source !== target))].sort().join(",")
  useEffect(() => {
    let cancelled = false
    const sources = sourceKey ? sourceKey.split(",") : []
    Promise.all(sources.map(async source => {
      try {
        const response = await fetch(`/api/fx?from=${encodeURIComponent(source)}&to=${encodeURIComponent(target)}`)
        const data = await response.json()
        const rate = Number(data.rate)
        if (!response.ok || !Number.isFinite(rate) || rate <= 0) throw Error("Invalid exchange rate")
        return [source, rate] as const
      } catch {
        return [source, rateCache[target]?.[source] ?? Number.NaN] as const
      }
    })).then(entries => {
      if (cancelled) return
      const rates = {...rateCache[target], ...Object.fromEntries(entries)}
      rateCache[target] = rates
      setState({target, rates})
    })
    return () => { cancelled = true }
  }, [sourceKey, target])
  return (amount: unknown, row: Row) => {
    const value = Number(amount || 0)
    if (value === 0) return 0
    const source = recordCurrency(row, target)
    const rate = source === target ? 1 : (state.target === target ? state.rates[source] : rateCache[target]?.[source])
    return Number.isFinite(rate) ? value * Number(rate) : Number.NaN
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
  return holdings.reduce((total, holding) => {
    const key = `${holding.asset_type}:${String(holding.symbol || "").toUpperCase()}`
    const quantity = Number(holding.remaining_quantity ?? holding.quantity ?? 0)
    if (key.endsWith(":") || quantity <= 0) return total

    const livePrice = quotes[key]
    const convertedPrice = Number.isFinite(livePrice)
      ? livePrice
      : convert(holding.current_price, holding)

    return total + quantity * Number(convertedPrice || 0)
  }, 0)
}
