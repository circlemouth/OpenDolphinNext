package open.dolphin.orca.service;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.converter.OrcaXmlMapper;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.orca.transport.RestOrcaTransport;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.FormerNameHistoryRequest;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;
import open.dolphin.rest.dto.orca.OrcaApiResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListRequest;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
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

/**
 * Coordinates transport + XML conversion for ORCA wrapper endpoints.
 */
@ApplicationScoped
public class OrcaWrapperService {

    public static final String BLOCKER_TAG = "TrialLocalOnly";
    public static final int MAX_APPOINTMENT_RANGE_DAYS = 31;
    public static final int MAX_VISIT_RANGE_DAYS = 31;

    private OrcaTransport transport;

    private OrcaXmlMapper mapper;

    public OrcaWrapperService() {
        // CDI proxy requires a public no-arg constructor.
    }

    /**
     * Constructor for manual instantiation (e.g., tests).
     */
    public OrcaWrapperService(OrcaTransport transport, OrcaXmlMapper mapper) {
        this.transport = transport;
        this.mapper = mapper;
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

    public OrcaAppointmentListResponse getAppointmentList(OrcaAppointmentListRequest request) {
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
            String xml = transport.invoke(OrcaEndpoint.APPOINTMENT_LIST, payload);
            OrcaAppointmentListResponse daily = mapper.toAppointmentList(xml);
            if (aggregate == null) {
                aggregate = daily;
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

    public PatientAppointmentListResponse getPatientAppointments(PatientAppointmentListRequest request) {
        ensureNotNull(request, "patient appointment request");
        String payload = buildPatientAppointmentListPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_APPOINTMENT_LIST, payload);
        PatientAppointmentListResponse response = mapper.toPatientAppointments(xml);
        if (response != null) {
            response.setRecordsReturned(response.getReservations().size());
        }
        enrich(response, null);
        return response;
    }

    public BillingSimulationResponse simulateBilling(BillingSimulationRequest request) {
        ensureNotNull(request, "billing simulation request");
        InsuranceSelection insurance = resolveInsuranceSelection(request);
        String payload = buildBillingSimulationPayload(request, insurance);
        String xml = transport.invoke(OrcaEndpoint.BILLING_SIMULATION, payload);
        BillingSimulationResponse response = mapper.toBillingSimulation(xml);
        enrich(response, null);
        return response;
    }

    public VisitPatientListResponse getVisitList(VisitPatientListRequest request) {
        ensureNotNull(request, "visit list request");
        DateRange range = resolveVisitRange(request);
        String payload = buildVisitListPayload(request, range);
        String xml = transport.invoke(OrcaEndpoint.VISIT_LIST, payload);
        VisitPatientListResponse response = mapper.toVisitList(xml);
        if (response != null) {
            response.setRecordsReturned(response.getVisits().size());
        }
        if (range.from().equals(range.to())) {
            response.setVisitDate(range.from().toString());
        } else {
            response.setVisitDate(range.from() + "/" + range.to());
        }
        enrich(response, null);
        return response;
    }

    public PatientIdListResponse getPatientIdList(PatientIdListRequest request) {
        ensureNotNull(request, "patient id list request");
        String payload = buildPatientIdListPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_ID_LIST, payload);
        PatientIdListResponse response = mapper.toPatientIdList(xml);
        enrich(response, null);
        return response;
    }

    public PatientBatchResponse getPatientBatch(PatientBatchRequest request) {
        ensureNotNull(request, "patient batch request");
        String payload = buildPatientBatchPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_BATCH, payload);
        PatientBatchResponse response = mapper.toPatientBatch(xml);
        if (!request.isIncludeInsurance()) {
            for (PatientDetail detail : response.getPatients()) {
                detail.getInsurances().clear();
                detail.getPublicInsurances().clear();
            }
        }
        enrich(response, null);
        return response;
    }

    public PatientSearchResponse searchPatients(PatientNameSearchRequest request) {
        ensureNotNull(request, "patient search request");
        String payload = buildPatientSearchPayload(request);
        String xml = transport.invoke(OrcaEndpoint.PATIENT_NAME_SEARCH, payload);
        String searchTerm = request.getName() != null ? request.getName() : request.getKana();
        PatientSearchResponse response = mapper.toPatientSearch(xml, searchTerm);
        enrich(response, null);
        return response;
    }

    public InsuranceCombinationResponse getInsuranceCombinations(InsuranceCombinationRequest request) {
        ensureNotNull(request, "insurance combination request");
        String payload = buildInsuranceCombinationPayload(request);
        String xml = transport.invoke(OrcaEndpoint.INSURANCE_COMBINATION, payload);
        InsuranceCombinationResponse response = mapper.toInsuranceCombination(xml);
        enrich(response, null);
        return response;
    }

