"use client";

import { Fragment } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: ModalProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              className={`w-full ${sizeClasses[size]} bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden`}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div>
                  <DialogTitle className="text-base font-semibold text-white">
                    {title}
                  </DialogTitle>
                  {description && (
                    <p className="text-sm text-gray-400 mt-0.5">{description}</p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-white transition-colors rounded-lg p-1 hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <div className="p-6">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
