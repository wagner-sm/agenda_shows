import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import ShowCard from "./components/ShowCard";
import ImageModal from "./components/ImageModal";
import AdminPage from "./AdminPage";

// 🔧 CONFIG SUPABASE (troque apenas isso)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// ✅ Função para datas ISO vindas do banco
function parseISO(dateISO) {
  if (!dateISO) return null;
  return new Date(`${dateISO}T00:00:00`);
}

// ======================
// Página de Shows
// ======================
function ShowsPage() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImg, setModalImg] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchShows() {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/shows?select=*`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        setError(err.message);
        return [];
      }
    }

    setLoading(true);

    fetchShows().then(shows => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const showsProcessados = shows
        .map(show => {
          if (!show.data_fim) {
            show.data_fim = show.data_inicio;
          }
          return show;
        })
        .sort((a, b) => {
          const dataA = parseISO(a.data_inicio);
          const dataB = parseISO(b.data_inicio);

          // Ordena por data
          if (dataA.getTime() !== dataB.getTime()) {
            return dataA - dataB;
          }

          // Se a data for igual, ordena por cidade
          const cidadeComparison = (a.cidade || "").localeCompare(
            b.cidade || "",
            "pt-BR",
            { sensitivity: "base", ignorePunctuation: true }
          );

          if (cidadeComparison !== 0) {
            return cidadeComparison;
          }

          // Se tudo igual, ordena por artista
          return a.artista.localeCompare(b.artista, "pt-BR", {
            sensitivity: "base",
            ignorePunctuation: true
          });
        })
        .filter(show => {
          const dataFim = parseISO(show.data_fim);
          return dataFim >= hoje;
        });

      setShows(showsProcessados);
      setLoading(false);
    });
  }, []);

  // Tema claro / escuro
  useEffect(() => {
    document.body.className = theme === "light" ? "light-theme" : "";
  }, [theme]);

  // Botão voltar ao topo
  useEffect(() => {
    const handleScroll = () => {
      const btn = document.getElementById("backToTop");
      if (!btn) return;

      if (window.pageYOffset > 300) {
        btn.classList.add("show");
      } else {
        btn.classList.remove("show");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          <p style={{ color: "#ffb347", fontSize: "1.2rem", textAlign: "center", width: "100vw" }}>
            Carregando shows...
          </p>
        )}

        {error && (
          <div style={{ color: "#ffb347", fontSize: "1.2rem", textAlign: "center", width: "100vw" }}>
            <p>Erro ao carregar os shows: {error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#ffb347",
                color: "#181818",
                border: "none",
                padding: "10px 20px",
                borderRadius: "5px",
                cursor: "pointer",
                marginTop: "15px"
              }}
            >
              Tentar Novamente
            </button>
          </div>
        )}

        {!loading && !error && shows.length === 0 && (
          <p style={{ color: "#ffb347", fontSize: "1.2rem", textAlign: "center" }}>
            Nenhum show cadastrado no momento.
          </p>
        )}

        {!loading && !error && shows.map(show => (
          <ShowCard
            key={`${show.artista}-${show.data_inicio}-${show.cidade}`}
            show={show}
            onImageClick={setModalImg}
          />
        ))}
      </div>

      <ImageModal src={modalImg} onClose={() => setModalImg(null)} />

      <button id="backToTop" title="Voltar ao topo" onClick={handleBackToTop}>
        <i className="fas fa-arrow-up"></i>
      </button>
    </>
  );
}

// ======================
// App com Rotas
// ======================
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
