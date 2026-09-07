import { NextResponse } from "next/server"
import {
  GET as baseGET,
  POST as basePOST,
  PATCH as basePATCH,
  DELETE as baseDELETE,
} from "../[resource]/route"

const context = () => ({ params: Promise.resolve({ resource: "projects" }) })

export async function GET(request: Request) {
  const response = await baseGET(request, context())
  if (!response.ok) return response
  const data = await response.json()
  return NextResponse.json({
    ...data,
    items: (data.items || []).filter((item: Record<string, any>) => !item.archived),
  })
}

export async function POST(request: Request) {
  return basePOST(request, context())
}

export async function PATCH(request: Request) {
  return basePATCH(request, context())
}

export async function DELETE(request: Request) {
  return baseDELETE(request, context())
}
