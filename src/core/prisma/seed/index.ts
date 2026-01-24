import { Role } from "../../../generated/prisma";
import prisma from "../../../infrastructure/database/prisma";
import bcrypt from 'bcryptjs';

async function main() {
    console.log("Seeding Database");

    const adminPass = await bcrypt.hash("admin", 10)
    const userPass = await bcrypt.hash("user", 10)

    const admin = await prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
            username: "admin",
            password: adminPass,
            role: Role.ADMIN
        }
    })

    const user = await prisma.user.upsert({
        where: { username: "user" },
        update: {},
        create: {
            username: "user",
            password: userPass,
            role: Role.USER
        }
    })

    console.log("Seeding Sukses");
    console.log({ admin, user });
}

main()
    .catch((e) => {
        console.log("Error", e);
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect();
    });