import React, { useState } from "react";
import { mostrarData } from "../lib/dateUtils";

const FALLBACK_IMG =
  "https://placehold.co/320x300/333/ffb347?text=Imagem+Indisponível";

export default function ShowCard({ show, onImageClick }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="show-card" tabIndex={0}>
      <img
        src={show.flyer}
        alt={`Flyer do show de ${show.artista} em ${show.cidade}`}
        loading="lazy"
        onClick={() => onImageClick(show.flyer)}
        onError={(e) => (e.target.src = FALLBACK_IMG)}
        onLoad={() => setImgLoaded(true)}
        className={imgLoaded ? "loaded" : ""}
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