    public FormerNameHistoryResponse getFormerNames(FormerNameHistoryRequest request) {
        ensureNotNull(request, "former name request");
        String payload = buildFormerNameHistoryPayload(request);
        String xml = transport.invoke(OrcaEndpoint.FORMER_NAME_HISTORY, payload);
        FormerNameHistoryResponse response = mapper.toFormerNames(xml);
        enrich(response, null);
        return response;
    }

    public AppointmentMutationResponse mutateAppointment(AppointmentMutationRequest request) {
        ensureNotNull(request, "appointment mutation request");
        String payload = buildAppointmentMutationPayload(request);
        String xml = transport.invoke(OrcaEndpoint.APPOINTMENT_MUTATION, payload);
        AppointmentMutationResponse response = mapper.toAppointmentMutation(xml);
        enrich(response, null);
        return response;
    }

    public VisitMutationResponse mutateVisit(VisitMutationRequest request) {
        ensureNotNull(request, "visit mutation request");
        String payload = buildVisitMutationPayload(request);
        String xml = transport.invoke(OrcaEndpoint.ACCEPTANCE_MUTATION, payload);
        VisitMutationResponse response = mapper.toVisitMutation(xml);
        enrich(response, null);
        return response;
    }

    private void enrich(OrcaApiResponse response, OrcaTransportResult result) {
        if (response != null) {
            if (response.getRunId() == null || response.getRunId().isBlank()) {
                response.setRunId(AbstractOrcaRestResource.resolveRunIdValue((String) null));
            }
            response.setBlockerTag(null);
            if (response.getDataSource() == null || response.getDataSource().isBlank()) {
                response.setDataSource(resolveDataSource(result));
            }
        }
    }

    private String resolveDataSource(OrcaTransportResult result) {
        if (result != null && result.getHeaders() != null) {
            for (java.util.Map.Entry<String, java.util.List<String>> entry : result.getHeaders().entrySet()) {
                if (entry.getKey() != null && "x-opendolphin-data-source".equalsIgnoreCase(entry.getKey())
                        && entry.getValue() != null && !entry.getValue().isEmpty()) {
                    String value = entry.getValue().get(0);
                    if (value != null && !value.isBlank()) {
                        return value.trim();
                    }
                }
            }
        }
        return "real";
    }

    private void ensureNotNull(Object target, String label) {
        if (target == null) {
            throw new OrcaGatewayException(label + " must not be null");
        }
    }

