import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { listDocsTools, handleDocsTool } from './tools/docs.js';

const allTools = [...listDocsTools()];

const server = new Server(
  { name: 'docs-generator', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name.startsWith('docs_')) return handleDocsTool(name, args || {});
  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Docs Generator server running on stdio');
}

main().catch((error) => { console.error('Server error:', error); process.exit(1); });
