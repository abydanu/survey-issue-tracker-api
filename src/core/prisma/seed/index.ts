import { faker } from "@faker-js/faker";
import { Role } from "../../../generated/prisma/index.js";
import prisma from "../../../infrastructure/database/prisma.js";
import bcrypt from 'bcryptjs';

async function main() {
    console.log("Seeding Database");

    const defaultPassword = await bcrypt.hash("password", 10)
    const TOTAL_USER = 50;

    const users = Array.from({ length: TOTAL_USER }).map(() => {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        return {
            name: `${firstName} ${lastName}`,
            username: faker.internet.username({
                firstName,
                lastName
            }).toLowerCase(),
            password: defaultPassword,
            role: Role.USER
        }
    })

    await prisma.user.createMany({
        data: users,
        skipDuplicates: true,
    })

    const adminPassword = await bcrypt.hash("admin", 10)
    const userPassword = await bcrypt.hash("user", 10)

    await prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
            username: "admin",
            name: "Alfonsus Siahaan",
            password: adminPassword,
            role: Role.ADMIN
        },
    })

    await prisma.user.upsert({
        where: { username: "user" },
        update: {},
        create: {
            username: "user",
            name: "Adi Kurniawan",
            password: userPassword,
            role: Role.USER
        },
    })

    console.log(`✅ ${TOTAL_USER} fake users inserted`);
    console.log("Seeding Sukses");
}

main()
    .catch((e) => {
        console.log("Error", e);
        process.exit(1)
    })  
    .finally(async () => {
        await prisma.$disconnect();
    });