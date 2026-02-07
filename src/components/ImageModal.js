import React from "react";

export default function ImageModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div id="imageModal" style={{ display: "flex" }} onClick={onClose}>
      <span id="closeModal" onClick={onClose}>&times;</span>
      <img id="modalImg" src={src} alt="Imagem em tamanho real" />
    </div>
  );
}