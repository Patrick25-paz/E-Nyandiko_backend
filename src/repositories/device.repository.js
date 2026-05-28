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

async function updateDeviceTitleBySeller({ deviceId, title }) {
    return prisma.device.update({
        where: { id: deviceId },
        data: { title },
        select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            deviceType: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });
}

async function deleteDeviceBySeller({ deviceId }) {
    return prisma.device.delete({
        where: { id: deviceId }
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

async function getDeviceFieldsForStolenCheck(deviceId) {
    return prisma.device.findUnique({
        where: { id: deviceId },
        select: {
            id: true,
            deviceTypeId: true,
            fieldValues: {
                select: {
                    value: true,
                    deviceField: {
                        select: {
                            key: true,
                            dataType: true
                        }
                    }
                }
            }
        }
    });
}

async function listDevicesBySeller(sellerId, options = {}) {
    // Performance note: composite index on (sellerId, createdAt) improves pagination performance.
    const limit = Math.min(Number(options.limit) || 20, 100); // Default 20, max 100 to prevent large data transfers
    const skip = Math.max(Number(options.skip) || 0, 0);

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
        take: limit,
        skip: skip
    });
}


async function findDeviceDetailForSeller({ sellerId, deviceId }) {
    const device = await prisma.device.findFirst({
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

    if (!device) return null;

    const exchangeAccess = await prisma.deviceExchangeAccess.findUnique({
        where: { deviceId },
        select: {
            id: true,
            grantedToSellerId: true,
            createdAt: true,
            updatedAt: true,
            grantedToSeller: {
                select: {
                    id: true,
                    businessName: true,
                    phone: true,
                    location: true,
                    logoUrl: true,
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            type: true
                        }
                    }
                }
            }
        }
    });

    return {
        ...device,
        exchangeAccess
    };
}

async function upsertDeviceExchangeAccess({ deviceId, ownerSellerId, grantedToSellerId }) {
    return prisma.deviceExchangeAccess.upsert({
        where: { deviceId },
        update: {
            ownerSellerId,
            grantedToSellerId
        },
        create: {
            deviceId,
            ownerSellerId,
            grantedToSellerId
        },
        select: {
            id: true,
            deviceId: true,
            ownerSellerId: true,
            grantedToSellerId: true,
            createdAt: true,
            updatedAt: true,
            grantedToSeller: {
                select: {
                    id: true,
                    businessName: true,
                    phone: true,
                    location: true,
                    logoUrl: true,
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            type: true
                        }
                    }
                }
            }
        }
    });
}

async function listSharedDevicesForSeller(grantedToSellerId) {
    return prisma.deviceExchangeAccess.findMany({
        where: {
            grantedToSellerId,
            device: {
                status: 'ACTIVE'
            }
        },
        select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            device: {
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
                    images: {
                        orderBy: { sortOrder: 'asc' },
                        select: {
                            id: true,
                            url: true,
                            publicId: true,
                            sortOrder: true
                        }
                    },
                    seller: {
                        select: {
                            id: true,
                            businessName: true,
                            phone: true,
                            location: true,
                            province: true,
                            district: true,
                            sector: true,
                            cell: true,
                            village: true,
                            noticeableName: true,
                            houseName: true,
                            floor: true,
                            user: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    email: true,
                                    nationalId: true,
                                    phone: true,
                                    location: true,
                                    province: true,
                                    district: true,
                                    sector: true,
                                    cell: true,
                                    village: true,
                                    noticeableName: true,
                                    houseName: true,
                                    floor: true,
                                    type: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

async function findSharedDeviceForRecipient({ grantedToSellerId, deviceId }) {
    return prisma.deviceExchangeAccess.findFirst({
        where: {
            deviceId,
            grantedToSellerId,
            device: {
                status: 'ACTIVE'
            }
        },
        select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            device: {
                select: {
                    id: true,
                    title: true,
                    status: true,
                    deviceTypeId: true,
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
                    },
                    seller: {
                        select: {
                            id: true,
                            businessName: true,
                            phone: true,
                            whatsapp: true,
                            location: true,
                            province: true,
                            district: true,
                            sector: true,
                            cell: true,
                            village: true,
                            noticeableName: true,
                            houseName: true,
                            floor: true,
                            user: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    email: true,
                                    nationalId: true,
                                    phone: true,
                                    type: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });
}

async function deleteExchangeAccessByDeviceId(deviceId) {
    return prisma.deviceExchangeAccess.deleteMany({
        where: { deviceId }
    });
}

async function swapDeviceOwnersForExchange({ shopDeviceId, sharedDeviceId, shopSellerId, individualSellerId }) {
    return prisma.$transaction(async (tx) => {
        await tx.device.update({
            where: { id: shopDeviceId },
            data: {
                sellerId: individualSellerId,
                status: 'ACTIVE'
            }
        });

        await tx.device.update({
            where: { id: sharedDeviceId },
            data: {
                sellerId: shopSellerId,
                status: 'ACTIVE'
            }
        });

        await tx.deviceExchangeAccess.deleteMany({
            where: {
                OR: [
                    { deviceId: shopDeviceId },
                    { deviceId: sharedDeviceId }
                ]
            }
        });
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

async function countActiveDevicesBySeller(sellerId) {
    return prisma.device.count({
        where: {
            sellerId,
            status: 'ACTIVE'
        }
    });
}


module.exports = {
    findDeviceTypeWithFields,
    createDeviceWithValues,
    updateDeviceTitleBySeller,
    deleteDeviceBySeller,
    addDeviceImages,
    getDeviceForAgreement,
    findDeviceById,
    getDeviceFieldsForStolenCheck,
    listDevicesBySeller,
    findDeviceDetailForSeller,
    upsertDeviceExchangeAccess,
    listSharedDevicesForSeller,
    findSharedDeviceForRecipient,
    deleteExchangeAccessByDeviceId,
    swapDeviceOwnersForExchange,
    getStatsForSeller,
    countActiveDevicesBySeller
};

