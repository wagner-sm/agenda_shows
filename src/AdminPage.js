import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";

/* ============================
   IMAGEKIT HELPERS
============================ */
// Helper function to check if URL needs ImageKit upload
function needsImageKitUpload(url) {
  if (!url) return false;
  
  const redirectUrls = (process.env.REACT_APP_IMAGEKIT_REDIRECT_URLS || '')
    .split(',')
    .map(prefix => prefix.trim())
    .filter(Boolean);
  
  return redirectUrls.some(prefix => url.startsWith(prefix));
}

// Helper function to upload image to ImageKit and get the new URL and fileId
async function uploadToImageKit(imageUrl) {
  try {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/.netlify/functions/upload-to-imagekit?url=${encodeURIComponent(imageUrl)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok && data.url && data.fileId) {
      return {
        url: data.url,
        fileId: data.fileId
      };
    } else {
      throw new Error(data.error || 'Falha ao enviar imagem para ImageKit');
    }
  } catch (error) {
    console.error('Erro uploadToImageKit:', error);
    throw error;
  }
}

// Helper function to delete image from ImageKit
async function deleteFromImageKit(fileId) {
  try {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/.netlify/functions/delete_imagekit`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileIds: [fileId]
      })
    });

    const data = await response.json();

    if (response.ok && data.success && data.deleted > 0) {
      return true;
    } else {
      throw new Error(data.error || 'Falha ao excluir imagem do ImageKit');
    }
  } catch (error) {
    console.error('Erro deleteFromImageKit:', error);
    throw error;
  }
}

/* ============================
   LOGIN SIMPLES (FRONT ONLY)
============================ */
function LoginForm({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const ADMIN_USER = process.env.REACT_APP_ADMIN_USERNAME || "admin";
    const ADMIN_PASS = process.env.REACT_APP_ADMIN_PASSWORD || "admin123";

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      sessionStorage.setItem("adminAuth", "true");
      onLogin(true);
    } else {
      setError("Usuário ou senha inválidos");
    }
  };

  return (
    <div style={styles.loginWrapper}>
      <form onSubmit={handleSubmit} style={styles.loginBox}>
        <h2>Admin Login</h2>

        <input
          placeholder="Usuário"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Senha"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          style={styles.input}
        />

        {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}

        <button style={styles.addButton}>Entrar</button>
      </form>
    </div>
  );
}

/* ============================
        PAINEL ADMIN
============================ */
function AdminPanel() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [apiStatus, setApiStatus] = useState("online");
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    artista: "",
    data_inicio: "",
    data_fim: "",
    local: "",
    cidade: "",
    flyer: "",
    file_id: ""
  });

  const showMessage = useCallback((text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(""), 5000);
  }, []);

  const formatDateToBR = useCallback((dateString) => {
    if (!dateString) return "-";
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }, []);

  const loadShows = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("shows")
      .select("*")
      .order("data_inicio", { ascending: true });

    if (!error) {
      setShows(data || []);
      setApiStatus("online");
    } else {
      setApiStatus("offline");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadShows();
  }, [loadShows]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      artista: "",
      data_inicio: "",
      data_fim: "",
      local: "",
      cidade: "",
      flyer: "",
      file_id: ""
    });
  };

  const saveShow = async (e) => {
    e.preventDefault();

    let { artista, data_inicio, data_fim, local, cidade, flyer, file_id: currentFileId } = formData;
    let file_id = currentFileId || '';
    const oldFileId = currentFileId;
    const oldFlyer = editingId ? shows.find(s => s.id === editingId)?.flyer : null;

    try {
      // Se está editando, o flyer mudou, e existe file_id anterior, deletar a imagem antiga
      if (editingId && oldFileId && oldFileId.trim() !== '' && flyer !== oldFlyer) {
        try {
          console.log('Tentando deletar imagem anterior. File ID:', oldFileId);
          const deleteResult = await deleteFromImageKit(oldFileId);
          console.log('Resultado da exclusão:', deleteResult);
          showMessage('Imagem anterior removida do ImageKit', 'success');
          file_id = '';
        } catch (error) {
          console.error('Erro ao deletar imagem anterior:', error);
          showMessage('Aviso: Não foi possível remover imagem anterior', 'error');
        }
      }

      // Check if flyer URL needs to be uploaded to ImageKit
      if (flyer && needsImageKitUpload(flyer)) {
        showMessage('Processando URL do flyer...', 'success');
        
        const uploadResult = await uploadToImageKit(flyer);
        flyer = uploadResult.url;
        file_id = uploadResult.fileId;
        showMessage('Flyer enviado para ImageKit com sucesso!', 'success');
      } else if (editingId && flyer === oldFlyer) {
        // Se está editando mas não mudou o flyer, mantém o file_id anterior
        file_id = oldFileId || '';
      }

      const payload = {
        artista,
        data_inicio,
        data_fim: data_fim || null,
        local,
        cidade,
        flyer: flyer || null,
        file_id: file_id || null
      };

      let response;

      if (editingId) {
        response = await supabase
          .from("shows")
          .update(payload)
          .eq("id", editingId);
      } else {
        response = await supabase
          .from("shows")
          .insert([payload]);
      }

      if (!response.error) {
        showMessage(`Show ${editingId ? 'alterado' : 'adicionado'} com sucesso!`, 'success');
        resetForm();
        loadShows();
      } else {
        showMessage(response.error.message, 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showMessage(`Erro ao salvar show: ${error.message}`, 'error');
    }
  };

  const editShow = (show) => {
    setEditingId(show.id);
    setFormData({
      artista: show.artista,
      data_inicio: show.data_inicio,
      data_fim: show.data_fim || "",
      local: show.local,
      cidade: show.cidade,
      flyer: show.flyer || "",
      file_id: show.file_id || ""
    });
	window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteShow = async (id) => {
    if (!window.confirm("Excluir este show?")) return;

    try {
      // Busca o show para pegar o file_id antes de deletar
      const showToDelete = shows.find(s => s.id === id);
      
      // Se existe file_id, tenta deletar do ImageKit
      if (showToDelete?.file_id && showToDelete.file_id.trim() !== '') {
        try {
          console.log('Tentando deletar imagem do ImageKit. File ID:', showToDelete.file_id);
          await deleteFromImageKit(showToDelete.file_id);
          showMessage('Imagem removida do ImageKit', 'success');
        } catch (error) {
          console.error('Erro ao deletar imagem do ImageKit:', error);
          showMessage('Aviso: Não foi possível remover a imagem do ImageKit', 'error');
        }
      }

      // Deleta o show do Supabase
      const response = await supabase.from("shows").delete().eq("id", id);
      
      if (!response.error) {
        showMessage('Show excluído com sucesso!', 'success');
        loadShows();
        resetForm();
      } else {
        showMessage(response.error.message, 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      showMessage(`Erro ao excluir: ${error.message}`, 'error');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>
        <span style={styles.icon}>🎵</span> Gerenciar Shows
      </h1>

      <div style={styles.statusBanner}>
        <span style={styles.statusIndicator}>✓</span> API Online - Conectado ao Supabase
      </div>

      <form onSubmit={saveShow} style={styles.form}>
        <label style={styles.label}>Artista:</label>
        <input
          placeholder="Nome do artista"
          value={formData.artista}
          onChange={(e) => setFormData({ ...formData, artista: e.target.value })}
          required
          style={styles.input}
        />

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Data Início:</label>
            <input
              type="date"
              value={formData.data_inicio}
              onChange={(e) =>
                setFormData({ ...formData, data_inicio: e.target.value })
              }
              required
              style={styles.input}
            />
          </div>
          <div style={styles.col}>
            <label style={styles.label}>Data Fim:</label>
            <input
              type="date"
              value={formData.data_fim}
              onChange={(e) =>
                setFormData({ ...formData, data_fim: e.target.value })
              }
              style={styles.input}
            />
          </div>
        </div>

        <label style={styles.label}>Local:</label>
        <input
          placeholder="Nome do local"
          value={formData.local}
          onChange={(e) => setFormData({ ...formData, local: e.target.value })}
          required
          style={styles.input}
        />

        <label style={styles.label}>Cidade:</label>
        <input
          placeholder="Nome da cidade"
          value={formData.cidade}
          onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
          required
          style={styles.input}
        />

        <label style={styles.label}>URL do Flyer:</label>
        <input
          placeholder="https://..."
          value={formData.flyer}
          onChange={(e) => setFormData({ ...formData, flyer: e.target.value })}
          style={styles.input}
        />

        <button style={styles.addButton}>
          {editingId ? "Salvar Alteração" : "Adicionar Show"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            style={styles.cancelButton}
          >
            Cancelar
          </button>
        )}
      </form>

      {message && (
        <div style={{
          marginTop: 20,
          padding: 15,
          borderRadius: 8,
          background: message.type === 'error' ? '#dc2626' : '#16a34a',
          color: '#fff',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>Artista</th>
              <th style={styles.th}>Data Início</th>
              <th style={styles.th}>Data Fim</th>
              <th style={styles.th}>Local</th>
              <th style={styles.th}>Cidade</th>
              <th style={styles.th}>Flyer</th>
              <th style={styles.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {shows.map((show) => (
              <tr key={show.id} style={styles.tableRow}>
                <td style={styles.td}>{show.artista}</td>
                <td style={styles.td}>{formatDateToBR(show.data_inicio)}</td>
                <td style={styles.td}>{formatDateToBR(show.data_fim)}</td>
                <td style={styles.td}>{show.local}</td>
                <td style={styles.td}>{show.cidade}</td>
                <td style={styles.td}>
                  {show.flyer ? (
                    <a href={show.flyer} target="_blank" rel="noopener noreferrer" style={styles.link}>
                      Ver
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td style={styles.td}>
                  <div style={styles.actionButtons}>
                    <button onClick={() => editShow(show)} style={styles.editButton}>
                      ✏️
                    </button>
                    <button onClick={() => deleteShow(show.id)} style={styles.deleteButton}>
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

/* ============================
        ADMIN PAGE
============================ */
export default function AdminPage() {
  const [auth, setAuth] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("adminAuth") === "true") {
      setAuth(true);
    }
  }, []);

  if (!auth) return <LoginForm onLogin={setAuth} />;

  return (
    <>
      <button
        onClick={() => {
          sessionStorage.removeItem("adminAuth");
          window.location.href = '/' 
        }}
        style={styles.logout}
      >
        Sair
      </button>
      <AdminPanel />
    </>
  );
}

/* ============================
           STYLES
============================ */
const styles = {
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 30,
    background: "#2b2b2b",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "Arial, sans-serif"
  },
  title: {
    textAlign: "center",
    fontSize: 32,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  icon: {
    fontSize: 36
  },
  statusBanner: {
    background: "#1e4d2b",
    padding: 15,
    borderRadius: 8,
    marginBottom: 30,
    textAlign: "center",
    fontSize: 16,
    color: "#4ade80",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  statusIndicator: {
    fontSize: 18,
    fontWeight: "bold"
  },
  form: {
    background: "#363636",
    padding: 25,
    borderRadius: 8,
    marginBottom: 30
  },
  label: {
    display: "block",
    marginBottom: 5,
    marginTop: 10,
    fontSize: 14,
    color: "#ddd"
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 15
  },
  col: {
    display: "flex",
    flexDirection: "column"
  },
  input: {
    padding: 12,
    borderRadius: 5,
    border: "1px solid #555",
    background: "#fff",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box"
  },
  addButton: {
    padding: 12,
    background: "#ffb347",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    marginTop: 15
  },
  cancelButton: {
    padding: 12,
    background: "#666",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 16,
    color: "#fff",
    marginTop: 10
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "#363636",
    borderRadius: 8,
    overflow: "hidden"
  },
  tableHeader: {
    background: "#2b2b2b"
  },
  th: {
    padding: 15,
    textAlign: "left",
    color: "#ffb347",
    fontWeight: "bold",
    fontSize: 14,
    borderBottom: "2px solid #ffb347"
  },
  tableRow: {
    borderBottom: "1px solid #444"
  },
  td: {
    padding: 15,
    fontSize: 14,
    color: "#ddd"
  },
  link: {
    color: "#60a5fa",
    textDecoration: "none"
  },
  actionButtons: {
    display: "flex",
    gap: 10
  },
  editButton: {
    padding: 8,
    background: "#ffb347",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 16
  },
  deleteButton: {
    padding: 8,
    background: "#ef4444",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 16
  },
  loginWrapper: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#181818"
  },
  loginBox: {
    background: "#2b2b2b",
    padding: 40,
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    gap: 15,
    minWidth: 350
  },
  logout: {
    position: "fixed",
    top: 20,
    right: 20,
    padding: 12,
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    zIndex: 1000,
    fontSize: 14,
    fontWeight: "bold"
  }
};