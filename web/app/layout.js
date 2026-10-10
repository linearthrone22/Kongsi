import "./globals.css";
import { KongsiProvider } from "../lib/kongsi";
import Shell from "../components/Shell";

export const metadata = { title: "Kongsi - Proof of Effort", description: "Milestone-based Revenue Sharing Token" };

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
