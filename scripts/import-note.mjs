import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { readFile, readdir, mkdir, realpath, stat, writeFile, link, rename, unlink } from 'node:fs/promises';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import { parse, stringify } from 'yaml';
import { slug as headingSlug } from 'github-slugger';

const root = fileURLToPath(new URL('../', import.meta.url));
const imageExt = /\.(?:png|jpe?g|webp|gif|avif|svg)$/i;
const isInside = (rootDir, target) => {
  const rel = path.relative(rootDir, target);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
};

function splitNote(text) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return { data: {}, body: normalized };
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) throw new Error('YAML frontmatter 缺少结束分隔符。');
  const data = parse(match[1]) ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Frontmatter 应为键值对。');
  return { data, body: normalized.slice(match[0].length) };
}

function stableId(value) {
  const id = value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, '-');
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(id) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(id))
    throw new Error('请用 --slug 指定由字母、数字、连字符或下划线组成的网址。');
  return id;
}

async function optionalFile(file) {
  try { return (await stat(file)).isFile(); }
  catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
}

// Index only site entries already selected for publication. Never follow a link into the vault.
async function publishedTargets() {
  const targets = [];
  const dir = path.join(root, 'src/content/projects');
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.md')) continue;
    const { data } = splitNote(await readFile(path.join(dir, name), 'utf8'));
    if (data.draft !== false) continue;
    const id = name.slice(0, -3);
    targets.push({ names: [id, 'projects/' + id, data.title, ...(data.aliases ?? [])], url: '/projects/' + encodeURIComponent(id) + '/' });
  }
  return targets;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    section: { type: 'string', default: 'projects' }, slug: { type: 'string' }, vault: { type: 'string' },
    attachments: { type: 'string' }, publish: { type: 'boolean' }, replace: { type: 'boolean' },
  } });
  if (positionals.length !== 1 || values.section !== 'projects')
    throw new Error('用法：npm run import:note -- "笔记.md" [--section projects] [--vault 路径] [--attachments 附件目录] [--slug 名称] [--publish] [--replace]');
  const source = await realpath(positionals[0]);
  if (path.extname(source).toLowerCase() !== '.md') throw new Error('源文件必须是 Markdown。');
  const sourceDir = path.dirname(source);
  const vault = values.vault ? await realpath(values.vault) : sourceDir;
  if (!isInside(vault, source)) throw new Error('源笔记须位于指定的 --vault 内。');
  const attachments = values.attachments ? await realpath(values.attachments) : null;
  const stem = path.basename(source, path.extname(source));
  const { data, body } = splitNote(await readFile(source, 'utf8'));
  const id = stableId(values.slug ?? data.slug ?? stem);
  const destDir = path.join(root, values.publish ? 'src/content' : '.local-drafts', values.section);
  const dest = path.join(destDir, id + '.md');
  if (path.resolve(dest) === source) throw new Error('源文件与目标文件相同。');
  if (!values.replace && await optionalFile(dest)) throw new Error('目标已存在。要更新该篇副本，请明确加入 --replace。');
  const targets = await publishedTargets();
  const siteUrl = '/' + values.section + '/' + encodeURIComponent(id) + '/';
  const warnings = new Set();
  const assets = new Map();
  async function imageLink(raw, alt) {
    let name = decodeURIComponent(raw.trim()).replaceAll('\\', '/');
    if (/^(?:https?:)?\/\//i.test(name)) return null;
    if (/^[\w+.-]+:|^\//.test(name) || !imageExt.test(name)) throw new Error('请使用笔记或知识库内的相对图片路径：' + name);
    const candidates = [...new Set([sourceDir, vault, attachments].filter(Boolean).map(base => path.resolve(base, name)))];
    let found;
    for (const candidate of candidates) {
      if (![vault, attachments].filter(Boolean).some(base => isInside(base, candidate))) continue;
      if (!await optionalFile(candidate)) continue;
      const resolved = await realpath(candidate);
      if (![vault, attachments].filter(Boolean).some(base => isInside(base, resolved))) throw new Error('图片超出允许目录：' + name);
      if (found && found !== resolved) throw new Error('存在同名图片，请用库内相对路径：' + name);
      found = resolved;
    }
    if (!found) throw new Error('找不到图片：' + name + '（可以指定 --vault 或 --attachments）');
    const bytes = await readFile(found);
    const file = createHash('sha256').update(bytes).digest('hex').slice(0, 24) + path.extname(found).toLowerCase();
    assets.set(file, bytes);
    const label = alt.replace(/[\\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');
    return '![' + label + '](./assets/' + encodeURIComponent(id) + '/' + file + ')';
  }

  function wikiLink(raw, alias) {
    const [note, heading] = raw.split('#', 2);
    const name = note.replace(/\.md$/i, '');
    const label = (alias || heading || path.posix.basename(name)).replace(/[\\\[\]*_`<>]/g, '\\$&');
    const matches = targets.filter(t => t.names.includes(name));
    let url;
    if (!name || name === stem || name === id || name === data.title) url = siteUrl;
    else if (matches.length === 1) url = matches[0].url;
    else { warnings.add('未唯一匹配已公开笔记，保留为文字：' + note); return label; }
    if (heading?.startsWith('^')) { warnings.add('块引用保留为文字：' + raw); return label; }
    return '[' + label + '](' + url + (heading ? '#' + encodeURIComponent(headingSlug(heading)) : '') + ')';
  }

  // Replace only parsed Markdown ranges, retaining original formatting and literal code examples.
  const tree = fromMarkdown(body);
  const edits = [];
  const definitions = new Map();
  visit(tree, 'definition', node => definitions.set(node.identifier, node));
  const queue = [];
  visit(tree, (node, _, parent) => {
    if (!node.position) return;
    const { start, end } = node.position;
    if (node.type === 'image' || node.type === 'imageReference') {
      const url = node.type === 'image' ? node.url : definitions.get(node.identifier)?.url;
      if (url) queue.push(async () => {
        const converted = await imageLink(url, node.alt || '');
        if (converted) edits.push([start.offset, end.offset, converted]);
      });
    } else if (node.type === 'text' && !['link', 'linkReference'].includes(parent?.type)) {
      const slice = body.slice(start.offset, end.offset);
      for (const match of slice.matchAll(/(?<!\\)(!?)\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g)) {
        queue.push(async () => {
          const [, embed, target, alias] = match;
          let value;
          if (embed && imageExt.test(target)) {
            value = await imageLink(target, alias && !/^\d+(?:x\d+)?$/.test(alias) ? alias : path.posix.basename(target));
            if (!value) throw new Error('远程图片请使用标准 Markdown 图片语法。');
          } else {
            if (embed) warnings.add('笔记嵌入转为引用，不复制目标正文：' + target);
            value = wikiLink(target, alias);
          }
          edits.push([start.offset + match.index, start.offset + match.index + match[0].length, value]);
        });
      }
    }
  });
  for (const convert of queue) await convert();
  let converted = body;
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0]))
    converted = converted.slice(0, start) + value + converted.slice(end);

  const tags = typeof data.tags === 'string' ? [data.tags] : data.tags ?? [];
  if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string')) throw new Error('tags 应为文本列表。');
  const fields = {
    title: data.title ?? stem, description: data.description ?? (data.title || stem),
    date: data.date ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Singapore' }).format(new Date()),
    category: data.category ?? '未分类', tags, aliases: [...new Set([stem, ...(Array.isArray(data.aliases) ? data.aliases : [])])],
    draft: !values.publish,
  };
  for (const name of ['title','description','category']) if (typeof fields[name] !== 'string' || !fields[name].trim()) throw new Error(name + ' 必须是非空文本。');
  if (Number.isNaN(Date.parse(fields.date))) throw new Error('date 必须为有效日期。');
  await mkdir(destDir, { recursive: true });
  const temp = path.join(destDir, '.' + randomUUID() + '.tmp');
  try {
    for (const [file, bytes] of assets) {
      const dir = path.join(destDir, 'assets', id);
      await mkdir(dir, { recursive: true });
      const target = path.join(dir, file);
      try { await writeFile(target, bytes, { flag: 'wx' }); }
      catch (error) {
        if (error.code !== 'EEXIST' || !(await readFile(target)).equals(bytes)) throw error;
      }
    }
    await writeFile(temp, '---\n' + stringify(fields) + '---\n\n' + converted.trimStart(), { flag: 'wx' });
    if (values.replace) await rename(temp, dest);
    else await link(temp, dest);
  } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  for (const warning of warnings) console.warn(warning);
  console.log((values.publish ? '已写入待构建项目：' : '已写入本地草稿：') + path.relative(root, dest) + '（' + assets.size + ' 张本地图片）');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
