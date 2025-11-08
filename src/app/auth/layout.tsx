import { Logo } from "@/components/custom/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <Logo size="lg" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>
    </div>
  );
}
