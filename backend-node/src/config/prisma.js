const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/veterinaria_db';
const adapter = new PrismaMariaDb(connectionString);

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
