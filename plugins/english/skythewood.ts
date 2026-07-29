import { fetchApi } from '@libs/fetch';
import { load as parseHTML } from 'cheerio';
import { Filters } from '@/types/filters';
import { Plugin } from '@/types/plugin';

class SkyTheWood implements Plugin.PluginBase {
  id: string = 'skythewoodtranslations';
  name: string = 'Skythewood Translations';
  site: string = 'https://skythewood.blogspot.com';
  icon: string = 'favicon.ico';
  version: string = '1.0.0';

  async popularNovels(
    pageNo: number,
    options: Plugin.PopularNovelsOptions<Filters>,
  ): Promise<Plugin.NovelItem[]> {
    let pageRes = await fetchApi('https://skythewood.blogspot.com/p/done.html');

    let page = await pageRes.text();

    let $ = parseHTML(page);

    let anchors = $('.post-body > div a').toArray();

    let projects = anchors
      .filter(el => $(el).attr('href'))
      .filter(el => {
        let href = $(el).attr('href')!;
        return (
          href.startsWith('http://skythewood.blogspot.sg/p/') ||
          href.startsWith('http://skythewood.blogspot.com/p/') ||
          href.startsWith('https://skythewood.blogspot.sg/p/') ||
          href.startsWith('https://skythewood.blogspot.com/p/')
        );
      })
      .filter(el => $(el).text());

    console.log(projects.map(el => [$(el).text(), $(el).attr('href')]));

    let dedup: Element[] = [];

    for (const proj of projects) {
      if (!dedup.some(el => $(el).attr('href') == $(proj).attr('href'))) {
        dedup.push(proj);
      }
    }

    let withCovers = findCovers($, dedup);

    let novels: Plugin.NovelItem[] = [];

    for (const { name, href, cover } of withCovers) {
      let newNovel: Plugin.NovelItem = {
        name: name,
        path: href.replace('http://', 'https://'),
        cover: cover,
      };
      novels.push(newNovel);
    }

    console.log(novels);

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    let pageRes = await fetchApi(novelPath);
    let page = await pageRes.text();
    let $ = parseHTML(page);

    let name = $('.post-title').text();

    let artist: string | undefined;
    {
      let boldEls = $('b').toArray();
      let authorEl = boldEls.find(el => $(el).text().startsWith('Author'));
      if (authorEl) {
        artist = $(authorEl).text().split(':')[1].trim();
      }
    }

    let chapterAnchors = $('.post-body a').toArray();

    let filtered = chapterAnchors
      .filter(el => $(el).attr('href'))
      .filter(el => $(el).attr('href')!.includes('skythewood'));

    let withVolumes = findVolumes($, filtered);

    let chapters: Plugin.ChapterItem[] = [];

    for (const ch of withVolumes) {
      let name = ch.volume ? `${ch.volume} - ${ch.name}` : ch.name;
      let chapter: Plugin.ChapterItem = {
        name: name,
        path: ch.href.replace('http://', 'https://'),
      };
      chapters.push(chapter);
    }

    return {
      name: name,
      path: novelPath,
      cover: $('img').eq(1).attr('src'),
      artist,
      chapters,
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    let pageRes = await fetchApi(chapterPath);
    let page = await pageRes.text();
    let $ = parseHTML(page);

    let body = $('.post-body').html();

    return body || '';
  }

  searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    throw new Error('Method not implemented.');
  }
  resolveUrl?(path: string, isNovel?: boolean): string {
    throw new Error('Method not implemented.');
  }
}

function findCovers($: cheerio.CheerioAPI, anchors: Element[]) {
  let anchorSet = new Set(anchors);
  let result: { name: string; href: string; cover: string | undefined }[] = [];
  let lastImg: string | undefined;

  $('.post-body')
    .find('*')
    .each((_, el) => {
      let $el = $(el);

      if ($el.prop('tagName') === 'IMG') {
        lastImg = $el.attr('src') || undefined;
      }

      if (anchorSet.has(el)) {
        result.push({
          name: $el.text(),
          href: $el.attr('href') || '',
          cover: lastImg,
        });
      }
    });

  return result;
}

function findVolumes($: cheerio.CheerioAPI, anchors: Element[]) {
  let anchorSet = new Set(anchors);
  let result: { name: string; href: string; volume: string | null }[] = [];
  let lastVolume: string | null = null;

  $('.post-body')
    .find('*')
    .each((_, el) => {
      let $el = $(el);
      let text = $el.text();

      if (text.startsWith('Volume')) {
        lastVolume = text;
      }

      if (anchorSet.has(el)) {
        result.push({
          name: text,
          href: $el.attr('href') || '',
          volume: lastVolume,
        });
      }
    });

  return result;
}

export default new SkyTheWood();
