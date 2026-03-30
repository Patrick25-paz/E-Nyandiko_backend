const { prisma } = require('../config/database');

async function findDeviceTypeWithFields(deviceTypeId) {
    return prisma.deviceType.findUnique({
        where: { id: deviceTypeId },
        // Optimization: select only the fields used for validation / saving values.
        select: {
            id: true,
            isActive: true,
            fields: {
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    key: true,
                    label: true,
                    dataType: true,
                    required: true,
                    options: true,
                    sortOrder: true
                }
            }
        }
    });
}

async function createDeviceWithValues({ sellerId, deviceTypeId, title, values }) {
    return prisma.$transaction(async (tx) => {
        const device = await tx.device.create({
            data: {
                sellerId,
                deviceTypeId,
                title,
                status: 'ACTIVE'
            }
        });

        if (values.length > 0) {
            await tx.deviceFieldValue.createMany({
                data: values.map((v) => ({
                    deviceId: device.id,
                    deviceFieldId: v.deviceFieldId,
                    value: v.value
                }))
            });
        }

        return device;
    });
}

async function addDeviceImages(deviceId, images) {
    return prisma.deviceImage.createMany({
        data: images.map((img, index) => ({
            deviceId,
            sortOrder: index,
            url: img.url,
            publicId: img.publicId,
            bytes: img.bytes ?? null,
            width: img.width ?? null,
            height: img.height ?? null,
            format: img.format ?? null
        }))
    });
}

async function getDeviceForAgreement(deviceId) {
    return prisma.device.findUnique({
        where: { id: deviceId },
        // Optimization: avoid overfetching large related models.
        // N+1 risk note: Prisma will batch relation reads (not per-row loops), but keeping selects narrow still helps.
        select: {
            id: true,
            deviceTypeId: true,
            title: true,
            status: true,
            deviceType: {
                select: {
                    id: true,
                    name: true
                }
            },
            fieldValues: {
                select: {
                    id: true,
                    value: true,
                    deviceField: {
                        select: {
                            id: true,
                            key: true,
                            label: true,
                            dataType: true
                        }
                    }
                }
            },
            images: {
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    url: true,
                    publicId: true,
                    sortOrder: true
                }
            }
        }
    });
}

async function findDeviceById(deviceId) {
    // Optimization: only fetch what the service layer uses for ownership checks.
    return prisma.device.findUnique({
        where: { id: deviceId },
        select: {
            id: true,
            sellerId: true,
            status: true,
            deviceTypeId: true,
            title: true
        }
    });
}

async function listDevicesBySeller(sellerId, options = {}) {
    // Performance note: if this list grows large, consider adding a composite index on (sellerId, createdAt).
    return prisma.device.findMany({
        where: { sellerId },
        // Optimization: the frontend only needs a subset of fields (no images currently).
        select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            deviceType: {
                select: {
                    id: true,
                    name: true
                }
            },
            // Optimization: fetch only the latest accepted agreement id for SOLD devices.
            // Index note: `Agreement.deviceId` is indexed; filtering by status also benefits from the `Agreement.status` index.
            // Optimization: fetch only the latest accepted or pending agreement
            agreements: {
                where: { status: { in: ['ACCEPTED', 'PENDING'] } },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    id: true,
                    status: true,
                    acceptedAt: true,
                    createdAt: true
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ? Number(options.limit) : undefined,
        skip: options.skip ? Number(options.skip) : undefined
    });
}


async function findDeviceDetailForSeller({ sellerId, deviceId }) {
    return prisma.device.findFirst({
        where: { id: deviceId, sellerId },
        // Optimization: fetch only fields rendered by SellerDeviceDetailPage.
        select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            deviceType: {
                select: {
                    id: true,
                    name: true
                }
            },
            fieldValues: {
                select: {
                    id: true,
                    value: true,
                    deviceField: {
                        select: {
                            id: true,
                            key: true,
                            label: true,
                            dataType: true
                        }
                    }
                }
            },
            // Optimization: include latest accepted agreement so UI can show “View agreement” on SOLD devices.
            // Optimization: include latest accepted or pending agreement so UI can block or show link
            agreements: {
                where: { status: { in: ['ACCEPTED', 'PENDING'] } },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    id: true,
                    status: true,
                    acceptedAt: true,
                    createdAt: true,
                    buyer: {
                        select: {
                            user: {
                                select: { fullName: true }
                            }
                        }
                    }
                }
            },
            images: {
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    url: true,
                    publicId: true,
                    sortOrder: true
                }
            }
        }
    });
}

async function getStatsForSeller(sellerId) {
    // Optimization: collapse multiple count() calls into one groupBy().
    // Index suggestion: a composite index on (sellerId, status) can speed up this aggregation.
    const grouped = await prisma.device.groupBy({
        by: ['status'],
        where: { sellerId },
        _count: { _all: true }
    });

    const countsByStatus = grouped.reduce((acc, row) => {
        acc[row.status] = row._count._all;
        return acc;
    }, {});

    const sold = countsByStatus.SOLD || 0;
    const active = countsByStatus.ACTIVE || 0;
    const draft = countsByStatus.DRAFT || 0;
    const total = sold + active + draft;

    return { total, sold, active, draft };
}


module.exports = {
    findDeviceTypeWithFields,
    createDeviceWithValues,
    addDeviceImages,
    getDeviceForAgreement,
    findDeviceById,
    listDevicesBySeller,
    findDeviceDetailForSeller,
    getStatsForSeller
};

