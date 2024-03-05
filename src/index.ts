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

export type PostProcess<
  TContextSchema extends ZodTypeAny,
  TOptions extends
    | { ctx: ZodTypeAny }
    | { ctx: ZodTypeAny; headers: ZodRawShape },
  THeadersShape extends TOptions extends { headers: ZodRawShape }
    ? TOptions["headers"]
    : undefined,
  TFetchers extends Record<
    string,
    FetcherDefinition<TContextSchema, THeadersShape>
  >
> = {
  onError?: ({
    options,
    input,
    error,
    fetcher,
    fetcherName,
  }: {
    options: Parameters<TFetchers[keyof TFetchers]>[0];
    input: Parameters<TFetchers[keyof TFetchers]>[1];
    error: unknown;
    fetcher: TFetchers[keyof TFetchers];
    fetcherName: Keys<TFetchers>;
  }) =>
    | Promise<
        Awaited<ReturnType<TFetchers[keyof TFetchers]>> | undefined | void
      >
    | void
    | undefined;
};

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
          postProcess?: PostProcess<
            TContextSchema,
            TOptions,
            THeadersShape,
            TFetchers
          >;
        }
      : {
          ctx: z.infer<TContextSchema>;
          postProcess?: PostProcess<
            TContextSchema,
            TOptions,
            THeadersShape,
            TFetchers
          >;
        };

    type OptionsFn = () => OptionsObj;

    return (options: OptionsObj | OptionsFn): MapFetchers<TFetchers> => {
      const fetchers = Object.entries(fetcherDefs).reduce(
        (acc, [key, fetcher]) => {
          acc[key] = async (input: any) => {
            const opts = typeof options === "function" ? options() : options;
            const ctx = this.ctxSchema.parse(opts.ctx);

            const get = this.createGet(() =>
              this.getHeadersFromOptions(options)
            );
            const post = this.createPost(() =>
              this.getHeadersFromOptions(options)
            );
            const patch = this.createPatch(() =>
              this.getHeadersFromOptions(options)
            );
            const put = this.createPut(() =>
              this.getHeadersFromOptions(options)
            );
            const del = this.createDelete(() =>
              this.getHeadersFromOptions(options)
            );

            const fetcherOpts = {
              ctx,
              headers: this.getHeadersFromOptions(options),
              get,
              post,
              patch,
              put,
              delete: del,
            } as any;

            try {
              const result = await fetcher(fetcherOpts, input);
              return result;
            } catch (error) {
              if (opts.postProcess?.onError) {
                return opts.postProcess.onError({
                  options: fetcherOpts,
                  input,
                  error,
                  fetcher: fetcher as any,
                  fetcherName: key as Keys<TFetchers>,
                });
              }
              throw error;
            }
          };
          return acc;
        },
        {} as any
      );

      return fetchers;
    };
  }

  private getHeadersFromOptions = <TOptions>(options: TOptions) => {
    const opts = typeof options === "function" ? options() : options;

    const headers =
      this.headersShape && "headers" in opts
        ? z.object(this.headersShape).parse(opts.headers)
        : undefined;
    return headers;
  };

  private createGet = (
    getHeaders: () => Record<string, string> | void
  ): Query => {
    const get: Query = async (url, schema, options) => {
      const response = await fetch(url, {
        referrerPolicy: "no-referrer",
        ...options,
        headers: {
          ...(getHeaders() ?? {}),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return get;
  };

  private createPost = (
    getHeaders: () => Record<string, string> | void
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
          ...(getHeaders() ?? {}),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return post;
  };

  private createPatch = (
    getHeaders: () => Record<string, string> | void
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
          ...(getHeaders() ?? {}),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return patch;
  };

  private createPut = (
    getHeaders: () => Record<string, string> | void
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
          ...(getHeaders() ?? {}),
          ...options?.headers,
        },
      });
      return { data: schema.parse(await response.json()), response };
    };
    return put;
  };

  private createDelete = (
    getHeaders: () => Record<string, string> | void
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
          ...(getHeaders() ?? {}),
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

type Keys<T> = T extends Record<infer K, any> ? K : never;
