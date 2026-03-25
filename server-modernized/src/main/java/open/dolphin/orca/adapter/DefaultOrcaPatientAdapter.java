package open.dolphin.orca.adapter;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import open.dolphin.orca.OrcaGatewayException;
import open.dolphin.orca.service.OrcaLiveGateway;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.OrcaApiProxySupport;
import open.dolphin.rest.dto.orca.OrcaApiResponse;
import open.dolphin.rest.dto.orca.PatientBatchRequest;
import open.dolphin.rest.dto.orca.PatientDetail;
import open.dolphin.rest.dto.orca.PatientNameSearchRequest;
import open.dolphin.rest.dto.orca.PatientSearchResponse;
import open.dolphin.rest.dto.orca.PatientSummary;
import open.dolphin.rest.dto.orca.VisitMutationRequest;
import open.dolphin.rest.dto.orca.VisitMutationResponse;
import open.dolphin.rest.orca.AbstractOrcaRestResource;

/**
 * Default ORCA adapter implementation backed by {@link OrcaLiveGateway} and {@link OrcaTransport}.
 */
@ApplicationScoped
public class DefaultOrcaPatientAdapter implements OrcaPatientAdapter {

    private final OrcaLiveGateway wrapperService;
    private final OrcaTransport transport;

    public DefaultOrcaPatientAdapter() {
        this.wrapperService = null;
        this.transport = null;
    }

    @Inject
    public DefaultOrcaPatientAdapter(OrcaLiveGateway wrapperService, OrcaTransport transport) {
        this.wrapperService = wrapperService;
        this.transport = transport;
    }

    @Override
    public SearchResult searchPatients(PatientSearchQuery query) {
        if (query == null) {
            throw new OrcaGatewayException("query is required");
        }
        String facilityId = requireText(query.facilityId(), "facilityId");
        OrcaApiResponse response;
        List<PatientDetail> details;
        String patientId = normalizeText(query.patientId());
        if (patientId != null) {
            PatientBatchRequest request = new PatientBatchRequest();
            request.getPatientIds().add(patientId);
            request.setIncludeInsurance(false);
            var batch = requireWrapperService().getPatientBatch(facilityId, request);
            response = batch;
            details = batch != null ? batch.getPatients() : Collections.emptyList();
        } else {
            PatientNameSearchRequest request = new PatientNameSearchRequest();
            request.setName(normalizeText(query.fullName()));
            request.setKana(normalizeText(query.kanaName()));
            if ((request.getName() == null || request.getName().isBlank())
                    && (request.getKana() == null || request.getKana().isBlank())) {
                throw new OrcaGatewayException("fullName or kanaName is required");
            }
            String birthDate = normalizeText(query.birthDate());
            if (birthDate != null) {
                try {
                    request.setBirthStartDate(java.time.LocalDate.parse(birthDate));
                } catch (RuntimeException ex) {
                    throw new OrcaGatewayException("birthDate must be yyyy-MM-dd");
                }
            }
            PatientSearchResponse searchResponse = requireWrapperService().searchPatients(facilityId, request);
            response = searchResponse;
            details = searchResponse != null ? searchResponse.getPatients() : Collections.emptyList();
        }

        List<Map<String, Object>> patients = new ArrayList<>();
        if (details != null) {
            for (PatientDetail detail : details) {
                if (detail == null) {
                    continue;
                }
                PatientSummary summary = detail.getSummary();
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("patientId", summary != null ? summary.getPatientId() : null);
                row.put("wholeName", summary != null ? summary.getWholeName() : null);
                row.put("wholeNameKana", summary != null ? summary.getWholeNameKana() : null);
                row.put("birthDate", summary != null ? summary.getBirthDate() : null);
                row.put("sex", summary != null ? summary.getSex() : null);
                row.put("zipCode", detail.getZipCode());
                row.put("address", detail.getAddress());
                row.put("phoneNumber1", detail.getPhoneNumber1());
                row.put("phoneNumber2", detail.getPhoneNumber2());
                patients.add(row);
            }
        }

        String sourceSystem = response != null ? normalizeText(response.getDataSource()) : null;
        if (sourceSystem == null) {
            sourceSystem = "real";
        }
        String requestId = response != null ? normalizeText(response.getRequestId()) : null;
        String runId = response != null ? normalizeText(response.getRunId()) : null;
        return new SearchResult(patients, requestId, runId, sourceSystem);
    }

