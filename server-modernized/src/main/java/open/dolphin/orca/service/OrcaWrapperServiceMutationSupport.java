package open.dolphin.orca.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.rest.dto.orca.AppointmentMutationRequest;
import open.dolphin.rest.dto.orca.BillingSimulationRequest;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationRequest;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientIdListRequest;
import open.dolphin.rest.dto.orca.PublicInsuranceInfo;
import open.dolphin.rest.dto.orca.VisitMutationRequest;

final class OrcaWrapperServiceMutationSupport {

    String buildOrcaMeta(OrcaEndpoint endpoint, String classCode) {
        String path = endpoint != null ? endpoint.getPath() : "";
        StringBuilder builder = new StringBuilder();
        builder.append("<!-- orca-meta: path=").append(path).append(" method=POST");
        if (classCode != null && !classCode.isBlank()) {
            builder.append(" query=class=").append(classCode.trim());
        }
        builder.append(" -->");
        return builder.toString();
    }

    String normalizeAppointmentClass(String value) {
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

    String normalizeAcceptRequestNumber(String value) {
        String normalized = normalizeToken(value, "requestNumber");
        if (normalized.matches("\\d{1,2}")) {
            String code = padTwoDigits(normalized);
            if (!"00".equals(code) && !"01".equals(code) && !"02".equals(code)
                    && !"03".equals(code) && !"04".equals(code)) {
                throw new OrcaGatewayException(
                        "requestNumber must be 00/01/02/03/04 (acceptmodv2 Request_Number) or supported operation keyword");
            }
            return code;
        }
        return switch (normalized) {
            case "create", "register", "add" -> "01";
            case "delete", "cancel", "remove" -> "02";
            case "update", "modify" -> "03";
            case "claim", "claim-send", "claim-send-info", "send-claim" -> "04";
            case "query", "read", "get", "list", "inquiry" -> "00";
            default -> throw new OrcaGatewayException(
                    "requestNumber must be 00/01/02/03/04 (acceptmodv2 Request_Number) or supported operation keyword");
        };
    }

    String normalizeToken(String value, String label) {
        String raw = requireText(value, label).trim();
        String normalized = raw.toLowerCase(Locale.ROOT);
        for (String prefix : new String[] {
                "class=", "?class=",
                "request_number=", "?request_number=",
                "requestnumber=", "?requestnumber=",
                "claim_send_info=", "?claim_send_info=",
                "claimsendinfo=", "?claimsendinfo="
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

    String padTwoDigits(String value) {
        return value.length() == 1 ? "0" + value : value;
    }

    String buildBillingSimulationPayload(BillingSimulationRequest request, OrcaWrapperServiceSupport.InsuranceSelection selection) {
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

    OrcaWrapperServiceSupport.InsuranceSelection resolveInsuranceSelection(BillingSimulationRequest request, OrcaWrapperService owner) {
        String patientId = requireNumericId(request.getPatientId(), "patientId");
        LocalDate performDate = request.getPerformDate() != null ? request.getPerformDate() : LocalDate.now();
        PatientBatchRequest batchRequest = new PatientBatchRequest();
        batchRequest.getPatientIds().add(patientId);
        PatientBatchResponse batchResponse = owner.getPatientBatch(batchRequest);
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
        return new OrcaWrapperServiceSupport.InsuranceSelection(insurance, publicInsurances);
    }

    InsuranceCombination selectInsurance(PatientDetail detail, LocalDate performDate) {
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

    List<PublicInsuranceInfo> selectPublicInsurances(
            PatientDetail detail, InsuranceCombination insurance, LocalDate performDate) {
        List<PublicInsuranceInfo> merged = new java.util.ArrayList<>();
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

    boolean isEffectiveOn(String start, String end, LocalDate target) {
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

    LocalDate parseOrcaDate(String value) {
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

    void appendInsuranceInfo(StringBuilder builder, OrcaWrapperServiceSupport.InsuranceSelection selection) {
        if (selection == null) {
            return;
        }
        InsuranceCombination insurance = selection.insurance;
        List<PublicInsuranceInfo> publicInsurances = selection.publicInsurances;
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

    String buildAppointmentMutationPayload(AppointmentMutationRequest request) {
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

    String buildVisitMutationPayload(VisitMutationRequest request) {
        String requestNumber = normalizeAcceptRequestNumber(request.getRequestNumber());
        String patientId = requireText(request.getPatientId(), "patientId");
        String claimSendInfo = "04".equals(requestNumber)
                ? normalizeClaimSendInfo(request.getClaimSendInfo())
                : null;
        if ("04".equals(requestNumber) && (request.getAcceptanceId() == null || request.getAcceptanceId().isBlank())) {
            requireText(request.getAcceptanceTime(), "acceptanceTime");
            requireText(request.getDepartmentCode(), "departmentCode");
        }
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
        if ("04".equals(requestNumber)) {
            builder.append("<Claim_Send_Info>").append(claimSendInfo).append("</Claim_Send_Info>");
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

    String normalizeClaimSendInfo(String value) {
        String normalized = normalizeToken(value, "claimSendInfo");
        if (!normalized.matches("\\d{1,2}")) {
            throw new OrcaGatewayException("claimSendInfo must be 00/01/02/03");
        }
        String code = padTwoDigits(normalized);
        if (!"00".equals(code) && !"01".equals(code) && !"02".equals(code) && !"03".equals(code)) {
            throw new OrcaGatewayException("claimSendInfo must be 00/01/02/03");
        }
        return code;
    }

    void appendTag(StringBuilder builder, String tag, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        builder.append('<').append(tag).append('>').append(value).append("</").append(tag).append('>');
    }

    void appendXml2Tag(StringBuilder builder, String tag, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        builder.append('<').append(tag).append(" type=\"string\">").append(value).append("</").append(tag).append('>');
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
}
