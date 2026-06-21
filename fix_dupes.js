require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.POSTGRES_URL);
(async () => {
  const merges = [
    { keep: '0a1fdf33-10db-4d6e-86c0-bd368f06df84', old: '748c9b0a-58d9-45da-8e60-983599375486', who: 'abhi' },
    { keep: '3d1105af-c6c7-4485-b4b9-467b5cd1bd4e', old: '592d7a63-d20d-42a8-a6f7-2f4bdcfbe634', who: 'jerry' },
  ];
  for (const m of merges) {
    for (const t of ['Chat','Document','SandboxRun','Suggestion']) {
      try {
        const r = await sql.unsafe('UPDATE "'+t+'" SET "userId" = $1 WHERE "userId" = $2', [m.keep, m.old]);
        if (r.count > 0) console.log(t+':'+m.who+':moved:'+r.count);
      } catch(e) {}
    }
    try {
      await sql.unsafe('DELETE FROM "User" WHERE id = $1', [m.old]);
      console.log('DELETED:'+m.who);
    } catch(e) { console.log('DEL_FAIL:'+m.who+':'+e.message.slice(0,80)); }
  }
  const f = await sql`SELECT id, email, name, role FROM "User" WHERE email NOT LIKE 'guest-%' ORDER BY email`;
  console.log('FINAL_COUNT:'+f.length);
  for (const u of f) console.log(JSON.stringify(u));
  await sql.end();
})();