    @Override
    public UpsertResult upsertPatient(PatientUpsertCommand command) {
        if (command == null) {
            throw new OrcaGatewayException("command is required");
        }
        String facilityId = requireText(command.facilityId(), "facilityId");
        String patientId = requireText(command.patientId(), "patientId");
        Map<String, Object> payload = command.patientPayload() != null ? command.patientPayload() : Map.of();

        String modKey = normalizeText(asText(payload, "modKey", "Mod_Key"));
        if (modKey == null) {
            modKey = "1";
        }
        String wholeName = requireText(asText(payload, "wholeName", "name", "WholeName"), "wholeName");
        String wholeNameKana = requireText(asText(payload, "wholeNameKana", "kana", "WholeName_inKana"), "wholeNameKana");
        String birthDate = requireText(asText(payload, "birthDate", "BirthDate"), "birthDate");
        String sex = requireText(asText(payload, "sex", "Sex"), "sex");
        String zipCode = normalizeText(asText(payload, "zipCode", "zip", "Address_ZipCode"));
        String address = normalizeText(asText(payload, "address", "WholeAddress1"));
        String phone1 = normalizeText(asText(payload, "phoneNumber1", "phone", "PhoneNumber1"));
        String phone2 = normalizeText(asText(payload, "phoneNumber2", "PhoneNumber2"));

        String classCode = normalizeText(asText(payload, "classCode"));
        if (classCode == null) {
            classCode = "02";
        }

        String requestXml = buildPatientModPayload(modKey, patientId, wholeName, wholeNameKana,
                birthDate, sex, zipCode, address, phone1, phone2);
        String payloadWithMeta = OrcaApiProxySupport.applyQueryMeta(requestXml, OrcaEndpoint.PATIENT_MOD, classCode);
        OrcaTransportResult result = requireTransport().invoke(facilityId, OrcaEndpoint.PATIENT_MOD,
                OrcaTransportRequest.post(payloadWithMeta));

        String body = result != null ? result.getBody() : null;
        String apiResult = extractTagValue(body, "Api_Result");
        String apiResultMessage = extractTagValue(body, "Api_Result_Message");
        if (!OrcaApiProxySupport.isApiResultSuccess(apiResult)) {
            throw new OrcaGatewayException("ORCA patientmodv2 failed: " + apiResult + " "
                    + (apiResultMessage != null ? apiResultMessage : ""));
        }

        String requestId = normalizeText(asText(payload, "requestId"));
        String runId = normalizeText(asText(payload, "runId"));
        if (runId == null) {
            runId = AbstractOrcaRestResource.resolveRunIdValue((String) null);
        }

        boolean created = asBoolean(payload.get("created"));
        if (!created) {
            String operation = normalizeText(asText(payload, "operation"));
            created = "create".equalsIgnoreCase(operation);
        }

        String orcaPatientKey = normalizeText(extractTagValue(body, "Patient_ID"));
        if (orcaPatientKey == null) {
            orcaPatientKey = patientId;
        }
        return new UpsertResult(patientId, orcaPatientKey, requestId, runId, created);
    }

