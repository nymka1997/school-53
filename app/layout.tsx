import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Сургуулийн ирцийн систем", description: "Сургуулийн ирцийн удирдлагын систем" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="mn"><body>{children}</body></html>; }
