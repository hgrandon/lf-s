import Logo from "@/app/components/Logo";
import Link from "next/link";

export const metadata = {
  title: "Inicio",
};

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white overflow-hidden">
      {/* Capa decorativa de brillo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <section className="relative z-10 mx-auto grid max-w-5xl place-items-center px-6 py-24 text-center">
        {/* Logo con fondo blanco y sombra */}
        <div className="bg-white rounded-full p-4 shadow-lg mb-6">
          <Logo size={88} showName />
        </div>

        <h1 className="text-3xl md:text-5xl font-bold leading-tight">
          Bienvenido a tu sistema
        </h1>

        <p className="mt-4 text-white/80 max-w-2xl">
          Gestión rápida y sencilla para pedidos, clientes y operaciones diarias
          de tu lavandería.
        </p>

        {/* Solo botón de iniciar sesión */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/40 px-8 py-3 font-semibold text-white hover:bg-white/20 transition shadow-md"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>
    </main>
  );
}

