package open.dolphin.testsupport;

import java.time.LocalDate;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.ModuleInfoBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;

/**
 * Reusable local chart/document persistence fixture for canonical order modules.
 * This fixture does not assert ORCA medicalmodv2 live claim semantics or live mutation success.
 */
public final class CanonicalOrderDocumentFixture {

    private static final long FIXED_CONFIRMED_AT_MILLIS = 1_709_251_200_000L;
    public static final String DEFAULT_DOC_ID = "FIXTURE-CANONICAL-ORDER-001";
    public static final String DEFAULT_RELATION = "revise";

    private CanonicalOrderDocumentFixture() {
    }

    public static Builder builder() {
        return new Builder();
    }

    public static DocumentModel canonicalDocument() {
        return builder().build();
    }

    public static List<String> canonicalOrderEntities() {
        return List.of(
                IInfoModel.ENTITY_MED_ORDER,
                IInfoModel.ENTITY_TREATMENT,
                IInfoModel.ENTITY_RADIOLOGY_ORDER);
    }

    public static Date fixedConfirmedAt() {
        return new Date(FIXED_CONFIRMED_AT_MILLIS);
    }

    public static final class Builder {

        private long documentId = 1001L;
        private String docId = DEFAULT_DOC_ID;
        private long parentPk;
        private String linkRelation;
        private Date confirmedAt = fixedConfirmedAt();
        private long karteId = 501L;
        private long patientPk = 401L;
        private String patientId = "CWP01-FIXTURE-PATIENT";
        private long userPk = 601L;
        private String userId = "F001:doctor01";
        private String commonName = "Fixture Doctor";

        private Builder() {
        }

        public Builder documentId(long documentId) {
            this.documentId = documentId;
            return this;
        }

        public Builder docId(String docId) {
            this.docId = docId;
            return this;
        }

        public Builder revisionParent(long parentPk, String linkRelation) {
            this.parentPk = parentPk;
            this.linkRelation = linkRelation;
            return this;
        }

        public Builder reviseFrom(long parentPk) {
            return revisionParent(parentPk, DEFAULT_RELATION);
        }

        public Builder confirmedAt(Date confirmedAt) {
            this.confirmedAt = confirmedAt == null ? null : new Date(confirmedAt.getTime());
            return this;
        }

        public Builder karteId(long karteId) {
            this.karteId = karteId;
            return this;
        }

        public Builder patient(long patientPk, String patientId) {
            this.patientPk = patientPk;
            this.patientId = patientId;
            return this;
        }

        public Builder user(long userPk, String userId, String commonName) {
            this.userPk = userPk;
            this.userId = userId;
            this.commonName = commonName;
            return this;
        }

        public DocumentModel build() {
            Date timestamp = confirmedAt == null ? fixedConfirmedAt() : new Date(confirmedAt.getTime());
            PatientModel patient = patient();
            KarteBean karte = karte(patient, timestamp);
            UserModel user = user();

            DocumentModel document = new DocumentModel();
            document.setId(documentId);
            document.setKarteBean(karte);
            document.setUserModel(user);
            document.setStarted(timestamp);
            document.setFirstConfirmed(timestamp);
            document.setConfirmed(timestamp);
            document.setRecorded(timestamp);
            document.setStatus(IInfoModel.STATUS_FINAL);
            document.setLinkId(parentPk);
            document.setLinkRelation(linkRelation);

            DocInfoModel docInfo = document.getDocInfoModel();
            docInfo.setDocPk(documentId);
            docInfo.setDocId(docId);
            docInfo.setTitle("Canonical order fixture");
            docInfo.setDocType(IInfoModel.DOCTYPE_KARTE);
            docInfo.setPurpose(IInfoModel.PURPOSE_RECORD);
            docInfo.setStatus(IInfoModel.STATUS_FINAL);
            docInfo.setParentPk(parentPk);
            docInfo.setParentIdRelation(linkRelation);
            docInfo.setConfirmDate(timestamp);
            docInfo.setFirstConfirmDate(timestamp);
            docInfo.setHasRp(true);
            docInfo.setHasTreatment(true);

            document.addModule(module(document, karte, user, timestamp, 1, canonicalMedOrder()));
            document.addModule(module(document, karte, user, timestamp, 2, canonicalTreatmentOrder()));
            document.addModule(module(document, karte, user, timestamp, 3, canonicalRadiologyOrder()));
            return document;
        }

