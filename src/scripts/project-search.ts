import { PAGE_SIZE } from '../lib/pagination';

type Result = { title: string; description: string; url: string; text: string };
const form = document.querySelector<HTMLFormElement>('.filters')!;
const input = form.querySelector('input')!;
const count = document.querySelector<HTMLElement>('.result-count')!;
const browse = document.querySelector<HTMLElement>('#browse')!;
const matches = document.querySelector<HTMLElement>('#matches')!;
const list = matches.querySelector('ul')!;
const pager = matches.querySelector('nav')!;
let index: Promise<Result[]> | undefined;
let revision = 0;

function loadIndex(): Promise<Result[]> {
  return index ??= fetch('/project-search.json').then(response => {
    if (!response.ok) throw new Error('search index unavailable');
    return response.json();
  }).catch(error => { index = undefined; throw error; });
}

function resultRow(result: Result) {
  const li = document.createElement('li');
  const heading = document.createElement('h3');
  const link = document.createElement('a');
  const summary = document.createElement('p');
  li.className = 'entry-row';
  link.href = result.url;
  link.textContent = result.title;
  summary.textContent = result.description;
  heading.append(link);
  li.append(heading, summary);
  return li;
}

async function render() {
  const current = ++revision;
  const url = new URL(location.href);
  const query = input.value.trim().toLowerCase();
  browse.hidden = !!query;
  matches.hidden = !query;
  pager.hidden = true;
  list.replaceChildren();
  if (!query) {
    count.textContent = '共 ' + count.dataset.total + ' 个项目';
    return;
  }
  count.textContent = '正在搜索…';
  try {
    const results = (await loadIndex()).filter(item => item.text.includes(query));
    if (current !== revision) return;
    const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
    const requested = Number(url.searchParams.get('p'));
    const page = Number.isInteger(requested) ? Math.max(1, Math.min(pages, requested)) : 1;
    count.textContent = results.length ? '找到 ' + results.length + ' 个项目' : '没有找到匹配的项目。';
    list.replaceChildren(...results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(resultRow));
    pager.hidden = pages === 1;
    pager.querySelector('span')!.textContent = '第 ' + page + ' / ' + pages + ' 页';
    for (const [selector, number] of [['[data-prev]', page - 1], ['[data-next]', page + 1]] as const) {
      const link = pager.querySelector<HTMLAnchorElement>(selector)!;
      link.hidden = number < 1 || number > pages;
      url.searchParams.set('p', String(number));
      link.href = url.href;
    }
  } catch {
    if (current === revision) count.textContent = '搜索暂时不可用，请按回车重试。';
  }
}

function updateQuery() {
  const url = new URL(location.href);
  const query = input.value.trim();
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  url.searchParams.delete('p');
  history.replaceState(null, '', url);
  void render();
}
function restore() {
  input.value = new URLSearchParams(location.search).get('q') ?? '';
  void render();
}
form.hidden = false;
input.addEventListener('input', updateQuery);
form.addEventListener('submit', event => { event.preventDefault(); updateQuery(); });
window.addEventListener('popstate', restore);
restore();
