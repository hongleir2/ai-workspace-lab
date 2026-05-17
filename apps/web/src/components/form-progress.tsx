'use client';

import NProgress from 'nprogress';
import { useEffect } from 'react';
import { useFormStatus } from 'react-dom';

// Renders nothing — watches the enclosing form's pending state and drives the
// top progress bar so users see immediate feedback on long server actions.
export function FormProgress() {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) {
      NProgress.start();
    } else {
      NProgress.done();
    }
    return () => {
      NProgress.done();
    };
  }, [pending]);

  return null;
}
