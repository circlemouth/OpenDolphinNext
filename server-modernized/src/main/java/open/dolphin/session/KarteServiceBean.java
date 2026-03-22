package open.dolphin.session;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import open.dolphin.infomodel.*;
import open.dolphin.persistence.query.PatientQueryService;
import open.dolphin.persistence.query.UserQueryService;
import open.dolphin.rest.dto.RoutineMedicationResponse;
import open.dolphin.rest.dto.RpHistoryEntryResponse;
import open.dolphin.rest.dto.SafetySummaryResponse;
import open.dolphin.rest.dto.UserPropertyResponse;
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
    public static final int DEFAULT_DOCINFO_PAGE_SIZE = KarteDocinfoPageSupport.DEFAULT_DOCINFO_PAGE_SIZE;
    public static final int MAX_DOCINFO_PAGE_SIZE = KarteDocinfoPageSupport.MAX_DOCINFO_PAGE_SIZE;
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
    private static final String QUERY_DOCUMENT_IDS_WITH_MED_ENTITY =
            "select d.id from DocumentModel d where d.karte.id=:karteId and d.status in ('F','T') " +
                    "and exists (select 1 from ModuleModel m where m.document.id=d.id and m.moduleInfo.entity=:entity) " +
                    "order by d.started desc";

//s.oh^ 2014/07/29 スタンプ／シェーマ／添付のソート
    //private static final String QUERY_MODULE_BY_DOC_ID = "from ModuleModel m where m.document.id=:id";
    //private static final String QUERY_SCHEMA_BY_DOC_ID = "from SchemaModel i where i.document.id=:id";
    //private static final String QUERY_ATTACHMENT_BY_DOC_ID = "from AttachmentModel a where a.document.id=:id";
//s.oh$
//s.oh^ 2014/08/20 添付ファイルの別読
    private static final String QUERY_ATTACHMENT_BY_ID = "from AttachmentModel a where a.id=:id";
//s.oh$
//minagawa^ LSC Test
    //private static final String QUERY_MODULE_BY_ENTITY = "from ModuleModel m where m.karte.id=:karteId and m.moduleInfo.entity=:entity and m.started between :fromDate and :toDate and m.status='F'";
    private static final String QUERY_MODULE_BY_ENTITY = "from ModuleModel m where m.karte.id=:karteId and m.moduleInfo.entity=:entity and m.started between :fromDate and :toDate and m.status='F' order by m.started";
