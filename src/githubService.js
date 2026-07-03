const axios = require('axios');

/**
 * Fetches the latest commits from the GitHub repository.
 * @param {string} owner - Repository owner (username)
 * @param {string} repo - Repository name
 * @param {string} token - GitHub Personal Access Token
 * @param {number} count - Number of recent commits to fetch
 * @returns {Promise<Array>} List of commits
 */
async function getLatestCommits(owner, repo, token, count = 5) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: {
          per_page: count,
        },
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
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} token - GitHub Personal Access Token
 * @returns {Promise<Object>} Repository metadata
 */
async function getRepoInfo(owner, repo, token) {
  try {
    const [repoRes, langRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Authorization: `token ${token}` },
      }),
      axios.get(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers: { Authorization: `token ${token}` },
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
  } catch (error) {
    console.error('Error fetching repo info:', error.message);
    return null;
  }
}

module.exports = { getLatestCommits, getCommitDetails, getRepoInfo };
