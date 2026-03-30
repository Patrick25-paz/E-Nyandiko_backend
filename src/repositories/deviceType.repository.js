const { prisma } = require('../config/database');

async function createDeviceType(data) {
    return prisma.deviceType.create({ data });
}

async function updateDeviceType(id, data) {
    return prisma.deviceType.update({
        where: { id },
        data,
        select: {
            id: true,
            name: true,
            description: true,
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

async function deactivateDeviceType(id) {
    return prisma.deviceType.update({
        where: { id },
        data: { isActive: false },
        select: {
            id: true,
            name: true,
            description: true,
            isActive: true
        }
    });
}

async function findDeviceTypeById(id) {
    return prisma.deviceType.findUnique({
        where: { id },
        // Optimization: select only fields used by admin UI / device creation.
        select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            fields: {
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    key: true,
                    label: true,
                    dataType: true,
                    required: true,
                    options: true,
                    sortOrder: true,
                    createdAt: true,
                    updatedAt: true
                }
            }
        }
    });
}

async function listDeviceTypes() {
    return prisma.deviceType.findMany({
        where: { isActive: true },
        // Optimization: narrow select to fields actually rendered by the frontend.
        select: {
            id: true,
            name: true,
            description: true,
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
        },
        orderBy: { name: 'asc' }
    });
}

async function createDeviceField(deviceTypeId, data) {
    return prisma.deviceField.create({
        data: {
            deviceTypeId,
            ...data
        }
    });
}

async function findDeviceFieldById(id) {
    return prisma.deviceField.findUnique({
        where: { id },
        select: {
            id: true,
            deviceTypeId: true,
            key: true,
            label: true,
            dataType: true,
            required: true,
            options: true,
            sortOrder: true
        }
    });
}

async function updateDeviceField(id, data) {
    return prisma.deviceField.update({
        where: { id },
        data,
        select: {
            id: true,
            deviceTypeId: true,
            key: true,
            label: true,
            dataType: true,
            required: true,
            options: true,
            sortOrder: true
        }
    });
}

async function deleteDeviceField(id) {
    return prisma.deviceField.delete({
        where: { id }
    });
}

async function countDeviceFieldValues(deviceFieldId) {
    return prisma.deviceFieldValue.count({
        where: { deviceFieldId }
    });
}

module.exports = {
    createDeviceType,
    updateDeviceType,
    deactivateDeviceType,
    findDeviceTypeById,
    listDeviceTypes,
    createDeviceField,
    findDeviceFieldById,
    updateDeviceField,
    deleteDeviceField,
    countDeviceFieldValues
};
