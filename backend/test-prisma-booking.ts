import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const list = await prisma.booking.findMany();
  console.log(list.length);
}

main().catch(console.error);
