const router = require('express').Router();

const agreementController = require('../controllers/agreement.controller');
const auth = require('../middlewares/auth.middleware');
const requireRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');
const upload = require('../middlewares/upload.middleware');
const {
    createAgreementSchema,
    confirmAgreementSchema,
    listAgreementsSchema,
    getAgreementSchema,
    deleteAgreementSchema,
    getAgreementDocumentSchema,
    getAgreementDocumentTokenSchema
    ,
    publicAgreementSchema,
    publicConfirmAgreementSchema
} = require('../validators/agreement.validator');


// Seller creates agreement
router.post(
    '/',
    auth,
    requireRoles('SELLER'),
    upload.fields([
        { name: 'images', maxCount: 5 },
        { name: 'buyerImage', maxCount: 1 }
    ]),
    validate(createAgreementSchema),
    agreementController.createAgreement
);

// Seller views agreements where they are the seller
router.get('/sold', auth, requireRoles('SELLER'), validate(listAgreementsSchema), agreementController.listSold);

// Buyer views agreements where they are the buyer
router.get('/bought', auth, requireRoles('BUYER'), validate(listAgreementsSchema), agreementController.listBought);

// Buyer confirms agreement -> becomes immutable
router.patch(
    '/:id/confirm',
    auth,
    requireRoles('BUYER'),
    validate(confirmAgreementSchema),
    agreementController.confirmAgreement
);

// Public (email-link) view of agreement metadata (no login required)
router.get(
    '/:id/public',
    validate(publicAgreementSchema),
    agreementController.publicAgreement
);

// Public (email-link) confirmation (no login required)
router.post(
    '/:id/public-confirm',
    validate(publicConfirmAgreementSchema),
    agreementController.publicConfirmAgreement
);

// Seller cancels a pending agreement
router.delete(
    '/:id',
    auth,
    requireRoles('SELLER'),
    validate(deleteAgreementSchema),
    agreementController.deleteAgreement
);

// Download/open official agreement document (PDF)
router.get(
    '/:id/document',
    // No auth middleware: this endpoint can be accessed via a short-lived token in query string.
    // If Authorization header is provided, controller will also accept it.
    validate(getAgreementDocumentSchema),
    agreementController.document
);

// Create a short-lived token that can be used to open the PDF in an iframe/new tab.
router.get(
    '/:id/document-token',
    auth,
    requireRoles('ADMIN', 'SELLER', 'BUYER'),
    validate(getAgreementDocumentTokenSchema),
    agreementController.documentToken
);

// Get a single agreement as JSON (used by client-side PDF renderer)
router.get(
    '/:id',
    auth,
    requireRoles('ADMIN', 'SELLER', 'BUYER'),
    validate(getAgreementSchema),
    agreementController.getAgreement
);

module.exports = router;
