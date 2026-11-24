import { published, href } from '../lib/entries';
import { searchText } from '../lib/markdown';

export async function GET() {
  const projects = (await published()).map(entry => {
    const { title, description, tags, category } = entry.data;
    return { title, description, url: href(entry), text: [title, description, category, ...tags, searchText(entry.body ?? '')].join(' ').toLowerCase() };
  });
  return Response.json(projects);
}
