package open.dolphin.session;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.KarteEntryBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.rest.AbstractResource;
import open.dolphin.security.integrity.DocumentIntegrityService;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.image.ImageStorageManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@ApplicationScoped
@Transactional
public class KarteDocumentWriteService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KarteDocumentWriteService.class);

    private static final String FINALIZED_UPDATE_DENIED_ERROR_CODE = "karte.document.finalized_update_denied";
    private static final String ID = "id";

    private static final String QUERY_MARK_DOCUMENT_MODIFIED =
            "update DocumentModel d set d.ended=:ended, d.status=:status where d.id=:id";
    private static final String QUERY_MARK_MODULES_MODIFIED =
            "update ModuleModel m set m.ended=:ended, m.status=:status where m.document.id=:id";
    private static final String QUERY_MARK_SCHEMAS_MODIFIED =
            "update SchemaModel s set s.ended=:ended, s.status=:status where s.document.id=:id";
    private static final String QUERY_MARK_ATTACHMENTS_MODIFIED =
            "update AttachmentModel a set a.ended=:ended, a.status=:status where a.document.id=:id";
    private static final String QUERY_DOCUMENT_BY_LINK_ID = "from DocumentModel d where d.linkId=:id";
    private static final String QUERY_MODULE_BY_DOC_ID = "from ModuleModel m where m.document.id=:id order by m.id";
    private static final String QUERY_SCHEMA_BY_DOC_ID = "from SchemaModel i where i.document.id=:id order by i.id";
    private static final String QUERY_ATTACHMENT_BY_DOC_ID = "from AttachmentModel a where a.document.id=:id order by a.id";
    private static final String SYNC_HIBERNATE_SEQUENCE_SQL = """
            DO $$
            DECLARE
                row_info RECORD;
                table_max BIGINT;
                max_id BIGINT DEFAULT 1;
            BEGIN
                FOR row_info IN
                    SELECT table_schema, table_name
                      FROM information_schema.columns
                     WHERE table_schema = 'opendolphin'
                       AND column_name = 'id'
                       AND column_default LIKE '%hibernate_sequence%'
                     ORDER BY table_schema, table_name
                LOOP
                    EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I.%I', row_info.table_schema, row_info.table_name)
                       INTO table_max;
                    max_id = GREATEST(max_id, table_max);
                END LOOP;

                IF max_id > 1 THEN
                    PERFORM setval('opendolphin.hibernate_sequence', max_id, true);
                END IF;
            END $$;
            """;

    @PersistenceContext
    private EntityManager em;

    @jakarta.inject.Inject
    private AttachmentStorageManager attachmentStorageManager;

    @jakarta.inject.Inject
    private ImageStorageManager imageStorageManager;

    @jakarta.inject.Inject
    private DocumentIntegrityService documentIntegrityService;

    private volatile boolean hibernateSequenceSynchronized;

    public long addDocument(DocumentModel document) {
        LOGGER.info("addDocument request id={}, docId={}",
                document.getId(),
                document.getDocInfoModel() != null ? document.getDocInfoModel().getDocId() : "null");

        synchronizeHibernateSequenceBeforeInsert();
        prepareDocumentForInsert(document);
        em.persist(document);
        em.flush();
        finalizePersistedDocument(document);
        sealDocument(document);

        long id = document.getId();
        long parentPk = document.getDocInfoModel().getParentPk();
        if (parentPk != 0L) {
            markRevisionSourceAsModified(parentPk, document.getConfirmed());
        }
        return id;
    }

    private void synchronizeHibernateSequenceBeforeInsert() {
        if (hibernateSequenceSynchronized) {
            return;
        }
        synchronized (this) {
            if (hibernateSequenceSynchronized) {
                return;
            }
            em.createNativeQuery(SYNC_HIBERNATE_SEQUENCE_SQL).executeUpdate();
            hibernateSequenceSynchronized = true;
        }
    }

    public long updateDocument(DocumentModel document) {
        if (document.getId() <= 0) {
            throw new IllegalArgumentException("Document id is required for update");
        }

        DocumentModel current = em.find(DocumentModel.class, document.getId());
        if (current == null) {
            throw new IllegalArgumentException("Document not found: " + document.getId());
        }

        String currentStatus = normalizeStatus(current.getStatus());
        String requestedStatus = resolveRequestedStatus(document);
        if (!IInfoModel.STATUS_TMP.equals(currentStatus)) {
            throw finalizedUpdateDenied(document.getId(), currentStatus, requestedStatus);
        }
        if (requestedStatus != null
                && !IInfoModel.STATUS_TMP.equals(requestedStatus)
                && !IInfoModel.STATUS_FINAL.equals(requestedStatus)) {
            throw finalizedUpdateDenied(document.getId(), currentStatus, requestedStatus);
        }

        removeMissingModules(current.getModules(), document.getModules());
        removeMissingSchemas(current.getSchema(), document.getSchema());
        removeMissingAttachments(current.getAttachment(), document.getAttachment());

        DocumentModel merged = em.merge(document);
        em.flush();
        finalizePersistedDocument(merged);
        sealDocument(merged);
        return merged.getId();
    }

    public List<String> deleteDocument(long id) {
        Collection<?> refs = em.createQuery(QUERY_DOCUMENT_BY_LINK_ID)
                .setParameter(ID, id)
                .getResultList();
        if (refs != null && !refs.isEmpty()) {
            throw new CanNotDeleteException("他のドキュメントから参照されているため削除できません。");
        }

        Date ended = new Date();
        List<String> list = new ArrayList<>();

        while (true) {
            try {
                DocumentModel delete = em.find(DocumentModel.class, id);
                delete.setStatus(IInfoModel.STATUS_DELETE);
                delete.setEnded(ended);
                list.add(delete.getDocInfoModel().getDocId());

                Collection<?> deleteModules = em.createQuery(QUERY_MODULE_BY_DOC_ID)
                        .setParameter(ID, id)
                        .getResultList();
                for (Object obj : deleteModules) {
                    ModuleModel model = (ModuleModel) obj;
                    model.setStatus(IInfoModel.STATUS_DELETE);
                    model.setEnded(ended);
                }

                Collection<?> deleteImages = em.createQuery(QUERY_SCHEMA_BY_DOC_ID)
                        .setParameter(ID, id)
                        .getResultList();
                for (Object obj : deleteImages) {
                    SchemaModel model = (SchemaModel) obj;
                    model.setStatus(IInfoModel.STATUS_DELETE);
                    model.setEnded(ended);
                    imageStorageManager.scheduleDeleteExternalAssetAfterCommit(model);
                }

                Collection<?> deleteAttachments = em.createQuery(QUERY_ATTACHMENT_BY_DOC_ID)
                        .setParameter(ID, id)
                        .getResultList();
                for (Object obj : deleteAttachments) {
                    AttachmentModel model = (AttachmentModel) obj;
                    model.setStatus(IInfoModel.STATUS_DELETE);
                    model.setEnded(ended);
                    attachmentStorageManager.scheduleDeleteExternalAssetAfterCommit(model);
                }

                id = delete.getLinkId();
            } catch (RuntimeException e) {
                break;
            }
        }

        return list;
    }

    public int updateTitle(long pk, String title) {
        DocumentModel update = em.find(DocumentModel.class, pk);
        if (update == null) {
            throw new IllegalArgumentException("Document not found: " + pk);
        }
        String currentStatus = normalizeStatus(update.getStatus());
        if (!IInfoModel.STATUS_TMP.equals(currentStatus)) {
            throw finalizedUpdateDenied(pk, currentStatus, currentStatus);
        }
        update.getDocInfoModel().setTitle(title);
        return 1;
    }

    private void prepareDocumentForInsert(DocumentModel document) {
        if (document == null) {
            return;
        }
        synchronizeDocumentGraph(document);
        encodeModulePayloads(document.getModules());
        validateExternalAssetContracts(document);
    }

    private void finalizePersistedDocument(DocumentModel document) {
        if (document == null) {
            return;
        }
        if (document.getDocInfoModel() != null) {
            document.getDocInfoModel().setDocPk(document.getId());
        }
        synchronizeDocumentGraph(document);
        em.flush();
    }

    private void synchronizeDocumentGraph(DocumentModel document) {
        if (document == null) {
            return;
        }
        KarteBean karte = document.getKarteBean();
        UserModel creator = document.getUserModel();
        Date started = document.getStarted();
        Date confirmed = document.getConfirmed();
        Date recorded = document.getRecorded();
        String status = document.getStatus();

        synchronizeEntryCollection(document.getModules(), document, karte, creator, started, confirmed, recorded, status);
        synchronizeEntryCollection(document.getSchema(), document, karte, creator, started, confirmed, recorded, status);
        synchronizeEntryCollection(document.getAttachment(), document, karte, creator, started, confirmed, recorded, status);
    }

    private <T extends KarteEntryBean> void synchronizeEntryCollection(Collection<T> entries, DocumentModel document,
            KarteBean karte, UserModel creator, Date started, Date confirmed, Date recorded, String status) {
        if (entries == null) {
            return;
        }
        for (T entry : entries) {
            if (entry == null) {
                continue;
            }
            if (entry instanceof ModuleModel module) {
                module.setDocumentModel(document);
            } else if (entry instanceof SchemaModel schema) {
                schema.setDocumentModel(document);
            } else if (entry instanceof AttachmentModel attachment) {
                attachment.setDocumentModel(document);
            }
            if (entry.getKarteBean() == null) {
                entry.setKarteBean(karte);
            }
            if (entry.getUserModel() == null) {
                entry.setUserModel(creator);
            }
            if (entry.getStarted() == null) {
                entry.setStarted(started);
            }
            if (entry.getConfirmed() == null) {
                entry.setConfirmed(confirmed);
            }
            if (entry.getRecorded() == null) {
                entry.setRecorded(recorded);
            }
            if (entry.getStatus() == null) {
                entry.setStatus(status);
            }
        }
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
            if (json == null || json.trim().isEmpty()) {
                throw new IllegalStateException("Failed to encode module payload as JSON: moduleId=" + module.getId());
            }
            module.setBeanJson(json);
        }
    }

    private void sealDocument(DocumentModel document) {
        if (documentIntegrityService == null || document == null) {
            return;
        }
        documentIntegrityService.sealDocument(document);
    }

    private String resolveRequestedStatus(DocumentModel document) {
        if (document == null) {
            return null;
        }
        String status = normalizeStatus(document.getStatus());
        if (status != null) {
            return status;
        }
        DocInfoModel info = document.getDocInfoModel();
        return info != null ? normalizeStatus(info.getStatus()) : null;
    }

    private String normalizeStatus(String status) {
        if (status == null) {
            return null;
        }
        String trimmed = status.trim();
        return trimmed.isEmpty() ? null : trimmed.toUpperCase(java.util.Locale.ROOT);
    }

    private void validateExternalAssetContracts(DocumentModel document) {
        validateAttachments(document != null ? document.getAttachment() : null);
        validateSchemas(document != null ? document.getSchema() : null);
    }

    private void validateAttachments(Collection<AttachmentModel> attachments) {
        if (attachments == null) {
            return;
        }
        for (AttachmentModel attachment : attachments) {
            if (attachment == null) {
                continue;
            }
            if (!hasText(attachment.getUri()) || !hasText(attachment.getDigest())) {
                throw new IllegalStateException("Attachment must be externalized before persist: attachmentId="
                        + attachment.getId());
            }
            if (attachment.getContentBytes() != null && attachment.getContentBytes().length > 0) {
                throw new IllegalStateException("Attachment inline bytes are not accepted for persist: attachmentId="
                        + attachment.getId());
            }
        }
    }

    private void validateSchemas(Collection<SchemaModel> schemas) {
        if (schemas == null) {
            return;
        }
        for (SchemaModel schema : schemas) {
            if (schema == null) {
                continue;
            }
            if (!hasText(schema.getUri()) || !hasText(schema.getDigest())) {
                throw new IllegalStateException("Schema image must be externalized before persist: schemaId="
                        + schema.getId());
            }
            if (schema.getImageBytes() != null && schema.getImageBytes().length > 0) {
                throw new IllegalStateException("Schema inline bytes are not accepted for persist: schemaId="
                        + schema.getId());
            }
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void markRevisionSourceAsModified(long parentPk, Date ended) {
        if (parentPk <= 0L) {
            return;
        }
        String modifiedStatus = IInfoModel.STATUS_MODIFIED;
        executeRevisionBulkUpdate(QUERY_MARK_DOCUMENT_MODIFIED, parentPk, ended, modifiedStatus);
        executeRevisionBulkUpdate(QUERY_MARK_MODULES_MODIFIED, parentPk, ended, modifiedStatus);
        executeRevisionBulkUpdate(QUERY_MARK_SCHEMAS_MODIFIED, parentPk, ended, modifiedStatus);
        executeRevisionBulkUpdate(QUERY_MARK_ATTACHMENTS_MODIFIED, parentPk, ended, modifiedStatus);
    }

    private void executeRevisionBulkUpdate(String query, long documentId, Date ended, String status) {
        em.createQuery(query)
                .setParameter(ID, documentId)
                .setParameter("ended", ended)
                .setParameter("status", status)
                .executeUpdate();
    }

    private WebApplicationException finalizedUpdateDenied(long documentId,
                                                          String currentStatus,
                                                          String requestedStatus) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("documentId", documentId);
        details.put("currentStatus", currentStatus);
        details.put("requestedStatus", requestedStatus);

        return AbstractResource.restError(
                null,
                Response.Status.CONFLICT,
                FINALIZED_UPDATE_DENIED_ERROR_CODE,
                "Finalized document update is denied.",
                details,
                null
        );
    }

    private void removeMissingModules(List<ModuleModel> existing, List<ModuleModel> incoming) {
        removeMissingChildren(existing, incoming, module -> em.remove(em.contains(module) ? module : em.merge(module)));
    }

    private void removeMissingSchemas(List<SchemaModel> existing, List<SchemaModel> incoming) {
        removeMissingChildren(existing, incoming, schema -> {
            imageStorageManager.scheduleDeleteExternalAssetAfterCommit(schema);
            em.remove(em.contains(schema) ? schema : em.merge(schema));
        });
    }

    private void removeMissingAttachments(List<AttachmentModel> existing, List<AttachmentModel> incoming) {
        removeMissingChildren(existing, incoming, attachment -> {
            attachmentStorageManager.scheduleDeleteExternalAssetAfterCommit(attachment);
            em.remove(em.contains(attachment) ? attachment : em.merge(attachment));
        });
    }

    private <T extends KarteEntryBean> void removeMissingChildren(List<T> existing,
                                                                   List<T> incoming,
                                                                   Consumer<T> remover) {
        if (existing == null || existing.isEmpty()) {
            return;
        }
        Set<Long> incomingIds = collectIncomingIds(incoming);
        List<T> snapshot = new ArrayList<>(existing);
        for (T child : snapshot) {
            long childId = child.getId();
            boolean shouldRemove = childId > 0 && (incomingIds.isEmpty() || !incomingIds.contains(childId));
            if (shouldRemove) {
                remover.accept(child);
                existing.remove(child);
            }
        }
    }

    private <T extends KarteEntryBean> Set<Long> collectIncomingIds(List<T> incoming) {
        if (incoming == null || incoming.isEmpty()) {
            return java.util.Collections.emptySet();
        }
        Set<Long> ids = new HashSet<>();
        for (T child : incoming) {
            if (child != null && child.getId() > 0) {
                ids.add(child.getId());
            }
        }
        return ids;
    }
}