        private PatientModel patient() {
            PatientModel patient = new PatientModel();
            patient.setId(patientPk);
            patient.setFacilityId("F001");
            patient.setPatientId(patientId);
            patient.setFullName("Fixture Patient");
            patient.setGender(IInfoModel.MALE);
            patient.setGenderDesc(IInfoModel.MALE_DISP);
            patient.setBirthday(LocalDate.of(1980, 1, 2));
            return patient;
        }

        private KarteBean karte(PatientModel patient, Date created) {
            KarteBean karte = new KarteBean();
            karte.setId(karteId);
            karte.setPatientModel(patient);
            karte.setCreated(new Date(created.getTime()));
            return karte;
        }

        private UserModel user() {
            UserModel user = new UserModel();
            user.setId(userPk);
            user.setUserId(userId);
            user.setCommonName(commonName);
            return user;
        }

        private ModuleModel module(
                DocumentModel document,
                KarteBean karte,
                UserModel user,
                Date timestamp,
                int stampNumber,
                CanonicalOrder order) {
            ModuleModel module = new ModuleModel();
            module.setId(documentId * 10 + stampNumber);
            module.setDocumentModel(document);
            module.setKarteBean(karte);
            module.setUserModel(user);
            module.setStarted(new Date(timestamp.getTime()));
            module.setFirstConfirmed(new Date(timestamp.getTime()));
            module.setConfirmed(new Date(timestamp.getTime()));
            module.setRecorded(new Date(timestamp.getTime()));
            module.setStatus(IInfoModel.STATUS_FINAL);
            module.setLinkId(parentPk);
            module.setLinkRelation(linkRelation);

            ModuleInfoBean moduleInfo = module.getModuleInfoBean();
            moduleInfo.setEntity(order.entity());
            moduleInfo.setStampName(order.stampName());
            moduleInfo.setStampRole(IInfoModel.ROLE_P);
            moduleInfo.setStampNumber(stampNumber);

            module.setModel(order.bundle());
            module.setBeanJson(ModelUtils.encodeModule(module));
            return module;
        }
    }

    private record CanonicalOrder(String entity, String stampName, BundleDolphin bundle) {
    }

    private static CanonicalOrder canonicalMedOrder() {
        BundleDolphin bundle = bundle("Fixture medication set", "212", "Prescription", "1 dose after breakfast",
                "FIX-MED-001", "Fixture medication", "1", "tablet");
        bundle.setAdminCode("FIX-USAGE-001");
        bundle.setAdminCodeSystem("Claim007");
        bundle.setAdminMemo("Fixture medication comment");
        return new CanonicalOrder(IInfoModel.ENTITY_MED_ORDER, "Fixture medication", bundle);
    }

    private static CanonicalOrder canonicalTreatmentOrder() {
        BundleDolphin bundle = bundle("Fixture treatment set", "400", "Treatment", null,
                "FIX-TRT-001", "Fixture treatment procedure", "1", "procedure");
        bundle.setMemo("Fixture treatment comment");
        return new CanonicalOrder(IInfoModel.ENTITY_TREATMENT, "Fixture treatment", bundle);
    }

    private static CanonicalOrder canonicalRadiologyOrder() {
        BundleDolphin bundle = bundle("Fixture radiology set", "700", "Radiology", null,
                "FIX-RAD-001", "Fixture radiology procedure", "1", "study");
        bundle.addClaimItem(item("FIX-RAD-BODY-001", "Fixture radiology body part", null, null));
        bundle.setMemo("Fixture radiology comment");
        return new CanonicalOrder(IInfoModel.ENTITY_RADIOLOGY_ORDER, "Fixture radiology", bundle);
    }

    private static BundleDolphin bundle(
            String orderName,
            String classCode,
            String className,
            String admin,
            String itemCode,
            String itemName,
            String number,
            String unit) {
        BundleDolphin bundle = new BundleDolphin();
        bundle.setOrderName(orderName);
        bundle.setClassCode(classCode);
        bundle.setClassCodeSystem("Claim007");
        bundle.setClassName(className);
        bundle.setAdmin(admin);
        bundle.setBundleNumber("1");
        bundle.setClaimItem(new ClaimItem[]{item(itemCode, itemName, number, unit)});
        return bundle;
    }

    private static ClaimItem item(String code, String name, String number, String unit) {
        ClaimItem item = new ClaimItem();
        item.setCode(code);
        item.setCodeSystem("Claim007");
        item.setName(name);
        item.setNumber(number);
        item.setUnit(unit);
        return item;
    }
}