//minagawa$
    private static final String QUERY_DIAGNOSIS_BY_KARTE_ACTIVEONLY = "from RegisteredDiagnosisModel r where r.karte.id=:karteId and r.ended is NULL";
    
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

    private KarteDetailAssemblySupport karteDetailAssemblySupport() {
        return new KarteDetailAssemblySupport(em);
    }

    private KarteDocumentBulkFetchSupport documentBulkFetchSupport() {
        return new KarteDocumentBulkFetchSupport(em, this::decodeModulePayloads);
    }

    private KarteMedicationSummarySupport medicationSummarySupport() {
        return new KarteMedicationSummarySupport();
    }

    private KarteDocinfoPageSupport docinfoPageSupport() {
        return new KarteDocinfoPageSupport(em, this::loadRevisionLightDocumentPage);
    }

    private KarteUserPropertySupport userPropertySupport() {
        return new KarteUserPropertySupport();
    }

    private KarteLegacyArtifactSupport legacyArtifactSupport() {
        return new KarteLegacyArtifactSupport(
                em,
                attachmentStorageManager,
                imageStorageManager,
                this::decodeModulePayloads,
                LOGGER);
    }

    public KarteBean getKarte(String fid, String pid, Date fromDate) {
        try {
            return karteDetailAssemblySupport().populate(loadKarteByFacilityAndPatientId(fid, pid), fromDate);
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
            return karteDetailAssemblySupport().populate(loadKarteByPatientPk(patientPK), fromDate);
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

    /**
     * 文書履歴エントリを取得する。
     * @param karteId カルテId
     * @param fromDate 取得開始日
     * @param includeModifid
     * @return DocInfo のコレクション
     */
    public List<DocInfoModel> getDocumentList(long karteId, Date fromDate, boolean includeModifid) {
        return legacyArtifactSupport().getDocumentList(karteId, fromDate, includeModifid);
    }

    public String findFacilityIdByPatientPk(long patientPk) {
        return legacyArtifactSupport().findFacilityIdByPatientPk(patientPk);
    }

    public String findFacilityIdByKarteId(long karteId) {
        return legacyArtifactSupport().findFacilityIdByKarteId(karteId);
    }

    public String findFacilityIdByDocId(long docId) {
        return legacyArtifactSupport().findFacilityIdByDocId(docId);
    }

    public String findFacilityIdByAttachmentId(long attachmentId) {
        return legacyArtifactSupport().findFacilityIdByAttachmentId(attachmentId);
    }

    public String findFacilityIdBySchemaId(long schemaId) {
        return legacyArtifactSupport().findFacilityIdBySchemaId(schemaId);
    }

    public String findFacilityIdByPvtId(long pvtId) {
        return legacyArtifactSupport().findFacilityIdByPvtId(pvtId);
    }

    public String findFacilityIdByDiagnosisId(long diagnosisId) {
        return legacyArtifactSupport().findFacilityIdByDiagnosisId(diagnosisId);
    }

    public String findFacilityIdByObservationId(long observationId) {
        return legacyArtifactSupport().findFacilityIdByObservationId(observationId);
    }

    public String findFacilityIdByOndobanId(long ondobanId) {
        return legacyArtifactSupport().findFacilityIdByOndobanId(ondobanId);
    }

    public String findFacilityIdByNurseProgressCourseId(long nurseProgressCourseId) {
        return legacyArtifactSupport().findFacilityIdByNurseProgressCourseId(nurseProgressCourseId);
    }

    /**
     * 文書(DocumentModel Object)を取得する。
     * @param ids DocumentModel の pkコレクション
     * @return DocumentModelのコレクション
     */
    public List<DocumentModel> getDocuments(List<Long> ids) {
        List<DocumentModel> ret = documentBulkFetchSupport().loadDocuments(ids, KarteDocumentBulkFetchSupport.DocumentLoadMode.DETAIL);
        // 詳細取得 API は完全性検証を維持する。
        for (DocumentModel document : ret) {
            verifyDocumentOnRead(document);
            document.toDetuch();
        }
        return ret;
    }

    public List<DocumentModel> getDocumentsAttachmentLight(List<Long> ids) {
        List<DocumentModel> documents =
                documentBulkFetchSupport().loadDocuments(ids, KarteDocumentBulkFetchSupport.DocumentLoadMode.ATTACHMENT_LIGHT);
        // 添付バイナリは別 download API で取得する。ここでは schema は維持し、attachment のみ軽量化する。
        for (DocumentModel document : documents) {
            verifyDocumentOnRead(document);
            document.toDetuch();
        }
        return documents;
    }

    public List<DocumentModel> getDocumentsRevisionLight(List<Long> ids) {
        List<DocumentModel> documents =
                documentBulkFetchSupport().loadDocuments(ids, KarteDocumentBulkFetchSupport.DocumentLoadMode.REVISION_LIGHT);
        // Revision browse は差分/履歴表示用の軽量経路。実バイナリ取得は attachment/image 個別 API に委譲する。
        for (DocumentModel document : documents) {
            document.toDetuch();
        }
        return documents;
    }

    public List<DocumentModel> getDocumentsWithModules(List<Long> ids) {
        List<DocumentModel> documents =
                documentBulkFetchSupport().loadDocuments(ids, KarteDocumentBulkFetchSupport.DocumentLoadMode.MODULES_ONLY);
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

        return medicationSummarySupport().toRoutineMedicationResponses(fetchDocumentsWithModules(docIds));
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

        return medicationSummarySupport().toRpHistoryEntries(fetchDocumentsWithModules(docIds), lastOnly);
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
        return userPropertySupport().toResponses(user);
    }

    public SafetySummaryResponse getSafetySummary(long karteId) {
        if (karteId <= 0) {
            return new SafetySummaryResponse(Collections.emptyList(), Collections.emptyList(), Collections.emptyList());
        }

        List<ObservationModel> observations = em.createQuery(QUERY_ALLERGY, ObservationModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();

        List<RegisteredDiagnosisModel> diagnoses = em.createQuery(QUERY_DIAGNOSIS_BY_KARTE_ACTIVEONLY, RegisteredDiagnosisModel.class)
                .setParameter(KARTE_ID, karteId)
                .getResultList();
        List<RoutineMedicationResponse> routineMeds = getRoutineMedications(karteId, 0, 50);
        return medicationSummarySupport().toSafetySummary(observations, diagnoses, routineMeds);
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
        return legacyArtifactSupport().getImages(karteId, fromDate, toDate);
    }

    /**
     * 画像を取得する。
     * @param id SchemaModel Id
     * @return SchemaModel
     */
    public SchemaModel getImage(long id) {
        return legacyArtifactSupport().getImage(id);
    }

    public List<SchemaModel> getS3Images(String fid, int firstResult, int maxResult) {
        return legacyArtifactSupport().getS3Images(fid, firstResult, maxResult);
    }

    public void deleteS3Image(long pk) {
        legacyArtifactSupport().deleteS3Image(pk);
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
        return legacyArtifactSupport().updatePatientMemo(memo);
    }
    
    public PatientFreeDocumentModel getPatientFreeDocument(String fpid) {
        return legacyArtifactSupport().getPatientFreeDocument(fpid);
    }
    
    public int updatePatientFreeDocument(PatientFreeDocumentModel update) {
        return legacyArtifactSupport().updatePatientFreeDocument(update);
    }
    /**
     * 紹介状を保存または更新する。
     * @param model
     * @return 
     */
    
    public long saveOrUpdateLetter(LetterModel model) {
        return legacyArtifactSupport().saveOrUpdateLetter(model);
    }

    /**
     * 紹介状のリストを取得する。
     * @param karteId
     * @param docType
     * @return 
     */
    
    public List<LetterModel> getLetterList(long karteId, String docType) {
        return legacyArtifactSupport().getLetterList(karteId, docType);
    }

    /**
     * 紹介状を取得する。
     * @param letterPk
     * @return 
     */
    
    public LetterModel getLetter(long letterPk) {
        return legacyArtifactSupport().getLetter(letterPk);
    }

    
    public LetterModel getLetterReply(long letterPk) {
        return legacyArtifactSupport().getLetterReply(letterPk);
    }

    public List<List<AppointmentModel>> getAppointmentList(long karteId, List fromDate, List toDate) {
        return legacyArtifactSupport().getAppointmentList(karteId, fromDate, toDate);
    }

    // 指定したEntityのModuleModleを一括取得
    @SuppressWarnings("unchecked")
    public List<ModuleModel> getModulesEntitySearch(String fid, long karteId, Date fromDate, Date toDate, List<String> entities) {
        return legacyArtifactSupport().getModulesEntitySearch(karteId, fromDate, toDate, entities);
    }

    public List<DocumentModel> getAllDocument(long patientPK) {
        return getAllDocument(patientPK, 0, KarteDocinfoPageSupport.DEFAULT_DOCINFO_PAGE_SIZE);
    }

    public List<DocumentModel> getAllDocument(long patientPK, int offset, int limit) {
        try {
            return docinfoPageSupport().loadAllDocuments(patientPK, offset, limit);
        } catch (NoResultException e) {
            // 患者登録の際にカルテも生成してある
            return new ArrayList<>();
        }
    }
    public AttachmentModel getAttachment(long pk) {
        return legacyArtifactSupport().getAttachment(pk);
    }

    public static int normalizeDocinfoOffset(int offset) {
        return KarteDocinfoPageSupport.normalizeOffset(offset);
    }

    public static int normalizeDocinfoPageSize(int limit) {
        return KarteDocinfoPageSupport.normalizePageSize(limit);
    }

    private List<DocumentModel> loadRevisionLightDocumentPage(List<Long> docIds) {
        // Docinfo list path: keep revision metadata only and leave binary fetch to dedicated APIs.
        List<DocumentModel> documents =
                documentBulkFetchSupport().loadDocuments(docIds, KarteDocumentBulkFetchSupport.DocumentLoadMode.REVISION_LIGHT);
        for (DocumentModel document : documents) {
            document.toDetuch();
        }
        return documents;
    }

    private List<DocumentModel> fetchDocumentsWithModules(List<Long> docIds) {
        return getDocumentsWithModules(docIds);
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

    private void verifyDocumentOnRead(DocumentModel document) {
        if (documentIntegrityService == null || document == null) {
            return;
        }
        documentIntegrityService.verifyDocumentOnRead(document);
    }

}
