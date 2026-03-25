import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Laboratory Attendance System",
  description: "Secure ECC-based attendance tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        {/* Global Navigation Bar */}
        <nav className="bg-blue-900 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex-shrink-0">
                <Link href="/" className="font-bold text-xl tracking-tight hover:text-blue-200 transition-colors">
                  Laboratory System
                </Link>
              </div>
              <div className="flex space-x-4">
                <Link href="/" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
                  Register
                </Link>
                <Link href="/student" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
                  Log Attendance
                </Link>
                <Link href="/admin" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 transition-colors">
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* This renders whichever page you are currently on */}
        {children}
      </body>
    </html>
  );
}