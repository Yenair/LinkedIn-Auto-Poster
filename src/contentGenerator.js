/**
 * Generates human-like conversational LinkedIn post content.
 * Uses DeepSeek AI for varied, AI-generated posts.
 * No fallback to templates — if the AI call fails, an error is thrown.
 * No headers, no hashtags — just natural, engaging text.
 *
 * Context-aware:
 * - Detects whether the repo is owned by the user or contributed to
 * - Detects repos that should use past tense (completed projects)
 */

const axios = require('axios');

// ---------------------------------------------------------------------------
// Repo classification helpers
// ---------------------------------------------------------------------------

/** GitHub usernames that the user owns (not contributed to). */
const OWNED_ACCOUNTS = ['Yenair'];

/** Repo names (lowercase) that should use past tense (completed projects). */
const PAST_TENSE_REPOS = ['hostel-election-mph-uniuyo-2023', 'hostel-election-mph-uniuyo'];

/**
 * Returns true if the given owner is a contributor project (not owned by the user).
 * @param {string} owner - GitHub owner / org
 * @returns {boolean}
 */
function isContributorRepo(owner) {
  return !OWNED_ACCOUNTS.includes(owner);
}

/**
 * Returns true if the repo should be written in past tense.
 * @param {string} repo - Repository name
 * @returns {boolean}
 */
function isPastTenseRepo(repo) {
  return PAST_TENSE_REPOS.includes(repo.toLowerCase());
}

// ---------------------------------------------------------------------------
// AI Provider initialisation
// ---------------------------------------------------------------------------

function initAI() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set in .env.\n' +
      '   Add DEEPSEEK_API_KEY=your_key to use DeepSeek.'
    );
  }
  console.log('🤖 AI Provider: DeepSeek');
  return true;
}

// ---------------------------------------------------------------------------
// AI call
// ---------------------------------------------------------------------------

/**
 * Generates content using the DeepSeek API.
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string>} Generated text
 */
async function callAI(prompt) {
  return await deepseekGenerate(prompt);
}

// ---------------------------------------------------------------------------
// DeepSeek generation (OpenAI-compatible API)
// ---------------------------------------------------------------------------

/**
 * Calls the DeepSeek API to generate content.
 * Uses axios (already a project dependency) — no new packages needed.
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string>} Generated text
 */
