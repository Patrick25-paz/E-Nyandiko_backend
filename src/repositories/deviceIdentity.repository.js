const { prisma } = require('../config/database');

async function findStolenIdentityByIdentifier({ deviceTypeId, type, normalizedValue }) {
    const identifier = await prisma.deviceIdentifier.findUnique({
        where: {
            deviceTypeId_type_normalizedValue: {
                deviceTypeId,
                type,
                normalizedValue
            }
        },
        select: {
            identity: {
                select: {
                    id: true,
                    deviceTypeId: true,
                    isReportedStolen: true,
                    stolenReportedAt: true
                }
            }
        }
    });

    if (!identifier?.identity?.isReportedStolen) return null;
    return identifier.identity;
}

async function findIdentityByAnyIdentifier({ deviceTypeId, identifiers }) {
    if (!Array.isArray(identifiers) || identifiers.length === 0) return null;

    const found = await prisma.deviceIdentifier.findFirst({
        where: {
            deviceTypeId,
            OR: identifiers.map((i) => ({
                type: i.type,
                normalizedValue: i.normalizedValue
            }))
        },
        select: {
            identity: {
                select: {
                    id: true,
                    deviceTypeId: true,
                    isReportedStolen: true,
                    stolenReportedAt: true
                }
            }
        }
    });

    return found?.identity || null;
}

async function upsertIdentityWithIdentifiers({ deviceTypeId, identifiers }) {
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
        throw new Error('identifiers required');
    }

    return prisma.$transaction(async (tx) => {
        // Re-use existing identity when any identifier matches.
        const existing = await tx.deviceIdentifier.findFirst({
            where: {
                deviceTypeId,
                OR: identifiers.map((i) => ({
                    type: i.type,
                    normalizedValue: i.normalizedValue
                }))
            },
            select: { identityId: true }
        });

        const identity = existing
            ? await tx.deviceIdentity.findUnique({
                where: { id: existing.identityId },
                select: {
                    id: true,
                    deviceTypeId: true,
                    isReportedStolen: true,
                    stolenReportedAt: true,
                    stolenDescription: true,
                    stolenReportedByUserId: true
                }
            })
            : await tx.deviceIdentity.create({
                data: {
                    deviceTypeId
                },
                select: {
                    id: true,
                    deviceTypeId: true,
                    isReportedStolen: true,
                    stolenReportedAt: true,
                    stolenDescription: true,
                    stolenReportedByUserId: true
                }
            });

        for (const i of identifiers) {
            await tx.deviceIdentifier.upsert({
                where: {
                    deviceTypeId_type_normalizedValue: {
                        deviceTypeId,
                        type: i.type,
                        normalizedValue: i.normalizedValue
                    }
                },
                update: {
                    identityId: identity.id,
                    rawValue: i.rawValue
                },
                create: {
                    identityId: identity.id,
                    deviceTypeId,
                    type: i.type,
                    rawValue: i.rawValue,
                    normalizedValue: i.normalizedValue
                }
            });
        }

        return identity;
    });
}

async function markIdentityStolen({ identityId, reportedByUserId, description }) {
    return prisma.deviceIdentity.update({
        where: { id: identityId },
        data: {
            isReportedStolen: true,
            stolenReportedAt: new Date(),
            stolenReportedByUserId: reportedByUserId,
            stolenDescription: description || null
        },
        select: {
            id: true,
            deviceTypeId: true,
            isReportedStolen: true,
            stolenReportedAt: true
        }
    });
}

module.exports = {
    findStolenIdentityByIdentifier,
    findIdentityByAnyIdentifier,
    upsertIdentityWithIdentifiers,
    markIdentityStolen
};
