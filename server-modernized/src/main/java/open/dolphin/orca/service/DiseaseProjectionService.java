package open.dolphin.orca.service;

import jakarta.enterprise.context.ApplicationScoped;
import java.io.StringReader;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseEntry;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@ApplicationScoped
public class DiseaseProjectionService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            .withLocale(Locale.JAPAN)
            .withZone(ZoneId.systemDefault());
    private static final DateTimeFormatter ORCA_DATE_FORMAT = DateTimeFormatter.BASIC_ISO_DATE;

    public DiseaseImportResponse buildImportResponse(
            List<RegisteredDiagnosisModel> diagnoses,
            String runId,
            String patientId,
            Date fromDate,
            Date toDate) {
        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBaseDate(formatDate(fromDate));
        List<RegisteredDiagnosisModel> safeDiagnoses = diagnoses != null ? diagnoses : List.of();
        safeDiagnoses.stream()
                .filter(model -> model.getStarted() == null || toDate == null || !model.getStarted().after(toDate))
                .map(this::toEntry)
                .forEach(response::addDisease);
        if (response.getDiseases() == null) {
            response.setDiseases(new ArrayList<>());
        }
        return response;
    }

    public String buildDiseaseGetRequestXml(String patientId, LocalDate baseDate) {
        String safePatientId = safeXml(patientId);
        String safeBaseDate = ORCA_DATE_FORMAT.format(baseDate != null ? baseDate : LocalDate.now());
        return "<data>"
                + "<disease_inforeq type=\"record\">"
                + "<Request_Number type=\"string\">01</Request_Number>"
                + "<Patient_ID type=\"string\">" + safePatientId + "</Patient_ID>"
                + "<Base_Date type=\"string\">" + safeBaseDate + "</Base_Date>"
                + "</disease_inforeq>"
                + "</data>";
    }

    public DiseaseImportResponse buildMirrorResponseFromOrca(
            OrcaTransportResult result,
            String runId,
            String patientId,
            Date fromDate,
            Date toDate) {
        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBaseDate(formatDate(fromDate));
        response.setOrcaMirrorStatus("unavailable");
        int status = result != null ? result.getStatus() : 503;
        if (status < 200 || status >= 300) {
            response.setApiResult("transport_error");
            response.setApiResultMessage("orca_disease_mirror_unavailable");
            return response;
        }
        try {
            Document document = parseXml(result.getBody());
            String apiResult = firstText(document, "Api_Result");
            response.setApiResult(apiResult);
            response.setApiResultMessage("orca_disease_mirror_result");
            if (apiResult != null && !apiResult.matches("0+")) {
                return response;
            }
            List<RegisteredDiagnosisModel> diagnoses = parseDiseaseEntries(document);
            DiseaseImportResponse projected = buildImportResponse(diagnoses, runId, patientId, fromDate, toDate);
            projected.setOrcaMirrorStatus("connected");
            projected.setApiResult(apiResult != null ? apiResult : "00");
            projected.setApiResultMessage("orca_disease_mirror_connected");
            return projected;
        } catch (Exception ex) {
            response.setApiResult("parser_error");
            response.setApiResultMessage("orca_disease_mirror_unavailable");
            return response;
        }
    }

    public void applyMirrorDiffState(List<Map<String, Object>> localItems, List<DiseaseEntry> mirrorEntries) {
        if (localItems == null || mirrorEntries == null || mirrorEntries.isEmpty()) {
            return;
        }
        Map<String, Boolean> mirrorKeys = new LinkedHashMap<>();
        for (DiseaseEntry entry : mirrorEntries) {
            mirrorKeys.put(normalizedDiseaseKey(entry.getDiagnosisName(), entry.getDiagnosisCode()), Boolean.TRUE);
        }
        for (Map<String, Object> item : localItems) {
            String localName = item.get("diagnosisName") instanceof String value ? value : null;
            String localCode = item.get("diagnosisCode") instanceof String value ? value : null;
            String key = normalizedDiseaseKey(
                    localName,
                    localCode);
            if (!mirrorKeys.containsKey(key)) {
                item.put("syncState", "conflict");
                item.put("note", "ORCA側と差分があります");
            }
        }
        for (DiseaseEntry entry : mirrorEntries) {
            boolean matched = false;
            String mirrorKey = normalizedDiseaseKey(entry.getDiagnosisName(), entry.getDiagnosisCode());
            for (Map<String, Object> item : localItems) {
                String localName = item.get("diagnosisName") instanceof String value ? value : null;
                String localCode = item.get("diagnosisCode") instanceof String value ? value : null;
                String localKey = normalizedDiseaseKey(
                        localName,
                        localCode);
                if (mirrorKey.equals(localKey)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                entry.setSyncState("conflict");
                entry.setNote("ORCA側と差分があります");
            }
        }
    }

    private DiseaseEntry toEntry(RegisteredDiagnosisModel model) {
        DiseaseEntry entry = new DiseaseEntry();
        entry.setDiagnosisId(model.getId());
        entry.setDiagnosisName(model.getDiagnosis());
        entry.setDiagnosisCode(model.getDiagnosisCode());
        entry.setDepartmentCode(model.getDepartment());
        entry.setInsuranceCombinationNumber(model.getRelatedHealthInsurance());
        entry.setStartDate(model.getStartDate());
        entry.setEndDate(model.getEnded() != null ? formatDate(model.getEnded()) : model.getEndDate());
        entry.setOutcome(model.getDiagnosisOutcomeModel() != null ? model.getDiagnosisOutcomeModel().getOutcome() : model.getOutcome());
        entry.setCategory(model.getCategory());
        entry.setSuspectedFlag(model.getCategoryDesc());
        entry.setLayer("orca-mirror");
        entry.setSyncState("manual-resolution");
        entry.setReadOnly(Boolean.TRUE);
        entry.setCandidateOnly(Boolean.FALSE);
        entry.setNote("保険病名の確認が必要です");
        return entry;
    }

    private String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return DATE_FORMAT.format(date.toInstant());
    }

    private static List<RegisteredDiagnosisModel> parseDiseaseEntries(Document document) {
        List<RegisteredDiagnosisModel> diagnoses = new ArrayList<>();
        NodeList diseaseNodes = document.getElementsByTagName("Disease_Information_child");
        if (diseaseNodes.getLength() == 0) {
            diseaseNodes = document.getElementsByTagName("Disease_Information");
        }
        for (int i = 0; i < diseaseNodes.getLength(); i++) {
            Node node = diseaseNodes.item(i);
            if (!(node instanceof Element element)) {
                continue;
            }
            String name = firstChildText(element, "Disease_Name", "DiseaseName", "byomei");
            String code = firstChildText(element, "Disease_Code", "DiseaseCode", "khnbyomeicd");
            String startDate = normalizeOrcaDate(firstChildText(element, "Disease_StartDate", "Start_Date", "sryymd"));
            if (isBlank(name) && isBlank(code)) {
                continue;
            }
            RegisteredDiagnosisModel model = new RegisteredDiagnosisModel();
            model.setDiagnosis(name);
            model.setDiagnosisCode(code);
            model.setStartDate(startDate);
            model.setEndDate(normalizeOrcaDate(firstChildText(element, "Disease_EndDate", "End_Date", "tenkiymd")));
            model.setDepartment(firstChildText(element, "Department_Code", "DepartmentCode", "sryka"));
            model.setCategory(firstChildText(element, "Disease_Category", "Category"));
            model.setCategoryDesc(firstChildText(element, "Disease_SuspectedFlag", "Suspected_Flag", "utagaiflg"));
            model.setOutcome(firstChildText(element, "Disease_OutCome", "Outcome", "tenkikbn"));
            model.setRelatedHealthInsurance(firstChildText(element, "Insurance_Combination_Number"));
            model.setStatus("ORCA_MIRROR");
            diagnoses.add(model);
        }
        return diagnoses;
    }

    private static Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml != null ? xml : "")));
    }

    private static String firstText(Document document, String tag) {
        NodeList nodes = document.getElementsByTagName(tag);
        if (nodes.getLength() == 0) {
            return null;
        }
        String value = nodes.item(0).getTextContent();
        return isBlank(value) ? null : value.trim();
    }

    private static String firstChildText(Element parent, String... tags) {
        for (String tag : tags) {
            NodeList nodes = parent.getElementsByTagName(tag);
            if (nodes.getLength() == 0) {
                continue;
            }
            String value = nodes.item(0).getTextContent();
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private static String normalizeOrcaDate(String value) {
        if (isBlank(value)) {
            return null;
        }
        String digits = value.trim().replace("-", "");
        if (!digits.matches("\\d{8}")) {
            return value.trim();
        }
        return digits.substring(0, 4) + "-" + digits.substring(4, 6) + "-" + digits.substring(6, 8);
    }

    private static String normalizedDiseaseKey(String name, String code) {
        String normalizedName = name != null ? name.replace("　", "").replace(" ", "").trim() : "";
        String normalizedCode = code != null ? code.trim() : "";
        return normalizedName + "\u0000" + normalizedCode;
    }

    private static String safeXml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
