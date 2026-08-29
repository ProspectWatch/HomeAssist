import type { Metadata, Viewport } from "next";
import { Lora } from "next/font/google";
import { ServiceWorkerRegistration } from "./sw-register";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "HomeAssist",
    template: "%s · HomeAssist",
  },
  description:
    "Grocery list, pantry, deals, a price-watch list, and room-by-room tracking for the household — all in one place.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HomeAssist",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#faf8f4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${lora.variable} h-full antialiased`}>
      <body className="shiplap-bg flex min-h-full flex-col text-ink">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
