// Public identifiers only. Never use browser-supplied plan names as entitlements.
export const paddleOffers = {
  personal: {name:"Personal",priceId:"pri_01m1k78k8ch7vb99p81x4fms3y",monthlyUsd:29.99},
  small_business: {name:"Small Business",priceId:"pri_01m1k79h2fwkwvpdnkk8vj1wsn",monthlyUsd:99.99},
  big_business: {name:"Big Business",priceId:"pri_01m1k7abwhe5wvzqeax5hqj3ej",monthlyUsd:189.99},
  business_customization: {name:"Business Customization",priceId:"pri_01m1k7b93xzr810gk1jv1wc3g1"},
  invite_friend: {name:"Invite Friend",priceId:"pri_01m1kbfnsgsz1z9jmv2kxg0vkc",monthlyUsd:12.99},
} as const
export type StandardPlan = "personal"|"small_business"|"big_business"
export function isStandardPlan(value:unknown):value is StandardPlan {
  return value==="personal"||value==="small_business"||value==="big_business"
}
export function planForPrice(id:string):StandardPlan|null {
  for(const plan of ["personal","small_business","big_business"] as const)
    if(paddleOffers[plan].priceId===id)return plan
  return null
}
