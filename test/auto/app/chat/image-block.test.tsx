/// <reference types="@testing-library/jest-dom" />
/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';

// ESM-friendly mock for next/image before importing the component under test.
jest.unstable_mockModule('next/image', () => {
  const MockNextImage = (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt ?? ''} {...props} />;
  return { __esModule: true, default: MockNextImage };
});

// Dynamically import after mock is registered.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ImageBlock: any;
beforeAll(async () => {
  ({ ImageBlock } = await import('@/components/custom/image-block'));
});

describe('ImageBlock component', () => {
  test('opens and closes preview via button', () => {
    render(<ImageBlock src="/next.svg" alt="Next Logo" />);
    const thumbButton = screen.getByRole('button', { name: /open image: next logo/i });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(thumbButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Close via close button
    const closeBtn = screen.getByRole('button', { name: /close image preview/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('backdrop click closes preview', () => {
    render(<ImageBlock src="/next.svg" alt="Next Logo" />);
    fireEvent.click(screen.getByRole('button', { name: /open image: next logo/i }));
    const dialog = screen.getByRole('dialog');
    // Click the overlay itself (role=dialog) to trigger backdrop close (inner content stops propagation).
    fireEvent.click(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('esc key closes preview', () => {
    render(<ImageBlock src="/next.svg" alt="Next Logo" />);
    fireEvent.click(screen.getByRole('button', { name: /open image: next logo/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('removable thumbnail triggers onRemove without opening preview', () => {
    const removeSpy = jest.fn();
    render(<ImageBlock src="/next.svg" alt="Next Logo" removable onRemove={removeSpy} />);
    const removeButton = screen.getByRole('button', { name: '移除图片' });
    fireEvent.click(removeButton);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
