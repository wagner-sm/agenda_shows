import React from "react";

function mostrarData(show) {
  if (show.data_inicio === show.data_fim || !show.data_fim) {
    return show.data_inicio;
  } else {
    return `${show.data_inicio} a ${show.data_fim}`;
  }
}

export default function ShowCard({ show, onImageClick }) {
  return (
    <div className="show-card" tabIndex={0}>
      <img
        src={show.flyer}
        alt={`Flyer do show de ${show.artista} em ${show.cidade}`}
        loading="lazy"
        onClick={() => onImageClick(show.flyer)}
        onError={e => (e.target.src = "https://placehold.co/320x300/333/ffb347?text=Imagem+Indisponível")}
        className="loaded"
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