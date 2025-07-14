import type { PlatformInfo } from "~sync/common";
import { ShangpinRednote } from "./rednote";
import { ShangpinAgiso } from "./agiso";

export const ShangPinMap: Record<string, PlatformInfo> = {
    SHANGPIN_REDNOTE: {
        type: 'SHANGPIN',
        name: 'SHANGPIN_REDNOTE',
        homeUrl: 'https://ark.xiaohongshu.com/app-system/home',
        faviconUrl: 'https://fe-platform.xhscdn.com/platform/104101l031gld7c1b3o067m6e4lrrpno0074v4c7ee3ga8',
        platformName: chrome.i18n.getMessage('platformBaiduYun'),
        injectUrl: 'https://ark.xiaohongshu.com/app-item/good/create',
        injectFunction: ShangpinRednote,
        tags: ['CN'],
        accountKey: 'rednote',
    },
    SHANGPIN_AGISO: {
        type: 'SHANGPIN',
        name: 'SHANGPIN_AGISO',
        homeUrl: 'https://aldsxhs.agiso.com',
        faviconUrl: 'https://aldsxhs.agiso.com/favicon.ico',
        platformName: chrome.i18n.getMessage('platformAgiso'),
        injectUrl: 'https://aldsxhs.agiso.com/#/alds/goods',
        injectFunction: ShangpinAgiso,
        tags: ['CN'],
        accountKey: 'agiso',
    }
};