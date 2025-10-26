import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Inicio" };

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 text-white">
      {/* Brillo de fondo sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" />

      <section className="relative z-10 mx-auto grid max-w-5xl place-items-center px-6 py-24 text-center">
        {/* PASTILLA con borde violeta degradado */}
        <div className="mb-8 inline-flex flex-col sm:flex-row items-center justify-center gap-3 rounded-[40px] bg-white px-8 py-4 shadow-xl ring-2 ring-transparent bg-clip-padding border-[3px] border-transparent bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 p-[3px]">
          <div className="flex items-center gap-4 bg-white rounded-[35px] px-6 py-3 w-full">
            <Image
              src="/logo.png"
              alt="Logo Lavandería Fabiola"
              width={80}
              height={80}
              priority
              className="h-16 w-16 object-contain"
            />
            <div className="flex flex-col text-center sm:text-left leading-tight font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-700 bg-clip-text text-transparent text-2xl sm:text-3xl">
                LAVANDERÍA
                </span>
                <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-700 bg-clip-text text-transparent text-2xl sm:text-3xl">
                FABIOLA
              </span>
            </div>
          </div>
        </div>

        {/* Título y descripción */}
        <h1 className="text-3xl md:text-5xl font-bold leading-tight">
          Bienvenido a tu sistema
        </h1>

        <p className="mt-4 max-w-2xl text-white/80">
          Gestión rápida y sencilla para pedidos, clientes y operaciones diarias
          de tu lavandería.
        </p>

        {/* Botón principal */}
        <div className="mt-10">
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



