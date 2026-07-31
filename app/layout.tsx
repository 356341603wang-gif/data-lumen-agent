import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "R2V 标注分歧分析 Agent",
  description:
    "上传物品、场景或音频标注结果，自动分析维度分歧、单题分歧、原因、规则冲突、标注员偏差和完成覆盖。原始文件仅在浏览器本地处理。",
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
