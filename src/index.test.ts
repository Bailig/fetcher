import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { FetcherClient } from "./index";

function createFetchResponse(data: any) {
  return { json: () => new Promise((resolve) => resolve(data)) };
}

const fetcherClient = new FetcherClient({
  ctx: z.enum(["production", "staging"]),
  headers: {
    Authorization: z.string().min(1),
  },
  fetchers: {
    getTodo: ({ ctx, get }, id: string) => {
      return get(
        `https://${ctx}.com/${id}`,
        z.object({ id: z.string().min(1), content: z.string().min(1) })
      );
    },
    createTodo: ({ ctx, post }, content: string) => {
      return post(
        `https://${ctx}.com/`,
        z.object({ id: z.string().min(1), content: z.string().min(1) }),
        { content }
      );
    },
  },
});

describe("global.fetch()", () => {
  it("should be called with production url, id, and token", async () => {
    const todoFetcher = fetcherClient.createFetcher({
      ctx: "production",
      headers: { Authorization: "some-token" },
    });

    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ id: "1", content: "test" }));

    await todoFetcher.getTodo("");
    expect(fetch).toHaveBeenCalledWith("https://production.com/", {
      headers: {
        Authorization: "some-token",
      },
    });
  });

  it("should be called with staging url and token", async () => {
    const todoFetcher = fetcherClient.createFetcher({
      ctx: "staging",
      headers: { Authorization: "1" },
    });

    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ id: "1", content: "test" }));

    await todoFetcher.getTodo("");
    expect(fetch).toHaveBeenCalledWith("https://staging.com/", {
      headers: {
        Authorization: "1",
      },
    });
  });

  it("should be called with production url, token, and data", async () => {
    const todoFetcher = fetcherClient.createFetcher({
      ctx: "production",
      headers: { Authorization: "some-token" },
    });

    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ id: "1", content: "test" }));

    await todoFetcher.createTodo("my first todo");
    expect(fetch).toHaveBeenCalledWith("https://production.com/", {
      method: "POST",
      cache: "no-cache",
      referrerPolicy: "no-referrer",
      body: '{"content":"my first todo"}',
      headers: {
        Authorization: "some-token",
        "Content-Type": "application/json; charset=UTF-8",
      },
    });
  });
});

describe("getTodo()", () => {
  it("should return todo", async () => {
    const todoFetcher = fetcherClient.createFetcher({
      ctx: "production",
      headers: { Authorization: "some-token" },
    });

    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ id: "1", content: "test" }));

    expect(await todoFetcher.getTodo("1")).toMatchInlineSnapshot(`
      {
        "content": "test",
        "id": "1",
      }
    `);
  });
});

describe("createTodo()", () => {
  it("should return todo", async () => {
    const todoFetcher = fetcherClient.createFetcher({
      ctx: "production",
      headers: { Authorization: "some-token" },
    });

    global.fetch = vi
      .fn()
      .mockResolvedValue(createFetchResponse({ id: "1", content: "test" }));

    expect(await todoFetcher.createTodo("1")).toMatchInlineSnapshot(`
      {
        "content": "test",
        "id": "1",
      }
    `);
  });
});
