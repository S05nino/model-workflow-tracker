// Local JSON API client - replaces Supabase for Docker deployment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

type Table = 'projects' | 'releases' | 'release_models' | 'app_config';

interface QueryBuilder<T> {
  select: (columns?: string) => QueryBuilder<T>;
  eq: (column: string, value: string | boolean) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>;
  single: () => Promise<{ data: T | null; error: Error | null }>;
  then: (resolve: (result: { data: T[] | null; error: Error | null }) => void) => Promise<void>;
}

interface InsertBuilder<T> {
  select: () => Promise<{ data: T[] | null; error: Error | null }>;
  single: () => Promise<{ data: T | null; error: Error | null }>;
}

interface UpdateBuilder<T> {
  eq: (column: string, value: string) => UpdateBuilder<T>;
  select: () => Promise<{ data: T[] | null; error: Error | null }>;
  single: () => Promise<{ data: T | null; error: Error | null }>;
}

interface DeleteBuilder {
  eq: (column: string, value: string) => Promise<{ data: null; error: Error | null }>;
}

class LocalQueryBuilder<T> implements QueryBuilder<T> {
  private table: Table;
  private filters: Record<string, string | boolean> = {};
  private orderColumn?: string;
  private orderAsc = true;
  private isSingle = false;

  constructor(table: Table) {
    this.table = table;
  }

  select(_columns?: string): QueryBuilder<T> {
    return this;
  }

  eq(column: string, value: string | boolean): QueryBuilder<T> {
    this.filters[column] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T> {
    this.orderColumn = column;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  single(): Promise<{ data: T | null; error: Error | null }> {
    this.isSingle = true;
    return this.execute() as Promise<{ data: T | null; error: Error | null }>;
  }

  async then(resolve: (result: { data: T[] | null; error: Error | null }) => void): Promise<void> {
    const result = await this.execute();
    resolve(result as { data: T[] | null; error: Error | null });
  }

  private async execute(): Promise<{ data: T | T[] | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_URL}/${this.table}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      let data: T[] = await response.json();
      
      // Apply filters
      for (const [key, value] of Object.entries(this.filters)) {
        data = data.filter((item) => (item as Record<string, unknown>)[key] === value);
      }
      
      // Apply ordering
      if (this.orderColumn) {
        const col = this.orderColumn;
        const asc = this.orderAsc;
        data.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[col];
          const bVal = (b as Record<string, unknown>)[col];
          if (aVal < bVal) return asc ? -1 : 1;
          if (aVal > bVal) return asc ? 1 : -1;
          return 0;
        });
      }
      
      if (this.isSingle) {
        return { data: data[0] || null, error: null };
      }
      
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

class LocalInsertBuilder<T> implements InsertBuilder<T> {
  private table: Table;
  private insertData: Partial<T> | Partial<T>[];

  constructor(table: Table, data: Partial<T> | Partial<T>[]) {
    this.table = table;
    this.insertData = data;
  }

  async select(): Promise<{ data: T[] | null; error: Error | null }> {
    try {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const results: T[] = [];
      
      for (const item of items) {
        const response = await fetch(`${API_URL}/${this.table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        results.push(await response.json());
      }
      
      return { data: results, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    const result = await this.select();
    return { data: result.data?.[0] || null, error: result.error };
  }
}

class LocalUpdateBuilder<T> implements UpdateBuilder<T> {
  private table: Table;
  private updateData: Partial<T>;
  private filterId?: string;

  constructor(table: Table, data: Partial<T>) {
    this.table = table;
    this.updateData = data;
  }

  eq(column: string, value: string): UpdateBuilder<T> {
    if (column === 'id') {
      this.filterId = value;
    }
    return this;
  }

  async select(): Promise<{ data: T[] | null; error: Error | null }> {
    if (!this.filterId) {
      return { data: null, error: new Error('No id filter provided') };
    }
    
    try {
      const response = await fetch(`${API_URL}/${this.table}/${this.filterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.updateData)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { data: [data], error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  async single(): Promise<{ data: T | null; error: Error | null }> {
    const result = await this.select();
    return { data: result.data?.[0] || null, error: result.error };
  }
}

class LocalDeleteBuilder implements DeleteBuilder {
  private table: Table;

  constructor(table: Table) {
    this.table = table;
  }

  async eq(column: string, value: string): Promise<{ data: null; error: Error | null }> {
    if (column !== 'id') {
      return { data: null, error: new Error('Only id filter supported for delete') };
    }
    
    try {
      const response = await fetch(`${API_URL}/${this.table}/${value}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

class LocalTableClient<T> {
  private table: Table;

  constructor(table: Table) {
    this.table = table;
  }

  select(columns?: string): QueryBuilder<T> {
    return new LocalQueryBuilder<T>(this.table).select(columns);
  }

  insert(data: Partial<T> | Partial<T>[]): InsertBuilder<T> {
    return new LocalInsertBuilder<T>(this.table, data);
  }

  update(data: Partial<T>): UpdateBuilder<T> {
    return new LocalUpdateBuilder<T>(this.table, data);
  }

  delete(): DeleteBuilder {
    return new LocalDeleteBuilder(this.table);
  }
}

class LocalRpcClient {
  async validate_shared_password(params: { input_password: string }): Promise<{ data: boolean | null; error: Error | null }> {
    try {
      const response = await fetch(`${API_URL}/validate-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: params.input_password })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return { data: result.valid, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }
}

class LocalClient {
  private rpcClient = new LocalRpcClient();

  from<T>(table: Table): LocalTableClient<T> {
    return new LocalTableClient<T>(table);
  }

  rpc(functionName: string, params: Record<string, unknown>): Promise<{ data: unknown; error: Error | null }> {
    if (functionName === 'validate_shared_password') {
      return this.rpcClient.validate_shared_password(params as { input_password: string });
    }
    return Promise.resolve({ data: null, error: new Error(`Unknown function: ${functionName}`) });
  }

  // Stub for channel - no realtime in local mode
  channel(_name: string) {
    return {
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} })
    };
  }
}

export const localClient = new LocalClient();
