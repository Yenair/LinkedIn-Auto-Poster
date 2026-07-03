/**
 * Generates human-like conversational LinkedIn post content.
 * Uses either Google Gemini or DeepSeek AI for varied, AI-generated posts.
 * No fallback to templates — if the AI call fails, an error is thrown.
 * No headers, no hashtags — just natural, engaging text.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// ---------------------------------------------------------------------------
// AI Provider configuration
// ---------------------------------------------------------------------------
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

let genAI = null;
let geminiModel = null;

function initAI() {
  if (AI_PROVIDER === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error(
        'DEEPSEEK_API_KEY is not set in .env.\n' +
        '   Add DEEPSEEK_API_KEY=your_key to use DeepSeek, or switch AI_PROVIDER=gemini.'
      );
    }
    console.log('🤖 AI Provider: DeepSeek');
    return true;
  }

  // Default: Gemini
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set in .env.\n' +
      '   Get a free key at https://aistudio.google.com/app/apikey'
    );
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    console.log('🤖 AI Provider: Gemini (gemini-2.0-flash)');
    return true;
  } catch (err) {
    throw new Error(`Failed to initialise Gemini: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// AI call routing
// ---------------------------------------------------------------------------

/**
 * Routes a content-generation prompt to the configured AI provider.
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string>} Generated text
 */
async function callAI(prompt) {
  if (AI_PROVIDER === 'deepseek') {
    return await deepseekGenerate(prompt);
  }

  // Gemini
  if (!geminiModel) {
    throw new Error('Gemini model is not initialised. Check your GEMINI_API_KEY.');
  }
  const result = await geminiModel.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text || text.length < 50) {
    throw new Error('Gemini returned empty or too short content');
  }
  return text;
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
 */
function buildFeaturePrompt(owner, repo, repoDetails) {
  const projectDisplay = repo.replace(/-/g, ' ');
  const description = repoDetails.description || 'a handy tool';
  const topics =
    repoDetails.topics && repoDetails.topics.length > 0
      ? repoDetails.topics.join(', ')
      : 'N/A';
  const stars = repoDetails.stargazers_count || 0;
  const url = `https://github.com/${owner}/${repo}`;

  return `You are a real software developer sharing an open-source project on LinkedIn.

Write a LinkedIn post about "${projectDisplay}".

**Context about the project:**
- Description: "${description}"
- Tech / topics: ${topics}
- GitHub stars: ${stars}
- GitHub URL: ${url}

**Rules — follow them exactly:**
- Write in a casual, first-person, human voice, like you're telling a friend what you've been working on
- Use very basic, simple grammar — short sentences, plain words, like a real person chatting
- Use proper paragraph breaks: add a blank line BETWEEN each paragraph (do not compact them)
- NEVER use any of these phrases: "I've been working on", "If you haven't seen it before", "think of it", "It's one of those projects that started as", "I've lost count"
- Vary the opening every time, start differently each call
- NO hashtags whatsoever
- NO em dashes (—) anywhere in the post, use commas or periods instead
- NO headers, NO titles, NO "🚀" or similar intro emojis
- 2-4 short paragraphs (2-3 sentences each)
- Mention one specific aspect or challenge you found interesting about the project
- Only sometimes end with a question, not every time — vary it
- Include the GitHub URL naturally toward the end
- Keep it under 200 words`;
}

/**
 * Builds the prompt for an update post from recent commits.
 */
function buildUpdatePrompt(commits, owner, repo) {
  const projectDisplay = repo.replace(/-/g, ' ');
  const count = commits.length;
  const commitMessages = commits.map((c) => c.message).join('\n');
  const url = `https://github.com/${owner}/${repo}`;

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
- Keep it under 180 words`;
}

// ---------------------------------------------------------------------------
// Public API — async only, throws on failure (no template fallback)
// ---------------------------------------------------------------------------

/**
 * Generates a feature-spotlight post for a given repository.
 * Uses the configured AI provider (Gemini or DeepSeek).
 * Throws on failure — no template fallback.
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @param {Object} repoDetails - { description, topics, stargazers_count }
 * @returns {Promise<string>} Conversational post text
 */
async function generateFeaturePost(owner, repo, repoDetails) {
  const prompt = buildFeaturePrompt(owner, repo, repoDetails);
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
 * Uses the configured AI provider (Gemini or DeepSeek).
 * Throws on failure — no template fallback.
 * @param {Array} commits - List of commit objects
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo name
 * @returns {Promise<string>} Conversational post text
 */
async function generateUpdatePost(commits, owner, repo) {
  const prompt = buildUpdatePrompt(commits, owner, repo);
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
