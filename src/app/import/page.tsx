import ImportPanel from "@/components/ImportPanel";

export const metadata = {
  title: "Import Data - Financial Dashboard",
};

export default function ImportPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Financial Dashboard
              </a>
              <span className="text-muted">/</span>
              <span className="text-sm font-semibold text-foreground">
                Import
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Import Financial Data
          </h1>
          <p className="text-muted-foreground">
            Upload CSV exports from your financial platforms. The system will
            automatically detect the platform and normalize the data.
          </p>
        </div>

        <ImportPanel />

        <div className="mt-8 rounded-lg border border-card-border bg-card p-5">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            How to export your data
          </h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <ExportGuide
              platform="Fidelity"
              steps="Log in to Fidelity.com. Go to Accounts > Positions. Click 'Download' to export your portfolio positions as CSV."
            />
            <ExportGuide
              platform="Schwab"
              steps="Log in to Schwab.com. Go to Accounts > History. Select date range and export as CSV."
            />
            <ExportGuide
              platform="Robinhood"
              steps="In the Robinhood app, go to Account > Statements & History > Account Statements. Download the CSV."
            />
            <ExportGuide
              platform="Coinbase"
              steps="Go to coinbase.com/reports. Generate a transaction history report and download the CSV."
            />
            <ExportGuide
              platform="Chase"
              steps="Log in to Chase.com. Select your account, go to Activity, and click 'Download account activity' as CSV."
            />
            <ExportGuide
              platform="Citi"
              steps="Log in to Citi.com. Go to your credit card account, select Transactions, and download as CSV."
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted mb-4">
            After importing, run an analysis to generate your dashboard.
          </p>
          <form action="/api/analysis" method="POST" className="inline">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-6 py-3 text-sm font-medium transition-colors hover:bg-muted-foreground"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
              </svg>
              Run Analysis
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function ExportGuide({
  platform,
  steps,
}: {
  platform: string;
  steps: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="font-medium text-foreground min-w-[80px]">
        {platform}
      </span>
      <span className="leading-relaxed">{steps}</span>
    </div>
  );
}
