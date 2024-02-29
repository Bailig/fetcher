import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod";
import { FetcherClient, Query, Mutation } from "./index";

function createFetchResponse(data: any, status = 200) {
  return { json: () => new Promise((resolve) => resolve(data)), status };
}

const f = new FetcherClient({
  ctx: z.string().url(),
  headers: {
    Authorization: z.string().min(1),
  },
});

const getTodos = f.fetcher(({ ctx, get }) => {
  return get(`${ctx}/todos`, z.array(z.string()));
});

const getTodo = f.fetcher(({ ctx, get }, id: string) => {
  return get(`${ctx}/todos/${id}`, z.string());
});

const createTodo = f.fetcher(({ ctx, post }, content: string) => {
  return post(
    `${ctx}/todos`,
    z.object({
      id: z.string(),
      content: z.string(),
    }),
    { content }
  );
});

const createFetcher = f.combineFetchers({
  getTodos,
  getTodo,
  createTodo,
});

const fetcher = createFetcher({
  ctx: "https://example.com",
  headers: { Authorization: "some-token" },
});

describe("fetcher()", () => {
  it("should infer ctx and headers types", () => {
    type Options = Pick<
      Parameters<Parameters<typeof f.fetcher>[0]>[0],
      "ctx" | "headers"
    >;

    expectTypeOf<Options>().toEqualTypeOf<{
      ctx: string;
      headers: { Authorization: string };
    }>();
  });

  it("should pass get and post types", () => {
    type Options = Pick<
      Parameters<Parameters<typeof f.fetcher>[0]>[0],
      "get" | "post"
    >;

    expectTypeOf<Options>().toEqualTypeOf<{
      get: Query;
      post: Mutation;
    }>();
  });

  it("should get correct data and status when expected error occur", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ error: "test" }, 404));

    const schema = z.union([z.string(), z.object({ error: z.string() })]);
    const getTodoWithExpectedError = f.fetcher(async ({ ctx, get }) => {
      const { data, response } = await get(`${ctx}/todos/1`, schema);
      expect(response.status).toEqual(404);
      expect(data).toEqual({ error: "test" });
      return "error";
    });

    const createFetcherWithExpectedError = f.combineFetchers({
      getTodoWithExpectedError,
    });
    const fetcherWithExpectedError = createFetcherWithExpectedError({
      ctx: "https://example.com",
      headers: { Authorization: "some-token" },
    });
    await fetcherWithExpectedError.getTodoWithExpectedError();
  });
});

