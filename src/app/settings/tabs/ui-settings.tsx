"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { DropDownOption } from "../options/drop-down";

export function UiSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex w-full h-48 items-center justify-center">
        <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-muted opacity-30" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <span className="sr-only">加载中...</span>
      </div>
    );
  }

  const themes = [
    { id: "system", name: "跟随系统" },
    { id: "light", name: "浅色模式" },
    { id: "dark", name: "深色模式" },
  ];

  return (
    <div className="space-y-4">
      <DropDownOption<{ id: string; name: string }>
        label="颜色主题"
        placeholder="选择主题"
        value={theme}
        updateOptionsAsync={async () => themes}
        saveValueAsync={async (value) => setTheme(value)}
        getItemCaption={(item) => item.name}
        getItemValue={(item) => item.id}
      />
    </div>
  );
}
