package open.dolphin.orca.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.AcceptanceInventoryRequest;
import open.dolphin.rest.dto.orca.AcceptanceInventoryResponse;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.FormerNameHistoryRequest;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
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
import open.dolphin.rest.dto.orca.VisitPatientListRequest;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;

final class OrcaLiveGatewaySupport {

    private final OrcaLiveGatewayMutationSupport mutationSupport = new OrcaLiveGatewayMutationSupport();

    void enrich(OrcaApiResponse response, OrcaTransportResult result) {
        if (response != null) {
            if (response.getRunId() == null || response.getRunId().isBlank()) {
                response.setRunId(open.dolphin.rest.orca.AbstractOrcaRestResource.resolveRunIdValue((String) null));
            }
            response.setBlockerTag(null);
            if (response.getDataSource() == null || response.getDataSource().isBlank()) {
                response.setDataSource(resolveDataSource(result));
            }
        }
    }

    String resolveDataSource(OrcaTransportResult result) {
        if (result != null && result.getHeaders() != null) {
            for (java.util.Map.Entry<String, List<String>> entry : result.getHeaders().entrySet()) {
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

    void ensureNotNull(Object target, String label) {
        if (target == null) {
            throw new OrcaGatewayException(label + " must not be null");
        }
    }

    String requireText(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new OrcaGatewayException(label + " is required");
        }
        return value.trim();
    }

    String requireNumericId(String value, String label) {
        String trimmed = requireText(value, label);
        if (!trimmed.matches("\\d+")) {
            throw new OrcaGatewayException(label + " must be numeric");
        }
        return trimmed;
    }

    String buildOrcaMeta(OrcaEndpoint endpoint, String classCode) {
        return mutationSupport.buildOrcaMeta(endpoint, classCode);
    }

    String normalizeAppointmentClass(String value) {
        return mutationSupport.normalizeAppointmentClass(value);
    }

    String normalizeAcceptRequestNumber(String value) {
        return mutationSupport.normalizeAcceptRequestNumber(value);
    }

    String normalizeToken(String value, String label) {
        return mutationSupport.normalizeToken(value, label);
    }

    String padTwoDigits(String value) {
        return mutationSupport.padTwoDigits(value);
    }

    String resolveAppointmentListClass(OrcaAppointmentListRequest request) {
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

    String buildAppointmentListPayload(LocalDate date, OrcaAppointmentListRequest request) {
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

    DateRange resolveAppointmentRange(OrcaAppointmentListRequest request) {
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
        enforceRangeLimit(from, to, OrcaLiveGateway.MAX_APPOINTMENT_RANGE_DAYS, "appointmentDate");
        return new DateRange(from, to);
    }

    void enforceRangeLimit(LocalDate from, LocalDate to, int maxDays, String label) {
        if (from == null || to == null) {
            return;
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > maxDays) {
            throw new OrcaGatewayException(label + " range too wide; up to " + maxDays + " days are allowed");
        }
    }

    String buildVisitListPayload(VisitPatientListRequest request, DateRange range) {
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
        if (request.getDepartmentCode() != null && !request.getDepartmentCode().isBlank()) {
            builder.append("<Department_Code type=\"string\">")
                    .append(request.getDepartmentCode().trim())
                    .append("</Department_Code>");
        }
        builder.append("</visitptlstreq>");
        builder.append("</data>");
        return builder.toString();
    }

    String buildAcceptanceInventoryPayload(AcceptanceInventoryRequest request) {
        if (request == null || request.getAcceptanceDate() == null) {
            throw new OrcaGatewayException("acceptanceDate is required");
        }
        String classCode = normalizeAcceptanceInventoryClass(request.getClassCode());
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.ACCEPTANCE_LIST, classCode));
        builder.append("<data>");
        builder.append("<acceptlstreq type=\"record\">");
        builder.append("<Acceptance_Date type=\"string\">")
                .append(request.getAcceptanceDate())
                .append("</Acceptance_Date>");
        if (request.getDepartmentCode() != null && !request.getDepartmentCode().isBlank()) {
            builder.append("<Department_Code type=\"string\">")
                    .append(request.getDepartmentCode().trim())
                    .append("</Department_Code>");
        }
        builder.append("</acceptlstreq>");
        builder.append("</data>");
        return builder.toString();
    }

    String normalizeAcceptanceInventoryClass(String value) {
        String normalized = value == null || value.isBlank() ? "01" : padTwoDigits(requireText(value, "classCode"));
        if (!"01".equals(normalized) && !"02".equals(normalized) && !"03".equals(normalized)) {
            throw new OrcaGatewayException("classCode must be one of 01, 02, or 03");
        }
        return normalized;
    }

    String normalizeMedicalGetClassCode(String value) {
        String normalized = value == null || value.isBlank() ? "01" : padTwoDigits(requireText(value, "medicalGetClassCode"));
        if (!"01".equals(normalized) && !"02".equals(normalized) && !"03".equals(normalized)
                && !"04".equals(normalized)) {
            throw new OrcaGatewayException("medicalGetClassCode must be one of 01, 02, 03, or 04");
        }
        return normalized;
    }

    AcceptanceInventoryResponse.AcceptanceInventoryRow selectMedicalIdentifierTarget(
            AcceptanceInventoryResponse inventory,
            String targetRowHash) {
        if (inventory == null || inventory.getRows() == null || inventory.getRows().isEmpty()) {
            throw new OrcaGatewayException("acceptance inventory has no rows");
        }
        String normalizedHash = targetRowHash == null ? "" : targetRowHash.trim().toLowerCase(java.util.Locale.ROOT);
        for (AcceptanceInventoryResponse.AcceptanceInventoryRow row : inventory.getRows()) {
            if (!isMedicalIdentifierTargetReady(row)) {
                continue;
            }
            if (normalizedHash.isBlank() || normalizedHash.equals(row.getRowHash())) {
                return row;
            }
        }
        throw new OrcaGatewayException("no target-ready acceptance row matched the requested row hash");
    }

    boolean isMedicalIdentifierTargetReady(AcceptanceInventoryResponse.AcceptanceInventoryRow row) {
        return row != null
                && row.isRawSensitiveFieldsExcluded()
                && row.isHasPatientId()
                && row.isHasAcceptanceDate()
                && row.isHasDepartmentCode()
                && row.isHasInsuranceCombinationNumber()
                && row.getServerPatientId() != null && !row.getServerPatientId().isBlank()
                && row.getServerAcceptanceDate() != null && !row.getServerAcceptanceDate().isBlank()
                && row.getServerDepartmentCode() != null && !row.getServerDepartmentCode().isBlank()
                && row.getServerInsuranceCombinationNumber() != null
                && !row.getServerInsuranceCombinationNumber().isBlank();
    }

    String buildMedicalIdentifierPayload(
            AcceptanceInventoryResponse.AcceptanceInventoryRow row,
            String medicalGetClassCode) {
        String classCode = normalizeMedicalGetClassCode(medicalGetClassCode);
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.MEDICAL_GET, classCode));
        builder.append("<data>");
        builder.append("<medicalgetreq type=\"record\">");
        builder.append("<Patient_ID type=\"string\">").append(requireIdentifierToken(row.getServerPatientId(), "patientId"))
                .append("</Patient_ID>");
        builder.append("<Perform_Date type=\"string\">").append(requireDateToken(row.getServerAcceptanceDate(), "performDate"))
                .append("</Perform_Date>");
        builder.append("<Medical_Information type=\"record\">");
        builder.append("<Department_Code type=\"string\">")
                .append(requireIdentifierToken(row.getServerDepartmentCode(), "departmentCode"))
                .append("</Department_Code>");
        builder.append("<Insurance_Combination_Number type=\"string\">")
                .append(requireIdentifierToken(row.getServerInsuranceCombinationNumber(), "insuranceCombinationNumber"))
                .append("</Insurance_Combination_Number>");
        builder.append("</Medical_Information>");
        builder.append("</medicalgetreq>");
        builder.append("</data>");
        return builder.toString();
    }

