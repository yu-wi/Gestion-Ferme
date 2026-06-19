type ModalCloseButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export default function ModalCloseButton({
  onClick,
  disabled = false,
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Fermer"
      title="Fermer"
      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full !bg-gray-100 !p-0 text-2xl leading-none !text-gray-700 hover:!bg-gray-200 disabled:opacity-60"
    >
      ×
    </button>
  );
}
