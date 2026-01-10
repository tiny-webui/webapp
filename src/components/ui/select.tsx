"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type SelectProps = {
  candidates: Map<string, string>
  value?: string
  onValueChange: (value: string) => void
  onOpen?: () => void
  allowClear?: boolean
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  contentClassName?: string
}

export function Select({
  candidates,
  value,
  onValueChange,
  onOpen,
  allowClear = false,
  placeholder,
  disabled,
  id,
  className,
  contentClassName,
}: SelectProps) {
  const hasValue = value !== undefined && value !== ""

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        onOpen?.()
      }
    },
    [onOpen]
  )

  const handleClear = React.useCallback(() => {
    onValueChange("")
  }, [onValueChange])

  return (
    <SelectPrimitive.Root
      data-slot="select"
      value={value ?? ""}
      onValueChange={onValueChange}
      onOpenChange={handleOpenChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select-trigger"
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <SelectPrimitive.Value data-slot="select-value" placeholder={placeholder} />
        </span>
        {allowClear && hasValue && (
          <span
            role="presentation"
            className="text-muted-foreground hover:text-foreground"
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleClear()
            }}
          >
            <XIcon className="size-4" />
          </span>
        )}
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="select-content"
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
              contentClassName
          )}
          position="popper"
        >
          <SelectPrimitive.Viewport
            className={cn(
              "p-1 h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1"
            )}
          >
            {Array.from(candidates.entries()).map(([label, candidateValue]) => (
              <SelectPrimitive.Item
                key={label}
                value={candidateValue}
                data-slot="select-item"
                className={cn(
                  "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
                )}
              >
                <span className="absolute right-2 flex size-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <CheckIcon className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
