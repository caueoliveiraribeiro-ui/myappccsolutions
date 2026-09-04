import { ForgotPasswordForm } from "@/components/forgot-password-form"

export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#050812] bg-[radial-gradient(ellipse_at_top_left,#123c4c,transparent_65%)] px-5 py-12 text-white">
      <ForgotPasswordForm />
    </main>
  )
}
