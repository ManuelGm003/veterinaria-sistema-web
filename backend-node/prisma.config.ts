import 'dotenv/config';
import { defineConfig } from '@prisma/config';



export default defineConfig({
  migrations: {
    seed: 'node prisma/seed.js'
  },
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL
  },
});
