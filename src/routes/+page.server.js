export function load() {
    return {
      GITHUB_REPO: process.env.VITE_GITHUB_REPO,
      GITHUB_TOKEN: process.env.VITE_GITHUB_TOKEN
    };
  }