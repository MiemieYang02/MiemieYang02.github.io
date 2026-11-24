import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'entries'>;
export const href = (entry: Entry) => '/projects/' + encodeURIComponent(entry.id) + '/';
export const isoDate = (entry: Entry) => entry.data.date.toISOString().slice(0, 10);
export async function published() {
  const entries = await getCollection('entries', item => !item.data.draft);
  return entries.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id, 'en'));
}
