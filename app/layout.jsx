import "./globals.css";

export const metadata = {
  title: "March Madness Pool 2026",
  description: "Live tracker for the 2026 March Madness snake draft player pool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
