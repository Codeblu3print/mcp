# MCP Docs Generator

Auto-generate Architecture Decision Records, READMEs, and API docs from your codebase.

## Tools

- `docs_generate_adr` — Generate an ADR from project context
- `docs_generate_readme` — Generate a README from project structure
- `docs_generate_api_doc` — Generate API documentation from source files
- `docs_audit_codebase` — Scan a codebase and suggest missing documentation

## Security

All inputs are validated: path traversal blocked, sensitive paths protected.

## Installation

```bash
npm install @codeblueprint/mcp-docs-generator
npm run build
```

## Configuration

```json
{
  "mcpServers": {
    "docs-generator": {
      "command": "node",
      "args": ["/path/to/docs-generator/dist/index.js"]
    }
  }
}
```
