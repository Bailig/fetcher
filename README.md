# BYLG Fetcher

BYLG Fetcher is a small wrapper around fetch and Zod. It allows you to predefine headers and context and have a type-safe response.

A FetcherClient instance provides two methods, fetcher and combineFetchers, that are used to define and combine fetcher functions respectively. A fetcher function could be an asynchronous function that makes requests to a remote server and returns a typed response.

## Installation

```bash
npm install @bylg/fetcher
yarn add @bylg/fetcher
pnpm add @bylg/fetcher
```

Zod is a peer dependency, so you will need to install that as well.

```bash
npm install zod
yarn add zod
pnpm add zod
```

## Quick Start

You can create a new instance of the FetcherClient by passing it a context schema and headers schema. You can then use the fetcher and combineFetchers methods to define and combine fetcher functions respectively.

```ts
import { FetcherClient } from "@bylg/fetcher";
import { z } from "zod";

const f = new FetcherClient({
  ctx: z.string().url(), // Define the context schema
  headers: {
    Authorization: z.string().min(1), // Define the headers schema
  },
});

// Define a fetcher function
const getTodo = f.fetcher(({ ctx, headers, get, post }, id: string) => {
  const url = `${ctx}/todos/${id}`; // Use the context
  const schema = z.string(); // Define the response schema
  const options = {}; // Define the request options. Headers are automatically added.
  return get(url, schema, options);
});

// Define a fetcher function
const createTodo = f.fetcher(({ ctx, post }, content: string) => {
  const url = `${ctx}/todos`; // Use the context
  const schema = z.object({
    id: z.string(),
    content: z.string(),
  }); // Define the response schema
  const data = { content }; // Define the data to be sent in the request body
  const options = {}; // Define the request options. Headers are automatically added.
  return post(url, schema, data, options);
});

// Combine the fetcher functions
const createTodoFetcher = f.combineFetchers({
  getTodo,
  createTodo,
});

// Define the context and headers
// Alternatively, you can use a function that returns the context and headers
const todoFetcher = createTodoFetcher({
  ctx: "https://example.com", // The type of ctx is inferred from the context schema
  headers: { Authorization: "some-token" }, // The type of headers is inferred from the headers schema
});

// Call the fetcher functions
const todo = await todoFetcher.getTodo("1");
//                                 ^?  (property) getTodo: (input: string) => Promise<string>
const newTodo = await todoFetcher.createTodo({ content: "test" });
//                                   ^?  (property) createTodo: (input: string) => Promise<{ id: string; content: string; }>
```

Above code defines context and headers schemas and creates a `FetcherClient` instance with them. Two fetcher functions are defined using the `fetcher` method, and then combined using the `combineFetchers` method.

Now you can use it in React Query:

```ts
import { useQuery } from "react-query";
import { todoFetcher } from "path/to/todoFetcher";

const Todo = ({ id }) => {
  const { data, isLoading, error } = useQuery(["todo", id], () =>
    todoFetcher.getTodo(id)
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{data}</div>;
};
```

```ts
import { useMutation } from "react-query";
import { todoFetcher } from "path/to/todoFetcher";

const TodoForm = () => {
  const [content, setContent] = useState("");
  const { mutate, isLoading, error } = useMutation(todoFetcher.createTodo);

  const handleSubmit = () => {
    e.preventDefault();
    mutate({ content });
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return (
    <form onSubmit={handleSubmit}>
      <input value={content} onChange={(e) => setContent(e.target.value)} />
      <button type="submit">Create</button>
    </form>
  );
};
```

## Using `postProcess` to refresh token

```ts
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
    data.code === "token-expired"
  ) {
    // throw error to trigger onError
    throw new Error(data.code);
  }
  return { data, response };
});

const createFetchers = f.combineFetchers({
  getTodo,
});

let token = "old-token";
const refreshTokensRetryCounts = new Map<string, number>();

const fetchers = createFetchers(() => ({
  ctx: { url: "https://example.com", refreshToken: "refresh-token" },
  headers: { Authorization: token },
  postProcess: {
    // when your fetcher throw an error, it will call this function with the error and original fetcher function and input
    onError: async ({ options, input, error, fetcher, fetcherName }) => {
      if (refreshTokensRetryCounts.get(fetcherName) === 2) {
        throw new Error(`Refresh token failed when calling: ${fetcherName}`);
      }
      // if the error is token expired, we will refresh the token and retry the original fetcher
      if (error instanceof Error && error.message === "token-expired") {
        refreshTokensRetryCounts.set(
          fetcherName,
          (refreshTokensRetryCounts.get(fetcherName) ?? 0) + 1
        );
        // get new token and update token
        token = await refreshTokens(options.ctx.refreshToken);
        await fetcher(options, input as any);
      }
      return;
    },
  },
}));

await fetchers.getTodo("1");
```