describe("createFetcher()", () => {
  it("should infer ctx and headers types", () => {
    type Options = Parameters<typeof createFetcher>[0];
    type OptionsObj = Extract<Options, { ctx: any }>;
    type OptionsFn = Extract<Options, () => any>;

    expectTypeOf<OptionsObj>().toEqualTypeOf<ReturnType<OptionsFn>>;
    expectTypeOf<Omit<OptionsObj, "postProcess">>().toEqualTypeOf<{
      ctx: string;
      headers: { Authorization: string };
    }>();
    type OnErrorReturnType = ReturnType<
      NonNullable<NonNullable<OptionsObj["postProcess"]>["onError"]>
    >;
    expectTypeOf<OnErrorReturnType>().toEqualTypeOf<
      | ReturnType<typeof getTodos | typeof getTodo | typeof createTodo>
      | Promise<void | undefined>
      | undefined
      | void
    >();

    createFetcher(() => ({
      ctx: "https://example.com",
      headers: { Authorization: "some-token" },
      postProcess: {
        onError: async ({ options, input, error, fetcher, fetcherName }) => {
          expectTypeOf(options["ctx"]).toEqualTypeOf<string>();
          expectTypeOf(options["headers"]).toEqualTypeOf<{
            Authorization: string;
          }>();
          expectTypeOf(input).toEqualTypeOf<string | undefined>();
          expectTypeOf(error).toEqualTypeOf<unknown>();
          expectTypeOf(fetcher).toEqualTypeOf<
            typeof getTodos | typeof getTodo | typeof createTodo
          >();
          expectTypeOf(fetcherName).toEqualTypeOf<
            "getTodos" | "getTodo" | "createTodo"
          >();
          return;
        },
      },
    }));
  });

  it("should pass function options to fetcher", async () => {
    const f = new FetcherClient({
      ctx: z.string().url(),
    });
    const getTodos = f.fetcher(({ ctx, get }) => {
      expect(ctx).toEqual("https://example.com");
      return get(`${ctx}/todos`, z.array(z.string()));
    });
    const createFetcher = f.combineFetchers({
      getTodos,
    });
    const fetcher = createFetcher(() => ({
      ctx: "https://example.com",
    }));
    global.fetch = vi.fn().mockResolvedValue(createFetchResponse(["test"]));
    await fetcher.getTodos();
  });

  it("should allow updating options", async () => {
    global.fetch = vi.fn().mockResolvedValue(createFetchResponse(["test"]));

    const f = new FetcherClient({
      ctx: z.string().url(),
      headers: { Authorization: z.string().min(1) },
    });

    const getTodos = f.fetcher(async ({ ctx, get }) => {
      expect(ctx).toEqual("https://example.com/2");
      const result = await get(`${ctx}/todos`, z.array(z.string()));
      expect(global.fetch).toBeCalledWith("https://example.com/2/todos", {
        headers: { Authorization: "some-token-2" },
        referrerPolicy: "no-referrer",
      });
      return result;
    });

    const createFetcher = f.combineFetchers({
      getTodos,
    });

    let ctx = "https://example.com";
    let token = "some-token";
    const fetcher = createFetcher(() => ({
      ctx,
      headers: { Authorization: token },
    }));
    ctx = "https://example.com/2";
    token = "some-token-2";

    await fetcher.getTodos();
  });
});

describe("fetcher.getTodos()", () => {
  it("should infer input and output types", () => {
    type Params = Parameters<typeof fetcher.getTodos>;
    type Output = ReturnType<typeof fetcher.getTodos>;

    expectTypeOf<Params>().toEqualTypeOf<[]>();
    expectTypeOf<Output>().toEqualTypeOf<
      Promise<{ data: string[]; response: Response }>
    >();
  });

  it("should call global.fetch with correct url and headers", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(createFetchResponse(["test"]));
    await fetcher.getTodos();
    expect(global.fetch).toHaveBeenCalledWith("https://example.com/todos", {
      headers: { Authorization: "some-token" },
      referrerPolicy: "no-referrer",
    });
  });
});

describe("fetcher.getTodo()", () => {
  it("should infer input and output types", () => {
    type Input = Parameters<typeof fetcher.getTodo>[0];
    type Output = ReturnType<typeof fetcher.getTodo>;

    expectTypeOf<Input>().toEqualTypeOf<string>();
    expectTypeOf<Output>().toEqualTypeOf<
      Promise<{ data: string; response: Response }>
    >();
  });

  it("should call global.fetch with correct url and headers", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(createFetchResponse("test"));

    await fetcher.getTodo("1");
    expect(global.fetch).toHaveBeenCalledWith("https://example.com/todos/1", {
      headers: { Authorization: "some-token" },
      referrerPolicy: "no-referrer",
    });
  });

  it("should return correct data", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(createFetchResponse("test"));

    expect((await fetcher.getTodo("1")).data).toEqual("test");
  });

  it("should throw error if response data shape is wrong", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ content: "test" }));
    expect(() => fetcher.getTodo("1")).rejects.toThrow();
  });
});

