/**
 * lib/twenty/client.ts — Twenty CRM GraphQL Client
 * Phase 30: Rate-limited GraphQL client with batch upsert support
 */
const TWENTY_API_URL =
  process.env.TWENTY_SERVER_URL?.replace(/\/$/, "") ?? "https://crm.newleaf.financial";
const TWENTY_API_KEY =
  process.env.TWENTY_API_KEY ||
  process.env.TWENTYFIRST_API_KEY ||
  "placeholder";

const RATE_LIMIT_RPM = 60; // Safe margin under 100/min limit
const RATE_WINDOW_MS = 60_000;
const BATCH_SIZE = 60;

let requestTimestamps: number[] = [];

function enforceRateLimit(): void {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  requestTimestamps = requestTimestamps.filter((t) => t > windowStart);

  if (requestTimestamps.length >= RATE_LIMIT_RPM) {
    const oldest = requestTimestamps[0];
    const waitMs = oldest - windowStart + 100;
    if (waitMs > 0) {
      console.log(`[twenty-client] Rate limit — waiting ${waitMs}ms`);
      // Synchronous sleep for script usage
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    }
  }
  requestTimestamps.push(now);
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

export async function twentyGraphQL<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  enforceRateLimit();

  const res = await fetch(`${TWENTY_API_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "5", 10);
    console.log(`[twenty-client] 429 — waiting ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return twentyGraphQL(query, variables);
  }

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Twenty API error ${res.status}: ${JSON.stringify(json)}`
    );
  }

  return json as GraphQLResponse<T>;
}

export interface TwentyPerson {
  id: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  notes?: string;
  status?: string;
  jobTitle?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TwentyCompany {
  id: string;
  name: string;
  domainName?: string;
  employees?: number;
}

/** Batch upsert people into Twenty */
export async function upsertPeople(
  people: Array<{
    externalId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    notes?: string;
    jobTitle?: string;
  }>
): Promise<{ created: number; updated: number; errors: string[] }> {
  const results = { created: 0, updated: 0, errors: [] as string[] };

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < people.length; i += BATCH_SIZE) {
    const batch = people.slice(i, i + BATCH_SIZE);
    const mutation = `
      mutation UpsertPeople($data: [PersonUpsertInput!]!) {
        upsertPeople(data: $data) {
          id
          externalId
        }
      }
    `;

    try {
      const res = await twentyGraphQL<{
        upsertPeople: Array<{ id: string; externalId: string }>;
      }>(mutation, { data: batch });

      if (res.errors) {
        results.errors.push(...res.errors.map((e) => e.message));
      } else if (res.data) {
        results.created += batch.length; // Upsert — can't distinguish
      }
    } catch (err) {
      results.errors.push(
        `Batch ${i / BATCH_SIZE}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return results;
}

/** Query a person by external_id */
export async function findPersonByExternalId(
  externalId: string
): Promise<TwentyPerson | null> {
  const query = `
    query FindPerson($filter: PersonFilterInput!) {
      people(filter: $filter, first: 1) {
        edges {
          node {
            id
            externalId
            firstName
            lastName
            email
            phone
            city
            state
            notes
            status
          }
        }
      }
    }
  `;

  const res = await twentyGraphQL<{
    people: { edges: Array<{ node: TwentyPerson }> };
  }>(query, { filter: { externalId: { eq: externalId } } });

  if (res.errors || !res.data) return null;
  return res.data.people.edges[0]?.node ?? null;
}

/** Update a person in Twenty */
export async function updatePerson(
  twentyId: string,
  fields: Partial<TwentyPerson>
): Promise<TwentyPerson | null> {
  const mutation = `
    mutation UpdatePerson($id: ID!, $data: PersonUpdateInput!) {
      updatePerson(id: $id, data: $data) {
        id
        externalId
        firstName
        lastName
        email
        updatedAt
      }
    }
  `;

  const res = await twentyGraphQL<{
    updatePerson: TwentyPerson;
  }>(mutation, { id: twentyId, data: fields });

  if (res.errors) {
    throw new Error(`updatePerson failed: ${res.errors[0]?.message}`);
  }
  return res.data?.updatePerson ?? null;
}

export { TWENTY_API_URL, TWENTY_API_KEY, RATE_LIMIT_RPM, BATCH_SIZE };
