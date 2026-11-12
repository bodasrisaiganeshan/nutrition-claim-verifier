import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "@/components/auth-guard";

export const metadata: Metadata = {
  title: "Nutrition Claim Verifier · FSSAI Compliance & Audit Tool",
  description:
    "Grounded verification of front-of-pack nutrition and health claims on Indian packaged foods against official FSSAI nutrient thresholds and deceptive marketing regulations.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
