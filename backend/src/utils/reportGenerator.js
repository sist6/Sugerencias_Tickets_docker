// src/utils/reportGenerator.js
/*********************************************************************
 *  Generadores de PDF y Excel para el informe de tickets.
 *
 *  Dependencias:
 *    - pdfmake            → npm i pdfmake
 *    - exceljs            → npm i exceljs
 *
 *********************************************************************/

const ExcelJS = require("exceljs");

// ---------- IMPORTAR PDFMAKE CORRECTAMENTE ----------
let PdfPrinter = require("pdfmake");

// Si la exportación es un objeto con la propiedad `default`, la usamos.
if (PdfPrinter && PdfPrinter.default) {
  PdfPrinter = PdfPrinter.default;
}

/* -------------------------------------------------------------
   CONFIGURACIÓN DE FUENTES (pdfmake necesita al menos una fuente)
   ------------------------------------------------------------- */
const fonts = {
  Roboto: {
    // Puedes usar cualquier fuente que tengas en el proyecto.
    // En muchos entornos basta con no especificar nada (pdfmake incluye Roboto
    // en su VFS). Aquí mantenemos la configuración mínima.
    normal:
      "node_modules/pdfmake/build/vfs_fonts.js", // <-- ruta a los fonts embebidos
    bold:
      "node_modules/pdfmake/build/vfs_fonts.js",
    italics:
      "node_modules/pdfmake/build/vfs_fonts.js",
    bolditalics:
      "node_modules/pdfmake/build/vfs_fonts.js",
  },
};

const printer = new PdfPrinter(fonts);

/* -------------------------------------------------------------
   FUNCIÓN QUE GENERA EL PDF (devuelve un Buffer)
   ------------------------------------------------------------- */
