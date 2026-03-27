import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recall — Save anything. Find everything.",
  description: "Frictionless capture + intelligent organisation + visual recall tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var theme=localStorage.getItem("recall-theme");if(theme){document.documentElement.dataset.theme=JSON.parse(theme)}}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
