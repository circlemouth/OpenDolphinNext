package open.dolphin.session;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.function.Consumer;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import open.dolphin.infomodel.AppointmentModel;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.LetterModel;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.NurseProgressCourseModel;
import open.dolphin.infomodel.ObservationModel;
import open.dolphin.infomodel.OndobanModel;
import open.dolphin.infomodel.PatientFreeDocumentModel;
import open.dolphin.infomodel.PatientMemoModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.image.ImageStorageManager;
import org.slf4j.Logger;

final class KarteLegacyArtifactSupport {

    private static final String KARTE_ID = "karteId";
    private static final String FROM_DATE = "fromDate";
    private static final String TO_DATE = "toDate";
    private static final String ID = "id";
    private static final String ENTITY = "entity";
    private static final String FID = "fid";
    private static final String FPID = "fpid";

    private static final String QUERY_DOCUMENT_HEADERS_INCLUDE_MODIFIED =
            "select d.id, d.linkId, d.confirmed, d.started, d.status, d.docInfo "
                    + "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and d.status !='D' "
                    + "order by d.started desc, d.id desc";
    private static final String QUERY_DOCUMENT_HEADERS =
            "select d.id, d.linkId, d.confirmed, d.started, d.status, d.docInfo "
                    + "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and (d.status='F' or d.status='T') "
                    + "order by d.started desc, d.id desc";
    private static final String QUERY_FACILITY_BY_PATIENT_PK = "select p.facilityId from PatientModel p where p.id=:id";
    private static final String QUERY_FACILITY_BY_KARTE_ID = "select k.patient.facilityId from KarteBean k where k.id=:id";
    private static final String QUERY_FACILITY_BY_DOC_ID = "select d.karte.patient.facilityId from DocumentModel d where d.id=:id";
    private static final String QUERY_FACILITY_BY_ATTACHMENT_ID = "select a.document.karte.patient.facilityId from AttachmentModel a where a.id=:id";
    private static final String QUERY_FACILITY_BY_SCHEMA_ID = "select s.karte.patient.facilityId from SchemaModel s where s.id=:id";
    private static final String QUERY_FACILITY_BY_PVT_ID = "select p.facilityId from PatientVisitModel p where p.id=:id";
    private static final String QUERY_FACILITY_BY_DIAGNOSIS_ID =
            "select r.karte.patient.facilityId from RegisteredDiagnosisModel r where r.id=:id";
    private static final String QUERY_FACILITY_BY_OBSERVATION_ID =
            "select o.karte.patient.facilityId from ObservationModel o where o.id=:id";
    private static final String QUERY_FACILITY_BY_ONDOBAN_ID =
            "select o.karte.patient.facilityId from OndobanModel o where o.id=:id";
    private static final String QUERY_FACILITY_BY_NURSE_PROGRESS_COURSE_ID =
            "select n.karte.patient.facilityId from NurseProgressCourseModel n where n.id=:id";
    private static final String QUERY_MODULE_BY_ENTITY = "from ModuleModel m where m.karte.id=:karteId and m.moduleInfo.entity=:entity and m.started between :fromDate and :toDate and m.status='F' order by m.started";
    private static final String QUERY_SCHEMA_BY_KARTE_ID = "from SchemaModel i where i.karte.id =:karteId and i.started between :fromDate and :toDate and i.status='F'";
    private static final String QUERY_SCHEMA_BY_FACILITY_ID =
            "from SchemaModel i where i.karte.patient.facilityId like :fid and i.extRef.sop is not null and i.status='F'";
    private static final String QUERY_PATIENT_MEMO = "from PatientMemoModel p where p.karte.id=:karteId";
    private static final String QUERY_FREEDOCU_BY_FPID = "from PatientFreeDocumentModel p where p.facilityPatId=:fpid";
    private static final String TOUTOU = "TOUTOU";
    private static final String TOUTOU_REPLY = "TOUTOU_REPLY";
    private static final String QUERY_LETTER_BY_KARTE_ID = "from TouTouLetter f where f.karte.id=:karteId";
    private static final String QUERY_REPLY_BY_KARTE_ID = "from TouTouReply f where f.karte.id=:karteId";
    private static final String QUERY_LETTER_BY_ID = "from TouTouLetter t where t.id=:id";
    private static final String QUERY_REPLY_BY_ID = "from TouTouReply t where t.id=:id";
    private static final String QUERY_APPO_BY_KARTE_ID_PERIOD = "from AppointmentModel a where a.karte.id = :karteId and a.date between :fromDate and :toDate";
    private static final String QUERY_ATTACHMENT_BY_ID = "from AttachmentModel a where a.id=:id";