    private String requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new OrcaGatewayException(label + " is required");
        }
        return value.trim();
    }

    private String requireNumericId(String value, String label) {
        String trimmed = requireText(value, label);
        if (!trimmed.matches("\\d+")) {
            throw new OrcaGatewayException(label + " must be numeric");
        }
        return trimmed;
    }

    private static final class InsuranceSelection {
        private final InsuranceCombination insurance;
        private final java.util.List<PublicInsuranceInfo> publicInsurances;

        private InsuranceSelection(InsuranceCombination insurance, java.util.List<PublicInsuranceInfo> publicInsurances) {
            this.insurance = insurance;
            this.publicInsurances = publicInsurances != null ? publicInsurances : java.util.List.of();
        }
    }

    private String buildOrcaMeta(OrcaEndpoint endpoint, String classCode) {
        String path = endpoint != null ? endpoint.getPath() : "";
        StringBuilder builder = new StringBuilder();
        builder.append("<!-- orca-meta: path=").append(path).append(" method=POST");
        if (classCode != null && !classCode.isBlank()) {
            builder.append(" query=class=").append(classCode.trim());
        }
        builder.append(" -->");
        return builder.toString();
    }

    private String normalizeAppointmentClass(String value) {
        String normalized = normalizeToken(value, "requestNumber");
        if (normalized.matches("\\d{1,2}")) {
            String code = padTwoDigits(normalized);
            if (!"01".equals(code) && !"02".equals(code)) {
                throw new OrcaGatewayException(
                        "requestNumber must be 01/02 (appointmodv2 class) or supported operation keyword");
            }
            return code;
        }
        return switch (normalized) {
            case "create", "register", "add", "update" -> "01";
            case "cancel", "delete", "remove" -> "02";
            default -> throw new OrcaGatewayException(
                    "requestNumber must be 01/02 (appointmodv2 class) or supported operation keyword");
        };
    }

    private String normalizeAcceptRequestNumber(String value) {
        String normalized = normalizeToken(value, "requestNumber");
        if (normalized.matches("\\d{1,2}")) {
            String code = padTwoDigits(normalized);
            if (!"00".equals(code) && !"01".equals(code) && !"02".equals(code) && !"03".equals(code)) {
                throw new OrcaGatewayException(
                        "requestNumber must be 00/01/02/03 (acceptmodv2 Request_Number) or supported operation keyword");
            }
            return code;
        }
        return switch (normalized) {
            case "create", "register", "add" -> "01";
            case "delete", "cancel", "remove" -> "02";
            case "update", "modify" -> "03";
            case "query", "read", "get", "list", "inquiry" -> "00";
            default -> throw new OrcaGatewayException(
                    "requestNumber must be 00/01/02/03 (acceptmodv2 Request_Number) or supported operation keyword");
        };
    }

    private String normalizeToken(String value, String label) {
        String raw = requireText(value, label).trim();
        String normalized = raw.toLowerCase(Locale.ROOT);
        for (String prefix : new String[] {
                "class=", "?class=",
                "request_number=", "?request_number=",
                "requestnumber=", "?requestnumber="
        }) {
            if (normalized.startsWith(prefix)) {
                raw = raw.substring(prefix.length());
                normalized = raw.toLowerCase(Locale.ROOT);
                break;
            }
        }
        int ampIndex = raw.indexOf('&');
        if (ampIndex >= 0) {
            raw = raw.substring(0, ampIndex);
        }
        return raw.trim().toLowerCase(Locale.ROOT);
    }

    private String padTwoDigits(String value) {
        if (value.length() == 1) {
            return "0" + value;
        }
        return value;
    }

    private String resolveAppointmentListClass(OrcaAppointmentListRequest request) {
        String classCode = request != null ? request.getClassCode() : null;
        if (classCode == null || classCode.isBlank()) {
            return "01";
        }
        String normalized = classCode.trim();
        if (normalized.matches("\\d{1,2}")) {
            return padTwoDigits(normalized);
        }
        return normalized;
    }

    private String buildAppointmentListPayload(LocalDate date, OrcaAppointmentListRequest request) {
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.APPOINTMENT_LIST, resolveAppointmentListClass(request)));
        builder.append("<data><appointlstreq>");
        builder.append("<Appointment_Date>").append(date).append("</Appointment_Date>");
        if (request.getMedicalInformation() != null) {
            builder.append("<Medical_Information>").append(request.getMedicalInformation()).append("</Medical_Information>");
        }
        if (request.getPhysicianCode() != null) {
            builder.append("<Physician_Code>").append(request.getPhysicianCode()).append("</Physician_Code>");
        }
        builder.append("</appointlstreq></data>");
        return builder.toString();
    }

    private DateRange resolveAppointmentRange(OrcaAppointmentListRequest request) {
        LocalDate from = request.getFromDate();
        LocalDate to = request.getToDate();
        LocalDate appointmentDate = request.getAppointmentDate();
        if (appointmentDate != null) {
            from = appointmentDate;
            to = appointmentDate;
        } else {
            if (from == null && to != null) {
                from = to;
            }
            if (from == null) {
                from = LocalDate.now();
            }
            if (to == null) {
                to = from;
            }
        }
        if (to.isBefore(from)) {
            to = from;
        }
        enforceRangeLimit(from, to, MAX_APPOINTMENT_RANGE_DAYS, "appointmentDate");
        return new DateRange(from, to);
    }

    private void enforceRangeLimit(LocalDate from, LocalDate to, int maxDays, String label) {
        if (from == null || to == null) {
            return;
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > maxDays) {
            throw new OrcaGatewayException(label + " range too wide; up to " + maxDays + " days are allowed");
        }
    }

    private record DateRange(LocalDate from, LocalDate to) {
    }

    private String buildVisitListPayload(VisitPatientListRequest request, DateRange range) {
        String requestNumber = request.getRequestNumber();
        if (requestNumber == null || requestNumber.isBlank()) {
            requestNumber = "01";
        } else {
            requestNumber = padTwoDigits(requireText(requestNumber, "requestNumber"));
        }
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.VISIT_LIST, null));
        builder.append("<data>");
        builder.append("<visitptlstreq type=\"record\">");
        builder.append("<Request_Number type=\"string\">").append(requestNumber).append("</Request_Number>");
        builder.append("<Visit_Date type=\"string\">").append(range.from()).append("</Visit_Date>");
        if (!range.to().equals(range.from())) {
            builder.append("<Visit_Date_End type=\"string\">").append(range.to()).append("</Visit_Date_End>");
        }
        builder.append("</visitptlstreq>");
        builder.append("</data>");
        return builder.toString();
    }

    private DateRange resolveVisitRange(VisitPatientListRequest request) {
        LocalDate from = request.getFromDate();
        LocalDate to = request.getToDate();
        if (request.getVisitDate() != null) {
            from = request.getVisitDate();
            to = request.getVisitDate();
        }
        if (from == null && to == null) {
            throw new OrcaGatewayException("visitDate or fromDate/toDate is required");
        }
        if (from == null) {
            from = to;
        }
        if (to == null) {
            to = from;
        }
        if (to.isBefore(from)) {
            to = from;
        }
        enforceRangeLimit(from, to, MAX_VISIT_RANGE_DAYS, "visitDate");
        return new DateRange(from, to);
    }

    private String buildPatientAppointmentListPayload(PatientAppointmentListRequest request) {
        String patientId = requireText(request.getPatientId(), "patientId");
        LocalDate baseDate = request.getBaseDate() != null ? request.getBaseDate() : LocalDate.now();
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.PATIENT_APPOINTMENT_LIST, null));
        builder.append("<data><appointlst2req>");
        builder.append("<Patient_ID>").append(patientId).append("</Patient_ID>");
        builder.append("<Base_Date>").append(baseDate).append("</Base_Date>");
        if (request.getDepartmentCode() != null && !request.getDepartmentCode().isBlank()) {
            builder.append("<Department_Code>").append(request.getDepartmentCode()).append("</Department_Code>");
        }
        builder.append("</appointlst2req></data>");
        return builder.toString();
    }

    private String buildBillingSimulationPayload(BillingSimulationRequest request, InsuranceSelection selection) {
        String patientId = requireNumericId(request.getPatientId(), "patientId");
        String departmentCode = requireText(request.getDepartmentCode(), "departmentCode");
        LocalDate performDate = request.getPerformDate() != null ? request.getPerformDate() : LocalDate.now();
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new OrcaGatewayException("items is required");
        }
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.BILLING_SIMULATION, "01"));
        builder.append("<data>");
        builder.append("<acsimulatereq type=\"record\">");
        builder.append("<Patient_ID type=\"string\">").append(patientId).append("</Patient_ID>");
        builder.append("<Perform_Date type=\"string\">").append(performDate).append("</Perform_Date>");
        builder.append("<Perform_Time type=\"string\"></Perform_Time>");
        builder.append("<Time_Class type=\"string\">0</Time_Class>");
        builder.append("<Diagnosis_Information type=\"record\">");
        builder.append("<Department_Code type=\"string\">").append(departmentCode).append("</Department_Code>");
        appendInsuranceInfo(builder, selection);
        builder.append("<Medical_Information type=\"array\">");
        builder.append("<Medical_Information_child type=\"record\">");
        builder.append("<Medical_Class type=\"string\">11</Medical_Class>");
        builder.append("<Medical_Class_Name type=\"string\">Medical</Medical_Class_Name>");
        builder.append("<Medical_Class_Number type=\"string\">1</Medical_Class_Number>");
        builder.append("<Medication_info type=\"array\">");
        int itemCount = 0;
        for (BillingSimulationRequest.BillingItem item : request.getItems()) {
            if (item == null || item.getMedicalCode() == null || item.getMedicalCode().isBlank()) {
                continue;
            }
            int quantity = item.getQuantity();
            if (quantity <= 0) {
                quantity = 1;
            }
            builder.append("<Medication_info_child type=\"record\">");
            builder.append("<Medication_Code type=\"string\">").append(item.getMedicalCode()).append("</Medication_Code>");
            builder.append("<Medication_Number type=\"string\">").append(quantity).append("</Medication_Number>");
            builder.append("</Medication_info_child>");
            itemCount++;
        }
        if (itemCount == 0) {
            throw new OrcaGatewayException("items.medicalCode is required");
        }
        builder.append("</Medication_info>");
        builder.append("</Medical_Information_child>");
        builder.append("</Medical_Information>");
        builder.append("</Diagnosis_Information>");
        builder.append("</acsimulatereq>");
        builder.append("</data>");
        return builder.toString();
    }

    private InsuranceSelection resolveInsuranceSelection(BillingSimulationRequest request) {
        String patientId = requireNumericId(request.getPatientId(), "patientId");
        LocalDate performDate = request.getPerformDate() != null ? request.getPerformDate() : LocalDate.now();
        PatientBatchRequest batchRequest = new PatientBatchRequest();
        batchRequest.getPatientIds().add(patientId);
        PatientBatchResponse batchResponse = getPatientBatch(batchRequest);
        PatientDetail detail = null;
        if (batchResponse != null && batchResponse.getPatients() != null) {
            for (PatientDetail candidate : batchResponse.getPatients()) {
                if (candidate != null && candidate.getSummary() != null
                        && patientId.equals(candidate.getSummary().getPatientId())) {
                    detail = candidate;
                    break;
                }
            }
        }
        InsuranceCombination insurance = selectInsurance(detail, performDate);
        java.util.List<PublicInsuranceInfo> publicInsurances = selectPublicInsurances(detail, insurance, performDate);
        return new InsuranceSelection(insurance, publicInsurances);
    }

    private InsuranceCombination selectInsurance(PatientDetail detail, LocalDate performDate) {
        if (detail == null || detail.getInsurances() == null || detail.getInsurances().isEmpty()) {
            return null;
        }
        InsuranceCombination fallback = null;
        for (InsuranceCombination insurance : detail.getInsurances()) {
            if (insurance == null) {
                continue;
            }
            if (fallback == null) {
                fallback = insurance;
            }
            if (isEffectiveOn(insurance.getCertificateStartDate(), insurance.getCertificateExpiredDate(), performDate)) {
                return insurance;
            }
        }
        return fallback;
    }

    private java.util.List<PublicInsuranceInfo> selectPublicInsurances(
            PatientDetail detail, InsuranceCombination insurance, LocalDate performDate) {
        java.util.List<PublicInsuranceInfo> merged = new java.util.ArrayList<>();
        if (detail != null && detail.getPublicInsurances() != null) {
            for (PublicInsuranceInfo info : detail.getPublicInsurances()) {
                if (info == null) {
                    continue;
                }
                if (isEffectiveOn(info.getCertificateIssuedDate(), info.getCertificateExpiredDate(), performDate)) {
                    merged.add(info);
                }
            }
            if (merged.isEmpty()) {
                merged.addAll(detail.getPublicInsurances());
            }
        }
        if (insurance != null && insurance.getPublicInsurances() != null) {
            for (PublicInsuranceInfo info : insurance.getPublicInsurances()) {
                if (info == null) {
                    continue;
                }
                if (isEffectiveOn(info.getCertificateIssuedDate(), info.getCertificateExpiredDate(), performDate)) {
                    merged.add(info);
                }
            }
            if (merged.isEmpty()) {
                merged.addAll(insurance.getPublicInsurances());
            }
        }
        return merged;
    }

    private boolean isEffectiveOn(String start, String end, LocalDate target) {
        if (target == null) {
            return true;
        }
        LocalDate startDate = parseOrcaDate(start);
        LocalDate endDate = parseOrcaDate(end);
        if (startDate != null && target.isBefore(startDate)) {
            return false;
        }
        if (endDate != null && target.isAfter(endDate)) {
            return false;
        }
        return true;
    }

    private LocalDate parseOrcaDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if ("0000-00-00".equals(trimmed) || "00000000".equals(trimmed)) {
            return null;
        }
        try {
            if (trimmed.length() == 8 && trimmed.charAt(4) != '-') {
                String normalized = trimmed.substring(0, 4) + "-" + trimmed.substring(4, 6) + "-" + trimmed.substring(6);
                return LocalDate.parse(normalized);
            }
            return LocalDate.parse(trimmed);
        } catch (Exception ex) {
            return null;
        }
    }

    private void appendInsuranceInfo(StringBuilder builder, InsuranceSelection selection) {
        if (selection == null) {
            return;
        }
        InsuranceCombination insurance = selection.insurance;
        java.util.List<PublicInsuranceInfo> publicInsurances = selection.publicInsurances;
        if (insurance == null && (publicInsurances == null || publicInsurances.isEmpty())) {
            return;
        }
        builder.append("<HealthInsurance_Information type=\"record\">");
        if (insurance != null) {
            appendXml2Tag(builder, "Insurance_Combination_Number", insurance.getCombinationNumber());
            appendXml2Tag(builder, "InsuranceProvider_Class", insurance.getInsuranceProviderClass());
            appendXml2Tag(builder, "InsuranceProvider_Number", insurance.getInsuranceProviderNumber());
            appendXml2Tag(builder, "InsuranceProvider_WholeName", insurance.getInsuranceProviderName());
            appendXml2Tag(builder, "HealthInsuredPerson_Symbol", insurance.getInsuredPersonSymbol());
            appendXml2Tag(builder, "HealthInsuredPerson_Number", insurance.getInsuredPersonNumber());
            appendXml2Tag(builder, "HealthInsuredPerson_Branch_Number", insurance.getInsuredPersonBranchNumber());
            appendXml2Tag(builder, "HealthInsuredPerson_Assistance", insurance.getInsuredPersonAssistance());
            appendXml2Tag(builder, "RelationToInsuredPerson", insurance.getRelationToInsuredPerson());
            appendXml2Tag(builder, "HealthInsuredPerson_WholeName", insurance.getInsuredPersonWholeName());
            appendXml2Tag(builder, "Certificate_StartDate", insurance.getCertificateStartDate());
            appendXml2Tag(builder, "Certificate_ExpiredDate", insurance.getCertificateExpiredDate());
        }
        if (publicInsurances != null && !publicInsurances.isEmpty()) {
            builder.append("<PublicInsurance_Information type=\"array\">");
            for (PublicInsuranceInfo info : publicInsurances) {
                if (info == null) {
                    continue;
                }
                builder.append("<PublicInsurance_Information_child type=\"record\">");
                appendXml2Tag(builder, "PublicInsurance_Class", info.getPublicInsuranceClass());
                appendXml2Tag(builder, "PublicInsurance_Name", info.getPublicInsuranceName());
                appendXml2Tag(builder, "PublicInsurer_Number", info.getPublicInsurerNumber());
                appendXml2Tag(builder, "PublicInsuredPerson_Number", info.getPublicInsuredPersonNumber());
                appendXml2Tag(builder, "Rate_Admission", info.getRateAdmission());
                appendXml2Tag(builder, "Rate_Outpatient", info.getRateOutpatient());
                appendXml2Tag(builder, "Certificate_IssuedDate", info.getCertificateIssuedDate());
                appendXml2Tag(builder, "Certificate_ExpiredDate", info.getCertificateExpiredDate());
                builder.append("</PublicInsurance_Information_child>");
            }
            builder.append("</PublicInsurance_Information>");
        }
        builder.append("</HealthInsurance_Information>");
    }

    private String buildPatientIdListPayload(PatientIdListRequest request) {
        if (request.getStartDate() == null) {
            throw new OrcaGatewayException("startDate is required");
        }
        LocalDate startDate = request.getStartDate();
        LocalDate endDate = request.getEndDate() != null ? request.getEndDate() : startDate;
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.PATIENT_ID_LIST, request.getClassCode()));
        builder.append("<data><patientlst1req>");
        builder.append("<Base_StartDate>").append(startDate).append("</Base_StartDate>");
        builder.append("<Base_StartTime>00:00:00</Base_StartTime>");
        builder.append("<Base_EndDate>").append(endDate).append("</Base_EndDate>");
        builder.append("<Contain_TestPatient_Flag>")
                // ORCA仕様: 1 が「テスト患者を対象外」。includeTestPatient=true のときは除外しない (=0)。
                .append(request.isIncludeTestPatient() ? "0" : "1")
                .append("</Contain_TestPatient_Flag>");
        builder.append("</patientlst1req></data>");
        return builder.toString();
    }

    private String buildPatientBatchPayload(PatientBatchRequest request) {
        if (request.getPatientIds() == null || request.getPatientIds().isEmpty()) {
            throw new OrcaGatewayException("patientIds is required");
        }
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.PATIENT_BATCH, "01"));
        builder.append("<data>");
        builder.append("<patientlst2req type=\"record\">");
        builder.append("<Patient_ID_Information type=\"array\">");
        int count = 0;
        for (String patientId : request.getPatientIds()) {
            if (patientId == null || patientId.isBlank()) {
                continue;
            }
            String normalized = requireNumericId(patientId, "patientId");
            builder.append("<Patient_ID_Information_child type=\"record\">");
            builder.append("<Patient_ID type=\"string\">").append(normalized).append("</Patient_ID>");
            builder.append("</Patient_ID_Information_child>");
            count++;
        }
        builder.append("</Patient_ID_Information>");
        builder.append("</patientlst2req>");
        builder.append("</data>");
        if (count == 0) {
            throw new OrcaGatewayException("patientIds is required");
        }
        return builder.toString();
    }

    private String buildPatientSearchPayload(PatientNameSearchRequest request) {
        String searchName = request.getName();
        String searchKana = request.getKana();
        if ((searchName == null || searchName.isBlank()) && (searchKana == null || searchKana.isBlank())) {
            throw new OrcaGatewayException("name or kana is required");
        }
        LocalDate birthStartDate = request.getBirthStartDate();
        LocalDate birthEndDate = request.getBirthEndDate();
        if (birthEndDate != null && birthStartDate == null) {
            throw new OrcaGatewayException("birthStartDate is required when birthEndDate is provided");
        }
        if (birthStartDate != null && birthEndDate != null && birthEndDate.isBefore(birthStartDate)) {
            throw new OrcaGatewayException("birthEndDate must be after birthStartDate");
        }
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.PATIENT_NAME_SEARCH, "01"));
        builder.append("<data><patientlst3req>");
        if (searchName != null && !searchName.isBlank()) {
            builder.append("<WholeName>").append(searchName).append("</WholeName>");
        } else {
            builder.append("<WholeName_inKana>").append(searchKana).append("</WholeName_inKana>");
        }
        if (birthStartDate != null) {
            builder.append("<Birth_StartDate>").append(birthStartDate).append("</Birth_StartDate>");
            if (birthEndDate == null) {
                birthEndDate = birthStartDate;
            }
        }
        if (birthEndDate != null) {
            builder.append("<Birth_EndDate>").append(birthEndDate).append("</Birth_EndDate>");
        }
        if (request.getSex() != null && !request.getSex().isBlank()) {
            builder.append("<Sex>").append(request.getSex()).append("</Sex>");
        }
        if (request.getInOut() != null && !request.getInOut().isBlank()) {
            builder.append("<InOut>").append(request.getInOut()).append("</InOut>");
        }
        if (request.getFuzzyMode() != null && !request.getFuzzyMode().isBlank()) {
            builder.append("<Fuzzy_Mode>").append(request.getFuzzyMode()).append("</Fuzzy_Mode>");
        }
        builder.append("</patientlst3req></data>");
        return builder.toString();
    }

    private String buildInsuranceCombinationPayload(InsuranceCombinationRequest request) {
        String patientId = requireText(request.getPatientId(), "patientId");
        String baseDate = request.getBaseDate();
        String rangeStart = request.getRangeStart();
        String rangeEnd = request.getRangeEnd();
        if (baseDate == null || baseDate.isBlank()) {
            baseDate = rangeStart != null ? rangeStart : LocalDate.now().toString();
        }
        String startDate = rangeStart != null ? rangeStart : baseDate;
        String endDate = rangeEnd != null ? rangeEnd : baseDate;
        String requestNumber = "P6-" + LocalDate.now();
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.INSURANCE_COMBINATION, null));
        builder.append("<data><patientlst6req>");
        builder.append("<Reqest_Number>").append(requestNumber).append("</Reqest_Number>");
        builder.append("<Patient_ID>").append(patientId).append("</Patient_ID>");
        builder.append("<Base_Date>").append(baseDate).append("</Base_Date>");
        builder.append("<Start_Date>").append(startDate).append("</Start_Date>");
        builder.append("<End_Date>").append(endDate).append("</End_Date>");
        builder.append("</patientlst6req></data>");
        return builder.toString();
    }

    private String buildFormerNameHistoryPayload(FormerNameHistoryRequest request) {
        String patientId = requireText(request.getPatientId(), "patientId");
        String requestNumber = "FORMER-NAME-" + LocalDate.now();
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.FORMER_NAME_HISTORY, null));
        builder.append("<data><patientlst8req>");
        builder.append("<Request_Number>").append(requestNumber).append("</Request_Number>");
        builder.append("<Patient_ID>").append(patientId).append("</Patient_ID>");
        builder.append("</patientlst8req></data>");
        return builder.toString();
    }

    private String buildAppointmentMutationPayload(AppointmentMutationRequest request) {
        String requestNumber = normalizeAppointmentClass(request.getRequestNumber());
        String patientId = request.getPatient() != null ? request.getPatient().getPatientId() : null;
        patientId = requireText(patientId, "patientId");
        String appointmentDate = requireText(request.getAppointmentDate(), "appointmentDate");
        String appointmentTime = requireText(request.getAppointmentTime(), "appointmentTime");
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.APPOINTMENT_MUTATION, requestNumber));
        builder.append("<data><appointreq>");
        builder.append("<Patient_ID>").append(patientId).append("</Patient_ID>");
        if (request.getPatient() != null) {
            if (request.getPatient().getWholeName() != null && !request.getPatient().getWholeName().isBlank()) {
                builder.append("<WholeName>").append(request.getPatient().getWholeName()).append("</WholeName>");
            }
            if (request.getPatient().getWholeNameKana() != null && !request.getPatient().getWholeNameKana().isBlank()) {
                builder.append("<WholeName_inKana>").append(request.getPatient().getWholeNameKana())
                        .append("</WholeName_inKana>");
            }
        }
        builder.append("<Appointment_Date>").append(appointmentDate).append("</Appointment_Date>");
        builder.append("<Appointment_Time>").append(appointmentTime).append("</Appointment_Time>");
        if (request.getAppointmentId() != null && !request.getAppointmentId().isBlank()) {
            builder.append("<Appointment_Id>").append(request.getAppointmentId()).append("</Appointment_Id>");
        }
        if (request.getDepartmentCode() != null && !request.getDepartmentCode().isBlank()) {
            builder.append("<Department_Code>").append(request.getDepartmentCode()).append("</Department_Code>");
        }
        if (request.getPhysicianCode() != null && !request.getPhysicianCode().isBlank()) {
            builder.append("<Physician_Code>").append(request.getPhysicianCode()).append("</Physician_Code>");
        }
        if (request.getMedicalInformation() != null && !request.getMedicalInformation().isBlank()) {
            builder.append("<Medical_Information>").append(request.getMedicalInformation()).append("</Medical_Information>");
        }
        if (request.getAppointmentInformation() != null && !request.getAppointmentInformation().isBlank()) {
            builder.append("<Appointment_Information>").append(request.getAppointmentInformation())
                    .append("</Appointment_Information>");
        }
        if (request.getAppointmentNote() != null && !request.getAppointmentNote().isBlank()) {
            builder.append("<Appointment_Note>").append(request.getAppointmentNote()).append("</Appointment_Note>");
        }
        if (request.getDuplicateMode() != null && !request.getDuplicateMode().isBlank()) {
            builder.append("<Duplicate_Mode>").append(request.getDuplicateMode()).append("</Duplicate_Mode>");
        }
        if (request.getVisitInformation() != null && !request.getVisitInformation().isBlank()) {
            builder.append("<Visit_Information>").append(request.getVisitInformation()).append("</Visit_Information>");
        }
        builder.append("</appointreq></data>");
        return builder.toString();
    }

    private String buildVisitMutationPayload(VisitMutationRequest request) {
        String requestNumber = normalizeAcceptRequestNumber(request.getRequestNumber());
        String patientId = requireText(request.getPatientId(), "patientId");
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.ACCEPTANCE_MUTATION, null));
        builder.append("<data><acceptreq>");
        builder.append("<Request_Number>").append(requestNumber).append("</Request_Number>");
        builder.append("<Patient_ID>").append(patientId).append("</Patient_ID>");
        if (request.getWholeName() != null && !request.getWholeName().isBlank()) {
            builder.append("<WholeName>").append(request.getWholeName()).append("</WholeName>");
        }
        if (request.getAcceptancePush() != null && !request.getAcceptancePush().isBlank()) {
            builder.append("<Acceptance_Push>").append(request.getAcceptancePush()).append("</Acceptance_Push>");
        }
        if (request.getAcceptanceDate() != null && !request.getAcceptanceDate().isBlank()) {
            builder.append("<Acceptance_Date>").append(request.getAcceptanceDate()).append("</Acceptance_Date>");
        }
        if (request.getAcceptanceTime() != null && !request.getAcceptanceTime().isBlank()) {
            builder.append("<Acceptance_Time>").append(request.getAcceptanceTime()).append("</Acceptance_Time>");
        }
        if (request.getAcceptanceId() != null && !request.getAcceptanceId().isBlank()) {
            builder.append("<Acceptance_Id>").append(request.getAcceptanceId()).append("</Acceptance_Id>");
        }
        if (request.getDepartmentCode() != null && !request.getDepartmentCode().isBlank()) {
            builder.append("<Department_Code>").append(request.getDepartmentCode()).append("</Department_Code>");
        }
        if (request.getPhysicianCode() != null && !request.getPhysicianCode().isBlank()) {
            builder.append("<Physician_Code>").append(request.getPhysicianCode()).append("</Physician_Code>");
        }
        if (request.getMedicalInformation() != null && !request.getMedicalInformation().isBlank()) {
            builder.append("<Medical_Information>").append(request.getMedicalInformation()).append("</Medical_Information>");
        }
        if (request.getInsurances() != null && !request.getInsurances().isEmpty()) {
            for (VisitMutationRequest.InsuranceInformation insurance : request.getInsurances()) {
                if (insurance == null) {
                    continue;
                }
                builder.append("<HealthInsurance_Information>");
                appendTag(builder, "Insurance_Combination_Number", insurance.getInsuranceCombinationNumber());
                appendTag(builder, "InsuranceProvider_Class", insurance.getInsuranceProviderClass());
                appendTag(builder, "InsuranceProvider_Number", insurance.getInsuranceProviderNumber());
                appendTag(builder, "InsuranceProvider_WholeName", insurance.getInsuranceProviderWholeName());
                appendTag(builder, "HealthInsuredPerson_Symbol", insurance.getHealthInsuredPersonSymbol());
                appendTag(builder, "HealthInsuredPerson_Number", insurance.getHealthInsuredPersonNumber());
                appendTag(builder, "HealthInsuredPerson_Branch_Number", insurance.getHealthInsuredPersonBranchNumber());
                appendTag(builder, "HealthInsuredPerson_Continuation", insurance.getHealthInsuredPersonContinuation());
                appendTag(builder, "RelationToInsuredPerson", insurance.getRelationToInsuredPerson());
                appendTag(builder, "Certificate_StartDate", insurance.getCertificateStartDate());
                appendTag(builder, "Certificate_ExpiredDate", insurance.getCertificateExpiredDate());
                if (insurance.getPublicInsurances() != null && !insurance.getPublicInsurances().isEmpty()) {
                    for (VisitMutationRequest.PublicInsuranceInformation publicInsurance : insurance.getPublicInsurances()) {
                        if (publicInsurance == null) {
                            continue;
                        }
                        builder.append("<PublicInsurance_Information>");
                        appendTag(builder, "PublicInsurance_Class", publicInsurance.getPublicInsuranceClass());
                        appendTag(builder, "PublicInsurance_Name", publicInsurance.getPublicInsuranceName());
                        appendTag(builder, "PublicInsuredPerson_Number", publicInsurance.getPublicInsuredPersonNumber());
                        appendTag(builder, "Rate_Admission", publicInsurance.getRateAdmission());
                        appendTag(builder, "Rate_Outpatient", publicInsurance.getRateOutpatient());
                        builder.append("</PublicInsurance_Information>");
                    }
                }
                builder.append("</HealthInsurance_Information>");
            }
        }
        builder.append("</acceptreq></data>");
        return builder.toString();
    }

    private void appendTag(StringBuilder builder, String tag, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        builder.append('<').append(tag).append('>').append(value).append("</").append(tag).append('>');
    }

    private void appendXml2Tag(StringBuilder builder, String tag, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        builder.append('<').append(tag).append(" type=\"string\">").append(value).append("</").append(tag).append('>');
    }
}
