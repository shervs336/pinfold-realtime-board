import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pinfold-realtime-board.vercel.app"),
  title: "Pinfold: plan together, live",
  description:
    "A realtime Kanban board: see teammates' cursors, drag cards together, and watch every change appear instantly.",
  openGraph: {
    title: "Pinfold: realtime collaborative board",
    description: "Live cursors, presence and drag-and-drop, synced instantly.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#f4f3ef" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