describe("fetcher.createTodo()", () => {
  it("should infer inputs and output types", () => {
    type Input = Parameters<typeof fetcher.createTodo>[0];
    type Output = ReturnType<typeof fetcher.createTodo>;

    expectTypeOf<Input>().toEqualTypeOf<string>();
    expectTypeOf<Output>().toEqualTypeOf<
      Promise<{ data: { id: string; content: string }; response: Response }>
    >();
  });

  it("should call global.fetch with correct url and headers", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ id: "1", content: "test" }));

    await fetcher.createTodo("test");

    expect(global.fetch).toHaveBeenCalledWith("https://example.com/todos", {
      headers: {
        Authorization: "some-token",
        "Content-Type": "application/json; charset=UTF-8",
      },
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      cache: "no-cache",
      referrerPolicy: "no-referrer",
    });
  });

  it("should return correct data", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ id: "1", content: "test" }));

    expect((await fetcher.createTodo("test")).data).toEqual({
      id: "1",
      content: "test",
    });
  });

  it("should throw error if response data shape is wrong", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ content: "test" }));
    expect(() => fetcher.createTodo("test")).rejects.toThrow();
  });
});

describe("FetcherClient optional headers", () => {
  it("should allow optional headers", () => {
    new FetcherClient({
      ctx: z.string().url(),
    });
  });

  it("should allow optional headers in createFetcher", async () => {
    global.fetch = vi.fn().mockResolvedValue(createFetchResponse("test"));

    const f = new FetcherClient({
      ctx: z.string().url(),
    });

    const getNoHeaderTodo = f.fetcher(({ ctx, get }, id: string) => {
      return get(`${ctx}/todos/${id}`, z.string());
    });

    const createNoHeaderFetchers = f.combineFetchers({
      getNoHeaderTodo,
    });

    const fetchers = createNoHeaderFetchers({
      ctx: "https://example.com",
    });

    const { data } = await fetchers.getNoHeaderTodo("1");

    expect(data).toEqual("test");
  });
});

