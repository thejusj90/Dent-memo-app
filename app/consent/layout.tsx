import type { Metadata } from "next";
import "./consent.css";

export const metadata: Metadata = {
  title: "DentMemo Consent",
  description: "Digital dental consent forms, signatures and secure clinic records.",
};

export default function ConsentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
