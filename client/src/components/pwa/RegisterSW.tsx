"use client";

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const swUrl = '/sw.js';
      navigator.serviceWorker
        .register(swUrl)
        .catch((err) => console.warn('[PWA] SW registration failed', err));
    }
  }, []);
  return null;
}
