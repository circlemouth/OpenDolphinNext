package open.dolphin.rest.orca;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.audit.AuditEventEnvelope;
import open.dolphin.encounter.EncounterProjectionRepository;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.CloseAndSendToBillingRequest;
import open.dolphin.rest.dto.orca.CloseAndSendToBillingResponse;
import open.dolphin.rest.dto.orca.OrcaEncounterContext;
import open.dolphin.rest.dto.orca.OrderBundleFetchResponse;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/local/encounters")
public class LocalEncounterBillingWorkflowResource extends AbstractOrcaRestResource {

    static final String AUDIT_ACTION = "LOCAL_ENCOUNTER_CLOSE_AND_SEND_TO_BILLING";
    private static final Logger LOGGER = LoggerFactory.getLogger(LocalEncounterBillingWorkflowResource.class);
    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
    private static final ZoneId TOKYO_ZONE = ZoneId.of("Asia/Tokyo");
    private static final int MAX_MEDICAL_INFORMATION = 40;
    private static final int MAX_MEDICATION_PER_INFORMATION = 40;

    @Inject
    EncounterProjectionRepository encounterProjectionRepository;

    @Inject
    BillingOrcaWorkflowRepository workflowRepository;

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private OrcaTransport orcaTransport;

    @PersistenceContext
    private EntityManager entityManager;

