declare module "html-to-text" {
    export interface ConvertOptions {
      wordwrap?: number | false;
      preserveNewlines?: boolean;
      selectors?: Array<{ selector: string; options?: Record<string, unknown> }>;
    }
  
    export function convert(html: string, options?: ConvertOptions): string;
  }