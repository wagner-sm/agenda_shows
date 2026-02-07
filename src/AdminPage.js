import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";

const STORAGE_BUCKET = 'flyers';

async function uploadToSupabase(file) {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "no-cache"
      });

    if (uploadError) throw uploadError;

    await new Promise((resolve) => setTimeout(resolve, 600));

    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    if (!data?.publicUrl) {
      throw new Error("Falha ao gerar URL pública");
    }

    if (!data.publicUrl.includes("/object/public/")) {
      throw new Error("URL inválida (endpoint não público)");
    }

    return {
      url: data.publicUrl,
      path: fileName
    };
  } catch (error) {
    console.error("Erro uploadToSupabase:", error);
    throw error;
  }
}

async function deleteFromSupabase(filePath) {
  try {
    if (!filePath) return false;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Erro deleteFromSupabase:', error);
    throw error;
  }
}

function extractFilePathFromUrl(url) {
  if (!url) return null;
  
  try {
    url = url.trim();
    
    const patterns = [
      new RegExp(`/storage/v1/object/public/${STORAGE_BUCKET}/(.+)$`),
      new RegExp(`/${STORAGE_BUCKET}/(.+)$`),
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao extrair path:', error);
    return null;
  }
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
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data.session) {
        onLogin(true);
      }
    } catch (error) {
      setError(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.loginWrapper}>
      <form onSubmit={handleSubmit} style={styles.loginBox}>
        <h2>Admin Login</h2>

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
        />

        {error && <p style={{ color: "#ff6b6b", fontSize: 14 }}>{error}</p>}

        <button style={styles.addButton} disabled={loading}>
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
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);

  const [formData, setFormData] = useState({
    artista: "",
    data_inicio: "",
    data_fim: "",
    local: "",
    cidade: "",
    flyer: ""
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
    }
    setLoading(false);
  }, []);

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
      flyer: ""
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        showMessage('Por favor, selecione uma imagem válida (JPG, PNG, WEBP ou GIF)', 'error');
        e.target.value = '';
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        showMessage('A imagem deve ter no máximo 5MB', 'error');
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
    }
  };

  const saveShow = async (e) => {
    e.preventDefault();

    let { artista, data_inicio, data_fim, local, cidade, flyer } = formData;
    let newFlyerUrl = flyer;
    const oldFlyerPath = flyer ? extractFilePathFromUrl(flyer) : null;

    try {
      if (selectedFile) {
        setUploadProgress(true);
        showMessage('Fazendo upload da imagem...', 'success');

        if (editingId && oldFlyerPath) {
          try {
            await deleteFromSupabase(oldFlyerPath);
            showMessage('Imagem anterior removida do Storage', 'success');
          } catch (error) {
            console.error('Erro ao deletar imagem anterior:', error);
            showMessage('Aviso: Não foi possível remover a imagem anterior', 'error');
          }
        }

        const uploadResult = await uploadToSupabase(selectedFile);
        newFlyerUrl = uploadResult.url;

        showMessage('Upload concluído! Salvando dados...', 'success');
        setUploadProgress(false);
      }

      const showData = {
        artista,
        data_inicio,
        data_fim,
        local,
        cidade,
        flyer: newFlyerUrl
      };

      if (editingId) {
        const { error } = await supabase
          .from("shows")
          .update(showData)
          .eq("id", editingId);

        if (error) throw error;
        showMessage("✅ Show atualizado com sucesso!", 'success');
      } else {
        const { error } = await supabase
          .from("shows")
          .insert([showData]);

        if (error) throw error;
        showMessage("✅ Show adicionado com sucesso!", 'success');
      }

      resetForm();
      loadShows();
    } catch (error) {
      console.error('Erro ao salvar show:', error);
      showMessage(`❌ Erro: ${error.message}`, 'error');
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
      flyer: show.flyer || ""
    });
    setEditingId(show.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteShow = async (id) => {
    if (!window.confirm("Tem certeza que deseja deletar este show?")) return;

    try {
      const showToDelete = shows.find(s => s.id === id);
      let flyerPath = null;
      
      if (showToDelete?.flyer) {
        flyerPath = extractFilePathFromUrl(showToDelete.flyer);
        
        if (flyerPath) {
          try {
            await deleteFromSupabase(flyerPath);
            showMessage('Imagem removida do Storage', 'success');
          } catch (error) {
            console.error('Erro ao deletar imagem:', error);
            showMessage('Aviso: Não foi possível remover a imagem do Storage', 'error');
          }
        }
      }

      const { error } = await supabase
        .from("shows")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Atualizar queue_storage_deletes para marcar como processado
      if (flyerPath) {
        try {
          const { error: queueError } = await supabase
            .from("queue_storage_deletes")
            .update({ processed: true })
            .eq("name", flyerPath);

          if (queueError) {
            console.error('Erro ao atualizar queue_storage_deletes:', queueError);
          }
        } catch (error) {
          console.error('Erro ao atualizar fila de exclusões:', error);
        }
      }

      showMessage("✅ Show deletado com sucesso!", 'success');
      loadShows();
    } catch (error) {
      console.error('Erro ao deletar show:', error);
      showMessage(`❌ Erro ao deletar: ${error.message}`, 'error');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>
        <span style={styles.icon}>🎉</span>
        <h1>Painel Administrativo - Shows</h1>
      </div>

      <form style={styles.form} onSubmit={saveShow}>
        <h3 style={{ marginTop: 0 }}>{editingId ? "Editar Show" : "Adicionar Novo Show"}</h3>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Artista *</label>
            <input
              style={styles.input}
              value={formData.artista}
              onChange={(e) => handleInputChange("artista", e.target.value)}
              placeholder="Nome do artista"
              required
            />
          </div>

          <div style={styles.col}>
            <label style={styles.label}>Local *</label>
            <input
              style={styles.input}
              value={formData.local}
              onChange={(e) => handleInputChange("local", e.target.value)}
              placeholder="Nome do local"
              required
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Data Início *</label>
            <input
              type="date"
              style={styles.input}
              value={formData.data_inicio}
              onChange={(e) => handleInputChange("data_inicio", e.target.value)}
              required
            />
          </div>

          <div style={styles.col}>
            <label style={styles.label}>Data Fim</label>
            <input
              type="date"
              style={styles.input}
              value={formData.data_fim}
              onChange={(e) => handleInputChange("data_fim", e.target.value)}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.col}>
            <label style={styles.label}>Cidade *</label>
            <input
              style={styles.input}
              value={formData.cidade}
              onChange={(e) => handleInputChange("cidade", e.target.value)}
              placeholder="Nome da cidade"
              required
            />
          </div>

          <div style={styles.col}>
            <label style={styles.label}>Flyer (imagem)</label>
            <input
              type="file"
              accept="image/*"
              style={styles.input}
              onChange={handleFileChange}
            />
            {selectedFile && (
              <p style={{ fontSize: 12, color: '#4ade80', marginTop: 5 }}>
                ✓ {selectedFile.name}
              </p>
            )}
            {formData.flyer && !selectedFile && (
              <p style={{ fontSize: 12, color: '#60a5fa', marginTop: 5 }}>
                📷 Imagem atual: <a href={formData.flyer} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>Ver</a>
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          style={styles.addButton}
          disabled={uploadProgress}
        >
          {uploadProgress ? "Enviando imagem..." : editingId ? "Salvar Alteração" : "Adicionar Show"}
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

export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(!!session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      <div style={styles.loginWrapper}>
        <p style={{ color: '#fff' }}>Carregando...</p>
      </div>
    );
  }

  if (!auth) return <LoginForm onLogin={setAuth} />;

  return (
    <>
      <button
        onClick={handleLogout}
        style={styles.logout}
      >
        Sair
      </button>
      <AdminPanel />
    </>
  );
}

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
    overflow: "hidden",
    marginTop: 30
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
