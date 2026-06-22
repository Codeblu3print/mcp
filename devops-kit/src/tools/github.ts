import { Tool } from '@modelcontextprotocol/sdk/types.js';

export function listGithubTools(): Tool[] {
  return [
    {
      name: 'github_list_repos',
      description: 'List repositories for a GitHub user or organization',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'The GitHub username or organization name',
          },
          type: {
            type: 'string',
            description: 'Filter by repository type: all, owner, public, private',
            enum: ['all', 'owner', 'public', 'private'],
            default: 'owner',
          },
          per_page: {
            type: 'number',
            description: 'Number of results per page (max 100)',
            default: 30,
          },
        },
        required: ['owner'],
      },
    },
    {
      name: 'github_create_issue',
      description: 'Create a new issue on a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'Issue title' },
          body: { type: 'string', description: 'Issue body/description' },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Issue labels',
          },
        },
        required: ['owner', 'repo', 'title'],
      },
    },
    {
      name: 'github_get_repo_info',
      description: 'Get information about a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
        },
        required: ['owner', 'repo'],
      },
    },
  ];
}

async function githubApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function handleGithubTool(name: string, args: any): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'github_list_repos': {
        const { owner, type = 'owner', per_page = 30 } = args;
        const data = await githubApiCall(
          `/users/${owner}/repos?type=${type}&per_page=${per_page}`
        );
        const repos = data.map((r: any) => ({
          name: r.name,
          full_name: r.full_name,
          description: r.description,
          url: r.html_url,
          stars: r.stargazers_count,
          language: r.language,
          private: r.private,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(repos, null, 2) }] };
      }

      case 'github_create_issue': {
        const { owner, repo, title, body = '', labels = [] } = args;
        const data = await githubApiCall(`/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          body: JSON.stringify({ title, body, labels }),
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'github_get_repo_info': {
        const { owner, repo } = args;
        const data = await githubApiCall(`/repos/${owner}/${repo}`);
        const info = {
          name: data.name,
          full_name: data.full_name,
          description: data.description,
          url: data.html_url,
          stars: data.stargazers_count,
          forks: data.forks_count,
          open_issues: data.open_issues_count,
          language: data.language,
          default_branch: data.default_branch,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown GitHub tool: ${name}` }], isError: true };
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
}
