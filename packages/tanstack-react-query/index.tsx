"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type QueryStatus = "idle" | "pending" | "success" | "error";
type QueryKey = readonly unknown[];

type QueryState<TData> = {
  data?: TData;
  error?: unknown;
  status: QueryStatus;
  updatedAt?: number;
  promise?: Promise<TData> | null;
  queryFn?: QueryFunction<TData>;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
};

type QueryListener<TData> = (state: QueryState<TData>) => void;

type QueryFunction<TData> = () => Promise<TData>;

type QueryOptions<TData> = {
  queryKey: QueryKey;
  queryFn: QueryFunction<TData>;
  enabled?: boolean;
  staleTime?: number;
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => void;
};

type MutationFunction<TData, TVariables> = (variables: TVariables) => Promise<TData>;

type MutationOptions<TData, TVariables> = {
  mutationFn: MutationFunction<TData, TVariables>;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
};

type MutateOptions<TData, TVariables> = {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
};

class QueryClient {
  private queries = new Map<string, { state: QueryState<unknown>; listeners: Set<QueryListener<unknown>> }>();

  private keyToHash(key: QueryKey): string {
    return JSON.stringify(key);
  }

  private getRecord<TData>(key: QueryKey) {
    const hash = this.keyToHash(key);
    if (!this.queries.has(hash)) {
      this.queries.set(hash, {
        state: { status: "idle" },
        listeners: new Set(),
      });
    }
    const record = this.queries.get(hash)! as {
      state: QueryState<TData>;
      listeners: Set<QueryListener<unknown>>;
    };
    return { hash, record };
  }

  getState<TData>(key: QueryKey): QueryState<TData> {
    const { record } = this.getRecord<TData>(key);
    return record.state;
  }

  subscribe<TData>(key: QueryKey, listener: QueryListener<TData>) {
    const { record } = this.getRecord<TData>(key);
    record.listeners.add(listener as QueryListener<unknown>);
    return () => {
      record.listeners.delete(listener as QueryListener<unknown>);
    };
  }

  private notify<TData>(key: QueryKey) {
    const { record } = this.getRecord<TData>(key);
    record.listeners.forEach((listener) => listener(record.state as QueryState<unknown>));
  }

  async fetchQuery<TData>(options: {
    queryKey: QueryKey;
    queryFn: QueryFunction<TData>;
    onSuccess?: (data: TData) => void;
    onError?: (error: unknown) => void;
  }) {
    const { record } = this.getRecord<TData>(options.queryKey);

    if (record.state.promise) {
      return record.state.promise as Promise<TData>;
    }

    record.state = {
      ...record.state,
      queryFn: options.queryFn,
      onSuccess: options.onSuccess,
      onError: options.onError,
    };

    const promise = options
      .queryFn()
      .then((data) => {
        record.state = {
          ...record.state,
          data,
          status: "success",
          updatedAt: Date.now(),
          promise: null,
          queryFn: options.queryFn,
          onSuccess: options.onSuccess,
          onError: options.onError,
        };
        this.notify<TData>(options.queryKey);
        options.onSuccess?.(data);
        return data;
      })
      .catch((error) => {
        record.state = {
          ...record.state,
          error,
          status: "error",
          promise: null,
          queryFn: options.queryFn,
          onSuccess: options.onSuccess,
          onError: options.onError,
        };
        this.notify<TData>(options.queryKey);
        options.onError?.(error);
        throw error;
      });

    record.state = { ...record.state, status: record.state.status === "success" ? "success" : "pending", promise };
    this.notify<TData>(options.queryKey);

    return promise;
  }

  setQueryData<TData>(key: QueryKey, updater: TData | ((data?: TData) => TData)) {
    const { record } = this.getRecord<TData>(key);
    const nextData = typeof updater === "function" ? (updater as (data?: TData) => TData)(record.state.data as TData) : updater;
    record.state = { ...record.state, data: nextData, status: "success", updatedAt: Date.now() };
    this.notify<TData>(key);
    return nextData;
  }

  invalidateQueries({ queryKey }: { queryKey: QueryKey }) {
    const { record } = this.getRecord<unknown>(queryKey);
    if (record.state.queryFn) {
      void this.fetchQuery({
        queryKey,
        queryFn: record.state.queryFn as QueryFunction<unknown>,
        onSuccess: record.state.onSuccess,
        onError: record.state.onError,
      });
      return;
    }

    record.state = { status: "idle" };
    this.notify<unknown>(queryKey);
  }
}

const QueryClientContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>;
}

export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext);
  if (!client) {
    throw new Error("useQueryClient must be used within a QueryClientProvider");
  }
  return client;
}

export function useQuery<TData>(options: QueryOptions<TData>) {
  const client = useQueryClient();
  const enabled = options.enabled !== false;
  const key = useMemo(() => options.queryKey, [options.queryKey]);
  const [state, setState] = useState<QueryState<TData>>(() => client.getState<TData>(key));
  const staleTime = options.staleTime ?? 0;

  useEffect(() => {
    return client.subscribe<TData>(key, (nextState) => {
      setState(nextState);
    });
  }, [client, key]);

  const runQuery = useCallback(() => {
    void client.fetchQuery<TData>({
      queryKey: key,
      queryFn: options.queryFn,
      onSuccess: options.onSuccess,
      onError: options.onError,
    });
  }, [client, key, options.onError, options.onSuccess, options.queryFn]);

  useEffect(() => {
    if (!enabled) return;
    const current = client.getState<TData>(key);
    const isStale = !current.updatedAt || staleTime === 0 ? true : Date.now() - current.updatedAt > staleTime;

    if (current.status === "idle" || isStale) {
      runQuery();
    }
  }, [client, key, runQuery, enabled, staleTime]);

  const isLoading = state.status === "pending" || (enabled && state.status === "idle");

  return {
    data: state.data as TData | undefined,
    error: state.error,
    status: state.status,
    isLoading,
    isError: state.status === "error",
    isSuccess: state.status === "success",
    refetch: runQuery,
  };
}

export function useMutation<TData, TVariables = void>(options: MutationOptions<TData, TVariables>) {
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [data, setData] = useState<TData | undefined>();
  const [error, setError] = useState<unknown>();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables, mutateOptions?: MutateOptions<TData, TVariables>) => {
      setStatus("pending");
      setError(undefined);
      try {
        const result = await options.mutationFn(variables);
        if (mountedRef.current) {
          setData(result);
          setStatus("success");
          options.onSuccess?.(result, variables);
          mutateOptions?.onSuccess?.(result, variables);
        }
        return result;
      } catch (mutationError) {
        if (mountedRef.current) {
          setStatus("error");
          setError(mutationError);
          options.onError?.(mutationError, variables);
          mutateOptions?.onError?.(mutationError, variables);
        }
        throw mutationError;
      }
    },
    [options]
  );

  return {
    data,
    error,
    status,
    isPending: status === "pending",
    isError: status === "error",
    isSuccess: status === "success",
    mutate: (variables: TVariables, mutateOptions?: MutateOptions<TData, TVariables>) => {
      void mutateAsync(variables, mutateOptions);
    },
    mutateAsync,
  };
}

export { QueryClient };
