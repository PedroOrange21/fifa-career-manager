import { useEffect } from 'react';

export function useBodyScrollLock() {
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);
}
