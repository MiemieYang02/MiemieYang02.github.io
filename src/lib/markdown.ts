import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';

// Only index visible prose and code. HTML comments and link destinations are omitted.
export function searchText(body: string) {
  const words: string[] = [];
  visit(fromMarkdown(body), node => {
    if (node.type === 'text' || node.type === 'code' || node.type === 'inlineCode') words.push(node.value);
    if (node.type === 'image' && node.alt) words.push(node.alt);
  });
  return words.join(' ');
}

export function localReferences(body: string, base: URL) {
  const urls = new Set<string>();
  const tree = fromMarkdown(body);
  const used = new Set<string>();
  visit(tree, 'linkReference', node => { used.add(node.identifier); });
  visit(tree, node => {
    if (node.type !== 'link' && !(node.type === 'definition' && used.has(node.identifier))) return;
    if (!node.url || node.url.startsWith('#')) return;
    try {
      const target = new URL(node.url, base);
      if (target.origin === base.origin && target.pathname !== base.pathname) urls.add(target.pathname.replace(/\/?$/, '/'));
    } catch { /* Non-URL references have no site backlink. */ }
  });
  return urls;
}
