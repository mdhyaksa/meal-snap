import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal Snap — know what's on your plate",
  description:
    "Drop a photo of your meal. Meal Snap identifies each item and portion, looks up real nutrition data, and answers your questions about it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
