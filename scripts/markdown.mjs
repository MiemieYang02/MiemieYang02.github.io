import { visit } from 'unist-util-visit';

// Astro collects image imports while rendering the collection, before page routes filter drafts.
export function publishedMarkdown() {
  return (tree, file) => {
    if (file.data.astro?.frontmatter?.draft !== false) tree.children = [];
  };
}

export function notebookMarkdown() {
  return tree => {
    visit(tree, 'blockquote', node => {
      const first = node.children[0]?.children?.[0];
      if (first?.type !== 'text') return;
      const match = first.value.match(/^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)(?:\n|$)/);
      if (!match) return;
      const labels = { note: '笔记', tip: '提示', warning: '注意', important: '重点', info: '说明' };
      const kind = match[1].toLowerCase();
      first.value = first.value.slice(match[0].length);
      node.data = { hName: 'aside', hProperties: { className: ['callout', 'callout-' + kind] } };
      node.children.unshift({ type: 'paragraph', data: { hProperties: { className: ['callout-title'] } },
        children: [{ type: 'text', value: match[2].trim() || labels[kind] || match[1] }] });
    });
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'mermaid') return;
      parent.children[index] = { type: 'paragraph', data: { hName: 'pre', hProperties: { className: ['diagram-source'] } },
        children: [{ type: 'text', value: node.value }] };
    });
  };
}
