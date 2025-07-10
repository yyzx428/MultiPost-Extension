export interface MultipostInfo {
    traceId: string;
    platformName: string;
    startTime: number;
}

export interface MultipostSendResult {
    (success: boolean, publishUrl?: string, errorMessage?: string): void;
}

// 文件操作相关接口
export interface FileOperationRequest {
    platform: 'baiduyun' | 'aliyun' | 'onedrive';
    operation: 'share' | 'download' | 'organize' | 'search';
    params: {
        paths: string[];
        timeout?: number;
        shareConfig?: {
            validPeriod: '1天' | '7天' | '30天' | '365天' | '永久有效';
            extractCodeType: '不设置' | '随机生成' | '自定义';
            customCode?: string;
            hideUserInfo?: boolean;
        };
        downloadConfig?: any;
        organizeConfig?: any;
    };
}

export interface FileOperationResponse {
    success: boolean;
    operation: string;
    platform: string;
    executionTime: number;
    data: any;
    logs: Array<{
        timestamp: number;
        level: 'info' | 'warn' | 'error' | 'debug';
        message: string;
        details?: any;
    }>;
}

export interface MultipostExtension {
    fileOperation(request: FileOperationRequest): Promise<FileOperationResponse>;
}

declare global {
    interface Window {
        multipostSendResult?: MultipostSendResult;
        multipostInfo?: MultipostInfo;
        multipostExtension?: MultipostExtension;
    }
}

export { }; 