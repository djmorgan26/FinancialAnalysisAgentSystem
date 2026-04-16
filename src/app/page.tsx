import { loadAnalysis, loadUserProfile } from "@/lib/data-store";
import Dashboard from "@/components/Dashboard";
import EmptyState from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [analysis, userProfile] = await Promise.all([
    loadAnalysis(),
    loadUserProfile(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                Financial Dashboard
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/import"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Import Data
              </a>
              {analysis && (
                <RunAnalysisButton />
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {analysis ? <Dashboard analysis={analysis} userProfile={userProfile} /> : <EmptyState />}
      </main>
    </div>
  );
}

function RunAnalysisButton() {
  return (
    <form action="/api/analysis" method="POST">
      <button
        type="submit"
        className="text-sm font-medium text-accent hover:text-foreground transition-colors"
      >
        Re-run Analysis
      </button>
    </form>
  );
}
