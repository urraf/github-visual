/**
 * groq.js — Groq LLM API integration (Llama 3.3 70B)
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Build the system prompt for repo analysis.
 */
function buildSystemPrompt() {
  return `You are an expert software architect and code analyst. You will analyze a GitHub repository's structure and README to provide a comprehensive understanding of the project.

Your analysis must include EXACTLY these sections with the exact headers shown below. Use markdown formatting:

## 🎯 Project Overview
What this repo does in 2-3 clear sentences.

## 🏗️ Architecture
How the codebase is structured (monolith, microservice, MVC, etc.). Describe the high-level organization.

## 📂 Key Files & Their Purpose
List the top 10 most important files and explain what each one does. Format as a bullet list with the file path in backticks.

## 🔄 Code Flow
How data/execution flows through the app. Describe the entry point → routing → business logic → data layer pipeline.

## 🛠️ Tech Stack Detected
Languages, frameworks, libraries, databases, and tools detected from the repository structure and files.

## 🚀 Getting Started
Step-by-step instructions for how a new developer would set up and run this project.

## 📊 Complexity Assessment
Rate as **Beginner**, **Intermediate**, or **Advanced** with clear reasoning. Consider codebase size, number of technologies, architectural patterns, etc.

Be concise but thorough. Use bullet points for readability. Reference actual file paths from the repository.`;
}

/**
 * Build the user prompt with repo context.
 */
function buildUserPrompt(repoName, treeItems, readme) {
  // Build a simplified tree representation
  const treeStr = treeItems
    .slice(0, 500) // Limit to avoid token overflow
    .map(item => {
      const prefix = item.type === 'tree' ? '📁' : '📄';
      const size = item.size ? ` (${item.size} bytes)` : '';
      return `${prefix} ${item.path}${size}`;
    })
    .join('\n');

  let prompt = `# Repository: ${repoName}\n\n`;
  prompt += `## File Structure (${treeItems.length} total items):\n\`\`\`\n${treeStr}\n\`\`\`\n\n`;

  if (readme) {
    // Truncate README to ~3000 chars
    const truncatedReadme = readme.length > 3000
      ? readme.substring(0, 3000) + '\n\n[... truncated ...]'
      : readme;
    prompt += `## README.md:\n${truncatedReadme}\n\n`;
  } else {
    prompt += `## README.md:\nNo README found.\n\n`;
  }

  prompt += `Analyze this repository and provide a comprehensive breakdown following the exact section format specified.`;

  return prompt;
}

/**
 * Stream a Groq API response.
 * @param {string} apiKey - Groq API key
 * @param {string} repoName - Repository name (owner/repo)
 * @param {Array} treeItems - Flat tree items from GitHub API
 * @param {string|null} readme - README content
 * @param {function} onChunk - Callback for each streamed chunk
 * @returns {Promise<string>} - Full response text
 */
export async function streamAnalysis(apiKey, repoName, treeItems, readme, onChunk) {
  if (!apiKey) {
    throw new Error('Groq API key is required. Add it in Settings (⚙️).');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(repoName, treeItems, readme) },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Groq API key. Please check your key in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Groq rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content, fullText);
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  return fullText;
}
