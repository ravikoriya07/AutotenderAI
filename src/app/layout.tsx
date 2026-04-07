import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { AppProviders } from "@/app/AppProviders";
import { ToastProvider } from "@/components/ToastProvider";
import { GlobalLoader } from "@/components/GlobalLoader";
import { AuthGate } from "@/components/AuthGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AutotenderAI",
  description: "AI SaaS Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
          <AppProviders>
            <AuthGate>{children}</AuthGate>
          </AppProviders>
        </SidebarProvider>
        <GlobalLoader />
        <ToastProvider />
      </body>
    </html>
  );
}
