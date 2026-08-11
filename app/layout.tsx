import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
export const metadata: Metadata = { title: "DentMemo App", description: "Second brain for dentists" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#0f5bea" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={geist.variable}>{children}</body></html>;
}
