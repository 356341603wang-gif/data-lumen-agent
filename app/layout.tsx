import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Data Lumen · 表格可视化分析 Agent",
  description:
    "上传 Excel 或 CSV，自动生成字段画像、数据质量诊断、可视化图表和分析结论。原始文件仅在浏览器本地处理。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
