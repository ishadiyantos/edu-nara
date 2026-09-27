import { database } from '../src/lib/server/db/client';
database().sqlite.close();
console.log('Database migrations complete.');
