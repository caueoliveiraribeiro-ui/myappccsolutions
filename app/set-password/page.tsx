import { SetPasswordForm } from "@/components/set-password-form"

export const dynamic = "force-dynamic"

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token || ""

  const validToken = /^[a-f0-9]{64}$/.test(token)

  return (
    <main className="grid min-h-screen place-items-center bg-[#050812] bg-[radial-gradient(ellipse_at_top_left,#123c4c,transparent_65%)] px-5 py-12 text-white">
      {validToken ? (
        <SetPasswordForm token={token} />
      ) : (
        <div className="w-full max-w-lg rounded-3xl border border-cyan-300/30 bg-[#102835] p-8">
          <p className="text-sm uppercase tracking-widest text-cyan-200">
            Orbit LM
          </p>

          <h1 className="mt-4 text-3xl font-semibold">
            Invalid setup link
          </h1>

          <p className="mt-5 leading-7 text-slate-300">
            This password setup link is missing or invalid.
          </p>

          <a
            href="/"
            className="mt-7 inline-block text-cyan-200 underline"
          >
            Return to Orbit
          </a>
        </div>
      )}
    </main>
  )
}