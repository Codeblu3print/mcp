# MCP Spain Tools

Spanish invoicing, Modelo 303, IRPF calculations, and AEAT tax calendar for AI agents.

## Tools

- `spain_generate_invoice` — Generate facturas (PDF-ready HTML or Markdown) with IVA breakdown and IRPF retention
- `spain_calc_modelo303` — Calculate quarterly Modelo 303 VAT declaration
- `spain_calc_irpf` — Calculate annual IRPF with bracket breakdown
- `spain_tax_calendar` — AEAT tax deadline calendar for any year

## Security

All inputs are validated: invoice numbers, NIFs, fiscal data formats. No external calls.

## Installation

```bash
npm install @codeblueprint/mcp-spain-tools
npm run build
```

## Configuration

```json
{
  "mcpServers": {
    "spain-tools": {
      "command": "node",
      "args": ["/path/to/spain-tools/dist/index.js"]
    }
  }
}
```

## Usage Examples

```javascript
// Generate an invoice
spain_generate_invoice({
  invoice_number: "FACT-2025-001",
  seller_name: "Mi Nombre SL",
  seller_nif: "ESA12345678",
  buyer_name: "Cliente SA",
  items: [
    { description: "Desarrollo web", base: 1000, iva_type: "general" }
  ],
  format: "md"
})
```

## Disclaimer

This tool provides calculation and formatting assistance. Always consult a qualified accountant for official tax advice.
