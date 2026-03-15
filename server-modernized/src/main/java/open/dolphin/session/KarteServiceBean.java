package open.dolphin.session;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import open.dolphin.infomodel.*;
import open.dolphin.persistence.query.KarteDocumentQueryService;
import open.dolphin.persistence.query.PatientQueryService;
import open.dolphin.persistence.query.UserQueryService;
import open.dolphin.rest.dto.KarteRevisionDocumentResponse;
import open.dolphin.rest.dto.RoutineMedicationResponse;
import open.dolphin.rest.dto.RpHistoryDrugResponse;
import open.dolphin.rest.dto.RpHistoryEntryResponse;
import open.dolphin.rest.dto.DiagnosisSummaryResponse;
import open.dolphin.rest.dto.SafetySummaryResponse;
import open.dolphin.rest.dto.UserPropertyResponse;
import open.dolphin.rest.support.KarteRevisionResponseMapper;
import open.dolphin.security.integrity.DocumentIntegrityService;
import open.dolphin.session.framework.SessionOperation;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.image.ImageStorageManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class KarteServiceBean {

    private static final Logger LOGGER = LoggerFactory.getLogger(KarteServiceBean.class);
    private static final DateTimeFormatter ISO_INSTANT_FORMATTER = DateTimeFormatter.ISO_INSTANT;
    private static final DateTimeFormatter ISO_DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);
    public static final int DEFAULT_DOCINFO_PAGE_SIZE = 50;
    public static final int MAX_DOCINFO_PAGE_SIZE = 200;
    // parameters
    private static final String PATIENT_PK = "patientPk";
    private static final String KARTE_ID = "karteId";
    private static final String FROM_DATE = "fromDate";
    private static final String TO_DATE = "toDate";
    private static final String ID = "id";
    private static final String ENTITY = "entity";
    private static final String FID = "fid";
    private static final String PID = "pid";

    private static final String QUERY_KARTE = "select k from KarteBean k join fetch k.patient p where p.id=:patientPk";
    private static final String QUERY_KARTE_BY_FID_PID =
            "select k from KarteBean k join fetch k.patient p where p.facilityId=:fid and p.patientId=:pid";
    private static final String QUERY_ALLERGY = "from ObservationModel o where o.karte.id=:karteId and o.observation='Allergy'";
    private static final String QUERY_BODY_HEIGHT = "from ObservationModel o where o.karte.id=:karteId and o.observation='PhysicalExam' and o.phenomenon='bodyHeight'";
    private static final String QUERY_BODY_WEIGHT = "from ObservationModel o where o.karte.id=:karteId and o.observation='PhysicalExam' and o.phenomenon='bodyWeight'";
    private static final String QUERY_RELEVANT_OBSERVATIONS =
            "from ObservationModel o where o.karte.id=:karteId and (o.observation='Allergy' "
                    + "or (o.observation='PhysicalExam' and o.phenomenon in ('bodyHeight','bodyWeight')))";
    // Cancel status=64 を where へ追加
    private static final String QUERY_PATIENT_VISIT = "from PatientVisitModel p where p.patient.id=:patientPk and p.pvtDate >= :fromDate and p.status!=64";
    private static final String QUERY_DOC_INFO = "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and (d.status='F' or d.status='T')";
    private static final String QUERY_PATIENT_MEMO = "from PatientMemoModel p where p.karte.id=:karteId";
    private static final String QUERY_USER_BY_USER_ID = "from UserModel u where u.userId=:userId";
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

    private static final String QUERY_DOCUMENT_INCLUDE_MODIFIED = "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and d.status !='D'";
    private static final String QUERY_DOCUMENT = "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and (d.status='F' or d.status='T')";
    private static final String QUERY_DOCUMENT_HEADERS_INCLUDE_MODIFIED =
            "select d.id, d.linkId, d.confirmed, d.started, d.status, d.docInfo " +
                    "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and d.status !='D' " +
                    "order by d.started desc, d.id desc";
    private static final String QUERY_DOCUMENT_HEADERS =
            "select d.id, d.linkId, d.confirmed, d.started, d.status, d.docInfo " +
                    "from DocumentModel d where d.karte.id=:karteId and d.started >= :fromDate and (d.status='F' or d.status='T') " +
                    "order by d.started desc, d.id desc";
    private static final String QUERY_DOCUMENT_BY_LINK_ID = "from DocumentModel d where d.linkId=:id";
    private static final String QUERY_DOCUMENT_IDS_WITH_MED_ENTITY =
            "select d.id from DocumentModel d where d.karte.id=:karteId and d.status in ('F','T') " +
                    "and exists (select 1 from ModuleModel m where m.document.id=d.id and m.moduleInfo.entity=:entity) " +
                    "order by d.started desc";

//s.oh^ 2014/07/29 スタンプ／シェーマ／添付のソート
    //private static final String QUERY_MODULE_BY_DOC_ID = "from ModuleModel m where m.document.id=:id";
    //private static final String QUERY_SCHEMA_BY_DOC_ID = "from SchemaModel i where i.document.id=:id";
    //private static final String QUERY_ATTACHMENT_BY_DOC_ID = "from AttachmentModel a where a.document.id=:id";
    private static final String QUERY_MODULE_BY_DOC_ID = "from ModuleModel m where m.document.id=:id order by m.id";
    private static final String QUERY_SCHEMA_BY_DOC_ID = "from SchemaModel i where i.document.id=:id order by i.id";
    private static final String QUERY_ATTACHMENT_BY_DOC_ID = "from AttachmentModel a where a.document.id=:id order by a.id";
    private static final String QUERY_DOCUMENT_BY_IDS =
            "select d from DocumentModel d left join fetch d.karte left join fetch d.creator where d.id in :ids";
    private static final String QUERY_MODULES_BY_DOC_IDS =
            "select m from ModuleModel m left join fetch m.karte left join fetch m.creator "
                    + "where m.document.id in :ids order by m.document.id, m.id";
    private static final String QUERY_SCHEMAS_BY_DOC_IDS =
            "select i from SchemaModel i left join fetch i.karte left join fetch i.creator "
                    + "where i.document.id in :ids order by i.document.id, i.id";
    private static final String QUERY_ATTACHMENTS_BY_DOC_IDS =
            "select a from AttachmentModel a left join fetch a.karte left join fetch a.creator "
                    + "where a.document.id in :ids order by a.document.id, a.id";
    private static final String QUERY_SCHEMA_METADATA_BY_DOC_IDS =
            "select i.id, i.confirmed, i.started, i.ended, i.recorded, i.linkId, i.linkRelation, i.status, " +
                    "i.creator, i.karte, i.document.id, i.extRef, i.uri, i.digest " +
                    "from SchemaModel i where i.document.id in :ids order by i.document.id, i.id";
    private static final String QUERY_ATTACHMENT_METADATA_BY_DOC_IDS =
            "select a.id, a.confirmed, a.started, a.ended, a.recorded, a.linkId, a.linkRelation, a.status, " +
                    "a.creator, a.karte, a.document.id, a.fileName, a.contentType, a.contentSize, a.lastModified, " +
                    "a.digest, a.title, a.uri, a.extension, a.memo " +
                    "from AttachmentModel a where a.document.id in :ids order by a.document.id, a.id";
//s.oh$
//s.oh^ 2014/08/20 添付ファイルの別読
    private static final String QUERY_ATTACHMENT_BY_ID = "from AttachmentModel a where a.id=:id";
