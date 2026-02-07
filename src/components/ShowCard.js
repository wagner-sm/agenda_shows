import React from "react";

// Função para converter data ISO (yyyy-mm-dd) para formato brasileiro (dd/mm/yyyy)
function formatarData(dataISO) {
  if (!dataISO) return '';
  const data = new Date(`${dataISO}T00:00:00`);
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function mostrarData(show) {
  const dataInicioFormatada = formatarData(show.data_inicio);
  const dataFimFormatada = formatarData(show.data_fim);

  if (show.data_inicio === show.data_fim || !show.data_fim) {
    return dataInicioFormatada;
  } else {
    return `${dataInicioFormatada} a ${dataFimFormatada}`;
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