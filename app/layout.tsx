import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import Footer from "@/components/Footer";
import PointerFx from "@/components/kit/PointerFx";

// One typeface across the customer, driver and ops apps and the public site.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Trashit",
  description: "Night-time refuse collection in Ghana: book by evening, collected overnight, with proof at every step.",
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
  themeColor: "#163320",
};

const THEME_SCRIPT = "try{var t=localStorage.getItem('trashit-theme');if(t!=='dark')t='light';document.documentElement.dataset.theme=t}catch(e){}"

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets light or dark before the page paints (the saved choice; light until someone picks dark), so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={geist.variable}>
        {children}
        <Footer />
        <CookieConsentBanner />
        <PointerFx />
      </body>
    </html>
  );
}