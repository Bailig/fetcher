import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  FetcherClient,
  FetcherDefinition,
  Get,
  MapFetchers,
  Post,
} from "./index";

function createFetchResponse(data: any) {
  return { json: () => new Promise((resolve) => resolve(data)) };
}

const f = new FetcherClient({
  ctx: z.string().url(),
  headers: {
    Authorization: z.string().min(1),
  },
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
  getTodo,
  createTodo,
});

const fetcher = createFetcher({
  ctx: "https://example.com",
  headers: { Authorization: "some-token" },
});

const todo = await fetcher.getTodo("1");
const newTodo = await fetcher.createTodo("test");

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

describe("fetcher.getTodo()", () => {
  it("should infer input and output types", async () => {
    type Input = Parameters<typeof fetcher.getTodo>[0];
    type Output = ReturnType<typeof fetcher.getTodo>;

    expectTypeOf<Input>().toEqualTypeOf<string>();
    expectTypeOf<Output>().toEqualTypeOf<Promise<string>>();
  });
});
