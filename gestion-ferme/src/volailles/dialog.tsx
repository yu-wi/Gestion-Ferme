// src/volailles/dialog.tsx

import * as Dialog from "@radix-ui/react-dialog";
import React from "react";

export const DialogHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="border-b px-4 py-2">{children}</div>
);

export const DialogTitle = ({ children }: { children: React.ReactNode }) => (
  <Dialog.Title className="text-lg font-semibold">{children}</Dialog.Title>
);

export const DialogContent = ({ children }: { children: React.ReactNode }) => (
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />
    <Dialog.Content className="fixed top-1/2 left-1/2 bg-white p-6 rounded shadow transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md">
      {children}
    </Dialog.Content>
  </Dialog.Portal>
);

export const DialogTrigger = Dialog.Trigger;
