import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function listDockerTools(): Tool[] {
  return [
    {
      name: 'docker_ps',
      description: 'List running Docker containers',
      inputSchema: {
        type: 'object',
        properties: {
          all: {
            type: 'boolean',
            description: 'Show all containers (default shows just running)',
            default: false,
          },
        },
      },
    },
    {
      name: 'docker_logs',
      description: 'Get logs from a Docker container',
      inputSchema: {
        type: 'object',
        properties: {
          container_id: {
            type: 'string',
            description: 'Container ID or name',
          },
          lines: {
            type: 'number',
            description: 'Number of lines to fetch (default 100)',
            default: 100,
          },
          tail: {
            type: 'string',
            description: 'Show last N lines (default: all)',
          },
        },
        required: ['container_id'],
      },
    },
    {
      name: 'docker_stats',
      description: 'Get resource statistics for containers',
      inputSchema: {
        type: 'object',
        properties: {
          container_id: {
            type: 'string',
            description: 'Container ID or name (optional for all)',
          },
          stream: {
            type: 'boolean',
            description: 'Stream statistics (default: false)',
            default: false,
          },
        },
      },
    },
  ];
}

async function runDockerCommand(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
    if (stderr && !stdout) {
      return stderr;
    }
    return stdout;
  } catch (error: any) {
    throw new Error(error.stdout || error.message);
  }
}

export async function handleDockerTool(
  name: string,
  args: any
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'docker_ps': {
        const allFlag = args.all ? '-a' : '';
        const output = await runDockerCommand(
          `docker ps ${allFlag} --format "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`
        );
        const lines = output.trim().split('\n').filter(Boolean);
        const containers = lines.map((line) => {
          const [id, names, image, status, ports] = line.split('\t');
          return { id, names, image, status, ports };
        });
        return { content: [{ type: 'text', text: JSON.stringify(containers, null, 2) }] };
      }

      case 'docker_logs': {
        const { container_id, lines = 100, tail } = args;
        let cmd = `docker logs ${container_id} --tail ${tail || lines} 2>&1`;
        const output = await runDockerCommand(cmd);
        return { content: [{ type: 'text', text: output }] };
      }

      case 'docker_stats': {
        const { container_id, stream = false } = args;
        const streamFlag = stream ? '--format "{{.ID}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" --no-stream' : '--no-stream';
        const target = container_id ? container_id : '';
        const output = await runDockerCommand(
          `docker stats ${target} ${streamFlag} 2>&1`
        );
        const lines = output.trim().split('\n').filter(Boolean);
        const stats = lines.map((line) => {
          const parts = line.split('\t');
          return {
            id: parts[0],
            name: parts[1],
            cpu: parts[2],
            memory: parts[3],
            memoryPerc: parts[4],
          };
        });
        return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown Docker tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
}
