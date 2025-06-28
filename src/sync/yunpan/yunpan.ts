import type { PlatformInfo } from "~sync/common";
import { BaiduYunPan } from "./baiduyun";

export const YunPanMap: Record<string, PlatformInfo> = {
    YUNPAN_BAIDUYUN: {
        type: 'YUNPAN',
        name: 'YUNPAN_BAIDUYUN',
        homeUrl: 'https://pan.baidu.com/login',
        faviconUrl: 'https://nd-static.bdstatic.com/m-static/wp-brand/img/wp-logo.ad8119c1.png',
        platformName: chrome.i18n.getMessage('platformBaiduYun'),
        injectUrl: 'https://pan.baidu.com/disk/main#/index?category=all',
        injectFunction: BaiduYunPan,
        tags: ['CN'],
        accountKey: 'baiduyun',
    }
};