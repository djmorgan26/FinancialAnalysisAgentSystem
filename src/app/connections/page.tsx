import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer, PageHeader } from "@/components/app/Page";
import { ConnectionsClient } from "./ConnectionsClient";

export const dynamic = "force-dynamic";

export default function ConnectionsPage() {
  return (
    <ShellWrapper>
      <PageContainer>
        <PageHeader
          title="Connections"
          subtitle="Status of every data source. No hiding behind 'sync in progress.'"
        />
        <ConnectionsClient />
      </PageContainer>
    </ShellWrapper>
  );
}
