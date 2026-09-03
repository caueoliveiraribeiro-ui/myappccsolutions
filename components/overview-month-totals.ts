import {isPaymentReceived,awaitingPaymentRows} from "./payment-status"
type Row=Record<string,any>
export function calendarMonth(date=new Date()){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`
}
export function yearlyReceivedTotal(payments:Row[],convert:(amount:unknown,row:Row)=>number,month=calendarMonth()){
 const [year,number]=month.split("-").map(Number)
 const start=calendarMonth(new Date(year,number-12,1))
 return payments.filter(row=>{const date=String(row.received_at||row.created_at||"").slice(0,7);return isPaymentReceived(row)&&date>=start&&date<=month}).reduce((total,row)=>total+convert(row.amount,row),0)
}
export function overviewMonthTotals({leads=[],projects=[],payments=[],groceries=[],expenses=[]}:Record<string,Row[]>,convert:(amount:unknown,row:Row)=>number,month=calendarMonth()){
  const same=(date:unknown)=>String(date||"").slice(0,7)===month
  const active=leads.filter(row=>!row.archived&&!["Client","Won","Lost"].includes(row.status)&&same(row.created_at))
  const waiting=awaitingPaymentRows(projects,payments).filter(row=>same(row.date))
  const received=payments.filter(row=>isPaymentReceived(row)&&same(row.received_at||row.created_at))
  return {
    pipeline:active.reduce((sum,row)=>sum+convert(row.estimated_value,row),0),
    awaiting:waiting.reduce((sum,row)=>sum+convert(row.amount,row),0),
    payments:received.reduce((sum,row)=>sum+convert(row.amount,row),0),
    groceries:groceries.filter(row=>same(row.month||row.created_at)).reduce((sum,row)=>sum+convert(row.actual_cost||row.estimated_cost||0,row),0),
    expenses:expenses.filter(row=>same(row.expense_date||row.created_at)).reduce((sum,row)=>sum+convert(row.amount,row),0),
    waitingCount:waiting.length,paymentCount:received.length,leadCount:active.length,
  }
}

