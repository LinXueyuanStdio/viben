"use client";

import { useRef, useEffect, useState } from "react";

interface FlashCellProps {
  value: number;
  prevValue?: number;
  format?: (v: number) => string;
  className?: string;
}

export function FlashCell({
  value,
  prevValue,
  format,
  className = "",
}: FlashCellProps) {
  const prevRef = useRef<number | undefined>(prevValue);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const prev = prevRef.current;
    if (prev !== undefined && prev !== value) {
      if (value > prev) {
        setFlashClass("flash-gain");
      } else if (value < prev) {
        setFlashClass("flash-loss");
      }
      const timer = setTimeout(() => setFlashClass(""), 300);
      return () => clearTimeout(timer);
    }
    prevRef.current = value;
  }, [value]);

  // Also update ref when prevValue prop changes
  useEffect(() => {
    if (prevValue !== undefined) {
      prevRef.current = prevValue;
    }
  }, [prevValue]);

  const displayValue = format ? format(value) : value.toString();

  return (
    <span
      className={`inline-block rounded px-1 transition-colors duration-300 ${flashClass} ${className}`}
    >
      {displayValue}
    </span>
  );
}
