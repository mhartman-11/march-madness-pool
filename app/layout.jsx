import "./globals.css";

export const metadata = {
  title: "2025 March Madness Player Pool",
  description: "Live tracker for the 2025 March Madness snake draft player pool",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
