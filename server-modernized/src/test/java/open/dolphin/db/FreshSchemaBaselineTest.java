package open.dolphin.db;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import javax.sql.DataSource;
import open.dolphin.infomodel.AppointmentModel;
import open.dolphin.infomodel.AttachmentModel;
import open.dolphin.infomodel.AuditEvent;
import open.dolphin.infomodel.ChartDocumentModel;
import open.dolphin.infomodel.ChartRevisionEventModel;
import open.dolphin.infomodel.ChartRevisionModel;
import open.dolphin.infomodel.ChartRevisionStatus;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.FacilityModel;
import open.dolphin.infomodel.Factor2BackupKey;
import open.dolphin.infomodel.Factor2Challenge;
import open.dolphin.infomodel.Factor2Code;
import open.dolphin.infomodel.Factor2Credential;
import open.dolphin.infomodel.Factor2Device;
import open.dolphin.infomodel.FirstEncounterModel;
import open.dolphin.infomodel.HealthInsuranceModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.LetterDate;
import open.dolphin.infomodel.LetterItem;
import open.dolphin.infomodel.LetterModel;
import open.dolphin.infomodel.LetterModule;
import open.dolphin.infomodel.LetterText;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.NLaboItem;
import open.dolphin.infomodel.NLaboModule;
import open.dolphin.infomodel.NurseProgressCourseModel;
import open.dolphin.infomodel.ObservationModel;
import open.dolphin.infomodel.OndobanModel;
import open.dolphin.infomodel.PatientFreeDocumentModel;
import open.dolphin.infomodel.PatientMemoModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.PatientVisitModel;
import open.dolphin.infomodel.PublishedTreeModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.RoleModel;
import open.dolphin.infomodel.SchemaModel;
import open.dolphin.infomodel.StampModel;
import open.dolphin.infomodel.StampTreeModel;
import open.dolphin.infomodel.SubscribedTreeModel;
import open.dolphin.infomodel.UserAccessProfile;
import open.dolphin.infomodel.UserModel;
import open.dolphin.infomodel.VitalModel;
import open.dolphin.security.integrity.DocumentIntegrityEntity;
import org.flywaydb.core.Flyway;
import org.hibernate.SessionFactory;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.cfg.AvailableSettings;
import org.junit.jupiter.api.Test;

class FreshSchemaBaselineTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void emptyDatabaseCanMigrateAndBootstrapAgainstFreshBaseline() throws Exception {
        try (EmbeddedPostgres postgres = EmbeddedPostgres.builder().start()) {
            DataSource dataSource = postgres.getPostgresDatabase();
            long nextUserId;
            long patientPk;
            long kartePk;
            long insurancePk;
            long documentPk;
            long modulePk;
            long schemaPk;
            long attachmentPk;

            Flyway flyway = Flyway.configure()
                    .dataSource(dataSource)
                    .defaultSchema("opendolphin")
                    .schemas("opendolphin")
                    .locations("classpath:db/migration")
                    .load();
            flyway.migrate();

            try (Connection connection = dataSource.getConnection()) {
                assertEquals("0318", appliedVersion(connection));
                assertTrue(tableExists(connection, "opendolphin", "d_module"));
                assertTrue(tableExists(connection, "opendolphin", "d_health_insurance"));
                assertTrue(tableExists(connection, "opendolphin", "d_attachment"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_user_link"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_patient_sync_state"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_push_state"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_push_seen_event"));
                assertTrue(tableExists(connection, "opendolphin", "schedule_projection"));
                assertTrue(tableExists(connection, "opendolphin", "encounter_projection"));
                assertTrue(tableExists(connection, "opendolphin", "encounter_transition_log"));
                assertTrue(tableExists(connection, "opendolphin", "reconciliation_task"));
                assertTrue(tableExists(connection, "opendolphin", "encounter_patient_snapshot"));
                assertTrue(tableExists(connection, "opendolphin", "encounter_insurance_snapshot"));
                assertTrue(tableExists(connection, "opendolphin", "orca_job_schedule"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_sync_cursor"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_sync_run"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_push_event_inbox"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_push_cursor"));
                assertTrue(tableExists(connection, "opendolphin", "d_orca_push_connection_state"));
                assertTrue(tableExists(connection, "opendolphin", "d_billing_orca_snapshot"));
                assertTrue(tableExists(connection, "opendolphin", "d_billing_orca_transmission"));
                assertTrue(tableExists(connection, "opendolphin", "d_diagnosis_entry"));
                assertTrue(tableExists(connection, "opendolphin", "d_diagnosis_component"));
                assertTrue(tableExists(connection, "opendolphin", "d_diagnosis_supplement"));
                assertTrue(tableExists(connection, "opendolphin", "d_diagnosis_orca_sync_log"));
                assertTrue(tableExists(connection, "opendolphin", "orca_disease_cache"));
                assertTrue(tableExists(connection, "opendolphin", "orca_disease_snapshot"));
                assertTrue(tableExists(connection, "opendolphin", "orca_disease_operation"));
                assertTrue(tableExists(connection, "opendolphin", "orca_disease_audit_event"));
                assertTrue(tableExists(connection, "opendolphin", "orca_patient_cache"));
                assertTrue(tableExists(connection, "opendolphin", "chart_document"));
                assertTrue(tableExists(connection, "opendolphin", "chart_revision"));
                assertTrue(tableExists(connection, "opendolphin", "chart_revision_event"));
                assertTrue(tableExists(connection, "opendolphin", "user_security_state"));
                assertTrue(tableExists(connection, "opendolphin", "auth_session_registry"));
                assertTrue(tableExists(connection, "opendolphin", "audit_event"));
                assertTrue(tableExists(connection, "opendolphin", "audit_chain_head"));
                assertTrue(tableExists(connection, "opendolphin", "audit_export_outbox"));
                assertTrue(tableExists(connection, "opendolphin", "prescription_order"));
                assertTrue(tableExists(connection, "opendolphin", "prescription_order_revision"));
                assertTrue(tableExists(connection, "opendolphin", "prescription_order_item"));
                assertTrue(tableExists(connection, "opendolphin", "prescription_order_event"));
                assertTrue(tableExists(connection, "opendolphin", "prescription_orca_transmission"));
                assertTrue(tableExists(connection, "opendolphin", "orca_medical_candidate"));
                assertFalse(tableExists(connection, "opendolphin", "d_module_payload"));
                assertTrue(tableExists(connection, "opendolphin", "runtime_state_store"));
                assertFalse(tableExists(connection, "opendolphin", "phr_async_job"));
                assertFalse(tableExists(connection, "opendolphin", "d_phr_key"));
                assertFalse(tableExists(connection, "public", "d_users"));

                assertTrue(columnExists(connection, "opendolphin", "d_module", "bean_json"));
                assertFalse(columnExists(connection, "opendolphin", "d_module", "beanbytes"));
                assertTrue(columnExists(connection, "opendolphin", "d_health_insurance", "bean_json"));
                assertFalse(columnExists(connection, "opendolphin", "d_health_insurance", "beanbytes"));
                assertFalse(columnExists(connection, "opendolphin", "d_attachment", "bytes"));
                assertFalse(columnExists(connection, "opendolphin", "d_image", "jpegbyte"));
                assertTrue(columnExists(connection, "opendolphin", "d_orca_user_link", "facility_id"));
                assertTrue(columnExists(connection, "opendolphin", "d_attachment", "storage_provider"));
                assertTrue(columnExists(connection, "opendolphin", "d_attachment", "storage_bucket"));
                assertTrue(columnExists(connection, "opendolphin", "d_attachment", "storage_key"));
                assertTrue(columnExists(connection, "opendolphin", "d_attachment", "storage_version_id"));
                assertTrue(columnExists(connection, "opendolphin", "d_attachment", "storage_etag"));
                assertTrue(columnExists(connection, "opendolphin", "d_image", "storage_provider"));
                assertTrue(columnExists(connection, "opendolphin", "d_billing_orca_snapshot", "snapshot_json"));
                assertTrue(columnExists(connection, "opendolphin", "d_billing_orca_transmission", "idempotency_key"));
                assertTrue(columnExists(connection, "opendolphin", "d_billing_orca_transmission", "medical_uid"));
                assertTrue(columnExists(connection, "opendolphin", "d_diagnosis_entry", "orca_snapshot_hash"));
                assertTrue(columnExists(connection, "opendolphin", "d_diagnosis_entry", "outcome"));
                assertTrue(columnExists(connection, "opendolphin", "d_diagnosis_component", "component_type"));
                assertTrue(columnExists(connection, "opendolphin", "d_diagnosis_supplement", "supplement_code"));
                assertTrue(columnExists(connection, "opendolphin", "d_diagnosis_orca_sync_log", "request_hash"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_cache", "source_system"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_cache", "source_api"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_cache", "cache_expires_at"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_snapshot", "snapshot_reason"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_snapshot", "cache_id"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_operation", "idempotency_key"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_operation", "needs_user_review"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_audit_event", "previous_hash"));
                assertTrue(columnExists(connection, "opendolphin", "orca_disease_audit_event", "event_hash"));
                assertTrue(columnExists(connection, "opendolphin", "orca_patient_cache", "source_system"));
                assertTrue(columnExists(connection, "opendolphin", "orca_patient_cache", "source_api"));
                assertTrue(columnExists(connection, "opendolphin", "orca_patient_cache", "cache_status"));
                assertTrue(columnExists(connection, "opendolphin", "orca_patient_cache", "business_status"));
                assertTrue(columnExists(connection, "opendolphin", "orca_patient_cache", "raw_response_hash"));
                assertTrue(columnExists(connection, "opendolphin", "chart_document", "document_key"));
                assertTrue(columnExists(connection, "opendolphin", "chart_document", "current_revision_id"));
                assertTrue(columnExists(connection, "opendolphin", "chart_revision", "status"));
                assertTrue(columnExists(connection, "opendolphin", "chart_revision", "content_hash"));
                assertTrue(columnExists(connection, "opendolphin", "chart_revision_event", "event_type"));
                assertTrue(columnExists(connection, "opendolphin", "chart_revision_event", "before_summary_json"));
                assertTrue(columnExists(connection, "opendolphin", "prescription_order", "status"));
                assertTrue(columnExists(connection, "opendolphin", "prescription_order_revision", "content_hash"));
                assertTrue(columnExists(connection, "opendolphin", "prescription_order_item", "drug_code"));
                assertTrue(columnExists(connection, "opendolphin", "prescription_order_item", "usage_code"));
                assertTrue(columnExists(connection, "opendolphin", "prescription_order_item", "generic_name_prescription"));
                assertTrue(columnExists(connection, "opendolphin", "prescription_order_event", "event_type"));
                assertTrue(columnExists(connection, "opendolphin", "prescription_orca_transmission", "operation_status"));
                assertTrue(columnExists(connection, "opendolphin", "orca_medical_candidate", "candidate_status"));
                assertTrue(columnExists(connection, "opendolphin", "orca_medical_candidate", "sendable"));
                assertTrue(columnExists(connection, "opendolphin", "orca_medical_candidate", "candidate_json"));
                assertTrue(columnExists(connection, "opendolphin", "d_image", "storage_bucket"));
                assertTrue(columnExists(connection, "opendolphin", "d_image", "storage_key"));
                assertTrue(columnExists(connection, "opendolphin", "d_image", "storage_version_id"));
                assertTrue(columnExists(connection, "opendolphin", "d_image", "storage_etag"));

                assertTrue(indexExists(connection, "opendolphin", "d_document_karte_status_started_id_idx"));
                assertTrue(indexExists(connection, "opendolphin", "d_attachment_doc_linkrelation_status_id_idx"));
                assertTrue(indexExists(connection, "opendolphin", "d_patient_facility_telephone_prefix_idx"));
                assertTrue(indexExists(connection, "opendolphin", "d_patient_facility_mobilephone_prefix_idx"));
                assertTrue(indexExists(connection, "opendolphin", "d_patient_facility_zipcode_prefix_idx"));
                assertTrue(indexExists(connection, "opendolphin", "d_patient_appmemo_trgm_idx"));
                assertTrue(indexExists(connection, "opendolphin", "idx_d_orca_push_seen_event_expires_at"));
                assertTrue(indexExists(connection, "opendolphin", "idx_schedule_projection_patient_time"));
                assertTrue(indexExists(connection, "opendolphin", "idx_encounter_projection_patient_time"));
                assertTrue(indexExists(connection, "opendolphin", "idx_encounter_projection_state"));
                assertTrue(indexExists(connection, "opendolphin", "idx_encounter_transition_log_request"));
                assertTrue(indexExists(connection, "opendolphin", "idx_reconciliation_task_open"));
                assertTrue(indexExists(connection, "opendolphin", "idx_d_orca_sync_run_facility_time"));
                assertTrue(indexExists(connection, "opendolphin", "idx_d_orca_push_event_inbox_status"));
                assertTrue(indexExists(connection, "opendolphin", "idx_diagnosis_entry_patient"));
                assertTrue(indexExists(connection, "opendolphin", "uk_diagnosis_component_seq"));
                assertTrue(indexExists(connection, "opendolphin", "uk_diagnosis_supplement_seq"));
                assertTrue(indexExists(connection, "opendolphin", "idx_diagnosis_orca_sync_log_patient"));
                assertTrue(indexExists(connection, "opendolphin", "uk_chart_document_key"));
                assertTrue(indexExists(connection, "opendolphin", "uk_chart_revision_number"));
                assertTrue(indexExists(connection, "opendolphin", "idx_chart_revision_event_document"));
                assertTrue(indexExists(connection, "opendolphin", "idx_auth_session_registry_user_active"));
                assertTrue(indexExists(connection, "opendolphin", "idx_auth_session_registry_session_active"));
                assertTrue(indexExists(connection, "opendolphin", "idx_audit_event_time_desc"));
                assertTrue(indexExists(connection, "opendolphin", "idx_audit_event_trace_id"));
                assertTrue(indexExists(connection, "opendolphin", "idx_audit_event_subject"));
                assertTrue(indexExists(connection, "opendolphin", "idx_audit_export_outbox_delivery"));
                assertTrue(indexExists(connection, "opendolphin", "idx_prescription_order_patient"));
                assertTrue(indexExists(connection, "opendolphin", "idx_prescription_order_encounter"));
                assertTrue(indexExists(connection, "opendolphin", "idx_prescription_order_item_revision"));
                assertTrue(indexExists(connection, "opendolphin", "idx_prescription_order_event_order"));
                assertTrue(indexExists(connection, "opendolphin", "idx_prescription_orca_transmission_order"));
                assertTrue(indexExists(connection, "opendolphin", "idx_orca_medical_candidate_chart_revision"));
                assertTrue(indexExists(connection, "opendolphin", "uq_d_orca_user_link_facility_orca_user"));

                assertEquals(1L, countRows(connection, "select count(*) from opendolphin.audit_chain_head"));

                long nextFacilityNumber = nextVal(connection, "opendolphin.facility_num");
                nextUserId = nextVal(connection, "opendolphin.d_users_seq");
                long nextEventId = nextVal(connection, "opendolphin.chart_event_seq");
                assertTrue(nextFacilityNumber > 0);
                assertTrue(nextUserId > 0);
                assertTrue(nextEventId > 0);

                long facilityPk = nextHibernateId(connection);
                patientPk = nextHibernateId(connection);
                kartePk = nextHibernateId(connection);
                insurancePk = nextHibernateId(connection);
                documentPk = nextHibernateId(connection);
                modulePk = nextHibernateId(connection);
                schemaPk = nextHibernateId(connection);
                attachmentPk = nextHibernateId(connection);

                execute(connection,
                        "insert into opendolphin.d_facility (id, facilityid, facilityname, zipcode, address, telephone, membertype, registereddate) "
                                + "values (?, ?, ?, ?, ?, ?, ?, ?)",
                        facilityPk, "F001", "Modernized Clinic", "1000001", "Tokyo", "03-0000-0000", "OPEN", java.sql.Date.valueOf("2026-03-10"));
                execute(connection,
                        "insert into opendolphin.d_users (id, userid, password, commonname, email, membertype, registereddate, facility_id) "
                                + "values (?, ?, ?, ?, ?, ?, ?, ?)",
                        nextUserId, "F001:admin", "hashed-password", "Admin User", "admin@example.com", "OPEN",
                        java.sql.Date.valueOf("2026-03-10"), facilityPk);
                execute(connection,
                        "insert into opendolphin.d_patient (id, facilityid, patientid, fullname, gender, birthday) values (?, ?, ?, ?, ?, ?)",
                        patientPk, "F001", "P001", "Patient One", "M", java.sql.Date.valueOf("1980-01-02"));
                execute(connection,
                        "insert into opendolphin.d_karte (id, patient_id, created) values (?, ?, ?)",
                        kartePk, patientPk, java.sql.Date.valueOf("2026-03-10"));
                execute(connection,
                        "insert into opendolphin.d_health_insurance (id, bean_json, patient_id) values (?, cast(? as jsonb), ?)",
                        insurancePk, "{\"provider\":\"modern\"}", patientPk);
                execute(connection,
                        "insert into opendolphin.d_document "
                                + "(id, confirmed, started, recorded, status, creator_id, karte_id, docid, doctype, title, purpose, hasmark, hasimage, hasrp, hastreatment, haslabotest) "
                                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        documentPk, Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        "F", nextUserId, kartePk, "DOC-001", "karte", "Initial Document", "record",
                        false, true, true, false, false);
                execute(connection,
                        "insert into opendolphin.d_module "
                                + "(id, confirmed, started, recorded, status, creator_id, karte_id, name, role, stampnumber, entity, bean_json, doc_id) "
                                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?)",
                        modulePk, Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        "F", nextUserId, kartePk, "RP", "P", 0, "medOrder", "{\"bundle\":\"modern\"}", documentPk);
                execute(connection,
                        "insert into opendolphin.d_image "
                                + "(id, confirmed, started, recorded, status, creator_id, karte_id, contenttype, medicalrole, title, href, uri, digest, storage_provider, storage_bucket, storage_key, storage_version_id, storage_etag, doc_id) "
                                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        schemaPk, Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        "F", nextUserId, kartePk, "image/png", "role", "Schema", "schema.png",
                        "s3://bucket/schema.png", "sha256-schema", "s3", "bucket", "schema.png", "v1", "etag-schema", documentPk);
                execute(connection,
                        "insert into opendolphin.d_attachment "
                                + "(id, confirmed, started, recorded, status, creator_id, karte_id, filename, contenttype, contentsize, lastmodified, digest, uri, storage_provider, storage_bucket, storage_key, storage_version_id, storage_etag, doc_id) "
                                + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        attachmentPk, Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        Timestamp.from(Instant.parse("2026-03-10T00:00:00Z")),
                        "F", nextUserId, kartePk, "attachment.pdf", "application/pdf", 0L, 0L, "sha256-attachment",
                        "s3://bucket/attachment.pdf", "s3", "bucket", "attachment.pdf", "v2", "etag-attachment", documentPk);
                execute(connection,
                        "insert into opendolphin.chart_event_history (event_id, facility_id, issuer_uuid, event_type, payload_json) values (?, ?, ?, ?, ?)",
                        nextEventId, "F001", "issuer-1", 1, "{\"status\":\"ok\"}");
            }

