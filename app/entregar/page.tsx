// app/entregar/page.tsx
import { redirect } from "next/navigation";

// Nota: NO pongas "use client" aquí.
// Debe ser Server Component para poder usar redirect en el servidor.

export default function Page() {
  redirect("/base/entregar");
  return null; // satisface a TypeScript aunque no se ejecute
}