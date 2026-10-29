import { defineConfig } from 'vite';

// GitHub Pages project sites need the repository name as the base path.
// GitHub Actions sets GITHUB_REPOSITORY to "owner/repository".
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : '/',
});
