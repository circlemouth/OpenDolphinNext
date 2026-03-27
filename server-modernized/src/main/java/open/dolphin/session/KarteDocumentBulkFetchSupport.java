package open.dolphin.session;

import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.ExtRefModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.persistence.query.KarteDocumentQueryService;

final class KarteDocumentBulkFetchSupport {

    private static final String QUERY_SCHEMAS_BY_DOC_IDS =
            "select i from SchemaModel i left join fetch i.karte left join fetch i.creator "
                    + "where i.document.id in :ids order by i.document.id, i.id";
    private static final String QUERY_ATTACHMENTS_BY_DOC_IDS =
            "select a from AttachmentModel a left join fetch a.karte left join fetch a.creator "
                    + "where a.document.id in :ids order by a.document.id, a.id";
    private static final String QUERY_SCHEMA_METADATA_BY_DOC_IDS =
            "select i.id, i.confirmed, i.started, i.ended, i.recorded, i.linkId, i.linkRelation, i.status, "
                    + "i.creator, i.karte, i.document.id, i.extRef, i.uri, i.digest "
                    + "from SchemaModel i where i.document.id in :ids order by i.document.id, i.id";
    private static final String QUERY_ATTACHMENT_METADATA_BY_DOC_IDS =
            "select a.id, a.confirmed, a.started, a.ended, a.recorded, a.linkId, a.linkRelation, a.status, "
                    + "a.creator, a.karte, a.document.id, a.fileName, a.contentType, a.contentSize, a.lastModified, "
                    + "a.digest, a.title, a.uri, a.extension, a.memo "
                    + "from AttachmentModel a where a.document.id in :ids order by a.document.id, a.id";

    private final EntityManager em;
    private final KarteDocumentQueryService queryService;
    private final Consumer<Collection<ModuleModel>> moduleDecoder;

    KarteDocumentBulkFetchSupport(EntityManager em, Consumer<Collection<ModuleModel>> moduleDecoder) {
        this.em = em;
        this.queryService = new KarteDocumentQueryService(() -> em);
        this.moduleDecoder = moduleDecoder;
    }

    List<DocumentModel> loadDocuments(List<Long> ids, DocumentLoadMode mode) {
        List<Long> orderedIds = normalizeDocumentIds(ids);
        if (orderedIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<DocumentModel> documents = queryService.findDocumentsByIds(orderedIds);
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
        List<ModuleModel> modules = queryService.findModulesByDocumentIds(orderedIds);
        Map<Long, List<ModuleModel>> grouped = new LinkedHashMap<>();
        for (ModuleModel module : modules) {
            if (module == null || module.getDocumentModel() == null) {
                continue;
            }
            grouped.computeIfAbsent(module.getDocumentModel().getId(), ignored -> new ArrayList<>()).add(module);
        }
        for (Long docId : orderedIds) {
            DocumentModel document = documentById.get(docId);
            if (document == null) {
                continue;
            }
            List<ModuleModel> related = new ArrayList<>(grouped.getOrDefault(docId, List.of()));
            moduleDecoder.accept(related);
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
            grouped.computeIfAbsent(schema.getDocumentModel().getId(), ignored -> new ArrayList<>()).add(schema);
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
            grouped.computeIfAbsent(schema.getDocumentModel().getId(), ignored -> new ArrayList<>()).add(schema);
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
            grouped.computeIfAbsent(attachment.getDocumentModel().getId(), ignored -> new ArrayList<>()).add(attachment);
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
            grouped.computeIfAbsent(attachment.getDocumentModel().getId(), ignored -> new ArrayList<>()).add(attachment);
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
        schema.setConfirmed((java.util.Date) row[1]);
        schema.setStarted((java.util.Date) row[2]);
        schema.setEnded((java.util.Date) row[3]);
        schema.setRecorded((java.util.Date) row[4]);
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
        attachment.setConfirmed((java.util.Date) row[1]);
        attachment.setStarted((java.util.Date) row[2]);
        attachment.setEnded((java.util.Date) row[3]);
        attachment.setRecorded((java.util.Date) row[4]);
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

    enum DocumentLoadMode {
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
}