//s.oh$
    private static final String QUERY_MARK_DOCUMENT_MODIFIED =
            "update DocumentModel d set d.ended=:ended, d.status=:status where d.id=:id";
    private static final String QUERY_MARK_MODULES_MODIFIED =
            "update ModuleModel m set m.ended=:ended, m.status=:status where m.document.id=:id";
    private static final String QUERY_MARK_SCHEMAS_MODIFIED =
            "update SchemaModel s set s.ended=:ended, s.status=:status where s.document.id=:id";
    private static final String QUERY_MARK_ATTACHMENTS_MODIFIED =
            "update AttachmentModel a set a.ended=:ended, a.status=:status where a.document.id=:id";
    private static final String QUERY_DELETE_DIAGNOSIS_BY_IDS =
            "delete from RegisteredDiagnosisModel r where r.id in :ids";
    private static final String QUERY_DELETE_OBSERVATIONS_BY_IDS =
            "delete from ObservationModel o where o.id in :ids";
//minagawa^ LSC Test
    //private static final String QUERY_MODULE_BY_ENTITY = "from ModuleModel m where m.karte.id=:karteId and m.moduleInfo.entity=:entity and m.started between :fromDate and :toDate and m.status='F'";
    private static final String QUERY_MODULE_BY_ENTITY = "from ModuleModel m where m.karte.id=:karteId and m.moduleInfo.entity=:entity and m.started between :fromDate and :toDate and m.status='F' order by m.started";
//minagawa$
    private static final String QUERY_SCHEMA_BY_KARTE_ID = "from SchemaModel i where i.karte.id =:karteId and i.started between :fromDate and :toDate and i.status='F'";

    private static final String QUERY_SCHEMA_BY_FACILITY_ID = "from SchemaModel i where i.karte.patient.facilityId like :fid and i.extRef.sop is not null and i.status='F'";

    private static final String QUERY_DIAGNOSIS_BY_KARTE_DATE = "from RegisteredDiagnosisModel r where r.karte.id=:karteId and r.started >= :fromDate";
    private static final String QUERY_DIAGNOSIS_BY_KARTE_DATE_ACTIVEONLY = "from RegisteredDiagnosisModel r where r.karte.id=:karteId and r.started >= :fromDate and r.ended is NULL";
    private static final String QUERY_DIAGNOSIS_BY_KARTE = "from RegisteredDiagnosisModel r where r.karte.id=:karteId";
    private static final String QUERY_DIAGNOSIS_BY_KARTE_ACTIVEONLY = "from RegisteredDiagnosisModel r where r.karte.id=:karteId and r.ended is NULL";

    private static final String TOUTOU = "TOUTOU";
    private static final String TOUTOU_REPLY = "TOUTOU_REPLY";
    private static final String QUERY_LETTER_BY_KARTE_ID = "from TouTouLetter f where f.karte.id=:karteId";
    private static final String QUERY_REPLY_BY_KARTE_ID = "from TouTouReply f where f.karte.id=:karteId";
    private static final String QUERY_LETTER_BY_ID = "from TouTouLetter t where t.id=:id";
    private static final String QUERY_REPLY_BY_ID = "from TouTouReply t where t.id=:id";

    private static final String QUERY_APPO_BY_KARTE_ID_PERIOD = "from AppointmentModel a where a.karte.id = :karteId and a.date between :fromDate and :toDate";

//s.oh^ 2014/04/03 サマリー対応
    private static final String QUERY_FREEDOCU_BY_FPID = "from PatientFreeDocumentModel p where p.facilityPatId=:fpid";
    private static final String FPID = "fpid";
//s.oh$
    
    @PersistenceContext
    private EntityManager em;

    @Inject
    private AttachmentStorageManager attachmentStorageManager;

    @Inject
    private ImageStorageManager imageStorageManager;

    @Inject
    private DocumentIntegrityService documentIntegrityService;

    @Inject
    private KarteDocumentWriteService karteDocumentWriteService;

    @Inject
    private KarteDiagnosisService karteDiagnosisService;

    @Inject
    private KarteObservationService karteObservationService;

    private PatientQueryService patientQueries() {
        return new PatientQueryService(em);
    }

    private UserQueryService userQueries() {
        return new UserQueryService(em);
    }

    private KarteDocumentQueryService karteDocumentQueries() {
        return new KarteDocumentQueryService(em);
    }

//s.oh^ 2014/02/21 Claim送信方法の変更
    //@Resource(mappedName = "java:/JmsXA")
    //private ConnectionFactory connectionFactory;
    //
    //@Resource(mappedName = "java:/queue/dolphin")
    //private jakarta.jms.Queue queue;
