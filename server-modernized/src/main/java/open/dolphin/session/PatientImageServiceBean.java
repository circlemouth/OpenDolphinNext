package open.dolphin.session;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.io.ByteArrayInputStream;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.PatientImageEntryResponse;
import open.dolphin.session.framework.SessionOperation;
import open.dolphin.storage.attachment.AttachmentStorageManager;
import open.dolphin.storage.attachment.AttachmentStorageMode;

@Named
@ApplicationScoped
@Transactional
@SessionOperation
public class PatientImageServiceBean {

    /**
     * Marker to avoid mixing with legacy chart attachments; list/download only returns attachments created by PhaseA.
     */
    public static final String LINK_RELATION_PATIENT_IMAGE_PHASEA = "patient_image_phaseA";

    private static final DateTimeFormatter ISO_INSTANT = DateTimeFormatter.ISO_INSTANT.withZone(ZoneOffset.UTC);

    @PersistenceContext
    private EntityManager em;

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private AttachmentStorageManager attachmentStorageManager;

    public UploadResult uploadImage(String facilityId,
                                    String patientId,
                                    String actorUserId,
                                    String fileName,
                                    String contentType,
                                    byte[] bytes) {
        Objects.requireNonNull(facilityId, "facilityId");
        Objects.requireNonNull(patientId, "patientId");
        Objects.requireNonNull(actorUserId, "actorUserId");
        Objects.requireNonNull(fileName, "fileName");
        Objects.requireNonNull(contentType, "contentType");
        Objects.requireNonNull(bytes, "bytes");

        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            throw new IllegalArgumentException("Patient not found: " + patientId);
        }
        KarteBean karte = patientServiceBean.ensureKarteByPatientPk(patient.getId());
        if (karte == null) {
            throw new IllegalStateException("Karte not available for patientPk=" + patient.getId());
        }
        UserModel actor = userServiceBean.getUser(actorUserId);

        Date now = new Date();

        DocumentModel document = new DocumentModel();
        // d_document.docInfo has NOT NULL constraints (docId/title/purpose). Set them explicitly.
        document.getDocInfoModel().setDocId(UUID.randomUUID().toString().replace("-", ""));
        document.getDocInfoModel().setTitle("Image upload (PhaseA)");
        document.getDocInfoModel().setPurpose(IInfoModel.PURPOSE_RECORD);
        document.getDocInfoModel().setParentPk(0L);
        document.getDocInfoModel().setStatus(IInfoModel.STATUS_FINAL);
        document.setKarteBean(karte);
        document.setUserModel(actor);
        document.setStarted(now);
        document.setFirstConfirmed(now);
        document.setConfirmed(now);
        document.setRecorded(now);
        document.setEnded(null);
        document.setStatus(IInfoModel.STATUS_FINAL);
        document.setLinkId(0L);
        document.setLinkRelation(LINK_RELATION_PATIENT_IMAGE_PHASEA);

