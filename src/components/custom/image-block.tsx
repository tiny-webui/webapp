"use client";

import React, { useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const THUMBNAIL_SIZE = 80;

export interface ImageBlockProps {
  src: string;
  alt?: string;
  onOpen?: () => void;
  onClose?: () => void;
  /** Show an inline remove button (typically for unsent / draft images). */
  removable?: boolean;
  /** Called when the remove button is clicked. Parent is responsible for actually removing the block. */
  onRemove?: () => void;
}

export function ImageBlock({ src, alt, onOpen, onClose, removable, onRemove }: ImageBlockProps) {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    onOpen?.();
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  // Close on ESC key when open
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // Overlay element rendered via portal
  const overlay = open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="max-h-full max-w-full overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <NextImage
          src={src}
          alt={alt || "image preview"}
          width={1200}
          height={1200}
          className="h-auto w-auto max-h-[90vh] max-w-[90vw] object-contain rounded shadow-lg"
        />
        <div className="text-center mt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
            aria-label="Close image preview"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative inline-block">
        <button
          type="button"
          onClick={handleOpen}
          className="group relative h-20 w-20 border border-border rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring bg-background/40"
          aria-label={alt ? `Open image: ${alt}` : "Open image"}
        >
          <NextImage
            src={src}
            alt={alt || "image thumbnail"}
            width={THUMBNAIL_SIZE}
            height={THUMBNAIL_SIZE}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </button>
        {removable && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center bg-background/80 border border-border text-foreground/70 shadow-sm backdrop-blur-sm hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            aria-label="移除图片"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
      </div>
      {typeof window !== "undefined" && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}

export default ImageBlock;
