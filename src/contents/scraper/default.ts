import { Readability } from '@mozilla/readability';
import { preprocessor } from './preprocessor';

export interface ArticleData {
  title: string;
  author: string;
  cover: string;
  content: string;
  digest: string;
}

export default async function scrapeContent(): Promise<ArticleData | undefined> {

  console.debug('all spider ...');

  const preprocess = (content: string) => preprocessor(content);

  const article = new Readability(document.cloneNode(true) as Document).parse();

  console.debug('Readability article -->', article);

  if (!article?.content || !article?.title) {
    // alert(chrome.i18n.getMessage("failedToGetArticleContent"));
    console.log('failedToGetArticleContent');
    return;
  }

  const cover = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  const title = article.title || '';

  console.debug('title ', title);

  const content = article.content || '';
  const excerpt = article.excerpt || '';

  const articleData: ArticleData = {
    title: title.trim(),
    author: '',
    cover,
    content: preprocess(content.trim()),
    digest: excerpt.trim(),
  };

  return articleData;
}
