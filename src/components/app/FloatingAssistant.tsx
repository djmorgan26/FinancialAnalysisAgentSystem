"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Floating launcher on every page except /assistant itself. Clicking jumps to
 * the full-page assistant for now; later this can open a drawer.
 */
export function FloatingAssistant() {
  const pathname = usePathname();
  if (pathname?.startsWith("/assistant")) return null;

  return (
    <Link
      href="/assistant"
      className="fixed bottom-5 right-5 w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105"
      style={{
        background: "var(--accent)",
        color: "#ffffff",
        boxShadow:
          "0 10px 30px rgba(10, 10, 20, 0.5), 0 0 0 1px var(--border)",
      }}
      title="Ask the assistant"
      aria-label="Open assistant"
    >
      <Sparkles size={20} strokeWidth={1.8} />
    </Link>
  );
}
