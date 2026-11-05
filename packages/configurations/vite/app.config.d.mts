/**
 * Type declarations for the shared Vite preset.
 *
 * The preset ships as a plain `.mjs` file so an application can use it without
 * a build step; this declaration file gives it a type surface without compiling
 * the module.
 */

export interface DamazonAppConfigOptions {
  /** Dev and preview server port. The customer app uses 5173. */
  readonly port?: number;
}

export declare const DAMAZON_API_TARGET: string;

export declare function damazonAppConfig(options?: DamazonAppConfigOptions): {
  plugins: unknown[];
  server: { port: number; strictPort: boolean; proxy: Record<string, Record<string, unknown>> };
  preview: { port: number; strictPort: boolean };
  build: {
    target: string;
    sourcemap: boolean;
    cssTarget: string;
    rollupOptions: { output: { manualChunks: (id: string) => string | undefined } };
  };
};

declare const config: ReturnType<typeof damazonAppConfig>;
export default config;
