import type { Metadata } from "next";

import "./globals.css";

import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

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
    <html lang="en">
      <body>
        <Sidebar />

        <div className="ml-64 min-h-screen">
          <Topbar />

          <main className="p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}