export default function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-lg text-center">
        <div className="w-16 h-16 rounded-full bg-card-border flex items-center justify-center mx-auto mb-6">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground"
          >
            <path d="M21 12V7H5a2 2 0 010-4h14v4" />
            <path d="M3 5v14a2 2 0 002 2h16v-5" />
            <path d="M18 12a2 2 0 000 4h4v-4h-4z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome to your Financial Dashboard
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Get a complete view of your finances. Import your data to get started.
        </p>

        <div className="text-left space-y-4 mb-8">
          <Step
            number={1}
            title="Export CSVs from your platforms"
            description="Download transaction history and position data from Fidelity, Schwab, Robinhood, Coinbase, Chase, or Citi."
          />
          <Step
            number={2}
            title="Import your data"
            description={
              <>
                Use the{" "}
                <a
                  href="/import"
                  className="text-accent hover:underline font-medium"
                >
                  Import page
                </a>{" "}
                to upload your CSV files, or drop them into the{" "}
                <code className="text-xs bg-card-border rounded px-1.5 py-0.5 font-mono">
                  data/raw/
                </code>{" "}
                directory.
              </>
            }
          />
          <Step
            number={3}
            title="Run the analysis"
            description="The system will normalize your data, calculate net worth, spending patterns, asset allocation, and generate personalized insights."
          />
        </div>

        <a
          href="/import"
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
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import Data
        </a>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-card-border bg-card p-4">
      <div className="w-7 h-7 rounded-full bg-card-border flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-muted-foreground tabular-nums">
          {number}
        </span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-0.5">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
