import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Career Automate - AI Powered Job Finder | Admin",
  description: "Admin panel for CareerAutoMate platform",
  icons: {
    icon: 'https://i.postimg.cc/X7XGRVQb/CA_logo_sq.jpg',
    shortcut: 'https://i.postimg.cc/X7XGRVQb/CA_logo_sq.jpg',
    apple: 'https://i.postimg.cc/X7XGRVQb/CA_logo_sq.jpg',
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
