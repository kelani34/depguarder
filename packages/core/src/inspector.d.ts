export interface InspectionResult {
    hasObfuscation: boolean;
    suspiciousApis: string[];
    envAccess: string[];
    obfuscatedFiles: string[];
    tlsBypass: boolean;
    hiddenExecution: boolean;
    detachedExecution: boolean;
    remoteIpAccess: boolean;
    homeDirectoryWrites: boolean;
    selfDelete: boolean;
}
export declare function inspectPackage(name: string, version: string): Promise<InspectionResult>;
//# sourceMappingURL=inspector.d.ts.map