import { redirect } from "next/navigation";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { Card } from "@/components/app/Pill";
import { NewsFeed } from "@/components/app/NewsFeed";
import { requireUser } from "@/lib/supabase/server";
import {
  getOnboardingComplete,
  loadFinancialData,
} from "@/lib/data-store";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const { user } = await requireUser();
  if (!(await getOnboardingComplete(user.id))) redirect("/onboarding");

  const data = await loadFinancialData(user.id);
  const heldSymbols = Array.from(
    new Set(
      [...data.holdings]
        .filter(
          (h) =>
            h.assetClass !== "cash" && h.assetClass !== "crypto" && h.symbol
        )
        .sort((a, b) => b.currentValue - a.currentValue)
        .map((h) => h.symbol.toUpperCase())
    )
  ).slice(0, 25);

  return (
    <ShellWrapper>
      <PageContainer>
        <PageHeader
          title="News"
          subtitle="Portfolio & market headlines from Finnhub."
        />
        <Card>
          <NewsFeed variant="full" symbols={heldSymbols} />
        </Card>
      </PageContainer>
    </ShellWrapper>
  );
}