    private final EntityManager em;
    private final AttachmentStorageManager attachmentStorageManager;
    private final ImageStorageManager imageStorageManager;
    private final Consumer<List<ModuleModel>> moduleDecoder;
    private final Logger logger;

    KarteLegacyArtifactSupport(
            EntityManager em,
            AttachmentStorageManager attachmentStorageManager,
            ImageStorageManager imageStorageManager,
            Consumer<List<ModuleModel>> moduleDecoder,
            Logger logger) {
        this.em = em;
        this.attachmentStorageManager = attachmentStorageManager;
        this.imageStorageManager = imageStorageManager;
        this.moduleDecoder = moduleDecoder;
        this.logger = logger;
    }

    List<DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModified) {
        String query = includeModified ? QUERY_DOCUMENT_HEADERS_INCLUDE_MODIFIED : QUERY_DOCUMENT_HEADERS;
        List<Object[]> rows = em.createQuery(query, Object[].class)
                .setParameter(KARTE_ID, karteId)
                .setParameter(FROM_DATE, fromDate)
                .getResultList();
        List<DocInfoModel> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            if (row == null || row.length < 6 || !(row[5] instanceof DocInfoModel info)) {
                continue;
            }
            info.setDocPk(row[0] instanceof Long docPk ? docPk : 0L);
            info.setParentPk(row[1] instanceof Long parentPk ? parentPk : 0L);
            info.setConfirmDate((Date) row[2]);
            info.setFirstConfirmDate((Date) row[3]);
            info.setStatus((String) row[4]);
            result.add(info);
        }
        return result;
    }

    String findFacilityIdByPatientPk(long patientPk) {
        return findFacilityIdById(QUERY_FACILITY_BY_PATIENT_PK, patientPk);
    }

    String findFacilityIdByKarteId(long karteId) {
        return findFacilityIdById(QUERY_FACILITY_BY_KARTE_ID, karteId);
    }

    String findFacilityIdByDocId(long docId) {
        return findFacilityIdById(QUERY_FACILITY_BY_DOC_ID, docId);
    }

    String findFacilityIdByAttachmentId(long attachmentId) {
        return findFacilityIdById(QUERY_FACILITY_BY_ATTACHMENT_ID, attachmentId);
    }

    String findFacilityIdBySchemaId(long schemaId) {
        return findFacilityIdById(QUERY_FACILITY_BY_SCHEMA_ID, schemaId);
    }

    String findFacilityIdByPvtId(long pvtId) {
        return findFacilityIdById(QUERY_FACILITY_BY_PVT_ID, pvtId);
    }

    String findFacilityIdByDiagnosisId(long diagnosisId) {
        return findFacilityIdById(QUERY_FACILITY_BY_DIAGNOSIS_ID, diagnosisId);
    }

    String findFacilityIdByObservationId(long observationId) {
        return findFacilityIdById(QUERY_FACILITY_BY_OBSERVATION_ID, observationId);
    }

    String findFacilityIdByOndobanId(long ondobanId) {
        return findFacilityIdById(QUERY_FACILITY_BY_ONDOBAN_ID, ondobanId);
    }

    String findFacilityIdByNurseProgressCourseId(long nurseProgressCourseId) {
        return findFacilityIdById(QUERY_FACILITY_BY_NURSE_PROGRESS_COURSE_ID, nurseProgressCourseId);
    }

    List<List> getImages(long karteId, List fromDate, List toDate) {
        int len = fromDate.size();
        List<List> ret = new ArrayList<>(len);
        for (int i = 0; i < len; i++) {
            List modules = em.createQuery(QUERY_SCHEMA_BY_KARTE_ID)
                    .setParameter(KARTE_ID, karteId)
                    .setParameter(FROM_DATE, fromDate.get(i))
                    .setParameter(TO_DATE, toDate.get(i))
                    .getResultList();
            ret.add(modules);
        }
        return ret;
    }

    SchemaModel getImage(long id) {
        SchemaModel image = em.find(SchemaModel.class, id);
        if (image != null) {
            imageStorageManager.populateBinary(image);
        }
        return image;
    }

    List<SchemaModel> getS3Images(String fid, int firstResult, int maxResult) {
        return em.createQuery(QUERY_SCHEMA_BY_FACILITY_ID)
                .setParameter(FID, fid + "%")
                .setFirstResult(firstResult)
                .setMaxResults(maxResult)
                .getResultList();
    }

    void deleteS3Image(long pk) {
        SchemaModel target = em.find(SchemaModel.class, pk);
        target.getExtRefModel().setBucket(null);
        target.getExtRefModel().setSop(null);
        target.getExtRefModel().setUrl(null);
    }

    int updatePatientMemo(PatientMemoModel memo) {
        if (memo.getId() == 0L && memo.getKarteBean() != null) {
            List<PatientMemoModel> memoList = em.createQuery(QUERY_PATIENT_MEMO)
                    .setParameter(KARTE_ID, memo.getKarteBean().getId())
                    .getResultList();
            if (memoList.isEmpty()) {
                em.persist(memo);
            } else {
                PatientMemoModel current = memoList.get(0);
                current.setMemo(memo.getMemo());
                em.merge(current);
            }
            return 1;
        }
        em.merge(memo);
        return 1;
    }

    PatientFreeDocumentModel getPatientFreeDocument(String fpid) {
        List<PatientFreeDocumentModel> ret = em.createQuery(QUERY_FREEDOCU_BY_FPID)
                .setParameter(FPID, fpid)
                .getResultList();
        return ret != null && ret.size() == 1 ? ret.get(0) : null;
    }

    int updatePatientFreeDocument(PatientFreeDocumentModel update) {
        PatientFreeDocumentModel current = em.find(PatientFreeDocumentModel.class, update.getId());
        if (current == null) {
            try {
                current = em.createQuery(QUERY_FREEDOCU_BY_FPID, PatientFreeDocumentModel.class)
                        .setParameter(FPID, update.getFacilityPatId())
                        .getSingleResult();
                if (current != null) {
                    update.setId(current.getId());
                }
            } catch (NoResultException ex) {
                logger.warn("FreeDocument NoResultException");
            }
            em.persist(update);
            logger.info("New FreeDocument");
            return 1;
        }
        em.merge(update);
        logger.info("Update FreeDocument");
        return 1;
    }

    long saveOrUpdateLetter(LetterModel model) {
        return em.merge(model).getId();
    }

    List<LetterModel> getLetterList(long karteId, String docType) {
        if (TOUTOU.equals(docType)) {
            return em.createQuery(QUERY_LETTER_BY_KARTE_ID)
                    .setParameter(KARTE_ID, karteId)
                    .getResultList();
        }
        if (TOUTOU_REPLY.equals(docType)) {
            return em.createQuery(QUERY_REPLY_BY_KARTE_ID)
                    .setParameter(KARTE_ID, karteId)
                    .getResultList();
        }
        return null;
    }

    LetterModel getLetter(long letterPk) {
        return em.createQuery(QUERY_LETTER_BY_ID, LetterModel.class)
                .setParameter(ID, letterPk)
                .getSingleResult();
    }

    LetterModel getLetterReply(long letterPk) {
        return em.createQuery(QUERY_REPLY_BY_ID, LetterModel.class)
                .setParameter(ID, letterPk)
                .getSingleResult();
    }

    List<List<AppointmentModel>> getAppointmentList(long karteId, List fromDate, List toDate) {
        int len = fromDate.size();
        List<List<AppointmentModel>> ret = new ArrayList<>(len);
        for (int i = 0; i < len; i++) {
            List<AppointmentModel> modules = em.createQuery(QUERY_APPO_BY_KARTE_ID_PERIOD)
                    .setParameter(KARTE_ID, karteId)
                    .setParameter(FROM_DATE, fromDate.get(i))
                    .setParameter(TO_DATE, toDate.get(i))
                    .getResultList();
            ret.add(modules);
        }
        return ret;
    }

    List<ModuleModel> getModulesEntitySearch(long karteId, Date fromDate, Date toDate, List<String> entities) {
        final String sql = "from ModuleModel m where m.karte.id = :karteId "
                + "and m.started between :fromDate and :toDate and m.status='F' "
                + "and m.moduleInfo.entity in (:entities)";
        List<ModuleModel> ret = em.createQuery(sql)
                .setParameter(KARTE_ID, karteId)
                .setParameter(FROM_DATE, fromDate)
                .setParameter(TO_DATE, toDate)
                .setParameter("entities", entities)
                .getResultList();
        moduleDecoder.accept(ret);
        return ret;
    }

    AttachmentModel getAttachment(long pk) {
        try {
            AttachmentModel attachment = em.createQuery(QUERY_ATTACHMENT_BY_ID, AttachmentModel.class)
                    .setParameter(ID, pk)
                    .getSingleResult();
            attachmentStorageManager.populateBinary(attachment);
            return attachment;
        } catch (NoResultException e) {
            return null;
        }
    }

    private String findFacilityIdById(String query, long idValue) {
        if (idValue <= 0) {
            return null;
        }
        try {
            return em.createQuery(query, String.class)
                    .setParameter(ID, idValue)
                    .getSingleResult();
        } catch (NoResultException ex) {
            return null;
        }
    }
}
