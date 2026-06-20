import type { Metadata } from "next";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { OverlayProvider } from "@/contexts/OverlayContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "imchef",
  description: "셰프들의 레시피를 둘러보세요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <AuthProvider>
          <SearchProvider>
            <OverlayProvider>
              <Header />
              <div className="pb-28">{children}</div>
              <BottomNav />
            </OverlayProvider>
          </SearchProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
