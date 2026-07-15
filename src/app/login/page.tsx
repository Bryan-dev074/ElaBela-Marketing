import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <LoginForm />
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[11px] text-[var(--muted)]/70">
        © {new Date().getFullYear()} ElaBela · Plataforma interna
      </p>
    </main>
  );
}