        AttachmentModel attachment = new AttachmentModel();
        attachment.setFileName(fileName);
        attachment.setContentType(contentType);
        attachment.setContentSize(bytes.length);
        attachment.setLastModified(now.getTime());
        attachment.setTitle(fileName);
        attachment.setStatus(IInfoModel.STATUS_FINAL);
        attachment.setStarted(now);
        attachment.setFirstConfirmed(now);
        attachment.setConfirmed(now);
        attachment.setRecorded(now);
        attachment.setEnded(null);
        attachment.setLinkId(0L);
        attachment.setLinkRelation(LINK_RELATION_PATIENT_IMAGE_PHASEA);
        attachment.setUserModel(actor);
        attachment.setKarteBean(karte);
        attachment.setDocumentModel(document);
        AttachmentStorageMode storageMode = attachmentStorageManager != null ? attachmentStorageManager.getMode() : null;
        boolean externalizedBeforePersist = false;
        if (storageMode != null && storageMode.isS3()) {
            try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
                externalizedBeforePersist = attachmentStorageManager.prepareExternalAssetForPersist(
                        attachment,
                        in,
                        bytes.length);
            } catch (Exception ex) {
                throw new IllegalStateException("Failed to externalize patient image before persist", ex);
            }
        }
        if (!externalizedBeforePersist) {
            attachment.setContentBytes(bytes);
            attachment.setDigest(sha256Hex(bytes));
        }
        document.addAttachment(attachment);

        long documentId = karteServiceBean.addDocument(document);
        long attachmentId = attachment.getId();
        if (attachmentId <= 0) {
            throw new IllegalStateException("Failed to resolve created attachment id for documentId=" + documentId);
        }

        return new UploadResult(documentId, attachmentId, now);
    }

    public List<PatientImageEntryResponse> listImages(String facilityId, String patientId) {
        Objects.requireNonNull(facilityId, "facilityId");
        Objects.requireNonNull(patientId, "patientId");

        List<Object[]> rows = em.createQuery(
                        "select a.id, a.fileName, a.contentType, a.contentSize, a.confirmed, a.recorded " +
                                "from AttachmentModel a " +
                                "where a.document.karte.patient.facilityId=:fid " +
                                "and a.document.karte.patient.patientId=:pid " +
                                "and a.linkRelation=:rel " +
                                "and a.status != 'D' " +
                                "order by a.id desc",
                        Object[].class)
                .setParameter("fid", facilityId)
                .setParameter("pid", patientId)
                .setParameter("rel", LINK_RELATION_PATIENT_IMAGE_PHASEA)
                .getResultList();

        List<PatientImageEntryResponse> result = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            if (row == null || row.length < 6) {
                continue;
            }
            PatientImageEntryResponse entry = new PatientImageEntryResponse();
            entry.setImageId(row[0] instanceof Number value ? value.longValue() : 0L);
            entry.setFileName(row[1] != null ? row[1].toString() : null);
            entry.setContentType(row[2] != null ? row[2].toString() : null);
            entry.setSize(row[3] instanceof Number value ? value.longValue() : 0L);
            Date confirmed = row[4] instanceof Date value ? value : null;
            Date recorded = row[5] instanceof Date value ? value : null;
            entry.setCreatedAt(formatInstant(confirmed != null ? confirmed : recorded));
            result.add(entry);
        }
        return result;
    }

    public DownloadHandle getImageForDownload(String facilityId, String patientId, long imageId) {
        Objects.requireNonNull(facilityId, "facilityId");
        Objects.requireNonNull(patientId, "patientId");
        if (imageId <= 0) {
            return null;
        }
        try {
            Object[] row = em.createQuery(
                            "select a.id, a.fileName, a.contentType, a.contentSize, a.uri, a.digest, a.contentBytes " +
                                    "from AttachmentModel a " +
                                    "where a.id=:id " +
                                    "and a.document.karte.patient.facilityId=:fid " +
                                    "and a.document.karte.patient.patientId=:pid " +
                                    "and a.linkRelation=:rel",
                            Object[].class)
                    .setParameter("id", imageId)
                    .setParameter("fid", facilityId)
                    .setParameter("pid", patientId)
                    .setParameter("rel", LINK_RELATION_PATIENT_IMAGE_PHASEA)
                    .getSingleResult();
            return toDownloadHandle(row);
        } catch (NoResultException ex) {
            return null;
        }
    }

    private String formatInstant(Date date) {
        if (date == null) {
            return null;
        }
        return ISO_INSTANT.format(date.toInstant());
    }

    private String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to calculate attachment digest", ex);
        }
    }

    private DownloadHandle toDownloadHandle(Object[] row) {
        if (row == null || row.length < 7) {
            return null;
        }
        long attachmentId = row[0] instanceof Number value ? value.longValue() : 0L;
        String fileName = row[1] != null ? row[1].toString() : null;
        String contentType = row[2] != null ? row[2].toString() : null;
        long contentSize = row[3] instanceof Number value ? value.longValue() : 0L;
        String uri = row[4] != null ? row[4].toString() : null;
        String digest = row[5] != null ? row[5].toString() : null;
        byte[] contentBytes = row[6] instanceof byte[] value ? value : null;
        return new DownloadHandle(attachmentId, fileName, contentType, contentSize, uri, digest, contentBytes);
    }

    public record DownloadHandle(long attachmentId,
                                 String fileName,
                                 String contentType,
                                 long contentSize,
                                 String uri,
                                 String digest,
                                 byte[] contentBytes) {}

    public record UploadResult(long documentId, long attachmentId, Date createdAt) {}
}