    @POST
    @Path("/{encounterKey}/close-and-send-to-billing")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public CloseAndSendToBillingResponse closeAndSendToBilling(
            @Context HttpServletRequest request,
            @PathParam("encounterKey") String encounterKey,
            CloseAndSendToBillingRequest payload) {
        String runId = resolveRunId(request);
        String traceId = resolveTraceId(request);
        String remoteUser = requireRemoteUser(request);
        String facilityId = requireFacilityId(request);
        CloseAndSendToBillingRequest safePayload = payload != null ? payload : new CloseAndSendToBillingRequest();
        if (!safePayload.getForbiddenClientAuthorityFields().isEmpty()) {
            throw validationError(request, "payload",
                    "patientId/facilityId/voucher/sequential/insurance/Medical_Uid/classCode are server-owned");
        }
        String idempotencyKey = normalize(safePayload.getIdempotencyKey());
        if (idempotencyKey == null) {
            throw validationError(request, "idempotencyKey", "idempotencyKey is required");
        }
        if (idempotencyKey.length() > 160 || !idempotencyKey.matches("[A-Za-z0-9:_./-]+")) {
            throw validationError(request, "idempotencyKey", "idempotencyKey format is invalid");
        }
        String normalizedEncounterKey = normalize(encounterKey);
        if (normalizedEncounterKey == null) {
            throw validationError(request, "encounterKey", "encounterKey is required");
        }

        EncounterProjectionRepository.EncounterRow row = encounterProjectionRepository.findByEncounterKey(normalizedEncounterKey);
        if (row == null || !facilityId.equals(normalize(row.facilityId()))) {
            throw restError(request, Response.Status.NOT_FOUND, "encounter_not_found", "Encounter was not found");
        }
        if ("cancelled".equalsIgnoreCase(normalize(row.businessState()))) {
            throw restError(request, Response.Status.CONFLICT, "encounter_cancelled", "Encounter is cancelled");
        }
        OrcaEncounterContext context = requireServerDerivedContext(request, row);
        PatientModel patient = patientServiceBean.getPatientById(facilityId, row.patientId());
        if (patient == null) {
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }
        KarteBean karte = karteServiceBean.getKarte(facilityId, row.patientId(), null);
        if (karte == null) {
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }

        List<OrderBundleFetchResponse.OrderBundleEntry> bundles = collectOrderBundles(karte, row);
        List<ChartSupportMedicalModV2Request.MedicalInformation> medicalInformation = toMedicalInformation(request, bundles);
        if (medicalInformation.isEmpty()) {
            throw restError(request, Response.Status.BAD_REQUEST, "billing_snapshot_empty",
                    "No ORCA-billable order rows were found for this encounter");
        }

        String snapshotJson = buildSnapshotJson(row, context, bundles.size(), medicalInformation.size());
        BillingOrcaWorkflowRepository.SnapshotRecord snapshot = workflowRepository.upsertSnapshot(
                facilityId,
                row.encounterKey(),
                row.patientId(),
                row.scheduleKey(),
                Math.max(1L, row.stateVersion()),
                "READY_TO_SEND",
                snapshotJson);
        BillingOrcaWorkflowRepository.TransmissionRecord existing =
                workflowRepository.findTransmission(facilityId, row.encounterKey(), idempotencyKey);
        if (existing != null) {
            return responseFromTransmission(existing, row, snapshot, runId, traceId, bundles.size(), medicalInformation.size());
        }

        BillingOrcaWorkflowRepository.TransmissionRecord transmission = workflowRepository.insertTransmission(
                snapshot.snapshotId(),
                facilityId,
                row.encounterKey(),
                idempotencyKey,
                "ORCA_SENDING",
                safeRequestHeader(request, "X-Request-Id"),
                traceId);
        workflowRepository.updateSnapshotState(snapshot.snapshotId(), "ORCA_SENDING");

        ChartSupportMedicalModV2Request medicalRequest = new ChartSupportMedicalModV2Request();
        medicalRequest.setEncounterContext(context);
        medicalRequest.setClassCode("01");
        medicalRequest.setRequestNumber("01");
        medicalRequest.setMedicalPush("Yes");
        medicalRequest.setMedicalInformation(medicalInformation);

        ChartSupportMedicalModResponse medicalResponse;
        String finalState;
        String errorCode = null;
        String errorMessage = null;
        boolean confirmationRequired = false;
        try {
            String xml = support().buildMedicalModV2RequestXml(medicalRequest);
            OrcaTransportResult result = orcaTransport.invoke(
                    facilityId,
                    OrcaEndpoint.MEDICAL_MOD,
                    OrcaTransportRequest.post(xml).withQuery("class=01"));
            medicalResponse = support().parseMedicalModResponse(result, runId, traceId);
            if (medicalResponse.isOk() && normalize(medicalResponse.getMedicalUid()) != null) {
                finalState = "ORCA_MEDICAL_REGISTERED";
            } else if (medicalResponse.isOk()) {
                finalState = "ORCA_UNKNOWN";
                confirmationRequired = true;
                errorCode = "medical_uid_missing";
                errorMessage = "ORCA response did not include Medical_Uid";
            } else {
                finalState = "ORCA_FAILED";
                errorCode = "orca_business_rejected";
                errorMessage = medicalResponse.getError();
            }
        } catch (RuntimeException ex) {
            medicalResponse = unknownMedicalResponse(runId, traceId);
            finalState = "ORCA_UNKNOWN";
            confirmationRequired = true;
            errorCode = "orca_result_unknown";
            errorMessage = "ORCA result is unknown; confirm temporary medical data before retry";
        }

        workflowRepository.completeTransmission(
                transmission.transmissionId(),
                finalState,
                medicalResponse.getMedicalUid(),
                medicalResponse.getApiResult(),
                medicalResponse.getApiResultMessage(),
                medicalResponse.getStatus(),
                errorCode,
                errorMessage,
                serializeResponse(medicalResponse, confirmationRequired));
        workflowRepository.updateSnapshotState(snapshot.snapshotId(), finalState);
        if ("ORCA_MEDICAL_REGISTERED".equals(finalState)) {
            encounterProjectionRepository.transitionState(
                    row.encounterKey(),
                    "accounting-wait",
                    null,
                    Instant.now(),
                    null,
                    remoteUser,
                    row.memo(),
                    row.worklistFlagsJson(),
                    Instant.now(),
                    Instant.now());
        }

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("runId", runId);
        audit.put("traceId", traceId);
        audit.put("facilityId", facilityId);
        audit.put("encounterKey", row.encounterKey());
        audit.put("patientId", row.patientId());
        audit.put("snapshotId", snapshot.snapshotId());
        audit.put("transmissionId", transmission.transmissionId());
        audit.put("state", finalState);
        audit.put("medicalUidPresent", normalize(medicalResponse.getMedicalUid()) != null);
        audit.put("routeNamespace", "local");
        recordAudit(request, AUDIT_ACTION, audit,
                "ORCA_MEDICAL_REGISTERED".equals(finalState)
                        ? AuditEventEnvelope.Outcome.SUCCESS
                        : AuditEventEnvelope.Outcome.FAILURE);

        CloseAndSendToBillingResponse response = baseResponse(row, snapshot, runId, traceId, bundles.size(), medicalInformation.size());
        response.setTransmissionId(transmission.transmissionId());
        response.setIdempotencyKey(idempotencyKey);
        response.setState(finalState);
        response.setStatus(finalState);
        response.setOk("ORCA_MEDICAL_REGISTERED".equals(finalState));
        response.setMedicalUid(medicalResponse.getMedicalUid());
        response.setApiResult(medicalResponse.getApiResult());
        response.setApiResultMessage(medicalResponse.getApiResultMessage());
        response.setConfirmationRequired(confirmationRequired);
        response.setMessage("ORCA_MEDICAL_REGISTERED".equals(finalState)
                ? "会計送信用の中途終了データを登録しました"
                : "ORCA送信結果の確認が必要です");
        return response;
    }

