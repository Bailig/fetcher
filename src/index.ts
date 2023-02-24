import { z } from "zod";
import type { ZodRawShape, ZodTypeAny } from "zod";

type Fetch = typeof fetch;

const get = async <Schema extends ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  options?: Parameters<Fetch>[1]
): Promise<z.infer<Schema>> => {
  const response = await fetch(url, options);
  return schema.parse(await response.json());
};

const post = async <Schema extends ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  data?: any,
  options?: Parameters<Fetch>[1]
): Promise<z.infer<Schema>> => {
  const response = await fetch(url, { ...options, body: JSON.stringify(data) });
  return schema.parse(await response.json());
};

export class FetcherClient<
  TContextSchema extends ZodTypeAny,
  THeadersShape extends ZodRawShape,
  TFetchers extends Record<
    string,
    (
      options: {
        ctx: z.infer<TContextSchema>;
        headers: InferZodRawShape<THeadersShape>;
        get: typeof get;
        post: typeof post;
      },
      input: any
    ) => any
  >
> {
  fetchers: TFetchers;
  ctxSchema: TContextSchema;
  headersShape: THeadersShape;

  constructor(options: {
    ctx: TContextSchema;
    headers: THeadersShape;
    fetchers: TFetchers;
  }) {
    this.ctxSchema = options.ctx;
    this.headersShape = options.headers;
    this.fetchers = options.fetchers;
  }

  createFetcher = (options: {
    ctx: z.infer<TContextSchema>;
    headers: InferZodRawShape<THeadersShape>;
  }): MapFetchers<TFetchers> => {
    const ctx = this.ctxSchema.parse(options.ctx);
    const headerSchema = z.object(this.headersShape);
    const headers = headerSchema.parse(options.headers) as any;

    const fetchers = Object.entries(this.fetchers).reduce(
      (acc, [key, fetcher]) => {
        acc[key] = (input: any) => fetcher({ ctx, headers, get, post }, input);
        return acc;
      },
      {} as any
    );

    return fetchers;
  };
}

// type generics
type InferZodRawShape<T extends ZodRawShape> = {
  [K in keyof T]: T[K] extends ZodTypeAny ? z.infer<T[K]> : never;
};

type MapFetchers<Fetchers extends Record<string, any>> = {
  [K in keyof Fetchers]: Fetchers[K] extends (
    options: any,
    input: infer Input
  ) => infer Output
    ? (input: Input) => Output
    : never;
};
