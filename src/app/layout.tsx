import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CareerAutoMate Admin",
  description: "Admin panel for CareerAutoMate platform",
  icons: {
    icon: 'https://i.postimg.cc/v80x21Lm/CA_logo_banner.jpg',
    shortcut: 'https://i.postimg.cc/v80x21Lm/CA_logo_banner.jpg',
    apple: 'https://i.postimg.cc/v80x21Lm/CA_logo_banner.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