    private OrcaEncounterContext requireServerDerivedContext(HttpServletRequest request,
            EncounterProjectionRepository.EncounterRow row) {
        JsonNode flags = readProjectionFlags(row.worklistFlagsJson());
        if (!isServerDerivedProjection(flags)) {
            throw validationError(request, "encounterProjection",
                    "server-derived encounter projection is required for billing send");
        }
        JsonNode identifiers = flags.path("officialVisitIdentifiers");
        String departmentCode = textNode(identifiers, "departmentCode");
        String physicianCode = textNode(identifiers, "physicianCode");
        String insuranceCombinationNumber = textNode(identifiers, "insuranceCombinationNumber");
        String voucherNumber = textNode(identifiers, "voucherNumber");
        String sequentialNumber = textNode(identifiers, "sequentialNumber");
        if (voucherNumber == null && flags.path("provisionalMedicalModV2Context").asBoolean(false)) {
            voucherNumber = normalize(row.orcaAcceptanceId());
            sequentialNumber = "1";
        }
        if (departmentCode == null || physicianCode == null || insuranceCombinationNumber == null
                || voucherNumber == null || sequentialNumber == null) {
            throw validationError(request, "encounterProjection.officialVisitIdentifiers",
                    "departmentCode, physicianCode, insuranceCombinationNumber, voucherNumber and sequentialNumber are required");
        }
        OrcaEncounterContext context = new OrcaEncounterContext();
        context.setPatientId(row.patientId());
        context.setVisitDate(row.acceptanceDatetime().atZone(TOKYO_ZONE).toLocalDate().toString());
        context.setDepartmentCode(departmentCode);
        context.setPhysicianCode(physicianCode);
        context.setInsuranceCombinationNumber(insuranceCombinationNumber);
        context.setVoucherNumber(voucherNumber);
        context.setSequentialNumber(sequentialNumber);
        return context;
    }

    private List<OrderBundleFetchResponse.OrderBundleEntry> collectOrderBundles(
            KarteBean karte,
            EncounterProjectionRepository.EncounterRow row) {
        Date since = Date.from((row.acceptanceDatetime() != null ? row.acceptanceDatetime() : Instant.now())
                .minusSeconds(60L * 60L * 24L * 30L));
        List<DocumentModel> documents = OrcaOrderBundleQuerySupport.resolveDocuments(karteServiceBean, karte, since);
        return OrcaOrderBundleFetchSupport.collectBundles(documents, null, this::decodeBundle);
    }

