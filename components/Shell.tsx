"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, KeyRound, ShieldCheck, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/", label: "Marketplace", icon: Home },
  { href: "/library", label: "My Library", icon: Library },
  { href: "/licenses", label: "Licenses", icon: KeyRound },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
  { href: "/login", label: "Login", icon: LogIn }
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <header className="siteHeader">
        <div className="siteHeaderInner">
          <Link href="/" className="siteBrand" onClick={() => setOpen(false)}>
            <img src="/assets/aevon-bird.png" alt="Aevon bird" className="siteBird" />
            <div className="siteBrandWords">
              <strong><span>AEVON</span>PLUGINS</strong>
              <small>MARKETPLACE</small>
            </div>
          </Link>

          <button className="mobileMenuBtn" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className={open ? "siteNav open" : "siteNav"}>
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={pathname === href ? "siteNavItem active" : "siteNavItem"}
              >
                <Icon size={16} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="main">{children}</main>

      <footer className="siteFooter">
        <div className="siteFooterInner">
          <div className="footerBrand">
            <img src="/assets/aevon-bird.png" alt="" />
            <div><strong>Aevon Plugins Marketplace</strong><span>Premium tools for your Minecraft community.</span></div>
          </div>
          <span>© 2026 Aevon Projects</span>
        </div>
      </footer>
    </div>
  );
}
