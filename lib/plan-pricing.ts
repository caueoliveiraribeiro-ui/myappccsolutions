// Public marketing prices only. This does not grant or restrict account access.
export const planCurrencies = ["USD","BRL","EUR","GBP","CAD","AUD","JPY","KRW","MXN","CHF"] as const
export type PlanCurrency = typeof planCurrencies[number]
export const countryCurrency: Record<string, PlanCurrency> = {
  US:"USD",BR:"BRL",GB:"GBP",DE:"EUR",FR:"EUR",ES:"EUR",IT:"EUR",PT:"EUR",
  CA:"CAD",AU:"AUD",JP:"JPY",KR:"KRW",MX:"MXN",NL:"EUR",CH:"CHF",
}
export function isPlanCurrency(value: string): value is PlanCurrency {
  return (planCurrencies as readonly string[]).includes(value)
}
export function priceInCurrency(usd: number, rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid exchange rate")
  return usd * rate
}
