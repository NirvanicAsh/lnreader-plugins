import { fetchApi } from '@/lib/fetch';
import { Filters } from '@/types/filters';
import { Plugin } from '@/types/plugin';
import { Volume } from 'lucide-react';

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

    let document = new DOMParser().parseFromString(page, 'text/html');

    let projects = Array.from<HTMLAnchorElement>(
      document.querySelectorAll('.post-body > div a'),
    )
      .filter(el => el.href)
      .filter(
        el =>
          el.href.startsWith('http://skythewood.blogspot.sg/p/') ||
          el.href.startsWith('http://skythewood.blogspot.com/p/') ||
          el.href.startsWith('https://skythewood.blogspot.sg/p/') ||
          el.href.startsWith('https://skythewood.blogspot.com/p/'),
      )
      .filter(el => el.innerText);

    console.log(projects.map(el => [el.innerText, el.href]));

    let dedup: HTMLAnchorElement[] = [];

    for (const proj of projects) {
      if (!dedup.some(el => el.href == proj.href)) {
        dedup.push(proj);
      }
    }

    function findCovers(container: Element, anchors: HTMLAnchorElement[]) {
      let anchorSet = new Set(anchors);
      let result = [];
      let lastImg: HTMLImageElement | null = null;

      let walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_ELEMENT,
      );
      while (walker.nextNode()) {
        let node = walker.currentNode as HTMLElement;

        if (node.tagName === 'IMG') {
          lastImg = node as HTMLImageElement;
        }

        if (anchorSet.has(node as HTMLAnchorElement)) {
          let a = node as HTMLAnchorElement;
          result.push({
            name: a.innerText,
            href: a.href,
            cover: lastImg?.src,
          });
        }
      }
      return result;
    }

    let container = document.querySelector('.post-body')!;
    let withCovers = findCovers(container, dedup);

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
    let document = new DOMParser().parseFromString(page, 'text/html');

    let name = (document.querySelector('.post-title') as HTMLDivElement)
      ?.innerText;

    let artist: undefined | string = undefined;
    {
      let arr = Array.from(document.querySelectorAll('b'));

      let filt = arr.filter(el => el.innerText.startsWith('Author'));

      if (filt.length) {
        artist = filt[0].innerText.split(':')[1];
      }
    }

    let chapterArray = Array.from<HTMLAnchorElement>(
      document.querySelectorAll('.post-body a'),
    );

    let filtered = chapterArray
      .filter(el => el.href)
      .filter(el => el.href.includes('skythewood'));

    function findVolumes(container: Element, anchors: HTMLAnchorElement[]) {
      let anchorSet = new Set(anchors);
      let result = [];
      let lastVolume: string | null = null;

      let walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_ELEMENT,
      );
      while (walker.nextNode()) {
        let node = walker.currentNode as HTMLElement;

        if (node.innerText.startsWith('Volume')) {
          lastVolume = node.innerText;
        }

        if (anchorSet.has(node as HTMLAnchorElement)) {
          let a = node as HTMLAnchorElement;
          result.push({
            name: a.innerText,
            href: a.href,
            volume: lastVolume,
          });
        }
      }
      return result;
    }

    let container = document.querySelector('.post-body')!;
    let withVolumes = findVolumes(container, filtered);

    let chapters: Plugin.ChapterItem[] = [];

    for (const ch of withVolumes) {
      if (ch.volume) {
        ch.name = `${ch.volume} - ${ch.name}`;
      }
      let chapter: Plugin.ChapterItem = {
        name: ch.name,
        path: ch.href.replace('http://', 'https://'),
      };
      chapters.push(chapter);
    }

    return {
      name: name,
      path: novelPath,
      cover: document.querySelectorAll('img')[1]?.src,
      artist,
      chapters,
    };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    let pageRes = await fetchApi(chapterPath);
    let page = await pageRes.text();
    let document = new DOMParser().parseFromString(page, 'text/html');

    let body = document.querySelector('.post-body');
    console.log(body);

    return body?.innerHTML || '';
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

export default new SkyTheWood();
