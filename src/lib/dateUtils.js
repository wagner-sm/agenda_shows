// Converte data ISO (yyyy-mm-dd) para Date local (evita offset UTC)
export function parseISO(dateISO) {
  if (!dateISO) return null;
  const [year, month, day] = dateISO.split("-");
  return new Date(+year, +month - 1, +day);
}

// Formata data ISO para dd/mm/yyyy
export function formatarData(dataISO) {
  if (!dataISO) return "";
  const data = parseISO(dataISO);
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Retorna string de exibição para intervalo de datas
export function mostrarData(show) {
  const inicio = formatarData(show.data_inicio);
  if (show.data_inicio === show.data_fim || !show.data_fim) return inicio;
  return `${inicio} a ${formatarData(show.data_fim)}`;
}
