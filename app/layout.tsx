import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Farm & Shop Manager",
  description:
    "Milk production, crop cycles, and shop sales for one small farm — usable offline.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ClerkProvider afterSignOutUrl="/signed-out">
          {children}
          {/* Pinned to light: the generated Toaster defaults to next-themes'
          "system", which would render dark toasts on a dark-OS device. */}
          <Toaster theme="light" />
        </ClerkProvider>
      </body>
    </html>
  );
}