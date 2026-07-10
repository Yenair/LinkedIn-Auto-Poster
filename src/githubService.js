const axios = require('axios');

/**
 * Tries multiple tokens in order, returning the first one that succeeds.
 * On 404, falls back to the next token (e.g. PAT for private repos).
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Array<string>} tokens - Ordered list of tokens to try
 * @param {Function} requestFn - Async function that takes (token) and returns the response data
 * @returns {Promise<*>} Response data from the first successful attempt
 */
async function tryTokens(owner, repo, tokens, requestFn) {
  let lastError = null;
  for (const token of tokens) {
    if (!token) continue;
    try {
      return await requestFn(token);
    } catch (error) {
      lastError = error;
      // Only fall through to next token on 404 (not found / private)
      if (error.response && error.response.status === 404) {
        console.warn(`   ⚠️  ${owner}/${repo} not accessible with current token, trying next...`);
        continue;
      }
      // For non-404 errors, rethrow immediately
      throw error;
    }
  }
  // All tokens failed — throw the last error
  throw lastError;
}

/**
 * Returns the ordered list of tokens to try (PAT first, then auto-generated).
 * PAT has 'repo' scope for private repos; auto-generated token works for public repos.
 * @returns {string[]}
 */
function getTokenChain() {
  const tokens = [];
  if (process.env.GH_PAT) tokens.push(process.env.GH_PAT);
  if (process.env.GITHUB_TOKEN) tokens.push(process.env.GITHUB_TOKEN);
  return tokens;
}

/**
 * Fetches the latest commits from the GitHub repository.
 * Tries GH_PAT first (for private repos), then falls back to GITHUB_TOKEN.
 * @param {string} owner - Repository owner (username)
 * @param {string} repo - Repository name
 * @param {string} token - GitHub Personal Access Token (primary)
 * @param {number} count - Number of recent commits to fetch
 * @returns {Promise<Array>} List of commits
 */
async function getLatestCommits(owner, repo, token, count = 5) {
  const tokens = getTokenChain();
  const requestFn = async (t) => {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        headers: {
          Authorization: `token ${t}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: { per_page: count },
      }
    );

    return response.data.map((commit) => ({
      sha: commit.sha.substring(0, 7),
      message: commit.commit.message.split('\n')[0], // First line only
      fullMessage: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url,
      filesCount: commit.files ? commit.files.length : null,
    }));
  };

  try {
    return await tryTokens(owner, repo, tokens, requestFn);
  } catch (error) {
    console.error('Error fetching commits from GitHub:', error.message);
    if (error.response) {
      console.error('GitHub API response:', error.response.status, error.response.statusText);
    }
    throw error;
  }
}

/**
 * Fetches details for a specific commit (including file changes).
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} sha - Commit SHA
 * @param {string} token - GitHub Personal Access Token
 * @returns {Promise<Object>} Commit details
 */
async function getCommitDetails(owner, repo, sha, token) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const files = response.data.files.map((file) => ({
      filename: file.filename,
      status: file.status, // added, modified, removed
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
    }));

    return {
      sha: response.data.sha.substring(0, 7),
      files,
      stats: response.data.stats,
    };
  } catch (error) {
    console.error('Error fetching commit details:', error.message);
    throw error;
  }
}

/**
 * Gets the repository's languages and topics.
 * Tries GH_PAT first (for private repos), then falls back to GITHUB_TOKEN.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} token - GitHub Personal Access Token (primary, unused — chain is used instead)
 * @returns {Promise<Object>} Repository metadata
 */
async function getRepoInfo(owner, repo, token) {
  const tokens = getTokenChain();
  const requestFn = async (t) => {
    const [repoRes, langRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `token ${t}` },
      }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers: { Authorization: `token ${t}` },
      }),
    ]);

    return {
      description: repoRes.data.description,
      stars: repoRes.data.stargazers_count,
      language: repoRes.data.language,
      languages: Object.keys(langRes.data),
      topics: repoRes.data.topics,
      pushedAt: repoRes.data.pushed_at,
    };
  };

  try {
    return await tryTokens(owner, repo, tokens, requestFn);
  } catch (error) {
    console.error('Error fetching repo info:', error.message);
    return null;
  }
}

/**
 * Fetches repository metadata (description, topics, stars) from GitHub.
 * Tries GH_PAT first (for private repos), then falls back to GITHUB_TOKEN.
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} { description, topics, stargazers_count }
 */
async function getRepoDetails(owner, repo) {
  const tokens = getTokenChain();
  const requestFn = async (t) => {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `token ${t}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    return {
      description: response.data.description || '',
      topics: response.data.topics || [],
      stargazers_count: response.data.stargazers_count || 0,
    };
  };

  try {
    return await tryTokens(owner, repo, tokens, requestFn);
  } catch (error) {
    console.error('Error fetching repo details:', error.message);
    return { description: '', topics: [], stargazers_count: 0 };
  }
}

module.exports = { getLatestCommits, getCommitDetails, getRepoInfo, getRepoDetails };