    private String requireIdentifierToken(String value, String label) {
        String token = requireText(value, label);
        if (!token.matches("[0-9A-Za-z._:-]+")) {
            throw new OrcaGatewayException(label + " contains unsupported characters");
        }
        return token;
    }

    private String requireDateToken(String value, String label) {
        String token = requireText(value, label);
        if (!token.matches("\\d{4}-\\d{2}-\\d{2}|\\d{8}")) {
            throw new OrcaGatewayException(label + " must be an ORCA date token");
        }
        return token;
    }

    DateRange resolveVisitRange(VisitPatientListRequest request) {
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
        enforceRangeLimit(from, to, OrcaLiveGateway.MAX_VISIT_RANGE_DAYS, "visitDate");
        return new DateRange(from, to);
    }

    String buildPatientAppointmentListPayload(PatientAppointmentListRequest request) {
        String patientId = requireText(request.getPatientId(), "patientId");
        LocalDate baseDate = request.getBaseDate() != null ? request.getBaseDate() : LocalDate.now();
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.PATIENT_APPOINTMENT_LIST, "01"));
        builder.append("<data><appointlst2req>");
        builder.append("<Patient_ID>").append(patientId).append("</Patient_ID>");
        builder.append("<Base_Date>").append(baseDate).append("</Base_Date>");
        builder.append("</appointlst2req></data>");
        return builder.toString();
    }

    String buildBillingSimulationPayload(BillingSimulationRequest request, InsuranceSelection selection) {
        return mutationSupport.buildBillingSimulationPayload(request, selection);
    }

    InsuranceSelection resolveInsuranceSelection(String facilityId, BillingSimulationRequest request, OrcaLiveGateway owner) {
        String resolvedFacilityId = requireText(facilityId, "facilityId");
        String patientId = requireNumericId(request.getPatientId(), "patientId");
        LocalDate performDate = request.getPerformDate() != null ? request.getPerformDate() : LocalDate.now();
        PatientBatchRequest batchRequest = new PatientBatchRequest();
        batchRequest.getPatientIds().add(patientId);
        PatientBatchResponse batchResponse = owner.getPatientBatch(resolvedFacilityId, batchRequest);
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
        List<PublicInsuranceInfo> publicInsurances = selectPublicInsurances(detail, insurance, performDate);
        return new OrcaLiveGatewaySupport.InsuranceSelection(insurance, publicInsurances);
    }

    InsuranceCombination selectInsurance(PatientDetail detail, LocalDate performDate) {
        return mutationSupport.selectInsurance(detail, performDate);
    }

    List<PublicInsuranceInfo> selectPublicInsurances(
            PatientDetail detail, InsuranceCombination insurance, LocalDate performDate) {
        return mutationSupport.selectPublicInsurances(detail, insurance, performDate);
    }

    boolean isEffectiveOn(String start, String end, LocalDate target) {
        return mutationSupport.isEffectiveOn(start, end, target);
    }

    LocalDate parseOrcaDate(String value) {
        return mutationSupport.parseOrcaDate(value);
    }

    void appendInsuranceInfo(StringBuilder builder, InsuranceSelection selection) {
        mutationSupport.appendInsuranceInfo(builder, selection);
    }

    String buildPatientIdListPayload(PatientIdListRequest request) {
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
                .append(request.isIncludeTestPatient() ? "0" : "1")
                .append("</Contain_TestPatient_Flag>");
        builder.append("</patientlst1req></data>");
        return builder.toString();
    }

    String buildPatientBatchPayload(PatientBatchRequest request) {
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
            builder.append("<Patient_ID_Information_child type=\"record\">");
            builder.append("<Patient_ID type=\"string\">").append(patientId).append("</Patient_ID>");
            builder.append("</Patient_ID_Information_child>");
            count++;
        }
        if (count == 0) {
            throw new OrcaGatewayException("patientIds is required");
        }
        builder.append("</Patient_ID_Information>");
        builder.append("</patientlst2req>");
        builder.append("</data>");
        return builder.toString();
    }

    String buildPatientSearchPayload(PatientNameSearchRequest request) {
        String wholeName = request.getName() != null ? request.getName().trim() : null;
        if (wholeName == null || wholeName.isBlank()) {
            throw new OrcaGatewayException("name is required");
        }
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.PATIENT_NAME_SEARCH, "01"));
        builder.append("<data><patientlst3req type=\"record\">");
        builder.append("<WholeName>").append(wholeName).append("</WholeName>");
        if (request.getBirthStartDate() != null) {
            builder.append("<Birth_StartDate>").append(request.getBirthStartDate()).append("</Birth_StartDate>");
        }
        if (request.getBirthEndDate() != null) {
            builder.append("<Birth_EndDate>").append(request.getBirthEndDate()).append("</Birth_EndDate>");
        }
        if (request.getSex() != null && !request.getSex().isBlank()) {
            builder.append("<Sex>").append(request.getSex().trim()).append("</Sex>");
        }
        if (request.getInOut() != null && !request.getInOut().isBlank()) {
            builder.append("<InOut>").append(request.getInOut().trim()).append("</InOut>");
        }
        builder.append("</patientlst3req></data>");
        return builder.toString();
    }

    String buildMedicalInformationOptionsPayload() {
        return buildSystemManagementOptionsPayload("06");
    }

    String buildSystemManagementOptionsPayload(String requestNumber) {
        String normalized = requireText(requestNumber, "requestNumber").trim();
        if (!normalized.matches("0[1-7]")) {
            throw new OrcaGatewayException("Unsupported system management request number");
        }
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.SYSTEM_MANAGEMENT_LIST, normalized));
        builder.append("<data><system01lstv2req type=\"record\">");
        builder.append("<Request_Number type=\"string\">").append(normalized).append("</Request_Number>");
        builder.append("</system01lstv2req></data>");
        return builder.toString();
    }

    String buildInsuranceCombinationPayload(InsuranceCombinationRequest request) {
        String patientId = requireNumericId(request.getPatientId(), "patientId");
        LocalDate baseDate = resolveIsoDateOrDefault(request.getBaseDate(), LocalDate.now(), "baseDate");
        String startDate = resolveOptionalIsoDate(request.getRangeStart(), "rangeStart");
        String endDate = resolveOptionalIsoDate(request.getRangeEnd(), "rangeEnd");
        if (startDate.isBlank()) {
            startDate = baseDate.toString();
        }
        if (endDate.isBlank()) {
            endDate = startDate;
        }
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.INSURANCE_COMBINATION, null));
        builder.append("<data><patientlst6req>");
        builder.append("<Reqest_Number>01</Reqest_Number>");
        builder.append("<Patient_ID>").append(patientId).append("</Patient_ID>");
        builder.append("<Base_Date>").append(baseDate).append("</Base_Date>");
        builder.append("<Start_Date>").append(startDate).append("</Start_Date>");
        builder.append("<End_Date>").append(endDate).append("</End_Date>");
        builder.append("</patientlst6req></data>");
        return builder.toString();
    }

    private LocalDate resolveIsoDateOrDefault(String value, LocalDate fallback, String label) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (RuntimeException ex) {
            throw new OrcaGatewayException(label + " must be an ISO-8601 date");
        }
    }

    private String resolveOptionalIsoDate(String value, String label) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return resolveIsoDateOrDefault(value, null, label).toString();
    }

    String buildFormerNameHistoryPayload(FormerNameHistoryRequest request) {
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.FORMER_NAME_HISTORY, null));
        builder.append("<data><formernamehistoryreq>");
        if (request.getPatientId() != null) {
            builder.append("<Patient_ID>").append(request.getPatientId()).append("</Patient_ID>");
        }
        builder.append("</formernamehistoryreq></data>");
        return builder.toString();
    }

    String buildAppointmentMutationPayload(AppointmentMutationRequest request) {
        return mutationSupport.buildAppointmentMutationPayload(request);
    }

    String buildVisitMutationPayload(VisitMutationRequest request) {
        return mutationSupport.buildVisitMutationPayload(request);
    }

    void appendTag(StringBuilder builder, String tag, String value) {
        mutationSupport.appendTag(builder, tag, value);
    }

    void appendXml2Tag(StringBuilder builder, String tag, String value) {
        mutationSupport.appendXml2Tag(builder, tag, value);
    }

    record DateRange(LocalDate from, LocalDate to) {}

    static final class InsuranceSelection {
        final InsuranceCombination insurance;
        final List<PublicInsuranceInfo> publicInsurances;

        InsuranceSelection(InsuranceCombination insurance, List<PublicInsuranceInfo> publicInsurances) {
            this.insurance = insurance;
            this.publicInsurances = publicInsurances != null ? publicInsurances : List.of();
        }
    }
}
