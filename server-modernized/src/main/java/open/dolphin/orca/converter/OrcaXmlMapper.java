package open.dolphin.orca.converter;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.util.Collections;
import java.util.Iterator;
import java.util.NoSuchElementException;
import java.util.Objects;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.rest.dto.orca.AbstractPatientListResponse;
import open.dolphin.rest.dto.orca.AppointmentMutationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationResponse;
import open.dolphin.rest.dto.orca.BillingSimulationResponse.BillingPointBreakdown;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse;
import open.dolphin.rest.dto.orca.FormerNameHistoryResponse.FormerNameRecord;
import open.dolphin.rest.dto.orca.InsuranceCombination;
import open.dolphin.rest.dto.orca.InsuranceCombinationResponse;
import open.dolphin.rest.dto.orca.OrcaApiResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse;
import open.dolphin.rest.dto.orca.OrcaAppointmentListResponse.AppointmentSlot;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse;
import open.dolphin.rest.dto.orca.PatientAppointmentListResponse.PatientAppointment;
import open.dolphin.rest.dto.orca.PatientBatchResponse;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientIdListResponse;
import open.dolphin.rest.dto.orca.PatientIdListResponse.PatientSyncEntry;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.rest.dto.orca.PublicInsuranceInfo;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.dto.orca.VisitPatientListResponse;
import open.dolphin.rest.dto.orca.VisitPatientListResponse.VisitEntry;

/**
 * Converts ORCA XML payloads into DTOs understood by the REST wrappers.
 */
@ApplicationScoped
public class OrcaXmlMapper {

    private final XmlMapper xmlMapper;

