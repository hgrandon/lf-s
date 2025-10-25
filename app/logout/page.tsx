'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    // Borrar datos de sesión (ejemplo simple)
    localStorage.removeItem('user')
    localStorage.removeItem('token')

    // Redirigir al login
    router.push('/login')
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center h-screen text-center text-purple-600">
      <h2 className="text-2xl font-bold mb-4">Cerrando sesión...</h2>
      <p className="text-gray-500">Serás redirigido al inicio.</p>
    </div>
  )
}
