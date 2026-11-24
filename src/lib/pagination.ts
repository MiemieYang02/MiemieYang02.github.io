export const PAGE_SIZE = 10;

export const archiveUrl = (page: number) => page === 1 ? '/projects/' : '/projects/page/' + page + '/';
