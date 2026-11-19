import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "@fontsource/alexandria/arabic-600.css";
import "@fontsource/alexandria/arabic-700.css";
import "@fontsource/alexandria/latin-600.css";
import "@fontsource/alexandria/latin-700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "./globals.css";
import "./theme-v3.css";
import { AppProvider } from "@/components/app-provider";
import { ToastProvider } from "@/components/ui";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: { default: "MQW — مساحة لتعلّم يبقى", template: "%s | MQW" },
  description:
    "مساحتك الشخصية لتعلّم أفضل: اختبارات حقيقية، مراجعات متباعدة، وقصر ذاكرة. عربي أولًا، وتحت سيطرتك.",
  applicationName: "MQW",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MQW" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AppProvider>
          <ToastProvider>
            <Shell>{children}</Shell>
          </ToastProvider>
        </AppProvider>
      </body>
    </html>
  );
}