            try (SessionFactory sessionFactory = buildSessionFactory(dataSource)) {
                assertNotNull(sessionFactory);
                try (var session = sessionFactory.openSession()) {
                    DocumentModel document = session.find(DocumentModel.class, documentPk);
                    assertNotNull(document);
                    assertEquals("DOC-001", document.getDocInfoModel().getDocId());

                    ModuleModel module = session.find(ModuleModel.class, modulePk);
                    assertNotNull(module);
                    assertJsonEquals("{\"bundle\":\"modern\"}", module.getBeanJson());

                    HealthInsuranceModel insurance = session.find(HealthInsuranceModel.class, insurancePk);
                    assertNotNull(insurance);
                    assertJsonEquals("{\"provider\":\"modern\"}", insurance.getBeanJson());

                    AttachmentModel attachment = session.find(AttachmentModel.class, attachmentPk);
                    assertNotNull(attachment);
                    assertEquals("sha256-attachment", attachment.getDigest());
                    assertEquals("s3", attachment.getStorageProvider());
                    assertEquals("bucket", attachment.getStorageBucket());
                    assertEquals("attachment.pdf", attachment.getStorageKey());
                    assertEquals("v2", attachment.getStorageVersionId());
                    assertEquals("etag-attachment", attachment.getStorageEtag());

                    SchemaModel schema = session.find(SchemaModel.class, schemaPk);
                    assertNotNull(schema);
                    assertEquals("sha256-schema", schema.getDigest());
                    assertEquals("s3", schema.getStorageProvider());
                    assertEquals("bucket", schema.getStorageBucket());
                    assertEquals("schema.png", schema.getStorageKey());
                    assertEquals("v1", schema.getStorageVersionId());
                    assertEquals("etag-schema", schema.getStorageEtag());

                    ChartDocumentModel chartDocument = new ChartDocumentModel();
                    chartDocument.setDocumentKey("server-generated-key-001");
                    chartDocument.setFacilityId("F001");
                    chartDocument.setKarteId(kartePk);
                    chartDocument.setPatientId(patientPk);
                    chartDocument.setLegacyDocumentId(documentPk);
                    chartDocument.setCreatedByUserId(nextUserId);
                    session.getTransaction().begin();
                    session.persist(chartDocument);

                    ChartRevisionModel chartRevision = new ChartRevisionModel();
                    chartRevision.setChartDocumentId(chartDocument.getId());
                    chartRevision.setRevisionNumber(1);
                    chartRevision.setStatus(ChartRevisionStatus.DRAFT);
                    chartRevision.setTitle("Initial Document");
                    chartRevision.setEnteredByUserId(nextUserId);
                    session.persist(chartRevision);

                    ChartRevisionEventModel chartRevisionEvent = new ChartRevisionEventModel();
                    chartRevisionEvent.setChartDocumentId(chartDocument.getId());
                    chartRevisionEvent.setChartRevisionId(chartRevision.getId());
                    chartRevisionEvent.setEventType(open.dolphin.infomodel.ChartRevisionEventType.DRAFT_CREATED);
                    chartRevisionEvent.setActorUserId(nextUserId);
                    session.persist(chartRevisionEvent);
                    session.getTransaction().commit();

                    assertNotNull(chartDocument.getId());
                    assertNotNull(chartRevision.getId());
                    assertEquals(ChartRevisionStatus.DRAFT, chartRevision.getStatus());
                    assertFalse(chartRevision.isDirectWriteLocked());
                }
            }
        }
    }

    private static SessionFactory buildSessionFactory(DataSource dataSource) {
        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySetting(AvailableSettings.DATASOURCE, dataSource)
                .applySetting(AvailableSettings.DIALECT, "org.hibernate.dialect.PostgreSQLDialect")
                .applySetting(AvailableSettings.DEFAULT_SCHEMA, "opendolphin")
                .applySetting(AvailableSettings.HBM2DDL_AUTO, "validate")
                .applySetting(AvailableSettings.SHOW_SQL, "false")
                .build();
        try {
            MetadataSources metadataSources = new MetadataSources(registry)
                    .addAnnotatedClass(FacilityModel.class)
                    .addAnnotatedClass(UserModel.class)
                    .addAnnotatedClass(RoleModel.class)
                    .addAnnotatedClass(PatientModel.class)
                    .addAnnotatedClass(HealthInsuranceModel.class)
                    .addAnnotatedClass(KarteBean.class)
                    .addAnnotatedClass(PatientVisitModel.class)
                    .addAnnotatedClass(DocumentModel.class)
                    .addAnnotatedClass(ModuleModel.class)
                    .addAnnotatedClass(SchemaModel.class)
                    .addAnnotatedClass(AttachmentModel.class)
                    .addAnnotatedClass(RegisteredDiagnosisModel.class)
                    .addAnnotatedClass(ObservationModel.class)
                    .addAnnotatedClass(PatientMemoModel.class)
                    .addAnnotatedClass(PatientFreeDocumentModel.class)
                    .addAnnotatedClass(AppointmentModel.class)
                    .addAnnotatedClass(LetterModel.class)
                    .addAnnotatedClass(LetterModule.class)
                    .addAnnotatedClass(LetterItem.class)
                    .addAnnotatedClass(LetterText.class)
                    .addAnnotatedClass(LetterDate.class)
                    .addAnnotatedClass(NLaboModule.class)
                    .addAnnotatedClass(NLaboItem.class)
                    .addAnnotatedClass(StampModel.class)
                    .addAnnotatedClass(StampTreeModel.class)
                    .addAnnotatedClass(PublishedTreeModel.class)
                    .addAnnotatedClass(SubscribedTreeModel.class)
                    .addAnnotatedClass(FirstEncounterModel.class)
                    .addAnnotatedClass(NurseProgressCourseModel.class)
                    .addAnnotatedClass(OndobanModel.class)
                    .addAnnotatedClass(VitalModel.class)
                    .addAnnotatedClass(Factor2Device.class)
                    .addAnnotatedClass(Factor2Code.class)
                    .addAnnotatedClass(Factor2BackupKey.class)
                    .addAnnotatedClass(Factor2Challenge.class)
                    .addAnnotatedClass(Factor2Credential.class)
                    .addAnnotatedClass(AuditEvent.class)
                    .addAnnotatedClass(ChartDocumentModel.class)
                    .addAnnotatedClass(ChartRevisionModel.class)
                    .addAnnotatedClass(ChartRevisionEventModel.class)
                    .addAnnotatedClass(UserAccessProfile.class)
                    .addAnnotatedClass(DocumentIntegrityEntity.class);
            return metadataSources.buildMetadata().buildSessionFactory();
        } catch (RuntimeException ex) {
            StandardServiceRegistryBuilder.destroy(registry);
            throw ex;
        }
    }

    private static void execute(Connection connection, String sql, Object... params) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                statement.setObject(i + 1, params[i]);
            }
            statement.executeUpdate();
        }
    }

    private static void assertJsonEquals(String expected, String actual) throws Exception {
        assertEquals(OBJECT_MAPPER.readTree(expected), OBJECT_MAPPER.readTree(actual));
    }

    private static long nextHibernateId(Connection connection) throws Exception {
        return nextVal(connection, "opendolphin.hibernate_sequence");
    }

    private static long nextVal(Connection connection, String sequenceName) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement("select nextval(?)")) {
            statement.setString(1, sequenceName);
            try (ResultSet rs = statement.executeQuery()) {
                rs.next();
                return rs.getLong(1);
            }
        }
    }

    private static long countRows(Connection connection, String sql) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static boolean tableExists(Connection connection, String schema, String table) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "select 1 from information_schema.tables where table_schema = ? and table_name = ?")) {
            statement.setString(1, schema);
            statement.setString(2, table);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean columnExists(Connection connection, String schema, String table, String column) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "select 1 from information_schema.columns where table_schema = ? and table_name = ? and column_name = ?")) {
            statement.setString(1, schema);
            statement.setString(2, table);
            statement.setString(3, column);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static boolean indexExists(Connection connection, String schema, String indexName) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "select 1 from pg_indexes where schemaname = ? and indexname = ?")) {
            statement.setString(1, schema);
            statement.setString(2, indexName);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static String appliedVersion(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "select version from opendolphin.flyway_schema_history where success order by installed_rank desc limit 1")) {
            rs.next();
            return rs.getString(1);
        }
    }
}
