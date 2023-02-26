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
