import {requestFeature} from "@/lib/plan-access"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySession } from "@/lib/auth"

import {alphaMarketData,MarketProviderError} from "@/lib/alpha-market-data"
import {unstable_cache} from "next/cache"

type Quote = {
  asOf?: string
  symbol: string
  name: string
  price: number
  change24h: number
  currency: string
  source: string
  originalPrice?: number
  originalCurrency?: string
  exchangeRate?: number
}

const quotes = new Map<string, { until: number; data: Quote }>()
const allowed = new Set(["USD", "BRL", "EUR", "GBP", "CAD", "AUD", "JPY", "KRW", "MXN", "CHF"])

async function authorized() {
  const token = (await cookies()).get("orbit_session")?.value
  return Boolean(token && await verifySession(token))
}

async function convert(price: number, from: string, to: string) {
  if (from === to) return { price, rate: 1 }
  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}`, { next: { revalidate: 21600 } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Number.isFinite(Number(data.rate))) throw Error("Currency conversion is temporarily unavailable. Please try again shortly.")
  return { price: price * Number(data.rate), rate: Number(data.rate) }
}

function stockCurrency(symbol: string) {
  const suffixes: Record<string, string> = {
    ".SAO": "BRL", ".SA": "BRL", ".LON": "GBP", ".L": "GBP", ".TRT": "CAD",
    ".TOR": "CAD", ".TO": "CAD", ".AUS": "AUD", ".AX": "AUD", ".TYO": "JPY",
    ".T": "JPY", ".KSC": "KRW", ".KS": "KRW", ".MEX": "MXN", ".MX": "MXN",
    ".SWX": "CHF", ".SW": "CHF", ".DEX": "EUR", ".DE": "EUR", ".FRA": "EUR",
    ".F": "EUR", ".PAR": "EUR", ".PA": "EUR", ".AMS": "EUR", ".AS": "EUR",
    ".MIL": "EUR", ".MI": "EUR", ".LIS": "EUR", ".LS": "EUR", ".MAD": "EUR", ".MC": "EUR",
  }
  return Object.entries(suffixes).find(([suffix]) => symbol.endsWith(suffix))?.[1] || "USD"
}

function yahooSymbol(symbol: string) {
  const suffixes: Record<string, string> = {
    ".SAO": ".SA", ".LON": ".L", ".TRT": ".TO", ".TOR": ".TO", ".AUS": ".AX",
    ".TYO": ".T", ".KSC": ".KS", ".MEX": ".MX", ".SWX": ".SW", ".DEX": ".DE",
    ".FRA": ".F", ".PAR": ".PA", ".AMS": ".AS", ".MIL": ".MI", ".LIS": ".LS", ".MAD": ".MC",
  }
  const match = Object.entries(suffixes).find(([from]) => symbol.endsWith(from))
  return match ? symbol.slice(0, -match[0].length) + match[1] : symbol
}

async function yahooStock(symbol: string): Promise<Quote> {
  const lookup = yahooSymbol(symbol)
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(lookup)}?interval=1d&range=5d`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 Orbit-LM/1.0", Accept: "application/json" },
  })
  const data = await response.json().catch(() => ({}))
  const result = data?.chart?.result?.[0]
  const meta = result?.meta
  const price = Number(meta?.regularMarketPrice)
  if (!response.ok || !Number.isFinite(price) || price <= 0) throw Error("Ticker not found")
  const previous = Number(meta?.chartPreviousClose || meta?.previousClose || price)
  const change24h = previous ? ((price - previous) / previous) * 100 : 0
  return {
    symbol,
    name: meta?.longName || meta?.shortName || symbol,
    price,
    change24h,
    currency: String(meta?.currency || stockCurrency(symbol)).toUpperCase(),
    source: "Yahoo Finance",
  }
}

async function alphaStock(symbol: string): Promise<Quote> {
  const key = process.env.ALPHA_VANTAGE_API_KEY
  if (!key) throw Error("Live stock prices are not connected.")
  const data = await alphaMarketData("GLOBAL_QUOTE",symbol)
  const quote = data["Global Quote"]
  return {
    symbol,
    name: symbol,
    asOf: data.fetchedAt,
    price: Number(quote["05. price"]),
    change24h: Number(String(quote["10. change percent"] || "0").replace("%", "")),
    currency: stockCurrency(symbol),
    source: "Alpha Vantage",
  }
}

async function cryptoQuote(symbol: string): Promise<Quote> {
  const common: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche-2", LINK: "chainlink", DOT: "polkadot", MATIC: "matic-network", BNB: "binancecoin" }
  const id = common[symbol] || symbol.toLowerCase()
  const headers: Record<string, string> = {}
  if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`, { headers, cache: "no-store" })
  const data = await response.json()
  if (!data[id]?.usd) throw Error("Crypto not found. You can still record any symbol manually by entering its purchase price.")
  return { symbol, name: id, price: Number(data[id].usd), change24h: Number(data[id].usd_24h_change || 0), currency: "USD", source: "CoinGecko" }
}

const cachedYahooStock=unstable_cache(yahooStock,["orbit-yahoo-stock-v1"],{revalidate:900})
const stockPending=new Map<string,Promise<Quote>>()
async function sharedYahooStock(symbol:string){const existing=stockPending.get(symbol);if(existing)return existing;const pending=cachedYahooStock(symbol).finally(()=>stockPending.delete(symbol));stockPending.set(symbol,pending);return pending}

export async function GET(request: Request) {const planDenied=await requestFeature(new URL(request.url).searchParams.get("type")==="crypto"?"crypto":"stocks");if(planDenied)return planDenied;
  if (!await authorized()) return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 })
  const url = new URL(request.url)
  const type = url.searchParams.get("type")
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase()
  const currency = (url.searchParams.get("currency") || "USD").toUpperCase()

  if (!symbol || !["stock", "crypto"].includes(type || "")) return NextResponse.json({ error: "Enter a stock or crypto symbol." }, { status: 400 })
  if (!allowed.has(currency)) return NextResponse.json({ error: "Choose a supported currency in Settings." }, { status: 400 })

  const cacheKey = `${type}:${symbol}:${currency}`
  const cached = quotes.get(cacheKey)
  if (cached && cached.until > Date.now()) return NextResponse.json(cached.data)

  try {
    let base: Quote
    if (type === "stock") {
      try {
        base = await sharedYahooStock(symbol)
      } catch {
        try {
          base = await alphaStock(symbol)
        } catch (error) {
          if(error instanceof MarketProviderError) throw error
          return NextResponse.json({ error: "We could not find this stock, ETF or fund right now. Check the ticker and market suffix, or enter the purchase price manually." }, { status: 404 })
        }
      }
    } else {
      base = await cryptoQuote(symbol)
    }

    const fx = await convert(base.price, base.currency, currency)
    const result = { ...base, originalPrice: base.price, originalCurrency: base.currency, price: fx.price, currency, exchangeRate: fx.rate }
    quotes.set(cacheKey, { until: Date.now() + (type === "stock" ? 300000 : 60000), data: result })
    return NextResponse.json(result)
  } catch (error) {
    if(error instanceof MarketProviderError)return NextResponse.json({error:error.message},{status:error.status,headers:error.retryAfter?{"Retry-After":String(error.retryAfter)}:undefined})
    return NextResponse.json({ error: error instanceof Error ? error.message : "We could not load the price right now." }, { status: 502 })
  }
}
