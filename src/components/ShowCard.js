import React, { useMemo, useState } from "react";
import { mostrarData } from "../lib/dateUtils";

const FALLBACK_IMG =
  "https://placehold.co/400x533/333/ffb347?text=Imagem+Indisponivel";

export default function ShowCard({ show, onImageClick, style }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [indiceAtual, setIndiceAtual] = useState(0);

  // Remove flyers duplicados/vazios mantendo a ordem
  const imagens = useMemo(() => {
    const lista =
      Array.isArray(show.flyersMultiplos) && show.flyersMultiplos.length > 0
        ? show.flyersMultiplos
        : [show.flyer];
    return [...new Set(lista.filter(Boolean))];
  }, [show.flyersMultiplos, show.flyer]);

  const temCarrossel = imagens.length > 1;
  const imagemAtual = imagens[indiceAtual] || show.flyer;

  const irParaAnterior = (event) => {
    event.stopPropagation();
    setImgLoaded(false);
    setIndiceAtual((i) => (i === 0 ? imagens.length - 1 : i - 1));
  };

  const irParaProxima = (event) => {
    event.stopPropagation();
    setImgLoaded(false);
    setIndiceAtual((i) => (i === imagens.length - 1 ? 0 : i + 1));
  };

  const irParaIndice = (event, index) => {
    event.stopPropagation();
    setImgLoaded(false);
    setIndiceAtual(index);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onImageClick(imagemAtual);
    } else if (temCarrossel && event.key === "ArrowLeft") {
      event.preventDefault();
      setImgLoaded(false);
      setIndiceAtual((i) => (i === 0 ? imagens.length - 1 : i - 1));
    } else if (temCarrossel && event.key === "ArrowRight") {
      event.preventDefault();
      setImgLoaded(false);
      setIndiceAtual((i) => (i === imagens.length - 1 ? 0 : i + 1));
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
      <div className="flyer-carousel" style={{ position: "relative" }}>
        <img
          src={imagemAtual}
          alt={`Flyer do show de ${show.artista} em ${show.cidade}`}
          loading="lazy"
          onClick={() => onImageClick(imagemAtual)}
          onError={(e) => (e.target.src = FALLBACK_IMG)}
          onLoad={() => setImgLoaded(true)}
          className={`flyer ${imgLoaded ? "loaded" : ""}`}
        />

        {temCarrossel && (
          <>
            <button
              type="button"
              className="carousel-btn carousel-prev"
              onClick={irParaAnterior}
              aria-label="Imagem anterior"
              style={{
                position: "absolute",
                top: "50%",
                left: "6px",
                transform: "translateY(-50%)",
                background: "rgba(0,0,0,0.5)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                cursor: "pointer",
              }}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              type="button"
              className="carousel-btn carousel-next"
              onClick={irParaProxima}
              aria-label="Próxima imagem"
              style={{
                position: "absolute",
                top: "50%",
                right: "6px",
                transform: "translateY(-50%)",
                background: "rgba(0,0,0,0.5)",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                cursor: "pointer",
              }}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>

            <div
              className="carousel-dots"
              style={{
                position: "absolute",
                bottom: "8px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "6px",
              }}
            >
              {imagens.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Ver imagem ${index + 1}`}
                  onClick={(event) => irParaIndice(event, index)}
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    background:
                      index === indiceAtual
                        ? "#ffb347"
                        : "rgba(255,255,255,0.6)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
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