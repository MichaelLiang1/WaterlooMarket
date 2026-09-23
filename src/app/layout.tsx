import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Waterloo Market — buy, sell & rent before co-op",
    template: "%s · Waterloo Market",
  },
  description:
    "The UWaterloo student marketplace for selling, renting, and storing your stuff between terms.",
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-8 md:pb-12">{children}</main>
        {/* Extra bottom padding on phones clears the fixed tab bar. */}
        <footer className="border-t border-stone-200 px-4 pt-6 pb-24 text-center text-xs text-stone-500 md:pb-6">
          <p>
            Waterloo Market is run by students, not the University of Waterloo. Meet in public places
            and inspect items before paying.
          </p>
          <nav className="mt-2 flex justify-center gap-4">
            <Link href="/safety" className="link">
              Safety tips
            </Link>
            <Link href="/terms" className="link">
              Terms
            </Link>
            <Link href="/privacy" className="link">
              Privacy
            </Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
