"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DropDownOptionProps<TItem> {
  label: string;
  placeholder?: string;
  value?: string;
  updateOptionsAsync: () => Promise<TItem[]>;
  saveValueAsync: (value: string) => Promise<void>;
  getItemCaption: (item: TItem) => string;
  getItemValue: (item: TItem) => string;
  getItemKey: (item: TItem) => string;
};

export function DropDownOption<TItem>({
  label,
  placeholder,
  value,
  updateOptionsAsync,
  saveValueAsync,
  getItemCaption,
  getItemValue,
  getItemKey,
}: DropDownOptionProps<TItem>) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemList, setItemList] = useState<TItem[]>([]);

  const updateItemListAsync = useCallback(async () => {
    try {
      const items = await updateOptionsAsync();
      setItemList(items);
    } catch (error) {
      /** @todo Notify the user about the error? */
      console.error("Failed to update item list", error);
    }
  }, [updateOptionsAsync]);

  const onValueChangeAsync = useCallback(async (value: string) => {
    try {
      setSaving(true);
      await saveValueAsync(value);
    } catch (error) {
      /** @todo Notify the user about the error? */
      console.error("Failed to save value", error);
    } finally {
      setSaving(false);
    }
  }, [saveValueAsync]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        await updateItemListAsync();
      } finally {
        if (!canceled) {
          setLoaded(true);
        }
      }
    })();
    return () => { canceled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-6 h-14 px-1">
      <span className="text-sm font-medium select-none">{label}</span>
      <div className="ml-auto flex items-center gap-2">
        <Select
          value={value}
          onValueChange={onValueChangeAsync}
          onOpenChange={(open) => { if (open) updateItemListAsync(); }}
          disabled={!loaded || saving}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder={loaded ? (placeholder ?? '') : "加载中..."} />
          </SelectTrigger>
          <SelectContent>
            {itemList.map(item => (
              <SelectItem key={getItemKey(item)} value={getItemValue(item)}>
                {getItemCaption(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
