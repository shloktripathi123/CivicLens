"use client";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/people", "People"],
  ["/races", "Races"],
  ["/elections", "Elections"],
  ["/places", "Places"],
  ["/bills", "Bills"],
  ["/rubric", "Source grading"],
  ["/coverage", "Coverage"],
  ["/exclusions", "What we never show"],
] as const;

export function MainNav() {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Main" className="nav">
      {LINKS.map(([href, label]) => (
        <a key={href} href={href} aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
