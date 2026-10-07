import { useState, useEffect } from 'react';

let deferredPrompt = null;
let installed = false;
let attached = false;
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

function attachListeners() {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

attachListeners();

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useInstallPrompt() {
  const [, setTick] = useState(0);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    attachListeners();
    const unsub = subscribe(() => setTick((t) => t + 1));
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
    return unsub;
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    emit();
    return outcome === 'accepted';
  };

  return {
    canInstall: !!deferredPrompt,
    isInstalled: installed || isStandalone,
    isStandalone,
    promptInstall,
  };
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isIOSStandalone() {
  return isIOS() && (window.navigator.standalone === true);
}