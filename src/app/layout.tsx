import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  title: "Wolt Meet",
  description: "Plan hyper-personal city experiences with AI",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/tzf7dwe.css" />
      </head>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
