import type { Metadata } from "next";

import "./globals.css";

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Smart Campus Vision",
  description:
    "Smart Campus Vision dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <body className="transition-colors duration-200">
        <ThemeProvider>
          <Sidebar />

          <div className="ml-64 min-h-screen">
            <Topbar />

            <main className="p-8">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}