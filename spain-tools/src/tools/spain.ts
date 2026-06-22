import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ─────────────────────────────────────────────
// CONSTANTS — AEAT official rates 2024/2025
// ─────────────────────────────────────────────
const IVA_RATES = {
  general: { rate: 21, name: 'IVA General (21%)' },
  reducido: { rate: 10, name: 'IVA Reducido (10%)' },
  superreducido: { rate: 4, name: 'IVA Superreducido (4%)' },
};

const IRPF_BRACKETS_2025 = [
  { min: 0, max: 12450, rate: 19 },
  { min: 12450, max: 20200, rate: 24 },
  { min: 20200, max: 35200, rate: 30 },
  { min: 35200, max: 60000, rate: 37 },
  { min: 60000, max: 300000, rate: 45 },
  { min: 300000, max: Infinity, rate: 47 },
];

// ─────────────────────────────────────────────
// INVOICE VALIDATION
// ─────────────────────────────────────────────
function validateInvoiceInput(data: any): void {
  if (!data.invoice_number || !/^[A-Z0-9/-]{1,30}$/.test(data.invoice_number)) {
    throw new Error('invoice_number: alphanumeric, max 30 chars required');
  }
  if (!data.seller_name) throw new Error('seller_name required');
  if (!data.buyer_name) throw new Error('buyer_name required');
  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('items: array with at least one line item required');
  }
  for (const item of data.items) {
    if (!item.description) throw new Error('item.description required');
    if (typeof item.base !== 'number' || item.base < 0) throw new Error('item.base must be a non-negative number');
    const validTypes = ['general', 'reducido', 'superreducido', 'exento'];
    if (!validTypes.includes(item.iva_type)) throw new Error(`item.iva_type must be one of: ${validTypes.join(', ')}`);
    if (data.retention && (typeof data.retention !== 'number' || data.retention < 0 || data.retention > 100)) {
      throw new Error('retention must be a number between 0 and 100');
    }
  }
}

function validateModelo303(data: any): void {
  if (!data.quarter || ![1, 2, 3, 4].includes(data.quarter)) throw new Error('quarter must be 1, 2, 3, or 4');
  if (!data.year || data.year < 2020 || data.year > 2030) throw new Error('year must be between 2020 and 2030');
  if (!Array.isArray(data.sales)) throw new Error('sales array required');
  if (!Array.isArray(data.purchases)) throw new Error('purchases array required');
}

function validateIrpf(data: any): void {
  if (typeof data.annual_gross !== 'number' || data.annual_gross < 0) throw new Error('annual_gross must be a non-negative number');
  if (data.deductions < 0 || data.deductions > data.annual_gross) throw new Error('invalid deductions value');
}

