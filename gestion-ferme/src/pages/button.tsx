// src/volailles/Button.tsx

import React from "react";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
};

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  className = "",
  type = "button",
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`bg-blue-600 text-black px-4 py-2 rounded hover:bg-blue-700 ${className}`}
    >
      {children}
    </button>
  );
};
