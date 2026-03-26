import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ToastProvider } from "@/components/ToastProvider";
import { GlobalLoader } from "@/components/GlobalLoader";
import { AuthGate } from "@/components/AuthGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AutotenderAI",
  description: "AI SaaS Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <SidebarProvider>
          <AuthGate>{children}</AuthGate>
        </SidebarProvider>
        <GlobalLoader />
        <ToastProvider />
      </body>
    </html>
  );
}
