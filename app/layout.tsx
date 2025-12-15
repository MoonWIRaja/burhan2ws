import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'BurHan2Ws - WhatsApp Automation Platform',
  description: 'Advanced WhatsApp Blast & Bot Automation System with Cyberpunk UI',
  keywords: ['whatsapp', 'automation', 'blast', 'bot', 'marketing'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light' || theme === 'dark') {
                    document.documentElement.classList.remove('dark', 'light');
                    document.documentElement.classList.add(theme);
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-mono antialiased cyber-scrollbar" suppressHydrationWarning>
        <div className="relative min-h-screen">
          <div className="fixed inset-0 matrix-bg pointer-events-none z-0" />
          <main className="relative z-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}