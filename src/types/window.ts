export interface MultipostInfo {
    traceId: string;
    platformName: string;
    startTime: number;
}

export interface MultipostSendResult {
    (success: boolean, publishUrl?: string, errorMessage?: string): void;
}

declare global {
    interface Window {
        multipostSendResult?: MultipostSendResult;
        multipostInfo?: MultipostInfo;
    }
}

export { }; 