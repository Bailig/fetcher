import { z } from "zod";
import type { ZodRawShape, ZodTypeAny } from "zod";

export type Fetch = typeof fetch;

export type Query = <Schema extends z.ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  options?: Parameters<Fetch>[1]
) => Promise<{ data: z.infer<Schema>; response: Response }>;

export type Mutation = <Schema extends z.ZodTypeAny>(
  url: Parameters<Fetch>[0],
  schema: Schema,
  data?: any,
  options?: Parameters<Fetch>[1]
) => Promise<{ data: z.infer<Schema>; response: Response }>;

export type FetcherDefinition<
  TContextSchema extends ZodTypeAny,
  THeadersShape extends ZodRawShape | undefined,
  TInputs extends any[] = any[],
  TOutput = any
> = ArrayShorterThanTwo<TInputs> extends true
  ? (
      options: THeadersShape extends ZodRawShape
        ? {
            ctx: z.infer<TContextSchema>;
            get: Query;
            post: Mutation;
            patch: Mutation;
            put: Mutation;
            delete: Mutation;
            headers: InferZodRawShape<THeadersShape>;
          }
        : {
            ctx: z.infer<TContextSchema>;
            get: Query;
            post: Mutation;
            patch: Mutation;
            put: Mutation;
            delete: Mutation;
          },
      ...inputs: TInputs
    ) => TOutput
  : "Inputs must be 0 or 1";

export class FetcherClient<
  TOptions extends
    | { ctx: ZodTypeAny }
    | { ctx: ZodTypeAny; headers: ZodRawShape },
  TContextSchema extends TOptions["ctx"],
  THeadersShape extends TOptions extends { headers: ZodRawShape }
    ? TOptions["headers"]
    : undefined
> {
  private ctxSchema: TContextSchema;
  private headersShape?: THeadersShape;

  constructor(options: TOptions) {
    this.ctxSchema = options.ctx as TContextSchema;

    if ("headers" in options) {
      this.headersShape = options.headers as THeadersShape;
    }
  }

  fetcher<TInputs extends any[], TOutput>(
    fetcherDefinition: FetcherDefinition<
      TContextSchema,
      THeadersShape,
      TInputs,
      TOutput
    >
  ) {
    return fetcherDefinition;
  }

  combineFetchers<
    TFetchers extends Record<
      string,
      FetcherDefinition<TContextSchema, THeadersShape>
    >
  >(fetcherDefs: TFetchers) {
    type OptionsObj = THeadersShape extends ZodRawShape
      ? {
          ctx: z.infer<TContextSchema>;
          headers: InferZodRawShape<THeadersShape>;
        }
      : {
          ctx: z.infer<TContextSchema>;
        };
    type OptionsFn = () => OptionsObj;

    return (options: OptionsObj | OptionsFn): MapFetchers<TFetchers> => {
      const fetchers = Object.entries(fetcherDefs).reduce(
        (acc, [key, fetcher]) => {
          acc[key] = (input: any) => {
            const opts = typeof options === "function" ? options() : options;
            const ctx = this.ctxSchema.parse(opts.ctx);

            const headers: any =
              this.headersShape && "headers" in opts
                ? z.object(this.headersShape).parse(opts.headers)
                : undefined;

            const get = this.createGet(headers);
            const post = this.createPost(headers);
            const patch = this.createPatch(headers);
            const put = this.createPut(headers);
            const del = this.createDelete(headers);
            return fetcher(
              { ctx, headers, get, post, patch, put, delete: del } as any,
              input
            );
          };
          return acc;
        },
        {} as any
      );

      return fetchers;
    };
  }

  private createGet = (
    headers: THeadersShape extends never
      ? never
      : InferZodRawShape<NonNullable<THeadersShape>>
  ): Query => {
    const get: Query = async (url, schema, options) => {
      const response = await fetch(url, {
        referrerPolicy: "no-referrer",
        ...options,
        headers: {
          ...headers,
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return get;
  };

  private createPost = (
    headers: THeadersShape extends unknown
      ? unknown
      : InferZodRawShape<NonNullable<THeadersShape>>
  ): Mutation => {
    const post: Mutation = async (url, schema, data, options) => {
      const response = await fetch(url, {
        method: "POST",
        cache: "no-cache",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
        ...options,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...(headers as any),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return post;
  };

  private createPatch = (
    headers: THeadersShape extends unknown
      ? unknown
      : InferZodRawShape<NonNullable<THeadersShape>>
  ): Mutation => {
    const patch: Mutation = async (url, schema, data, options) => {
      const response = await fetch(url, {
        method: "PATCH",
        cache: "no-cache",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
        ...options,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...(headers as any),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return patch;
  };

  private createPut = (
    headers: THeadersShape extends unknown
      ? unknown
      : InferZodRawShape<NonNullable<THeadersShape>>
  ): Mutation => {
    const put: Mutation = async (url, schema, data, options) => {
      const response = await fetch(url, {
        method: "PUT",
        cache: "no-cache",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
        ...options,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...(headers as any),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return put;
  };

  private createDelete = (
    headers: THeadersShape extends unknown
      ? unknown
      : InferZodRawShape<NonNullable<THeadersShape>>
  ): Mutation => {
    const del: Mutation = async (url, schema, data, options) => {
      const response = await fetch(url, {
        method: "DELETE",
        cache: "no-cache",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
        ...options,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...(headers as any),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return del;
  };
}

// type generics
export type InferZodRawShape<T extends ZodRawShape> = {
  [K in keyof T]: T[K] extends ZodTypeAny ? z.infer<T[K]> : never;
};

export type MapFetchers<Fetchers extends Record<string, any>> = {
  [K in keyof Fetchers]: Fetchers[K] extends (
    options: any,
    ...inputs: infer Inputs
  ) => infer Output
    ? (...inputs: Inputs) => Output
    : never;
};

type ArrayShorterThanTwo<T extends any[]> = T extends [
  infer A,
  infer B,
  ...infer Rest
]
  ? false
  : T extends [infer A]
  ? true
  : T extends []
  ? true
  : never;
