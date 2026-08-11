import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { AuthProvider } from '@/lib/auth-context'
import { ChatSecretaria } from '@/components/secretaria/ChatSecretaria'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar titulo="Surubim Tornearia" />
          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
      <ChatSecretaria />
    </AuthProvider>
  )
}