//s.oh$
    
    public KarteBean getKarte(String fid, String pid, Date fromDate) {
        try {
            return populateKarteDetails(loadKarteByFacilityAndPatientId(fid, pid), fromDate);
        } catch (Exception e) {
            LOGGER.warn("getKarte: failed to resolve karte (fid={}, pid={})", fid, pid, e);
            return null;
        }
    }

    /**
     * カルテの基礎的な情報をまとめて返す。
     * @param patientPK
     * @param fromDate 各種エントリの検索開始日
     * @return 基礎的な情報をフェッチした KarteBean
     */
    public KarteBean getKarte(long patientPK, Date fromDate) {
        try {
            return populateKarteDetails(loadKarteByPatientPk(patientPK), fromDate);
        } catch (Exception e) {
            LOGGER.warn("getKarte: failed to resolve karte for patientPk={}", patientPK, e);
            return null;
        }
    }

    private KarteBean loadKarteByFacilityAndPatientId(String fid, String pid) {
        KarteBean karte = patientQueries().findSingleKarteByFacilityAndPatientId(fid, pid);
        if (karte == null) {
            LOGGER.warn("getKarte: no karte found for fid={}, pid={}", fid, pid);
            return null;
        }
        return karte;
    }

    private KarteBean loadKarteByPatientPk(long patientPk) {
        KarteBean karte = patientQueries().findSingleKarteByPatientPk(patientPk);
        if (karte == null) {
            LOGGER.warn("getKarte: no karte found for patientPk={}", patientPk);
            return null;
        }
        return karte;
    }

    private KarteBean populateKarteDetails(KarteBean karte, Date fromDate) {
        if (karte == null) {
            return null;
        }

        long karteId = karte.getId();
        long patientPk = karte.getPatientModel() != null ? karte.getPatientModel().getId() : 0L;

        List<ObservationModel> observations = em.createQuery(QUERY_RELEVANT_OBSERVATIONS, ObservationModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
        List<AllergyModel> allergies = mapAllergies(observations);
        if (!allergies.isEmpty()) {
            karte.setAllergies(allergies);
        }
        List<PhysicalModel> heights = mapHeights(observations);
        if (!heights.isEmpty()) {
            karte.setHeights(heights);
        }
        List<PhysicalModel> weights = mapWeights(observations);
        if (!weights.isEmpty()) {
            karte.setWeights(weights);
        }

        if (patientPk > 0L) {
            List<PatientVisitModel> latestVisits =
                    em.createQuery(QUERY_PATIENT_VISIT, PatientVisitModel.class)
                            .setParameter(PATIENT_PK, patientPk)
                            .setParameter(FROM_DATE, toLocalDateTime(fromDate))
                            .getResultList();
            if (!latestVisits.isEmpty()) {
                List<String> visits = new ArrayList<>(latestVisits.size());
                for (PatientVisitModel bean : latestVisits) {
                    visits.add(bean.getPvtDate().toString());
                }
                karte.setPatientVisits(visits);
            }
        }

        List<DocumentModel> documents = em.createQuery(QUERY_DOC_INFO, DocumentModel.class)
                .setParameter(KARTE_ID, karteId)
                .setParameter(FROM_DATE, fromDate)
                .getResultList();
        if (!documents.isEmpty()) {
            List<DocInfoModel> docInfo = new ArrayList<>(documents.size());
            for (DocumentModel docBean : documents) {
                docBean.toDetuch();
                docInfo.add(docBean.getDocInfoModel());
            }
            karte.setDocInfoList(docInfo);
        }

        List<PatientMemoModel> memo = em.createQuery(QUERY_PATIENT_MEMO, PatientMemoModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
        if (!memo.isEmpty()) {
            karte.setMemoList(memo);
        }

        try {
            karte.setLastDocDate(findLatestDocumentStarted(karteId));
        } catch (NoResultException e) {
            // ignore
        }
        return karte;
    }

    private List<AllergyModel> mapAllergies(List<ObservationModel> observations) {
        if (observations == null || observations.isEmpty()) {
            return Collections.emptyList();
        }
        List<AllergyModel> allergies = new ArrayList<>();
        for (ObservationModel observation : observations) {
            if (observation == null || !"Allergy".equals(observation.getObservation())) {
                continue;
            }
            AllergyModel allergy = new AllergyModel();
            allergy.setObservationId(observation.getId());
            allergy.setFactor(observation.getPhenomenon());
            allergy.setSeverity(observation.getCategoryValue());
            allergy.setIdentifiedDate(observation.confirmDateAsString());
            allergy.setMemo(observation.getMemo());
            allergies.add(allergy);
        }
        return allergies;
    }

    private List<PhysicalModel> mapHeights(List<ObservationModel> observations) {
        return mapPhysicals(observations, "bodyHeight");
    }

    private List<PhysicalModel> mapWeights(List<ObservationModel> observations) {
        return mapPhysicals(observations, "bodyWeight");
    }

    private List<PhysicalModel> mapPhysicals(List<ObservationModel> observations, String phenomenon) {
        if (observations == null || observations.isEmpty()) {
            return Collections.emptyList();
        }
        List<PhysicalModel> physicals = new ArrayList<>();
        for (ObservationModel observation : observations) {
            if (observation == null
                    || !"PhysicalExam".equals(observation.getObservation())
                    || !Objects.equals(phenomenon, observation.getPhenomenon())) {
                continue;
            }
            PhysicalModel physical = new PhysicalModel();
            if ("bodyHeight".equals(phenomenon)) {
                physical.setHeightId(observation.getId());
                physical.setHeight(observation.getValue());
            } else {
                physical.setWeightId(observation.getId());
                physical.setWeight(observation.getValue());
            }
            physical.setIdentifiedDate(observation.confirmDateAsString());
            physical.setMemo(ModelUtils.getDateAsString(observation.getRecorded()));
            physicals.add(physical);
        }
        return physicals;
    }

    /**
     * 文書履歴エントリを取得する。
     * @param karteId カルテId
     * @param fromDate 取得開始日
     * @param includeModifid
     * @return DocInfo のコレクション
     */
    public List<DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
        String query = includeModifid ? QUERY_DOCUMENT_HEADERS_INCLUDE_MODIFIED : QUERY_DOCUMENT_HEADERS;
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

    public String findFacilityIdByPatientPk(long patientPk) {
        return findFacilityIdById(QUERY_FACILITY_BY_PATIENT_PK, patientPk);
    }

    public String findFacilityIdByKarteId(long karteId) {
        return findFacilityIdById(QUERY_FACILITY_BY_KARTE_ID, karteId);
    }

    public String findFacilityIdByDocId(long docId) {
        return findFacilityIdById(QUERY_FACILITY_BY_DOC_ID, docId);
    }

    public String findFacilityIdByAttachmentId(long attachmentId) {
        return findFacilityIdById(QUERY_FACILITY_BY_ATTACHMENT_ID, attachmentId);
    }

    public String findFacilityIdBySchemaId(long schemaId) {
        return findFacilityIdById(QUERY_FACILITY_BY_SCHEMA_ID, schemaId);
    }

    public String findFacilityIdByPvtId(long pvtId) {
        return findFacilityIdById(QUERY_FACILITY_BY_PVT_ID, pvtId);
    }

    public String findFacilityIdByDiagnosisId(long diagnosisId) {
        return findFacilityIdById(QUERY_FACILITY_BY_DIAGNOSIS_ID, diagnosisId);
    }

    public String findFacilityIdByObservationId(long observationId) {
        return findFacilityIdById(QUERY_FACILITY_BY_OBSERVATION_ID, observationId);
    }

    public String findFacilityIdByOndobanId(long ondobanId) {
        return findFacilityIdById(QUERY_FACILITY_BY_ONDOBAN_ID, ondobanId);
    }

    public String findFacilityIdByNurseProgressCourseId(long nurseProgressCourseId) {
        return findFacilityIdById(QUERY_FACILITY_BY_NURSE_PROGRESS_COURSE_ID, nurseProgressCourseId);
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

    /**
     * 文書(DocumentModel Object)を取得する。
     * @param ids DocumentModel の pkコレクション
     * @return DocumentModelのコレクション
     */
    public List<DocumentModel> getDocuments(List<Long> ids) {
        List<DocumentModel> ret = loadDocuments(ids, DocumentLoadMode.DETAIL);
        // 詳細取得 API は完全性検証を維持する。
        for (DocumentModel document : ret) {
            verifyDocumentOnRead(document);
            document.toDetuch();
        }
        return ret;
    }

    public List<DocumentModel> getDocumentsAttachmentLight(List<Long> ids) {
        List<DocumentModel> documents = loadDocuments(ids, DocumentLoadMode.ATTACHMENT_LIGHT);
        // 添付バイナリは別 download API で取得する。ここでは schema は維持し、attachment のみ軽量化する。
        for (DocumentModel document : documents) {
            verifyDocumentOnRead(document);
            document.toDetuch();
        }
        return documents;
    }

    public List<DocumentModel> getDocumentsRevisionLight(List<Long> ids) {
        List<DocumentModel> documents = loadDocuments(ids, DocumentLoadMode.REVISION_LIGHT);
        // Revision browse は差分/履歴表示用の軽量経路。実バイナリ取得は attachment/image 個別 API に委譲する。
        for (DocumentModel document : documents) {
            document.toDetuch();
        }
        return documents;
    }

    public List<DocumentModel> getDocumentsWithModules(List<Long> ids) {
        List<DocumentModel> documents = loadDocuments(ids, DocumentLoadMode.MODULES_ONLY);
        for (DocumentModel document : documents) {
            document.toDetuch();
        }
        return documents;
    }
    
    /**
     * ドキュメント DocumentModel オブジェクトを保存する。
     * @param document 追加するDocumentModel オブジェクト
     * @return 追加した数
     */
    public long addDocument(DocumentModel document) {
        return karteDocumentWriteService.addDocument(document);
    }

    public long updateDocument(DocumentModel document) {
        return karteDocumentWriteService.updateDocument(document);
    }

    public void flush() {
        em.flush();
    }

    public List<RoutineMedicationResponse> getRoutineMedications(long karteId, int firstResult, int maxResults) {

        if (karteId <= 0) {
            return Collections.emptyList();
        }
        int safeFirst = Math.max(firstResult, 0);
        int safeMax = maxResults > 0 ? maxResults : 50;

        List<Long> docIds = em.createQuery(QUERY_DOCUMENT_IDS_WITH_MED_ENTITY, Long.class)
                .setParameter(KARTE_ID, karteId)
                .setParameter(ENTITY, IInfoModel.ENTITY_MED_ORDER)
                .setFirstResult(safeFirst)
                .setMaxResults(safeMax)
                .getResultList();
        if (docIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<DocumentModel> documents = fetchDocumentsWithModules(docIds);
        documents.sort(Comparator.comparing(DocumentModel::getStarted, Comparator.nullsLast(Comparator.naturalOrder())).reversed());

        List<RoutineMedicationResponse> responses = new ArrayList<>();
        for (DocumentModel document : documents) {
            List<ModuleModel> medModules = filterMedModules(document.getModules());
            if (medModules.isEmpty()) {
                continue;
            }
            responses.add(new RoutineMedicationResponse(
                    document.getId(),
                    determineRoutineName(document, medModules),
                    determineRoutineMemo(medModules),
                    document.getDocInfoModel() != null ? document.getDocInfoModel().getDocType() : null,
                    formatIso(document.getConfirmed() != null ? document.getConfirmed() : document.getRecorded()),
                    convertModules(medModules)
            ));
        }
        return responses;
    }

    public List<RpHistoryEntryResponse> getRpHistory(long karteId, Date fromDate, Date toDateExclusive, boolean lastOnly) {

        if (karteId <= 0) {
            return Collections.emptyList();
        }

        StringBuilder jpql = new StringBuilder("select d.id from DocumentModel d ")
                .append("where d.karte.id=:karteId and d.status in ('F','T') ")
                .append("and exists (select 1 from ModuleModel m where m.document.id=d.id and m.moduleInfo.entity=:entity)");
        if (fromDate != null) {
            jpql.append(" and d.started >= :fromDate");
        }
        if (toDateExclusive != null) {
            jpql.append(" and d.started < :toDate");
        }
        jpql.append(" order by d.started desc");

        TypedQuery<Long> query = em.createQuery(jpql.toString(), Long.class)
                .setParameter(KARTE_ID, karteId)
                .setParameter(ENTITY, IInfoModel.ENTITY_MED_ORDER);
        if (fromDate != null) {
            query.setParameter(FROM_DATE, fromDate);
        }
        if (toDateExclusive != null) {
            query.setParameter(TO_DATE, toDateExclusive);
        }

        List<Long> docIds = query.getResultList();
        if (docIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<DocumentModel> documents = fetchDocumentsWithModules(docIds);
        documents.sort(Comparator.comparing(DocumentModel::getStarted, Comparator.nullsLast(Comparator.naturalOrder())).reversed());

        Map<String, RpHistoryEntryResponse> grouped = new LinkedHashMap<>();
        for (DocumentModel document : documents) {
            List<ModuleModel> medModules = filterMedModules(document.getModules());
            if (medModules.isEmpty()) {
                continue;
            }
            List<RpHistoryDrugResponse> drugs = toRpHistoryDrugs(medModules);
            if (drugs.isEmpty()) {
                continue;
            }
            String issuedDate = formatDateOnly(
                    firstNonNull(document.getConfirmed(), document.getStarted(), document.getRecorded()));
            if (lastOnly && issuedDate != null && grouped.containsKey(issuedDate)) {
                continue;
            }
            RpHistoryEntryResponse entry = new RpHistoryEntryResponse(
                    issuedDate,
                    document.getDocInfoModel() != null ? document.getDocInfoModel().getTitle() : null,
                    drugs
            );
            grouped.put(issuedDate != null ? issuedDate : UUID.randomUUID().toString(), entry);
        }

        return new ArrayList<>(grouped.values());
    }

    public List<UserPropertyResponse> getUserProperties(String userId) {
        if (userId == null || userId.isBlank()) {
            return Collections.emptyList();
        }

        String compositeUserId = userId.trim();
        if (!compositeUserId.contains(IInfoModel.COMPOSITE_KEY_MAKER)) {
            return Collections.emptyList();
        }

        UserModel user = userQueries().findByCompositeUserId(compositeUserId);
        if (user == null) {
            return Collections.emptyList();
        }
        return buildUserPropertyResponses(user);
    }

    public SafetySummaryResponse getSafetySummary(long karteId) {
        if (karteId <= 0) {
            return new SafetySummaryResponse(Collections.emptyList(), Collections.emptyList(), Collections.emptyList());
        }

        // 1. Allergies
        List<ObservationModel> observations = em.createQuery(QUERY_ALLERGY, ObservationModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
        
        List<SafetySummaryResponse.AllergySummaryResponse> allergies = new ArrayList<>();
        if (observations != null) {
            for (ObservationModel observation : observations) {
                SafetySummaryResponse.AllergySummaryResponse allergy = new SafetySummaryResponse.AllergySummaryResponse();
                allergy.setObservationId(observation.getId());
                allergy.setFactor(observation.getPhenomenon());
                allergy.setSeverity(observation.getCategoryValue());
                allergy.setIdentifiedDate(observation.confirmDateAsString());
                allergy.setMemo(observation.getMemo());
                allergies.add(allergy);
            }
        }

        // 2. Active Diagnoses
        List<RegisteredDiagnosisModel> diagnoses = em.createQuery(QUERY_DIAGNOSIS_BY_KARTE_ACTIVEONLY, RegisteredDiagnosisModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
        List<DiagnosisSummaryResponse> diagnosisSummaries = new ArrayList<>();
        if (diagnoses != null) {
            for (RegisteredDiagnosisModel diagnosis : diagnoses) {
                DiagnosisSummaryResponse summary = new DiagnosisSummaryResponse();
                summary.setId(diagnosis.getId());
                summary.setDiagnosis(diagnosis.getDiagnosis());
                summary.setDiagnosisCode(diagnosis.getDiagnosisCode());
                summary.setStartDate(diagnosis.getStartDate());
                summary.setOutcome(diagnosis.getOutcome());
                summary.setOutcomeDesc(diagnosis.getOutcomeDesc());
                diagnosisSummaries.add(summary);
            }
        }

        // 3. Routine Meds
        List<RoutineMedicationResponse> routineMeds = getRoutineMedications(karteId, 0, 50);

        return new SafetySummaryResponse(allergies, diagnosisSummaries, routineMeds);
    }

    public long addDocumentAndUpdatePVTState(DocumentModel document, long pvtPK, int state) {
        return karteDocumentWriteService.addDocumentAndUpdatePVTState(document, pvtPK, state);
    }

    /**
     * ドキュメントを論理削除する。
     * @param id
     * @return 削除したドキュメントの文書IDリスト
     */
    public List<String> deleteDocument(long id) {
        return karteDocumentWriteService.deleteDocument(id);
    }

    /**
     * ドキュメントのタイトルを変更する。
     * @param pk 変更するドキュメントの primary key
     * @param title* @return 変更した件数
     * @return 
     */
    public int updateTitle(long pk, String title) {
        return karteDocumentWriteService.updateTitle(pk, title);
    }

    /**
     * ModuleModelエントリを取得する。
     * @param karteId
     * @param entity
     * @param fromDate
     * @param toDate
     * @return ModuleModelリストのリスト
     */
    public List<List<ModuleModel>> getModules(long karteId, String entity, List fromDate, List toDate) {

        // 抽出期間は別けられている
        int len = fromDate.size();
        List<List<ModuleModel>> ret = new ArrayList<>(len);

        // 抽出期間セットの数だけ繰り返す
        for (int i = 0; i < len; i++) {

            List<ModuleModel> modules
                    = em.createQuery(QUERY_MODULE_BY_ENTITY)
                    .setParameter(KARTE_ID, karteId)
                    .setParameter(ENTITY, entity)
                    .setParameter(FROM_DATE, fromDate.get(i))
                    .setParameter(TO_DATE, toDate.get(i))
                    .getResultList();

            decodeModulePayloads(modules);
            ret.add(modules);
        }

        return ret;
    }

    /**
     * SchemaModelエントリを取得する。
     * @param karteId カルテID
     * @param fromDate
     * @param toDate
     * @return SchemaModelエントリの配列
     */
    public List<List> getImages(long karteId, List fromDate, List toDate) {

        // 抽出期間は別けられている
        int len = fromDate.size();
        List<List> ret = new ArrayList<>(len);

        // 抽出期間セットの数だけ繰り返す
        for (int i = 0; i < len; i++) {

            List modules
                    = em.createQuery(QUERY_SCHEMA_BY_KARTE_ID)
                    .setParameter(KARTE_ID, karteId)
                    .setParameter(FROM_DATE, fromDate.get(i))
                    .setParameter(TO_DATE, toDate.get(i))
                    .getResultList();

            ret.add(modules);
        }

        return ret;
    }

    /**
     * 画像を取得する。
     * @param id SchemaModel Id
     * @return SchemaModel
     */
    public SchemaModel getImage(long id) {
        SchemaModel image = (SchemaModel)em.find(SchemaModel.class, id);
        if (image != null) {
            imageStorageManager.populateBinary(image);
        }
        return image;
    }

    public List<SchemaModel> getS3Images(String fid, int firstResult, int maxResult) {

        List<SchemaModel> ret = (List<SchemaModel>)
                                em.createQuery(QUERY_SCHEMA_BY_FACILITY_ID)
                                .setParameter(FID, fid+"%")
                                .setFirstResult(firstResult)
                                .setMaxResults(maxResult)
                                .getResultList();
        return ret;
    }

    public void deleteS3Image(long pk) {
        SchemaModel target = em.find(SchemaModel.class, pk);
        target.getExtRefModel().setBucket(null);
        target.getExtRefModel().setSop(null);
        target.getExtRefModel().setUrl(null);
    }

    /**
     * 傷病名リストを取得する。
     * @param karteId
     * @param fromDate
     * @param activeOnly
     * @return 傷病名のリスト
     */
    public List<RegisteredDiagnosisModel> getDiagnosis(long karteId, Date fromDate, boolean activeOnly) {
        return karteDiagnosisService.getDiagnosis(karteId, fromDate, activeOnly);
    }
    
    /**
     * 新規病名保存、病名更新を一括して実行する。
     * @param wrapper DiagnosisSendWrapper
     * @return 新規病名のPKリスト
     */
    public List<Long> postPutSendDiagnosis(DiagnosisSendWrapper wrapper) {
        return karteDiagnosisService.postPutSendDiagnosis(wrapper);
    }
    

    /**
     * 傷病名を追加する。
     * @param addList 追加する傷病名のリスト
     * @return idのリスト
     */
    public List<Long> addDiagnosis(List<RegisteredDiagnosisModel> addList) {
        return karteDiagnosisService.addDiagnosis(addList);
    }

    /**
     * 傷病名を更新する。
     * @param updateList
     * @return 更新数
     */
    public int updateDiagnosis(List<RegisteredDiagnosisModel> updateList) {
        return karteDiagnosisService.updateDiagnosis(updateList);
    }

    /**
     * 傷病名を削除する。
     * @param removeList 削除する傷病名のidリスト
     * @return 削除数
     */
    public int removeDiagnosis(List<Long> removeList) {
        return karteDiagnosisService.removeDiagnosis(removeList);
    }

    /**
     * Observationを取得する。
     * @param karteId
     * @param observation
     * @param phenomenon
     * @param firstConfirmed
     * @return Observationのリスト
     */
    public List<ObservationModel> getObservations(long karteId, String observation, String phenomenon, Date firstConfirmed) {
        return karteObservationService.getObservations(karteId, observation, phenomenon, firstConfirmed);
    }

    /**
     * Observationを追加する。
     * @param observations 追加するObservationのリスト
     * @return 追加したObservationのIdリスト
     */
    public List<Long> addObservations(List<ObservationModel> observations) {
        return karteObservationService.addObservations(observations);
    }

    /**
     * Observationを更新する。
     * @param observations 更新するObservationのリスト
     * @return 更新した数
     */
    public int updateObservations(List<ObservationModel> observations) {
        return karteObservationService.updateObservations(observations);
    }

    /**
     * Observationを削除する。
     * @param observations 削除するObservationのリスト
     * @return 削除した数
     */
    
    public int removeObservations(List<Long> observations) {
        return karteObservationService.removeObservations(observations);
    }

    /**
     * 患者メモを更新する。
     * @param memo 更新するメモ
     * @return   */
    
    public int updatePatientMemo(PatientMemoModel memo) {

        int cnt = 0;

        if (memo.getId() == 0L) {
            //em.persist(memo);
            if(memo.getKarteBean() != null) {
                List<PatientMemoModel> memoList =
                            (List<PatientMemoModel>)em.createQuery(QUERY_PATIENT_MEMO)
                                                      .setParameter("karteId", memo.getKarteBean().getId())
                                                      .getResultList();
                if(memoList.isEmpty()) {
                    em.persist(memo);
                }else{
                    PatientMemoModel pmm = memoList.get(0);
                    pmm.setMemo(memo.getMemo());
                    em.merge(pmm);
                }
            }
        } else {
            em.merge(memo);
        }
        cnt++;
        return cnt;
    }
    
//s.oh^ 2014/04/03 サマリー対応
    public PatientFreeDocumentModel getPatientFreeDocument(String fpid) {

//        PatientFreeDocumentModel ret = (PatientFreeDocumentModel)em.createQuery(QUERY_FREEDOCU_BY_FPID)
//                                        .setParameter(FPID, fpid)
//                                        .getSingleResult();
        List<PatientFreeDocumentModel> ret = em.createQuery(QUERY_FREEDOCU_BY_FPID)
                                        .setParameter(FPID, fpid)
                                        .getResultList();

        return (ret!=null && ret.size()==1) ? ret.get(0) : null;
    }
    
    public int updatePatientFreeDocument(PatientFreeDocumentModel update) {
        PatientFreeDocumentModel current = (PatientFreeDocumentModel)em.find(PatientFreeDocumentModel.class, update.getId());
        if(current == null) {
            try{
                current = (PatientFreeDocumentModel)em.createQuery(QUERY_FREEDOCU_BY_FPID)
                          .setParameter(FPID, update.getFacilityPatId())
                          .getSingleResult();
                if(current != null) {
                    update.setId(current.getId());
                }
            }catch(NoResultException ex) {
                LOGGER.warn("FreeDocument NoResultException");
            }
            em.persist(update);
            LOGGER.info("New FreeDocument");
            return 1;
        }
        em.merge(update);
        LOGGER.info("Update FreeDocument");
        return 1;
    }
//s.oh$

    //--------------------------------------------------------------------------

    /**
     * 紹介状を保存または更新する。
     * @param model
     * @return 
     */
    
    public long saveOrUpdateLetter(LetterModel model) {
        LetterModel saveOrUpdate = em.merge(model);
        return saveOrUpdate.getId();
    }

    /**
     * 紹介状のリストを取得する。
     * @param karteId
     * @param docType
     * @return 
     */
    
    public List<LetterModel> getLetterList(long karteId, String docType) {

        if (docType.equals(TOUTOU)) {
            // 紹介状
            List<LetterModel> ret = (List<LetterModel>)
                        em.createQuery(QUERY_LETTER_BY_KARTE_ID)
                        .setParameter(KARTE_ID, karteId)
                        .getResultList();
            return ret;

        } else if (docType.equals(TOUTOU_REPLY)) {
            // 返書
            List<LetterModel> ret = (List<LetterModel>)
                        em.createQuery(QUERY_REPLY_BY_KARTE_ID)
                        .setParameter(KARTE_ID, karteId)
                        .getResultList();
            return ret;
        }

        return null;
    }

    /**
     * 紹介状を取得する。
     * @param letterPk
     * @return 
     */
    
    public LetterModel getLetter(long letterPk) {

        LetterModel ret = (LetterModel)
                        em.createQuery(QUERY_LETTER_BY_ID)
                        .setParameter(ID, letterPk)
                        .getSingleResult();
        return ret;
    }

    
    public LetterModel getLetterReply(long letterPk) {

        LetterModel ret = (LetterModel)
                        em.createQuery(QUERY_REPLY_BY_ID)
                        .setParameter(ID, letterPk)
                        .getSingleResult();
        return ret;
    }

    //--------------------------------------------------------------------------

    
    public List<List<AppointmentModel>> getAppointmentList(long karteId, List fromDate, List toDate) {

        // 抽出期間は別けられている
        int len = fromDate.size();
        List<List<AppointmentModel>> ret = new ArrayList<>(len);

        // 抽出期間セットの数だけ繰り返す
        for (int i = 0; i < len; i++) {

            List<AppointmentModel> modules
                    = em.createQuery(QUERY_APPO_BY_KARTE_ID_PERIOD)
                    .setParameter(KARTE_ID, karteId)
                    .setParameter(FROM_DATE, fromDate.get(i))
                    .setParameter(TO_DATE, toDate.get(i))
                    .getResultList();

            ret.add(modules);
        }

        return ret;
    }
    
    //---------------------------------------------------------------------------
     
    // 指定したEntityのModuleModleを一括取得
    @SuppressWarnings("unchecked")
    public List<ModuleModel> getModulesEntitySearch(String fid, long karteId, Date fromDate, Date toDate, List<String> entities) {
        
        // 指定したentityのModuleModelを返す
        List<ModuleModel> ret;
        
        //if (karteId != 0){
            final String sql = "from ModuleModel m where m.karte.id = :karteId " +
                    "and m.started between :fromDate and :toDate and m.status='F' " +
                    "and m.moduleInfo.entity in (:entities)";

            ret = em.createQuery(sql)
                    .setParameter("karteId", karteId)
                    .setParameter("fromDate", fromDate)
                    .setParameter("toDate", toDate)
                    .setParameter("entities", entities)
                    .getResultList();
            decodeModulePayloads(ret);
//          } else {
//            // karteIdが指定されていなかったら、施設の指定期間のすべて患者のModuleModelを返す
//            long fPk = getFacilityPk(fid);
//            final String sql = "from ModuleModel m " +
//                    "where m.started between :fromDate and :toDate " +
//                    "and m.status='F' " +
//                    "and m.moduleInfo.entity in (:entities)" +
//                    "and m.creator.facility.id = :fPk";
//
//            ret = em.createQuery(sql)
//                    .setParameter("fromDate", fromDate)
//                    .setParameter("toDate", toDate)
//                    .setParameter("entities",entities)
//                    .setParameter("fPk", fPk)
//                    .getResultList();
//        }

        return ret;
    }

//s.oh^ 2014/07/22 一括カルテPDF出力
    public List<DocumentModel> getAllDocument(long patientPK) {
        return getAllDocument(patientPK, 0, DEFAULT_DOCINFO_PAGE_SIZE);
    }

    public List<DocumentModel> getAllDocument(long patientPK, int offset, int limit) {
        DocinfoPageRequest pageRequest = new DocinfoPageRequest(
                patientPK,
                normalizeDocinfoOffset(offset),
                normalizeDocinfoPageSize(limit));
        try {
            KarteBean karte = findPrimaryKarteForDocinfo(pageRequest.patientPk());
            if (karte == null) {
                return new ArrayList<>();
            }
            List<Long> docIds = findPagedDocinfoDocumentIds(karte.getId(), pageRequest.offset(), pageRequest.limit());
            return loadRevisionLightDocumentPage(docIds);
        } catch (NoResultException e) {
            // 患者登録の際にカルテも生成してある
            return new ArrayList<>();
        }
    }
//s.oh$
    
//s.oh^ 2014/08/20 添付ファイルの別読
    public AttachmentModel getAttachment(long pk) {
        try {
            AttachmentModel attachment = (AttachmentModel)em.createQuery(QUERY_ATTACHMENT_BY_ID)
                                            .setParameter(ID, pk)
                                            .getSingleResult();
            attachmentStorageManager.populateBinary(attachment);
            return attachment;
        } catch (NoResultException e) {
        }
        return null;
    }
//s.oh$

    public static int normalizeDocinfoOffset(int offset) {
        return Math.max(offset, 0);
    }

    public static int normalizeDocinfoPageSize(int limit) {
        if (limit <= 0) {
            return DEFAULT_DOCINFO_PAGE_SIZE;
        }
        return Math.min(limit, MAX_DOCINFO_PAGE_SIZE);
    }

    private KarteBean findPrimaryKarteForDocinfo(long patientPk) {
        List<KarteBean> kartes = em.createQuery(QUERY_KARTE)
                .setParameter(PATIENT_PK, patientPk)
                .setMaxResults(1)
                .getResultList();
        if (kartes == null || kartes.isEmpty()) {
            return null;
        }
        return kartes.get(0);
    }

    private List<Long> findPagedDocinfoDocumentIds(long karteId, int offset, int limit) {
        return em.createQuery(
                        "select d.id from DocumentModel d where d.karte.id=:karteId and (d.status='F' or d.status='T') order by d.started desc, d.id desc",
                        Long.class)
                .setParameter(KARTE_ID, karteId)
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }

    private List<DocumentModel> loadRevisionLightDocumentPage(List<Long> docIds) {
        // Docinfo list path: keep revision metadata only and leave binary fetch to dedicated APIs.
        List<DocumentModel> documents = loadDocuments(docIds, DocumentLoadMode.REVISION_LIGHT);
        for (DocumentModel document : documents) {
            document.toDetuch();
        }
        return documents;
    }

    private List<DocumentModel> loadDocuments(List<Long> ids, DocumentLoadMode mode) {
        List<Long> orderedIds = normalizeDocumentIds(ids);
        if (orderedIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<DocumentModel> documents = karteDocumentQueries().findDocumentsByIds(orderedIds);
        Map<Long, DocumentModel> documentById = new LinkedHashMap<>();
        for (DocumentModel document : documents) {
            if (document != null) {
                documentById.put(document.getId(), document);
            }
        }

        if (mode.loadsModules()) {
            populateModules(documentById, orderedIds);
        } else {
            clearModules(documentById.values());
        }
        if (mode.loadsFullSchema()) {
            populateSchemas(documentById, orderedIds);
        } else if (mode.loadsSchemaMetadata()) {
            populateSchemaMetadata(documentById, orderedIds);
        } else {
            clearSchema(documentById.values());
        }

        if (mode.loadsFullAttachment()) {
            populateAttachments(documentById, orderedIds);
        } else if (mode.loadsAttachmentMetadata()) {
            populateAttachmentMetadata(documentById, orderedIds);
        } else {
            clearAttachments(documentById.values());
        }

        List<DocumentModel> ordered = new ArrayList<>(orderedIds.size());
        for (Long id : orderedIds) {
            DocumentModel document = documentById.get(id);
            if (document != null) {
                ordered.add(document);
            }
        }
        return ordered;
    }

    private List<Long> normalizeDocumentIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }
        LinkedHashSet<Long> ordered = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null && id > 0) {
                ordered.add(id);
            }
        }
        return new ArrayList<>(ordered);
    }

    private void populateModules(Map<Long, DocumentModel> documentById, List<Long> orderedIds) {
        List<ModuleModel> modules = karteDocumentQueries().findModulesByDocumentIds(orderedIds);
        Map<Long, List<ModuleModel>> grouped = new LinkedHashMap<>();
        for (ModuleModel module : modules) {
            if (module == null || module.getDocumentModel() == null) {
                continue;
            }
            grouped.computeIfAbsent(module.getDocumentModel().getId(), ignored -> new ArrayList<>())
                    .add(module);
        }
        for (Long docId : orderedIds) {
            DocumentModel document = documentById.get(docId);
            if (document == null) {
                continue;
            }
            List<ModuleModel> related = new ArrayList<>(grouped.getOrDefault(docId, List.of()));
            decodeModulePayloads(related);
            document.setModules(related);
        }
    }

    private void populateSchemas(Map<Long, DocumentModel> documentById, List<Long> orderedIds) {
        List<SchemaModel> rows = em.createQuery(QUERY_SCHEMAS_BY_DOC_IDS, SchemaModel.class)
                .setParameter("ids", orderedIds)
                .getResultList();
        Map<Long, List<SchemaModel>> grouped = new LinkedHashMap<>();
        for (SchemaModel schema : rows) {
            if (schema == null || schema.getDocumentModel() == null) {
                continue;
            }
            grouped.computeIfAbsent(schema.getDocumentModel().getId(), ignored -> new ArrayList<>())
                    .add(schema);
        }
        for (Long docId : orderedIds) {
            DocumentModel document = documentById.get(docId);
            if (document != null) {
                document.setSchema(new ArrayList<>(grouped.getOrDefault(docId, List.of())));
            }
        }
    }

    private void populateSchemaMetadata(Map<Long, DocumentModel> documentById, List<Long> orderedIds) {
        List<Object[]> rows = em.createQuery(QUERY_SCHEMA_METADATA_BY_DOC_IDS, Object[].class)
                .setParameter("ids", orderedIds)
                .getResultList();
        Map<Long, List<SchemaModel>> grouped = new LinkedHashMap<>();
        for (Object[] row : rows) {
            SchemaModel schema = toSchemaMetadata(row, documentById);
            if (schema == null || schema.getDocumentModel() == null) {
                continue;
            }
            grouped.computeIfAbsent(schema.getDocumentModel().getId(), ignored -> new ArrayList<>())
                    .add(schema);
        }
        for (Long docId : orderedIds) {
            DocumentModel document = documentById.get(docId);
            if (document != null) {
                document.setSchema(new ArrayList<>(grouped.getOrDefault(docId, List.of())));
            }
        }
    }

    private void populateAttachments(Map<Long, DocumentModel> documentById, List<Long> orderedIds) {
        List<AttachmentModel> rows = em.createQuery(QUERY_ATTACHMENTS_BY_DOC_IDS, AttachmentModel.class)
                .setParameter("ids", orderedIds)
                .getResultList();
        Map<Long, List<AttachmentModel>> grouped = new LinkedHashMap<>();
        for (AttachmentModel attachment : rows) {
            if (attachment == null || attachment.getDocumentModel() == null) {
                continue;
            }
            grouped.computeIfAbsent(attachment.getDocumentModel().getId(), ignored -> new ArrayList<>())
                    .add(attachment);
        }
        for (Long docId : orderedIds) {
            DocumentModel document = documentById.get(docId);
            if (document != null) {
                document.setAttachment(new ArrayList<>(grouped.getOrDefault(docId, List.of())));
            }
        }
    }

    private void populateAttachmentMetadata(Map<Long, DocumentModel> documentById, List<Long> orderedIds) {
        List<Object[]> rows = em.createQuery(QUERY_ATTACHMENT_METADATA_BY_DOC_IDS, Object[].class)
                .setParameter("ids", orderedIds)
                .getResultList();
        Map<Long, List<AttachmentModel>> grouped = new LinkedHashMap<>();
        for (Object[] row : rows) {
            AttachmentModel attachment = toAttachmentMetadata(row, documentById);
            if (attachment == null || attachment.getDocumentModel() == null) {
                continue;
            }
            grouped.computeIfAbsent(attachment.getDocumentModel().getId(), ignored -> new ArrayList<>())
                    .add(attachment);
        }
        for (Long docId : orderedIds) {
            DocumentModel document = documentById.get(docId);
            if (document != null) {
                document.setAttachment(new ArrayList<>(grouped.getOrDefault(docId, List.of())));
            }
        }
    }

    private void clearSchema(Collection<DocumentModel> documents) {
        for (DocumentModel document : documents) {
            if (document != null) {
                document.setSchema(new ArrayList<>());
            }
        }
    }

    private void clearModules(Collection<DocumentModel> documents) {
        for (DocumentModel document : documents) {
            if (document != null) {
                document.setModules(new ArrayList<>());
            }
        }
    }

    private void clearAttachments(Collection<DocumentModel> documents) {
        for (DocumentModel document : documents) {
            if (document != null) {
                document.setAttachment(new ArrayList<>());
            }
        }
    }

    private SchemaModel toSchemaMetadata(Object[] row, Map<Long, DocumentModel> documentById) {
        if (row == null || row.length < 14 || !(row[0] instanceof Long id)) {
            return null;
        }
        Long docId = row[10] instanceof Long value ? value : null;
        DocumentModel document = docId != null ? documentById.get(docId) : null;
        if (document == null) {
            return null;
        }
        SchemaModel schema = new SchemaModel();
        schema.setId(id);
        schema.setConfirmed((Date) row[1]);
        schema.setStarted((Date) row[2]);
        schema.setEnded((Date) row[3]);
        schema.setRecorded((Date) row[4]);
        schema.setLinkId(row[5] instanceof Long linkId ? linkId : 0L);
        schema.setLinkRelation((String) row[6]);
        schema.setStatus((String) row[7]);
        schema.setUserModel((UserModel) row[8]);
        schema.setKarteBean((KarteBean) row[9]);
        schema.setDocumentModel(document);
        schema.setExtRefModel((ExtRefModel) row[11]);
        schema.setUri((String) row[12]);
        schema.setDigest((String) row[13]);
        schema.setImageBytes(null);
        return schema;
    }

    private AttachmentModel toAttachmentMetadata(Object[] row, Map<Long, DocumentModel> documentById) {
        if (row == null || row.length < 20 || !(row[0] instanceof Long id)) {
            return null;
        }
        Long docId = row[10] instanceof Long value ? value : null;
        DocumentModel document = docId != null ? documentById.get(docId) : null;
        if (document == null) {
            return null;
        }
        AttachmentModel attachment = new AttachmentModel();
        attachment.setId(id);
        attachment.setConfirmed((Date) row[1]);
        attachment.setStarted((Date) row[2]);
        attachment.setEnded((Date) row[3]);
        attachment.setRecorded((Date) row[4]);
        attachment.setLinkId(row[5] instanceof Long linkId ? linkId : 0L);
        attachment.setLinkRelation((String) row[6]);
        attachment.setStatus((String) row[7]);
        attachment.setUserModel((UserModel) row[8]);
        attachment.setKarteBean((KarteBean) row[9]);
        attachment.setDocumentModel(document);
        attachment.setFileName((String) row[11]);
        attachment.setContentType((String) row[12]);
        attachment.setContentSize(row[13] instanceof Number size ? size.longValue() : 0L);
        attachment.setLastModified(row[14] instanceof Number lastModified ? lastModified.longValue() : 0L);
        attachment.setDigest((String) row[15]);
        attachment.setTitle((String) row[16]);
        attachment.setUri((String) row[17]);
        attachment.setExtension((String) row[18]);
        attachment.setMemo((String) row[19]);
        attachment.setContentBytes(null);
        return attachment;
    }

    private List<DocumentModel> fetchDocumentsWithModules(List<Long> docIds) {
        return getDocumentsWithModules(docIds);
    }

    private LocalDateTime toLocalDateTime(Date date) {
        if (date == null) {
            return null;
        }
        return LocalDateTime.ofInstant(date.toInstant(), ZoneId.systemDefault());
    }

    private enum DocumentLoadMode {
        DETAIL(true, true, false, true, false),
        ATTACHMENT_LIGHT(false, true, false, false, true),
        MODULES_ONLY(true, false, false, false, false),
        REVISION_LIGHT(false, false, true, false, true);

        private final boolean modules;
        private final boolean fullSchema;
        private final boolean schemaMetadata;
        private final boolean fullAttachment;
        private final boolean attachmentMetadata;

        DocumentLoadMode(boolean modules,
                         boolean fullSchema,
                         boolean schemaMetadata,
                         boolean fullAttachment,
                         boolean attachmentMetadata) {
            this.modules = modules;
            this.fullSchema = fullSchema;
            this.schemaMetadata = schemaMetadata;
            this.fullAttachment = fullAttachment;
            this.attachmentMetadata = attachmentMetadata;
        }

        boolean loadsModules() {
            return modules;
        }

        boolean loadsFullSchema() {
            return fullSchema;
        }

        boolean loadsSchemaMetadata() {
            return schemaMetadata;
        }

        boolean loadsFullAttachment() {
            return fullAttachment;
        }

        boolean loadsAttachmentMetadata() {
            return attachmentMetadata;
        }
    }

    private record DocinfoPageRequest(long patientPk, int offset, int limit) {
    }

    private List<ModuleModel> filterMedModules(List<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return Collections.emptyList();
        }
        List<ModuleModel> filtered = new ArrayList<>();
        for (ModuleModel module : modules) {
            if (module != null && module.getModuleInfoBean() != null
                    && IInfoModel.ENTITY_MED_ORDER.equals(module.getModuleInfoBean().getEntity())) {
                filtered.add(module);
            }
        }
        return filtered;
    }

    private String determineRoutineName(DocumentModel document, List<ModuleModel> modules) {
        String title = document.getDocInfoModel() != null ? document.getDocInfoModel().getTitle() : null;
        if (hasText(title)) {
            return title.trim();
        }
        for (ModuleModel module : modules) {
            ModuleInfoBean info = module.getModuleInfoBean();
            if (info != null && hasText(info.getStampName())) {
                return info.getStampName().trim();
            }
        }
        return "Document #" + document.getId();
    }

    private String determineRoutineMemo(List<ModuleModel> modules) {
        for (ModuleModel module : modules) {
            ModuleInfoBean info = module.getModuleInfoBean();
            if (info != null && hasText(info.getStampMemo())) {
                return info.getStampMemo().trim();
            }
        }
        return null;
    }

    private List<KarteRevisionDocumentResponse.ModuleResponse> convertModules(List<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return Collections.emptyList();
        }
        List<KarteRevisionDocumentResponse.ModuleResponse> responses =
                KarteRevisionResponseMapper.mapModuleResponses(modules);
        return responses != null ? responses : Collections.emptyList();
    }

    private String formatIso(Date date) {
        if (date == null) {
            return null;
        }
        Instant instant = date.toInstant();
        return ISO_INSTANT_FORMATTER.format(instant);
    }

    private String formatDateOnly(Date date) {
        if (date == null) {
            return null;
        }
        return ISO_DATE_FORMATTER.format(date.toInstant());
    }

    private Date firstNonNull(Date... candidates) {
        if (candidates == null) {
            return null;
        }
        for (Date candidate : candidates) {
            if (candidate != null) {
                return candidate;
            }
        }
        return null;
    }

    private List<RpHistoryDrugResponse> toRpHistoryDrugs(List<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return Collections.emptyList();
        }
        List<RpHistoryDrugResponse> responses = new ArrayList<>();
        for (ModuleModel module : modules) {
            BundleDolphin bundle = decodeBundle(module);
            if (bundle == null || bundle.getClaimItem() == null) {
                continue;
            }
            for (ClaimItem item : bundle.getClaimItem()) {
                responses.add(new RpHistoryDrugResponse(
                        item != null ? item.getCode() : null,
                        item != null ? item.getClassCode() : null,
                        item != null ? item.getName() : null,
                        buildAmount(item),
                        item != null ? item.getDose() : null,
                        bundle.getAdmin(),
                        bundle.getBundleNumber(),
                        firstNonBlank(item != null ? item.getMemo() : null, bundle.getMemo(), bundle.getAdminMemo())
                ));
            }
        }
        return responses;
    }

    private BundleDolphin decodeBundle(ModuleModel module) {
        try {
            Object decoded = ModelUtils.decodeModule(module);
            if (decoded instanceof BundleDolphin) {
                return (BundleDolphin) decoded;
            }
        } catch (Exception ex) {
            LOGGER.debug("Failed to decode module {}", module != null ? module.getId() : null, ex);
        }
        return null;
    }

    private void encodeModulePayloads(Collection<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return;
        }
        for (ModuleModel module : modules) {
            if (module == null || module.getModel() == null) {
                continue;
            }
            String json = ModelUtils.encodeModule(module);
            if (!hasText(json)) {
                throw new IllegalStateException("Failed to encode module payload as JSON: moduleId=" + module.getId());
            }
            module.setBeanJson(json);
        }
    }

    private void decodeModulePayloads(Collection<ModuleModel> modules) {
        if (modules == null || modules.isEmpty()) {
            return;
        }
        for (ModuleModel module : modules) {
            if (module == null || module.getModel() != null) {
                continue;
            }
            try {
                Object decoded = ModelUtils.decodeModule(module);
                if (decoded instanceof IInfoModel) {
                    module.setModel((IInfoModel) decoded);
                }
            } catch (Exception ex) {
                LOGGER.warn("Failed to decode module payload id={}", module.getId(), ex);
            }
        }
    }

    private String buildAmount(ClaimItem item) {
        if (item == null) {
            return null;
        }
        String number = item.getNumber();
        if (!hasText(number)) {
            return null;
        }
        StringBuilder sb = new StringBuilder(number.trim());
        if (hasText(item.getUnit())) {
            sb.append(item.getUnit().trim());
        }
        return sb.toString();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private List<UserPropertyResponse> buildUserPropertyResponses(UserModel user) {
        List<UserPropertyResponse> responses = new ArrayList<>();
        long seq = 1L;
        String updatedAt = formatIso(user.getRegisteredDate());

        if (hasText(user.getCommonName())) {
            responses.add(new UserPropertyResponse(seq++, "担当医", user.getCommonName().trim(), null, "プロフィール", updatedAt));
        }
        if (user.getDepartmentModel() != null && hasText(user.getDepartmentModel().getDepartmentDesc())) {
            responses.add(new UserPropertyResponse(seq++, "診療科", user.getDepartmentModel().getDepartmentDesc().trim(),
                    null, "プロフィール", updatedAt));
        }
        if (hasText(user.getOrcaId())) {
            responses.add(new UserPropertyResponse(seq++, "ORCA ID", user.getOrcaId().trim(),
                    "ORCA 連携で使用するユーザーコード", "システム", updatedAt));
        }
        if (hasText(user.getMemo())) {
            responses.add(new UserPropertyResponse(seq++, "ユーザーメモ", user.getMemo().trim(), null, "メモ", updatedAt));
        }
        return responses;
    }

    private void verifyDocumentOnRead(DocumentModel document) {
        if (documentIntegrityService == null || document == null) {
            return;
        }
        documentIntegrityService.verifyDocumentOnRead(document);
    }

    private Date findLatestDocumentStarted(long karteId) {
        List<Date> startedDates = em.createQuery(
                        "select d.started from DocumentModel d "
                                + "where d.karte.id = :karteId and (d.status = 'F' or d.status = 'T') "
                                + "order by d.started desc",
                        Date.class)
                .setParameter(KARTE_ID, karteId)
                .setMaxResults(1)
                .getResultList();
        if (startedDates.isEmpty()) {
            throw new NoResultException("Document started date not found for karteId=" + karteId);
        }
        return startedDates.get(0);
    }

}
