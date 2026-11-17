import { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

function AutoDismissToast({ id, title, description, action, dismiss, ...props }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), 1000);
    return () => clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <Toast key={id} {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
    </Toast>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <AutoDismissToast
            key={id}
            id={id}
            title={title}
            description={description}
            action={action}
            dismiss={dismiss}
            {...props}
          />
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}