// ─────────────────────────────────────────────
// INVOICE GENERATOR
// ─────────────────────────────────────────────
function generateInvoice(data: {
  invoice_number: string;
  date: string;
  due_date?: string;
  seller_name: string;
  seller_nif: string;
  seller_address?: string;
  seller_email?: string;
  buyer_name: string;
  buyer_nif?: string;
  buyer_address?: string;
  items: Array<{ description: string; base: number; iva_type: string; quantity?: number }>;
  retention?: number;
  notes?: string;
  format?: 'html' | 'md';
}): string {
  validateInvoiceInput(data);

  const date = data.date || new Date().toISOString().split('T')[0];
  const due_date = data.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const ivaTypeLabel: Record<string, string> = {
    general: '21%', reducido: '10%', superreducido: '4%', exento: '0%'
  };

  const lines: Array<{ desc: string; qty: number; base: number; iva: number; iva_pct: number; total: number }> = [];
  let totalBase = 0;
  let totalIva = 0;
  let totalRetencion = 0;

  for (const item of data.items) {
    const qty = item.quantity || 1;
    const base = item.base * qty;
    let iva_pct = 0;
    if (item.iva_type === 'general') iva_pct = 21;
    else if (item.iva_type === 'reducido') iva_pct = 10;
    else if (item.iva_type === 'superreducido') iva_pct = 4;
    const iva = item.iva_type === 'exento' ? 0 : Math.round(base * iva_pct) / 100;
    const total = base + iva;
    totalBase += base;
    totalIva += iva;
    lines.push({ desc: item.description, qty, base, iva, iva_pct, total });
  }

  if (data.retention) {
    totalRetencion = Math.round(totalBase * data.retention) / 100;
  }

  const totalFactura = totalBase + totalIva - totalRetencion;

  // ── MARKDOWN FORMAT ──
  if (data.format !== 'html') {
    const fmtIva = (n: number) => n.toFixed(2) + ' EUR';
    let md = '';
    md += `# FACTURA ${data.invoice_number}\n\n`;
    md += `| Campo | Valor |\n|---|---|\n`;
    md += `| **Fecha** | ${date} |\n`;
    md += `| **Vencimiento** | ${due_date} |\n`;
    md += `| **NIF Vendedor** | ${data.seller_nif} |\n`;
    md += `| **Vendedor** | ${data.seller_name} |\n`;
    if (data.seller_address) md += `| **Dirección** | ${data.seller_address} |\n`;
    md += `| **NIF Comprador** | ${data.buyer_nif || '—'} |\n`;
    md += `| **Comprador** | ${data.buyer_name} |\n\n`;
    md += `## Detalle\n\n`;
    md += `| Descripción | Cant. | Base | IVA | Importe IVA | Total |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const l of lines) {
      const ivaLabel = ivaTypeLabel[l.iva === 0 ? 'exento' : l.iva_pct === 21 ? 'general' : l.iva_pct === 10 ? 'reducido' : 'superreducido'];
      md += `| ${l.desc} | ${l.qty} | ${fmtIva(l.base)} | ${ivaLabel} | ${fmtIva(l.iva)} | ${fmtIva(l.total)} |\n`;
    }
    md += `\n## Resumen\n\n`;
    md += `| Concepto | Importe |\n|---|---|\n`;
    md += `| **Base imponible** | ${fmtIva(totalBase)} |\n`;
    md += `| **IVA** | ${fmtIva(totalIva)} |\n`;
    if (data.retention) md += `| **Retención IRPF ${data.retention}%** | -${fmtIva(totalRetencion)} |\n`;
    md += `| **TOTAL FACTURA** | **${fmtIva(totalFactura)}** |\n`;
    if (data.notes) md += `\n## Notas\n\n${data.notes}\n`;
    md += `\n---\n*Factura generada con CodeBlueprint Spain Tools*\n`;
    return md;
  }

  // ── HTML FORMAT ──
  const fmtEur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Factura ${data.invoice_number}</title>`;
  html += `<style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; color: #333; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1a1a2e; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .company { font-weight: bold; font-size: 1.1rem; }
    .invoice-title { color: #1a1a2e; font-size: 1.5rem; text-align: right; }
    .invoice-num { text-align: right; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th { background: #1a1a2e; color: white; padding: 0.5rem; text-align: left; }
    td { padding: 0.5rem; border-bottom: 1px solid #eee; }
    .right { text-align: right; }
    .total-row { font-weight: bold; background: #f5f5f5; }
    .footer { margin-top: 2rem; font-size: 0.8rem; color: #888; border-top: 1px solid #eee; padding-top: 1rem; }
    .summary { margin-top: 1rem; }
  </style></head><body>`;
  html += `<div class="header"><div><div class="company">${data.seller_name}</div><div>${data.seller_nif}</div>${data.seller_address ? `<div>${data.seller_address}</div>` : ''}${data.seller_email ? `<div>${data.seller_email}</div>` : ''}</div>`;
  html += `<div><div class="invoice-title">FACTURA</div><div class="invoice-num">${data.invoice_number}<br>Fecha: ${date}<br>Vencimiento: ${due_date}</div></div></div>`;
  html += `<table><thead><tr><th>Descripción</th><th>Cant.</th><th class="right">Base (EUR)</th><th class="right">IVA</th><th class="right">Importe IVA (EUR)</th><th class="right">Total (EUR)</th></tr></thead><tbody>`;
  for (const l of lines) {
    const ivaLabel = l.iva === 0 ? 'Exento' : `${l.iva_pct}%`;
    html += `<tr><td>${l.desc}</td><td>${l.qty}</td><td class="right">${fmtEur(l.base)}</td><td class="right">${ivaLabel}</td><td class="right">${fmtEur(l.iva)}</td><td class="right">${fmtEur(l.total)}</td></tr>`;
  }
  html += `</tbody></table>`;
  html += `<table class="summary"><tr><td class="right" style="width:70%"><strong>Base imponible:</strong></td><td class="right">${fmtEur(totalBase)}</td></tr>`;
  html += `<tr><td class="right"><strong>IVA:</strong></td><td class="right">${fmtEur(totalIva)}</td></tr>`;
  if (data.retention) html += `<tr><td class="right"><strong>Retención IRPF ${data.retention}%:</strong></td><td class="right">-${fmtEur(totalRetencion)}</td></tr>`;
  html += `<tr class="total-row"><td class="right"><strong>TOTAL FACTURA:</strong></td><td class="right"><strong>${fmtEur(totalFactura)}</strong></td></tr></table>`;
  if (data.notes) html += `<p><em>Notas: ${data.notes}</em></p>`;
  html += `<div class="footer"><strong>Vendedor:</strong> ${data.seller_name} (${data.seller_nif})<br><strong>Comprador:</strong> ${data.buyer_name}${data.buyer_nif ? ` (${data.buyer_nif})` : ''}<br>Factura generada con CodeBlueprint Spain Tools</div></body></html>`;
  return html;
}

// ─────────────────────────────────────────────
// MODELO 303 CALCULATOR
// ─────────────────────────────────────────────
function calcModelo303(data: {
  quarter: number;
  year: number;
  sales: Array<{ base: number; iva_type: string }>;
  purchases: Array<{ base: number; iva_type: string }>;
}): string {
  validateModelo303(data);

  const getIva = (base: number, type: string): number => {
    if (type === 'exento') return 0;
    if (type === 'general') return base * 0.21;
    if (type === 'reducido') return base * 0.10;
    if (type === 'superreducido') return base * 0.04;
    return 0;
  };

  const devengado = { iva21: 0, iva10: 0, iva4: 0, exento: 0, totalDevengado: 0 };
  const soportado = { iva21: 0, iva10: 0, iva4: 0, exento: 0, totalSoportado: 0 };

  for (const s of data.sales) {
    const iva = getIva(s.base, s.iva_type);
    if (s.iva_type === 'general') { devengado.iva21 += iva; devengado.totalDevengado += s.base + iva; }
    else if (s.iva_type === 'reducido') { devengado.iva10 += iva; devengado.totalDevengado += s.base + iva; }
    else if (s.iva_type === 'superreducido') { devengado.iva4 += iva; devengado.totalDevengado += s.base + iva; }
    else { devengado.exento += s.base; devengado.totalDevengado += s.base; }
  }

  for (const p of data.purchases) {
    const iva = getIva(p.base, p.iva_type);
    if (p.iva_type === 'general') { soportado.iva21 += iva; soportado.totalSoportado += p.base + iva; }
    else if (p.iva_type === 'reducido') { soportado.iva10 += iva; soportado.totalSoportado += p.base + iva; }
    else if (p.iva_type === 'superreducido') { soportado.iva4 += iva; soportado.totalSoportado += p.base + iva; }
    else { soportado.exento += p.base; soportado.totalSoportado += p.base; }
  }

  const totalDevengadoIva = devengado.iva21 + devengado.iva10 + devengado.iva4;
  const totalSoportadoIva = soportado.iva21 + soportado.iva10 + soportado.iva4;
  const resultado = totalDevengadoIva - totalSoportadoIva;

  const quarters: Record<number, string> = { 1: 'Enero-Marzo', 2: 'Abril-Junio', 3: 'Julio-Septiembre', 4: 'Octubre-Diciembre' };

  const fmtEur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  let md = `# Modelo 303 — Trim. ${data.quarter} (${quarters[data.quarter]}) ${data.year}\n\n`;
  md += `## IVA Devengado (Ventas)\n\n`;
  md += `| Tipo IVA | Base | Cuota IVA | Total |\n|---|---|---|---|\n`;
  md += `| 21% General | ${fmtEur(devengado.iva21 / 0.21)} | ${fmtEur(devengado.iva21)} | ${fmtEur(devengado.totalDevengado)} |\n`;
  md += `| 10% Reducido | ${fmtEur(devengado.iva10 / 0.10)} | ${fmtEur(devengado.iva10)} | ${fmtEur(devengado.totalDevengado - devengado.iva21 - devengado.iva10 - devengado.iva4)} |\n`;
  md += `| 4% Superreducido | ${fmtEur(devengado.iva4 / 0.04)} | ${fmtEur(devengado.iva4)} | ${fmtEur(devengado.totalDevengado - devengado.iva21 - devengado.iva10)} |\n`;
  md += `| Exento | ${fmtEur(devengado.exento)} | 0 | ${fmtEur(devengado.exento)} |\n`;
  md += `| **TOTAL** | | **${fmtEur(totalDevengadoIva)}** | **${fmtEur(devengado.totalDevengado)}** |\n\n`;
  md += `## IVA Soportado (Gastos)\n\n`;
  md += `| Tipo IVA | Base | Cuota IVA | Total |\n|---|---|---|---|\n`;
  md += `| 21% | ${fmtEur(soportado.iva21 / 0.21)} | ${fmtEur(soportado.iva21)} | ${fmtEur(soportado.totalSoportado)} |\n`;
  md += `| 10% | ${fmtEur(soportado.iva10 / 0.10)} | ${fmtEur(soportado.iva10)} | |\n`;
  md += `| 4% | ${fmtEur(soportado.iva4 / 0.04)} | ${fmtEur(soportado.iva4)} | |\n`;
  md += `| **TOTAL** | | **${fmtEur(totalSoportadoIva)}** | **${fmtEur(soportado.totalSoportado)}** |\n\n`;
  md += `## Resultado\n\n`;
  md += `| Concepto | Importe |\n|---|---|\n`;
  md += `| IVA Devengado | ${fmtEur(totalDevengadoIva)} |\n`;
  md += `| IVA Soportado | -${fmtEur(totalSoportadoIva)} |\n`;
  md += `| **RESULTADO** | **${fmtEur(resultado)}** |\n\n`;
  if (resultado > 0) md += `> **IVA a ingresar.** Plazo: hasta el día 20 del mes siguiente al trimestre.\n`;
  else md += `> **IVA a devolver / negativo.** Se arrastra al siguiente trimestre o solicita compensación.\n`;
  md += `\n---\n*Generado con CodeBlueprint Spain Tools — Modelo 303 v${data.year}*\n`;
  return md;
}

// ─────────────────────────────────────────────
// IRPF CALCULATOR
// ─────────────────────────────────────────────
function calcIrpf(data: { annual_gross: number; deductions?: number; expenses?: number }): string {
  validateIrpf(data);

  const deductions = data.deductions || 0;
  const expenses = data.expenses || 0;
  const net = data.annual_gross - deductions - expenses;
  const fmtEur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  let accumulated = 0;
  let totalIrpf = 0;
  const breakdown: Array<{ bracket: string; taxable: number; rate: number; tax: number }> = [];

  for (const bracket of IRPF_BRACKETS_2025) {
    if (net <= accumulated) break;
    const taxableInBracket = Math.min(net - accumulated, bracket.max - bracket.min);
    if (taxableInBracket <= 0) break;
    const tax = taxableInBracket * (bracket.rate / 100);
    totalIrpf += tax;
    breakdown.push({
      bracket: `${fmtEur(bracket.min)} - ${bracket.max === Infinity ? '∞' : fmtEur(bracket.max)} (${bracket.rate}%)`,
      taxable: taxableInBracket,
      rate: bracket.rate,
      tax,
    });
    accumulated += taxableInBracket;
  }

  const effectiveRate = net > 0 ? (totalIrpf / net) * 100 : 0;

  let md = `# Cálculo IRPF — Rendimientos de Actividades Económicas\n\n`;
  md += `| Concepto | Importe |\n|---|---|\n`;
  md += `| Ingresos brutos | ${fmtEur(data.annual_gross)} |\n`;
  md += `| Gastos deducibles | -${fmtEur(deductions)} |\n`;
  md += `| Otros gastos | -${fmtEur(expenses)} |\n`;
  md += `| **Base imponible** | **${fmtEur(net)}** |\n\n`;
  md += `## Desglose por tramos (IRPF ${new Date().getFullYear()})\n\n`;
  md += `| Tramo | Base imponible | Tipo | Cuota |\n|---|---|---|---|\n`;
  for (const b of breakdown) {
    md += `| ${b.bracket} | ${fmtEur(b.taxable)} | ${b.rate}% | ${fmtEur(b.tax)} |\n`;
  }
  md += `| | | **TOTAL IRPF** | **${fmtEur(totalIrpf)}** |\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Tipo efectivo | ${effectiveRate.toFixed(2)}% |\n`;
  md += `| Tipo marginal | ${breakdown.length > 0 ? breakdown[breakdown.length - 1].rate + '%' : 'N/A'} |\n`;
  md += `| **Cuota IRPF anual** | **${fmtEur(totalIrpf)}** |\n\n`;
  md += `> Nota: Este cálculo es orientativo. Incluye el tramo estatal y asume modalidad de estimación directa. Consultar siempre con un asesor fiscal.\n\n`;
  md += `**Próximos pasos:**\n`;
  md += `- Modelo 130/131 (pagos fraccionados): ingreso trimestral de ${fmtEur(totalIrpf / 4)}\n`;
  md += `- Modelo 100 (declaración anual): ajustar a cuota real\n\n`;
  md += `---\n*Generado con CodeBlueprint Spain Tools*\n`;
  return md;
}

// ─────────────────────────────────────────────
// TAX CALENDAR
// ─────────────────────────────────────────────
function getTaxCalendar(year: number): string {
  if (year < 2020 || year > 2030) throw new Error('year must be between 2020 and 2030');

  const deadlines = [
    { model: '130/131', desc: 'Pago fraccionado IRPF (trim. 4)', due: `${year}-01-20`, type: 'IRPF' },
    { model: '100', desc: 'Declaración IRPF anual', due: `${year}-04-30`, type: 'IRPF' },
    { model: '303', desc: 'IVA trimestral (enero-marzo)', due: `${year}-04-20`, type: 'IVA' },
    { model: '130', desc: 'Pago fraccionado IRPF (enero-marzo)', due: `${year}-04-20`, type: 'IRPF' },
    { model: '303', desc: 'IVA trimestral (abril-junio)', due: `${year}-07-20`, type: 'IVA' },
    { model: '130', desc: 'Pago fraccionado IRPF (abril-junio)', due: `${year}-07-20`, type: 'IRPF' },
    { model: '390', desc: 'Resumen anual IVA', due: `${year}-02-28`, type: 'IVA' },
    { model: '180', desc: 'Resumen anual de retenciones', due: `${year}-02-28`, type: 'Retenciones' },
    { model: '303', desc: 'IVA trimestral (julio-septiembre)', due: `${year}-10-20`, type: 'IVA' },
    { model: '130', desc: 'Pago fraccionado IRPF (julio-septiembre)', due: `${year}-10-20`, type: 'IRPF' },
    { model: '303', desc: 'IVA trimestral (octubre-diciembre)', due: `${year + 1}-01-30`, type: 'IVA' },
    { model: '130', desc: 'Pago fraccionado IRPF (octubre-diciembre)', due: `${year + 1}-01-20`, type: 'IRPF' },
  ];

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-');
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${parseInt(day)} de ${months[parseInt(m) - 1]} de ${y}`;
  };

  const now = new Date();
  let md = `# Calendario Fiscal AEAT — ${year}\n\n`;
  md += `| Modelo | Descripción | Fecha límite | Tipo |\n|---|---|---|---|\n`;
  for (const d of deadlines) {
    const dueDate = new Date(d.due + 'T00:00:00');
    const isPast = dueDate < now;
    const past = isPast ? ' *(pasado)*' : '';
    md += `| ${d.model} | ${d.desc} | ${fmtDate(d.due)}${past} | ${d.type} |\n`;
  }
  md += `\n> **Recordatorio:** Todos los plazos àsuman que el último día es festivo se desplazan al siguiente día hábil. Las-autoliquidaciones de IVA (Modelo 303) pueden fraccionarse en 2 plazos (primero y segundo mes) sin intereses hasta 30.000 EUR.\n\n`;
  md += `---\n*Calendario generado con CodeBlueprint Spain Tools*\n`;
  return md;
}

// ─────────────────────────────────────────────
// TOOL DEFINITIONS
// ─────────────────────────────────────────────
export function listSpainTools(): Tool[] {
  return [
    {
      name: 'spain_generate_invoice',
      description: 'Generate a Spanish invoice (factura) in markdown or HTML with IVA breakdown and optional IRPF retention',
      inputSchema: {
        type: 'object',
        properties: {
          invoice_number: { type: 'string', description: 'Invoice number (e.g. FACT-2025-001)' },
          date: { type: 'string', description: 'Invoice date (YYYY-MM-DD)' },
          due_date: { type: 'string', description: 'Due date (YYYY-MM-DD, default: +30 days)' },
          seller_name: { type: 'string', description: 'Seller/company name' },
          seller_nif: { type: 'string', description: 'Seller NIF/CIF (e.g. ES12345678A)' },
          seller_address: { type: 'string', description: 'Seller address' },
          seller_email: { type: 'string', description: 'Seller email' },
          buyer_name: { type: 'string', description: 'Buyer/client name' },
          buyer_nif: { type: 'string', description: 'Buyer NIF (optional)' },
          buyer_address: { type: 'string', description: 'Buyer address' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'Line item description' },
                base: { type: 'number', description: 'Base amount (before IVA) per unit' },
                quantity: { type: 'number', description: 'Quantity (default: 1)' },
                iva_type: { type: 'string', description: 'IVA type: general (21%), reducido (10%), superreducido (4%), exento', enum: ['general', 'reducido', 'superreducido', 'exento'] },
              },
              required: ['description', 'base', 'iva_type'],
            },
            description: 'Invoice line items',
          },
          retention: { type: 'number', description: 'IRPF retention percentage (e.g. 15 for 15%)' },
          notes: { type: 'string', description: 'Invoice notes' },
          format: { type: 'string', description: 'Output format: md (default) or html', enum: ['md', 'html'], default: 'md' },
        },
        required: ['invoice_number', 'seller_name', 'seller_nif', 'buyer_name', 'items'],
      },
    },
    {
      name: 'spain_calc_modelo303',
      description: 'Calculate quarterly Modelo 303 VAT (IVA) declaration for Spain',
      inputSchema: {
        type: 'object',
        properties: {
          quarter: { type: 'number', description: 'Quarter: 1, 2, 3, or 4', enum: [1, 2, 3, 4] },
          year: { type: 'number', description: 'Year (e.g. 2025)' },
          sales: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                base: { type: 'number', description: 'Base amount (before IVA)' },
                iva_type: { type: 'string', description: 'IVA type: general, reducido, superreducido, exento', enum: ['general', 'reducido', 'superreducido', 'exento'] },
              },
              required: ['base', 'iva_type'],
            },
            description: 'Sales invoices (IVA devengado)',
          },
          purchases: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                base: { type: 'number', description: 'Base amount (before IVA)' },
                iva_type: { type: 'string', description: 'IVA type', enum: ['general', 'reducido', 'superreducido', 'exento'] },
              },
              required: ['base', 'iva_type'],
            },
            description: 'Purchase invoices (IVA soportado)',
          },
        },
        required: ['quarter', 'year', 'sales', 'purchases'],
      },
    },
    {
      name: 'spain_calc_irpf',
      description: 'Calculate annual IRPF (income tax) for freelancers in Spain with bracket breakdown',
      inputSchema: {
        type: 'object',
        properties: {
          annual_gross: { type: 'number', description: 'Annual gross income' },
          deductions: { type: 'number', description: 'Deductible expenses (default: 0)' },
          expenses: { type: 'number', description: 'Other deductible expenses (default: 0)' },
        },
        required: ['annual_gross'],
      },
    },
    {
      name: 'spain_tax_calendar',
      description: 'Return the AEAT tax calendar with all official deadlines for a given year',
      inputSchema: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'Year (e.g. 2025)' },
        },
        required: ['year'],
      },
    },
  ];
}

// ─────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────
export async function handleSpainTool(
  name: string,
  args: any
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'spain_generate_invoice': {
        const result = generateInvoice(args);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'spain_calc_modelo303': {
        const result = calcModelo303(args);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'spain_calc_irpf': {
        const result = calcIrpf(args);
        return { content: [{ type: 'text', text: result }] };
      }

      case 'spain_tax_calendar': {
        const year = args.year || new Date().getFullYear();
        const result = getTaxCalendar(year);
        return { content: [{ type: 'text', text: result }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown Spain tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
}
