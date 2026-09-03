export const planFeatures = {
  personal: ["overview","stocks","expenses","groceries","calendar","projects","invitations","focus"],
  small_business: ["overview","stocks","expenses","groceries","calendar","projects","invitations","focus","crypto","history","clients","leads","reports","pipeline"],
  big_business: ["overview","stocks","expenses","groceries","calendar","projects","invitations","focus","crypto","history","clients","leads","reports","tasks","pipeline"],
} as const
export type Plan = keyof typeof planFeatures | "owner" | "none"
export function limitsFor(plan: Plan) {
  if (plan === "owner") return {activeLeads:null,archivedLeads:null,clients:null}
  if (plan === "big_business") return {activeLeads:300,archivedLeads:100,clients:100}
  if (plan === "small_business") return {activeLeads:100,archivedLeads:50,clients:50}
  return {activeLeads:0,archivedLeads:0,clients:0}
}
export const allFeatures = [...planFeatures.big_business]
export const pageFeatures: Record<string,string> = {"Overview":"overview","Leads Management":"leads","Clients":"clients","Pipeline":"pipeline","Projects":"projects","Tasks & Follow-ups":"tasks","Calendar":"calendar","Groceries":"groceries","Expenses":"expenses","Stocks":"stocks","Crypto":"crypto","History":"history","Reports":"reports","Invite & sharing":"invitations"}
export function featuresFor(plan:Plan): readonly string[] { return plan==="owner"?allFeatures:plan==="none"?[]:planFeatures[plan] }
export function featureForResource(resource:string,row:Record<string,any>={}) {
  if(["holdings","assets","portfolios"].includes(resource)) return String(row.asset_type||row.portfolio_type||"Stock").toLowerCase()==="crypto"?"crypto":"stocks"
  if(resource==="tasks") return row.kind==="Focus"?"focus":"tasks"
  return ({leads:"leads",activities:"leads",clients:"clients",projects:"projects",expenses:"expenses",grocery_items:"groceries",payment_records:"reports"} as Record<string,string>)[resource]
}
