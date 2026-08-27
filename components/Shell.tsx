"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Home, Library, KeyRound, ShieldCheck, LogIn } from "lucide-react";

const links = [
  { href: "/", label: "Marketplace", icon: Home },
  { href: "/library", label: "My Library", icon: Library },
  { href: "/licenses", label: "Licenses", icon: KeyRound },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/login", label: "Login", icon: LogIn }
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark"><Box size={21} /></div>
          <div>
            <strong>Aevon</strong>
            <span>Plugins Marketplace</span>
          </div>
        </div>
        <nav>
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={pathname === href ? "navItem active" : "navItem"}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebarFoot">Aevon Marketplace V2</div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
