import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Horse Racing Admin',
  description: 'Admin dashboard for horse racing data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1a1a1e',
                color: '#f3f4f6',
                border: '1px solid #2a2a30',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
