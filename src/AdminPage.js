import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";

/* ============================
   SUPABASE STORAGE HELPERS
============================ */
const STORAGE_BUCKET = 'flyers'; // Nome do bucket no Supabase Storage

// Helper para fazer upload de imagem para o Supabase Storage
async function uploadToSupabase(file) {
  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    // 1️⃣ Upload sem cache + contentType explícito
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        upsert: false,
        contentType: file.type,
        cacheControl: "no-cache"
      });

    if (uploadError) throw uploadError;

    // 2️⃣ Delay OBRIGATÓRIO (Firefox / Edge / Safari)
    await new Promise((resolve) => setTimeout(resolve, 600));

    // 3️⃣ Gera URL pública (única URL válida para browser)
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    if (!data?.publicUrl) {
      throw new Error("Falha ao gerar URL pública");
    }

    // 4️⃣ Garantia extra: nunca aceitar URL sem /public/
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

// Helper para deletar imagem do Supabase Storage
async function deleteFromSupabase(filePath) {
  try {
    if (!filePath) return false;

    console.log('Deletando arquivo do Storage:', filePath);

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Erro no deleteFromSupabase:', error);
      throw error;
    }

    console.log('Arquivo deletado com sucesso:', filePath);
    return true;
  } catch (error) {
    console.error('Erro deleteFromSupabase:', error);
    throw error;
  }
}

// Helper para extrair o path do arquivo da URL
function extractFilePathFromUrl(url) {
  if (!url) return null;
  
  try {
    // Remove espaços em branco
    url = url.trim();
    
    console.log('Extraindo path da URL:', url);
    
    // Tenta extrair o path de diferentes formatos de URL do Supabase
    // Formato: https://[projeto].supabase.co/storage/v1/object/public/flyers/arquivo.jpg
    const patterns = [
      new RegExp(`/storage/v1/object/public/${STORAGE_BUCKET}/(.+)$`),
      new RegExp(`/${STORAGE_BUCKET}/(.+)$`),
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        console.log('Path extraído:', match[1]);
        return match[1];
      }
    }
    
    console.warn('Não foi possível extrair o path da URL:', url);
    return null;
  } catch (error) {
    console.error('Erro ao extrair path:', error);
    return null;
  }
}

/* ============================
   LOGIN COM SUPABASE AUTH
============================ */
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

