import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Local shim `packages/tanstack-react-query`: a failing query must not be an unhandled rejection. */
describe("local react-query shim", () => {
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  afterEach(() => unhandled.mockClear());

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("prefetchQuery resolves when the query fails and keeps the error in the state", async () => {
    const client = new QueryClient();
    const onError = vi.fn();
    await expect(client.prefetchQuery({ queryKey: ["k"], queryFn: () => Promise.reject(new Error("boom")), onError })).resolves.toBeUndefined();
    await flush();
    const state = client.getState(["k"]);
    expect(state.status).toBe("error");
    expect((state.error as Error).message).toBe("boom");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("fetchQuery still rejects for callers that await it", async () => {
    const client = new QueryClient();
    await expect(client.fetchQuery({ queryKey: ["k2"], queryFn: () => Promise.reject(new Error("nope")) })).rejects.toThrow("nope");
  });

  it("invalidateQueries refetches with the remembered queryFn without an unhandled rejection", async () => {
    const client = new QueryClient();
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      return calls === 1 ? Promise.resolve("ok") : Promise.reject(new Error("second"));
    };
    await client.prefetchQuery({ queryKey: ["k3"], queryFn });
    expect(client.getState(["k3"]).data).toBe("ok");
    client.invalidateQueries({ queryKey: ["k3"] });
    await flush();
    await flush();
    expect(calls).toBe(2);
    expect(client.getState(["k3"]).status).toBe("error");
    expect(client.getState(["k3"]).data).toBe("ok");
    expect(unhandled).not.toHaveBeenCalled();
  });
});
