// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node tests/ajouts-produits-database.mjs
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE_PATH);
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$; grant usage on schema auth to authenticated; create table aquaponie_basins(id uuid primary key); create table aquaponie_tanks(id uuid primary key); create function is_active_app_user() returns boolean language sql as $$select auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$; insert into aquaponie_basins values('00000000-0000-0000-0000-000000000002');`);
const sql=await readFile(new URL('../supabase/aquaponie-ajouts-produits.sql',import.meta.url),'utf8');
await db.exec(sql);await db.exec(sql);
await db.exec(`set role authenticated; set test.uid='00000000-0000-0000-0000-000000000001';`);
const insert=`insert into aquaponie_product_additions(product_name,quantity,unit,addition_date,addition_time,target_type,basin_id,target_label) values('Produit',12.5,'g','2026-11-10','08:30','bassin','00000000-0000-0000-0000-000000000002','Bassin B1') returning *`;
const row=(await db.query(insert)).rows[0];assert.equal(row.addition_time,'08:30:00');
for(const quantity of ['0','-1',"'NaN'","'Infinity'"])await assert.rejects(()=>db.query(insert.replace('12.5',quantity)));
await db.exec(`set test.uid='00000000-0000-0000-0000-000000000003'`);assert.equal((await db.query('select * from aquaponie_product_additions')).rows.length,0);await assert.rejects(()=>db.query(insert));
await db.exec(`reset role; delete from aquaponie_basins;`);const history=(await db.query('select * from aquaponie_product_additions')).rows[0];assert.equal(history.basin_id,null);assert.equal(history.target_label,'Bassin B1');
await db.exec(`set role anon`);await assert.rejects(()=>db.query('select * from aquaponie_product_additions'));
await db.exec(`set role authenticated; set test.uid='00000000-0000-0000-0000-000000000001'; update aquaponie_product_additions set quantity=15;`);assert.equal(Number((await db.query('select quantity from aquaponie_product_additions')).rows[0].quantity),15);
await db.exec('delete from aquaponie_product_additions');assert.equal((await db.query('select * from aquaponie_product_additions')).rows.length,0);
await db.close();console.log('SQL : réexécution, enregistrement, contraintes, droits, historique et corrections validés.');
