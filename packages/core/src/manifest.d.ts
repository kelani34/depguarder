import { z } from 'zod';
export declare const ManifestSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodOptional<z.ZodString>;
    dependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    devDependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    peerDependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    optionalDependencies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    scripts: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type Manifest = z.infer<typeof ManifestSchema>;
export declare function parseManifest(path: string): Manifest;
export declare function parseManifestContent(content: string): Manifest;
//# sourceMappingURL=manifest.d.ts.map