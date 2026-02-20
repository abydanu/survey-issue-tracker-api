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

    // Migrate GO_LIVE to GOLIVE
    console.log("Migrating GO_LIVE to GOLIVE...");
    const oldGoLive = await prisma.enumValue.findUnique({
        where: {
            enumType_value: {
                enumType: 'StatusInstalasi',
                value: 'GO_LIVE',
            },
        },
    });

    if (oldGoLive) {
        await prisma.newBgesB2BOlo.updateMany({
            where: { statusInstalasiId: oldGoLive.id },
            data: { statusInstalasiId: null },
        });

        await prisma.ndeUsulanB2B.updateMany({
            where: { statusInstalasiId: oldGoLive.id },
            data: { statusInstalasiId: null },
        });

        await prisma.enumValue.delete({
            where: { id: oldGoLive.id },
        });

        console.log("Deleted old GO_LIVE enum");
    }

    const statusInstalasiValues = [
        { value: 'REVIEW', displayName: '1 Review' },
        { value: 'SURVEY', displayName: '2 Survey' },
        { value: 'INSTALASI', displayName: '3 Instalasi' },
        { value: 'DONE_INSTALASI', displayName: '4 Done Instalasi' },
        { value: 'GOLIVE', displayName: '5 GOLIVE' },
        { value: 'CANCEL', displayName: '6 Cancel' },
        { value: 'PENDING', displayName: '7 Pending' },
        { value: 'KENDALA', displayName: '8 Kendala' },
        { value: 'WAITING_BUDGET', displayName: '9 Waiting Budget' },
        { value: 'DROP', displayName: '10 Drop' },
        { value: 'WAITING_PROJECT_JPP', displayName: '11 Waiting Project JPP' },
        { value: 'WAITING_CB', displayName: '12 Waiting CB' },
    ];

    for (const enumValue of statusInstalasiValues) {
        await prisma.enumValue.upsert({
            where: {
                enumType_value: {
                    enumType: 'StatusInstalasi',
                    value: enumValue.value,
                },
            },
            update: {
                displayName: enumValue.displayName,
                isActive: true,
            },
            create: {
                enumType: 'StatusInstalasi',
                value: enumValue.value,
                displayName: enumValue.displayName,
                isActive: true,
            },
        });
    }

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