    public OrcaXmlMapper() {
        xmlMapper = new XmlMapper();
        xmlMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        xmlMapper.configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true);
    }

    public OrcaAppointmentListResponse toAppointmentList(String xml) {
        JsonNode body = read(xml).path("appointlstres");
        OrcaAppointmentListResponse response = new OrcaAppointmentListResponse();
        populateCommon(body, response);
        response.setAppointmentDate(textValue(body, "Appointment_Date"));
        for (JsonNode slotNode : iterable(body.path("Appointlst_Information"))) {
            AppointmentSlot slot = new AppointmentSlot();
            slot.setAppointmentTime(textValue(slotNode, "Appointment_Time"));
            slot.setMedicalInformation(textValue(slotNode, "Medical_Information"));
            slot.setDepartmentCode(textValue(slotNode, "Department_Code"));
            slot.setDepartmentName(textValue(slotNode, "Department_WholeName"));
            slot.setPhysicianCode(textValue(slotNode, "Physician_Code"));
            slot.setPhysicianName(textValue(slotNode, "Physician_WholeName"));
            slot.setVisitInformation(textValue(slotNode, "Visit_Information"));
            slot.setAppointmentId(textValue(slotNode, "Appointment_Id"));
            slot.setPatient(toPatientSummary(slotNode.path("Patient_Information")));
            response.getSlots().add(slot);
        }
        return response;
    }

    public PatientAppointmentListResponse toPatientAppointments(String xml) {
        JsonNode body = read(xml).path("appointlst2res");
        PatientAppointmentListResponse response = new PatientAppointmentListResponse();
        populateCommon(body, response);
        response.setBaseDate(textValue(body, "Base_Date"));
        response.setPatient(toPatientSummary(body.path("Patient_Information")));
        for (JsonNode node : iterable(body.path("Appointlst_Information"))) {
            PatientAppointment appointment = new PatientAppointment();
            appointment.setAppointmentDate(textValue(node, "Appointment_Date"));
            appointment.setAppointmentTime(textValue(node, "Appointment_Time"));
            appointment.setMedicalInformation(textValue(node, "Medical_Information"));
            appointment.setDepartmentCode(textValue(node, "Department_Code"));
            appointment.setDepartmentName(textValue(node, "Department_WholeName"));
            appointment.setPhysicianCode(textValue(node, "Physician_Code"));
            appointment.setPhysicianName(textValue(node, "Physician_WholeName"));
            appointment.setVisitInformation(textValue(node, "Visit_Information"));
            appointment.setAppointmentId(textValue(node, "Appointment_Id"));
            appointment.setAppointmentNote(textValue(node, "Appointment_Note"));
            response.getReservations().add(appointment);
        }
        return response;
    }

    public AppointmentMutationResponse toAppointmentMutation(String xml) {
        JsonNode body = read(xml).path("appointres");
        AppointmentMutationResponse response = new AppointmentMutationResponse();
        populateCommon(body, response);
        response.setResKey(textValue(body, "Reskey"));
        response.setAppointmentDate(textValue(body, "Appointment_Date"));
        response.setAppointmentTime(textValue(body, "Appointment_Time"));
        response.setAppointmentId(textValue(body, "Appointment_Id"));
        response.setDepartmentCode(textValue(body, "Department_Code"));
        response.setDepartmentName(textValue(body, "Department_WholeName"));
        response.setPhysicianCode(textValue(body, "Physician_Code"));
        response.setPhysicianName(textValue(body, "Physician_WholeName"));
        response.setMedicalInformation(textValue(body, "Medical_Information"));
        response.setAppointmentInformation(textValue(body, "Appointment_Information"));
        response.setAppointmentNote(textValue(body, "Appointment_Note"));
        response.setVisitInformation(textValue(body, "Visit_Information"));
        response.setPatient(toPatientSummary(body.path("Patient_Information")));
        for (JsonNode warning : iterable(body.path("Api_Warning_Message_Information"))) {
            String message = textValue(warning, "Api_Warning_Message");
            if (message != null && !message.isBlank()) {
                response.getWarnings().add(message);
            }
        }
        return response;
    }

    public BillingSimulationResponse toBillingSimulation(String xml) {
        JsonNode body = read(xml).path("acsimulateres");
        BillingSimulationResponse response = new BillingSimulationResponse();
        populateCommon(body, response);
        response.setPerformDate(textValue(body, "Perform_Date"));
        response.setDepartmentCode(textValue(body, "Department_Code"));
        response.setDepartmentName(textValue(body, "Department_Name"));
        JsonNode patientNode = body.path("Patient_Information");
        response.setPatient(toPatientSummary(patientNode));
        JsonNode pointInfo = patientNode.path("Ac_Point_Information");
        response.setTotalPoint(pointInfo.path("Ac_Ttl_Point").asInt(0));
        for (JsonNode detail : iterable(pointInfo.path("Ac_Point_Detail"))) {
            BillingPointBreakdown breakdown = new BillingPointBreakdown();
            breakdown.setName(textValue(detail, "AC_Point_Name"));
            breakdown.setPoint(detail.path("AC_Point").asInt(0));
            response.getBreakdown().add(breakdown);
        }
        return response;
    }

    public VisitPatientListResponse toVisitList(String xml) {
        JsonNode body = read(xml).path("visitptlst01res");
        VisitPatientListResponse response = new VisitPatientListResponse();
        populateCommon(body, response);
        response.setVisitDate(textValue(body, "Visit_Date"));
        for (JsonNode node : iterable(body.path("Visit_List_Information"))) {
            VisitEntry entry = new VisitEntry();
            entry.setDepartmentCode(textValue(node, "Department_Code"));
            entry.setDepartmentName(textValue(node, "Department_Name"));
            entry.setPhysicianCode(textValue(node, "Physician_Code"));
            entry.setPhysicianName(textValue(node, "Physician_WholeName"));
            entry.setVoucherNumber(textValue(node, "Voucher_Number"));
            entry.setSequentialNumber(textValue(node, "Sequential_Number"));
            entry.setInsuranceCombinationNumber(textValue(node, "Insurance_Combination_Number"));
            entry.setUpdateDate(textValue(node, "Update_Date"));
            entry.setUpdateTime(textValue(node, "Update_Time"));
            entry.setPatient(toPatientSummary(node.path("Patient_Information")));
            response.getVisits().add(entry);
        }
        return response;
    }

    public PatientIdListResponse toPatientIdList(String xml) {
        JsonNode body = read(xml).path("patientlst1res");
        PatientIdListResponse response = new PatientIdListResponse();
        populateCommon(body, response);
        response.setTargetPatientCount(body.path("Target_Patient_Count").asInt(0));
        for (JsonNode node : iterable(body.path("Patient_Information"))) {
            PatientSyncEntry entry = new PatientSyncEntry();
            entry.setSummary(toPatientSummary(node));
            entry.setCreateDate(textValue(node, "CreateDate"));
            entry.setUpdateDate(textValue(node, "UpdateDate"));
            entry.setUpdateTime(textValue(node, "UpdateTime"));
            entry.setTestPatientFlag(textValue(node, "TestPatient_Flag"));
            response.getPatients().add(entry);
        }
        return response;
    }

    public PatientBatchResponse toPatientBatch(String xml) {
        JsonNode body = read(xml).path("patientlst2res");
        PatientBatchResponse response = new PatientBatchResponse();
        populateCommon(body, response);
        populatePatientList(body, response);
        return response;
    }

    public PatientSearchResponse toPatientSearch(String xml, String searchTerm) {
        JsonNode body = read(xml).path("patientlst2res");
        PatientSearchResponse response = new PatientSearchResponse();
        populateCommon(body, response);
        populatePatientList(body, response);
        response.setSearchTerm(searchTerm);
        return response;
    }

    public InsuranceCombinationResponse toInsuranceCombination(String xml) {
        JsonNode body = read(xml).path("patientlst2res");
        InsuranceCombinationResponse response = new InsuranceCombinationResponse();
        populateCommon(body, response);
        response.setPatient(toPatientSummary(body.path("Patient_Information")));
        for (JsonNode node : iterable(body.path("HealthInsurance_Information"))) {
            response.getCombinations().add(toInsuranceCombination(node));
        }
        return response;
    }

    public FormerNameHistoryResponse toFormerNames(String xml) {
        JsonNode body = read(xml).path("patientlst8res");
        FormerNameHistoryResponse response = new FormerNameHistoryResponse();
        populateCommon(body, response);
        response.setPatient(toPatientSummary(body.path("Patient_Information")));
        for (JsonNode node : iterable(body.path("Former_Name_Information"))) {
            FormerNameRecord record = new FormerNameRecord();
            record.setChangeDate(textValue(node, "ChangeDate"));
            record.setWholeName(textValue(node, "WholeName"));
            record.setWholeNameKana(textValue(node, "WholeName_inKana"));
            record.setNickName(textValue(node, "NickName"));
            response.getFormerNames().add(record);
        }
        return response;
    }

    public VisitMutationResponse toVisitMutation(String xml) {
        JsonNode body = read(xml).path("acceptres");
        VisitMutationResponse response = new VisitMutationResponse();
        populateCommon(body, response);
        response.setResKey(textValue(body, "Reskey"));
        response.setAcceptanceId(textValue(body, "Acceptance_Id"));
        response.setClaimSendInfo(textValue(body, "Claim_Send_Info"));
        response.setAcceptanceDate(textValue(body, "Acceptance_Date"));
        response.setAcceptanceTime(textValue(body, "Acceptance_Time"));
        response.setDepartmentCode(textValue(body, "Department_Code"));
        response.setDepartmentName(textValue(body, "Department_WholeName"));
        response.setPhysicianCode(textValue(body, "Physician_Code"));
        response.setPhysicianName(textValue(body, "Physician_WholeName"));
        response.setMedicalInformation(textValue(body, "Medical_Information"));
        JsonNode medicalInfo = body.path("Medical_Info");
        response.setAppointmentDate(textValue(medicalInfo, "Appointment_Date"));
        response.setVisitNumber(textValue(medicalInfo, "Visit_Number"));
        response.setPatient(toPatientSummary(body.path("Patient_Information")));
        for (JsonNode warning : iterable(body.path("Api_Warning_Message_Information"))) {
            String message = textValue(warning, "Api_Warning_Message");
            if (message != null && !message.isBlank()) {
                response.getWarnings().add(message);
            }
        }
        return response;
    }

    private void populatePatientList(JsonNode body, AbstractPatientListResponse response) {
        response.setTargetPatientCount(body.path("Target_Patient_Count").asInt(0));
        response.setNoTargetPatientCount(body.path("No_Target_Patient_Count").asInt(0));
        for (JsonNode node : iterable(body.path("Patient_Information"))) {
            PatientDetail detail = new PatientDetail();
            detail.setSummary(toPatientSummary(node));
            JsonNode address = node.path("Home_Address_Information");
            detail.setZipCode(textValue(address, "Address_ZipCode"));
            String wholeAddress1 = textValue(address, "WholeAddress1");
            String wholeAddress2 = textValue(address, "WholeAddress2");
            detail.setAddress(concat(wholeAddress1, wholeAddress2));
            JsonNode phone = node.path("PhoneNumber_Information");
            detail.setPhoneNumber1(textValue(phone, "PhoneNumber1"));
            detail.setPhoneNumber2(textValue(phone, "PhoneNumber2"));
            detail.setOutpatientClass(textValue(node, "Outpatient_Class"));
            for (JsonNode insurance : iterable(node.path("HealthInsurance_Information"))) {
                detail.getInsurances().add(toInsuranceCombination(insurance));
            }
            populatePublicInsurances(node.path("PublicInsurance_Information"), detail.getPublicInsurances());
            response.getPatients().add(detail);
        }
    }

    private static String concat(String left, String right) {
        String a = left != null ? left.trim() : "";
        String b = right != null ? right.trim() : "";
        if (a.isEmpty() && b.isEmpty()) {
            return null;
        }
        return a + b;
    }

    private void populateCommon(JsonNode body, OrcaApiResponse response) {
        if (body == null || body.isMissingNode()) {
            throw new OrcaGatewayException("ORCA payload is missing expected body");
        }
        response.setApiResult(textValue(body, "Api_Result"));
        response.setApiResultMessage(textValue(body, "Api_Result_Message"));
    }

    private PatientSummary toPatientSummary(JsonNode node) {
        if (node == null || node.isMissingNode()) {
            return null;
        }
        PatientSummary summary = new PatientSummary();
        summary.setPatientId(textValue(node, "Patient_ID"));
        summary.setWholeName(textValue(node, "WholeName"));
        summary.setWholeNameKana(textValue(node, "WholeName_inKana"));
        summary.setBirthDate(textValue(node, "BirthDate"));
        summary.setSex(textValue(node, "Sex"));
        return summary;
    }

    private InsuranceCombination toInsuranceCombination(JsonNode node) {
        InsuranceCombination combination = new InsuranceCombination();
        combination.setCombinationNumber(textValue(node, "Insurance_Combination_Number"));
        combination.setInsuranceProviderClass(textValue(node, "InsuranceProvider_Class"));
        combination.setInsuranceProviderNumber(textValue(node, "InsuranceProvider_Number"));
        combination.setInsuranceProviderName(textValue(node, "InsuranceProvider_WholeName"));
        combination.setInsuredPersonSymbol(textValue(node, "HealthInsuredPerson_Symbol"));
        combination.setInsuredPersonNumber(textValue(node, "HealthInsuredPerson_Number"));
        combination.setInsuredPersonBranchNumber(textValue(node, "HealthInsuredPerson_Branch_Number"));
        combination.setInsuredPersonAssistance(textValue(node, "HealthInsuredPerson_Assistance"));
        combination.setRelationToInsuredPerson(textValue(node, "RelationToInsuredPerson"));
        combination.setInsuredPersonWholeName(textValue(node, "HealthInsuredPerson_WholeName"));
        combination.setRateAdmission(firstNonBlankText(
                textValue(node, "InsuranceCombination_Rate_Admission"),
                textValue(node, "Rate_Admission")));
        combination.setRateOutpatient(firstNonBlankText(
                textValue(node, "InsuranceCombination_Rate_Outpatient"),
                textValue(node, "Rate_Outpatient")));
        combination.setCertificateStartDate(textValue(node, "Certificate_StartDate"));
        combination.setCertificateExpiredDate(textValue(node, "Certificate_ExpiredDate"));
        populatePublicInsurances(node.path("PublicInsurance_Information"), combination.getPublicInsurances());
        return combination;
    }

    private void populatePublicInsurances(JsonNode node, java.util.List<PublicInsuranceInfo> target) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return;
        }
        for (JsonNode entryNode : iterable(node)) {
            PublicInsuranceInfo info = new PublicInsuranceInfo();
            info.setPublicInsuranceClass(textValue(entryNode, "PublicInsurance_Class"));
            info.setPublicInsuranceName(textValue(entryNode, "PublicInsurance_Name"));
            info.setPublicInsurerNumber(textValue(entryNode, "PublicInsurer_Number"));
            info.setPublicInsuredPersonNumber(textValue(entryNode, "PublicInsuredPerson_Number"));
            info.setRateAdmission(textValue(entryNode, "Rate_Admission"));
            info.setRateOutpatient(textValue(entryNode, "Rate_Outpatient"));
            info.setCertificateIssuedDate(textValue(entryNode, "Certificate_IssuedDate"));
            info.setCertificateExpiredDate(textValue(entryNode, "Certificate_ExpiredDate"));
            target.add(info);
        }
    }

    private JsonNode read(String xml) {
        Objects.requireNonNull(xml, "xml");
        try {
            return xmlMapper.readTree(xml);
        } catch (IOException ex) {
            throw new OrcaGatewayException("Failed to parse ORCA payload", ex);
        }
    }

    private String textValue(JsonNode parent, String fieldName) {
        if (parent == null || parent.isMissingNode()) {
            return null;
        }
        return textValue(parent.path(fieldName));
    }

    private String textValue(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isValueNode()) {
            return node.asText(null);
        }
        JsonNode textNode = node.get("");
        if (textNode != null && !textNode.isMissingNode()) {
            return textNode.asText(null);
        }
        textNode = node.get("#text");
        if (textNode != null && !textNode.isMissingNode()) {
            return textNode.asText(null);
        }
        textNode = node.get("$");
        if (textNode != null && !textNode.isMissingNode()) {
            return textNode.asText(null);
        }
        return node.asText(null);
    }

    private String firstNonBlankText(String... values) {
        if (values == null || values.length == 0) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private Iterable<JsonNode> iterable(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return Collections.emptyList();
        }
        if (node.isObject()) {
            Iterator<String> fields = node.fieldNames();
            while (fields.hasNext()) {
                String field = fields.next();
                if (field != null && field.endsWith("_child")) {
                    return iterable(node.path(field));
                }
            }
        }
        if (node.isArray()) {
            return node;
        }
        return () -> new Iterator<>() {
            private boolean hasNext = true;

            @Override
            public boolean hasNext() {
                return hasNext;
            }

            @Override
            public JsonNode next() {
                if (!hasNext) {
                    throw new NoSuchElementException();
                }
                hasNext = false;
                return node;
            }
        };
    }
}
