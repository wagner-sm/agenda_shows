import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { formatarData } from "./lib/dateUtils";
import "./AdminPage.css";

const STORAGE_BUCKET = "flyers";

// Utilitário: limpa valor para envio ao banco (null se vazio)
function prepararValor(valor) {
  if (valor === null || valor === undefined) return null;
  const valorString = String(valor).trim();
  return valorString === "" ? null : valorString;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

async function uploadToSupabase(file) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { data: { session } } = await supabase.auth.getSession();

  const base64 = await readFileAsBase64(file);

  const response = await fetch("/api/upload-flyer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      file: base64,
      contentType: file.type,
      token: session.access_token,
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);

  return { url: result.url, path: result.path };
}

async function deleteFromSupabase(filePath) {
  if (!filePath) return false;

  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/delete-flyer`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ filePath }),
    }
  );

  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return true;
}

function extractFilePathFromUrl(url) {
  if (!url) return null;

  const cleanUrl = url.trim().split("?")[0];

  const patterns = [
    new RegExp(`/storage/v1/object/public/${STORAGE_BUCKET}/(.+)$`),
    new RegExp(`/${STORAGE_BUCKET}/(.+)$`),
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (data.session) onLogin(true);
    } catch (err) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <form onSubmit={handleSubmit} className="admin-login-box">
        <h2>Admin Login</h2>

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="admin-input"
          required
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="admin-input"
          required
        />

        {error && <p className="admin-login-error">{error}</p>}

        <button className="admin-add-btn" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function AdminPanel() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  const [formData, setFormData] = useState({
    artista: "",
    data_inicio: "",
    data_fim: "",
    local: "",
    cidade: "",
    flyer: "",
  });

  const showMessage = useCallback((text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const loadShows = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("shows")
      .select("*")
      .order("data_inicio", { ascending: true });

    if (error) {
      showMessage(`Erro ao carregar shows: ${error.message}`, "error");
      setShows([]);
    } else {
      setShows(data || []);
    }

    setLoading(false);
  }, [showMessage]);

  useEffect(() => {
    loadShows();
  }, [loadShows]);

  const resetForm = () => {
    setEditingId(null);
    setSelectedFile(null);
    setFormData({
      artista: "",
      data_inicio: "",
      data_fim: "",
      local: "",
      cidade: "",
      flyer: "",
    });
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      showMessage("Por favor, selecione uma imagem válida (JPG, PNG, WEBP ou GIF)", "error");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage("A imagem deve ter no máximo 5MB", "error");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const saveShow = async (e) => {
    e.preventDefault();

    if (!formData.artista?.trim()) {
      showMessage("O nome do artista é obrigatório", "error");
      return;
    }
    if (!formData.data_inicio?.trim()) {
      showMessage("A data de início é obrigatória", "error");
      return;
    }
    if (!formData.local?.trim()) {
      showMessage("O local é obrigatório", "error");
      return;
    }
    if (!formData.cidade?.trim()) {
      showMessage("A cidade é obrigatória", "error");
      return;
    }

    let newFlyerUrl = formData.flyer;
    const oldFlyerPath = formData.flyer ? extractFilePathFromUrl(formData.flyer) : null;

    try {
      if (selectedFile) {
        setUploadProgress(true);
        showMessage("Fazendo upload da imagem...", "success");

        if (editingId && oldFlyerPath) {
          try {
            await deleteFromSupabase(oldFlyerPath);
          } catch (err) {
            console.error("Erro ao deletar imagem anterior:", err);
          }
        }

        const uploadResult = await uploadToSupabase(selectedFile);
        newFlyerUrl = uploadResult.url;
        setUploadProgress(false);
      }

      const showData = {
        artista: prepararValor(formData.artista),
        data_inicio: prepararValor(formData.data_inicio),
        data_fim: prepararValor(formData.data_fim),
        local: prepararValor(formData.local),
        cidade: prepararValor(formData.cidade),
        flyer: prepararValor(newFlyerUrl),
      };

      if (editingId) {
        const { error } = await supabase.from("shows").update(showData).eq("id", editingId);
        if (error) throw error;
        showMessage("Show atualizado com sucesso!", "success");
      } else {
        const { error } = await supabase.from("shows").insert([showData]);
        if (error) throw error;
        showMessage("Show adicionado com sucesso!", "success");
      }

      resetForm();
      loadShows();
    } catch (err) {
      console.error("Erro ao salvar show:", err);
      showMessage(`Erro: ${err.message}`, "error");
      setUploadProgress(false);
    }
  };

  const editShow = (show) => {
    setFormData({
      artista: show.artista || "",
      data_inicio: show.data_inicio || "",
      data_fim: show.data_fim || "",
      local: show.local || "",
      cidade: show.cidade || "",
      flyer: show.flyer || "",
    });
    setEditingId(show.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteShow = async (id) => {
    if (!window.confirm("Tem certeza que deseja deletar este show?")) return;

    try {
      const showToDelete = shows.find((s) => s.id === id);

      if (showToDelete?.flyer) {
        const flyerPath = extractFilePathFromUrl(showToDelete.flyer);
        if (flyerPath) {
          try {
            await deleteFromSupabase(flyerPath);
          } catch (err) {
            console.error("Erro ao deletar arquivo do Storage:", err);
          }
        }
      }

      const { error: deleteError } = await supabase.from("shows").delete().eq("id", id);
      if (deleteError) throw deleteError;

      showMessage("Show deletado com sucesso!", "success");
      loadShows();
    } catch (err) {
      console.error("Erro ao deletar show:", err);
      showMessage(`Erro ao deletar: ${err.message}`, "error");
    }
  };

  return (
    <div className="admin-container">
      <h1 className="admin-title">
        <span className="admin-title-icon">🎭</span>
        Gerenciar Shows
      </h1>

      <form onSubmit={saveShow} className="admin-form">
        <div className="admin-row">
          <div className="admin-col">
            <label className="admin-label">Artista/Banda *</label>
            <input
              className="admin-input"
              value={formData.artista}
              onChange={(e) => handleInputChange("artista", e.target.value)}
              placeholder="Nome do artista"
              required
            />
          </div>

          <div className="admin-col">
            <label className="admin-label">Local *</label>
            <input
              className="admin-input"
              value={formData.local}
              onChange={(e) => handleInputChange("local", e.target.value)}
              placeholder="Ex: Bar do João"
              required
            />
          </div>
        </div>

        <div className="admin-row">
          <div className="admin-col">
            <label className="admin-label">Data Início *</label>
            <input
              type="date"
              className="admin-input"
              value={formData.data_inicio}
              onChange={(e) => handleInputChange("data_inicio", e.target.value)}
              required
            />
          </div>

          <div className="admin-col">
            <label className="admin-label">Data Fim (opcional)</label>
            <input
              type="date"
              className="admin-input"
              value={formData.data_fim}
              onChange={(e) => handleInputChange("data_fim", e.target.value)}
            />
          </div>
        </div>

        <div className="admin-row">
          <div className="admin-col">
            <label className="admin-label">Cidade *</label>
            <input
              className="admin-input"
              value={formData.cidade}
              onChange={(e) => handleInputChange("cidade", e.target.value)}
              placeholder="Nome da cidade"
              required
            />
          </div>

          <div className="admin-col">
            <label className="admin-label">Flyer (imagem)</label>
            <input
              type="file"
              accept="image/*"
              className="admin-input"
              onChange={handleFileChange}
            />
            {selectedFile && (
              <p className="admin-file-name ok">✓ {selectedFile.name}</p>
            )}
            {formData.flyer && !selectedFile && (
              <p className="admin-file-name current">
                📷 Imagem atual:{" "}
                <a
                  href={formData.flyer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-file-link"
                >
                  Ver
                </a>
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="admin-add-btn"
          disabled={uploadProgress}
        >
          {uploadProgress
            ? "Enviando imagem..."
            : editingId
            ? "Salvar Alteração"
            : "Adicionar Show"}
        </button>

        {editingId && (
          <button type="button" onClick={resetForm} className="admin-cancel-btn">
            Cancelar
          </button>
        )}
      </form>

      {message && (
        <div className={`admin-message ${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="admin-loading-text">Carregando...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr className="admin-table-header">
              <th className="admin-th">Artista</th>
              <th className="admin-th">Data Início</th>
              <th className="admin-th">Data Fim</th>
              <th className="admin-th">Local</th>
              <th className="admin-th">Cidade</th>
              <th className="admin-th">Flyer</th>
              <th className="admin-th">Ações</th>
            </tr>
          </thead>
          <tbody>
            {shows.map((show) => (
              <tr key={show.id} className="admin-table-row">
                <td className="admin-td">{show.artista}</td>
                <td className="admin-td">{formatarData(show.data_inicio)}</td>
                <td className="admin-td">{formatarData(show.data_fim)}</td>
                <td className="admin-td">{show.local}</td>
                <td className="admin-td">{show.cidade}</td>
                <td className="admin-td">
                  {show.flyer ? (
                    <a
                      href={show.flyer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-link"
                    >
                      Ver
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="admin-td">
                  <div className="admin-actions">
                    <button
                      onClick={() => editShow(show)}
                      className="admin-edit-btn"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteShow(show.id)}
                      className="admin-delete-btn"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(!!session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuth(false);
  };

  if (loading) {
    return (
      <div className="admin-login-wrapper">
        <p className="admin-loading-text">Carregando...</p>
      </div>
    );
  }

  if (!auth) return <LoginForm onLogin={setAuth} />;

  return (
    <>
      <button onClick={handleLogout} className="admin-logout-btn">
        Sair
      </button>
      <AdminPanel />
    </>
  );
}
