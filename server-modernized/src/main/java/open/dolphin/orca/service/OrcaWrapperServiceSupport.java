package open.dolphin.orca.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransportResult;
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

final class OrcaWrapperServiceSupport {

    private final OrcaWrapperServiceMutationSupport mutationSupport = new OrcaWrapperServiceMutationSupport();

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
        enforceRangeLimit(from, to, OrcaWrapperService.MAX_APPOINTMENT_RANGE_DAYS, "appointmentDate");
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
        builder.append("</visitptlstreq>");
        builder.append("</data>");
        return builder.toString();
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
        enforceRangeLimit(from, to, OrcaWrapperService.MAX_VISIT_RANGE_DAYS, "visitDate");
        return new DateRange(from, to);
    }

    String buildPatientAppointmentListPayload(PatientAppointmentListRequest request) {
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

    String buildBillingSimulationPayload(BillingSimulationRequest request, InsuranceSelection selection) {
        return mutationSupport.buildBillingSimulationPayload(request, selection);
    }

    InsuranceSelection resolveInsuranceSelection(BillingSimulationRequest request, OrcaWrapperService owner) {
        return mutationSupport.resolveInsuranceSelection(request, owner);
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
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.PATIENT_NAME_SEARCH, null));
        builder.append("<data><patientnameSearch>");
        if (request.getName() != null) {
            builder.append("<WholeName>").append(request.getName()).append("</WholeName>");
        }
        if (request.getKana() != null) {
            builder.append("<WholeName_inKana>").append(request.getKana()).append("</WholeName_inKana>");
        }
        builder.append("</patientnameSearch></data>");
        return builder.toString();
    }

    String buildInsuranceCombinationPayload(InsuranceCombinationRequest request) {
        StringBuilder builder = new StringBuilder();
        builder.append(buildOrcaMeta(OrcaEndpoint.INSURANCE_COMBINATION, null));
        builder.append("<data><insurancecombinationreq>");
        if (request.getPatientId() != null) {
            builder.append("<Patient_ID>").append(request.getPatientId()).append("</Patient_ID>");
        }
        if (request.getBaseDate() != null) {
            builder.append("<Perform_Date>").append(request.getBaseDate()).append("</Perform_Date>");
        }
        builder.append("</insurancecombinationreq></data>");
        return builder.toString();
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
