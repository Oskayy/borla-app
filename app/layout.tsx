import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import Footer from "@/components/Footer";

// One typeface across the customer, driver and ops apps and the public site.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Trashit",
  description: "Waste collection, done reliably.",
  applicationName: "Trashit",
  // Installed on an iPhone home screen, Trashit opens full screen like an app (and can receive alerts).
  appleWebApp: { capable: true, title: "Trashit", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e1726",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={geist.variable}>
        {children}
        <Footer />
        <CookieConsentBanner />
      </body>
    </html>
  );
}