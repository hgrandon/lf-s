import Logo from "@/app/components/Logo";
import Link from "next/link";

export const metadata = {
  title: "Inicio",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
      {/* capa sutil de “brillos” */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <section className="mx-auto grid max-w-5xl place-items-center px-6 py-24 text-center">
        <Logo size={88} showName className="mb-6" />
        <h1 className="text-3xl md:text-5xl font-bold leading-tight">
          Bienvenido a tu sistema
        </h1>
        <p className="mt-4 text-white/80 max-w-2xl">
          Gestión rápida y sencilla para pedidos, clientes y operaciones diarias
          de tu lavandería.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/menu"
            className="rounded-xl bg-white text-violet-900 px-6 py-3 font-semibold shadow-sm hover:shadow transition"
          >
            Ir al Menú
          </Link>

          <Link
            href="/login"
            className="rounded-xl ring-1 ring-white/50 px-6 py-3 font-semibold text-white hover:bg-white/10 transition"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>
    </main>
  );
}
