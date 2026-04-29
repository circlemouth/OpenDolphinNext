package open.dolphin.orca.service;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.function.Function;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.dto.orca.AcceptanceInventoryRequest;
import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.FormerNameHistoryRequest;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightRequest;
import open.dolphin.rest.dto.orca.MedicalIdentifierPreflightResponse;
import open.dolphin.rest.dto.orca.OrcaApiResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
import open.dolphin.rest.dto.orca.OrcaMedicalInformationListResponse;
import open.dolphin.rest.dto.orca.OrcaReceptionSelectorOptionsResponse;
import open.dolphin.rest.dto.orca.PatientAppointmentListRequest;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import open.dolphin.rest.dto.orca.PublicInsuranceInfo;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import open.dolphin.orca.service.OrcaLiveGatewaySupport.DateRange;
import open.dolphin.orca.service.OrcaLiveGatewaySupport.InsuranceSelection;

/**
 * Coordinates transport + XML conversion for ORCA wrapper endpoints.
 */
@ApplicationScoped
public class DefaultOrcaLiveGateway implements OrcaLiveGateway {

    static final String BLOCKER_TAG = "TrialLocalOnly";
    static final int MAX_APPOINTMENT_RANGE_DAYS = 31;
    static final int MAX_VISIT_RANGE_DAYS = 31;

    private OrcaTransport transport;

    private OrcaXmlMapper mapper;

    private final OrcaLiveGatewaySupport support = new OrcaLiveGatewaySupport();

    public DefaultOrcaLiveGateway() {
        // CDI proxy requires a public no-arg constructor.
    }

    /**
     * Constructor for manual instantiation (e.g., tests).
     */
    public DefaultOrcaLiveGateway(OrcaTransport transport, OrcaXmlMapper mapper) {
        this.transport = transport;
        this.mapper = new OrcaXmlMapper();
    }

    @PostConstruct
    private void initializeDependencies() {
        if (transport == null) {
            transport = CDI.current().select(RestOrcaTransport.class).get();
        }
        if (mapper == null) {
            mapper = CDI.current().select(OrcaXmlMapper.class).get();
        }
        ensureNotNull(transport, "OrcaTransport");
        ensureNotNull(mapper, "OrcaXmlMapper");
    }

