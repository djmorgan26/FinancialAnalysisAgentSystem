import Link from "next/link";
import { ShellWrapper } from "@/components/app/ShellWrapper";
import { PageContainer } from "@/components/app/Page";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShellWrapper>
      <PageContainer>
        <div className="grid md:grid-cols-[200px_1fr] gap-8">
          <aside className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--text-muted)] mb-3">
              Settings
            </div>
            <SettingsNav />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </PageContainer>
    </ShellWrapper>
  );
}

function SettingsNav() {
  return (
    <nav className="flex flex-col gap-1">
      {[
        { href: "/settings/profile", label: "Profile" },
        { href: "/settings/preferences", label: "Preferences" },
        { href: "/settings/account", label: "Account" },
      ].map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="px-3 py-2 rounded-[6px] text-[13px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[var(--bg-inset)]"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
