import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export function listFsTools(): Tool[] {
  return [
    {
      name: 'fs_ls',
      description: 'List directory contents',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_read',
      description: 'Read file contents',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read',
          },
          max_lines: {
            type: 'number',
            description: 'Maximum number of lines to read (default: 1000)',
            default: 1000,
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'fs_stats',
      description: 'Get file or directory statistics',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to get statistics for',
          },
        },
        required: ['path'],
      },
    },
  ];
}

function resolvePath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(process.env.HOME || process.env.USERPROFILE || '', inputPath.slice(1));
  }
  return path.resolve(inputPath);
}

export async function handleFsTool(
  name: string,
  args: any
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'fs_ls': {
        const { path: dirPath } = args;
        const resolved = resolvePath(dirPath);
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        const items = entries.map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: path.join(resolved, entry.name),
        }));
        return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
      }

      case 'fs_read': {
        const { path: filePath, max_lines = 1000 } = args;
        const resolved = resolvePath(filePath);
        const content = await fs.readFile(resolved, 'utf-8');
        const lines = content.split('\n').slice(0, max_lines);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      case 'fs_stats': {
        const { path: targetPath } = args;
        const resolved = resolvePath(targetPath);
        const stats = await fs.stat(resolved);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  path: resolved,
                  type: stats.isDirectory() ? 'directory' : 'file',
                  size: stats.size,
                  created: stats.birthtime,
                  modified: stats.mtime,
                  accessed: stats.atime,
                  readable: true,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown filesystem tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
}
