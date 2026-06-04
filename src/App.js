import React, { useEffect, useState, useRef, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import ShowCard from "./components/ShowCard";
import ImageModal from "./components/ImageModal";
import AdminPage from "./AdminPage";
import { parseISO } from "./lib/dateUtils";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

//rebuild
function ShowsPage() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImg, setModalImg] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [error, setError] = useState(null);

  const backToTopRef = useRef(null);

  const fetchShows = useCallback(async (signal) => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/shows?select=*`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
      }
      return [];
    }
  }, []);

  const loadShows = useCallback(async () => {
    const abortController = new AbortController();

    setLoading(true);
    setError(null);

    const data = await fetchShows(abortController.signal);

    if (!abortController.signal.aborted) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const showsProcessados = data
        .map((show) => ({
          ...show,
          data_fim: show.data_fim || show.data_inicio,
        }))
        .sort((a, b) => {
          const dataA = parseISO(a.data_inicio);
          const dataB = parseISO(b.data_inicio);

          if (dataA.getTime() !== dataB.getTime()) {
            return dataA - dataB;
          }

          const cidadeCmp = (a.cidade || "").localeCompare(b.cidade || "", "pt-BR", {
            sensitivity: "base",
            ignorePunctuation: true,
          });

          if (cidadeCmp !== 0) return cidadeCmp;

          return a.artista.localeCompare(b.artista, "pt-BR", {
            sensitivity: "base",
            ignorePunctuation: true,
          });
        })
        .filter((show) => {
          const dataFim = parseISO(show.data_fim);
          return dataFim >= hoje;
        });

      setShows(showsProcessados);
      setLoading(false);
    }

    return abortController;
  }, [fetchShows]);

  // Carrega os shows na montagem
  useEffect(() => {
    let abortController;

    loadShows().then((ac) => {
      abortController = ac;
    });

    return () => {
      if (abortController) abortController.abort();
    };
  }, [loadShows]);

  // Tema claro / escuro
  useEffect(() => {
    document.body.className = theme === "light" ? "light-theme" : "";
  }, [theme]);

  // Mostra/esconde botão voltar ao topo via classes CSS
  useEffect(() => {
    const btn = backToTopRef.current;
    if (!btn) return;

    const handleScroll = () => {
      if (window.pageYOffset > 300) {
        btn.classList.add("show");
      } else {
        btn.classList.remove("show");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRetry = () => {
    loadShows();
  };

  return (
    <>
      <button
        id="toggleTheme"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title="Alternar tema"
      >
        <i className={theme === "dark" ? "fas fa-moon" : "fas fa-sun"}></i>
      </button>

      <h1>Agenda de Shows</h1>

      <div className="shows-list" id="shows">
        {loading && (
          <p className="status-message loading-message">Carregando shows...</p>
        )}

        {error && (
          <div className="status-message error-container">
            <p>Erro ao carregar os shows: {error}</p>
            <button className="retry-btn" onClick={handleRetry}>
              Tentar Novamente
            </button>
          </div>
        )}

        {!loading && !error && shows.length === 0 && (
          <p className="status-message empty-message">
            Nenhum show cadastrado no momento.
          </p>
        )}

        {!loading &&
          !error &&
          shows.map((show, index) => (
            <ShowCard
              key={show.id || `${show.artista}-${show.data_inicio}-${show.cidade}-${index}`}
              show={show}
              onImageClick={setModalImg}
            />
          ))}
      </div>

      <ImageModal src={modalImg} onClose={() => setModalImg(null)} />

      <button
        id="backToTop"
        ref={backToTopRef}
        title="Voltar ao topo"
        onClick={handleBackToTop}
      >
        <i className="fas fa-arrow-up"></i>
      </button>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ShowsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