    @Override
    public ReceptionResult registerReception(ReceptionCommand command) {
        if (command == null) {
            throw new OrcaGatewayException("command is required");
        }
        String facilityId = requireText(command.facilityId(), "facilityId");
        String patientId = requireText(command.patientId(), "patientId");
        Map<String, Object> payload = command.payload() != null ? command.payload() : Map.of();

        VisitMutationRequest request = new VisitMutationRequest();
        request.setRequestNumber(firstNonBlank(
                asText(payload, "requestNumber", "Request_Number"),
                "01"));
        request.setPatientId(patientId);
        request.setDepartmentCode(firstNonBlank(asText(payload, "departmentCode"), normalizeText(command.departmentCode())));
        request.setPhysicianCode(firstNonBlank(asText(payload, "physicianCode", "doctorCode"), normalizeText(command.doctorCode())));
        request.setAcceptanceDate(firstNonBlank(asText(payload, "acceptanceDate"), normalizeText(command.visitDate())));
        request.setAcceptanceTime(firstNonBlank(asText(payload, "acceptanceTime"), "09:00:00"));
        request.setWholeName(normalizeText(asText(payload, "wholeName")));
        request.setMedicalInformation(normalizeText(asText(payload, "medicalInformation")));

        VisitMutationResponse response = requireWrapperService().mutateVisit(facilityId, request);
        if (response == null || !OrcaApiProxySupport.isApiResultSuccess(response.getApiResult())) {
            String apiResult = response != null ? response.getApiResult() : null;
            String apiResultMessage = response != null ? response.getApiResultMessage() : null;
            throw new OrcaGatewayException("ORCA acceptmodv2 failed: " + apiResult + " "
                    + (apiResultMessage != null ? apiResultMessage : ""));
        }

        String requestId = normalizeText(response.getRequestId());
        String runId = normalizeText(response.getRunId());
        String status = normalizeText(response.getApiResult());
        String receptionId = normalizeText(response.getAcceptanceId());
        return new ReceptionResult(receptionId, patientId, requestId, runId, status);
    }

    private OrcaLiveGateway requireWrapperService() {
        if (wrapperService == null) {
            throw new OrcaGatewayException("OrcaLiveGateway is not available");
        }
        return wrapperService;
    }

    private OrcaTransport requireTransport() {
        if (transport == null) {
            throw new OrcaGatewayException("OrcaTransport is not available");
        }
        return transport;
    }

    private static String requireText(String value, String label) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            throw new OrcaGatewayException(label + " is required");
        }
        return normalized;
    }

    private static String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String asText(Map<String, Object> map, String... keys) {
        if (map == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (key == null) {
                continue;
            }
            Object value = map.get(key);
            if (value == null) {
                continue;
            }
            if (value instanceof CharSequence sequence) {
                String text = sequence.toString().trim();
                if (!text.isEmpty()) {
                    return text;
                }
            } else {
                return String.valueOf(value);
            }
        }
        return null;
    }

    private static boolean asBoolean(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean b) {
            return b;
        }
        if (value instanceof Number n) {
            return n.intValue() != 0;
        }
        String normalized = String.valueOf(value).trim().toLowerCase(java.util.Locale.ROOT);
        return Objects.equals(normalized, "true")
                || Objects.equals(normalized, "1")
                || Objects.equals(normalized, "yes")
                || Objects.equals(normalized, "on");
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String normalized = normalizeText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private static String buildPatientModPayload(String modKey,
            String patientId,
            String wholeName,
            String wholeNameKana,
            String birthDate,
            String sex,
            String zipCode,
            String address,
            String phone1,
            String phone2) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data><patientmodreq>");
        appendTag(builder, "Mod_Key", modKey);
        appendTag(builder, "Patient_ID", patientId);
        appendTag(builder, "WholeName", wholeName);
        appendTag(builder, "WholeName_inKana", wholeNameKana);
        appendTag(builder, "BirthDate", birthDate);
        appendTag(builder, "Sex", sex);
        if (zipCode != null || address != null || phone1 != null || phone2 != null) {
            builder.append("<Home_Address_Information>");
            appendTag(builder, "Address_ZipCode", zipCode);
            appendTag(builder, "WholeAddress1", address);
            appendTag(builder, "PhoneNumber1", phone1);
            appendTag(builder, "PhoneNumber2", phone2);
            builder.append("</Home_Address_Information>");
        }
        builder.append("</patientmodreq></data>");
        return builder.toString();
    }

    private static void appendTag(StringBuilder builder, String tag, String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            return;
        }
        builder.append('<').append(tag).append('>')
                .append(escapeXml(normalized))
                .append("</").append(tag).append('>');
    }

    private static String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String extractTagValue(String xml, String tagName) {
        if (xml == null || tagName == null || tagName.isBlank()) {
            return null;
        }
        String openTag = "<" + tagName + ">";
        String closeTag = "</" + tagName + ">";
        int start = xml.indexOf(openTag);
        if (start < 0) {
            return null;
        }
        start += openTag.length();
        int end = xml.indexOf(closeTag, start);
        if (end < 0) {
            return null;
        }
        return xml.substring(start, end).trim();
    }
}
