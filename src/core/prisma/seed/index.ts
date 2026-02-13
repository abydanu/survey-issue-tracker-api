import { faker } from "@faker-js/faker";
import { Role } from "../../../generated/prisma/index.js";
import prisma from "../../../infrastructure/database/prisma.js";
import bcrypt from 'bcryptjs';

async function main() {
    console.log("Seeding Database");

    const adminPassword = await bcrypt.hash("admin", 10)

    await prisma.user.upsert({
        where: { username: "admin" },
        update: {
            email: "aby.danu26@smk.belajar.id"
        },
        create: {
            username: "admin",
            name: "Alfonsus Siahaan",
            email: "itsniamid@gmail.com",
            password: adminPassword,
            role: Role.ADMIN
        },
    })

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