async function generatePdfReport(data) {
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 50, 40, 60],
    content: [
      { text: "Informe de tickets", style: "title", alignment: "center" },
      { text: `Hotel: ${data.hotel}`, style: "subTitle", alignment: "center" },
      {
        text:
          data.period === "month"
            ? `Mes ${data.month}/${data.year}`
            : `Año ${data.year}`,
        style: "subTitle",
        alignment: "center",
      },
      { text: "\n", margin: [0, 5] },

      // ---- KPIs -------------------------------------------------
      {
        style: "kpiTable",
        table: {
          widths: ["*"],
          body: [
            [
              {
                stack: [
                  { text: "Tickets resueltos este mes", style: "kpiLabel" },
                  {
                    text: `${data.stats.tickets_this_month || 0}`,
                    style: "kpiValue",
                  },
                ],
              },
            ],
            [
              {
                stack: [
                  { text: "Tickets resueltos esta semana", style: "kpiLabel" },
                  {
                    text: `${data.stats.tickets_this_week || 0}`,
                    style: "kpiValue",
                  },
                ],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 10, 0, 20],
      },

      // ---- Distribución por incidentes ----------------------------
      {
        style: "distributionTable",
        table: {
          headerRows: 1,
          widths: ["*", "auto"],
          body: [
            [
              { text: "Tipo de Incidencia", style: "tableHeader" },
              { text: "Cantidad", style: "tableHeader", alignment: "right" },
            ],
            ...data.byIncidentType.map((r) => [
              { text: r.name },
              { text: `${r.value}`, alignment: "right" },
            ]),
          ],
        },
        margin: [0, 0, 0, 15],
      },

      // ---- Distribución por solución ------------------------------
      {
        style: "distributionTable",
        table: {
          headerRows: 1,
          widths: ["*", "auto"],
          body: [
            [
              { text: "Tipo de Solución", style: "tableHeader" },
              { text: "Cantidad", style: "tableHeader", alignment: "right" },
            ],
            ...data.bySolutionType.map((r) => [
              { text: r.name },
              { text: `${r.value}`, alignment: "right" },
            ]),
          ],
        },
        margin: [0, 0, 0, 15],
      },

      // ---- Tabla de tickets --------------------------------------
      {
        style: "ticketsTable",
        table: {
          headerRows: 1,
          widths: [
            "*",        // título
            "auto",    // creado
            "auto",    // estado
            "auto",    // prioridad
            "*",       // tipo incidencia
            "*",       // hotel
            "*",       // asignado a
          ],
          body: [
            [
              { text: "Título", style: "tableHeader" },
              { text: "Creado", style: "tableHeader", alignment: "right" },
              { text: "Estado", style: "tableHeader", alignment: "right" },
              { text: "Prioridad", style: "tableHeader", alignment: "right" },
              { text: "Tipo Incid.", style: "tableHeader" },
              { text: "Hotel", style: "tableHeader" },
              { text: "Asignado a", style: "tableHeader" },
            ],
            ...data.tickets.map((t) => [
              { text: t.title },
              {
                text: new Date(t.created_at).toLocaleDateString(),
                alignment: "right",
              },
              { text: t.status, alignment: "right" },
              { text: t.priority, alignment: "right" },
              { text: t.ticket_type_name || "-" },
              { text: t.hotel_name || "-" },
              { text: t.assigned_to_name || "-" },
            ]),
          ],
        },
        margin: [0, 0, 0, 15],
      },
    ],
    styles: {
      title: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
      subTitle: { fontSize: 12, italics: true },
      kpiLabel: { fontSize: 10, color: "#555" },
      kpiValue: { fontSize: 16, bold: true, margin: [0, 2, 0, 0] },
      kpiTable: { margin: [0, 5, 0, 5] },
      sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
      tableHeader: { bold: true, fillColor: "#eeeeee", margin: [0, 2, 0, 2] },
      distributionTable: { margin: [0, 2, 0, 2] },
      ticketsTable: { margin: [0, 2, 0, 2] },
    },
    defaultStyle: { font: "Roboto" },
  };

  // pdfmake devuelve un stream; lo convertimos a Buffer
  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}

/* -------------------------------------------------------------
   FUNCIÓN QUE GENERA EL EXCEL (sin cambios)
   ------------------------------------------------------------- */
async function generateExcelReport(data) {
  const workbook = new ExcelJS.Workbook();

  // ---- Hoja 1 → RESUMEN ----
  const summarySheet = workbook.addWorksheet("Resumen");
  summarySheet.columns = [
    { header: "Concepto", width: 30 },
    { header: "Valor", width: 20 },
  ];
  summarySheet.addRows([
    ["Hotel", data.hotel],
    [
      "Periodo",
      data.period === "month"
        ? `Mes ${data.month}/${data.year}`
        : `Año ${data.year}`,
    ],
    ["Tickets resueltos este mes", data.stats.tickets_this_month || 0],
    ["Tickets resueltos esta semana", data.stats.tickets_this_week || 0],
  ]);
  summarySheet.getRow(1).font = { bold: true };

  // ---- Hoja 2 → INCIDENTES ----
  const incSheet = workbook.addWorksheet("Incidencias");
  incSheet.columns = [
    { header: "Tipo de Incidencia", key: "name", width: 30 },
    { header: "Cantidad", key: "value", width: 15 },
  ];
  incSheet.addRows(data.byIncidentType);
  incSheet.getRow(1).font = { bold: true };

  // ---- Hoja 3 → SOLUCIONES ----
  const solSheet = workbook.addWorksheet("Soluciones");
  solSheet.columns = [
    { header: "Tipo de Solución", key: "name", width: 30 },
    { header: "Cantidad", key: "value", width: 15 },
  ];
  solSheet.addRows(data.bySolutionType);
  solSheet.getRow(1).font = { bold: true };

  // ---- Hoja 4 → LISTADO DE TICKETS ----
  const ticketsSheet = workbook.addWorksheet("Tickets");
  ticketsSheet.columns = [
    { header: "Título", key: "title", width: 30 },
    { header: "Creado", key: "created_at", width: 18 },
    { header: "Estado", key: "status", width: 15 },
    { header: "Prioridad", key: "priority", width: 12 },
    { header: "Tipo incidencia", key: "ticket_type_name", width: 25 },
    { header: "Hotel", key: "hotel_name", width: 20 },
    { header: "Asignado a", key: "assigned_to_name", width: 20 },
  ];
  const ticketsRows = data.tickets.map((t) => ({
    title: t.title,
    created_at: new Date(t.created_at).toLocaleString(),
    status: t.status,
    priority: t.priority,
    ticket_type_name: t.ticket_type_name || "-",
    hotel_name: t.hotel_name || "-",
    assigned_to_name: t.assigned_to_name || "-",
  }));
  ticketsSheet.addRows(ticketsRows);
  ticketsSheet.getRow(1).font = { bold: true };

  // ---------- DEVOLVER EL BUFFER ----------
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/* -------------------------------------------------------------
   EXPORTS
   ------------------------------------------------------------- */
module.exports = {
  generatePdfReport,
  generateExcelReport,
};