async function deepseekGenerate(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set in .env');
  }

  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const text = response.data.choices[0].message.content.trim();
    if (!text || text.length < 50) {
      throw new Error('DeepSeek returned empty or too short content');
    }
    return text;
  } catch (err) {
    // If it's an axios error with a response from DeepSeek, give a detailed message
    if (err.response) {
      const status = err.response.status;
      const body = err.response.data;
      const detail = body?.error?.message || JSON.stringify(body);
      throw new Error(`DeepSeek API error (${status}): ${detail}`);
    }
    throw new Error(`DeepSeek request failed: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

/**
 * Builds the prompt for a feature-spotlight post.
 *
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @param {Object} repoDetails - { description, topics, stargazers_count }
 * @param {Object} [context] - Optional context flags
 * @param {boolean} [context.isContributor] - Whether this repo was contributed to
 * @param {boolean} [context.isPastTense] - Whether to write in past tense
 * @returns {string} The AI prompt
 */
function buildFeaturePrompt(owner, repo, repoDetails, context = {}) {
  const projectDisplay = repo.replace(/-/g, ' ');
  const description = repoDetails.description || 'a handy tool';
  const topics =
    repoDetails.topics && repoDetails.topics.length > 0
      ? repoDetails.topics.join(', ')
      : 'N/A';
  const stars = repoDetails.stargazers_count || 0;
  const url = `https://github.com/${owner}/${repo}`;

  // Build posture / relationship instructions based on context
  let relationshipRule = '';
  let tenseRule = '';

  if (context.isContributor) {
    relationshipRule = `- IMPORTANT: This project is NOT yours — you are a contributor to it. Make this clear in the post (e.g. "I contributed to...", "I helped build...", "I was added as a contributor to..."). Do NOT imply you own it.`;
  } else {
    relationshipRule = `- This is your own project that you built and maintain.`;
  }

  if (context.isPastTense) {
    tenseRule = `- Write entirely in PAST TENSE. This project is completed, you built it in the past. Use phrases like "I built", "I created", "it was designed to", etc.`;
  }

  return `You are a real software developer sharing an open-source project on LinkedIn.

Write a LinkedIn post about "${projectDisplay}".

**Context about the project:**
- Description: "${description}"
- Tech / topics: ${topics}
- GitHub stars: ${stars}
- GitHub URL: ${url}

**Rules — follow them exactly:**
- Write in a casual, first-person, human voice, like you're telling a friend about the project
- Use very basic, simple grammar — short sentences, plain words, like a real person chatting
- Use proper paragraph breaks: add a blank line BETWEEN each paragraph (do not compact them)
- NEVER use any of these phrases: "I've been working on", "If you haven't seen it before", "think of it", "It's one of those projects that started as", "I've lost count"
- Vary the opening every time, start differently each call
- NO hashtags whatsoever
- NO em dashes (—) anywhere in the post, use commas or periods instead
- NO headers, NO titles, NO intro emojis
- 2-4 short paragraphs (2-3 sentences each)
- Mention one specific aspect or challenge you found interesting about the project
- Only sometimes end with a question, not every time — vary it
- Include the GitHub URL naturally toward the end
- Keep it under 200 words
${relationshipRule}
${tenseRule}`;
}

/**
 * Builds the prompt for an update post from recent commits.
 *
 * @param {Array} commits - List of commit objects
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @param {Object} [context] - Optional context flags
 * @param {boolean} [context.isContributor] - Whether this repo was contributed to
 * @param {boolean} [context.isPastTense] - Whether to write in past tense
 * @returns {string} The AI prompt
 */
function buildUpdatePrompt(commits, owner, repo, context = {}) {
  const projectDisplay = repo.replace(/-/g, ' ');
  const count = commits.length;
  const commitMessages = commits.map((c) => c.message).join('\n');
  const url = `https://github.com/${owner}/${repo}`;

  // Build posture / relationship instructions based on context
  let relationshipRule = '';
  let tenseRule = '';

  if (context.isContributor) {
    relationshipRule = `- IMPORTANT: This project is NOT yours — you are a contributor. Make this clear in the post. Do NOT imply you own it.`;
  } else {
    relationshipRule = `- This is your own project.`;
  }

  if (context.isPastTense) {
    tenseRule = `- Write entirely in PAST TENSE. This project is completed — you worked on it in the past.`;
  }

  return `You are a real software developer sharing a progress update on LinkedIn.

You made ${count} recent commit(s) to "${projectDisplay}".

**Commit messages:**
${commitMessages}

**Rules — follow them exactly:**
- Write in a casual, first-person, human voice
- Use very basic, simple grammar — short sentences, plain words, like a real person chatting
- Use proper paragraph breaks: add a blank line BETWEEN each paragraph (do not compact them)
- Summarise what changed in a conversational way, don't just list commit messages
- Vary the structure every time
- NEVER start with "I've been working on"
- NO hashtags, NO headers, NO titles
- NO em dashes (—) anywhere in the post, use commas or periods instead
- 2-3 short paragraphs
- Include the GitHub URL naturally
- Only sometimes end with a question, not every time — vary it
- Keep it under 180 words
${relationshipRule}
${tenseRule}`;
}

// ---------------------------------------------------------------------------
// Public API — async only, throws on failure (no template fallback)
// ---------------------------------------------------------------------------

/**
 * Generates a feature-spotlight post for a given repository.
 * Uses the configured AI provider.
 * Throws on failure — no template fallback.
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @param {Object} repoDetails - { description, topics, stargazers_count }
 * @returns {Promise<string>} Conversational post text
 */
async function generateFeaturePost(owner, repo, repoDetails) {
  const context = {
    isContributor: isContributorRepo(owner),
    isPastTense: isPastTenseRepo(repo),
  };
  const prompt = buildFeaturePrompt(owner, repo, repoDetails, context);
  const text = await callAI(prompt);

  // Ensure the GitHub URL is present in the output
  const url = `https://github.com/${owner}/${repo}`;
  if (!text.includes('github.com')) {
    return text + `\n\n${url}`;
  }
  return text;
}

/**
 * Generates an update post from recent commits.
 * Uses the configured AI provider.
 * Throws on failure — no template fallback.
 * @param {Array} commits - List of commit objects
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @returns {Promise<string>} Conversational post text
 */
async function generateUpdatePost(commits, owner, repo) {
  const context = {
    isContributor: isContributorRepo(owner),
    isPastTense: isPastTenseRepo(repo),
  };
  const prompt = buildUpdatePrompt(commits, owner, repo, context);
  const text = await callAI(prompt);

  // Ensure the GitHub URL is present in the output
  const url = `https://github.com/${owner}/${repo}`;
  if (!text.includes('github.com')) {
    return text + `\n\n${url}`;
  }
  return text;
}

// Initialise AI on module load (throws if misconfigured)
initAI();

module.exports = { generateFeaturePost, generateUpdatePost };
