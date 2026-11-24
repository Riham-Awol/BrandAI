import { Fraunces, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "./globals.css";

const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", axes: ["SOFT", "opsz"] });
const body = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

export const metadata = {
  title: { default: "Brand AI — Your AI Marketing Team", template: "%s · Brand AI" },
  description: "Your Business. Your Brand. Your AI Marketing Team.",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#121017" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
