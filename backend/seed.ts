import { prisma } from "./src/db/prisma";

async function main() {
  const sender = await prisma.sender.upsert({
    where: { email: "test-sender@outbox.test" },
    update: {},
    create: { email: "test-sender@outbox.test", name: "Test Sender" },
  });
  console.log("sender id:", sender.id);
}

main().finally(() => prisma.$disconnect());
