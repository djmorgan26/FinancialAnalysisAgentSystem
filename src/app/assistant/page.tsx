import { ShellWrapper } from "@/components/app/ShellWrapper";
import { AssistantClient } from "./AssistantClient";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <ShellWrapper>
      <AssistantClient />
    </ShellWrapper>
  );
}
