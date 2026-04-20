import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
	title: "Fork dev",
	description: "Local fork controls",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="h-full">
			<body className="min-h-full antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
