import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { listGithubTools, handleGithubTool } from './tools/github.js';
import { listDockerTools, handleDockerTool } from './tools/docker.js';
import { listFsTools, handleFsTool } from './tools/fs.js';

// Combine all tool definitions
const allTools = [...listGithubTools(), ...listDockerTools(), ...listFsTools()];

const server = new Server(
  {
    name: 'devops-kit',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool listing handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: allTools };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Route to appropriate handler
  if (name.startsWith('github_')) {
    return handleGithubTool(name, args || {});
  }
  if (name.startsWith('docker_')) {
    return handleDockerTool(name, args || {});
  }
  if (name.startsWith('fs_')) {
    return handleFsTool(name, args || {});
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP DevOps Kit server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
