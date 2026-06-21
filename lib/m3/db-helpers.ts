/**
 * M3 DB Helpers — Person upsert against Twenty PostgreSQL
 * Uses direct PG connection to the twenty-newleaf-db container.
 */

import { Pool } from "pg";
import crypto from "crypto";

const pool = new Pool({
  host: process.env.TWENTY_DB_HOST || "localhost",
  port: parseInt(process.env.TWENTY_DB_PORT || "5434"),
  database: process.env.TWENTY_DB_NAME || "twenty",
  user: process.env.TWENTY_DB_USER || "twenty",
  password: process.env.TWENTY_DB_PASSWORD || "77242982295764e06e103f5611b8b5c8",
  max: 5,
  idleTimeoutMillis: 30000,
});

const WORKSPACE_SCHEMA = "workspace_1wgvd1injqtife6y4rvfbu3h5";

function uuid(): string {
  return crypto.randomUUID();
}

function cleanPhone(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-10);
}

export interface PersonUpsertInput {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  agentEmail: string | null;
  notes: string | null;
}

export interface PersonUpsertResult {
  personId: string;
  isNew: boolean;
  action: "created" | "updated";
}

export async function upsertPerson(input: PersonUpsertInput): Promise<PersonUpsertResult> {
  const { firstName, lastName, email, phone, agentEmail, notes } = input;
  const phone10 = cleanPhone(phone);

  const client = await pool.connect();
  try {
    // Search for existing by phone (last 10 digits) or email
    let existing: { id: string } | null = null;

    if (phone10) {
      const res = await client.query(
        `SELECT id FROM ${WORKSPACE_SCHEMA}.person WHERE "phonesPrimaryPhoneNumber" LIKE $1 LIMIT 1`,
        [`%${phone10}%`]
      );
      if (res.rows.length > 0) existing = res.rows[0];
    }

    if (!existing && email) {
      const res = await client.query(
        `SELECT id FROM ${WORKSPACE_SCHEMA}.person WHERE "emailsPrimaryEmail" = $1 LIMIT 1`,
        [email.toLowerCase()]
      );
      if (res.rows.length > 0) existing = res.rows[0];
    }

    if (existing) {
      // Update existing Person
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIdx = 1;

      if (agentEmail) {
        updates.push(`"newleafAgentEmail" = $${paramIdx++}`);
        values.push(agentEmail);
      }
      if (notes) {
        updates.push(`"internalNotes" = COALESCE("internalNotes", '') || $${paramIdx++}`);
        values.push(`\n[M3 Submission] ${notes}`);
      }
      if (firstName && lastName) {
        updates.push(`"nameFirstName" = $${paramIdx++}`, `"nameLastName" = $${paramIdx++}`);
        values.push(firstName, lastName);
      }

      if (updates.length > 0) {
        values.push(existing.id);
        await client.query(
          `UPDATE ${WORKSPACE_SCHEMA}.person SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
          values
        );
      }

      return { personId: existing.id, isNew: false, action: "updated" };
    }

    // Create new Person
    const personId = uuid();
    await client.query(
      `INSERT INTO ${WORKSPACE_SCHEMA}.person (
        id, "nameFirstName", "nameLastName", "emailsPrimaryEmail",
        "phonesPrimaryPhoneNumber", "newleafAgentEmail", "internalNotes",
        "enrollmentStatus", "createdByName", "createdBySource"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        personId,
        firstName,
        lastName,
        email?.toLowerCase() || null,
        phone || null,
        agentEmail || null,
        notes ? `[M3 Submission] ${notes}` : null,
        "LEAD",
        agentEmail || "m3-submission",
        "API",
      ]
    );

    return { personId, isNew: true, action: "created" };
  } finally {
    client.release();
  }
}

export async function getPersonById(personId: string) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, "nameFirstName", "nameLastName", "emailsPrimaryEmail",
              "phonesPrimaryPhoneNumber", "enrollmentStatus", "newleafAgentEmail"
       FROM ${WORKSPACE_SCHEMA}.person WHERE id = $1`,
      [personId]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

export { pool };
