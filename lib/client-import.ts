export type ClientImportRow={name:string;email:string;phone:string}
export function parseClientCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false
 text=text.replace(/^\uFEFF/,"")
 for(let i=0;i<text.length;i++){
  const c=text[i]
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted
  }else if(c===","&&!quoted){row.push(cell);cell=""}
  else if((c==="\n"||c==="\r")&&!quoted){row.push(cell);rows.push(row);row=[];cell="";if(c==="\r"&&text[i+1]==="\n")i++}
  else cell+=c
 }
 if(quoted)throw Error("The CSV has an unfinished quoted field. Download it again from Google Sheets.")
 if(cell||row.length){row.push(cell);rows.push(row)}
 return parseClientRows(rows)
}
export function validateClientImport(row:ClientImportRow){
 return !!row.name.trim()&&row.name.length<=200&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)&&row.email.length<=254&&!!row.phone.trim()&&row.phone.length<=80
}
export function parseClientRows(rows:unknown[][]){
 if(rows.length>501)throw Error("Import up to 500 clients at a time.")
 const normalize=(value:unknown)=>String(value??"").trim().toLowerCase().replace(/[\s_-]/g,"")
 const headers=(rows[0]||[]).map(normalize)
 const find=(names:string[])=>headers.findIndex(header=>names.includes(header))
 const indexes=[find(["name","nome","clientname"]),find(["email","emailaddress"]),find(["phone","telefone","celular","phonenumber"])]
 if(indexes.some(index=>index<0))throw Error("The first row must contain Name, Email and Phone columns.")
 const clients:ClientImportRow[]=[],issues:string[]=[],seen=new Set<string>()
 rows.slice(1).forEach((row,index)=>{
   if(!row.some(cell=>cell!==null&&cell!==undefined&&String(cell).trim()))return
   const client={name:String(row[indexes[0]]??"").trim(),email:String(row[indexes[1]]??"").trim().toLowerCase(),phone:String(row[indexes[2]]??"").trim()}
   if(!validateClientImport(client)){issues.push(`Row ${index+2}: check Name, Email and Phone.`);return}
   if(seen.has(client.email)){issues.push(`Row ${index+2}: duplicate email skipped.`);return}
   seen.add(client.email);clients.push(client)
 })
 return {clients,issues}
}