    public OrcaAppointmentListResponse getAppointmentList(String facilityId, OrcaAppointmentListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "appointment request");
        if (request.getAppointmentDate() == null && request.getFromDate() == null && request.getToDate() == null) {
            throw new OrcaGatewayException("appointmentDate or fromDate/toDate is required");
        }
        DateRange range = resolveAppointmentRange(request);
        LocalDate from = range.from();
        LocalDate to = range.to();
        OrcaAppointmentListResponse aggregate = null;
        for (LocalDate cursor = from; !cursor.isAfter(to); cursor = cursor.plusDays(1)) {
            String payload = buildAppointmentListPayload(cursor, request);
            OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.APPOINTMENT_LIST, OrcaTransportRequest.post(payload));
            String xml = result != null ? result.getBody() : null;
            OrcaAppointmentListResponse daily = mapResponse(xml, mapper::toAppointmentList);
            if (aggregate == null) {
                aggregate = daily != null ? daily : new OrcaAppointmentListResponse();
                if (daily == null) {
                    aggregate.setApiResult("00");
                    aggregate.setApiResultMessage("No data");
                }
            } else if (daily != null) {
                aggregate.getSlots().addAll(daily.getSlots());
            }
        }
        if (aggregate == null) {
            aggregate = new OrcaAppointmentListResponse();
            aggregate.setApiResult("00");
            aggregate.setApiResultMessage("No data");
        }
        if (from.equals(to)) {
            aggregate.setAppointmentDate(from.toString());
        } else {
            aggregate.setAppointmentDate(from + "/" + to);
        }
        aggregate.setRecordsReturned(aggregate.getSlots().size());
        enrich(aggregate, null);
        return aggregate;
    }

    public PatientAppointmentListResponse getPatientAppointments(String facilityId, PatientAppointmentListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient appointment request");
        String payload = buildPatientAppointmentListPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_APPOINTMENT_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        PatientAppointmentListResponse response = mapResponse(xml, mapper::toPatientAppointments);
        if (response == null) {
            response = new PatientAppointmentListResponse();
        }
        applyPatientAppointmentDepartmentFilter(response, request.getDepartmentCode());
        response.setRecordsReturned(response.getReservations().size());
        enrich(response, result);
        return response;
    }

    public BillingSimulationResponse simulateBilling(String facilityId, BillingSimulationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "billing simulation request");
        InsuranceSelection insurance = resolveInsuranceSelection(facilityId, request);
        String payload = buildBillingSimulationPayload(request, insurance);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.BILLING_SIMULATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        BillingSimulationResponse response = mapResponse(xml, mapper::toBillingSimulation);
        if (response == null) {
            response = new BillingSimulationResponse();
        }
        enrich(response, result);
        return response;
    }

    public AcceptanceInventoryResponse getAcceptanceInventory(String facilityId, AcceptanceInventoryRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "acceptance inventory request");
        String payload = buildAcceptanceInventoryPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.ACCEPTANCE_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        AcceptanceInventoryResponse response = mapResponse(xml, mapper::toAcceptanceInventory);
        if (response == null) {
            response = new AcceptanceInventoryResponse();
        }
        String classCode = normalizeAcceptanceInventoryClass(request.getClassCode());
        response.setClassCode(classCode);
        response.setAcceptanceDate(request.getAcceptanceDate() != null ? request.getAcceptanceDate().toString() : null);
        response.setEndpoint("/api/orca/official/visits/acceptance-list");
        response.setOrcaEndpoint(OrcaEndpoint.ACCEPTANCE_LIST.getPath());
        response.setRequestClass("acceptlstv2_class_" + classCode + "_target_inventory_readonly");
        response.setMethod(OrcaEndpoint.ACCEPTANCE_LIST.getMethod());
        response.setSerializer("acceptlstreq_xml2_server_sanitized_readonly");
        response.setParser("acceptlstres_allowlisted_presence_flags_and_hashes_only");
        response.setSanitizer("drop_patient_names_insurance_numbers_and_raw_orca_body");
        response.setRecordsReturned(response.getRows().size());
        response.setSourceRowCount(response.getRows().size());
        response.setSanitizedRowCount(response.getRows().size());
        response.setRawSensitiveFieldsExcluded(true);
        response.setClientProvidedIdentifiersTrusted(false);
        response.setServerDerivedAuthorityRequired(true);
        enrich(response, result);
        return response;
    }

    public MedicalIdentifierPreflightResponse getMedicalIdentifierPreflight(
            String facilityId, MedicalIdentifierPreflightRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "medical identifier preflight request");
        AcceptanceInventoryRequest inventoryRequest = new AcceptanceInventoryRequest();
        inventoryRequest.setAcceptanceDate(request.getAcceptanceDate());
        inventoryRequest.setClassCode(request.getClassCode());
        AcceptanceInventoryResponse inventory = getAcceptanceInventory(facilityId, inventoryRequest);
        AcceptanceInventoryResponse.AcceptanceInventoryRow selected =
                selectMedicalIdentifierTarget(inventory, request.getTargetRowHash());

        String medicalGetClassCode = normalizeMedicalGetClassCode(request.getMedicalGetClassCode());
        MedicalIdentifierPreflightResponse response;
        OrcaTransportResult result = null;
        try {
            String payload = buildMedicalIdentifierPayload(selected, medicalGetClassCode);
            result = transport.invoke(facilityId, OrcaEndpoint.MEDICAL_GET, OrcaTransportRequest.post(payload));
            String xml = result != null ? result.getBody() : null;
            response = mapResponse(xml, body -> mapper.toMedicalIdentifierSnapshot(body, medicalGetClassCode));
            if (response == null) {
                response = new MedicalIdentifierPreflightResponse();
            }
        } catch (OrcaGatewayException ex) {
            response = new MedicalIdentifierPreflightResponse();
            response.setSanitizedErrorCode("orca_gateway_error");
            response.setSanitizedValidationError("medicalgetv2_unavailable_or_rejected");
        }
        response.setEndpoint("/api/orca/official/visits/identifier-preflight");
        response.setAcceptanceEndpoint(OrcaEndpoint.ACCEPTANCE_LIST.getPath());
        response.setMedicalGetEndpoint(OrcaEndpoint.MEDICAL_GET.getPath());
        response.setMedicalGetClassCode(medicalGetClassCode);
        response.setRequestClass("medicalgetv2_class_" + medicalGetClassCode + "_identifier_snapshot_readonly");
        response.setParser("medicalgetres_allowlisted_identifier_presence_flags_and_hashes_only");
        response.setSanitizer("drop_patient_names_insurance_numbers_raw_detail_and_raw_orca_body");
        response.setAcceptanceClassCode(inventory.getClassCode());
        response.setAcceptanceDate(inventory.getAcceptanceDate());
        response.setSelectedAcceptanceRowHash(selected.getRowHash());
        response.setSelectedAcceptanceTargetReady(isMedicalIdentifierTargetReady(selected));
        response.setAcceptanceSourceRowCount(inventory.getSourceRowCount());
        response.setAcceptanceTargetReadyRowCount(inventory.getTargetReadyRowCount());
        attachVisitListIdentifierProof(facilityId, selected, response);
        response.setIdentifierPreflightReady(response.isSelectedAcceptanceTargetReady()
                && (hasReadyMedicalIdentifierRow(response) || response.getVisitReadyRowCount() > 0));
        applyProvisionalIdentifierPreflight(selected, response);
        enrich(response, result);
        return response;
    }

    private void attachVisitListIdentifierProof(
            String facilityId,
            AcceptanceInventoryResponse.AcceptanceInventoryRow selected,
            MedicalIdentifierPreflightResponse response) {
        response.setVisitListEndpoint(OrcaEndpoint.VISIT_LIST.getPath());
        response.setVisitListRequestClass("visitptlstv2_request_01_visit_date_readonly_identifier_proof");
        try {
            VisitPatientListRequest request = new VisitPatientListRequest();
            request.setRequestNumber("01");
            request.setVisitDate(LocalDate.parse(selected.getServerAcceptanceDate()));
            request.setDepartmentCode(selected.getServerDepartmentCode());
            String payload = buildVisitListPayload(request, new DateRange(request.getVisitDate(), request.getVisitDate()));
            OrcaTransportResult visitResult =
                    transport.invoke(facilityId, OrcaEndpoint.VISIT_LIST, OrcaTransportRequest.post(payload));
            VisitPatientListResponse visitResponse =
                    mapResponse(visitResult != null ? visitResult.getBody() : null, mapper::toVisitList);
            if (visitResponse == null) {
                return;
            }
            response.setVisitSourceRowCount(visitResponse.getVisits().size());
            for (VisitPatientListResponse.VisitEntry entry : visitResponse.getVisits()) {
                MedicalIdentifierPreflightResponse.VisitIdentifierRow row =
                        toVisitIdentifierRow(selected, visitResponse.getVisitDate(), entry);
                response.getVisitRows().add(row);
                if (isReadyVisitIdentifierRow(selected, row)) {
                    response.setVisitReadyRowCount(response.getVisitReadyRowCount() + 1);
                }
            }
            response.setVisitSanitizedRowCount(response.getVisitRows().size());
        } catch (RuntimeException ex) {
            response.setVisitSourceRowCount(0);
            response.setVisitSanitizedRowCount(0);
            response.setVisitReadyRowCount(0);
        }
    }

    private MedicalIdentifierPreflightResponse.VisitIdentifierRow toVisitIdentifierRow(
            AcceptanceInventoryResponse.AcceptanceInventoryRow selected,
            String visitDate,
            VisitPatientListResponse.VisitEntry entry) {
        MedicalIdentifierPreflightResponse.VisitIdentifierRow row =
                new MedicalIdentifierPreflightResponse.VisitIdentifierRow();
        String patientId = entry != null && entry.getPatient() != null ? entry.getPatient().getPatientId() : null;
        String normalizedVisitDate = hasText(visitDate) ? visitDate : selected.getServerAcceptanceDate();
        String departmentCode = entry != null ? entry.getDepartmentCode() : null;
        String voucherNumber = entry != null ? entry.getVoucherNumber() : null;
        String sequentialNumber = entry != null ? entry.getSequentialNumber() : null;
        String insuranceCombinationNumber = entry != null ? entry.getInsuranceCombinationNumber() : null;
        row.setRowHash(sha256(String.join("|",
                safeHashSeed(patientId),
                safeHashSeed(normalizedVisitDate),
                safeHashSeed(departmentCode),
                safeHashSeed(voucherNumber),
                safeHashSeed(sequentialNumber),
                safeHashSeed(insuranceCombinationNumber))));
        row.setHasPatientId(hasText(patientId));
        row.setHasVisitDate(hasText(normalizedVisitDate));
        row.setHasDepartmentCode(hasText(departmentCode));
        row.setHasVoucherNumber(hasText(voucherNumber));
        row.setHasSequentialNumber(hasText(sequentialNumber));
        row.setHasInsuranceCombinationNumber(hasText(insuranceCombinationNumber));
        row.setRawSensitiveFieldsExcluded(true);
        row.setServerPatientId(patientId);
        row.setServerVisitDate(normalizedVisitDate);
        row.setServerDepartmentCode(departmentCode);
        row.setServerVoucherNumber(voucherNumber);
        row.setServerSequentialNumber(sequentialNumber);
        row.setServerInsuranceCombinationNumber(insuranceCombinationNumber);
        return row;
    }

    private boolean hasReadyMedicalIdentifierRow(MedicalIdentifierPreflightResponse response) {
        return response.getMedicalSanitizedRowCount() > 0
                && response.getMedicalRows().stream().anyMatch(row ->
                        row.isHasPerformDate()
                                && row.isHasDepartmentCode()
                                && row.isHasSequentialNumber()
                                && row.isHasInsuranceCombinationNumber());
    }

    private boolean isReadyVisitIdentifierRow(
            AcceptanceInventoryResponse.AcceptanceInventoryRow selected,
            MedicalIdentifierPreflightResponse.VisitIdentifierRow row) {
        return row != null
                && row.isRawSensitiveFieldsExcluded()
                && row.isHasPatientId()
                && row.isHasVisitDate()
                && row.isHasDepartmentCode()
                && row.isHasVoucherNumber()
                && row.isHasSequentialNumber()
                && row.isHasInsuranceCombinationNumber()
                && hasText(row.getServerPatientId())
                && hasText(row.getServerVisitDate())
                && hasText(row.getServerDepartmentCode())
                && hasText(row.getServerVoucherNumber())
                && hasText(row.getServerSequentialNumber())
                && hasText(row.getServerInsuranceCombinationNumber())
                && safeHashSeed(row.getServerPatientId()).equals(safeHashSeed(selected.getServerPatientId()))
                && safeHashSeed(row.getServerVisitDate()).equals(safeHashSeed(selected.getServerAcceptanceDate()))
                && safeHashSeed(row.getServerDepartmentCode()).equals(safeHashSeed(selected.getServerDepartmentCode()))
                && safeHashSeed(row.getServerInsuranceCombinationNumber())
                        .equals(safeHashSeed(selected.getServerInsuranceCombinationNumber()));
    }

    private void applyProvisionalIdentifierPreflight(
            AcceptanceInventoryResponse.AcceptanceInventoryRow selected,
            MedicalIdentifierPreflightResponse response) {
        if (response == null || response.isIdentifierPreflightReady() || !response.isSelectedAcceptanceTargetReady()) {
            return;
        }
        long matchingVisitContextCount = response.getVisitRows().stream()
                .filter(row -> isProvisionalVisitContextRow(selected, row))
                .count();
        response.setProvisionalVisitContextRowCount((int) matchingVisitContextCount);
        if (matchingVisitContextCount == 1) {
            response.setProvisionalIdentifierPreflightReady(true);
            response.setProvisionalIdentifierPreflightReason(
                    "server_derived_unique_visit_context_without_complete_voucher_sequential");
        } else if (matchingVisitContextCount > 1) {
            response.setProvisionalIdentifierPreflightReason("ambiguous_multiple_matching_visit_context_rows");
        } else if (response.getVisitSanitizedRowCount() > 0) {
            response.setProvisionalIdentifierPreflightReason("no_matching_visit_context_row");
        }
    }

    private boolean isProvisionalVisitContextRow(
            AcceptanceInventoryResponse.AcceptanceInventoryRow selected,
            MedicalIdentifierPreflightResponse.VisitIdentifierRow row) {
        return row != null
                && row.isRawSensitiveFieldsExcluded()
                && row.isHasPatientId()
                && row.isHasVisitDate()
                && row.isHasDepartmentCode()
                && row.isHasInsuranceCombinationNumber()
                && hasText(row.getServerPatientId())
                && hasText(row.getServerVisitDate())
                && hasText(row.getServerDepartmentCode())
                && hasText(row.getServerInsuranceCombinationNumber())
                && safeHashSeed(row.getServerPatientId()).equals(safeHashSeed(selected.getServerPatientId()))
                && safeHashSeed(row.getServerVisitDate()).equals(safeHashSeed(selected.getServerAcceptanceDate()))
                && safeHashSeed(row.getServerDepartmentCode()).equals(safeHashSeed(selected.getServerDepartmentCode()))
                && safeHashSeed(row.getServerInsuranceCombinationNumber())
                        .equals(safeHashSeed(selected.getServerInsuranceCombinationNumber()));
    }

    private String safeHashSeed(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte item : hash) {
                builder.append(String.format("%02x", item));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new OrcaGatewayException("SHA-256 digest is unavailable", ex);
        }
    }

    public VisitPatientListResponse getVisitList(String facilityId, VisitPatientListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "visit list request");
        DateRange range = resolveVisitRange(request);
        String payload = buildVisitListPayload(request, range);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.VISIT_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        VisitPatientListResponse response = mapResponse(xml, mapper::toVisitList);
        if (response == null) {
            response = new VisitPatientListResponse();
        }
        response.setRecordsReturned(response.getVisits().size());
        if (range.from().equals(range.to())) {
            response.setVisitDate(range.from().toString());
        } else {
            response.setVisitDate(range.from() + "/" + range.to());
        }
        enrich(response, result);
        return response;
    }

    public PatientIdListResponse getPatientIdList(String facilityId, PatientIdListRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient id list request");
        String payload = buildPatientIdListPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_ID_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        PatientIdListResponse response = mapResponse(xml, mapper::toPatientIdList);
        if (response == null) {
            response = new PatientIdListResponse();
        }
        enrich(response, result);
        return response;
    }

    public PatientBatchResponse getPatientBatch(String facilityId, PatientBatchRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient batch request");
        String payload = buildPatientBatchPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_BATCH, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        PatientBatchResponse response = mapResponse(xml, mapper::toPatientBatch);
        if (response == null) {
            response = new PatientBatchResponse();
        }
        if (!request.isIncludeInsurance()) {
            for (PatientDetail detail : response.getPatients()) {
                detail.getInsurances().clear();
                detail.getPublicInsurances().clear();
            }
        }
        enrich(response, result);
        return response;
    }

    public PatientSearchResponse searchPatients(String facilityId, PatientNameSearchRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "patient search request");
        String payload = buildPatientSearchPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.PATIENT_NAME_SEARCH, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        String searchTerm = request.getName();
        PatientSearchResponse response = mapResponse(xml, v -> mapper.toPatientSearch(v, searchTerm));
        if (response == null) {
            response = new PatientSearchResponse();
        }
        enrich(response, result);
        return response;
    }

    public OrcaMedicalInformationListResponse getMedicalInformationOptions(String facilityId) {
        facilityId = requireText(facilityId, "facilityId");
        String payload = buildMedicalInformationOptionsPayload();
        OrcaTransportResult result =
                transport.invoke(facilityId, OrcaEndpoint.SYSTEM_MANAGEMENT_LIST, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        OrcaMedicalInformationListResponse response = mapResponse(xml, mapper::toMedicalInformationList);
        if (response == null) {
            response = new OrcaMedicalInformationListResponse();
        }
        response.setRecordsReturned(response.getItems().size());
        enrich(response, result);
        return response;
    }

    public OrcaReceptionSelectorOptionsResponse getReceptionSelectorOptions(String facilityId) {
        facilityId = requireText(facilityId, "facilityId");
        OrcaReceptionSelectorOptionsResponse response = new OrcaReceptionSelectorOptionsResponse();

        OrcaTransportResult departmentResult = transport.invoke(
                facilityId,
                OrcaEndpoint.SYSTEM_MANAGEMENT_LIST,
                OrcaTransportRequest.post(buildSystemManagementOptionsPayload("01")));
        OrcaReceptionSelectorOptionsResponse departments =
                mapResponse(departmentResult != null ? departmentResult.getBody() : null, mapper::toDepartmentOptionList);
        if (departments != null) {
            response.getDepartments().addAll(departments.getDepartments());
            response.setApiResult(departments.getApiResult());
            response.setApiResultMessage(departments.getApiResultMessage());
        }

        OrcaTransportResult physicianResult = transport.invoke(
                facilityId,
                OrcaEndpoint.SYSTEM_MANAGEMENT_LIST,
                OrcaTransportRequest.post(buildSystemManagementOptionsPayload("02")));
        OrcaReceptionSelectorOptionsResponse physicians =
                mapResponse(physicianResult != null ? physicianResult.getBody() : null, mapper::toPhysicianOptionList);
        if (physicians != null) {
            response.getPhysicians().addAll(physicians.getPhysicians());
            if (response.getApiResult() == null || response.getApiResult().isBlank()) {
                response.setApiResult(physicians.getApiResult());
                response.setApiResultMessage(physicians.getApiResultMessage());
            }
        }

        response.setRecordsReturned(response.getDepartments().size() + response.getPhysicians().size());
        enrich(response, physicianResult != null ? physicianResult : departmentResult);
        return response;
    }

    public InsuranceCombinationResponse getInsuranceCombinations(String facilityId, InsuranceCombinationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "insurance combination request");
        String payload = buildInsuranceCombinationPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.INSURANCE_COMBINATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        InsuranceCombinationResponse response = mapResponse(xml, mapper::toInsuranceCombination);
        if (response == null) {
            response = new InsuranceCombinationResponse();
        }
        enrich(response, result);
        return response;
    }

    public FormerNameHistoryResponse getFormerNames(String facilityId, FormerNameHistoryRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "former name request");
        String payload = buildFormerNameHistoryPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.FORMER_NAME_HISTORY, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        FormerNameHistoryResponse response = mapResponse(xml, mapper::toFormerNames);
        if (response == null) {
            response = new FormerNameHistoryResponse();
        }
        enrich(response, result);
        return response;
    }

    public AppointmentMutationResponse mutateAppointment(String facilityId, AppointmentMutationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "appointment mutation request");
        String payload = buildAppointmentMutationPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.APPOINTMENT_MUTATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        AppointmentMutationResponse response = mapResponse(xml, mapper::toAppointmentMutation);
        if (response == null) {
            response = new AppointmentMutationResponse();
        }
        enrich(response, result);
        return response;
    }

    public VisitMutationResponse mutateVisit(String facilityId, VisitMutationRequest request) {
        facilityId = requireText(facilityId, "facilityId");
        ensureNotNull(request, "visit mutation request");
        String payload = buildVisitMutationPayload(request);
        OrcaTransportResult result = transport.invoke(facilityId, OrcaEndpoint.ACCEPTANCE_MUTATION, OrcaTransportRequest.post(payload));
        String xml = result != null ? result.getBody() : null;
        VisitMutationResponse response = mapResponse(xml, mapper::toVisitMutation);
        if (response == null) {
            response = new VisitMutationResponse();
        }
        enrich(response, result);
        return response;
    }

    private void enrich(OrcaApiResponse response, OrcaTransportResult result) { support.enrich(response, result); }
    private String resolveDataSource(OrcaTransportResult result) { return support.resolveDataSource(result); }
    private void ensureNotNull(Object target, String label) { support.ensureNotNull(target, label); }
    private String requireText(String value, String label) { return support.requireText(value, label); }
    private String requireNumericId(String value, String label) { return support.requireNumericId(value, label); }
    private String buildOrcaMeta(OrcaEndpoint endpoint, String classCode) { return support.buildOrcaMeta(endpoint, classCode); }
    private String normalizeAppointmentClass(String value) { return support.normalizeAppointmentClass(value); }
    private String normalizeAcceptRequestNumber(String value) { return support.normalizeAcceptRequestNumber(value); }
    private String normalizeToken(String value, String label) { return support.normalizeToken(value, label); }
    private String padTwoDigits(String value) { return support.padTwoDigits(value); }
    private String resolveAppointmentListClass(OrcaAppointmentListRequest request) { return support.resolveAppointmentListClass(request); }
    private String buildAppointmentListPayload(LocalDate date, OrcaAppointmentListRequest request) { return support.buildAppointmentListPayload(date, request); }
    private OrcaLiveGatewaySupport.DateRange resolveAppointmentRange(OrcaAppointmentListRequest request) { return support.resolveAppointmentRange(request); }
    private void enforceRangeLimit(LocalDate from, LocalDate to, int maxDays, String label) { support.enforceRangeLimit(from, to, maxDays, label); }
    private String buildVisitListPayload(VisitPatientListRequest request, OrcaLiveGatewaySupport.DateRange range) { return support.buildVisitListPayload(request, range); }
    private String buildAcceptanceInventoryPayload(AcceptanceInventoryRequest request) { return support.buildAcceptanceInventoryPayload(request); }
    private String normalizeAcceptanceInventoryClass(String value) { return support.normalizeAcceptanceInventoryClass(value); }
    private String normalizeMedicalGetClassCode(String value) { return support.normalizeMedicalGetClassCode(value); }
    private AcceptanceInventoryResponse.AcceptanceInventoryRow selectMedicalIdentifierTarget(AcceptanceInventoryResponse inventory, String targetRowHash) { return support.selectMedicalIdentifierTarget(inventory, targetRowHash); }
    private boolean isMedicalIdentifierTargetReady(AcceptanceInventoryResponse.AcceptanceInventoryRow row) { return support.isMedicalIdentifierTargetReady(row); }
    private String buildMedicalIdentifierPayload(AcceptanceInventoryResponse.AcceptanceInventoryRow row, String medicalGetClassCode) { return support.buildMedicalIdentifierPayload(row, medicalGetClassCode); }
    private OrcaLiveGatewaySupport.DateRange resolveVisitRange(VisitPatientListRequest request) { return support.resolveVisitRange(request); }
    private String buildPatientAppointmentListPayload(PatientAppointmentListRequest request) { return support.buildPatientAppointmentListPayload(request); }
    private String buildBillingSimulationPayload(BillingSimulationRequest request, OrcaLiveGatewaySupport.InsuranceSelection selection) { return support.buildBillingSimulationPayload(request, selection); }
    private OrcaLiveGatewaySupport.InsuranceSelection resolveInsuranceSelection(String facilityId, BillingSimulationRequest request) { return support.resolveInsuranceSelection(facilityId, request, this); }
    private InsuranceCombination selectInsurance(PatientDetail detail, LocalDate performDate) { return support.selectInsurance(detail, performDate); }
    private java.util.List<PublicInsuranceInfo> selectPublicInsurances(PatientDetail detail, InsuranceCombination insurance, LocalDate performDate) { return support.selectPublicInsurances(detail, insurance, performDate); }
    private boolean isEffectiveOn(String start, String end, LocalDate target) { return support.isEffectiveOn(start, end, target); }
    private LocalDate parseOrcaDate(String value) { return support.parseOrcaDate(value); }
    private void appendInsuranceInfo(StringBuilder builder, OrcaLiveGatewaySupport.InsuranceSelection selection) { support.appendInsuranceInfo(builder, selection); }
    private String buildPatientIdListPayload(PatientIdListRequest request) { return support.buildPatientIdListPayload(request); }
    private String buildPatientBatchPayload(PatientBatchRequest request) { return support.buildPatientBatchPayload(request); }
    private String buildPatientSearchPayload(PatientNameSearchRequest request) { return support.buildPatientSearchPayload(request); }
    private String buildMedicalInformationOptionsPayload() { return support.buildMedicalInformationOptionsPayload(); }
    private String buildSystemManagementOptionsPayload(String requestNumber) { return support.buildSystemManagementOptionsPayload(requestNumber); }
    private String buildInsuranceCombinationPayload(InsuranceCombinationRequest request) { return support.buildInsuranceCombinationPayload(request); }
    private String buildFormerNameHistoryPayload(FormerNameHistoryRequest request) { return support.buildFormerNameHistoryPayload(request); }
    private String buildAppointmentMutationPayload(AppointmentMutationRequest request) { return support.buildAppointmentMutationPayload(request); }
    private String buildVisitMutationPayload(VisitMutationRequest request) { return support.buildVisitMutationPayload(request); }
    private void appendTag(StringBuilder builder, String tag, String value) { support.appendTag(builder, tag, value); }
    private void appendXml2Tag(StringBuilder builder, String tag, String value) { support.appendXml2Tag(builder, tag, value); }
    private <T> T mapResponse(String xml, Function<String, T> converter) { return xml != null ? converter.apply(xml) : null; }

    private void applyPatientAppointmentDepartmentFilter(PatientAppointmentListResponse response, String departmentCode) {
        if (response == null || departmentCode == null || departmentCode.isBlank()) {
            return;
        }
        String expected = departmentCode.trim();
        response.getReservations().removeIf(appointment ->
                appointment == null
                        || appointment.getDepartmentCode() == null
                        || !expected.equals(appointment.getDepartmentCode().trim()));
    }

    private static String requireFacilityId(String facilityId) {
        if (facilityId == null || facilityId.isBlank()) {
            throw new OrcaGatewayException("facilityId is required");
        }
        return facilityId.trim();
    }
}
