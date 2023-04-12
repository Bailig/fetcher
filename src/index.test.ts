import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod";
import { FetcherClient, Get, Post } from "./index";

function createFetchResponse(data: any) {
  return { json: () => new Promise((resolve) => resolve(data)) };
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
      get: Get;
      post: Post;
    }>();
  });
});

describe("createFetcher()", () => {
  it("should infer ctx and headers types", () => {
    type Options = Pick<Parameters<typeof createFetcher>[0], "ctx" | "headers">;

    expectTypeOf<Options>().toEqualTypeOf<{
      ctx: string;
      headers: { Authorization: string };
    }>();
  });
});

describe("fetcher.getTodos()", () => {
  it("should infer input and output types", () => {
    type Params = Parameters<typeof fetcher.getTodos>;
    type Output = ReturnType<typeof fetcher.getTodos>;

    expectTypeOf<Params>().toEqualTypeOf<[]>();
    expectTypeOf<Output>().toEqualTypeOf<Promise<string[]>>();
  });

  it("should call global.fetch with correct url and headers", async () => {
    global.fetch = vi.fn().mockResolvedValue(createFetchResponse(["test"]));
    await fetcher.getTodos();
    expect(global.fetch).toHaveBeenCalledWith("https://example.com/todos", {
      headers: { Authorization: "some-token" },
    });
  });
});

describe("fetcher.getTodo()", () => {
  it("should infer input and output types", () => {
    type Input = Parameters<typeof fetcher.getTodo>[0];
    type Output = ReturnType<typeof fetcher.getTodo>;

    expectTypeOf<Input>().toEqualTypeOf<string>();
    expectTypeOf<Output>().toEqualTypeOf<Promise<string>>();
  });

  it("should call global.fetch with correct url and headers", async () => {
    global.fetch = vi.fn().mockResolvedValue(createFetchResponse("test"));

    await fetcher.getTodo("1");
    expect(global.fetch).toHaveBeenCalledWith("https://example.com/todos/1", {
      headers: { Authorization: "some-token" },
    });
  });

  it("should return correct data", async () => {
    global.fetch = vi.fn().mockResolvedValue(createFetchResponse("test"));

    expect(await fetcher.getTodo("1")).toEqual("test");
  });

  it("should throw error if response data shape is wrong", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ content: "test" }));
    expect(() => fetcher.getTodo("1")).rejects.toThrow();
  });
});

describe("fetcher.createTodo()", () => {
  it("should infer inputs and output types", () => {
    type Input = Parameters<typeof fetcher.createTodo>[0];
    type Output = ReturnType<typeof fetcher.createTodo>;

    expectTypeOf<Input>().toEqualTypeOf<string>();
    expectTypeOf<Output>().toEqualTypeOf<
      Promise<{ id: string; content: string }>
    >();
  });

  it("should call global.fetch with correct url and headers", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ id: "1", content: "test" }));

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
      .mockResolvedValue(createFetchResponse({ id: "1", content: "test" }));

    expect(await fetcher.createTodo("test")).toEqual({
      id: "1",
      content: "test",
    });
  });

  it("should throw error if response data shape is wrong", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ content: "test" }));
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

    const result = await fetchers.getNoHeaderTodo("1");

    expect(result).toEqual("test");
  });
});
