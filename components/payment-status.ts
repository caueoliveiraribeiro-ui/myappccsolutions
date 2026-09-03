type Row=Record<string,any>
export const paymentStatuses=["Awaiting payment","Payment received","Cancelled"] as const
export function isPaymentReceived(row:Row){return !row.status||row.status==="Payment received"}
export function awaitingPaymentRows(projects:Row[],payments:Row[]):Row[]{
  const linked=new Set(payments.filter(row=>row.source_project_id).map(row=>row.source_project_id))
  return [
    ...projects.filter(row=>row.stage==="Awaiting payment"&&!linked.has(row.id)).map(row=>({...row,amount:Number(row.budget||0)-Number(row.cost||0),date:row.payment_date||row.deadline||row.created_at})),
    ...payments.filter(row=>row.status==="Awaiting payment").map(row=>({...row,date:row.received_at||row.created_at}))
  ]
}

