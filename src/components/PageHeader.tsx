"use client";

import AppBar from "./AppBar";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  borderBottom?: boolean;
}

export default function PageHeader({ title, onBack, borderBottom }: PageHeaderProps) {
  return <AppBar variant="nav" title={title} onBack={onBack} borderBottom={borderBottom} />;
}