describe("Refresh token", () => {
  const authFetcher = new FetcherClient({
    ctx: z.string().url(),
  });
  const refreshTokens = authFetcher.fetcher(
    async (
      { ctx, post },
      refreshToken: string
    ): Promise<{ token: string } | { error: string }> => {
      const { data, response } = await post(`${ctx}/refresh`, z.string(), {
        refreshToken,
      });
      if (response.status !== 200) {
        return { error: "refresh token failed" };
      }
      return { token: data };
    }
  );

  const createAuthFetcher = authFetcher.combineFetchers({
    refreshTokens,
  });

  const authFetchers = createAuthFetcher({
    ctx: "https://example.com",
  });

  it("should be able to refresh token", async () => {
    const f = new FetcherClient({
      ctx: z.object({
        url: z.string().url(),
        refreshToken: z.string(),
      }),
      headers: {
        Authorization: z.string().min(1),
      },
    });

    type HandleFetch<TData> = (token: string) => Promise<{
      data: TData;
      response: Response;
      token?: string;
    }>;
    const refreshTokenAndRefetch = async <TData>({
      refreshToken,
      accessToken,

      handleFetch,
    }: {
      refreshToken: string;
      accessToken: string;
      handleFetch: HandleFetch<TData>;
    }) => {
      const { data, response } = await handleFetch(accessToken);
      if (response.status !== 401) {
        return { data, response };
      }

      const refreshTokenResult = await authFetchers.refreshTokens(refreshToken);
      if ("error" in refreshTokenResult) {
        return refreshTokenResult;
      }
      const { data: _data, response: _response } = await handleFetch(
        refreshTokenResult.token
      );
      return {
        data: _data,
        token: refreshTokenResult.token,
        response: _response,
      };
    };

    const getTodos = f.fetcher(async ({ ctx, get, ...others }) => {
      const result = await refreshTokenAndRefetch({
        refreshToken: ctx.refreshToken,
        accessToken: others.headers.Authorization,
        handleFetch: (token) =>
          get(`${ctx}/todos`, z.array(z.string()), {
            headers: { Authorization: token },
          }),
      });
      if ("error" in result) {
        return result;
      }
      return { todos: result.data, token: result.token };
    });

    const createFetchers = f.combineFetchers({
      getTodos,
    });

    const fetchers = createFetchers({
      ctx: { url: "https://example.com", refreshToken: "refresh-token" },
      headers: { Authorization: "access-token" },
    });

    global.fetch = vi.fn().mockResolvedValueOnce(createFetchResponse(["test"]));

    const result = await fetchers.getTodos();
    expect(result).toEqual({ todos: ["test"] });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse(["test"], 401))
      .mockResolvedValueOnce(createFetchResponse("token"))
      .mockResolvedValueOnce(createFetchResponse(["test"]));

    const refreshSuccessResult = await fetchers.getTodos();
    expect(refreshSuccessResult).toEqual({ todos: ["test"], token: "token" });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse(["test"], 401))
      .mockResolvedValueOnce(createFetchResponse("token", 401));

    const refreshFailResult = await fetchers.getTodos();
    expect(refreshFailResult).toEqual({ error: "refresh token failed" });
  });

  it("should be able to refresh token with a postProcess onError", async () => {
    const TOKEN_EXPIRED = "token-expired";
    const NEW_TOKEN = "new-token";
    const OLD_TOKEN = "old-token";

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(createFetchResponse({ code: TOKEN_EXPIRED }, 401))
      .mockResolvedValueOnce(createFetchResponse(NEW_TOKEN))
      .mockResolvedValueOnce(createFetchResponse("test"));

    const f = new FetcherClient({
      ctx: z.object({
        url: z.string().url(),
        refreshToken: z.string(),
      }),
      headers: {
        Authorization: z.string().min(1),
      },
    });

    const getTodo = f.fetcher(async ({ ctx, get }, id: string) => {
      const { data, response } = await get(
        `${ctx.url}/todos/${id}`,
        z.union([z.object({ code: z.string() }), z.string()])
      );
      if (
        response.status === 401 &&
        typeof data === "object" &&
        "code" in data &&
        data.code === TOKEN_EXPIRED
      ) {
        throw new Error(data.code);
      }
      return { data, response };
    });

    const getTodos = f.fetcher(async ({ ctx, get }) => {
      const { data, response } = await get(`${ctx.url}/todos`, z.string());
      return { data, response };
    });

    const createTodo = f.fetcher(
      async ({ ctx, post }, todo: { content: string }) => {
        const { data, response } = await post(
          `${ctx.url}/todos`,
          z.string(),
          todo
        );
        return { data, response };
      }
    );

    const createFetchers = f.combineFetchers({
      getTodo,
      getTodos,
      createTodo,
    });

    let token = OLD_TOKEN;
    const refreshTokensRetryCounts = new Map<string, number>();
    const fetchers = createFetchers(() => ({
      ctx: { url: "https://example.com", refreshToken: "refresh-token" },
      headers: { Authorization: token },
      postProcess: {
        onError: async ({ options, input, error, fetcher, fetcherName }) => {
          if (refreshTokensRetryCounts.get(fetcherName) === 2) {
            throw new Error(
              `Refresh token failed when calling: ${fetcherName}`
            );
          }
          if (error instanceof Error && error.message === TOKEN_EXPIRED) {
            refreshTokensRetryCounts.set(
              fetcherName,
              (refreshTokensRetryCounts.get(fetcherName) ?? 0) + 1
            );
            const refreshTokenResult = await authFetchers.refreshTokens(
              options.ctx.refreshToken
            );
            if ("error" in refreshTokenResult) {
              throw new Error(refreshTokenResult.error);
            }
            token = refreshTokenResult.token;
            fetcher(options, input as any);
          }
          return;
        },
      },
    }));

    await fetchers.getTodo("1");
    expect(global.fetch).toBeCalledTimes(3);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "https://example.com/todos/1",
      {
        headers: { Authorization: OLD_TOKEN },
        referrerPolicy: "no-referrer",
      }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://example.com/refresh",
      {
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-token" }),
        cache: "no-cache",
        referrerPolicy: "no-referrer",
      }
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      "https://example.com/todos/1",
      {
        headers: { Authorization: NEW_TOKEN },
        referrerPolicy: "no-referrer",
      }
    );
  });
});
