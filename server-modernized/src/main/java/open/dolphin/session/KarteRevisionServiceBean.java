package open.dolphin.session;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocInfoModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.DocumentModelCloner;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.security.integrity.CanonicalJson;
import open.dolphin.rest.dto.KarteRevisionDiffResponse;
import open.dolphin.rest.dto.KarteRevisionEntryResponse;
import open.dolphin.rest.dto.KarteRevisionGroupResponse;
import open.dolphin.rest.dto.KarteRevisionHistoryResponse;
import open.dolphin.session.framework.SessionOperation;

/**
 * Phase1: append-only revision browsing for chart documents.
 *
 * Note: Phase1 is read-only API addition; it does not remove existing in-place update flows.
 */
@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class KarteRevisionServiceBean {

    private static final DateTimeFormatter ISO_INSTANT = DateTimeFormatter.ISO_INSTANT.withZone(ZoneOffset.UTC);

    private static final String PARAM_KARTE_ID = "karteId";
    private static final String PARAM_DOC_TYPE = "docType";
    private static final String PARAM_FROM = "fromDate";
    private static final String PARAM_TO = "toDate";

    private static final String QUERY_DOCUMENTS_BY_DATE =
            "from DocumentModel d where d.karte.id=:" + PARAM_KARTE_ID
                    + " and d.docInfo.docType=:" + PARAM_DOC_TYPE
                    + " and d.started >= :" + PARAM_FROM
                    + " and d.started < :" + PARAM_TO
                    + " and d.status != 'D'";

    @PersistenceContext
    private EntityManager em;

    @Inject
    private KarteServiceBean karteServiceBean;

    public String findFacilityIdByKarteId(long karteId) {
        return karteServiceBean.findFacilityIdByKarteId(karteId);
    }

    public String findFacilityIdByRevisionId(long revisionId) {
        return karteServiceBean.findFacilityIdByDocId(revisionId);
    }

    public KarteRevisionHistoryResponse getRevisionHistory(long karteId, LocalDate visitDate) {
        Objects.requireNonNull(visitDate, "visitDate");

        Date from = Date.from(visitDate.atStartOfDay().toInstant(ZoneOffset.UTC));
        Date toExclusive = Date.from(visitDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));

        List<DocumentModel> docs = em.createQuery(QUERY_DOCUMENTS_BY_DATE, DocumentModel.class)
                .setParameter(PARAM_KARTE_ID, karteId)
                .setParameter(PARAM_DOC_TYPE, IInfoModel.DOCTYPE_KARTE)
                .setParameter(PARAM_FROM, from)
                .setParameter(PARAM_TO, toExclusive)
                .getResultList();

        // Prepare in-memory lookup for root traversal (avoid extra finds for common case).
        Map<Long, DocumentModel> localById = docs.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(DocumentModel::getId, d -> d, (a, b) -> a));

        Map<Long, Long> rootCache = new HashMap<>();
        Map<Long, List<DocumentModel>> grouped = new HashMap<>();

        for (DocumentModel doc : docs) {
            if (doc == null) {
                continue;
            }
            long root = resolveRootRevisionId(doc.getId(), localById, rootCache);
            grouped.computeIfAbsent(root, ignored -> new ArrayList<>()).add(doc);
        }

        // Materialize response DTOs.
        List<GroupWithSortKey> groups = new ArrayList<>(grouped.size());
        for (Map.Entry<Long, List<DocumentModel>> entry : grouped.entrySet()) {
            long rootRevisionId = entry.getKey();
            List<DocumentModel> chain = entry.getValue();
            if (chain == null || chain.isEmpty()) {
                continue;
            }

            chain.sort(Comparator
                    .comparing(DocumentModel::getConfirmed, Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparingLong(DocumentModel::getId));

            DocumentModel latest = chain.stream()
                    .max(Comparator
                            .comparing(DocumentModel::getConfirmed, Comparator.nullsLast(Comparator.naturalOrder()))
                            .thenComparingLong(DocumentModel::getId))
                    .orElse(chain.get(chain.size() - 1));

            KarteRevisionGroupResponse group = new KarteRevisionGroupResponse();
            group.setRootRevisionId(rootRevisionId);
            group.setLatestRevisionId(latest != null ? latest.getId() : null);
            group.setKarteId(karteId);
            group.setVisitDate(visitDate.toString());

            List<KarteRevisionEntryResponse> items = new ArrayList<>(chain.size());
            for (DocumentModel doc : chain) {
                items.add(toEntry(doc, rootRevisionId));
            }
            group.setItems(items);

            Date sortKey = latest != null ? latest.getConfirmed() : null;
            groups.add(new GroupWithSortKey(group, sortKey));
        }

        groups.sort(Comparator.comparing(GroupWithSortKey::sortKey, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(g -> g.group.getRootRevisionId(), Comparator.nullsLast(Comparator.naturalOrder())));

        KarteRevisionHistoryResponse response = new KarteRevisionHistoryResponse();
        response.setKarteId(karteId);
        response.setVisitDate(visitDate.toString());
        response.setGroups(groups.stream().map(g -> g.group).collect(Collectors.toList()));
        return response;
    }

    /**
     * Returns a single revision snapshot as DocumentModel (modules/schema/attachments are loaded).
     */
    public DocumentModel getRevisionSnapshot(long revisionId) {
        if (revisionId <= 0) {
            return null;
        }
        List<DocumentModel> docs = karteServiceBean.getDocuments(List.of(revisionId));
        if (docs == null || docs.isEmpty()) {
            return null;
        }
        return docs.get(0);
    }

    public DocumentModel getRevisionSnapshotLight(long revisionId) {
        if (revisionId <= 0) {
            return null;
        }
        List<DocumentModel> docs = karteServiceBean.getDocumentsRevisionLight(List.of(revisionId));
        if (docs == null || docs.isEmpty()) {
            return null;
        }
        return docs.get(0);
    }

    /**
     * Phase2: create a new revision as an append-only snapshot, using an existing revision as the source.
     *
     * Parent revision is typically the current latest revision (baseRevisionId) for linear history.
     */
    public long createRevisionFromSource(long sourceRevisionId, long parentRevisionId, String operation) {
        if (sourceRevisionId <= 0 || parentRevisionId <= 0) {
            throw new IllegalArgumentException("sourceRevisionId and parentRevisionId are required");
        }
        DocumentModel source = getRevisionSnapshot(sourceRevisionId);
        if (source == null) {
            throw new IllegalArgumentException("Source revision not found: " + sourceRevisionId);
        }
        if (source.getKarteBean() == null || source.getUserModel() == null) {
            throw new IllegalArgumentException("Source revision missing required relations (karte/user)");
        }

        DocumentModel cloned = DocumentModelCloner.deepClone(source);
        if (cloned == null) {
            throw new IllegalStateException("Failed to clone source revision: " + sourceRevisionId);
        }

        Date started = source.getStarted() != null ? source.getStarted() : new Date();
        Date now = new Date();
        applyRevisionSnapshotMetadata(cloned, source, parentRevisionId, operation, started, now);
        rebindRevisionChildren(cloned, parentRevisionId, operation, started, now);
        syncRevisionDocInfo(cloned);
        return karteServiceBean.addDocument(cloned);
    }

    private void applyRevisionSnapshotMetadata(DocumentModel cloned, DocumentModel source, long parentRevisionId,
            String operation, Date started, Date now) {
        cloned.setId(0L);
        cloned.setKarteBean(source.getKarteBean());
        cloned.setUserModel(source.getUserModel());
        cloned.setStarted(started);
        cloned.setFirstConfirmed(started);
        cloned.setConfirmed(now);
        cloned.setRecorded(now);
        cloned.setEnded(null);
        cloned.setStatus(IInfoModel.STATUS_FINAL);
        cloned.setLinkId(parentRevisionId);
        cloned.setLinkRelation(operation);
        DocInfoModel info = cloned.getDocInfoModel();
        if (info == null) {
            return;
        }
        info.setDocPk(0L);
        info.setParentPk(parentRevisionId);
        info.setParentIdRelation(operation);
        info.setConfirmDate(now);
        info.setFirstConfirmDate(started);
        info.setStatus(IInfoModel.STATUS_FINAL);
        info.setDocId(UUID.randomUUID().toString().replace("-", ""));
    }

    private void rebindRevisionChildren(DocumentModel cloned, long parentRevisionId, String operation, Date started,
            Date now) {
        rebindModules(cloned.getModules(), cloned, parentRevisionId, operation, started, now);
        rebindSchema(cloned.getSchema(), cloned, parentRevisionId, operation, started, now);
        rebindAttachments(cloned.getAttachment(), cloned, parentRevisionId, operation, started, now);
    }

    private void rebindModules(List<ModuleModel> modules, DocumentModel cloned, long parentRevisionId,
            String operation, Date started, Date now) {
        if (modules == null) {
            return;
        }
        for (ModuleModel module : modules) {
            if (module == null) {
                continue;
            }
            module.setDocumentModel(cloned);
            module.setKarteBean(cloned.getKarteBean());
            module.setUserModel(cloned.getUserModel());
            module.setStarted(started);
            module.setFirstConfirmed(started);
            module.setConfirmed(now);
            module.setRecorded(now);
            module.setEnded(null);
            module.setStatus(IInfoModel.STATUS_FINAL);
            module.setLinkId(parentRevisionId);
            module.setLinkRelation(operation);
        }
    }

    private void rebindSchema(List<SchemaModel> schema, DocumentModel cloned, long parentRevisionId,
            String operation, Date started, Date now) {
        if (schema == null) {
            return;
        }
        for (SchemaModel image : schema) {
            if (image == null) {
                continue;
            }
            image.setDocumentModel(cloned);
            image.setKarteBean(cloned.getKarteBean());
            image.setUserModel(cloned.getUserModel());
            image.setStarted(started);
            image.setFirstConfirmed(started);
            image.setConfirmed(now);
            image.setRecorded(now);
            image.setEnded(null);
            image.setStatus(IInfoModel.STATUS_FINAL);
            image.setLinkId(parentRevisionId);
            image.setLinkRelation(operation);
        }
    }

    private void rebindAttachments(List<AttachmentModel> attachments, DocumentModel cloned, long parentRevisionId,
            String operation, Date started, Date now) {
        if (attachments == null) {
            return;
        }
        for (AttachmentModel attachment : attachments) {
            if (attachment == null) {
                continue;
            }
            attachment.setDocumentModel(cloned);
            attachment.setKarteBean(cloned.getKarteBean());
            attachment.setUserModel(cloned.getUserModel());
            attachment.setStarted(started);
            attachment.setFirstConfirmed(started);
            attachment.setConfirmed(now);
            attachment.setRecorded(now);
            attachment.setEnded(null);
            attachment.setStatus(IInfoModel.STATUS_FINAL);
            attachment.setLinkId(parentRevisionId);
            attachment.setLinkRelation(operation);
        }
    }

    private void syncRevisionDocInfo(DocumentModel cloned) {
        try {
            cloned.toPersist();
        } catch (Exception ignore) {
            // Best-effort: docInfo is mainly for client; persisted fields are already set above.
        }
    }

    public KarteRevisionDiffResponse diffRevisions(long fromRevisionId, long toRevisionId) {
        DocumentModel from = getRevisionSnapshot(fromRevisionId);
        DocumentModel to = getRevisionSnapshot(toRevisionId);
        if (from == null || to == null) {
            return null;
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        List<String> changedEntities = new ArrayList<>();

        Map<String, String> fromDigests = digestByEntity(from);
        Map<String, String> toDigests = digestByEntity(to);

        // Changed module entities
        for (String key : unionKeys(fromDigests, toDigests)) {
            String a = fromDigests.get(key);
            String b = toDigests.get(key);
            if (!Objects.equals(a, b)) {
                changedEntities.add(key);
            }
        }

        summary.put("from", Map.of(
                "revisionId", from.getId(),
                "confirmedAt", formatInstant(from.getConfirmed()),
                "status", from.getStatus()
        ));
        summary.put("to", Map.of(
                "revisionId", to.getId(),
                "confirmedAt", formatInstant(to.getConfirmed()),
                "status", to.getStatus()
        ));
        summary.put("moduleEntitiesFrom", new ArrayList<>(fromDigests.keySet()));
        summary.put("moduleEntitiesTo", new ArrayList<>(toDigests.keySet()));
        summary.put("changedEntitiesCount", changedEntities.size());

        KarteRevisionDiffResponse response = new KarteRevisionDiffResponse();
        response.setFromRevisionId(from.getId());
        response.setToRevisionId(to.getId());
        response.setSummary(summary);
        response.setChangedEntities(changedEntities);
        response.setGeneratedAt(java.time.Instant.now().toString());
        return response;
    }

    private Map<String, String> digestByEntity(DocumentModel doc) {
        // Best-effort digest using existing persisted payloads; do not mutate or require decode success.
        Map<String, MessageDigest> digesters = new LinkedHashMap<>();

        if (doc != null && doc.getModules() != null) {
            for (var module : doc.getModules()) {
                if (module == null || module.getModuleInfoBean() == null) {
                    continue;
                }
                String entity = module.getModuleInfoBean().getEntity();
                if (entity == null || entity.isBlank()) {
                    continue;
                }

                MessageDigest digester = digesters.computeIfAbsent(entity, ignored -> sha256());

                String payload = module.getBeanJson();
                if (payload != null) {
                    digester.update(CanonicalJson.canonicalBytes(payload));
                } else {
                    digester.update((byte) 0);
                }
                // Separator to avoid concatenation ambiguity.
                digester.update((byte) '\n');
            }
        }

        // Schema/Attachment: include metadata-only digest (do not load/compare raw bytes here).
        MessageDigest schemaDigest = sha256();
        if (doc != null) {
            List<SchemaModel> schema = doc.getSchema();
            if (schema != null) {
                for (SchemaModel image : schema) {
                    if (image == null) {
                        continue;
                    }
                    schemaDigest.update(utf8(Long.toString(image.getId())));
                    if (image.getExtRefModel() != null) {
                        schemaDigest.update(utf8(Objects.toString(image.getExtRefModel().getHref(), "")));
                        schemaDigest.update(utf8(Objects.toString(image.getExtRefModel().getTitle(), "")));
                        schemaDigest.update(utf8(Objects.toString(image.getExtRefModel().getContentType(), "")));
                    }
                    schemaDigest.update((byte) '\n');
                }
            }
        }
        digesters.put("schema", schemaDigest);

        MessageDigest attachmentDigest = sha256();
        if (doc != null) {
            List<AttachmentModel> attachments = doc.getAttachment();
            if (attachments != null) {
                for (AttachmentModel attachment : attachments) {
                    if (attachment == null) {
                        continue;
                    }
                    attachmentDigest.update(utf8(Long.toString(attachment.getId())));
                    attachmentDigest.update(utf8(Objects.toString(attachment.getFileName(), "")));
                    attachmentDigest.update(utf8(Objects.toString(attachment.getContentType(), "")));
                    attachmentDigest.update(utf8(Long.toString(attachment.getContentSize())));
                    attachmentDigest.update(utf8(Objects.toString(attachment.getDigest(), "")));
                    attachmentDigest.update((byte) '\n');
                }
            }
        }
        digesters.put("attachment", attachmentDigest);

        Map<String, String> digests = new LinkedHashMap<>();
        digesters.forEach((key, digester) -> digests.put(key, toHex(digester.digest())));
        return digests;
    }

    private static List<String> unionKeys(Map<String, ?> a, Map<String, ?> b) {
        Map<String, Boolean> keys = new LinkedHashMap<>();
        if (a != null) {
            a.keySet().forEach(k -> keys.put(k, Boolean.TRUE));
        }
        if (b != null) {
            b.keySet().forEach(k -> keys.put(k, Boolean.TRUE));
        }
        return new ArrayList<>(keys.keySet());
    }

    private KarteRevisionEntryResponse toEntry(DocumentModel doc, long rootRevisionId) {
        if (doc == null) {
            return null;
        }
        doc.toDetuch();

        KarteRevisionEntryResponse item = new KarteRevisionEntryResponse();
        item.setRevisionId(doc.getId());
        item.setParentRevisionId(doc.getLinkId() > 0 ? doc.getLinkId() : null);
        item.setRootRevisionId(rootRevisionId);
        item.setConfirmedAt(formatInstant(doc.getConfirmed()));
        item.setStartedAt(formatInstant(doc.getStarted()));
        item.setStatus(doc.getStatus());
        item.setDocType(doc.getDocInfoModel() != null ? doc.getDocInfoModel().getDocType() : null);
        item.setTitle(doc.getDocInfoModel() != null ? doc.getDocInfoModel().getTitle() : null);
        item.setCreatorUserId(doc.getUserModel() != null ? doc.getUserModel().getUserId() : null);
        return item;
    }

    private String formatInstant(Date date) {
        if (date == null) {
            return null;
        }
        return ISO_INSTANT.format(date.toInstant());
    }

    private long resolveRootRevisionId(long revisionId, Map<Long, DocumentModel> localById, Map<Long, Long> cache) {
        Long cached = cache.get(revisionId);
        if (cached != null) {
            return cached;
        }

        List<Long> visited = new ArrayList<>();
        long current = revisionId;

        while (true) {
            Long currentCached = cache.get(current);
            if (currentCached != null) {
                current = currentCached;
                break;
            }
            visited.add(current);

            DocumentModel doc = localById != null ? localById.get(current) : null;
            if (doc == null) {
                doc = em.find(DocumentModel.class, current);
            }
            if (doc == null) {
                break;
            }
            long parent = doc.getLinkId();
            if (parent <= 0) {
                break;
            }
            current = parent;
        }

        long root = current;
        for (Long id : visited) {
            cache.put(id, root);
        }
        return root;
    }

    private record GroupWithSortKey(KarteRevisionGroupResponse group, Date sortKey) {}

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Missing SHA-256 implementation", e);
        }
    }

    private static byte[] utf8(String value) {
        return value == null ? new byte[0] : value.getBytes(StandardCharsets.UTF_8);
    }

    private static String toHex(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
