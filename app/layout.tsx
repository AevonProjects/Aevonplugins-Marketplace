import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Aevon Plugins Marketplace",
  description: "Official marketplace for Aevon Minecraft plugins"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL || ""} crossOrigin="anonymous" />
          <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL || ""} />
        </head>
        <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
