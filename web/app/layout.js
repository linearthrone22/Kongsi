import "./globals.css";
import { KongsiProvider } from "../lib/kongsi";
import Shell from "../components/Shell";

const BASE_URL = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Kongsi - Proof of Effort",
  description: "Milestone-based Revenue Sharing Token",
  openGraph: { title: "Kongsi - Proof of Effort", description: "Patungan modal untuk effort nyata, dicairkan per milestone terverifikasi.", images: ["/brand/kongsi-logo-original.png"] },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <KongsiProvider>
          <Shell>{children}</Shell>
        </KongsiProvider>
      </body>
    </html>
  );
}
