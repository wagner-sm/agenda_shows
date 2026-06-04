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

// Retorna string de exibicao para intervalo de datas
export function mostrarData(show) {
  const inicio = parseISO(show.data_inicio);
  const fim    = parseISO(show.data_fim || show.data_inicio);

  const pad = (n) => String(n).padStart(2, "0");

  const dI = pad(inicio.getDate());
  const mI = pad(inicio.getMonth() + 1);
  const aI = inicio.getFullYear();

  const dF = pad(fim.getDate());
  const mF = pad(fim.getMonth() + 1);
  const aF = fim.getFullYear();

  // Mesmo dia
  if (inicio.getTime() === fim.getTime()) {
    return `${dI}/${mI}/${aI}`;
  }

  const diffDays = Math.round((fim - inicio) / (1000 * 60 * 60 * 24));

  // Meses ou anos diferentes -> mostra mes nos dois lados
  if (mI !== mF || aI !== aF) {
    return `${dI}/${mI} a ${dF}/${mF}/${aF}`;
  }

  // Mesmo mes, 1 dia de diferenca -> "05 e 06/06/2026"
  if (diffDays === 1) {
    return `${dI} e ${dF}/${mF}/${aF}`;
  }

  // Mesmo mes, 2+ dias -> "05 a 07/06/2026"
  return `${dI} a ${dF}/${mF}/${aF}`;
}