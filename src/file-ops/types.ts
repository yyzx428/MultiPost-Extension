/**
 * @file 文件操作系统类型定义
 * @description 定义文件操作相关的接口和类型
 */

//===================================
// 基础类型定义
//===================================

/** 支持的文件操作平台 */
export type FileOperationPlatform = 'baiduyun' | 'aliyun' | 'onedrive';

/** 支持的文件操作类型 */
export type FileOperationType = 'share' | 'download' | 'organize' | 'search';

/** 操作日志级别 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

//===================================
// 核心接口定义
//===================================

/** 文件操作请求 */
export interface FileOperation {
    /** 目标平台 */
    platform: FileOperationPlatform;
    /** 操作类型 */
    operation: FileOperationType;
    /** 操作参数 */
    params: FileOperationParams;
}

/** 文件操作参数 */
export interface FileOperationParams {
    /** 操作路径数组 */
    paths: string[];
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 分享操作配置 */
    shareConfig?: ShareConfig;
    /** 下载操作配置 */
    downloadConfig?: DownloadConfig;
    /** 整理操作配置 */
    organizeConfig?: OrganizeConfig;
}

/** 文件操作结果 */
export interface FileOperationResult {
    /** 操作是否成功 */
    success: boolean;
    /** 操作类型 */
    operation: FileOperationType;
    /** 目标平台 */
    platform: FileOperationPlatform;
    /** 执行耗时（毫秒） */
    executionTime: number;
    /** 结果数据 */
    data: unknown;
    /** 操作日志 */
    logs: OperationLog[];
}

//===================================
// 分享操作相关类型
//===================================

/** 分享配置 */
export interface ShareConfig {
    /** 有效期 */
    validPeriod: '1天' | '7天' | '30天' | '365天' | '永久有效';
    /** 提取码类型 */
    extractCodeType: '不设置' | '随机生成' | '自定义';
    /** 自定义提取码 */
    customCode?: string;
    /** 是否隐藏用户信息 */
    hideUserInfo?: boolean;
    /** 目标选择配置 */
    selection?: FileSelectionConfig;
}

/** 文件选择配置 */
export interface FileSelectionConfig {
    /** 是否选择全部 */
    selectAll?: boolean;
    /** 按名称选择 */
    selectByName?: string[];
    /** 按类型选择 */
    selectByType?: 'files' | 'folders' | 'all';
    /** 按模式匹配选择 */
    selectByPattern?: string;
}

/** 分享结果 */
export interface ShareResult {
    /** 分享链接 */
    shareUrl: string;
    /** 提取码 */
    extractCode?: string;
    /** 短链接 */
    shortUrl?: string;
    /** 有效期 */
    validUntil: string;
    /** 创建时间 */
    createdAt: string;
    /** 分享的文件列表 */
    sharedFiles: FileItem[];
}

//===================================
// 下载操作相关类型
//===================================

/** 下载配置 */
export interface DownloadConfig {
    /** 按模式匹配选择文件 */
    selectByPattern?: string;
    /** 下载路径 */
    downloadPath?: string;
    /** 是否创建文件夹结构 */
    keepFolderStructure?: boolean;
    /** 最大并发下载数 */
    maxConcurrent?: number;
}

/** 下载结果 */
export interface DownloadResult {
    /** 下载的文件数量 */
    downloadedCount: number;
    /** 失败的文件数量 */
    failedCount: number;
    /** 总文件大小 */
    totalSize: number;
    /** 下载的文件列表 */
    downloadedFiles: FileItem[];
    /** 失败的文件列表 */
    failedFiles: Array<{ file: FileItem; error: string }>;
}

//===================================
// 整理操作相关类型
//===================================

/** 整理配置 */
export interface OrganizeConfig {
    /** 整理规则 */
    rules: OrganizeRule[];
    /** 是否模拟运行（不实际移动文件） */
    dryRun?: boolean;
}

/** 整理规则 */
export interface OrganizeRule {
    /** 规则名称 */
    name: string;
    /** 匹配条件 */
    condition: FileCondition;
    /** 目标文件夹 */
    targetFolder: string;
    /** 是否创建目标文件夹 */
    createFolder?: boolean;
}

/** 文件条件 */
export interface FileCondition {
    /** 文件名模式 */
    namePattern?: string;
    /** 文件类型 */
    fileType?: string[];
    /** 文件大小范围 */
    sizeRange?: [number, number];
    /** 修改时间范围 */
    modifiedRange?: [Date, Date];
}

/** 整理结果 */
export interface OrganizeResult {
    /** 处理的文件数量 */
    processedCount: number;
    /** 移动的文件数量 */
    movedCount: number;
    /** 创建的文件夹数量 */
    createdFolders: number;
    /** 处理详情 */
    details: Array<{
        file: FileItem;
        action: 'moved' | 'skipped' | 'failed';
        targetPath?: string;
        error?: string;
    }>;
}

//===================================
// 通用数据类型
//===================================

/** 文件项 */
export interface FileItem {
    /** 文件名 */
    name: string;
    /** 文件类型 */
    type: 'file' | 'folder';
    /** 文件大小（字节） */
    size?: number;
    /** 文件路径 */
    path: string;
    /** 修改时间 */
    modifiedTime?: string;
    /** 文件ID（平台相关） */
    fileId?: string;
    /** 文件扩展名 */
    extension?: string;
}

/** 导航结果 */
export interface NavigationResult {
    /** 导航是否成功 */
    success: boolean;
    /** 最终到达的路径 */
    finalPath: string[];
    /** 当前文件列表 */
    currentFiles: FileItem[];
    /** 导航耗时（毫秒） */
    navigationTime: number;
}

/** 操作日志 */
export interface OperationLog {
    /** 时间戳 */
    timestamp: number;
    /** 日志级别 */
    level: LogLevel;
    /** 日志消息 */
    message: string;
    /** 详细信息 */
    details?: unknown;
}

//===================================
// 平台抽象接口
//===================================

/** 平台操作器抽象基类 */
export abstract class BasePlatformOperator {
    /** 导航到指定路径 */
    abstract navigate(paths: string[]): Promise<NavigationResult>;

    /** 创建分享链接 */
    abstract share(config: ShareConfig): Promise<ShareResult>;

    /** 下载文件 */
    abstract download(config: DownloadConfig): Promise<DownloadResult>;

    /** 整理文件 */
    abstract organize(config: OrganizeConfig): Promise<OrganizeResult>;

    /** 获取当前文件列表 */
    abstract getCurrentFileList(): Promise<FileItem[]>;

    /** 清理资源 */
    abstract cleanup(): Promise<void>;
} 