import { Injectable, Logger, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool | undefined;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString) {
      this.pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
      // Never log connection errors, which can contain credentials or SQL data.
      this.pool.on('error', () => this.logger.error('Idle database connection failed.'));
    }
  }

  private getPool(): Pool {
    if (!this.pool) throw new ServiceUnavailableException('Database is not configured.');
    return this.pool;
  }

  query<Row extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []): Promise<QueryResult<Row>> {
    return this.getPool().query<Row>(sql, values);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error: unknown) {
      try { await client.query('ROLLBACK'); }
      catch { discard = true; }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool?.end();
  }
}
