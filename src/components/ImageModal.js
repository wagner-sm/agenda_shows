import React, { useEffect } from "react";

export default function ImageModal({ src, onClose }) {
  useEffect(() => {
    if (!src) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      id="imageModal"
      className="modal-open"
      role="dialog"
      aria-modal="true"
      aria-label="Flyer em tamanho real"
      onClick={onClose}
    >
      <button
        id="closeModal"
        onClick={onClose}
        aria-label="Fechar"
        title="Fechar"
      >
        &times;
      </button>
      <img
        src={src}
        alt="Flyer do show em tamanho real"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
