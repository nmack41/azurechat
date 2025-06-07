import { AI_NAME } from "@/features/theme/theme-config";
import { RootProviders } from "@/features/globals/root-providers";
import { cn } from "@/ui/lib";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: AI_NAME,
  description: AI_NAME,
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden text-sm">
      <body
        className={cn(inter.className, "h-full w-full flex  bg-background")}
      >
        <RootProviders>
          {children}
        </RootProviders>
      </body>
    </html>
  );
}
