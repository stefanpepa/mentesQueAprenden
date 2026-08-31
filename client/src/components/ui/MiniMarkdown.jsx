// Renderiza el subconjunto de Markdown que efectivamente devuelven los
// modelos de IA del proyecto: **negrita**, listas con "-" (con indentación
// simple) y párrafos separados por líneas en blanco. No es un parser
// completo de Markdown a propósito — evita sumar una dependencia para esto.

function renderizarInline(texto) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    return parte;
  });
}

export default function MiniMarkdown({ text, className = '' }) {
  if (!text) return null;

  const bloques = text.split(/\n{2,}/);

  return (
    <div className={className}>
      {bloques.map((bloque, i) => {
        const lineas = bloque.split('\n').filter(l => l.trim());
        const esLista = lineas.length > 0 && lineas.every(l => /^\s*-\s+/.test(l));

        if (esLista) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-0.5 mb-2 last:mb-0">
              {lineas.map((linea, j) => {
                const indentado = /^\s{2,}-/.test(linea);
                const contenido = linea.replace(/^\s*-\s+/, '');
                return (
                  <li key={j} className={indentado ? 'ml-4 list-[circle]' : ''}>
                    {renderizarInline(contenido)}
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <p key={i} className="mb-2 last:mb-0 whitespace-pre-wrap">
            {lineas.map((linea, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderizarInline(linea)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
