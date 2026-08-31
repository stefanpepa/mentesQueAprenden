import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MARGEN = 20;
const ANCHO_UTIL = 210 - MARGEN * 2;
const ALTO_PAGINA = 297 - MARGEN;

// Exporta el texto del informe (ya generado por IA) a un PDF descargable,
// con un encabezado simple con los datos del profesional y del paciente.
export function exportarInformePdf(evaluacion) {
  const doc = new jsPDF();
  let y = MARGEN;

  const agregarSalto = (alto) => {
    if (y + alto > ALTO_PAGINA) {
      doc.addPage();
      y = MARGEN;
    }
  };

  // Encabezado
  doc.setFontSize(10);
  doc.setFont(undefined, 'italic');
  doc.text(`${evaluacion.profesional?.apellido}, ${evaluacion.profesional?.nombre} — ${evaluacion.profesional?.especialidad}`, MARGEN, y);
  y += 5;
  if (evaluacion.profesional?.matricula) {
    doc.text(`M.P. ${evaluacion.profesional.matricula}`, MARGEN, y);
    y += 5;
  }
  y += 5;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(16);
  doc.text('Informe Psicopedagógico', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(11);
  doc.text(`Nombre: ${evaluacion.paciente?.apellido}, ${evaluacion.paciente?.nombre}`, MARGEN, y);
  y += 7;
  doc.text(`Fecha de evaluación: ${format(new Date(evaluacion.fecha_evaluacion), "d 'de' MMMM yyyy", { locale: es })}`, MARGEN, y);
  y += 12;

  // Cuerpo del informe (texto generado, respetando saltos de línea/párrafo)
  doc.setFontSize(10.5);
  const texto = evaluacion.informe_generado || '';
  const parrafos = texto.split(/\n{2,}/);

  parrafos.forEach((parrafo) => {
    const lineaTitulo = /^[A-ZÁÉÍÓÚÑ0-9\s.-]{3,60}$/.test(parrafo.trim().split('\n')[0])
      && parrafo.trim().split('\n')[0] === parrafo.trim().split('\n')[0].toUpperCase();

    const lineas = doc.splitTextToSize(parrafo.trim(), ANCHO_UTIL);
    agregarSalto(lineas.length * 5 + 6);

    if (lineaTitulo) {
      doc.setFont(undefined, 'bold');
    } else {
      doc.setFont(undefined, 'normal');
    }
    doc.text(lineas, MARGEN, y);
    y += lineas.length * 5 + 6;
  });

  const nombreArchivo = `Informe_${evaluacion.paciente?.apellido}_${evaluacion.paciente?.nombre}_${format(new Date(evaluacion.fecha_evaluacion), 'yyyy-MM-dd')}.pdf`.replace(/\s+/g, '_');
  doc.save(nombreArchivo);
}
