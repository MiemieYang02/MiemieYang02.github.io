import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { notebookMarkdown, publishedMarkdown } from './scripts/markdown.mjs';

export default defineConfig({
  site: 'https://miemieyang02.github.io',
  output: 'static',
  devToolbar: { enabled: false },
  markdown: {
    processor: unified({
      remarkPlugins: [publishedMarkdown, remarkMath, notebookMarkdown],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: { theme: 'github-dark' },
  },
});
