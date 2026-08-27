import { useEffect } from 'react';

export interface ToastMessage {
  kind: 'success' | 'error';
  text: string;
}

interface Props {
  message: ToastMessage | null;
  onDismiss: () => void;
}

const STYLES: Record<ToastMessage['kind'], string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
};

export function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    if (message === null) {
      return;
    }
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (message === null) {
    return null;
  }

  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-30 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${STYLES[message.kind]}`}
    >
      {message.text}
    </div>
  );
}
