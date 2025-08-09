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

      {/* Footer */}
      <footer className="w-full px-2 py-1 border-t border-border flex text-xs bg-zinc-900 text-zinc-400">
        <div className="flex-auto">
          <p>
            Hello World
          </p>
        </div>
        <div>
          <p>
            Powered by <a href="https://github.com/tiny-webui/" className="underline">TinyWebUI</a>.
          </p>
        </div>
      </footer>
    </div>
  );
} 