    private List<ChartSupportMedicalModV2Request.MedicalInformation> toMedicalInformation(
            HttpServletRequest request,
            List<OrderBundleFetchResponse.OrderBundleEntry> bundles) {
        List<ChartSupportMedicalModV2Request.MedicalInformation> result = new ArrayList<>();
        for (OrderBundleFetchResponse.OrderBundleEntry bundle : bundles) {
            if (bundle == null || normalize(bundle.getClassCode()) == null || isLocalOnlyEntity(bundle.getEntity())) {
                continue;
            }
            ChartSupportMedicalModV2Request.MedicalInformation information =
                    new ChartSupportMedicalModV2Request.MedicalInformation();
            information.setEntity(bundle.getEntity());
            information.setMedicalClass(bundle.getClassCode());
            information.setMedicalClassName(bundle.getClassName());
            information.setMedicalClassNumber(bundle.getBundleNumber() != null ? bundle.getBundleNumber() : "1");
            List<ChartSupportMedicalModV2Request.Medication> medications = toMedications(bundle);
            if (medications.isEmpty()) {
                continue;
            }
            information.setMedications(medications);
            result.add(information);
            if (result.size() > MAX_MEDICAL_INFORMATION) {
                throw validationError(request, "medicalInformation",
                        "medicalmodv2 supports at most 40 Medical_Information rows per request");
            }
        }
        return result;
    }

    private List<ChartSupportMedicalModV2Request.Medication> toMedications(OrderBundleFetchResponse.OrderBundleEntry bundle) {
        List<OrderBundleFetchResponse.OrderBundleItem> items = new ArrayList<>();
        addAll(items, bundle.getItems());
        addAll(items, bundle.getMaterialItems());
        addAll(items, bundle.getCommentItems());
        if (bundle.getBodyPart() != null) {
            items.add(bundle.getBodyPart());
        }
        List<ChartSupportMedicalModV2Request.Medication> medications = new ArrayList<>();
        for (OrderBundleFetchResponse.OrderBundleItem item : items) {
            String code = normalize(item != null ? item.getCode() : null);
            if (code == null || !OrcaOrderBundleRequestSupport.isSendableUsageCode(code)) {
                continue;
            }
            ChartSupportMedicalModV2Request.Medication medication = new ChartSupportMedicalModV2Request.Medication();
            medication.setCode(code);
            medication.setName(normalize(item.getName()));
            medication.setNumber(normalize(item.getQuantity()));
            medication.setGenericFlg(normalize(item.getGenericFlg()));
            medications.add(medication);
            if (medications.size() >= MAX_MEDICATION_PER_INFORMATION) {
                break;
            }
        }
        return medications;
    }

    private void addAll(List<OrderBundleFetchResponse.OrderBundleItem> target,
            List<OrderBundleFetchResponse.OrderBundleItem> source) {
        if (source != null && !source.isEmpty()) {
            target.addAll(source);
        }
    }

