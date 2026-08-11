import React, { useState } from "react";
import { mostrarData } from "../lib/dateUtils";

const FALLBACK_IMG =
  "https://placehold.co/400x533/333/ffb347?text=Imagem+Indisponivel";

export default function ShowCard({ show, onImageClick, style }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onImageClick(show.flyer);
    }
  };

  return (
    <div
      className="show-card"
      tabIndex={0}
      style={style}
      onKeyDown={handleKeyDown}
      aria-label={`Show de ${show.artista} em ${show.cidade}`}
    >
      <img
        src={show.flyer}
        alt={`Flyer do show de ${show.artista} em ${show.cidade}`}
        loading="lazy"
        onClick={() => onImageClick(show.flyer)}
        onError={(e) => (e.target.src = FALLBACK_IMG)}
        onLoad={() => setImgLoaded(true)}
        className={`flyer ${imgLoaded ? "loaded" : ""}`}
      />
      <div className="show-info">
        <h2>{show.artista}</h2>
        <div className="info-item">
          <i className="fa-solid fa-calendar-days info-icon"></i>
          <p className="info-text">{mostrarData(show)}</p>
        </div>
        <div className="info-item">
          <i className="fa-solid fa-location-dot info-icon"></i>
          <p className="info-text">{show.local}</p>
        </div>
        <div className="info-item">
          <i className="fa-solid fa-city info-icon"></i>
          <p className="info-text">{show.cidade}</p>
        </div>
      </div>
    </div>
  );
}