/* ============================
        PAINEL ADMIN
============================ */
function AdminPanel() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
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
    
    // Pega o email do usuário logado
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email);
      }
    });
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
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        showMessage('Por favor, selecione uma imagem válida (JPG, PNG, WEBP ou GIF)', 'error');
        e.target.value = '';
        return;
      }

      // Validar tamanho (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
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

    console.log('=== SALVANDO SHOW ===');
    console.log('Editando ID:', editingId);
    console.log('Old flyer URL:', flyer);
    console.log('Old flyer path:', oldFlyerPath);
    console.log('Novo arquivo selecionado:', selectedFile?.name);

    try {
      // Se há um arquivo selecionado, fazer upload
      if (selectedFile) {
        setUploadProgress(true);
        showMessage('Fazendo upload da imagem...', 'success');

        // Se está editando e existe uma imagem anterior, deletar
        if (editingId && oldFlyerPath) {
          try {
            console.log('Deletando imagem anterior:', oldFlyerPath);
            const deleted = await deleteFromSupabase(oldFlyerPath);
            
            if (deleted) {
              showMessage('Imagem anterior removida do Storage', 'success');
            }
          } catch (error) {
            console.error('Erro ao deletar imagem anterior:', error);
            showMessage('Aviso: Não foi possível remover a imagem anterior', 'error');
            // Continua mesmo se falhar ao deletar a imagem anterior
          }
        }

        // Upload da nova imagem
        const uploadResult = await uploadToSupabase(selectedFile);
        newFlyerUrl = uploadResult.url;
        console.log('Nova URL do flyer:', newFlyerUrl);
        
        showMessage('Imagem enviada com sucesso!', 'success');
        setUploadProgress(false);
      }

      const payload = {
        artista,
        data_inicio,
        data_fim: data_fim || null,
        local,
        cidade,
        flyer: newFlyerUrl || null
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
      setUploadProgress(false);
    }
  };

  const editShow = (show) => {
    setEditingId(show.id);
    setSelectedFile(null);
    setFormData({
      artista: show.artista,
      data_inicio: show.data_inicio,
      data_fim: show.data_fim || "",
      local: show.local,
      cidade: show.cidade,
      flyer: show.flyer || ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteShow = async (id) => {
    if (!window.confirm("Marcar este show para exclusão? (O cron do banco irá removê-lo automaticamente)")) return;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      console.log('=== EXCLUINDO SHOW ===');
      console.log('Show ID:', id);

      // Busca o show para pegar o flyer antes de deletar
      const showToDelete = shows.find(s => s.id === id);
      console.log('Show encontrado:', showToDelete);
      
      // Se existe flyer, extrair o path e tentar deletar do Storage
      if (showToDelete?.flyer && showToDelete.flyer.trim() !== '') {
        console.log('URL do flyer:', showToDelete.flyer);
        
        const flyerPath = extractFilePathFromUrl(showToDelete.flyer);
        console.log('Path extraído:', flyerPath);
        
        if (flyerPath) {
          try {
            console.log('Tentando deletar imagem do Storage. Path:', flyerPath);
            const deleted = await deleteFromSupabase(flyerPath);
            
            if (deleted) {
              showMessage('Imagem removida do Storage com sucesso', 'success');
            }
          } catch (error) {
            console.error('Erro ao deletar imagem do Storage:', error);
            // Continua mesmo se falhar ao deletar a imagem
            showMessage('Aviso: Não foi possível remover a imagem do Storage', 'error');
          }
        } else {
          console.warn('Não foi possível extrair o path da imagem');
        }
      } else {
        console.log('Show não possui flyer ou flyer está vazio');
      }

      // Deleta o show do banco
      console.log('Deletando show do banco de dados...');
      const response = await supabase.from("shows").delete().eq("id", id);
      
      if (!response.error) {
        // Se o show foi deletado com sucesso e tinha um flyer, atualizar queue_storage_deletes
        if (showToDelete?.flyer && showToDelete.flyer.trim() !== '') {
          const flyerPath = extractFilePathFromUrl(showToDelete.flyer);
          
          if (flyerPath) {
            try {
              console.log('Atualizando queue_storage_deletes para:', flyerPath);
              const updateResponse = await supabase
                .from('queue_storage_deletes')
                .update({ processed: true })
                .eq('name', flyerPath);
              
              if (updateResponse.error) {
                console.error('Erro ao atualizar queue_storage_deletes:', updateResponse.error);
              } else {
                console.log('queue_storage_deletes atualizado com sucesso');
              }
            } catch (error) {
              console.error('Erro ao atualizar queue_storage_deletes:', error);
              // Não mostra erro para o usuário, pois o show já foi deletado com sucesso
            }
          }
        }
        
        showMessage('Show excluído com sucesso!', 'success');
        loadShows();
        resetForm();
      } else {
        console.error('Erro ao deletar do banco:', response.error);
        showMessage(response.error.message, 'error');
=======
      // Encontra o show para pegar as datas
      const showToDelete = shows.find(show => show.id === id);
      
      if (showToDelete) {
        // Calcula um dia anterior à data_inicio ou data_fim (se preenchida)
        const dateToChange = showToDelete.data_fim || showToDelete.data_inicio;
        const currentDate = new Date(dateToChange);
        const previousDate = new Date(currentDate);
        previousDate.setDate(previousDate.getDate() - 1);
        
        // Formata para YYYY-MM-DD
        const formattedPreviousDate = previousDate.toISOString().split('T')[0];
        
        // Atualiza a data para marcar para exclusão (o cron do banco irá excluir)
        const updatePayload = {};
        if (showToDelete.data_fim) {
          updatePayload.data_fim = formattedPreviousDate;
        } else {
          updatePayload.data_inicio = formattedPreviousDate;
        }
        
        const response = await supabase
          .from("shows")
          .update(updatePayload)
          .eq("id", id);
        
        if (!response.error) {
          showMessage('Show marcado para exclusão!', 'success');
          loadShows();
          resetForm();
        } else {
          showMessage(response.error.message, 'error');
        }
>>>>>>> dd19e3856ae2d604165815f7c485541ebb8b1fde
      }
    } catch (error) {
      console.error('Erro ao marcar para exclusão:', error);
      showMessage(`Erro ao marcar para exclusão: ${error.message}`, 'error');
    }
  };  

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>
        <span style={styles.icon}>🎵</span> Gerenciar Shows
      </h1>

      <div style={styles.statusBanner}>
        <span style={styles.statusIndicator}>✓</span> API Online - Conectado ao Supabase
        {userEmail && <span style={{ marginLeft: 20, fontSize: 14 }}>• {userEmail}</span>}
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

        <label style={styles.label}>
          Imagem do Flyer:
          {formData.flyer && (
            <span style={{ marginLeft: 10, color: '#4ade80', fontSize: 12 }}>
              (Imagem atual será mantida se não selecionar nova)
            </span>
          )}
        </label>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          style={{
            ...styles.input,
            padding: 8,
            cursor: 'pointer'
          }}
        />
        {selectedFile && (
          <p style={{ fontSize: 12, color: '#4ade80', marginTop: 5 }}>
            Arquivo selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
          </p>
        )}
        {formData.flyer && !selectedFile && (
          <p style={{ fontSize: 12, color: '#60a5fa', marginTop: 5 }}>
            <a href={formData.flyer} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
              Ver imagem atual
            </a>
          </p>
        )}

        <button 
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

/* ============================
        ADMIN PAGE
============================ */
export default function AdminPage() {
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifica se já existe uma sessão ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(!!session);
      setLoading(false);
    });

    // Escuta mudanças no estado de autenticação
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