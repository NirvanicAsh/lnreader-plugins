import { fetchApi } from '@libs/fetch';
import { CheerioAPI, load as parseHTML } from 'cheerio';
import { Element } from 'domhandler';
import { Filters } from '@/types/filters';
import { Plugin } from '@/types/plugin';

class SkyTheWood implements Plugin.PluginBase {
  id = 'skythewoodtranslations';
  name = 'Skythewood Translations';
  site = 'https://skythewood.blogspot.com';
  icon = 'favicon.ico';
  version = '1.0.0';

  async popularNovels(
    pageNo: number,
    _options: Plugin.PopularNovelsOptions<Filters>,
  ): Promise<Plugin.NovelItem[]> {
    // I'm fetching all the completed project here in one go
    // There are no novels in the ongoing projects page right now so that won't work
    //   And this is a blogger site with a messy link structure so not every novel is visible
    // tbh idk how i can fix that but some is better than none so "\-(シ)-/"
    if (pageNo > 1) return Promise.reject();

    type SkyProjects = {
      names: string[][];
      novels: {
        name: string;
        href: string;
        cover: string | undefined;
      }[];
    };

    let doneProjects: SkyProjects = await this.getDoneProjects();
    let ongoingProjects: SkyProjects = { names: [], novels: [] };

    let projects = ongoingProjects.novels.concat(doneProjects.novels);

    let novels: Plugin.NovelItem[] = [];

    for (const proj of projects) {
      let newNovel: Plugin.NovelItem = this.projectToNovel(proj);
      novels.push(newNovel);
    }

    // console.log(novels);

    return novels;
  }

  private async getDoneProjects() {
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

    // console.log(projects.map(el => [$(el).text(), $(el).attr('href')]));

    let dedup: Element[] = [];
    let names: string[][] = [];

    for (const proj of projects) {
      if ($(proj).text().length == 0) continue;

      let dupIndex = dedup.findIndex(
        el => $(el).attr('href') == $(proj).attr('href'),
      );
      if (dupIndex === -1) {
        dedup.push(proj);
        names.push([$(proj).text()]);
      } else names[dupIndex].push($(proj).text());
    }

    let withCovers = findCovers($, dedup);

    return {
      novels: withCovers,
      names: names,
    };
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

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    if (pageNo > 1) return Promise.reject();

    let projects = await this.getDoneProjects();

    let result: Set<Plugin.NovelItem> = new Set();

    for (let i = 0; i < projects.novels.length; i++) {
      const names = projects.names[i];
      if (!names) continue;

      if (
        names.some(name =>
          name.toLowerCase().includes(searchTerm.toLocaleLowerCase()),
        )
      ) {
        result.add(this.projectToNovel(projects.novels[i]));
      }
    }

    return Array.from(result);
  }

  projectToNovel(proj: {
    name: string;
    href: string;
    cover: string | undefined;
  }): Plugin.NovelItem {
    return {
      name: proj.name,
      path: proj.href.replace('http://', 'https://'),
      cover: proj.cover,
    };
  }
}

function findCovers($: CheerioAPI, anchors: Element[]) {
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

function findVolumes($: CheerioAPI, anchors: Element[]) {
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
