import { z } from "zod";
import type { ZodRawShape, ZodTypeAny } from "zod";

type Fetch = typeof fetch;

export type Get = <Schema extends z.ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  options?: Parameters<Fetch>[1]
) => Promise<z.infer<Schema>>;

export type Post = <Schema extends z.ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  data?: any,
  options?: Parameters<Fetch>[1]
) => Promise<z.TypeOf<Schema>>;

type FetcherDefinition<
  TContextSchema extends ZodTypeAny,
  THeadersShape extends ZodRawShape
> = (
  options: {
    ctx: z.infer<TContextSchema>;
    headers: InferZodRawShape<THeadersShape>;
    get: Get;
    post: Post;
  },
  input: any
) => any;

export class FetcherClient<
  TContextSchema extends ZodTypeAny,
  THeadersShape extends ZodRawShape
> {
  private ctxSchema: TContextSchema;
  private headersShape: THeadersShape;

  constructor(options: { ctx: TContextSchema; headers: THeadersShape }) {
    this.ctxSchema = options.ctx;
    this.headersShape = options.headers;
  }

  private createGet = (headers: InferZodRawShape<THeadersShape>): Get => {
    const get: Get = async (url, schema, options) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options?.headers,
        },
      });
      return schema.parse(await response.json());
    };
    return get;
  };

  private createPost = (headers: InferZodRawShape<THeadersShape>): Post => {
    const post: Post = async (url, schema, data, options) => {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-cache",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
        ...options,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...headers,
          ...options?.headers,
        },
      });
      return schema.parse(await response.json());
    };
    return post;
  };

  fetcher(fetcherDefinition: FetcherDefinition<TContextSchema, THeadersShape>) {
    return fetcherDefinition;
  }

  // createFetcher = (options: {
  //   ctx: z.infer<TContextSchema>;
  //   headers: InferZodRawShape<THeadersShape>;
  // }): MapFetchers<TFetchers> => {
  //   const ctx = this.ctxSchema.parse(options.ctx);
  //   const headerSchema = z.object(this.headersShape);
  //   const headers = headerSchema.parse(options.headers) as any;
  //   const get = this.createGet(headers);
  //   const post = this.createPost(headers);

  //   const fetchers = Object.entries(this.fetchers).reduce(
  //     (acc, [key, fetcher]) => {
  //       acc[key] = (input: any) => fetcher({ ctx, headers, get, post }, input);
  //       return acc;
  //     },
  //     {} as any
  //   );

  //   return fetchers;
  // };
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