    private String buildSnapshotJson(EncounterProjectionRepository.EncounterRow row, OrcaEncounterContext context,
            int bundleCount, int medicalInformationCount) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("encounterKey", row.encounterKey());
        snapshot.put("scheduleKey", row.scheduleKey());
        snapshot.put("patientId", row.patientId());
        snapshot.put("visitDate", context.getVisitDate());
        snapshot.put("departmentCode", context.getDepartmentCode());
        snapshot.put("physicianCodePresent", context.getPhysicianCode() != null);
        snapshot.put("insuranceCombinationNumberPresent", context.getInsuranceCombinationNumber() != null);
        snapshot.put("voucherNumberPresent", context.getVoucherNumber() != null);
        snapshot.put("sequentialNumberPresent", context.getSequentialNumber() != null);
        snapshot.put("orderBundleCount", bundleCount);
        snapshot.put("medicalInformationCount", medicalInformationCount);
        snapshot.put("diseaseSyncCount", 0);
        snapshot.put("rawSensitiveFieldsExcluded", Boolean.TRUE);
        try {
            return JSON_MAPPER.writeValueAsString(snapshot);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private CloseAndSendToBillingResponse responseFromTransmission(
            BillingOrcaWorkflowRepository.TransmissionRecord transmission,
            EncounterProjectionRepository.EncounterRow row,
            BillingOrcaWorkflowRepository.SnapshotRecord snapshot,
            String runId,
            String traceId,
            int bundleCount,
            int medicalInformationCount) {
        CloseAndSendToBillingResponse response = baseResponse(row, snapshot, runId, traceId, bundleCount, medicalInformationCount);
        response.setTransmissionId(transmission.transmissionId());
        response.setIdempotencyKey(transmission.idempotencyKey());
        response.setState(transmission.state());
        response.setStatus(transmission.state());
        response.setOk("ORCA_MEDICAL_REGISTERED".equals(transmission.state()) || "ORCA_CONFIRMED".equals(transmission.state()));
        response.setMedicalUid(transmission.medicalUid());
        response.setApiResult(transmission.apiResult());
        response.setApiResultMessage(transmission.apiResultMessage());
        response.setConfirmationRequired("ORCA_UNKNOWN".equals(transmission.state()));
        response.setMessage("同じ冪等キーの送信履歴を返しました");
        return response;
    }

    private CloseAndSendToBillingResponse baseResponse(EncounterProjectionRepository.EncounterRow row,
            BillingOrcaWorkflowRepository.SnapshotRecord snapshot,
            String runId,
            String traceId,
            int bundleCount,
            int medicalInformationCount) {
        CloseAndSendToBillingResponse response = new CloseAndSendToBillingResponse();
        response.setEncounterKey(row.encounterKey());
        response.setScheduleKey(row.scheduleKey());
        response.setPatientId(row.patientId());
        response.setSnapshotId(snapshot.snapshotId());
        response.setOrderBundleCount(bundleCount);
        response.setMedicalInformationCount(medicalInformationCount);
        response.setDiseaseSyncCount(0);
        response.setRunId(runId);
        response.setTraceId(traceId);
        return response;
    }

    private ChartSupportMedicalModResponse unknownMedicalResponse(String runId, String traceId) {
        ChartSupportMedicalModResponse response = new ChartSupportMedicalModResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(503);
        response.setOk(false);
        response.setApiOk(false);
        response.setApiResult("unknown");
        response.setApiResultMessage("result_unknown");
        response.setError("ORCA result is unknown");
        return response;
    }

    private String serializeResponse(ChartSupportMedicalModResponse response, boolean confirmationRequired) {
        Map<String, Object> safe = new LinkedHashMap<>();
        safe.put("ok", response != null && response.isOk());
        safe.put("status", response != null ? response.getStatus() : null);
        safe.put("apiResult", response != null ? response.getApiResult() : null);
        safe.put("apiResultMessage", response != null ? response.getApiResultMessage() : null);
        safe.put("medicalUidPresent", response != null && normalize(response.getMedicalUid()) != null);
        safe.put("confirmationRequired", confirmationRequired);
        try {
            return JSON_MAPPER.writeValueAsString(safe);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private BundleDolphin decodeBundle(ModuleModel module) {
        return OrcaOrderBundleDisplaySupport.decodeBundle(entityManager, LOGGER, module);
    }

    private OrcaChartSupportSupport support() {
        return new OrcaChartSupportSupport();
    }

    private JsonNode readProjectionFlags(String json) {
        if (json == null || json.isBlank()) {
            return JSON_MAPPER.createObjectNode();
        }
        try {
            return JSON_MAPPER.readTree(json);
        } catch (JsonProcessingException | RuntimeException ex) {
            return JSON_MAPPER.createObjectNode();
        }
    }

    private boolean isServerDerivedProjection(JsonNode flags) {
        return flags != null
                && flags.path("rawSensitiveFieldsExcluded").asBoolean(false)
                && !flags.path("clientProvidedIdentifiersTrusted").asBoolean(true)
                && flags.path("serverDerivedAuthorityRequired").asBoolean(false);
    }

    private String textNode(JsonNode node, String fieldName) {
        if (node == null || fieldName == null) {
            return null;
        }
        JsonNode value = node.path(fieldName);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        return normalize(value.asText());
    }

    private boolean isLocalOnlyEntity(String entity) {
        String normalized = OrcaOrderBundleRequestSupport.normalizeEntityResponse(entity);
        return "physiologyOrder".equals(normalized)
                || "bacteriaOrder".equals(normalized)
                || "otherOrder".equals(normalized);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
