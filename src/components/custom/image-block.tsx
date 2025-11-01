"use client";

import React, { useState, useEffect, useCallback } from "react";
import NextImage from "next/image";
import { createPortal } from "react-dom";

const THUMBNAIL_SIZE = 80;

export interface ImageBlockProps {
  src: string;
  alt?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

export function ImageBlock({ src, alt, onOpen, onClose }: ImageBlockProps) {
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
      {typeof window !== "undefined" && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}

export default ImageBlock;
